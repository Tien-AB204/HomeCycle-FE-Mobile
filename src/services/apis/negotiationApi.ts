import apiClient from './axiosClient';

export const negotiationApi = {
  // Lấy chi tiết phòng thương lượng
  getNegotiationById: async (negotiationId: string) => {
    const response = await apiClient.get(`/Negotiations/${negotiationId}`);
    return response.data;
  },

  // Lấy phòng thương lượng dựa theo ID của Offer ban đầu
  getNegotiationByOfferId: async (offerId: string) => {
    const response = await apiClient.get(`/Negotiations/by-offer/${offerId}`);
    return response.data;
  },

  // Lấy lịch sử tin nhắn / lịch sử trả giá trong phòng
  getMessages: async (negotiationId: string) => {
    const response = await apiClient.get(`/Negotiations/${negotiationId}/messages`);
    return response.data;
  },

  // Trả giá mới (Counter) ngay bên trong phòng chat
  counterProposal: async (negotiationId: string, data: { price: number; quantity: number }) => {
    const response = await apiClient.post(`/Negotiations/${negotiationId}/counter`, data);
    return response.data;
  },

  // Chốt đơn (Chấp nhận mức giá hiện tại trong phòng)
  acceptProposal: async (negotiationId: string) => {
    const response = await apiClient.post(`/Negotiations/${negotiationId}/accept`);
    return response.data;
  },

  // Hủy kèo / Từ chối proposal hiện tại
  rejectProposal: async (negotiationId: string) => {
    const response = await apiClient.post(`/Negotiations/${negotiationId}/reject-proposal`);
    return response.data;
  }
};