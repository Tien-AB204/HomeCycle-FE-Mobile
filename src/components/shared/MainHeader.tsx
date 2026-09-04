import { DEFAULT_AVATAR_URI } from "../../utils/avatar";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import { useNotifications } from "../../contexts/NotificationContext";
import Header from "./Header";

const getRobustUrl = (url: string) => {
  if (url?.includes("googleusercontent.com")) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
  }
  return url;
};

export default function MainHeader({
  title,
  showBack,
  centerContent,
}: {
  title?: string;
  showBack?: boolean;
  centerContent?: React.ReactNode;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const { unreadCount } = useNotifications();
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [user?.avatarUrl]);

  const actualAvatar = user?.avatarUrl || user?.avatar;
  const isValidAvatar =
    actualAvatar && actualAvatar !== "string" && actualAvatar !== "null";
  const defaultAvatar = DEFAULT_AVATAR_URI;

  const avatarSource =
    isValidAvatar && !imageError
      ? { uri: getRobustUrl(actualAvatar) }
      : { uri: defaultAvatar };

  const renderRightButtons = () => {
    if (user) {
      return (
        <>
          <TouchableOpacity onPress={() => router.push("/chat" as any)}>
            <Ionicons
              name="chatbubbles-outline"
              size={24}
              color={COLORS.text}
            />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/notifications" as any)}
            style={{
              position: "relative",
              alignItems: "center",
              justifyContent: "center",
              padding: 2,
            }}
            accessibilityLabel={
              unreadCount > 0
                ? `Thông báo, ${unreadCount} chưa đọc`
                : "Thông báo"
            }
          >
            <Ionicons
              name="notifications-outline"
              size={24}
              color={COLORS.text}
            />

            {unreadCount > 0 ? (
              <View
                pointerEvents="none"
                style={{
                  position: "absolute",
                  top: -7,
                  right: -9,
                  minWidth: 18,
                  height: 18,
                  paddingHorizontal: 4,
                  borderRadius: 9,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: COLORS.error,
                  borderWidth: 1.5,
                  borderColor: COLORS.white,
                }}
              >
                <Text
                  style={{
                    color: COLORS.white,
                    fontSize: 9,
                    lineHeight: 12,
                    fontWeight: "800",
                  }}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            ) : null}
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => router.push("/(tabs)/profile")}
            style={{ justifyContent: "center", alignItems: "center" }}
          >
            <Image
              source={avatarSource}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                backgroundColor: "#F8F9FA",
                borderWidth: 1,
                borderColor: "#BAC2C1",
              }}
              onError={() => setImageError(true)}
            />
          </TouchableOpacity>
        </>
      );
    }

    return (
      <TouchableOpacity
        onPress={() => router.push("/(auth)/login" as any)}
        style={{
          backgroundColor: COLORS.primary,
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 8,
        }}
      >
        <Text style={{ color: "#FFF", fontSize: 14, fontWeight: "bold" }}>
          Đăng nhập
        </Text>
      </TouchableOpacity>
    );
  };

  const isHome = title === "HomeCycle";

  const renderLeft = isHome ? (
    <Image
      source={require("../../assets/images/logo-dark-transparent.png")}
      style={{ width: 140, height: 32, marginLeft: 4 }}
      resizeMode="contain"
    />
  ) : null;

  return (
    <Header
      title={isHome ? undefined : title}
      showBack={showBack}
      centerContent={centerContent}
      leftContent={renderLeft}
      rightContent={renderRightButtons()}
    />
  );
}
