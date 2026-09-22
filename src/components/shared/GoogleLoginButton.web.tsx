import AsyncStorage from "@react-native-async-storage/async-storage";
import { makeRedirectUri } from "expo-auth-session";
import * as Google from "expo-auth-session/providers/google";
import { useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useRef, useState } from "react";
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
import { getApiErrorMessage } from "../../utils/apiFeedback";
import { devLog } from "../../utils/devLog";
import { useGuardedRouter } from "../../utils/tapGuard";

const GOOGLE_WEB_CLIENT_ID =
  "624459804416-g9v4cj16eb5r6r3ub3jqudr869a3eerm.apps.googleusercontent.com";

// The web OAuth client must return to the current localhost origin. Keeping this
// implementation in a .web file leaves the known-working Android native flow intact.
const GOOGLE_WEB_REDIRECT_URI =
  typeof window !== "undefined"
    ? window.location.origin
    : makeRedirectUri({ preferLocalhost: true }).replace(/\/$/, "");

WebBrowser.maybeCompleteAuthSession();

interface GoogleLoginButtonProps {
  title?: string;
  disabled?: boolean;
}

export default function GoogleLoginButton({
  title = "Google",
  disabled = false,
}: GoogleLoginButtonProps) {
  const router = useGuardedRouter();
  const { returnUrl } = useLocalSearchParams();
  const { reloadUser } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const loginInFlightRef = useRef(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [googleIconFailed, setGoogleIconFailed] = useState(false);

  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    redirectUri: GOOGLE_WEB_REDIRECT_URI,
    selectAccount: true,
  });

  const handleGoogleBackendLogin = async (idToken: string) => {
    const responseData = await authApi.googleLogin(idToken);
    const responseMessage = responseData.data?.message;

    if (responseMessage?.isSuccess === false) {
      throw new Error(
        responseMessage?.error?.message || "Xác thực Google thất bại.",
      );
    }

    const data = responseMessage?.data;

    if (data?.isNewUser === true) {
      router.push({
        pathname: "/(auth)/register-password",
        params: {
          registrationToken: data.externalRegisterToken,
          isGoogleAuth: "true",
          email: "Tài khoản Google",
        },
      });
      return;
    }

    const accessToken = data?.accessToken;
    const refreshToken = data?.refreshToken;

    if (!accessToken) {
      throw new Error("Không nhận được access token.");
    }

    await AsyncStorage.setItem("accessToken", accessToken);
    if (refreshToken) {
      await AsyncStorage.setItem("refreshToken", refreshToken);
    }

    await reloadUser();
    if (returnUrl) router.replace(returnUrl as any);
    else router.replace("/(tabs)");
  };

  const handlePress = async () => {
    if (loginInFlightRef.current || isLoading || disabled || !request) return;

    loginInFlightRef.current = true;
    setErrorMessage("");
    setIsLoading(true);

    try {
      const result = await promptAsync();
      if (result.type === "cancel" || result.type === "dismiss") return;

      if (result.type !== "success") {
        setErrorMessage("Google không hoàn tất đăng nhập. Vui lòng thử lại.");
        return;
      }

      const idToken = result.params.id_token;
      if (!idToken) {
        setErrorMessage(
          "Không lấy được thông tin xác thực từ Google. Vui lòng thử lại.",
        );
        return;
      }

      await handleGoogleBackendLogin(idToken);
    } catch (error: unknown) {
      devLog("Lỗi Google Sign-In trên web:", error);
      setErrorMessage(
        getApiErrorMessage(error, "Không thể đăng nhập bằng Google."),
      );
    } finally {
      loginInFlightRef.current = false;
      setIsLoading(false);
    }
  };

  const isDisabled = isLoading || disabled || !request;

  return (
    <View>
      <TouchableOpacity
        style={[styles.googleButton, isDisabled ? styles.disabledButton : undefined]}
        onPress={() => void handlePress()}
        disabled={isDisabled}
        accessibilityRole="button"
        accessibilityLabel="Đăng nhập bằng Google"
      >
        {isLoading ? (
          <ActivityIndicator color={COLORS.text} />
        ) : (
          <>
            <View style={styles.googleIconContainer}>
              {googleIconFailed ? (
                <Text style={styles.googleFallbackLetter}>G</Text>
              ) : (
                <Image
                  source={require("../../assets/images/google-icon.png")}
                  style={styles.googleIcon}
                  resizeMode="contain"
                  onError={() => setGoogleIconFailed(true)}
                />
              )}
            </View>
            <Text style={styles.googleButtonText}>{title}</Text>
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
  disabledButton: { opacity: 0.7 },
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
  googleIcon: { width: 22, height: 22 },
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
