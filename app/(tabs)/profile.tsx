import { Ionicons } from "@expo/vector-icons";
import { Redirect, usePathname, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Image, Platform, SafeAreaView, ScrollView, StyleSheet,
  Text, TouchableOpacity, useWindowDimensions, View,
} from "react-native";
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme"; 
import { useAuth } from "../../src/contexts/AuthContext";

export default function ProfileScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === "web" && screenWidth > 480 ? 480 : screenWidth;
  
  const { user, logout, isLoading } = useAuth();
  const pathname = usePathname();
  
  // State xử lý lỗi khi link avatar bị hỏng
  const [imageError, setImageError] = useState(false);

  if (isLoading) {
    return <View style={{ flex: 1, backgroundColor: '#F8F9FA' }} />; 
  }

  if (!user) {
    return <Redirect href={`/(auth)/login?returnUrl=${pathname}`} />;
  }

  // Lấy năm tham gia từ createdAt
  const joinYear = user.createdAt ? new Date(user.createdAt).getFullYear() : '';

  // 1. SỬA LẠI ĐÚNG TÊN BIẾN (user.avatar)
  // 2. Chặn luôn lỗi Backend trả về chữ "string" hoặc "null"
  const isValidAvatar = user.avatar && user.avatar !== 'string' && user.avatar !== 'null';
  
  // Ảnh dự phòng màu xanh giống thiết kế
  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username || 'U')}&background=208AEF&color=fff&size=200`;
  
  // Logic hiển thị: Nếu link xịn & không lỗi thì hiện ảnh, ngược lại hiện chữ
  const avatarSource = (isValidAvatar && !imageError) ? { uri: user.avatar } : { uri: defaultAvatar };

  const menuItems = user.role === 'business' 
    ? [
        { icon: "business-outline", title: "Hồ sơ Doanh nghiệp", route: '/business-account-info' },
        { icon: "bar-chart-outline", title: "Thống kê & Đơn hàng", route: '/dashboard' },
        { icon: "shield-checkmark-outline", title: "Trung tâm an toàn", route: '/safety-center' },
        { icon: "settings-outline", title: "Thiết lập ứng dụng", route: '/settings' },
      ]
    : [
        { icon: "person-outline", title: "Thông tin tài khoản", route: '/account-info' },
        { icon: "time-outline", title: "Lịch sử giao dịch", route: '/transaction-history' },
        { icon: "shield-checkmark-outline", title: "Trung tâm an toàn", route: '/safety-center' },
        { icon: "settings-outline", title: "Thiết lập ứng dụng", route: '/settings' },
      ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mobileWrapper, { width }]}>
        <MainHeader title="Hồ sơ" showBack={true} />

        <ScrollView showsVerticalScrollIndicator={false} style={styles.container}>
          
          <View style={styles.userInfoSection}>
            <Image 
              source={avatarSource} 
              style={styles.avatar} 
              onError={() => setImageError(true)} 
            />
            <Text style={styles.userName}>{user.username}</Text>

            {user.verificationStatus === 'Verified' && (
              <View style={styles.verifiedBadge}>
                <Ionicons name="checkmark-circle" size={15} color={COLORS.primary} />
                <Text style={styles.verifiedText}>Đã xác thực</Text>
              </View>
            )}

            <View style={styles.metaRow}>
              <Text style={styles.metaText}>Tham gia: {joinYear}</Text>
            </View>

            <View style={styles.statsBadge}>
              <Text style={styles.statsTextRating}>Điểm uy tín: {user.reputationScore}</Text>
              <Text style={styles.statsDivider}>|</Text>
              <Text style={styles.statsText}>
                0 {user.role === "business" ? "Giao dịch hoàn tất" : "Đơn hàng"}
              </Text>
            </View>
          </View>

          {user.role === "personal" && (
            <View style={styles.upgradeBanner}>
              <View style={styles.upgradeTextContainer}>
                <Text style={styles.upgradeTitle}>Nâng cấp lên Doanh nghiệp</Text>
                <Text style={styles.upgradeDesc}>Tăng độ uy tín, mở rộng hạn mức đăng tin và nhận hỗ trợ ưu tiên.</Text>
                <TouchableOpacity style={styles.upgradeBtn} onPress={() => router.push('/business-upgrade' as any)}>
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
              <Ionicons name="wallet-outline" size={24} color={COLORS.primary} />
              <Text style={styles.statLabel}>Số dư ví</Text>
              <Text style={styles.statValue}>0 đ</Text>
            </View>
            <View style={styles.statCard}>
              <Ionicons name="newspaper-outline" size={24} color={COLORS.primary} />
              <Text style={styles.statLabel}>
                {user.role === 'business' ? 'Tin đang thu mua' : 'Tin đang đăng bán'}
              </Text>
              <Text style={styles.statValue}>0 bài</Text>
            </View>
          </View>

          <View style={styles.menuContainer}>
            {menuItems.map((item, index) => (
              <TouchableOpacity 
                key={index} 
                style={styles.menuItem}
                onPress={() => {
                  if (item.route) {
                    router.push(item.route as any);
                  } else {
                    alert(`Tính năng ${item.title} đang phát triển!`);
                  }
                }}
              >
                <View style={styles.menuIconBox}>
                  <Ionicons name={item.icon as any} size={22} color={COLORS.primary} />
                </View>
                <Text style={styles.menuText}>{item.title}</Text>
                <Ionicons name="chevron-forward" size={20} color={COLORS.border} />
              </TouchableOpacity>
            ))}
          </View>

          <TouchableOpacity style={styles.logoutButton} onPress={() => logout()}>
            <Ionicons name="log-out-outline" size={22} color={COLORS.error} />
            <Text style={styles.logoutText}>Đăng xuất</Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.border, alignItems: "center" },
  mobileWrapper: { flex: 1, backgroundColor: COLORS.background, ...(Platform.OS === 'web' ? { boxShadow: '0px 0px 20px rgba(0,0,0,0.1)' } as any : {}) },
  container: { flex: 1, paddingHorizontal: 16 },

  userInfoSection: { alignItems: "center", marginTop: 16, marginBottom: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, marginBottom: 12, backgroundColor: COLORS.border },
  userName: { fontSize: 18, fontWeight: "700", color: COLORS.text, marginBottom: 6 },
  verifiedBadge: { flexDirection: "row", alignItems: "center", backgroundColor: '#E9F0F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 12 },
  verifiedText: { fontSize: 11, color: COLORS.primary, fontWeight: "700", marginLeft: 4 },
  metaRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  metaText: { fontSize: 13, color: COLORS.textLight },
  dot: { fontSize: 13, color: COLORS.textLight, marginHorizontal: 6 },
  statsBadge: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  statsTextRating: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  statsDivider: { fontSize: 14, color: COLORS.border, marginHorizontal: 10 },
  statsText: { fontSize: 14, fontWeight: "600", color: COLORS.text },

  upgradeBanner: { backgroundColor: COLORS.text, borderRadius: 16, padding: 20, flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  upgradeTextContainer: { flex: 1, marginRight: 10 },
  upgradeTitle: { color: COLORS.white, fontSize: 15, fontWeight: '700', marginBottom: 6 },
  upgradeDesc: { color: COLORS.border, fontSize: 11, marginBottom: 12 },
  upgradeBtn: { backgroundColor: COLORS.white, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, alignSelf: 'flex-start' },
  upgradeBtnText: { color: COLORS.text, fontSize: 12, fontWeight: '700' },
  upgradeIconBox: { width: 60, height: 60, backgroundColor: COLORS.white, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },

  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: COLORS.white, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border },
  statLabel: { fontSize: 12, color: COLORS.textLight, marginTop: 8 },
  statValue: { fontSize: 15, fontWeight: '700', marginTop: 4, color: COLORS.text },

  menuContainer: { backgroundColor: COLORS.white, borderRadius: 16, paddingHorizontal: 16, borderWidth: 1, borderColor: COLORS.border },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.background },
  menuIconBox: { width: 36, height: 36, borderRadius: 10, backgroundColor: COLORS.background, justifyContent: "center", alignItems: "center", marginRight: 12 },
  menuText: { flex: 1, fontSize: 15, color: COLORS.text, fontWeight: "500" },

  logoutButton: { flexDirection: "row", alignItems: "center", marginTop: 20, paddingVertical: 16, paddingHorizontal: 20, backgroundColor: COLORS.white, borderRadius: 16, borderWidth: 1, borderColor: '#F2D5D5' },
  logoutText: { color: COLORS.error, fontSize: 15, fontWeight: "700", marginLeft: 12 },
});