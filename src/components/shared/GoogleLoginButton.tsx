import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Google from "expo-auth-session/providers/google";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useState } from "react";
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
import { getApiErrorMessage } from "../../utils/apiFeedback";
import { notifyUser } from "./ActionFeedback";

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
  const { returnUrl } =
    useLocalSearchParams();
  const { reloadUser } = useAuth();

  const [isLoading, setIsLoading] =
    useState(false);

  const [request, response, promptAsync] =
    Google.useIdTokenAuthRequest({
      clientId:
        "624459804416-g9v4cj16eb5r6r3ub3jqudr869a3eerm.apps.googleusercontent.com",
      webClientId:
        "624459804416-g9v4cj16eb5r6r3ub3jqudr869a3eerm.apps.googleusercontent.com",
      androidClientId:
        "624459804416-jro5dic2ak5p4rak238lk744m4ekl92q.apps.googleusercontent.com",
      scopes: [
        "openid",
        "profile",
        "email",
      ],
    });

  useEffect(() => {
    if (response?.type === "success") {
      const idToken =
        response.authentication?.idToken ||
        response.params?.id_token ||
        response.params?.idToken;

      if (idToken) {
        void handleGoogleBackendLogin(
          idToken,
        );
      } else {
        notifyUser(
          "Không lấy được thông tin xác thực từ Google.",
          "error",
        );
        setIsLoading(false);
      }

      return;
    }

    if (
      response?.type === "cancel" ||
      response?.type === "dismiss"
    ) {
      setIsLoading(false);
    }
  }, [response]);

  const handleGoogleBackendLogin = async (
    idToken: string,
  ) => {
    try {
      setIsLoading(true);

      const responseData =
        await authApi.googleLogin(idToken);

      const responseMessage =
        responseData.data?.message;

      if (
        responseMessage?.isSuccess === false
      ) {
        throw new Error(
          responseMessage?.error?.message ||
            "Xác thực Google thất bại.",
        );
      }

      const data = responseMessage?.data;

      if (data?.isNewUser === true) {
        notifyUser(
          "Chào mừng bạn! Vui lòng thiết lập mật khẩu để bảo vệ tài khoản.",
          "info",
        );

        router.push({
          pathname:
            "/(auth)/register-password",
          params: {
            registrationToken:
              data.externalRegisterToken,
            isGoogleAuth: "true",
            email: "Tài khoản Google",
          },
        });

        return;
      }

      const accessToken =
        data?.accessToken;
      const refreshToken =
        data?.refreshToken;

      if (!accessToken) {
        throw new Error(
          "Không nhận được access token.",
        );
      }

      await AsyncStorage.setItem(
        "accessToken",
        accessToken,
      );

      if (refreshToken) {
        await AsyncStorage.setItem(
          "refreshToken",
          refreshToken,
        );
      }

      await reloadUser();

      if (returnUrl) {
        router.replace(returnUrl as any);
      } else {
        router.replace("/(tabs)");
      }
    } catch (error: unknown) {
      console.error(
        "Lỗi API Google Login:",
        error,
      );

      notifyUser(
        getApiErrorMessage(
          error,
          "Không thể đăng nhập bằng Google.",
        ),
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePress = () => {
    setIsLoading(true);

    promptAsync().catch((error) => {
      console.error(
        "Lỗi mở Google Sign-In:",
        error,
      );

      notifyUser(
        "Không thể mở đăng nhập Google.",
        "error",
      );

      setIsLoading(false);
    });
  };

  const isDisabled =
    isLoading || !request || disabled;

  return (
    <TouchableOpacity
      style={[
        styles.googleButton,
        isDisabled
          ? styles.disabledButton
          : undefined,
      ]}
      onPress={handlePress}
      disabled={isDisabled}
    >
      {isLoading ? (
        <ActivityIndicator
          color={COLORS.text}
        />
      ) : (
        <>
          <Image
            source={require("../../assets/images/google-icon.png")}
            style={styles.googleIcon}
            resizeMode="contain"
          />

          <Text
            style={styles.googleButtonText}
          >
            {title}
          </Text>
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

  disabledButton: {
    opacity: 0.7,
  },

  googleIcon: {
    width: 22,
    height: 22,
  },

  googleButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
  },
});