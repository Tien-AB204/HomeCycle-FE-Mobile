import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
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
import apiClient from "../../src/services/apis/axiosClient";

const categoryLabels: Record<string, string> = {
  "1": "Không xuất hiện / bùng hẹn",
  noshow: "Không xuất hiện / bùng hẹn",
  "2": "Hàng hóa không đúng mô tả",
  itemmismatch: "Hàng hóa không đúng mô tả",
  "3": "Người bán không giao hàng",
  sellernotshipped: "Người bán không giao hàng",
  "4": "Hàng hóa hư hỏng hoặc thất lạc",
  damagedorlost: "Hàng hóa hư hỏng hoặc thất lạc",
  "5": "Không nhận được hàng",
  itemnotreceived: "Không nhận được hàng",
  "6": "Gian lận / lừa đảo",
  fraudorscam: "Gian lận / lừa đảo",
  "8": "Không thanh toán theo thỏa thuận",
  paymentnotcompleted: "Không thanh toán theo thỏa thuận",
  "9": "Vi phạm cam kết giao dịch",
  commitmentviolation: "Vi phạm cam kết giao dịch",
  "99": "Khác",
  other: "Khác",
};

const statusLabels: Record<string, string> = {
  "0": "Đang chờ xử lý",
  pending: "Đang chờ xử lý",
  "1": "Đã giải quyết",
  resolved: "Đã giải quyết",
  "2": "Đã từ chối",
  rejected: "Đã từ chối",
  "3": "Đã đóng",
  closed: "Đã đóng",
};

const getSingleParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const formatDateTime = (value?: string | null) => {
  if (!value) return "Chưa có";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatCurrency = (value?: number | null) =>
  value !== undefined && value !== null
    ? new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(value)
    : "Chưa có";

const normalizeKey = (value: unknown) => String(value ?? "").trim().toLowerCase();

export default function DisputeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const disputeId = getSingleParam(params.id as string | string[] | undefined);

  const [isLoading, setIsLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDetail = useCallback(async () => {
    if (!disputeId) {
      setErrorMessage("Không tìm thấy mã tranh chấp.");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const response = await apiClient.get(`/disputes/${disputeId}`);
      setDetail(response.data?.data || response.data);
    } catch (error: any) {
      setDetail(null);
      setErrorMessage(
        String(
          error?.response?.data?.message ||
            error?.response?.data?.error?.message ||
            "Không thể tải chi tiết tranh chấp lúc này.",
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [disputeId]);

  useFocusEffect(
    useCallback(() => {
      void loadDetail();
    }, [loadDetail]),
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết tranh chấp" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải tranh chấp...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!detail) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết tranh chấp" showBack />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={42} color={COLORS.error} />
          <Text style={styles.errorText}>{errorMessage || "Không tìm thấy tranh chấp."}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadDetail()}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const target = detail.target || {};
  const order = target.order || {};
  const sender = detail.sender || {};
  const targetUser = detail.targetUser || {};
  const evidenceImages = Array.isArray(detail.evidenceImages) ? detail.evidenceImages : [];
  const statusKey = normalizeKey(detail.status);
  const categoryKey = normalizeKey(detail.category);
  const statusLabel = statusLabels[statusKey] || String(detail.status ?? "Chưa rõ");
  const categoryLabel = categoryLabels[categoryKey] || String(detail.category ?? "Chưa rõ");

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Chi tiết tranh chấp" showBack />
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerCard}>
          <View style={styles.headerIcon}>
            <Ionicons name="warning-outline" size={24} color="#9A6418" />
          </View>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Tranh chấp giao dịch</Text>
            <Text style={styles.disputeIdText} numberOfLines={1}>
              #{detail.disputeId || disputeId}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>{statusLabel}</Text>
          </View>
        </View>

        {errorMessage ? (
          <View style={styles.inlineErrorBox}>
            <Text style={styles.inlineErrorText}>{errorMessage}</Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Đơn hàng liên quan</Text>
          <InfoRow label="Mã đơn hàng" value={order.orderCode || "Chưa có"} strong />
          <InfoRow label="Sản phẩm" value={order.productName || "Chưa có"} />
          <InfoRow label="Số lượng" value={String(order.quantity ?? "Chưa có")} />
          <InfoRow label="Giá trị giao dịch" value={formatCurrency(order.finalTotalAmount)} />
          <InfoRow label="Thời hạn khiếu nại" value={formatDateTime(order.disputeDeadlineUtc)} />
          {order.disputeWindowHours ? (
            <Text style={styles.helperText}>
              Cửa sổ khiếu nại do Backend xác định: {order.disputeWindowHours} giờ.
            </Text>
          ) : null}

          {order.orderId ? (
            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.push(`/orders/${order.orderId}` as any)}
            >
              <Ionicons name="receipt-outline" size={18} color={COLORS.primary} />
              <Text style={styles.linkButtonText}>Xem chi tiết đơn hàng</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Các bên liên quan</Text>
          <InfoRow label="Người khiếu nại" value={sender.username || "Chưa có"} strong />
          <InfoRow label="Người bị khiếu nại" value={targetUser.username || "Chưa có"} strong />
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Nội dung khiếu nại</Text>
          <InfoRow label="Loại khiếu nại" value={categoryLabel} strong />
          <Text style={styles.descriptionLabel}>Mô tả</Text>
          <Text style={styles.descriptionText}>{detail.description || "Không có mô tả."}</Text>
          <InfoRow label="Ngày gửi" value={formatDateTime(detail.createdAt)} />
          <InfoRow label="Cập nhật" value={formatDateTime(detail.updatedAt)} />
          {detail.resolvedAt ? (
            <InfoRow label="Ngày xử lý" value={formatDateTime(detail.resolvedAt)} />
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Ảnh bằng chứng</Text>
          {evidenceImages.length > 0 ? (
            <View style={styles.evidenceGrid}>
              {evidenceImages.map((item: any, index: number) => {
                const url = item?.url || item?.Url;
                if (!url) return null;
                return (
                  <Image
                    key={item?.mediaId || item?.MediaId || `${url}-${index}`}
                    source={{ uri: url }}
                    style={styles.evidenceImage}
                  />
                );
              })}
            </View>
          ) : (
            <Text style={styles.emptyText}>Không có ảnh bằng chứng để hiển thị.</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Kết quả xử lý</Text>
          {detail.moderatorNote ? (
            <>
              <Text style={styles.descriptionLabel}>Ghi chú Moderator</Text>
              <Text style={styles.descriptionText}>{detail.moderatorNote}</Text>
            </>
          ) : (
            <Text style={styles.emptyText}>
              Moderator chưa có ghi chú hoặc kết quả xử lý cho tranh chấp này.
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, strong && styles.infoValueStrong]}>{value}</Text>
    </View>
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
  loadingText: { marginTop: 10, color: COLORS.textLight, fontSize: 13 },
  errorText: {
    marginTop: 10,
    color: COLORS.error,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 18,
    minWidth: 110,
    minHeight: 42,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  retryButtonText: { color: COLORS.white, fontWeight: "700" },
  scrollContent: { padding: 16, paddingBottom: 36 },
  headerCard: {
    backgroundColor: "rgba(154, 100, 24, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(154, 100, 24, 0.24)",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  headerIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(154, 100, 24, 0.10)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  headerContent: { flex: 1 },
  headerTitle: { color: COLORS.text, fontSize: 15, fontWeight: "800" },
  disputeIdText: { color: COLORS.textLight, fontSize: 11, marginTop: 3 },
  statusBadge: {
    backgroundColor: "rgba(154, 100, 24, 0.10)",
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 6,
    marginLeft: 8,
  },
  statusText: { color: "#9A6418", fontSize: 11, fontWeight: "800" },
  inlineErrorBox: {
    backgroundColor: "rgba(122, 16, 18, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(122, 16, 18, 0.22)",
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  inlineErrorText: { color: "#7A1012", fontSize: 12, lineHeight: 18 },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    borderBottomWidth: 1,
    borderBottomColor: "#BAC2C1",
    paddingBottom: 8,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  infoLabel: { flex: 1, fontSize: 12, lineHeight: 18, color: COLORS.textLight },
  infoValue: {
    flex: 1.6,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.text,
    textAlign: "right",
  },
  infoValueStrong: { fontWeight: "700" },
  helperText: { fontSize: 11, lineHeight: 17, color: COLORS.textLight, marginTop: 2 },
  linkButton: {
    marginTop: 4,
    minHeight: 44,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: "rgba(84, 123, 125, 0.24)",
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  linkButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  descriptionLabel: { color: COLORS.textLight, fontSize: 12, marginBottom: 5 },
  descriptionText: {
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 20,
    backgroundColor: "#F8F9FA",
    borderRadius: 9,
    padding: 11,
    marginBottom: 12,
  },
  evidenceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  evidenceImage: {
    width: "47%",
    aspectRatio: 1,
    borderRadius: 10,
    backgroundColor: "#F8F9FA",
  },
  emptyText: { color: COLORS.textLight, fontSize: 12, lineHeight: 18 },
});
