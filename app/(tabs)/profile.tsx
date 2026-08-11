import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
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
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";

// HÀM CHỐNG CHẶN ẢNH TỪ NHÀ MẠNG
const getRobustUrl = (url: string) => {
  if (url?.includes("googleusercontent.com")) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
  }
  return url;
};

// HÀM FORMAT NGÀY THÁNG NĂM (DD/MM/YYYY)
const formatFullDate = (dateString: string) => {
  if (!dateString) return "N/A";
  const d = new Date(dateString);
  const day = `0${d.getDate()}`.slice(-2);
  const month = `0${d.getMonth() + 1}`.slice(-2);
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

export default function ProfileScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === "web" && screenWidth > 480 ? 480 : screenWidth;

  const { user, logout, isLoading } = useAuth();
  const [imageError, setImageError] = useState(false);
  const [postCount, setPostCount] = useState(0);

  // STATE MỞ MODAL LỰA CHỌN UI
  const [showActionModal, setShowActionModal] = useState(false);

  const currentUserId = user?.userId || user?.id;

  useEffect(() => {
    setImageError(false);
  }, [user?.avatarUrl]);

  // GỌI API LẤY SỐ LƯỢNG BÀI ĐĂNG CỦA USER KHI VÀO TAB NÀY
  useFocusEffect(
    useCallback(() => {
      const fetchPostCount = async () => {
        if (!currentUserId) return;
        try {
          const response = await apiClient.get(
            `/posts/get-all/by-user/${currentUserId}?PageNumber=1&PageSize=1`,
          );
          const resData = response.data?.data || response.data;

          const total =
            resData?.totalCount ??
            resData?.totalItems ??
            resData?.items?.length ??
            resData?.length ??
            0;
          setPostCount(total);
        } catch (error) {
          console.log("[Profile] Lỗi lấy số lượng bài đăng:", error);
        }
      };
      fetchPostCount();
    }, [currentUserId]),
  );

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: "#F8F9FA" }} />;
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.mobileWrapper, { width }]}>
          <MainHeader title="Hồ sơ" showBack={false} />
          <View style={styles.unauthContainer}>
            <Ionicons
              name="person-circle-outline"
              size={80}
              color="#CBD5E1"
              style={{ marginBottom: 16 }}
            />
            <Text style={styles.unauthTitle}>Bạn chưa đăng nhập</Text>
            <Text style={styles.unauthDesc}>
              Đăng nhập để cập nhật hồ sơ, theo dõi ví tiền và tận hưởng đầy đủ
              tiện ích của HomeCycle!
            </Text>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() =>
                router.push("/(auth)/login?returnUrl=/(tabs)/profile")
              }
            >
              <Text style={styles.loginBtnText}>Đăng nhập ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const joinDateStr = formatFullDate(user.createdAt);
  const actualAvatar = user.avatarUrl || user.avatar;
  const isValidAvatar =
    actualAvatar && actualAvatar !== "string" && actualAvatar !== "null";
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || "U")}&background=208AEF&color=fff&size=200`;

  const avatarSource =
    isValidAvatar && !imageError
      ? { uri: getRobustUrl(actualAvatar) }
      : { uri: defaultAvatar };

  const menuItems =
    user.role === "business"
      ? [
          {
            icon: "business-outline",
            title: "Hồ sơ Doanh nghiệp",
            route: "/profile/business-account-info",
          },
          {
            icon: "bar-chart-outline",
            title: "Thống kê & Đơn hàng",
            route: "ACTION_BUSINESS_ORDERS",
          },
          {
            icon: "book-outline",
            title: "Quy định & Chính sách",
            route: "/business-rules",
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
          {
            icon: "time-outline",
            title: "Lịch sử giao dịch",
            route: "ACTION_DEV",
          },
          {
            icon: "book-outline",
            title: "Quy định & Chính sách",
            route: "/business-rules",
          },
          {
            icon: "settings-outline",
            title: "Thiết lập ứng dụng",
            route: "/settings",
          },
        ];

  const handleMenuPress = (route: string) => {
    if (route === "ACTION_DEV") {
      const msg = "Tính năng đang được phát triển.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Thông báo", msg);
    } else if (route === "ACTION_BUSINESS_ORDERS") {
      // HIỂN THỊ UI MODAL CỰC XỊN THAY VÌ ALERT
      setShowActionModal(true);
    } else {
      router.push(route as any);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mobileWrapper, { width }]}>
        <MainHeader title="Hồ sơ" showBack={false} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          style={styles.container}
        >
          <View style={styles.userInfoSection}>
            <Image
              source={avatarSource}
              style={styles.avatar}
              onError={() => setImageError(true)}
            />
            <Text style={styles.userName}>{user.username}</Text>

            {user.verificationStatus === "Verified" && (
              <View style={styles.verifiedBadge}>
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={COLORS.primary}
                />
                <Text style={styles.verifiedText}>Đã xác thực</Text>
              </View>
            )}

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Tham gia: {joinDateStr}</Text>
            </View>

            <View style={styles.statsBadge}>
              <Text style={styles.statsTextRating}>
                Điểm uy tín: {user.reputationScore ?? 0}
              </Text>
              <Text style={styles.statsDivider}>|</Text>
              <Text style={styles.statsText}>
                0 {user.role === "business" ? "Giao dịch hoàn tất" : "Đơn hàng"}
              </Text>
            </View>
          </View>

          {user.role === "personal" && (
            <View style={styles.upgradeBanner}>
              <View style={styles.upgradeTextContainer}>
                <Text style={styles.upgradeTitle}>
                  Nâng cấp lên Doanh nghiệp
                </Text>
                <Text style={styles.upgradeDesc}>
                  Tăng độ uy tín, mở rộng hạn mức đăng tin và nhận hỗ trợ ưu
                  tiên.
                </Text>
                <TouchableOpacity
                  style={styles.upgradeBtn}
                  onPress={() =>
                    router.push("/profile/business-upgrade" as any)
                  }
                >
                  <Text style={styles.upgradeBtnText}>Khám phá ngay</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.upgradeIconBox}>
                <Ionicons name="storefront" size={32} color={COLORS.text} />
              </View>
            </View>
          )}

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons
                name="wallet-outline"
                size={24}
                color={COLORS.primary}
              />
              <Text style={styles.statLabel}>Số dư ví</Text>
              <Text style={styles.statValue}>0 đ</Text>
            </View>

            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.7}
              onPress={() => router.push("/(tabs)/posts")}
            >
              <Ionicons
                name="newspaper-outline"
                size={24}
                color={COLORS.primary}
              />
              <Text style={styles.statLabel}>
                {user.role === "business"
                  ? "Tin đang thu mua"
                  : "Tin đang đăng bán"}
              </Text>
              <Text style={styles.statValue}>{postCount} bài</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.menuContainer}>
            {menuItems.map((item, index) => (
              <TouchableOpacity
                key={index}
                style={styles.menuItem}
                onPress={() => handleMenuPress(item.route)}
              >
                <View style={styles.menuIconBox}>
                  <Ionicons
                    name={item.icon as any}
                    size={22}
                    color={COLORS.primary}
                  />
                </View>
                <Text style={styles.menuText}>{item.title}</Text>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.border}
                />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity
            style={styles.logoutButton}
            onPress={async () => {
              await logout();
              router.replace("/(tabs)");
            }}
          >
            <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>

        {/* MODAL BOTTOM SHEET GIAO DIỆN XỊN CHỌN CHỨC NĂNG */}
        <Modal
          visible={showActionModal}
          animationType="slide"
          transparent={true}
        >
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowActionModal(false)}
          >
            <View style={styles.actionModalContent}>
              <View style={styles.modalDragIndicator} />
              <Text style={styles.actionModalTitle}>Chọn chức năng</Text>

              <TouchableOpacity
                style={styles.actionModalBtn}
                onPress={() => {
                  setShowActionModal(false);
                  router.push("/(tabs)/orders");
                }}
              >
                <View
                  style={[
                    styles.actionModalIcon,
                    { backgroundColor: "#E0F2FE" },
                  ]}
                >
                  <Ionicons name="receipt-outline" size={24} color="#0EA5E9" />
                </View>
                <View style={styles.actionModalTextContainer}>
                  <Text style={styles.actionModalBtnText}>Xem Đơn hàng</Text>
                  <Text style={styles.actionModalBtnDesc}>
                    Quản lý và theo dõi trạng thái giao dịch
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.border}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionModalBtn, { borderBottomWidth: 0 }]}
                onPress={() => {
                  setShowActionModal(false);
                  setTimeout(() => {
                    const msg =
                      "Vui lòng truy cập phiên bản Web trên máy tính để xem Biểu đồ Thống kê chi tiết.";
                    Platform.OS === "web"
                      ? window.alert(msg)
                      : Alert.alert("Thông báo", msg);
                  }, 300);
                }}
              >
                <View
                  style={[
                    styles.actionModalIcon,
                    { backgroundColor: "#FEF3C7" },
                  ]}
                >
                  <Ionicons
                    name="bar-chart-outline"
                    size={24}
                    color="#F59E0B"
                  />
                </View>
                <View style={styles.actionModalTextContainer}>
                  <Text style={styles.actionModalBtnText}>Xem Thống kê</Text>
                  <Text style={styles.actionModalBtnDesc}>
                    Báo cáo doanh thu (Chỉ hỗ trợ trên Web)
                  </Text>
                </View>
                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.border}
                />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.border, alignItems: "center" },
  mobileWrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 0px 20px rgba(0,0,0,0.1)" } as any)
      : {}),
  },
  container: { flex: 1, paddingHorizontal: 16 },

  unauthContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: COLORS.background,
  },
  unauthTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 12,
  },
  unauthDesc: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    marginBottom: 32,
    lineHeight: 22,
  },
  loginBtn: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
  },
  loginBtnText: { color: COLORS.white, fontWeight: "bold", fontSize: 16 },

  userInfoSection: { alignItems: "center", marginTop: 16, marginBottom: 20 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginBottom: 12,
    backgroundColor: COLORS.border,
  },
  userName: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 6,
  },
  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E9F0F0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 12,
  },
  verifiedText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: "700",
    marginLeft: 4,
  },
  metaRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  metaText: { fontSize: 13, color: COLORS.textLight },

  statsBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statsTextRating: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  statsDivider: { fontSize: 14, color: COLORS.border, marginHorizontal: 10 },
  statsText: { fontSize: 14, fontWeight: "600", color: COLORS.text },

  upgradeBanner: {
    backgroundColor: COLORS.text,
    borderRadius: 16,
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  upgradeTextContainer: { flex: 1, marginRight: 10 },
  upgradeTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 6,
  },
  upgradeDesc: { color: COLORS.border, fontSize: 11, marginBottom: 12 },
  upgradeBtn: {
    backgroundColor: COLORS.white,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  upgradeBtnText: { color: COLORS.text, fontSize: 12, fontWeight: "700" },
  upgradeIconBox: {
    width: 60,
    height: 60,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },

  statsGrid: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statLabel: { fontSize: 12, color: COLORS.textLight, marginTop: 8 },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 4,
    color: COLORS.text,
  },

  menuContainer: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },
  menuIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: COLORS.background,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  menuText: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: "500" },

  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#F2D5D5",
  },
  logoutText: {
    color: COLORS.error,
    fontSize: 15,
    fontWeight: "700",
    marginLeft: 12,
  },

  // STYLES CHO CUSTOM MODAL (BOTTOM SHEET)
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  actionModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalDragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  actionModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 20,
    textAlign: "center",
  },
  actionModalBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  actionModalIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  actionModalTextContainer: { flex: 1 },
  actionModalBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  actionModalBtnDesc: { fontSize: 13, color: COLORS.textLight },
});
