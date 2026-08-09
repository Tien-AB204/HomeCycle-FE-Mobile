import apiClient from './axiosClient';

export const paymentApi = {
  // 1. Thanh toán qua PayOS (Tạo link QR)
  checkoutWithPayOS: async (agreementId: string) => {
    const response = await apiClient.post(`/payments/payos/checkout/${agreementId}`);
    return response.data;
  },

  // 2. Thanh toán bằng Ví nội bộ HomeCycle
  checkoutWithWallet: async (agreementId: string) => {
    const response = await apiClient.post(`/payments/wallet/checkout/${agreementId}`);
    return response.data;
  },
};