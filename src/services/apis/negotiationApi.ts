import apiClient from './axiosClient';

export const negotiationApi = {
  // Lấy danh sách phiên thương lượng của tôi
  getNegotiations: async (params?: { PageNumber?: number; PageSize?: number }) => {
    const response = await apiClient.get('/negotiations', { params });
    return response.data;
  },

  // Lấy chi tiết phòng thương lượng
  getNegotiationById: async (negotiationId: string) => {
    const response = await apiClient.get(`/negotiations/${negotiationId}`);
    return response.data;
  },

  // Lấy phòng thương lượng dựa theo ID của Offer ban đầu
  getNegotiationByOfferId: async (offerId: string) => {
    const response = await apiClient.get(`/negotiations/by-offer/${offerId}`);
    return response.data;
  },

  // Gửi mức giá/đề xuất mới (Counter) trong phòng
  counterNegotiation: async (negotiationId: string, data: { offerPrice: number; offerQuantity: number }) => {
    const response = await apiClient.post(`/negotiations/${negotiationId}/counter`, data);
    return response.data;
  },

  // Chấp nhận proposal và chốt thương lượng
  acceptProposal: async (negotiationId: string, proposalMessageId: string) => {
    const response = await apiClient.patch(`/negotiations/${negotiationId}/proposals/${proposalMessageId}/accept`);
    return response.data;
  },

  // Từ chối proposal hiện tại
  rejectProposal: async (negotiationId: string, proposalMessageId: string) => {
    const response = await apiClient.patch(`/negotiations/${negotiationId}/proposals/${proposalMessageId}/reject`);
    return response.data;
  },

  // Hủy phiên thương lượng
  cancelNegotiation: async (negotiationId: string) => {
    const response = await apiClient.post(`/negotiations/${negotiationId}/cancel`);
    return response.data;
  }
};