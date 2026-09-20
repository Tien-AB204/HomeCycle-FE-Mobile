import axiosClient from "./axiosClient";
import { getSafeErrorMessage } from "../../utils/errorMessage";

export const authApi = {
  // 1. Hàm gửi OTP
  sendOtp: async (email: string) => {
    return await axiosClient.post("/auth/send-otp", { email });
  },

  // 2. Hàm xác thực OTP
  verifyOtp: async (email: string, otp: string) => {
    return await axiosClient.post("/auth/verify-otp", { email, otp });
  },

  // 3. Hàm đăng ký
  registerPersonal: async (registrationToken: string, formData: FormData) => {
    return await axiosClient.post("/auth/personal/register", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        "X-Registration-Token": registrationToken,
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
      },
    );
    return response.data;
  },

  // 4. Hàm Đăng nhập bằng Google
  googleLogin: async (idToken: string) => {
    return await axiosClient.post("/auth/google-login", { idToken });
  },

  // 5. Quên mật khẩu: gửi OTP đặt lại (công khai; KHÔNG dùng send-otp của đăng ký)
  forgotPassword: async (email: string) => {
    return await axiosClient.post("/auth/forgot-password", { email });
  },

  // 6. Đặt lại mật khẩu bằng OTP (6 chữ số, hiệu lực 5 phút, dùng một lần)
  resetPassword: async (payload: {
    email: string;
    otp: string;
    newPassword: string;
    confirmPassword: string;
  }) => {
    return await axiosClient.post("/auth/reset-password", payload);
  },
};

// Thông điệp tiếng Việt cho các mã lỗi đặt lại mật khẩu; mã khác dùng bộ lọc chung.
const PASSWORD_RESET_ERROR_MESSAGES: Record<string, string> = {
  AUTH_PASSWORD_RESET_EMAIL_NOT_FOUND: "Email này chưa được đăng ký trong hệ thống.",
  AUTH_PASSWORD_RESET_UNAVAILABLE:
    "Tài khoản này hiện không thể đặt lại mật khẩu. Vui lòng liên hệ hỗ trợ.",
  AUTH_PASSWORD_RESET_OTP_INVALID: "Mã OTP không đúng, đã hết hạn hoặc đã được sử dụng.",
  AUTH_PASSWORD_RESET_OTP_LOCKED:
    "Bạn đã nhập sai mã OTP quá nhiều lần. Vui lòng thử lại sau 15 phút.",
  AUTH_OTP_RATE_LIMITED: "Bạn vừa yêu cầu mã OTP. Vui lòng chờ một lúc rồi thử lại.",
  AUTH_OTP_SEND_FAILED: "Không gửi được mã OTP lúc này. Vui lòng thử lại sau.",
  AUTH_PASSWORD_RESET_VALIDATION: "Thông tin đặt lại mật khẩu chưa hợp lệ. Vui lòng kiểm tra lại.",
};

export const getPasswordResetErrorMessage = (error: unknown, fallback: string): string => {
  const data = (error as any)?.response?.data;
  const code = String(data?.code ?? data?.error?.code ?? "").trim().toUpperCase();
  if (code && PASSWORD_RESET_ERROR_MESSAGES[code]) return PASSWORD_RESET_ERROR_MESSAGES[code];
  return getSafeErrorMessage(error, fallback);
};
