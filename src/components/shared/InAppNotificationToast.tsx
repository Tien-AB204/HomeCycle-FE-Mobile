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
        <View style={styles.iconCircle}>
          <Ionicons name="notifications" size={18} color={COLORS.primary} />
        </View>
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
          <Ionicons name="close" size={18} color="rgba(255, 255, 255, 0.85)" />
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
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    // Nền xanh đậm để toast tách hẳn khỏi nền trắng của các màn, nhìn là biết có thông báo.
    backgroundColor: COLORS.primary,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 14,
    elevation: 12,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  content: {
    flex: 1,
  },
  title: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },
  message: {
    marginTop: 3,
    color: "rgba(255, 255, 255, 0.88)",
    fontSize: 13,
    lineHeight: 18,
  },
  dismissButton: {
    alignSelf: "flex-start",
    paddingTop: 1,
  },
});
