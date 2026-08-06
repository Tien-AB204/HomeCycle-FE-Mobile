import axiosClient from './axiosClient';

export const authApi = {
  // 1. Hàm gửi OTP
  sendOtp: async (email: string) => {
    return await axiosClient.post('/auth/send-otp', { email });
  },

  // 2. Hàm xác thực OTP
  verifyOtp: async (email: string, otp: string) => {
    return await axiosClient.post('/auth/verify-otp', { email, otp });
  },

  // 3. Hàm đăng ký (đã tạo ở bước trước)
  registerPersonal: async (registrationToken: string, formData: FormData) => {
    return await axiosClient.post('/auth/Personal/Register', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-Registration-Token': registrationToken, 
      },
    });
  },
};