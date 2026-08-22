import { Stack } from "expo-router";
import { Platform, StyleSheet, View } from "react-native";
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

import AppErrorBoundary from "../src/components/shared/AppErrorBoundary";
import { COLORS } from "../src/constants/theme";
import { AuthProvider } from "../src/contexts/AuthContext";
import { ChatRealtimeProvider } from "../src/contexts/ChatRealtimeContext";

function RootNavigator() {
  const insets = useSafeAreaInsets();
  const topInset =
    Platform.OS === "android" ? insets.top : 0;
  const bottomInset =
    Platform.OS === "android" ? insets.bottom : 0;

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
        <ChatRealtimeProvider>
          <Stack
            screenOptions={{
              headerShown: false,
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
          </Stack>
        </ChatRealtimeProvider>
      </AuthProvider>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppErrorBoundary>
        <RootNavigator />
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
