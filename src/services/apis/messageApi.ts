import apiClient from './axiosClient';

export const messageApi = {
  // Gửi tin nhắn mới (negotiationId nằm trên Query URL)
  sendMessage: async (negotiationId: string, payload: any) => {
    const response = await apiClient.post('/Messages', payload, {
      params: { negotiationId } 
    });
    return response.data;
  },

  // Lấy lịch sử tin nhắn
  getMessages: async (params?: any) => {
    const response = await apiClient.get('/Messages', { params });
    return response.data;
  },

  // Đánh dấu tin nhắn đã đọc (Trả về 204 No Content nên không return data)
  markAsRead: async (negotiationId: string) => {
    await apiClient.patch('/Messages/read', null, {
      params: { negotiationId } 
    });
    return true; // Gọi không lỗi tức là thành công
  }
};