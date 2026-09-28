import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";
import {
  FEEDBACK_ERROR_MS,
  FEEDBACK_SUCCESS_MS,
} from "../../utils/useAutoDismissFeedback";

export type ToastType = "success" | "error" | "warning";
type ToastState = { type: ToastType; text: string; version: number } | null;

// Toast dùng chung toàn app: màn hình gọi showToast(), <AppToastHost /> ở
// layout gốc hiển thị. Thành công ẩn sau ~5 giây, lỗi/cảnh báo sau ~10 giây.
let listener: ((toast: ToastState) => void) | null = null;
let version = 0;

export const showToast = (type: ToastType, text: string) => {
  if (!text) return;
  version += 1;
  listener?.({ type, text, version });
};

const ICONS: Record<ToastType, keyof typeof Ionicons.glyphMap> = {
  success: "checkmark-circle",
  error: "alert-circle",
  warning: "warning",
};

const COLORS_BY_TYPE: Record<ToastType, string> = {
  success: COLORS.success,
  error: COLORS.error,
  warning: COLORS.warning,
};

export default function AppToastHost() {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    listener = setToast;
    return () => {
      if (listener === setToast) listener = null;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const delay = toast.type === "success" ? FEEDBACK_SUCCESS_MS : FEEDBACK_ERROR_MS;
    const shown = toast.version;
    const timer = setTimeout(() => {
      setToast((current) => (current?.version === shown ? null : current));
    }, delay);
    return () => clearTimeout(timer);
  }, [toast]);

  if (!toast) return null;

  const color = COLORS_BY_TYPE[toast.type];

  return (
    <View
      pointerEvents="box-none"
      style={[styles.host, { paddingTop: Math.max(insets.top, 0) + 12 }]}
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        style={[styles.toast, { borderLeftColor: color }]}
        onPress={() => setToast(null)}
      >
        <Ionicons name={ICONS[toast.type]} size={22} color={color} />
        <Text style={styles.text}>{toast.text}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  host: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "flex-start",
    paddingHorizontal: 16,
    zIndex: 1001,
    elevation: 1001,
  },
  toast: {
    width: "100%",
    maxWidth: 480,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: "rgba(84, 123, 125, 0.28)",
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  text: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
});
