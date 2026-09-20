import type { BuyPostProgress } from "../services/apis/postDetailApi";

/**
 * Điều kiện cho phép gửi chào bán mới vào tin thu mua.
 * Trạng thái bài đăng là nguồn có thẩm quyền: KHÔNG suy ra "đang mở" từ
 * remainingTargetQuantity > 0 (Backend không tự mở lại tin khi giao dịch bị hủy).
 */
export type BuyOfferEligibility = {
  allowed: boolean;
  reason: "target-reached" | "inactive" | "expired" | null;
  message: string | null;
};

const isActiveStatus = (status: unknown) => {
  const normalized = String(status ?? "").trim().toLowerCase();
  return normalized === "active" || normalized === "1";
};

export const getBuyOfferEligibility = (
  post: {
    status?: unknown;
    isExpired?: boolean | null;
    expiryDate?: string | null;
  } | null | undefined,
  progress?: BuyPostProgress | null,
): BuyOfferEligibility => {
  if (!post) return { allowed: false, reason: "inactive", message: "Tin thu mua hiện không khả dụng." };

  if (!isActiveStatus(post.status)) {
    return {
      allowed: false,
      reason: "inactive",
      message: "Tin thu mua này hiện không còn nhận chào bán.",
    };
  }

  const expiry = post.expiryDate ? Date.parse(post.expiryDate) : NaN;
  if (post.isExpired === true || (Number.isFinite(expiry) && expiry <= Date.now())) {
    return {
      allowed: false,
      reason: "expired",
      message: "Tin thu mua này đã hết hạn.",
    };
  }

  if (progress?.isTargetReached === true) {
    return {
      allowed: false,
      reason: "target-reached",
      message: "Tin thu mua đã đủ số lượng cần mua.",
    };
  }

  return { allowed: true, reason: null, message: null };
};
