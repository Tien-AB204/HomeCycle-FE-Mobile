// Cross-cutting client-side prevalidation against the PUBLIC file upload
// policy (GET /api/platform-policies/file-upload, anonymous). This is an
// early UX layer only — Backend remains the final validation authority for
// size, extension, and Content-Type. See HomeCycle.Application.Services
// .Configs.FileValidationService for the authoritative server-side rule.
//
// This is deliberately NOT a REST wrapper file (no *Api.ts): it fetches once,
// caches the result for the app session, and exposes small validation
// helpers screens call directly around their existing image-picker code.

import apiClient from "./apis/axiosClient";

// Mirrors HomeCycle.Domain.Enums.FileUploadContext exactly (server serializes
// the enum as its name string). Do not invent additional contexts here.
export type FileUploadContext =
  | "Avatar"
  | "IdentityDocument"
  | "BusinessDocument"
  | "PostMedia"
  | "ReviewMedia"
  | "InspectionEvidence"
  | "DisputeEvidence";

export type FileUploadRule = {
  context: FileUploadContext;
  maxFileSizeBytes: number;
  allowedExtensions: string[];
};

export type FileUploadPolicy = {
  version: number;
  updatedAt: string;
  rules: Partial<Record<FileUploadContext, FileUploadRule>>;
};

export type LocalFileCandidate = {
  fileName?: string | null;
  uri?: string | null;
  fileSize?: number | null;
};

export type FileValidationResult =
  | { valid: true }
  | { valid: false; message: string };

const unwrap = (value: any) => value?.data ?? value;

const normalizeExtension = (value: unknown): string => {
  const trimmed = String(value ?? "").trim().toLowerCase();
  if (!trimmed) return "";
  return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
};

// Prefer the actual selected file name; fall back to the URI's path segment
// only, never a query string. Never used as a substitute for MIME.
const extractExtension = (candidate: LocalFileCandidate): string => {
  const source = candidate.fileName || candidate.uri || "";
  if (!source) return "";
  const withoutQuery = source.split(/[?#]/)[0];
  const lastSegment = withoutQuery.split("/").pop() || "";
  const match = /\.([a-zA-Z0-9]+)$/.exec(lastSegment);
  return match ? normalizeExtension(match[1]) : "";
};

const formatMaxSize = (maxFileSizeBytes: number): string => {
  const maxMb = maxFileSizeBytes / 1024 / 1024;
  const rounded = Math.round(maxMb * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

let cachedPolicy: FileUploadPolicy | null = null;
let inFlightRequest: Promise<FileUploadPolicy | null> | null = null;

async function fetchPolicy(): Promise<FileUploadPolicy | null> {
  try {
    const response = await apiClient.get("/platform-policies/file-upload");
    const data = unwrap(response.data);
    const rulesArray = Array.isArray(data?.config?.rules)
      ? data.config.rules
      : [];

    const rules: Partial<Record<FileUploadContext, FileUploadRule>> = {};

    for (const rawRule of rulesArray) {
      const context = String(rawRule?.context ?? "").trim() as
        | FileUploadContext
        | "";
      if (!context) continue;

      rules[context] = {
        context,
        maxFileSizeBytes: Number(rawRule?.maxFileSizeBytes) || 0,
        allowedExtensions: Array.isArray(rawRule?.allowedExtensions)
          ? rawRule.allowedExtensions.map(normalizeExtension).filter(Boolean)
          : [],
      };
    }

    return {
      version: Number(data?.version) || 0,
      updatedAt: String(data?.updatedAt ?? ""),
      rules,
    };
  } catch {
    // Fail-open: policy fetch failure is never permission to fabricate
    // limits, nor a reason to block the existing upload flow. Callers treat
    // a null policy the same as "no rule available for this context".
    return null;
  }
}

/**
 * Fetches (once) and shares the public file upload policy for the current
 * app session. Concurrent callers share the same in-flight request; a
 * successful result is cached in memory only (no AsyncStorage persistence,
 * no polling). Works without an auth token — the endpoint is anonymous.
 */
export function getFileUploadPolicy(): Promise<FileUploadPolicy | null> {
  if (cachedPolicy) return Promise.resolve(cachedPolicy);
  if (inFlightRequest) return inFlightRequest;

  inFlightRequest = fetchPolicy().then((policy) => {
    inFlightRequest = null;
    if (policy) cachedPolicy = policy;
    return policy;
  });

  return inFlightRequest;
}

/**
 * Validates one already-selected local file (never a remote/persisted URL)
 * against the policy rule for its context. A missing rule (policy
 * unavailable, or the context absent from a returned config) is treated as
 * "cannot prove invalid" — never as a fabricated pass/fail default.
 */
export function validateLocalFile(
  candidate: LocalFileCandidate,
  rule: FileUploadRule | null,
): FileValidationResult {
  if (!rule) return { valid: true };

  if (
    typeof candidate.fileSize === "number" &&
    candidate.fileSize > 0 &&
    rule.maxFileSizeBytes > 0 &&
    candidate.fileSize > rule.maxFileSizeBytes
  ) {
    return {
      valid: false,
      message: `Tệp này vượt quá giới hạn ${formatMaxSize(rule.maxFileSizeBytes)} MB.`,
    };
  }

  const extension = extractExtension(candidate);

  if (
    extension &&
    rule.allowedExtensions.length > 0 &&
    !rule.allowedExtensions.includes(extension)
  ) {
    return {
      valid: false,
      message: `Định dạng ${extension} không được hỗ trợ. Vui lòng chọn: ${rule.allowedExtensions.join(", ")}.`,
    };
  }

  return { valid: true };
}

/**
 * Convenience helper: loads the shared policy (one request, cached/deduped)
 * and validates every candidate against the rule for `context`. Returns the
 * first failure found, or `{ valid: true }` if the policy is unavailable or
 * every candidate passes. Only ever call this with newly-picked local
 * assets — never with already-persisted remote media.
 */
export async function validateNewLocalFiles(
  context: FileUploadContext,
  candidates: LocalFileCandidate[],
): Promise<FileValidationResult> {
  if (candidates.length === 0) return { valid: true };

  const policy = await getFileUploadPolicy();
  const rule = policy?.rules[context] ?? null;
  if (!rule) return { valid: true };

  for (const candidate of candidates) {
    const result = validateLocalFile(candidate, rule);
    if (!result.valid) return result;
  }

  return { valid: true };
}
