import apiClient from './axiosClient';

export const offerApi = {
  // Tạo đề nghị thương lượng mới
  createOffer: async (data: { postId: string; offerPrice: number; offerQuantity: number }) => {
    const response = await apiClient.post('/offers', data);
    return response.data;
  },

  // Cập nhật đề nghị ban đầu
  updateOffer: async (offerId: string, data: { offerPrice: number; offerQuantity: number }) => {
    const response = await apiClient.put(`/offers/${offerId}`, data);
    return response.data;
  },

  // Lấy thông tin đề nghị theo ID
  getOfferById: async (offerId: string) => {
    const response = await apiClient.get(`/offers/${offerId}`);
    return response.data;
  },

  // Hủy đề nghị thương lượng ban đầu
  cancelOffer: async (offerId: string) => {
    const response = await apiClient.post(`/offers/${offerId}/cancel`);
    return response.data;
  },

  // Từ chối đề nghị thương lượng ban đầu
  rejectOffer: async (offerId: string) => {
    const response = await apiClient.post(`/offers/${offerId}/reject`);
    return response.data;
  },

  // Chấp nhận mở thương lượng (Chuyển thành Negotiation)
  acceptOffer: async (offerId: string) => {
    const response = await apiClient.patch(`/offers/${offerId}/accept`);
    return response.data;
  },

  // Phản đề nghị ban đầu (Counter Initial Offer)
  counterInitialOffer: async (offerId: string, data: { offerPrice: number; offerQuantity: number; messageContent?: string }) => {
    const response = await apiClient.patch(`/offers/${offerId}/counter`, data);
    return response.data;
  },

  // Lấy danh sách đề nghị đã gửi
  getSentOffers: async (params?: { PageNumber?: number; PageSize?: number }) => {
    const response = await apiClient.get('/offers/sent', { params });
    return response.data;
  },

  // Lấy danh sách đề nghị đã nhận
  getReceivedOffers: async (params?: { PageNumber?: number; PageSize?: number }) => {
    const response = await apiClient.get('/offers/received', { params });
    return response.data;
  }
};