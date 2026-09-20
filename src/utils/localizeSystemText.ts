const SYSTEM_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\bcheck-in\b/gi, "xác nhận có mặt"],
  [/\bBuyer\b/gi, "Người mua"],
  [/\bSeller\b/gi, "Người bán"],
  [/\bModerator\b/gi, "Kiểm duyệt viên"],
  [/\bPersonal\b/gi, "Cá nhân"],
  [/\bBusiness\b/gi, "Doanh nghiệp"],
  [/\bPending\b/gi, "Đang chờ xử lý"],
  [/\bProcessing\b/gi, "Đang xử lý"],
  [/\bCompleted\b/gi, "Hoàn tất"],
  [/\bCancelled\b/gi, "Đã hủy"],
  [/\bCanceled\b/gi, "Đã hủy"],
  [/\bFailed\b/gi, "Thất bại"],
  [/\bSuccess\b/gi, "Thành công"],
  [/\bActive\b/gi, "Đang hoạt động"],
  [/\bInactive\b/gi, "Ngừng hoạt động"],
  [/\bUnknown\b/gi, "Chưa xác định"],
  [/\bApproved\b/gi, "Đã duyệt"],
  [/\bRejected\b/gi, "Đã từ chối"],
  [/\bExpired\b/gi, "Đã hết hạn"],
  [/\bRefunded\b/gi, "Đã hoàn tiền"],
  [/\bPartiallyRefunded\b/gi, "Đã hoàn tiền một phần"],
  [/\bScheduled\b/gi, "Đã lên lịch"],
  [/\bProposed\b/gi, "Đang đề xuất"],
  [/\bInProgress\b/gi, "Đang diễn ra"],
  [/\bReturned\b/gi, "Đã hoàn trả"],
  [/\bDelivering\b/gi, "Đang vận chuyển"],
  [/\bReadyToPick\b/gi, "Sẵn sàng lấy hàng"],
  [/\bException\b/gi, "Ngoại lệ"],
  [/\bDamage_Lost\b/gi, "Hư hỏng hoặc thất lạc"],
  [/\bdispute\b/gi, "tranh chấp"],
  [/\border\b/gi, "đơn hàng"],
  [/\brefund\b/gi, "hoàn tiền"],
  [/\breturn\b/gi, "trả hàng"],
  [/\bpayment\b/gi, "thanh toán"],
  [/\bshipping\b/gi, "vận chuyển"],
  [/\bdelivery\b/gi, "giao hàng"],
  [/\bappointment\b/gi, "lịch hẹn"],
  [/\binspection\b/gi, "kiểm định"],
  [/\breview\b/gi, "đánh giá"],
  [/\bprofile\b/gi, "hồ sơ"],
  [/\baccount\b/gi, "tài khoản"],
  [/\bwallet\b/gi, "ví"],
  [/\boffer\b/gi, "đề nghị"],
  [/\bagreement\b/gi, "hợp đồng"],
  [/\bFree\b/gi, "Miễn phí"],
  [/\bPremium\b/gi, "Cao cấp"],
  [/\bBasic\b/gi, "Cơ bản"],
  [/\bStandard\b/gi, "Tiêu chuẩn"],
  [/\bPackage\b/gi, "Gói"],
  [/\bPlan\b/gi, "Gói"],
  [/\bUnlimited\b/gi, "Không giới hạn"],
  [/\bLimited\b/gi, "Giới hạn"],
  [/\bDays?\b/gi, "ngày"],
  [/\bMonths?\b/gi, "tháng"],
  [/\bYears?\b/gi, "năm"],
  [/\bplatform-held funds\b/gi, "khoản tiền nền tảng đang giữ"],
  [/\bheld funds\b/gi, "khoản tiền đang được giữ"],
  [/\breturned item\b/gi, "hàng trả"],
  [/\bitem\b/gi, "sản phẩm"],
  [/\bconfirms\b/gi, "xác nhận"],
  [/\bconfirmed\b/gi, "đã xác nhận"],
  [/\bwaiting\b/gi, "đang chờ"],
  [/\bcreated\b/gi, "đã tạo"],
  [/\bupdated\b/gi, "đã cập nhật"],
  [/\bready\b/gi, "sẵn sàng"],
  [/\breceived\b/gi, "đã nhận"],
];

const REMAINING_ENGLISH_SYSTEM_WORDS =
  /\b(the|and|or|is|are|was|were|has|have|had|from|with|without|after|before|because|when|while|not|found|invalid|error|successful|successfully|confirm|confirmation|funds|platform|seller|buyer|moderator|pending|processing|completed|cancelled|canceled|failed|success|active|inactive|unknown|approved|rejected|expired|refunded|partiallyrefunded|scheduled|proposed|inprogress|returned|delivering|readytopick|exception|damage_lost|dispute|order|refund|return|payment|shipping|delivery|appointment|inspection|review|profile|account|wallet|offer|agreement|free|premium|basic|standard|package|plan|unlimited|limited|days?|months?|years?)\b/i;

const VIETNAMESE_TEXT_SIGNAL =
  /[àáâãèéêìíòóôõùúýăđĩũơưạ-ỹ]|\b(người|đơn|hàng|đã|đang|chưa|không|vui lòng|thanh toán|hợp đồng|tranh chấp|kiểm định|lịch hẹn|đánh giá|hồ sơ|tài khoản|giao hàng|vận chuyển|trả hàng|hoàn tiền|thành công|thất bại|xác nhận|cập nhật|miễn phí|cao cấp|cơ bản|tiêu chuẩn|ngày|tháng|năm)\b/i;

const ALLOWED_SYSTEM_BRAND_TEXT =
  /^(?:HomeCycle|GHN|PayOS|VIP|HomeCycle\s+VIP|GHN\s+Express)$/i;

const looksLikeUntranslatedEnglishProse = (text: string): boolean => {
  if (ALLOWED_SYSTEM_BRAND_TEXT.test(text)) return false;
  if (VIETNAMESE_TEXT_SIGNAL.test(text)) return false;

  const asciiWords = text.match(/[A-Za-z]{2,}/g) ?? [];
  return asciiWords.length >= 2;
};

/**
 * Chỉ dùng cho text hệ thống/Backend, không dùng cho tên người, tên doanh nghiệp,
 * tên sản phẩm hoặc nội dung do người dùng nhập.
 */
export const localizeSystemText = (
  value: unknown,
  fallback = "",
): string => {
  if (value === undefined || value === null) return fallback;

  let text = String(value).trim();
  if (!text) return fallback;

  for (const [pattern, replacement] of SYSTEM_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  if (
    REMAINING_ENGLISH_SYSTEM_WORDS.test(text) ||
    looksLikeUntranslatedEnglishProse(text)
  ) {
    return fallback;
  }

  return text;
};

export default localizeSystemText;
