import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
import { getApiErrorMessage, getApiSuccessMessage } from "../../src/utils/apiFeedback";

const offerApi = {
  getOfferById: (offerId: string) =>
    apiClient.get(`/offers/${offerId}`).then((response) => response.data),

  cancelOffer: (offerId: string) =>
    apiClient.post(`/offers/${offerId}/cancel`).then((response) => response.data),

  // PUT /offers/{offerId} cố ý KHÔNG gắn trên Mobile ở thời điểm hiện tại.
};

type InlineMessage = {
  type: "error" | "success" | "warning";
  text: string;
} | null;

const unwrap = (value: any) => value?.data ?? value;

const normalizeStatus = (value: unknown) =>
  String(value ?? "")
    .replace(/[\s_-]/g, "")
    .toLowerCase();

const translateStatus = (value: unknown) => {
  const status = normalizeStatus(value);

  switch (status) {
    case "0":
    case "pending":
      return "Đang chờ phản hồi";
    case "1":
    case "accepted":
      return "Đã chấp nhận";
    case "2":
    case "rejected":
      return "Đã từ chối";
    case "3":
    case "cancelled":
    case "canceled":
      return "Đã hủy";
    default:
      return value ? String(value) : "Chưa xác định";
  }
};

const formatPrice = (value: unknown) =>
  `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const formatDate = (value: unknown) => {
  if (!value) return "Chưa có";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export default function OfferDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const offerId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [offer, setOffer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [message, setMessage] = useState<InlineMessage>(null);

  const fetchOffer = useCallback(async () => {
    if (!offerId) {
      setMessage({ type: "error", text: "Không tìm thấy mã đề nghị." });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);
      const response = await offerApi.getOfferById(offerId);
      setOffer(unwrap(response));
    } catch (error) {
      setOffer(null);
      setMessage({
        type: "error",
        text: getApiErrorMessage(error, "Không thể tải chi tiết đề nghị."),
      });
    } finally {
      setIsLoading(false);
    }
  }, [offerId]);

  useFocusEffect(
    useCallback(() => {
      void fetchOffer();
    }, [fetchOffer]),
  );

  const handleCancelOffer = async () => {
    if (!offerId) return;

    try {
      setIsCancelling(true);
      setMessage(null);

      const response = await offerApi.cancelOffer(offerId);
      const updatedOffer = unwrap(response);

      if (updatedOffer?.offerId) {
        setOffer(updatedOffer);
      } else {
        await fetchOffer();
      }

      setIsConfirmingCancel(false);
      setMessage({
        type: "success",
        text: getApiSuccessMessage(response, "Đã hủy đề nghị thương lượng."),
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: getApiErrorMessage(error, "Không thể hủy đề nghị lúc này."),
      });
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading && !offer) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết đề nghị" showBack={true} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải đề nghị...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!offer) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết đề nghị" showBack={true} />
        <View style={styles.centered}>
          <Ionicons name="document-text-outline" size={44} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>Không thể hiển thị đề nghị</Text>
          {message ? <Text style={styles.errorText}>{message.text}</Text> : null}
          <TouchableOpacity style={styles.primaryButton} onPress={() => void fetchOffer()}>
            <Text style={styles.primaryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pending = normalizeStatus(offer.offerStatus) === "pending" || String(offer.offerStatus) === "0";
  const canCancel = offer.canCancel === true && pending;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Chi tiết đề nghị" showBack={true} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Ionicons name="pricetag-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.headerTextWrapper}>
              <Text style={styles.cardTitle}>Đề nghị thương lượng đã gửi</Text>
              <Text style={styles.cardSubtitle}>Chỉ xem thông tin; không thể chỉnh sửa đề nghị.</Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Giá đề nghị</Text>
            <Text style={[styles.value, styles.price]}>{formatPrice(offer.offerPrice)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Số lượng</Text>
            <Text style={styles.value}>{offer.offerQuantity ?? 0}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Người nhận</Text>
            <Text style={styles.value}>{offer.receiver?.displayName || "Đối tác"}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Trạng thái</Text>
            <Text style={[styles.value, styles.statusValue]}>{translateStatus(offer.offerStatus)}</Text>
          </View>

          <View style={[styles.row, styles.lastRow]}>
            <Text style={styles.label}>Thời gian gửi</Text>
            <Text style={styles.value}>{formatDate(offer.createdAt)}</Text>
          </View>
        </View>

        {message ? (
          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[
              styles.message,
              message.type === "error"
                ? styles.errorMessage
                : message.type === "warning"
                  ? styles.warningMessage
                  : styles.successMessage,
            ]}
          >
            {message.text}
          </Text>
        ) : null}

        {isConfirmingCancel ? (
          <View style={styles.confirmBox}>
            <View style={styles.confirmHeader}>
              <Ionicons name="warning-outline" size={20} color="#B91C1C" />
              <Text style={styles.confirmTitle}>Hủy đề nghị này?</Text>
            </View>
            <Text style={styles.confirmText}>
              Sau khi hủy, đề nghị Pending này sẽ không còn chờ đối tác phản hồi.
            </Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.confirmActionButton]}
                onPress={() => setIsConfirmingCancel(false)}
                disabled={isCancelling}
              >
                <Text style={styles.secondaryButtonText}>Ở lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  styles.confirmActionButton,
                  isCancelling && styles.disabled,
                ]}
                onPress={() => void handleCancelOffer()}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.cancelButtonText}>Xác nhận hủy</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : canCancel ? (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setMessage(null);
              setIsConfirmingCancel(true);
            }}
          >
            <Ionicons name="trash-outline" size={19} color={COLORS.white} />
            <Text style={styles.cancelButtonText}>Hủy đề nghị</Text>
          </TouchableOpacity>
        ) : (
          <View style={styles.readOnlyNotice}>
            <Ionicons name="information-circle-outline" size={18} color={COLORS.textLight} />
            <Text style={styles.readOnlyNoticeText}>
              Đề nghị này không còn ở trạng thái có thể hủy.
            </Text>
          </View>
        )}

        <TouchableOpacity style={styles.backToPostButton} onPress={() => router.back()}>
          <Text style={styles.backToPostText}>Quay lại bài đăng</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  content: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: { marginTop: 10, color: COLORS.textLight },
  emptyTitle: {
    marginTop: 12,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },
  errorText: {
    marginTop: 8,
    color: COLORS.error,
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EFF6FF",
    marginRight: 12,
  },
  headerTextWrapper: { flex: 1 },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  cardSubtitle: {
    marginTop: 3,
    color: COLORS.textLight,
    fontSize: 12,
    lineHeight: 17,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  lastRow: { marginBottom: 0 },
  label: { flex: 1, color: COLORS.textLight, fontSize: 13 },
  value: {
    flex: 1.5,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  price: { color: COLORS.error, fontWeight: "800" },
  statusValue: { color: COLORS.primary, fontWeight: "800" },
  message: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 19,
  },
  errorMessage: { color: "#B91C1C", backgroundColor: "#FEF2F2" },
  warningMessage: { color: "#B45309", backgroundColor: "#FFF7ED" },
  successMessage: { color: "#047857", backgroundColor: "#ECFDF5" },
  confirmBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
    backgroundColor: "#FEF2F2",
  },
  confirmHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  confirmTitle: { color: "#991B1B", fontSize: 15, fontWeight: "800" },
  confirmText: {
    marginTop: 8,
    color: "#7F1D1D",
    fontSize: 13,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginTop: 14,
  },
  confirmActionButton: {
    flex: 1,
    minHeight: 48,
    marginTop: 0,
    paddingHorizontal: 12,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  secondaryButtonText: { color: COLORS.text, fontWeight: "700" },
  cancelButton: {
    marginTop: 16,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    backgroundColor: COLORS.error,
    paddingHorizontal: 16,
  },
  cancelButtonText: { color: COLORS.white, fontWeight: "800", fontSize: 14 },
  disabled: { opacity: 0.65 },
  readOnlyNotice: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  readOnlyNoticeText: { flex: 1, color: COLORS.textLight, fontSize: 13 },
  backToPostButton: {
    marginTop: 12,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  backToPostText: { color: COLORS.primary, fontWeight: "800" },
  primaryButton: {
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "800" },
});
