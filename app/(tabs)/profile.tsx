import { DEFAULT_AVATAR_URI } from "../../src/utils/avatar";
import VipCrownBadge from "../../src/components/shared/VipCrownBadge";
import { useSubscription } from "../../src/contexts/SubscriptionContext";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { ModalBackdrop, ModalSurface } from "../../src/components/shared/ModalBackdrop";

import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import { useAutoDismissFeedback } from "../../src/utils/useAutoDismissFeedback";
import { useGuardedRouter } from "../../src/utils/tapGuard";

const profileApi = {
  getPostCount: (userId: string) =>
    apiClient
      .get(`/posts/get-all/by-user/${userId}`, {
        params: { PageNumber: 1, PageSize: 1 },
      })
      .then((response) => response.data),

  getBusinessOnboardingStatus: () =>
    apiClient
      .get("/business-profiles/onboarding-status")
      .then((response) => response.data),

  getMyWallet: () => apiClient.get("/wallet/me").then((response) => response.data),
};

type ProfileMenuItem = {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  subtitle?: string;
  subtitleColor?: string;
  route: any;
};

type InlineMessage = {
  type: "error" | "info";
  text: string;
} | null;

const unwrap = (value: any) => value?.data ?? value;

const getRobustUrl = (url: string) => {
  if (url?.includes("googleusercontent.com")) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
  }
  return url;
};

const formatFullDate = (dateString?: string) => {
  if (!dateString) return "Chưa có";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  return date.toLocaleDateString("vi-VN");
};

const formatCurrency = (value: unknown) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

export default function ProfileScreen() {
  const router = useGuardedRouter();
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === "web" && screenWidth > 480 ? 480 : screenWidth;
  const { user, logout, isLoading, reloadUser } = useAuth();
  const subscriptionState = useSubscription();
  const reloadUserRef = useRef(reloadUser);
  const logoutInFlightRef = useRef(false);

  reloadUserRef.current = reloadUser;

  const [imageError, setImageError] = useState(false);
  const [postCount, setPostCount] = useState(0);
  const [bizStatus, setBizStatus] = useState<string | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [message, setMessage] = useState<InlineMessage>(null);
  useAutoDismissFeedback(message, () => setMessage(null));
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const currentUserId = user?.userId || user?.id;

  useEffect(() => {
    setImageError(false);
  }, [user?.avatarUrl, user?.avatar]);

  useFocusEffect(
    useCallback(() => {
      let active = true;

      const fetchData = async () => {
        if (!currentUserId) return;

        try {
          await reloadUserRef.current();
        } catch {
          // Existing profile data remains available if an authoritative
          // refresh is temporarily unavailable.
        }

        if (!active) return;
        setMessage(null);

        const requests: Promise<any>[] = [
          profileApi.getPostCount(String(currentUserId)),
          profileApi.getMyWallet(),
        ];

        if (user?.role === "business") {
          requests.push(profileApi.getBusinessOnboardingStatus());
        }

        const results = await Promise.allSettled(requests);
        if (!active) return;

        const postResult = results[0];
        if (postResult.status === "fulfilled") {
          const postData = unwrap(postResult.value);
          setPostCount(
            Number(
              postData?.totalCount ??
                postData?.totalItems ??
                postData?.items?.length ??
                0,
            ),
          );
        } else {
          setPostCount(0);
        }

        const walletResult = results[1];
        if (walletResult.status === "fulfilled") {
          setWallet(unwrap(walletResult.value));
        } else {
          setWallet(null);
          setMessage({
            type: "info",
            text: "Chưa tải được số dư ví. Bạn vẫn có thể sử dụng các chức năng hồ sơ khác.",
          });
        }

        if (user?.role === "business") {
          const businessResult = results[2];
          if (businessResult?.status === "fulfilled") {
            const statusData = unwrap(businessResult.value);
            setBizStatus(statusData?.status ?? null);
          }
        }
      };

      void fetchData();

      return () => {
        active = false;
      };
    }, [currentUserId, user?.role]),
  );

  const handleLogout = async () => {
    if (logoutInFlightRef.current) return;
    logoutInFlightRef.current = true;

    try {
      setIsLoggingOut(true);
      setMessage(null);
      await logout();
      setShowLogoutConfirm(false);
      router.replace("/(tabs)");
    } catch {
      setShowLogoutConfirm(false);
      setMessage({ type: "error", text: "Không thể đăng xuất lúc này. Vui lòng thử lại." });
    } finally {
      logoutInFlightRef.current = false;
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.mobileWrapper, { width }]}>
          <MainHeader title="Hồ sơ" showBack={false} />
          <View style={styles.unauthContainer}>
            <Ionicons name="person-circle-outline" size={80} color={COLORS.border} />
            <Text style={styles.unauthTitle}>Bạn chưa đăng nhập</Text>
            <Text style={styles.unauthDesc}>
              Đăng nhập để cập nhật hồ sơ, theo dõi ví và sử dụng đầy đủ tiện ích của HomeCycle.
            </Text>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() =>
                router.push({
                  pathname: "/(auth)/login",
                  params: { returnUrl: "/(tabs)/profile" },
                })
              }
            >
              <Text style={styles.loginBtnText}>Đăng nhập ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const actualAvatar = user.avatarUrl || user.avatar;
  const validAvatar =
    actualAvatar && actualAvatar !== "string" && actualAvatar !== "null" && !imageError;
  const avatarUri = validAvatar
    ? getRobustUrl(actualAvatar)
    : DEFAULT_AVATAR_URI;

  const getBusinessProfileMenu = (): ProfileMenuItem => {
    switch (bizStatus) {
      case "MissingProfile":
        return {
          icon: "business-outline",
          title: "Hồ sơ Doanh nghiệp",
          subtitle: "Chưa tạo hồ sơ",
          subtitleColor: COLORS.error,
          route: "/(auth)/business-setup",
        };
      case "PendingApproval":
        return {
          icon: "business-outline",
          title: "Hồ sơ Doanh nghiệp",
          subtitle: "Đang chờ duyệt",
          subtitleColor: "#9A6418",
          route: "/profile/business-pending",
        };
      case "Rejected":
        return {
          icon: "business-outline",
          title: "Hồ sơ Doanh nghiệp",
          subtitle: "Bị từ chối (Cần sửa)",
          subtitleColor: COLORS.error,
          route: {
            pathname: "/profile/business-setup",
            params: { isRejected: "true" },
          },
        };
      case "Completed":
        return {
          icon: "business-outline",
          title: "Hồ sơ Doanh nghiệp",
          route: "/profile/business-account-info",
        };
      case "SurveyPending":
        return {
          icon: "business-outline",
          title: "Hồ sơ Doanh nghiệp",
          subtitle: "Chờ làm khảo sát",
          subtitleColor: "#9A6418",
          route: "/profile/business-survey",
        };
      default:
        return {
          icon: "business-outline",
          title: "Hồ sơ Doanh nghiệp",
          route: "/profile/business-account-info",
        };
    }
  };

  // Mục "Gói đăng ký": nhãn phụ phản ánh trạng thái có thẩm quyền từ SubscriptionContext.
  const subscriptionMenuItem: ProfileMenuItem = {
    icon: "star-outline",
    title: "Gói đăng ký VIP",
    subtitle: subscriptionState.isVip
      ? "Đang là VIP"
      : subscriptionState.isPending
        ? "Đang chờ thanh toán"
        : "Gói Miễn phí · Nâng cấp",
    subtitleColor: subscriptionState.isVip ? "#9A6418" : undefined,
    route: "/subscription",
  };

  const menuItems: ProfileMenuItem[] =
    user.role === "business"
      ? [
          getBusinessProfileMenu(),
          // Khảo sát thu mua luôn có lối vào (xem/chỉnh sửa), không chỉ khi SurveyPending.
          {
            icon: "clipboard-outline",
            title: "Khảo sát thu mua",
            subtitle: bizStatus === "SurveyPending" ? "Chưa hoàn thành" : "Xem hoặc chỉnh sửa tiêu chí",
            subtitleColor: bizStatus === "SurveyPending" ? "#9A6418" : undefined,
            route: "/profile/business-survey",
          },
          subscriptionMenuItem,
          {
            icon: "bar-chart-outline",
            title: "Thống kê & Đơn hàng",
            route: "/(tabs)/orders",
          },
          {
            icon: "receipt-outline",
            title: "Lịch sử thanh toán",
            route: "/payments/history",
          },
          {
            icon: "alert-circle-outline",
            title: "Tranh chấp của tôi",
            route: "/disputes",
          },
          {
            icon: "book-outline",
            title: "Quy định & Chính sách",
            route: "/policy",
          },
          {
            icon: "settings-outline",
            title: "Thiết lập ứng dụng",
            route: "/settings",
          },
        ]
      : [
          {
            icon: "person-outline",
            title: "Thông tin tài khoản",
            route: "/profile/account-info",
          },
          subscriptionMenuItem,
          {
            icon: "receipt-outline",
            title: "Lịch sử thanh toán",
            route: "/payments/history",
          },
          {
            icon: "alert-circle-outline",
            title: "Tranh chấp của tôi",
            route: "/disputes",
          },
          {
            icon: "book-outline",
            title: "Quy định & Chính sách",
            route: "/policy",
          },
          {
            icon: "settings-outline",
            title: "Thiết lập ứng dụng",
            route: "/settings",
          },
        ];

  const availableBalance = wallet?.availableBalance ?? wallet?.AvailableBalance ?? 0;
  const holdBalance = wallet?.holdBalance ?? wallet?.HoldBalance ?? 0;
  const profileUserId = String(user?.userId || user?.id || "").trim();
  const profileUsername = String(user?.username || "").trim();
  const profileDisplayName =
    user?.role === "business"
      ? user?.businessName || user?.name || profileUsername
      : user?.name || profileUsername;
  const displayRating = Number(user?.displayStarRating ?? 0);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mobileWrapper, { width }]}>
        <MainHeader title="Hồ sơ" showBack={false} />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.userInfoSection}>
            <View>
              <Image
                source={{ uri: avatarUri }}
                style={styles.avatar}
                onError={() => setImageError(true)}
              />
              <VipCrownBadge size="medium" withLabel style={styles.avatarCrown} />
            </View>
            <Text style={styles.userName}>{profileDisplayName}</Text>
            {profileUsername ? (
              <Text style={styles.profileUsername}>@{profileUsername}</Text>
            ) : null}
            <Text style={styles.accountTypeText}>
              {user.role === "business" ? "Tài khoản Doanh nghiệp" : "Tài khoản Cá nhân"}
            </Text>
            <Text style={styles.metaText}>Tham gia: {formatFullDate(user.createdAt)}</Text>
            {user.verificationStatus === "Verified" ? (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={15} color={COLORS.primary} />
                <Text style={styles.verifiedText}>Đã xác thực</Text>
              </View>
            ) : null}
            <View style={styles.profileStatsRow}>
              <View style={styles.profileStatCard}>
                <Text style={styles.profileStatValue}>{user.reputationScore ?? 0}</Text>
                <Text style={styles.profileStatLabel}>Điểm uy tín</Text>
              </View>
              <TouchableOpacity
                style={styles.profileStatCard}
                activeOpacity={profileUserId ? 0.75 : 1}
                disabled={!profileUserId}
                onPress={() => {
                  if (profileUserId) {
                    router.push(`/reviews/user/${profileUserId}` as any);
                  }
                }}
              >
                <Text style={styles.profileStatValue}>
                  {displayRating > 0 ? `★ ${displayRating.toFixed(1)}` : "Chưa có"}
                </Text>
                <Text style={styles.profileStatLabel}>Đánh giá</Text>
              </TouchableOpacity>
            </View>
          </View>

          {message ? (
            <View
              style={[
                styles.messageBox,
                message.type === "error" ? styles.messageError : styles.messageInfo,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.type === "error" ? styles.messageErrorText : styles.messageInfoText,
                ]}
              >
                {message.text}
              </Text>
            </View>
          ) : null}

          <View style={styles.statsGrid}>
            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.75}
              onPress={() => router.push("/wallet")}
            >
              <Ionicons name="wallet-outline" size={24} color={COLORS.primary} />
              <Text style={styles.statLabel}>Số dư ví</Text>
              <Text style={styles.statValue}>{formatCurrency(availableBalance)}</Text>
              {Number(holdBalance) > 0 ? (
                <Text style={styles.holdText}>Đang giữ: {formatCurrency(holdBalance)}</Text>
              ) : null}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.75}
              onPress={() => router.push("/(tabs)/posts")}
            >
              <Ionicons name="newspaper-outline" size={24} color={COLORS.primary} />
              <Text style={styles.statLabel}>
                {user.role === "business" ? "Tin đang thu mua" : "Tin đang đăng bán"}
              </Text>
              <Text style={styles.statValue}>{postCount} bài</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.menuContainer}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={`${item.title}-${index}`}
                style={[
                  styles.menuItem,
                  index === menuItems.length - 1 ? styles.lastMenuItem : undefined,
                ]}
                onPress={() => router.push(item.route)}
              >
                <View style={styles.menuIconBox}>
                  <Ionicons name={item.icon} size={22} color={COLORS.primary} />
                </View>
                <Text style={styles.menuText}>{item.title}</Text>
                {item.subtitle ? (
                  <Text
                    style={[
                      styles.menuSubtitle,
                      { color: item.subtitleColor || COLORS.textLight },
                    ]}
                  >
                    {item.subtitle}
                  </Text>
                ) : null}
                <Ionicons name="chevron-forward" size={20} color={COLORS.border} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={() => setShowLogoutConfirm(true)}>
            <View style={styles.logoutIconSlot}>
              <Ionicons name="log-out-outline" size={22} color="#7A1012" />
            </View>
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      <Modal
        visible={showLogoutConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => !isLoggingOut && setShowLogoutConfirm(false)}
      >
        <ModalBackdrop
          style={styles.modalOverlay}
          disabled={isLoggingOut}
          onPress={() => setShowLogoutConfirm(false)}
        >
          <ModalSurface style={styles.confirmCard}>
            <Text style={styles.confirmTitle}>Đăng xuất</Text>
            <Text style={styles.confirmText}>Bạn có chắc muốn đăng xuất khỏi tài khoản hiện tại?</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.cancelButton}
                disabled={isLoggingOut}
                onPress={() => setShowLogoutConfirm(false)}
              >
                <Text style={styles.cancelButtonText}>Ở lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmLogoutButton}
                disabled={isLoggingOut}
                onPress={() => void handleLogout()}
              >
                {isLoggingOut ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.confirmLogoutText}>Đăng xuất</Text>
                )}
              </TouchableOpacity>
            </View>
          </ModalSurface>
        </ModalBackdrop>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  mobileWrapper: {
    flex: 1,
    alignSelf: "center",
    backgroundColor: "#F8F9FA",
    maxWidth: 480,
  },
  loadingScreen: { flex: 1, alignItems: "center", justifyContent: "center" },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 110 },
  unauthContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
  },
  unauthTitle: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 10 },
  unauthDesc: {
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 21,
    marginTop: 8,
  },
  loginBtn: {
    minHeight: 50,
    marginTop: 20,
    paddingHorizontal: 24,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  loginBtnText: { color: COLORS.white, fontWeight: "900" },
  userInfoSection: { alignItems: "center", paddingTop: 20, paddingBottom: 18 },
  avatar: { width: 100, height: 100, borderRadius: 50 },
  avatarCrown: { position: "absolute", bottom: -4, alignSelf: "center" },
  userName: { color: COLORS.text, fontSize: 20, fontWeight: "900", marginTop: 12 },
  profileUsername: { color: COLORS.textLight, fontSize: 14, marginTop: 4 },
  accountTypeText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "800",
    marginTop: 4,
  },
  verifiedBadge: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  verifiedText: { color: COLORS.primary, fontSize: 12, fontWeight: "800" },
  profileStatsRow: {
    width: "100%",
    flexDirection: "row",
    gap: 12,
    marginTop: 16,
  },
  profileStatCard: {
    flex: 1,
    minHeight: 92,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    paddingVertical: 12,
  },
  profileStatValue: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },
  profileStatLabel: {
    color: COLORS.textLight,
    fontSize: 12,
    marginTop: 6,
    textAlign: "center",
  },
  metaText: { color: COLORS.textLight, fontSize: 13, marginTop: 10 },
  messageBox: { borderWidth: 1, borderRadius: 10, padding: 10, marginBottom: 12 },
  messageText: { fontSize: 12, lineHeight: 17 },
  messageError: { backgroundColor: "rgba(122, 16, 18, 0.08)", borderColor: "rgba(122, 16, 18, 0.22)" },
  messageErrorText: { color: "#7A1012" },
  messageInfo: { backgroundColor: "rgba(84, 123, 125, 0.10)", borderColor: "rgba(84, 123, 125, 0.24)" },
  messageInfoText: { color: "#2B5659" },
  statsGrid: { flexDirection: "row", gap: 14 },
  statCard: {
    flex: 1,
    minHeight: 132,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    padding: 16,
  },
  statLabel: { color: COLORS.textLight, fontSize: 12, marginTop: 14 },
  statValue: { color: COLORS.text, fontSize: 17, fontWeight: "900", marginTop: 6 },
  holdText: { color: "#9A6418", fontSize: 10, marginTop: 4 },
  menuContainer: {
    marginTop: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    paddingHorizontal: 18,
  },
  menuItem: {
    minHeight: 82,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#BAC2C1",
  },
  lastMenuItem: { borderBottomWidth: 0 },
  menuIconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
    marginRight: 12,
  },
  menuText: { flex: 1, color: COLORS.text, fontSize: 15, fontWeight: "700" },
  menuSubtitle: { fontSize: 11, fontWeight: "700", marginRight: 8 },
  logoutButton: {
    minHeight: 62,
    marginTop: 20,
    borderWidth: 1,
    borderColor: "rgba(122, 16, 18, 0.22)",
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    backgroundColor: COLORS.white,
  },
  logoutIconSlot: {
    width: 42,
    height: 42,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  logoutText: { color: "#7A1012", fontWeight: "900", fontSize: 15 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(23, 40, 48, 0.45)",
    justifyContent: "center",
    padding: 22,
  },
  confirmCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20 },
  confirmTitle: { color: COLORS.text, fontSize: 19, fontWeight: "900" },
  confirmText: { color: COLORS.textLight, lineHeight: 20, marginTop: 8, marginBottom: 18 },
  confirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  cancelButton: {
    minHeight: 44,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: { color: COLORS.primary, fontWeight: "800" },
  confirmLogoutButton: {
    minWidth: 105,
    minHeight: 44,
    paddingHorizontal: 16,
    backgroundColor: "#7A1012",
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  confirmLogoutText: { color: COLORS.white, fontWeight: "900" },
});
