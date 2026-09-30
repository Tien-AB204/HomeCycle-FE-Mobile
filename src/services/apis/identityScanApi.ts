// Quét CCCD bằng AI (BE gọi Gemini). Ba luồng:
//   - Đăng ký cá nhân: POST /auth/personal/scan-identity + header X-Registration-Token.
//   - Cá nhân đã đăng nhập: POST /personal-profiles/me/identity/scan (Bearer).
//   - Doanh nghiệp đã đăng nhập: POST /business-profiles/me/identity/scan (Bearer).
// Body multipart: FrontImage, BackImage, ConsentConfirmed. Kết quả chỉ là gợi ý để người dùng đối chiếu.
import { Platform } from "react-native";

import apiClient from "./axiosClient";
import { readSafeApiMessage } from "../../utils/errorMessage";

export type IdentityScanTarget =
  | { kind: "register"; registrationToken: string }
  | { kind: "personal" }
  | { kind: "business" };

export type IdentityScanImage = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export type IdentityScanResult = {
  identityNumber: string | null;
  fullName: string | null;
  // yyyy-MM-dd
  dateOfBirth: string | null;
  address: string | null;
  unreadableFields: string[];
  warnings: string[];
};

export const IDENTITY_SCAN_FIELD_LABELS: Record<string, string> = {
  identityNumber: "Số CCCD",
  fullName: "Họ và tên",
  dateOfBirth: "Ngày sinh",
  address: "Địa chỉ",
};

const MIME_BY_EXTENSION: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const resolveMimeType = (image: IdentityScanImage) => {
  const declared = String(image.mimeType ?? "").toLowerCase();
  if (Object.values(MIME_BY_EXTENSION).includes(declared)) return declared;
  const source = String(image.fileName || image.uri).split("?")[0];
  const extension = source.split(".").pop()?.toLowerCase() ?? "";
  return MIME_BY_EXTENSION[extension] ?? "image/jpeg";
};

const appendImage = async (
  formData: FormData,
  key: string,
  image: IdentityScanImage,
  defaultName: string,
) => {
  if (Platform.OS === "web") {
    const response = await fetch(image.uri);
    const blob = await response.blob();
    formData.append(key, blob, image.fileName || defaultName);
    return;
  }

  const type = resolveMimeType(image);
  const extension = type.split("/")[1] === "jpeg" ? "jpg" : type.split("/")[1];
  formData.append(key, {
    uri: Platform.OS === "ios" ? image.uri.replace("file://", "") : image.uri,
    name: image.fileName || `${defaultName}.${extension}`,
    type,
  } as any);
};

const asText = (value: unknown) => {
  const text = typeof value === "string" ? value.trim() : "";
  return text || null;
};

const asTextList = (value: unknown) =>
  Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

export const scanIdentityDocument = async (
  target: IdentityScanTarget,
  front: IdentityScanImage,
  back: IdentityScanImage,
): Promise<IdentityScanResult> => {
  const formData = new FormData();
  await appendImage(formData, "FrontImage", front, "cccd-front");
  await appendImage(formData, "BackImage", back, "cccd-back");
  formData.append("ConsentConfirmed", "true");

  const url =
    target.kind === "register"
      ? "/auth/personal/scan-identity"
      : target.kind === "personal"
        ? "/personal-profiles/me/identity/scan"
        : "/business-profiles/me/identity/scan";

  const response = await apiClient.post(url, formData, {
    timeout: 90000,
    headers:
      target.kind === "register"
        ? { "X-Registration-Token": target.registrationToken }
        : undefined,
  });

  const data = response.data?.data ?? response.data ?? {};
  return {
    identityNumber: asText(data.identityNumber),
    fullName: asText(data.fullName),
    dateOfBirth: asText(data.dateOfBirth),
    address: asText(data.address),
    unreadableFields: asTextList(data.unreadableFields),
    warnings: asTextList(data.warnings),
  };
};

const FALLBACK_MESSAGES: Record<string, string> = {
  REGISTRATION_TOKEN_REQUIRED: "Phiên đăng ký không hợp lệ. Vui lòng xác thực lại email.",
  REGISTRATION_TOKEN_INVALID_OR_EXPIRED: "Phiên đăng ký không hợp lệ. Vui lòng xác thực lại email.",
  IDENTITY_SCAN_ROLE_FORBIDDEN: "Tài khoản không có quyền quét CCCD theo luồng này.",
  IDENTITY_SCAN_RATE_LIMITED: "Dịch vụ quét đang quá tải hoặc hết hạn mức. Vui lòng thử lại sau.",
  IDENTITY_SCAN_TEMPORARILY_UNAVAILABLE: "Dịch vụ quét tạm thời không khả dụng. Vui lòng thử lại sau.",
  IDENTITY_SCAN_TIMEOUT: "Dịch vụ quét phản hồi quá lâu. Vui lòng thử lại sau.",
  IDENTITY_SCAN_PROVIDER_CONFIGURATION_ERROR:
    "Chưa thể quét CCCD lúc này. Vui lòng tự nhập thông tin hoặc liên hệ hỗ trợ.",
  IDENTITY_SCAN_PROVIDER_INVALID_RESPONSE:
    "Chưa thể quét CCCD lúc này. Vui lòng tự nhập thông tin hoặc liên hệ hỗ trợ.",
};

export const getIdentityScanErrorMessage = (error: unknown): string => {
  const data = (error as any)?.response?.data;
  const code = String(data?.code ?? "").trim();
  const backendMessage = readSafeApiMessage(data);
  if (backendMessage) return backendMessage;
  if (code && FALLBACK_MESSAGES[code]) return FALLBACK_MESSAGES[code];
  const status = Number((error as any)?.response?.status || 0);
  if (status === 429) return FALLBACK_MESSAGES.IDENTITY_SCAN_RATE_LIMITED;
  if (status === 503) return FALLBACK_MESSAGES.IDENTITY_SCAN_TEMPORARILY_UNAVAILABLE;
  if (status === 504) return FALLBACK_MESSAGES.IDENTITY_SCAN_TIMEOUT;
  if (status === 502) return FALLBACK_MESSAGES.IDENTITY_SCAN_PROVIDER_CONFIGURATION_ERROR;
  return "Không thể quét CCCD. Vui lòng kiểm tra ảnh và thử lại, hoặc tự nhập thông tin.";
};
