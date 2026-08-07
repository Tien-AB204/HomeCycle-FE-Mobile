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

  // 3. Hàm đăng ký 
  registerPersonal: async (registrationToken: string, formData: FormData) => {
    return await axiosClient.post('/auth/personal/register', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
        'X-Registration-Token': registrationToken, 
      },
    });
  },

  // Đăng ký cho Doanh Nghiệp (Chỉ cần password)
  registerBusiness: async (token: string, password: string) => {
    const response = await axiosClient.post(
      "/auth/business/register",
      { password },
      {
        headers: { "X-Registration-Token": token },
      }
    );
    return response.data;
  },

  // 4. Hàm Đăng nhập bằng Google
  googleLogin: async (idToken: string) => {
    return await axiosClient.post('/auth/google-login', { idToken });
  },
};