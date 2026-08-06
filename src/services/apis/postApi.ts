// src/services/apis/postApi.ts
import apiClient from './axiosClient';

export const postApi = {
  // Hàm đăng tin Bán (Dùng FormData)
  createSellPost: async (formData: FormData) => {
    return await apiClient.post('/posts/create/sell', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        // Token đăng nhập sẽ được axiosClient tự động đính kèm (nếu bạn đã setup interceptors)
      },
      // Kéo dài thời gian load lên 30 giây (30,000 milliseconds)
      timeout: 30000,
    });
  },

  // 1. Lấy toàn bộ Phân loại (Thêm PageSize để không bị dính default 10)
  getAllCategories: async () => {
    const response = await apiClient.get('/categories/get-all', {
      params: { PageSize: 100, PageNumber: 1 }
    });
    return response.data;
  },

  // 2. Lấy toàn bộ Loại sản phẩm (Thêm PageSize=100 để lôi hết 19+ item về bao gồm Tủ Lạnh)
  getAllProductTypes: async () => {
    const response = await apiClient.get('/product-types/get-all', {
      params: { PageSize: 100, PageNumber: 1 }
    });
    return response.data;
  },

  // 3. Lấy Thương hiệu
  getAllBrands: async () => {
    const response = await apiClient.get('/brands', {
      params: { PageSize: 100, PageNumber: 1 }
    });
    return response.data;
  },

  // 4. Lấy Thuộc tính động (EAV)
  getAttributesByProductType: async (productTypeId: string) => {
    const response = await apiClient.get(`/product-types/${productTypeId}/attributes`);
    return response.data;
  },

  // 5. Lấy chi tiết thuộc tính (options) theo AttributeId
  getAttributeDetailsById: async (attributeId: string) => {
    const response = await apiClient.get(`/product-types/attributes/get-by-id/${attributeId}`);
    return response.data;
  },

  // 6. Lấy danh sách tất cả bài đăng
  getAllPosts: async (params?: any) => {
    const response = await apiClient.get('/posts/get-all', { params });
    return response.data;
  },

  // 7. Lấy chi tiết bài đăng theo ID
  getPostById: async (postId: string) => {
    const response = await apiClient.get(`/posts/get-by-id/${postId}`);
    return response.data;
  },

  // 8. Xóa bài đăng
  deletePost: async (postId: string) => {
    const response = await apiClient.delete(`/posts/delete/${postId}`);
    return response.data;
  },

  // 9. Cập nhật bài đăng Bán
  updateSellPost: async (postId: string, formData: FormData) => {
    const response = await apiClient.put(`/posts/update/sell/${postId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
    return response.data;
  },

  // 10. Cập nhật bài đăng Mua
  updateBuyPost: async (postId: string, formData: FormData) => {
    const response = await apiClient.put(`/posts/update/buy/${postId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 30000,
    });
    return response.data;
  },
};