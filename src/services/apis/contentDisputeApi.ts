// Isolated adapter for USER-SIDE content reporting (Post/Review disputes).
//
// Category sourcing is deliberately kept separate from app/disputes/create.tsx
// (Order disputes). Verified against current Backend main + deployed Swagger:
// POST /api/disputes validates DisputeCategoryId (int) against the dynamic,
// DB-backed dispute_category table — the same source GET /dispute-categories
// exposes. GET /disputes/options's categories[].value is a static DisputeCategory
// enum serialized as a STRING name and is NOT accepted by the int
// DisputeCategoryId field; it is used here only for the numeric form limits.
// If Backend later moves content reports to a Category-enum submission
// contract, only this file should need to change.

import { Platform } from "react-native";
import apiClient from "./axiosClient";

export type ContentReportTargetType = "Post" | "Review";

export type ContentReportCategoryOption = {
  disputeCategoryId: number;
  name: string;
  description: string | null;
};

export type ContentReportLimits = {
  minimumEvidenceImages: number;
  maximumEvidenceImages: number;
  minimumDescriptionLength: number;
  maximumDescriptionLength: number;
};

// Used only if GET /disputes/options cannot be loaded. Authoritative values
// always come from that endpoint when available (see getContentReportLimits).
export const FALLBACK_CONTENT_REPORT_LIMITS: ContentReportLimits = {
  minimumEvidenceImages: 2,
  maximumEvidenceImages: 5,
  minimumDescriptionLength: 10,
  maximumDescriptionLength: 2000,
};

const unwrap = (value: any) => value?.data ?? value;

export const getContentReportCategories = async (
  targetType: ContentReportTargetType,
): Promise<ContentReportCategoryOption[]> => {
  const response = await apiClient.get("/dispute-categories", {
    params: { targetType },
  });
  const data = unwrap(response.data);
  const list = Array.isArray(data)
    ? data
    : Array.isArray(data?.items)
      ? data.items
      : [];

  return list
    .map((item: any): ContentReportCategoryOption | null => {
      const disputeCategoryId = Number(
        item?.disputeCategoryId ?? item?.DisputeCategoryId,
      );
      if (!Number.isFinite(disputeCategoryId)) return null;

      return {
        disputeCategoryId,
        name: String(item?.name ?? item?.Name ?? `Loại #${disputeCategoryId}`),
        description: (item?.description ?? item?.Description ?? null) as
          | string
          | null,
      };
    })
    .filter(
      (item: ContentReportCategoryOption | null): item is ContentReportCategoryOption =>
        item !== null,
    );
};

export const getContentReportLimits = async (
  targetType: ContentReportTargetType,
): Promise<ContentReportLimits> => {
  const response = await apiClient.get("/disputes/options", {
    params: { targetType },
  });
  const data = unwrap(response.data);

  const toPositiveInt = (value: unknown, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
  };

  return {
    minimumEvidenceImages: toPositiveInt(
      data?.minimumEvidenceImages,
      FALLBACK_CONTENT_REPORT_LIMITS.minimumEvidenceImages,
    ),
    maximumEvidenceImages: toPositiveInt(
      data?.maximumEvidenceImages,
      FALLBACK_CONTENT_REPORT_LIMITS.maximumEvidenceImages,
    ),
    minimumDescriptionLength: toPositiveInt(
      data?.minimumDescriptionLength,
      FALLBACK_CONTENT_REPORT_LIMITS.minimumDescriptionLength,
    ),
    maximumDescriptionLength: toPositiveInt(
      data?.maximumDescriptionLength,
      FALLBACK_CONTENT_REPORT_LIMITS.maximumDescriptionLength,
    ),
  };
};

export type ContentReportImageAsset = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export type CreateContentReportPayload = {
  targetType: ContentReportTargetType;
  targetId: string;
  disputeCategoryId: number;
  description: string;
  images: ContentReportImageAsset[];
};

export const createContentReport = async (
  payload: CreateContentReportPayload,
): Promise<any> => {
  const formData = new FormData();
  formData.append("TargetType", payload.targetType);
  formData.append("TargetId", payload.targetId);
  formData.append("DisputeCategoryId", String(payload.disputeCategoryId));
  formData.append("Description", payload.description);

  for (let index = 0; index < payload.images.length; index += 1) {
    const asset = payload.images[index];
    const fallbackName = `report-evidence-${index + 1}.jpg`;

    if (Platform.OS === "web") {
      const response = await fetch(asset.uri);
      const blob = await response.blob();
      formData.append("EvidenceImages", blob, asset.fileName || fallbackName);
    } else {
      formData.append("EvidenceImages", {
        uri: asset.uri,
        name: asset.fileName || fallbackName,
        type: asset.mimeType || "image/jpeg",
      } as any);
    }
  }

  // Không tự set Content-Type để runtime/Axios tự tạo multipart boundary.
  const response = await apiClient.post("/disputes", formData, {
    timeout: 60000,
  });
  return unwrap(response.data);
};
