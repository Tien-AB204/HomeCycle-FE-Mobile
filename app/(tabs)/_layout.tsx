import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { COLORS } from "../../src/constants/theme";

export default function TabsLayout() {
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
          height: Platform.OS === "ios" ? 85 : 65,
          paddingBottom: Platform.OS === "ios" ? 25 : 10,
          paddingTop: 10,
          ...(Platform.OS === "web"
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
          marginTop: 4,
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
              size={24}
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
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* 3. Tin đăng (Gộp Bán & Mua) */}
      <Tabs.Screen
        name="posts"
        options={{
          title: "Tin đăng",
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? "newspaper" : "newspaper-outline"}
              size={24}
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
              size={24}
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
              size={24}
              color={color}
            />
          ),
        }}
      />

      {/* ==========================================================
          CÁC MÀN HÌNH ẨN DƯỚI TAB BAR (Vẫn giữ được Nav Bar ở đáy) 
          ========================================================== */}

      {/* 6. Profile */}
      <Tabs.Screen
        name="profile"
        options={{
          href: null,
        }}
      />

      {/* 7. Chat */}
      <Tabs.Screen
        name="chat"
        options={{
          href: null,
        }}
      />

      {/* 8. Notifications */}
      <Tabs.Screen
        name="notifications"
        options={{
          href: null,
        }}
      />
    </Tabs>
  );
}
