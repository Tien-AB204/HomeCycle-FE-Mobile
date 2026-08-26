import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { authApi } from "../../services/apis/authApi";
import {
  getApiErrorMessage,
  NETWORK_ERROR_MESSAGE,
} from "../../utils/apiFeedback";

const GOOGLE_WEB_CLIENT_ID =
  "624459804416-g9v4cj16eb5r6r3ub3jqudr869a3eerm.apps.googleusercontent.com";

GoogleSignin.configure({
  webClientId: GOOGLE_WEB_CLIENT_ID,
  offlineAccess: false,
});

interface GoogleLoginButtonProps {
  title?: string;
  disabled?: boolean;
}

const getGoogleSignInErrorMessage = (
  error: unknown,
): string => {
  if (!isErrorWithCode(error)) {
    return NETWORK_ERROR_MESSAGE;
  }

  switch (error.code) {
    case statusCodes.IN_PROGRESS:
      return "Đăng nhập Google đang được xử lý. Vui lòng chờ trong giây lát.";

    case statusCodes.PLAY_SERVICES_NOT_AVAILABLE:
      return "Google Play Services chưa sẵn sàng. Vui lòng cập nhật Google Play Services và thử lại.";

    default:
      return NETWORK_ERROR_MESSAGE;
  }
};

export default function GoogleLoginButton({
  title = "Google",
  disabled = false,
}: GoogleLoginButtonProps) {
  const router = useRouter();
  const { returnUrl } = useLocalSearchParams();
  const { reloadUser } = useAuth();

  const [isLoading, setIsLoading] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const [googleIconFailed, setGoogleIconFailed] =
    useState(false);

  const handleGoogleBackendLogin = async (
    idToken: string,
  ) => {
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
      router.replace(
        returnUrl as any,
      );
    } else {
      router.replace("/(tabs)");
    }
  };

  const handlePress = async () => {
    if (isLoading || disabled) {
      return;
    }

    setErrorMessage("");
    setIsLoading(true);

    try {
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true,
      });

      const signInResponse =
        await GoogleSignin.signIn();

      if (
        !isSuccessResponse(
          signInResponse,
        )
      ) {
        // Người dùng chủ động đóng/hủy Google Sign-In.
        return;
      }

      let idToken =
        signInResponse.data?.idToken;

      if (!idToken) {
        const tokens =
          await GoogleSignin.getTokens();

        idToken = tokens.idToken;
      }

      if (!idToken) {
        setErrorMessage(
          "Không lấy được thông tin xác thực từ Google. Vui lòng thử lại.",
        );

        return;
      }

      await handleGoogleBackendLogin(
        idToken,
      );
    } catch (error: unknown) {
      console.error(
        "Lỗi Google Sign-In:",
        error,
      );

      if (isErrorWithCode(error)) {
        setErrorMessage(
          getGoogleSignInErrorMessage(
            error,
          ),
        );

        return;
      }

      setErrorMessage(
        getApiErrorMessage(
          error,
          "Không thể đăng nhập bằng Google.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const isDisabled =
    isLoading || disabled;

  return (
    <View>
      <TouchableOpacity
        style={[
          styles.googleButton,
          isDisabled
            ? styles.disabledButton
            : undefined,
        ]}
        onPress={() =>
          void handlePress()
        }
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel="Đăng nhập bằng Google"
      >
        {isLoading ? (
          <ActivityIndicator
            color={COLORS.text}
          />
        ) : (
          <>
            <View
              style={
                styles.googleIconContainer
              }
            >
              {googleIconFailed ? (
                <Text
                  style={
                    styles.googleFallbackLetter
                  }
                >
                  G
                </Text>
              ) : (
                <Image
                  source={require("../../assets/images/google-icon.png")}
                  style={
                    styles.googleIcon
                  }
                  resizeMode="contain"
                  onError={() =>
                    setGoogleIconFailed(
                      true,
                    )
                  }
                />
              )}
            </View>

            <Text
              style={
                styles.googleButtonText
              }
            >
              {title}
            </Text>
          </>
        )}
      </TouchableOpacity>

      {errorMessage ? (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.errorText}
        >
          {errorMessage}
        </Text>
      ) : null}
    </View>
  );
}

const styles =
  StyleSheet.create({
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

    googleIconContainer: {
      width: 22,
      height: 22,
      alignItems: "center",
      justifyContent: "center",
    },

    googleFallbackLetter: {
      color: "#4285F4",
      fontSize: 18,
      lineHeight: 22,
      fontWeight: "800",
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

    errorText: {
      marginTop: 7,
      color: COLORS.error,
      fontSize: 12,
      lineHeight: 17,
      textAlign: "center",
    },
  });
