import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { jwtDecode } from "jwt-decode"; // ĐÃ THÊM: Thư viện giải mã JWT
import React, { createContext, useContext, useEffect, useState } from "react";
import apiClient from "../services/apis/axiosClient";

interface AuthContextType {
  user: any | null;
  isLoading: boolean;
  userToken: string | null;
  login: (
    email?: string,
    password?: string,
    initialUser?: any,
    token?: string,
    refresh?: string,
  ) => Promise<void>;
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
      const role = await AsyncStorage.getItem("userRole");

      if (!token) {
        setUserToken(null);
        setUser(null);
        return;
      }
      setUserToken(token);

      if (role === "business") {
        // GIẢI MÃ TOKEN ĐỂ LẤY ID VÀ EMAIL
        try {
          const decoded: any = jwtDecode(token);

          // Claim name URL của .NET C# JWT
          const userIdClaim =
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";
          const emailClaim =
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress";

          const extractedUserId = decoded[userIdClaim] || decoded.sub;
          const extractedEmail = decoded[emailClaim] || "";

          // CẬP NHẬT USER VỚI ĐẦY ĐỦ ID
          setUser({
            id: extractedUserId,
            userId: extractedUserId,
            email: extractedEmail,
            role: "business",
            status: "active",
            username: "Tài khoản Doanh nghiệp", // Tạm để trống/mặc định
            avatarUrl: null, // Không có avatar thì trả ra null để xài avatar mặc định
          });
        } catch (decodeError) {
          console.error("Lỗi giải mã token Business:", decodeError);
          // Fallback nếu token lỗi format
          setUser({ role: "business", status: "active" });
        }
      } else {
        // Personal authentication must not depend on profile hydration.
        // Keep the token-backed session alive even when /personal-profiles/me
        // is temporarily unavailable (for example a Backend 5xx).
        let fallbackUserId = "";
        let fallbackEmail = "";

        try {
          const decoded: any = jwtDecode(token);
          const userIdClaim =
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/nameidentifier";
          const emailClaim =
            "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress";

          fallbackUserId = decoded[userIdClaim] || decoded.sub || "";
          fallbackEmail = decoded[emailClaim] || "";
        } catch (decodeError) {
          console.error("Lỗi giải mã token Personal:", decodeError);
        }

        const fallbackPersonalUser = {
          id: fallbackUserId,
          userId: fallbackUserId,
          username: fallbackEmail || "Tài khoản cá nhân",
          email: fallbackEmail,
          role: "personal",
          status: "active",
          avatarUrl: null,
          avatar: null,
        };

        setUser(fallbackPersonalUser);

        try {
          const profileResponse = await apiClient.get("/personal-profiles/me");
          const profileData =
            profileResponse.data?.data || profileResponse.data;

          setUser({
            ...fallbackPersonalUser,
            id: profileData.userId || fallbackUserId,
            userId: profileData.userId || fallbackUserId,
            username: profileData.username || fallbackPersonalUser.username,
            email: profileData.email || fallbackEmail,
            name: profileData.fullName,
            avatarUrl: profileData.avatarUrl || null,
            avatar: profileData.avatarUrl || null,
            role: profileData.role
              ? profileData.role.toLowerCase()
              : "personal",
            createdAt: profileData.createdAt,
            phone: profileData.phoneNumber,
            status: profileData.status || "active",
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
        } catch (profileError: any) {
          if (profileError.response?.status === 401) {
            throw profileError;
          }

          console.log(
            "[DEBUG] Personal profile unavailable; keeping token session:",
            profileError.response?.status,
          );
        }
      }
    } catch (error: any) {
      console.log(
        "[DEBUG] Lỗi reloadUser:",
        error.response?.status,
        error.message,
      );

      if (error.response?.status === 401) {
        await AsyncStorage.multiRemove([
          "accessToken",
          "refreshToken",
          "userRole",
        ]);
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

  // ĐÃ FIX: Cho phép truyền tay thông tin user/token trực tiếp để dùng chung cho Register Business
  const login = async (
    email?: string,
    password?: string,
    initialUser?: any,
    token?: string,
    refresh?: string,
  ) => {
    try {
      // Nhánh 1: Login trực tiếp bằng token (Dành cho sau khi Register Business)
      if (token && initialUser) {
        await AsyncStorage.setItem("accessToken", token);
        if (refresh) await AsyncStorage.setItem("refreshToken", refresh);
        await AsyncStorage.setItem(
          "userRole",
          initialUser.role?.toLowerCase() || "business",
        );

        setUserToken(token);
        await reloadUser();
        return;
      }

      // Nhánh 2: Login bằng API truyền thống
      if (!email || !password) throw new Error("Thiếu email hoặc mật khẩu");

      const loginResponse = await apiClient.post("/auth/login", {
        email,
        password,
      });
      const responseData = loginResponse.data?.data || loginResponse.data;
      const { accessToken, refreshToken, role } = responseData;

      await AsyncStorage.setItem("accessToken", accessToken);
      if (refreshToken) {
        await AsyncStorage.setItem("refreshToken", refreshToken);
      }

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
