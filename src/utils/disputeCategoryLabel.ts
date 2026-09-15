const normalizeDisputeCategoryCode = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/[\s_-]/g, "")
    .toLowerCase();

const DISPUTE_CATEGORY_LABELS: Record<string, string> = {
  noshow: "Không xuất hiện / bùng hẹn",
  itemmismatch: "Hàng hóa không đúng mô tả",
  sellernotshipped: "Người bán không giao hàng",
  damagedorlost: "Hàng hóa hư hỏng hoặc thất lạc",
  itemnotreceived: "Không nhận được hàng",
  fraudorscam: "Gian lận / lừa đảo",
  paymentnotcompleted: "Không thanh toán theo thỏa thuận",
  commitmentviolation: "Vi phạm cam kết giao dịch",

  misleadingpost: "Thông tin bài đăng sai lệch",
  prohibiteditem: "Sản phẩm bị cấm",
  spam: "Nội dung rác hoặc quảng cáo lặp lại",
  inappropriatecontent: "Nội dung không phù hợp",

  abusivereview: "Đánh giá mang tính xúc phạm",
  harassment: "Quấy rối",

  other: "Khác",
};

export const getDisputeCategoryDisplayName = (
  code: unknown,
  fallbackName?: unknown,
  finalFallback = "Chưa xác định",
): string => {
  const normalizedCode = normalizeDisputeCategoryCode(code);
  const knownLabel = DISPUTE_CATEGORY_LABELS[normalizedCode];

  if (knownLabel) return knownLabel;

  const fallback = String(fallbackName ?? "").trim();
  if (fallback) return fallback;

  const rawCode = String(code ?? "").trim();
  return rawCode || finalFallback;
};
