// BE trả số tài khoản đã che (vd. ****1234) trong hồ sơ và từ chối nhận lại giá trị này.
export const isMaskedAccountNumber = (value: unknown) =>
  /[*•xX]/.test(String(value ?? ""));

// Giá trị điền sẵn vào ô nhập: bỏ trống khi BE chỉ trả số đã che để người dùng nhập lại số đầy đủ.
export const editableAccountNumber = (value: unknown) => {
  const text =
    value === null || value === undefined || value === "null" || value === "string"
      ? ""
      : String(value).trim();
  return isMaskedAccountNumber(text) ? "" : text;
};

export const MASKED_ACCOUNT_NUMBER_REQUIRED_MESSAGE =
  "Vui lòng nhập lại số tài khoản đầy đủ khi thay đổi thông tin ngân hàng.";

export const accountNumberPlaceholder = (current: unknown, fallback: string) =>
  isMaskedAccountNumber(current)
    ? `Nhập lại số đầy đủ (hiện tại ${String(current).trim()})`
    : fallback;
