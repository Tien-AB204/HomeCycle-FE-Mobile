import apiClient from './axiosClient';

export const postApi = {
  // ==========================================
  // 1. QUẢN LÝ TIN ĐĂNG (POSTS)
  // ==========================================
  
  // Lấy tất cả bài đăng (Bao gồm cả các trạng thái khác)
  // getAllPosts: async (params?: any) => {
  //   const response = await apiClient.get('/posts/get-all', { params });
  //   return response.data;
  // },

  // THÊM MỚI: Chỉ lấy danh sách bài đăng đang hoạt động (cho trang chủ)
  getAllActivePosts: async (params?: any) => {
    const response = await apiClient.get('/posts/get-all-active', { params });
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

  getAllCategories: async () => {
    const response = await apiClient.get('/categories/get-all', {
      params: { PageSize: 100, PageNumber: 1 }
    });
    return response.data;
  },

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
  }
};