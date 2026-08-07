import apiClient from './axiosClient';

export const postApi = {
  // ==========================================
  // 1. QUẢN LÝ TIN ĐĂNG (POSTS)
  // ==========================================
  
  getAllPosts: async (params?: any) => {
    const response = await apiClient.get('/posts/get-all', { params });
    return response.data;
  },

  getPostsByUser: async (userId: string, params?: { PageNumber?: number; PageSize?: number }) => {
    const response = await apiClient.get(`/posts/get-all/by-user/${userId}`, { params });
    return response.data;
  },

  getPostById: async (postId: string) => {
    const response = await apiClient.get(`/posts/get-by-id/${postId}`);
    return response.data;
  },

  getPostDetailByUser: async (userId: string, postId: string) => {
    const response = await apiClient.get(`/posts/get-detail-by-user/${userId}/${postId}`);
    return response.data;
  },

  // --- Tạo & Sửa tin Bán ---
  createSellPost: async (formData: FormData) => {
    return await apiClient.post('/posts/create/sell', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
  },

  updateSellPost: async (postId: string, formData: FormData) => {
    const response = await apiClient.put(`/posts/update/sell/${postId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
    return response.data;
  },

  // --- Tạo & Sửa tin Mua ---
  createBuyPost: async (data: FormData) => {
    const response = await apiClient.post('/posts/create/buy', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  updateBuyPost: async (postId: string, formData: FormData) => {
    const response = await apiClient.put(`/posts/update/buy/${postId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
    return response.data;
  },

  // --- Trạng thái bài đăng ---
  // Đóng bài đăng
  closePost: async (postId: string) => {
    const response = await apiClient.patch(`/posts/${postId}/close`);
    return response.data;
  },

  // Kích hoạt lại bài đăng đã đóng
  reactivatePost: async (postId: string) => {
    const response = await apiClient.patch(`/posts/${postId}/reactivate`);
    return response.data;
  },

  // ==========================================
  // 2. DỮ LIỆU DANH MỤC (MASTER DATA)
  // ==========================================

  // Lấy danh sách danh mục (Tất cả - Dành cho Admin/Form)
  getAllCategories: async () => {
    const response = await apiClient.get('/categories/get-all', {
      params: { PageSize: 100, PageNumber: 1 }
    });
    return response.data;
  },

  // Lấy danh sách danh mục ĐANG HOẠT ĐỘNG (Dành cho hiển thị Trang chủ)
  getActiveCategories: async () => {
    const response = await apiClient.get('/categories/active', {
      params: { PageSize: 100, PageNumber: 1 }
    });
    return response.data;
  },

  getAllProductTypes: async () => {
    const response = await apiClient.get('/product-types/get-all', {
      params: { PageSize: 100, PageNumber: 1 }
    });
    return response.data;
  },

  getAllBrands: async () => {
    const response = await apiClient.get('/brands', {
      params: { PageSize: 100, PageNumber: 1 }
    });
    return response.data;
  },

  getAttributesByProductType: async (productTypeId: string) => {
    const response = await apiClient.get(`/product-types/${productTypeId}/attributes`);
    return response.data;
  },

  getAttributeDetailsById: async (attributeId: string) => {
    const response = await apiClient.get(`/product-types/attributes/get-by-id/${attributeId}`);
    return response.data;
  },

  // ==========================================
  // 3. THƯƠNG LƯỢNG (OFFERS) - GÓC NHÌN NGƯỜI GỬI ĐI
  // ==========================================

  createOffer: async (data: { postId: string; offerPrice: number; offerQuantity: number }) => {
    const response = await apiClient.post('/offers', data);
    return response.data;
  },

  getSentOffers: async (params?: { PageNumber?: number; PageSize?: number }) => {
    const response = await apiClient.get('/offers/sent', { params });
    return response.data;
  },

  getOfferById: async (offerId: string) => {
    const response = await apiClient.get(`/offers/${offerId}`);
    return response.data;
  },

  updateOffer: async (offerId: string, data: { offerPrice: number; offerQuantity: number }) => {
    const response = await apiClient.put(`/offers/${offerId}`, data);
    return response.data;
  },

  cancelOffer: async (offerId: string) => {
    const response = await apiClient.post(`/offers/${offerId}/cancel`);
    return response.data;
  },

  // ==========================================
  // 4. THƯƠNG LƯỢNG (OFFERS) - GÓC NHÌN NGƯỜI NHẬN YÊU CẦU
  // ==========================================
  
  getReceivedOffers: async (params?: { PageNumber?: number; PageSize?: number }) => {
    const response = await apiClient.get('/offers/received', { params });
    return response.data;
  },

  acceptOffer: async (offerId: string) => {
    const response = await apiClient.post(`/offers/${offerId}/accept`);
    return response.data;
  },

  rejectOffer: async (offerId: string) => {
    const response = await apiClient.post(`/offers/${offerId}/reject`);
    return response.data;
  },

  counterInitialOffer: async (offerId: string, data: { offerPrice: number; offerQuantity: number; messageContent: string }) => {
    const response = await apiClient.post(`/offers/${offerId}/counter`, data);
    return response.data;
  },

  // ==========================================
  // 5. THƯƠNG LƯỢNG BÊN TRONG PHÒNG CHAT (NEGOTIATIONS)
  // Nhánh API: /api/offers/negotiations/...
  // ==========================================

  // Lấy chi tiết phòng chat theo negotiationId
  getNegotiationById: async (negotiationId: string) => {
    const response = await apiClient.get(`/offers/negotiations/${negotiationId}`);
    return response.data;
  },

  // Lấy lịch sử tin nhắn trong phòng chat
  getNegotiationMessages: async (negotiationId: string, params?: { PageNumber?: number; PageSize?: number }) => {
    const response = await apiClient.get(`/offers/negotiations/${negotiationId}/messages`, { params });
    return response.data;
  },

  // Tìm phòng chat ngược từ Offer ID ban đầu
  getNegotiationByOfferId: async (offerId: string) => {
    const response = await apiClient.get(`/offers/${offerId}/negotiation`);
    return response.data;
  },

  // Đề xuất giá mới bên trong phòng (Lưu ý: Không có messageContent)
  counterNegotiation: async (negotiationId: string, data: { offerPrice: number; offerQuantity: number }) => {
    const response = await apiClient.post(`/offers/negotiations/${negotiationId}/counter`, data);
    return response.data;
  },

  // Chấp nhận chốt deal
  acceptNegotiation: async (negotiationId: string) => {
    const response = await apiClient.post(`/offers/negotiations/${negotiationId}/accept`);
    return response.data;
  },

  // Hủy kèo / Từ chối bên trong phòng chat
  rejectNegotiation: async (negotiationId: string) => {
    const response = await apiClient.post(`/offers/negotiations/${negotiationId}/reject`);
    return response.data;
  }
};