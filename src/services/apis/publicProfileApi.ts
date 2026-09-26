// Hồ sơ công khai người dùng — GET /api/auth/users/{userId}/profile (cần Bearer).
// Backend trả THẲNG đối tượng hồ sơ (không bọc trong `data`):
//   - trường chung: userId, username, avatarUrl, reputationScore, displayStarRating,
//     joinedAt, activePostCount
//   - Cá nhân: thêm fullName
//   - Doanh nghiệp: thêm businessName, businessDescription, businessAddress, ward,
//     city, operatingScope, businessModel (0/HouseholdBusiness, 1/Enterprise)
// Phản hồi KHÔNG có `role` lẫn `isVerified`: loại hồ sơ suy ra từ hình dạng phản hồi.
// 404: không tìm thấy / không hoạt động / thiếu hồ sơ / tài khoản quản trị (không công khai).
// Backend cố ý không trả email, số điện thoại, CCCD, ngân hàng, mật khẩu — không hiển thị.

import axiosClient from "./axiosClient";
import { getSafeErrorMessage, readSafeApiMessage } from "../../utils/errorMessage";

export type PublicProfileKind = "personal" | "business" | "unknown";

export type BusinessModelName = "HouseholdBusiness" | "Enterprise";

export interface PublicUserProfileBase {
  kind: PublicProfileKind;
  userId: string;
  username: string;
  avatarUrl: string | null;
  reputationScore: number;
  /** null khi chưa có đánh giá hợp lệ. */
  displayStarRating: number | null;
  /** Chuỗi ISO gốc từ Backend (định dạng hiển thị do màn hình quyết định). */
  joinedAt: string | null;
  activePostCount: number;
}

export interface PersonalPublicProfile extends PublicUserProfileBase {
  kind: "personal";
  fullName: string | null;
}

export interface BusinessPublicProfile extends PublicUserProfileBase {
  kind: "business";
  businessName: string | null;
  businessDescription: string | null;
  businessAddress: string | null;
  ward: string | null;
  city: string | null;
  operatingScope: string | null;
  /** Đã chuẩn hóa về tên enum; null khi Backend không trả hoặc giá trị không nhận ra. */
  businessModel: BusinessModelName | null;
  /** Giá trị thô để hiển thị dự phòng khi không nhận ra mô hình. */
  businessModelRaw: string | number | null;
}

export interface UnknownPublicProfile extends PublicUserProfileBase {
  kind: "unknown";
}

export type PublicUserProfile =
  | PersonalPublicProfile
  | BusinessPublicProfile
  | UnknownPublicProfile;

const BUSINESS_MODEL_LABELS: Record<BusinessModelName, string> = {
  HouseholdBusiness: "Hộ kinh doanh",
  Enterprise: "Doanh nghiệp",
};

const BUSINESS_SHAPE_KEYS = [
  "businessName",
  "businessDescription",
  "businessAddress",
  "operatingScope",
  "businessModel",
];

const PERSONAL_SHAPE_KEYS = ["fullName"];

const hasAnyKey = (raw: Record<string, unknown>, keys: readonly string[]) =>
  keys.some((key) => {
    const pascal = key.charAt(0).toUpperCase() + key.slice(1);
    return (
      Object.prototype.hasOwnProperty.call(raw, key) ||
      Object.prototype.hasOwnProperty.call(raw, pascal)
    );
  });

const pick = (raw: Record<string, unknown>, key: string): unknown => {
  const pascal = key.charAt(0).toUpperCase() + key.slice(1);
  if (Object.prototype.hasOwnProperty.call(raw, key)) return raw[key];
  if (Object.prototype.hasOwnProperty.call(raw, pascal)) return raw[pascal];
  return undefined;
};

const asText = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text ? text : null;
};

const asInt = (value: unknown): number => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : 0;
};

const asRating = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
};

/** Chấp nhận số (0/1), chuỗi số ("0"/"1") hoặc tên enum (không phân biệt hoa thường). */
export const normalizeBusinessModel = (value: unknown): BusinessModelName | null => {
  if (value === null || value === undefined || value === "") return null;
  const text = String(value).trim().toLowerCase();
  if (text === "0" || text === "householdbusiness") return "HouseholdBusiness";
  if (text === "1" || text === "enterprise") return "Enterprise";
  return null;
};

export const getBusinessModelLabel = (
  model: BusinessModelName | null,
  raw: string | number | null,
): string => {
  if (model) return BUSINESS_MODEL_LABELS[model];
  if (raw === null || raw === undefined || raw === "") return "Chưa cập nhật";
  // Giá trị Backend mới chưa được ánh xạ: hiển thị an toàn, không làm hỏng màn hình.
  return "Không xác định";
};

/** Suy ra loại hồ sơ từ hình dạng phản hồi (không đoán từ username). */
export const detectPublicProfileKind = (raw: Record<string, unknown>): PublicProfileKind => {
  if (hasAnyKey(raw, BUSINESS_SHAPE_KEYS)) return "business";
  if (hasAnyKey(raw, PERSONAL_SHAPE_KEYS)) return "personal";
  return "unknown";
};

export const normalizePublicProfile = (payload: unknown): PublicUserProfile => {
  // Phản hồi là đối tượng trực tiếp. Chỉ chấp nhận thêm một lớp `data` khi lớp ngoài
  // rõ ràng không phải hồ sơ (không có userId) — không "mở bọc" hai lần.
  let raw = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  if (
    pick(raw, "userId") === undefined &&
    raw.data &&
    typeof raw.data === "object" &&
    pick(raw.data as Record<string, unknown>, "userId") !== undefined
  ) {
    raw = raw.data as Record<string, unknown>;
  }

  const base: PublicUserProfileBase = {
    kind: detectPublicProfileKind(raw),
    userId: asText(pick(raw, "userId")) ?? "",
    username: asText(pick(raw, "username")) ?? "",
    avatarUrl: asText(pick(raw, "avatarUrl")),
    reputationScore: asInt(pick(raw, "reputationScore")),
    displayStarRating: asRating(pick(raw, "displayStarRating")),
    joinedAt: asText(pick(raw, "joinedAt")),
    activePostCount: Math.max(0, asInt(pick(raw, "activePostCount"))),
  };

  if (base.kind === "business") {
    const rawModel = pick(raw, "businessModel");
    return {
      ...base,
      kind: "business",
      businessName: asText(pick(raw, "businessName")),
      businessDescription: asText(pick(raw, "businessDescription")),
      businessAddress: asText(pick(raw, "businessAddress")),
      ward: asText(pick(raw, "ward")),
      city: asText(pick(raw, "city")),
      operatingScope: asText(pick(raw, "operatingScope")),
      businessModel: normalizeBusinessModel(rawModel),
      businessModelRaw:
        typeof rawModel === "number" ? rawModel : asText(rawModel),
    };
  }

  if (base.kind === "personal") {
    return { ...base, kind: "personal", fullName: asText(pick(raw, "fullName")) };
  }

  return { ...base, kind: "unknown" };
};

export const PUBLIC_PROFILE_UNAVAILABLE_MESSAGE =
  "Hồ sơ công khai của người dùng này hiện không khả dụng.";

export const getPublicProfileErrorMessage = (error: unknown): string => {
  // Ưu tiên thông điệp BE; các câu dưới đây chỉ là dự phòng.
  const backendMessage = readSafeApiMessage((error as any)?.response?.data);
  if (backendMessage) return backendMessage;
  const status = Number((error as any)?.response?.status || 0);
  if (status === 404) return PUBLIC_PROFILE_UNAVAILABLE_MESSAGE;
  if (status === 401) return "Vui lòng đăng nhập để xem hồ sơ người dùng.";
  return getSafeErrorMessage(error, "Không thể tải hồ sơ người dùng. Vui lòng thử lại.");
};

export const publicProfileApi = {
  getProfile: async (userId: string): Promise<PublicUserProfile> => {
    const response = await axiosClient.get(`/auth/users/${encodeURIComponent(userId)}/profile`);
    return normalizePublicProfile(response.data);
  },
};

export default publicProfileApi;
