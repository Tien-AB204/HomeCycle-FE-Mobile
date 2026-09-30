export const HIGH_VALUE_THRESHOLD_VND = 3_000_000;

export const getContractTotal = (
  unitPrice: unknown,
  quantity: unknown,
): number => {
  const price = Number(unitPrice);
  const qty = Number(quantity);
  if (!Number.isFinite(price) || !Number.isFinite(qty) || price <= 0 || qty <= 0) {
    return 0;
  }
  return price * qty;
};

// BR-49: hợp đồng không kiểm định có tổng tiền trên ngưỡng phải hiện cảnh báo giá trị cao.
export const isHighValueWithoutInspection = (
  unitPrice: unknown,
  quantity: unknown,
  isInspection: boolean,
): boolean =>
  !isInspection &&
  getContractTotal(unitPrice, quantity) > HIGH_VALUE_THRESHOLD_VND;
