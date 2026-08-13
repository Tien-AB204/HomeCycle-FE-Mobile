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
import {
  InlineFeedback,
  useActionFeedback,
} from "../../src/components/shared/ActionFeedback";
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import apiClient from "../../src/services/apis/axiosClient";

const appointmentApi = {
  getAppointmentDetail: (appointmentId: string) =>
    apiClient.get(`/appointments/${appointmentId}`).then((res) => res.data),
};

export default function AppointmentDetailScreen() {
  const router = useRouter();
  const { id: appointmentId } = useLocalSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  const { feedback, clearFeedback, showInfo, showError } = useActionFeedback();

  const fetchDetail = useCallback(async () => {
    if (!appointmentId) return;
    try {
      setIsLoading(true);
      const res = await appointmentApi.getAppointmentDetail(
        appointmentId as string,
      );
      setData(res?.data || res);
    } catch (error: any) {
      console.error("Lỗi tải chi tiết lịch hẹn:", error);
      const status = error?.response?.status;
      if (status === 500) {
        showError("Lỗi server. Vui lòng thử lại sau.");
      } else {
        showError("Không thể tải thông tin lịch hẹn lúc này.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [appointmentId, showError]);

  useFocusEffect(
    useCallback(() => {
      void fetchDetail();
    }, [fetchDetail]),
  );

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const translateStatus = (status: number | string) => {
    const s = String(status);
    switch (s) {
      case "0":
        return "Chờ xác nhận";
      case "1":
        return "Đã xác nhận";
      case "2":
        return "Đã hoàn thành";
      case "3":
        return "Đã hủy";
      case "4":
        return "Bỏ lỡ";
      default:
        return "Chờ xác nhận";
    }
  };

  const translateAppointmentType = (type: number | string) => {
    return String(type) === "1" ? "Lịch kiểm định" : "Lịch thu gom";
  };

  const handleAction = (actionName: string) => {
    clearFeedback();
    showInfo(`Tính năng "${actionName}" đang được phát triển.`);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết Lịch hẹn" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data || !data.appointment) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết Lịch hẹn" showBack={true} />
        <View style={styles.loadingContainer}>
          <Text style={{ color: COLORS.error, fontSize: 16 }}>
            Không tìm thấy thông tin lịch hẹn!
          </Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Text style={{ color: COLORS.white }}>Quay lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const appt = data.appointment;
  const detail = data.collectionAppointment || data.inspectionAppointment || {};

  // --- LOGIC PROGRESS BAR LỊCH HẸN ---
  // Enum: Pending=0, Confirmed=1, Completed=2, Cancelled=3, Missed=4
  const currentStatusCode = Number(appt.appointmentStatus ?? 0);
  const isCancelled = currentStatusCode === 3;
  const isMissed = currentStatusCode === 4;
  const isFailed = isCancelled || isMissed;

  // Bước tiến trình: 0 -> 1 -> 2 (Bước 2 gom chung Completed, Cancelled, Missed)
  const progressStep = currentStatusCode >= 2 ? 2 : currentStatusCode;

  const stepLabels = [
    "Chờ xác nhận",
    "Đã xác nhận",
    isCancelled ? "Đã hủy" : isMissed ? "Bỏ lỡ" : "Hoàn thành",
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Chi tiết Lịch hẹn" showBack={true} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. HEADER LOẠI LỊCH HẸN & TRẠNG THÁI NỔI BẬT */}
        <View style={styles.headerStatusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusTitle}>
              {translateAppointmentType(appt.appointmentType)}
            </Text>
          </View>

          {/* Khối Trạng thái tách riêng nổi bật */}
          <View style={styles.statusHighlightBox}>
            <Text style={styles.statusHighlightLabel}>
              Trạng thái lịch hẹn:
            </Text>
            <Text style={styles.statusHighlightValue}>
              {translateStatus(appt.appointmentStatus)}
            </Text>
          </View>
        </View>

        {/* 2. CARD TIẾN TRÌNH LỊCH HẸN (PROGRESS BAR) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tiến trình lịch hẹn</Text>
          <View style={styles.progressContainer}>
            {stepLabels.map((label, index) => {
              const isPassed = index < progressStep;
              const isCurrent = index === progressStep;

              return (
                <View key={index} style={styles.progressStep}>
                  <View
                    style={[
                      styles.circle,
                      isPassed
                        ? styles.circleCompleted
                        : isCurrent
                          ? styles.circleActive
                          : styles.circlePending,
                      isFailed && index === 2 && styles.circleCancelled,
                    ]}
                  >
                    {isPassed ? (
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={COLORS.white}
                      />
                    ) : (
                      <Text
                        style={[
                          styles.circleText,
                          isCurrent && styles.circleTextActive,
                        ]}
                      >
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.progressLabel,
                      isCurrent && styles.progressLabelActive,
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        {feedback ? (
          <InlineFeedback
            feedback={feedback}
            onDismiss={clearFeedback}
            style={{ marginBottom: 16 }}
          />
        ) : null}

        {/* 3. THỜI GIAN & ĐỊA ĐIỂM */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thời gian & Địa điểm</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Thời gian hẹn:</Text>
            <Text
              style={[
                styles.infoValue,
                { fontWeight: "bold", color: COLORS.primary },
              ]}
            >
              {formatDateTime(detail.collectionDate || detail.inspectionDate)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Địa chỉ lấy hàng:</Text>
            <Text style={styles.infoValue}>
              {detail.pickupAddress ||
                detail.inspectionAddress ||
                "Chưa cập nhật"}
            </Text>
          </View>
          {detail.deliveryAddress && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Địa chỉ giao nhận:</Text>
              <Text style={styles.infoValue}>{detail.deliveryAddress}</Text>
            </View>
          )}
          {detail.deliveryMethod && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phương thức vận chuyển:</Text>
              <Text style={styles.infoValue}>{detail.deliveryMethod}</Text>
            </View>
          )}
        </View>

        {/* 4. TRẠNG THÁI CHECK-IN */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Trạng thái Check-in</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Người mua đã Check-in:</Text>
            <Text
              style={[
                styles.infoValue,
                { color: appt.buyerCheckedIn ? "#10B981" : COLORS.error },
              ]}
            >
              {appt.buyerCheckedIn ? "Đã check-in" : "Chưa check-in"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Người bán đã Check-in:</Text>
            <Text
              style={[
                styles.infoValue,
                { color: appt.sellerCheckedIn ? "#10B981" : COLORS.error },
              ]}
            >
              {appt.sellerCheckedIn ? "Đã check-in" : "Chưa check-in"}
            </Text>
          </View>
        </View>

        {/* 5. THÔNG TIN HỆ THỐNG */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thông tin hệ thống</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ngày tạo lịch:</Text>
            <Text style={styles.infoValue}>
              {formatDateTime(appt.createdAt)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cập nhật lần cuối:</Text>
            <Text style={styles.infoValue}>
              {formatDateTime(appt.updatedAt)}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* FOOTER CHECK-IN BUTTON */}
      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => handleAction("Check-in lịch hẹn")}
        >
          <Text style={styles.primaryBtnText}>Check-in tại điểm hẹn</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 16, paddingBottom: 40 },

  headerStatusCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    paddingTop: 18,
    paddingHorizontal: 16,
    paddingBottom: 0,
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
    overflow: "hidden",
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  statusTitle: { fontSize: 20, fontWeight: "bold", color: COLORS.white },

  statusHighlightBox: {
    backgroundColor: "#FEF3C7",
    marginHorizontal: -16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#FDE68A",
  },
  statusHighlightLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#92400E",
  },
  statusHighlightValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#B45309",
  },

  // Progress Bar Styles
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginTop: 8,
  },
  progressStep: {
    alignItems: "center",
    flex: 1,
  },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    borderWidth: 1.5,
  },
  circleCompleted: {
    backgroundColor: "#10B981",
    borderColor: "#10B981",
  },
  circleActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  circlePending: {
    backgroundColor: "#F1F5F9",
    borderColor: "#CBD5E1",
  },
  circleCancelled: {
    backgroundColor: "#EF4444",
    borderColor: "#EF4444",
  },
  circleText: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.textLight,
  },
  circleTextActive: {
    color: COLORS.white,
  },
  progressLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: "center",
  },
  progressLabelActive: {
    color: COLORS.primary,
    fontWeight: "bold",
  },

  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 8,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  infoLabel: { fontSize: 13, color: COLORS.textLight, flex: 1 },
  infoValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
    flex: 2,
    textAlign: "right",
  },

  backBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  primaryBtn: {
    height: 48,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryBtnText: { color: COLORS.white, fontSize: 15, fontWeight: "bold" },
});
