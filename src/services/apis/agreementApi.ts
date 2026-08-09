import apiClient from './axiosClient';

export const agreementApi = {
  // Lấy thông tin preview của đơn xác nhận
  getPreview: async (negotiationId: string) => {
    const response = await apiClient.get(`/agreements/preview/${negotiationId}`);
    return response.data;
  },

  // Tạo đơn xác nhận mới
  createAgreement: async (data: any) => {
    const response = await apiClient.post('/agreements', data);
    return response.data;
  },

  // Lấy chi tiết đơn xác nhận theo ID
  getAgreementById: async (agreementId: string) => {
    const response = await apiClient.get(`/agreements/${agreementId}`);
    return response.data;
  },

  // Cập nhật đơn xác nhận (Yêu cầu sửa đổi)
  updateAgreement: async (agreementId: string, data: any) => {
    const response = await apiClient.put(`/agreements/${agreementId}`, data);
    return response.data;
  },

  // Đồng ý đơn xác nhận (Accept)
  acceptAgreement: async (id: string) => {
    const response = await apiClient.patch(`/agreements/${id}/accept`);
    return response.data;
  }
};