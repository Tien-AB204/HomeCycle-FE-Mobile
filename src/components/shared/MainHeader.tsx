import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Image, Text, TouchableOpacity } from "react-native"; // BỔ SUNG TEXT ĐỂ LÀM NÚT ĐĂNG NHẬP
import { COLORS } from "../../constants/theme";
import { useAuth } from "../../contexts/AuthContext";
import Header from "./Header";

// HÀM CHỐNG CHẶN ẢNH TỪ NHÀ MẠNG
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
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
  }, [user?.avatarUrl]);

  const actualAvatar = user?.avatarUrl || user?.avatar;
  const isValidAvatar =
    actualAvatar && actualAvatar !== "string" && actualAvatar !== "null";
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.username || "U")}&background=208AEF&color=fff&size=100`;

  const avatarSource =
    isValidAvatar && !imageError
      ? { uri: getRobustUrl(actualAvatar) }
      : { uri: defaultAvatar };

  const renderRightButtons = () => {
    if (user) {
      // ĐÃ ĐĂNG NHẬP -> HIỆN 3 NÚT (CHAT, THÔNG BÁO, AVATAR)
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
          >
            <Ionicons
              name="notifications-outline"
              size={24}
              color={COLORS.text}
            />
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
                backgroundColor: "#E2E8F0",
                borderWidth: 1,
                borderColor: "#E2E8F0",
              }}
              onError={() => setImageError(true)}
            />
          </TouchableOpacity>
        </>
      );
    }

    // CHƯA ĐĂNG NHẬP -> HIỆN NÚT ĐĂNG NHẬP
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
