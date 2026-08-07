import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { COLORS } from "../../src/constants/theme";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === "web";

  // Tính toán khoảng đệm an toàn tránh dính phím điều hướng Android
  const bottomInset = isWeb ? 0 : Math.max(insets.bottom, 12);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textLight,
        tabBarStyle: {
          backgroundColor: COLORS.white,
          borderTopWidth: 1,
          borderTopColor: COLORS.border,
          // Chiều cao tự động dãn cách dựa vào nền tảng
          height: isWeb ? 66 : 64 + bottomInset,
          paddingTop: 6,
          paddingBottom: isWeb ? 6 : bottomInset,
          ...(isWeb
            ? {
                maxWidth: 480,
                alignSelf: "center",
                width: "100%",
              }
            : {}),
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginBottom: 2,
        },
      }}
    >
      {/* 1. Trang chủ */}
      <Tabs.Screen
        name="index"
        options={{
          title: "Trang chủ",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "home" : "home-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 2. Lịch hẹn */}
      <Tabs.Screen
        name="appointments"
        options={{
          title: "Lịch hẹn",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "calendar" : "calendar-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 3. Tin đăng */}
      <Tabs.Screen
        name="posts"
        options={{
          title: "Tin đăng",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "newspaper" : "newspaper-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 4. Đơn hàng */}
      <Tabs.Screen
        name="orders"
        options={{
          title: "Đơn hàng",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "document-text" : "document-text-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* 5. Giỏ hàng */}
      <Tabs.Screen
        name="cart"
        options={{
          title: "Giỏ hàng",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "cart" : "cart-outline"}
              size={22}
              color={color}
            />
          ),
        }}
      />

      {/* Các màn hình ẩn */}
      <Tabs.Screen name="profile" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
    </Tabs>
  );
}