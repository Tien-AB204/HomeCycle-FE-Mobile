export const normalizePostType = (value: unknown) =>
  String(value ?? "").trim().toLowerCase();

export const isBuyPostType = (value: unknown) => {
  const normalized = normalizePostType(value);
  return normalized === "buy" || normalized === "2";
};

const toAmount = (value: unknown) => {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};
const formatVnd = (amount: number) => `${amount.toLocaleString("vi-VN")} đ`;

// Tin mua có khoảng giá priceFrom – priceTo (bản cũ: minExpectedPrice – basePrice).
export const formatBuyPriceRange = (from: unknown, to: unknown) => {
  const fromAmount = toAmount(from);
  const toAmountValue = toAmount(to);
  if (fromAmount !== null && toAmountValue !== null) {
    return fromAmount === toAmountValue
      ? formatVnd(fromAmount)
      : `${fromAmount.toLocaleString("vi-VN")} - ${formatVnd(toAmountValue)}`;
  }
  if (fromAmount !== null) return `Từ ${formatVnd(fromAmount)}`;
  if (toAmountValue !== null) return `Tối đa ${formatVnd(toAmountValue)}`;
  return "Giá thỏa thuận";
};

export const formatBuyPostPrice = (post: any) =>
  formatBuyPriceRange(
    post?.priceFrom ?? post?.minExpectedPrice,
    post?.priceTo ?? post?.basePrice ?? post?.expectedPrice,
  );

/**
 * The single merged label for whichever party posted the listing this
 * transaction is about — replaces the old "Người bán · Người đăng bài" /
 * "Người mua · Người đăng bài" composite. Only use this for the party that
 * IS the poster; the non-poster counterparty keeps a plain "Người mua" /
 * "Người bán".
 */
export const getPosterRoleLabel = (isBuyPost: boolean) =>
  isBuyPost ? "Người đăng bài mua" : "Người đăng bài bán";
