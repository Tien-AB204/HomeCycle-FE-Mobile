import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import React, { createContext, useContext, useEffect, useState } from "react";
import apiClient from "../services/apis/axiosClient";

interface AuthContextType {
  user: any | null;
  isLoading: boolean;
  userToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [userToken, setUserToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  const reloadUser = async () => {
    try {
      const token = await AsyncStorage.getItem("accessToken");
      const role = await AsyncStorage.getItem("userRole"); // Lấy role từ Storage

      if (!token) {
        setUserToken(null);
        setUser(null);
        return;
      }
      setUserToken(token);

      if (role === "business") {
        // NGĂN CHẶN GOI API PERSONAL CHO BUSINESS
        // Tạm thời set user ảo để duy trì phiên đăng nhập cho doanh nghiệp
        setUser({
          id: "business-account",
          role: "business",
          status: "active"
        });
        // Tương lai nếu BE có API: apiClient.get("/business-profiles/me") thì gọi ở đây
      } else {
        // Luồng Personal như cũ
        const profileResponse = await apiClient.get("/personal-profiles/me");
        const profileData = profileResponse.data?.data || profileResponse.data;

        setUser({
          id: profileData.userId,
          username: profileData.username,
          email: profileData.email,
          name: profileData.fullName,
          avatar: profileData.avatarUrl,
          role: profileData.role ? profileData.role.toLowerCase() : "personal",
          createdAt: profileData.createdAt,
          phone: profileData.phoneNumber,
          status: profileData.status,
          verificationStatus: profileData.verificationStatus,
          reputationScore: profileData.reputationScore,
          isEmailVerified: profileData.isEmailVerified,
          address: profileData.address || "",
          representativeCode: profileData.representativeCode,
          representativeName: profileData.representativeName,
          representativeDob: profileData.representativeDob,
          representativeAddress: profileData.representativeAddress,
          frontIDCardImage: profileData.frontIDCardImage,
          backIDCardImage: profileData.backIDCardImage,
          bankAccount: profileData.bankAccount || null,
        });
      }
    } catch (error: any) {
      console.log("[DEBUG] Lỗi reloadUser:", error.response?.status, error.message);
      
      // FIX CỰC MẠNH: CHỈ XÓA TOKEN NẾU TRẢ VỀ 401 (Hết hạn / Sai token)
      // Không xóa nếu bị 404 hoặc mạng chập chờn
      if (error.response?.status === 401) {
        await AsyncStorage.multiRemove(["accessToken", "refreshToken", "userRole"]);
        setUserToken(null);
        setUser(null);
      }
    }
  };

  useEffect(() => {
    const checkLoginStatus = async () => {
      setIsLoading(true);
      await reloadUser();
      setIsLoading(false);
    };
    checkLoginStatus();
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const loginResponse = await apiClient.post("/auth/login", {
        email,
        password,
      });
      
      const responseData = loginResponse.data?.data || loginResponse.data;
      const { accessToken, refreshToken, role } = responseData;
      
      // Lưu Token
      await AsyncStorage.setItem("accessToken", accessToken);
      if (refreshToken) {
        await AsyncStorage.setItem("refreshToken", refreshToken);
      }

      // Lưu Role để rẽ nhánh lúc reload (Mặc định personal nếu rỗng)
      const currentRole = role ? role.toLowerCase() : "personal";
      await AsyncStorage.setItem("userRole", currentRole);

      setUserToken(accessToken);
      await reloadUser();
      router.replace("/(tabs)");
    } catch (error: any) {
      console.error("Login Error:", error);
      throw new Error(
        error.response?.data?.message ||
          "Đăng nhập thất bại. Vui lòng thử lại!",
      );
    }
  };

  const logout = async () => {
    // Xóa triệt để các key khi logout
    await AsyncStorage.multiRemove(["accessToken", "refreshToken", "userRole"]);
    setUserToken(null);
    setUser(null);
    router.replace("/(auth)/login");
  };

  return (
    <AuthContext.Provider
      value={{ user, isLoading, userToken, login, logout, reloadUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};