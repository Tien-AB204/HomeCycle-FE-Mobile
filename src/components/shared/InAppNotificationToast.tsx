import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";
import { useNotifications } from "../../contexts/NotificationContext";
import { localizeSystemText } from "../../utils/localizeSystemText";

const AUTO_DISMISS_MS = 5_000;

export default function InAppNotificationToast() {
  const insets = useSafeAreaInsets();
  const { inAppNotification } = useNotifications();
  const [visibleVersion, setVisibleVersion] = useState<number | null>(null);

  useEffect(() => {
    if (!inAppNotification) return;

    setVisibleVersion(inAppNotification.version);
    const timeoutId = setTimeout(() => {
      setVisibleVersion((current) =>
        current === inAppNotification.version ? null : current,
      );
    }, AUTO_DISMISS_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [inAppNotification]);

  if (!inAppNotification || visibleVersion !== inAppNotification.version) {
    return null;
  }

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.host,
        {
          paddingTop:
            Math.max(insets.top, 0) + 12,
        },
      ]}
    >
      <Pressable style={styles.toast} onPress={() => setVisibleVersion(null)}>
        <Ionicons name="notifications-outline" size={22} color={COLORS.primary} />
        <View style={styles.content}>
          <Text numberOfLines={1} style={styles.title}>
            {localizeSystemText(inAppNotification.title, "Thông báo mới")}
          </Text>
          {inAppNotification.message ? (
            <Text numberOfLines={2} style={styles.message}>
              {localizeSystemText(
                inAppNotification.message,
                "Bạn có cập nhật mới từ hệ thống.",
              )}
            </Text>
          ) : null}
        </View>
        <TouchableOpacity
          accessibilityLabel="Đóng thông báo"
          hitSlop={8}
          onPress={() => setVisibleVersion(null)}
          style={styles.dismissButton}
        >
          <Ionicons name="close" size={18} color={COLORS.textLight} />
        </TouchableOpacity>
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
    zIndex: 1000,
    elevation: 1000,
  },
  toast: {
    width: "100%",
    maxWidth: 480,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(84, 123, 125, 0.28)",
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.16,
    shadowRadius: 10,
  },
  content: {
    flex: 1,
  },
  title: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  message: {
    marginTop: 3,
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 18,
  },
  dismissButton: {
    paddingTop: 1,
  },
});
