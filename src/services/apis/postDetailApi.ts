import apiClient from "./axiosClient";

/**
 * Chi tiết bài đăng theo loại (Backend nhánh mới):
 * - GET /posts/sell/{postId}  → SellPostDetail  (cần đăng nhập)
 * - GET /posts/buy/{postId}   → BuyPostDetail   (cần đăng nhập)
 * Sai loại bài đăng → 404. Endpoint cũ /posts/get-by-id/{id} (công khai) vẫn
 * tồn tại và là đường tải an toàn cho khách/liên kết trực tiếp.
 */

export type PostMedia = {
  mediaId?: string;
  url?: string | null;
  mediaUrl?: string | null;
  fileName?: string | null;
  displayOrder?: number;
};

export type ProductAttributeValue = {
  attributeId?: string;
  attributeName?: string | null;
  valueName?: string | null;
  value?: string | null;
};

export type ProductInfo = {
  productId?: string;
  categoryId?: string | null;
  productTypeId?: string | null;
  brandId?: string | null;
  categoryName?: string | null;
  productTypeName?: string | null;
  brandName?: string | null;
  productName?: string | null;
  spaceUsage?: string | number | null;
  modelNumber?: string | null;
  originalPrice?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  weight?: number | null;
  functionalityStatus?: string | number | null;
  usageDuration?: number | null;
  damageLevel?: string | number | null;
  detailDescription?: string | null;
  attributeValues?: ProductAttributeValue[];
};

// Yêu cầu sản phẩm của tin thu mua (không phải tồn kho bán).
export type BuyRequirement = {
  productId?: string;
  categoryId?: string | null;
  productTypeId?: string | null;
  brandId?: string | null;
  categoryName?: string | null;
  productTypeName?: string | null;
  brandName?: string | null;
  productName?: string | null;
  modelNumber?: string | null;
  functionalityStatus?: string | number | null;
  usageDuration?: number | null;
  damageLevel?: string | number | null;
  attributeValues?: ProductAttributeValue[];
};

// Tiến trình thu mua do Backend tính (agreedQuantity = số lượng đã lập hợp đồng Pending).
export type BuyPostProgress = {
  targetQuantity: number;
  agreedQuantity: number;
  remainingTargetQuantity: number;
  progressPercent: number;
  isTargetReached: boolean;
};

type TypedPostDetailBase = {
  postId: string;
  ownerId: string;
  ownerName?: string | null;
  avatarUrl?: string | null;
  verifyStatus?: string | number | null;
  averageRating?: number | null;
  totalReviews?: number;
  description?: string | null;
  quantity?: number | null;
  postType?: string | number | null;
  status?: string | number | null;
  streetAddress?: string | null;
  ward?: string | null;
  city?: string | null;
  createdAt?: string;
  updatedAt?: string;
  expiryDate?: string | null;
  isExpired?: boolean;
  medias?: PostMedia[];
};

export type SellPostDetail = TypedPostDetailBase & {
  product: ProductInfo;
  basePrice?: number | null;
  remainingQuantity?: number | null;
  deliveryMethod?: string | number | null;
  priorityLevel?: string | null;
};

export type BuyPostDetail = TypedPostDetailBase & {
  requirement: BuyRequirement;
  priceFrom?: number | null;
  priceTo?: number | null;
  priorityLevel?: string | null;
  progress: BuyPostProgress;
};

const unwrap = <T,>(value: any): T => (value?.data ?? value) as T;

export const postDetailApi = {
  getSellDetail: async (postId: string): Promise<SellPostDetail> =>
    unwrap<SellPostDetail>(
      (await apiClient.get(`/posts/sell/${encodeURIComponent(postId)}`)).data,
    ),
  getBuyDetail: async (postId: string): Promise<BuyPostDetail> =>
    unwrap<BuyPostDetail>(
      (await apiClient.get(`/posts/buy/${encodeURIComponent(postId)}`)).data,
    ),
  // Đường công khai/cũ: dùng cho khách và liên kết trực tiếp chưa biết loại.
  getLegacyDetail: async (postId: string): Promise<any> =>
    unwrap<any>((await apiClient.get(`/posts/get-by-id/${encodeURIComponent(postId)}`)).data),
};

export const normalizeBuyProgress = (value: unknown): BuyPostProgress | null => {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const target = Number(raw.targetQuantity ?? raw.TargetQuantity);
  const agreed = Number(raw.agreedQuantity ?? raw.AgreedQuantity);
  const remaining = Number(raw.remainingTargetQuantity ?? raw.RemainingTargetQuantity);
  const percent = Number(raw.progressPercent ?? raw.ProgressPercent);
  const reached = raw.isTargetReached ?? raw.IsTargetReached;
  if (!Number.isFinite(target) || !Number.isFinite(agreed)) return null;
  return {
    targetQuantity: target,
    agreedQuantity: agreed,
    remainingTargetQuantity: Number.isFinite(remaining) ? remaining : Math.max(0, target - agreed),
    progressPercent: Number.isFinite(percent) ? percent : 0,
    isTargetReached: reached === true,
  };
};

// Lỗi tạm thời được chấp nhận khi endpoint mới chưa triển khai / sai loại / chưa đăng nhập.
export const isTypedDetailUnavailable = (error: unknown): boolean => {
  const status = Number((error as any)?.response?.status || 0);
  return status === 404 || status === 401 || status === 403 || status >= 500 || status === 0;
};
