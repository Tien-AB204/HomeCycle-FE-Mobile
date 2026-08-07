// src/components/shared/GoogleLoginButton.tsx
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Google from "expo-auth-session/providers/google";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";

import { COLORS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { authApi } from "../../services/apis/authApi";

WebBrowser.maybeCompleteAuthSession();

interface GoogleLoginButtonProps {
  title?: string;
  disabled?: boolean;
}

export default function GoogleLoginButton({
  title = "Google",
  disabled = false,
}: GoogleLoginButtonProps) {
  const router = useRouter();
  const { returnUrl } = useLocalSearchParams();
  const { reloadUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // 1. THÊM THUỘC TÍNH clientId DÀNH RIÊNG CHO WEB
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    clientId:
      "624459804416-g9v4cj16eb5r6r3ub3jqudr869a3eerm.apps.googleusercontent.com", // Bổ sung dòng này
    webClientId:
      "624459804416-g9v4cj16eb5r6r3ub3jqudr869a3eerm.apps.googleusercontent.com",
    androidClientId:
      "624459804416-jro5dic2ak5p4rak238lk744m4ekl92q.apps.googleusercontent.com",
    scopes: ["openid", "profile", "email"],
  });

  useEffect(() => {
    if (response?.type === "success") {
      // Dòng này để bạn soi tận mắt Google đã trả về cái gì trong Console (F12)
      console.log("DỮ LIỆU GOOGLE TRẢ VỀ:", response);

      // 2. QUÉT TÌM TOKEN Ở MỌI NGÓC NGÁCH MÀ EXPO CÓ THỂ CẤT GIẤU
      const idToken =
        response.authentication?.idToken ||
        response.params?.id_token ||
        response.params?.idToken;

      if (idToken) {
        handleGoogleBackendLogin(idToken);
      } else {
        alert(
          "Không lấy được idToken từ Google! Xem Console (F12) để biết chi tiết.",
        );
        setIsLoading(false);
      }
    } else if (response?.type === "cancel" || response?.type === "dismiss") {
      setIsLoading(false);
    }
  }, [response]);
  const handleGoogleBackendLogin = async (idToken: string) => {
    try {
      setIsLoading(true);
      const res = await authApi.googleLogin(idToken);

      // 1. Trích xuất đúng cấu trúc response của BE
      const responseMessage = res.data?.message;

      if (responseMessage?.isSuccess === false) {
        throw new Error(
          responseMessage?.error?.message ||
            "Xác thực Google thất bại từ Server!",
        );
      }

      const data = responseMessage?.data;

      // ==========================================
      // NHÁNH 1: TÀI KHOẢN MỚI - YÊU CẦU ĐĂNG KÝ
      // ==========================================
      if (data?.isNewUser === true) {
        alert(
          "Chào mừng bạn mới! Vui lòng thiết lập mật khẩu để bảo vệ tài khoản.",
        );

        router.push({
          pathname: "/(auth)/register-password", // Bắn sang trang Password
          params: {
            registrationToken: data.externalRegisterToken,
            isGoogleAuth: "true",
            email: "Tài khoản Google", // Truyền tạm chữ này để hiển thị trên UI cho đẹp vì BE không trả về email
          },
        });
        return;
      }

      // ==========================================
      // NHÁNH 2: TÀI KHOẢN CŨ - ĐĂNG NHẬP BÌNH THƯỜNG
      // ==========================================
      const accessToken = data?.accessToken;
      const refreshToken = data?.refreshToken;

      if (!accessToken) {
        throw new Error("Tài khoản hợp lệ nhưng không nhận được Access Token!");
      }

      await AsyncStorage.setItem("accessToken", accessToken);
      if (refreshToken) {
        await AsyncStorage.setItem("refreshToken", refreshToken);
      }

      // Lúc này có token thật rồi mới gọi reloadUser
      await reloadUser();

      if (returnUrl) {
        router.replace(returnUrl as any);
      } else {
        router.replace("/(tabs)");
      }
    } catch (error: any) {
      console.error("Lỗi API Google Login:", error);
      alert(error.message || "Lỗi kết nối tới Server khi đăng nhập Google!");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePress = () => {
    setIsLoading(true);
    promptAsync().catch((error) => {
      console.error("Lỗi mở Google Sign-In:", error);
      alert("Không thể mở đăng nhập Google.");
      setIsLoading(false);
    });
  };

  return (
    <TouchableOpacity
      style={[
        styles.googleButton,
        (isLoading || !request || disabled) && { opacity: 0.7 },
      ]}
      onPress={handlePress}
      disabled={isLoading || !request || disabled}
    >
      {isLoading ? (
        <ActivityIndicator color={COLORS.text} />
      ) : (
        <>
          <Image
            source={require("../../../assets/images/google-icon.png")}
            style={{ width: 22, height: 22 }}
            resizeMode="contain"
          />
          <Text style={styles.googleButtonText}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    height: 54,
    backgroundColor: COLORS.white,
    gap: 12,
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
});
