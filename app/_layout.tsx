import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import {
  AppState,
  Keyboard,
  Platform,
  StyleSheet,
  View,
} from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import AppDialogHost from "../src/components/shared/AppDialogHost";
import AppErrorBoundary from "../src/components/shared/AppErrorBoundary";
import InAppNotificationToast from "../src/components/shared/InAppNotificationToast";
import { COLORS } from "../src/constants/theme";
import { AuthProvider } from "../src/contexts/AuthContext";
import { ChatRealtimeProvider } from "../src/contexts/ChatRealtimeContext";
import { DiscoveryPreferencesProvider } from "../src/contexts/DiscoveryPreferencesContext";
import { NotificationProvider } from "../src/contexts/NotificationContext";
import {
  applyAppearancePreference,
  loadAppearancePreference,
} from "../src/utils/appearance";

function RootNavigator() {
  const insets = useSafeAreaInsets();
  const [isKeyboardVisible, setIsKeyboardVisible] =
    useState(false);

  useEffect(() => {
    // Áp dụng lựa chọn giao diện đã lưu trên thiết bị (nơi nền tảng hỗ trợ).
    let isMounted = true;
    void loadAppearancePreference().then((preference) => {
      if (isMounted) applyAppearancePreference(preference);
    });
    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (Platform.OS !== "android") {
      return;
    }

    const showSubscription = Keyboard.addListener(
      "keyboardDidShow",
      () => setIsKeyboardVisible(true),
    );
    const hideSubscription = Keyboard.addListener(
      "keyboardDidHide",
      () => setIsKeyboardVisible(false),
    );
    // Một số thiết bị (Samsung) không phát keyboardDidHide khi màn hình bị
    // unmount lúc bàn phím đang mở; đồng bộ lại theo trạng thái thật để
    // phần đệm thanh điều hướng không bị mất cho toàn bộ ứng dụng.
    const appStateSubscription = AppState.addEventListener(
      "change",
      (state) => {
        if (state === "active") setIsKeyboardVisible(Keyboard.isVisible());
      },
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
      appStateSubscription.remove();
    };
  }, []);

  const topInset =
    Platform.OS === "android" ? insets.top : 0;
  const bottomInset =
    Platform.OS === "android" && !isKeyboardVisible
      ? insets.bottom
      : 0;

  return (
    <View
      style={[
        styles.root,
        {
          paddingTop: topInset,
          paddingBottom: bottomInset,
        },
      ]}
    >
      <AuthProvider>
        <DiscoveryPreferencesProvider>
          <ChatRealtimeProvider>
            <NotificationProvider>
              <Stack
                screenOptions={{
                  headerShown: false,
                }}
                screenListeners={{
                  state: () => {
                    if (Platform.OS === "android") {
                      setIsKeyboardVisible(Keyboard.isVisible());
                    }
                  },
                }}
              >
                <Stack.Screen name="index" />
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(tabs)" />
              </Stack>
              <InAppNotificationToast />
            </NotificationProvider>
          </ChatRealtimeProvider>
        </DiscoveryPreferencesProvider>
      </AuthProvider>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <AppDialogHost>
          <RootNavigator />
        </AppDialogHost>
      </AppErrorBoundary>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
});
