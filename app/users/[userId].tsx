import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import {
  getBusinessModelLabel,
  getPublicProfileErrorMessage,
  publicProfileApi,
  type BusinessPublicProfile,
  type PublicUserProfile,
} from "../../src/services/apis/publicProfileApi";
import { getAvatarSource } from "../../src/utils/avatar";
import { useGuardedRouter } from "../../src/utils/tapGuard";

// Hồ sơ công khai CHỈ ĐỌC: không nút sửa, không theo dõi/nhắn tin giả,
// không huy hiệu xác minh (Backend hiện không trả IsVerified cho hồ sơ công khai).

const getStringParam = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value)?.trim() ?? "";

const formatJoinedDate = (value: string | null) => {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  return date.toLocaleDateString("vi-VN");
};

const formatRating = (value: number | null) =>
  value !== null && Number.isFinite(value) && value > 0
    ? `★ ${value.toFixed(1)}`
    : "Chưa có đánh giá";

// Địa chỉ: businessAddress là chính; chỉ nối thêm phường/thành phố khi chúng
// chưa xuất hiện trong địa chỉ (tránh lặp cùng một nội dung ba lần).
const composeBusinessAddress = (profile: BusinessPublicProfile) => {
  const parts: string[] = [];
  const main = profile.businessAddress?.trim() ?? "";
  if (main) parts.push(main);
  for (const extra of [profile.ward, profile.city]) {
    const text = extra?.trim() ?? "";
    if (!text) continue;
    const alreadyIncluded = parts.some((part) =>
      part.toLowerCase().includes(text.toLowerCase()),
    );
    if (!alreadyIncluded) parts.push(text);
  }
  return parts.join(", ");
};

const getPrimaryName = (profile: PublicUserProfile) => {
  if (profile.kind === "business") {
    return profile.businessName || profile.username || "Người dùng HomeCycle";
  }
  if (profile.kind === "personal") {
    return profile.fullName || profile.username || "Người dùng HomeCycle";
  }
  return profile.username || "Người dùng HomeCycle";
};

export default function PublicUserProfileScreen() {
  const router = useGuardedRouter();
  const params = useLocalSearchParams();
  const userId = getStringParam(params.userId as string | string[] | undefined);

  const [profile, setProfile] = useState<PublicUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Thẩm quyền đồng thời là ref (state React cập nhật bất đồng bộ):
  // - loadVersionRef: phản hồi cũ (userId cũ hoặc lần tải trước) không được ghi đè.
  // - inFlightUserIdRef: không tải chồng cùng một userId (focus lặp/thử lại nhanh).
  const loadVersionRef = useRef(0);
  const inFlightUserIdRef = useRef<string | null>(null);

  const loadProfile = useCallback(async () => {
    if (!userId) {
      loadVersionRef.current += 1;
      setProfile(null);
      setErrorMessage("Không tìm thấy người dùng cần xem hồ sơ.");
      setIsLoading(false);
      return;
    }
    if (inFlightUserIdRef.current === userId) return;

    const version = ++loadVersionRef.current;
    inFlightUserIdRef.current = userId;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const next = await publicProfileApi.getProfile(userId);
      if (version !== loadVersionRef.current) return;
      setProfile(next);
    } catch (error) {
      if (version !== loadVersionRef.current) return;
      setProfile(null);
      setErrorMessage(getPublicProfileErrorMessage(error));
    } finally {
      if (inFlightUserIdRef.current === userId) inFlightUserIdRef.current = null;
      if (version === loadVersionRef.current) setIsLoading(false);
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      void loadProfile();
    }, [loadProfile]),
  );

  const openReviews = () => {
    const targetId = profile?.userId || userId;
    if (!targetId) return;
    router.push(`/reviews/user/${targetId}` as any);
  };

  const renderBody = () => {
    if (isLoading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải hồ sơ...</Text>
        </View>
      );
    }

    if (errorMessage || !profile) {
      return (
        <View style={styles.centered}>
          <Ionicons name="person-circle-outline" size={44} color={COLORS.textLight} />
          <Text style={styles.errorText}>
            {errorMessage ?? "Không thể tải hồ sơ người dùng. Vui lòng thử lại."}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => void loadProfile()}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }

    const primaryName = getPrimaryName(profile);
    const showUsername = Boolean(profile.username) && profile.username !== primaryName;

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.identitySection}>
          <Image source={getAvatarSource(profile.avatarUrl)} style={styles.avatar} />
          <Text style={styles.primaryName} numberOfLines={2}>
            {primaryName}
          </Text>
          {showUsername ? (
            <Text style={styles.username} numberOfLines={1}>
              @{profile.username}
            </Text>
          ) : null}
          <Text style={styles.kindText}>
            {profile.kind === "business"
              ? "Tài khoản Doanh nghiệp"
              : profile.kind === "personal"
                ? "Tài khoản Cá nhân"
                : "Tài khoản HomeCycle"}
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile.reputationScore}</Text>
            <Text style={styles.statLabel}>Điểm uy tín</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{formatRating(profile.displayStarRating)}</Text>
            <Text style={styles.statLabel}>Đánh giá</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{profile.activePostCount}</Text>
            <Text style={styles.statLabel}>Bài đăng đang hoạt động</Text>
          </View>
        </View>

        <Text style={styles.joinedText}>Tham gia: {formatJoinedDate(profile.joinedAt)}</Text>

        {profile.kind === "personal" ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Thông tin cá nhân</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Họ và tên</Text>
              <Text style={styles.infoValue}>{profile.fullName || "Chưa cập nhật"}</Text>
            </View>
          </View>
        ) : null}

        {profile.kind === "business" ? (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Giới thiệu doanh nghiệp</Text>
              {profile.businessDescription ? (
                <Text style={styles.descriptionText}>{profile.businessDescription}</Text>
              ) : (
                <Text style={styles.emptyText}>Doanh nghiệp chưa cập nhật mô tả.</Text>
              )}
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Thông tin doanh nghiệp</Text>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Tên doanh nghiệp</Text>
                <Text style={styles.infoValue}>{profile.businessName || "Chưa cập nhật"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Mô hình</Text>
                <Text style={styles.infoValue}>
                  {getBusinessModelLabel(profile.businessModel, profile.businessModelRaw)}
                </Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Phạm vi hoạt động</Text>
                <Text style={styles.infoValue}>{profile.operatingScope || "Chưa cập nhật"}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Địa chỉ</Text>
                <Text style={styles.infoValue}>
                  {composeBusinessAddress(profile) || "Chưa cập nhật"}
                </Text>
              </View>
            </View>
          </>
        ) : null}

        <TouchableOpacity
          style={styles.reviewsButton}
          onPress={openReviews}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Ionicons name="star-outline" size={18} color={COLORS.white} />
          <Text style={styles.reviewsButtonText}>Xem đánh giá</Text>
        </TouchableOpacity>
      </ScrollView>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Hồ sơ người dùng" showBack />
      {renderBody()}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  loadingText: { marginTop: 10, color: COLORS.textLight },
  errorText: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 12,
  },
  retryButton: {
    minHeight: 44,
    marginTop: 16,
    paddingHorizontal: 22,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: { color: COLORS.primary, fontWeight: "700", fontSize: 13 },
  scrollContent: { padding: 16, paddingBottom: 40 },
  identitySection: { alignItems: "center", paddingTop: 8, paddingBottom: 16 },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "rgba(84, 123, 125, 0.10)",
  },
  primaryName: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "900",
    marginTop: 12,
    textAlign: "center",
  },
  username: { color: COLORS.textLight, fontSize: 13, marginTop: 4 },
  kindText: { color: COLORS.primary, fontSize: 12, fontWeight: "700", marginTop: 6 },
  statsRow: { flexDirection: "row", gap: 10 },
  statCard: {
    flex: 1,
    minHeight: 78,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    paddingHorizontal: 8,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  statValue: { color: COLORS.text, fontSize: 16, fontWeight: "900", textAlign: "center" },
  statLabel: {
    color: COLORS.textLight,
    fontSize: 11,
    marginTop: 5,
    textAlign: "center",
  },
  joinedText: {
    color: COLORS.textLight,
    fontSize: 13,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 16,
  },
  card: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    padding: 16,
    marginBottom: 14,
  },
  cardTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800", marginBottom: 10 },
  descriptionText: { color: COLORS.text, fontSize: 14, lineHeight: 21 },
  emptyText: { color: COLORS.textLight, fontSize: 13, fontStyle: "italic", lineHeight: 19 },
  infoRow: { marginTop: 8 },
  infoLabel: { color: COLORS.textLight, fontSize: 12, marginBottom: 2 },
  infoValue: { color: COLORS.text, fontSize: 14, lineHeight: 20, fontWeight: "600" },
  reviewsButton: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },
  reviewsButtonText: { color: COLORS.white, fontWeight: "800", fontSize: 14 },
});
