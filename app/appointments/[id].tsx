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
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

const appointmentApi = {
  getAppointmentDetail: (appointmentId: string) =>
    apiClient
      .get(`/appointments/${appointmentId}`)
      .then((response) => response.data),

  checkIn: (appointmentId: string) =>
    apiClient
      .post(`/appointments/${appointmentId}/check-in`)
      .then((response) => response.data),
};

type InlineMessage = {
  type: "error" | "success" | "info";
  text: string;
} | null;

const unwrap = (value: any) => value?.data ?? value;

const formatDateTime = (dateString?: string | null) => {
  if (!dateString) return "Chưa có";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const translateStatus = (status: number | string) => {
  switch (String(status)) {
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

const translateAppointmentType = (type: number | string) =>
  String(type) === "1" ? "Lịch thu gom" : "Lịch kiểm định";

const translateDeliveryMethod = (value: unknown) => {
  switch (String(value || "").toLowerCase()) {
    case "ghndelivery":
    case "1":
      return "Giao hàng GHN";
    case "sellerdelivers":
    case "2":
      return "Bên bán tự giao";
    case "buyerpickup":
    case "3":
      return "Bên mua tự lấy";
    default:
      return "Chưa cập nhật";
  }
};

export default function AppointmentDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const appointmentId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [data, setData] = useState<any>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<InlineMessage>(null);

  const fetchDetail = useCallback(
    async (showLoading = true) => {
      if (!appointmentId) {
        setLoadError("Không tìm thấy mã lịch hẹn.");
        setIsLoading(false);
        return;
      }

      try {
        if (showLoading) setIsLoading(true);
        setLoadError(null);
        const response = await appointmentApi.getAppointmentDetail(appointmentId);
        setData(unwrap(response));
      } catch (error) {
        setData(null);
        setLoadError(
          getApiErrorMessage(error, "Không thể tải thông tin lịch hẹn lúc này."),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [appointmentId],
  );

  useFocusEffect(
    useCallback(() => {
      setActionMessage(null);
      void fetchDetail();
    }, [fetchDetail]),
  );

  const handleCheckIn = async () => {
    if (!appointmentId || isCheckingIn) return;

    try {
      setIsCheckingIn(true);
      setActionMessage(null);
      const response = await appointmentApi.checkIn(appointmentId);
      const result = unwrap(response);

      await fetchDetail(false);

      const completed = Number(result?.appointmentStatus) === 2;
      setActionMessage({
        type: "success",
        text: completed
          ? "Check-in thành công. Cả hai bên đã check-in nên lịch hẹn đã hoàn thành."
          : "Check-in thành công. Đang chờ bên còn lại check-in.",
      });
    } catch (error: any) {
      const code = String(
        error?.response?.data?.code ||
          error?.response?.data?.error?.code ||
          "",
      );

      const fallback =
        code === "Appointment.Cancelled"
          ? "Lịch hẹn đã bị hủy, không thể check-in."
          : code === "Appointment.AlreadyCompleted"
            ? "Lịch hẹn đã hoàn tất."
            : code === "Auth.Forbidden"
              ? "Bạn không có quyền check-in lịch hẹn này."
              : "Không thể check-in lịch hẹn lúc này.";

      setActionMessage({
        type: "error",
        text: getApiErrorMessage(error, fallback),
      });
    } finally {
      setIsCheckingIn(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết Lịch hẹn" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải lịch hẹn...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!data?.appointment) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết Lịch hẹn" showBack />
        <View style={styles.centered}>
          <Ionicons
            name="calendar-outline"
            size={48}
            color={COLORS.textLight}
          />
          <Text style={styles.loadErrorText}>
            {loadError || "Không tìm thấy thông tin lịch hẹn."}
          </Text>
          <View style={styles.errorActions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => router.back()}
            >
              <Text style={styles.secondaryButtonText}>Quay lại</Text>
            </TouchableOpacity>
            {appointmentId ? (
              <TouchableOpacity
                style={styles.primarySmallButton}
                onPress={() => void fetchDetail()}
              >
                <Text style={styles.primarySmallButtonText}>Thử lại</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const appt = data.appointment;
  const isCollection =
    String(appt.appointmentType) === "1" || Boolean(data.collectionAppointment);
  const detail = isCollection
    ? data.collectionAppointment || {}
    : data.inspectionAppointment || {};
  const statusCode = Number(appt.appointmentStatus ?? 0);
  const isCancelled = statusCode === 3 || Boolean(appt.cancelledAt);
  const isCompleted = statusCode === 2 || Boolean(appt.completedAt);
  const isMissed = statusCode === 4;
  const progressStep =
    isCompleted || isCancelled || isMissed ? 2 : statusCode >= 1 ? 1 : 0;

  const buyerCheckAt = appt.buyerCheckAt || appt.buyerCheckedAt || null;
  const sellerCheckAt = appt.sellerCheckAt || appt.sellerCheckedAt || null;

  const stepLabels = [
    "Chờ xác nhận",
    "Đã xác nhận",
    isCancelled ? "Đã hủy" : isMissed ? "Bỏ lỡ" : "Hoàn thành",
  ];

  const checkInDisabled =
    isCheckingIn || isCancelled || isCompleted || isMissed;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Chi tiết Lịch hẹn" showBack />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerStatusCard}>
          <Text style={styles.statusTitle}>
            {translateAppointmentType(appt.appointmentType)}
          </Text>
          <View style={styles.statusHighlightBox}>
            <Text style={styles.statusHighlightLabel}>Trạng thái lịch hẹn</Text>
            <Text style={styles.statusHighlightValue}>
              {translateStatus(appt.appointmentStatus)}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Tiến trình lịch hẹn</Text>
          <View style={styles.progressContainer}>
            {stepLabels.map((label, index) => {
              const isPassed = index < progressStep;
              const isCurrent = index === progressStep;
              return (
                <View key={label} style={styles.progressStep}>
                  <View
                    style={[
                      styles.circle,
                      isPassed
                        ? styles.circleCompleted
                        : isCurrent
                          ? styles.circleActive
                          : styles.circlePending,
                      (isCancelled || isMissed) && index === 2
                        ? styles.circleFailed
                        : undefined,
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
                          isCurrent ? styles.circleTextActive : undefined,
                        ]}
                      >
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.progressLabel,
                      isCurrent ? styles.progressLabelActive : undefined,
                    ]}
                  >
                    {label}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            {isCollection ? "Lịch trình & Giao nhận" : "Thời gian & Địa điểm"}
          </Text>

          {isCollection ? (
            <>
              <InfoRow
                label="Thời gian thu gom"
                value={formatDateTime(detail.collectionDate)}
              />
              <InfoRow
                label="Điểm lấy"
                value={detail.pickupAddress || "Chưa cập nhật"}
              />
              <InfoRow
                label="Điểm giao"
                value={detail.deliveryAddress || "Chưa cập nhật"}
              />
              <InfoRow
                label="Phương thức giao nhận"
                value={translateDeliveryMethod(detail.deliveryMethod)}
              />
            </>
          ) : (
            <>
              <InfoRow
                label="Thời gian kiểm định"
                value={formatDateTime(detail.inspectionDate)}
              />
              <InfoRow
                label="Địa điểm kiểm định"
                value={detail.inspectionAddress || "Chưa cập nhật"}
              />
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Trạng thái Check-in</Text>
          <View style={styles.checkRow}>
            <Ionicons
              name={buyerCheckAt ? "checkmark-circle" : "ellipse-outline"}
              size={20}
              color={buyerCheckAt ? "#10B981" : COLORS.textLight}
            />
            <View style={styles.flex}>
              <Text style={styles.checkLabel}>Người mua</Text>
              <Text style={styles.checkTime}>
                {buyerCheckAt
                  ? `Đã check-in ${formatDateTime(buyerCheckAt)}`
                  : "Chưa check-in"}
              </Text>
            </View>
          </View>

          <View style={styles.checkRow}>
            <Ionicons
              name={sellerCheckAt ? "checkmark-circle" : "ellipse-outline"}
              size={20}
              color={sellerCheckAt ? "#10B981" : COLORS.textLight}
            />
            <View style={styles.flex}>
              <Text style={styles.checkLabel}>Người bán</Text>
              <Text style={styles.checkTime}>
                {sellerCheckAt
                  ? `Đã check-in ${formatDateTime(sellerCheckAt)}`
                  : "Chưa check-in"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thông tin hệ thống</Text>
          <InfoRow
            label="Ngày tạo lịch"
            value={formatDateTime(appt.createdAt)}
          />
          <InfoRow
            label="Cập nhật lần cuối"
            value={formatDateTime(appt.updatedAt)}
          />
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        {actionMessage ? (
          <View
            style={[
              styles.actionMessage,
              actionMessage.type === "error"
                ? styles.actionError
                : actionMessage.type === "success"
                  ? styles.actionSuccess
                  : styles.actionInfo,
            ]}
          >
            <Text
              style={[
                styles.actionMessageText,
                actionMessage.type === "error"
                  ? styles.actionErrorText
                  : actionMessage.type === "success"
                    ? styles.actionSuccessText
                    : styles.actionInfoText,
              ]}
            >
              {actionMessage.text}
            </Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[
            styles.primaryButton,
            checkInDisabled ? styles.disabledButton : undefined,
          ]}
          onPress={() => void handleCheckIn()}
          disabled={checkInDisabled}
        >
          {isCheckingIn ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons
                name={
                  isCompleted ? "checkmark-circle-outline" : "location-outline"
                }
                size={19}
                color={COLORS.white}
              />
              <Text style={styles.primaryButtonText}>
                {isCompleted
                  ? "Lịch hẹn đã hoàn thành"
                  : isCancelled
                    ? "Lịch hẹn đã bị hủy"
                    : isMissed
                      ? "Lịch hẹn đã bị bỏ lỡ"
                      : "Check-in tại điểm hẹn"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: { marginTop: 10, color: COLORS.textLight },
  loadErrorText: {
    marginTop: 12,
    color: COLORS.error,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  errorActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  secondaryButtonText: { color: COLORS.primary, fontWeight: "800" },
  primarySmallButton: {
    minHeight: 44,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  primarySmallButtonText: { color: COLORS.white, fontWeight: "800" },
  scrollContent: { padding: 16, paddingBottom: 160 },
  headerStatusCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingTop: 18,
    paddingHorizontal: 16,
    overflow: "hidden",
    marginBottom: 16,
  },
  statusTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 16,
  },
  statusHighlightBox: {
    marginHorizontal: -16,
    backgroundColor: "#FEF3C7",
    borderTopWidth: 1,
    borderTopColor: "#FDE68A",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusHighlightLabel: {
    color: "#92400E",
    fontSize: 13,
    fontWeight: "700",
  },
  statusHighlightValue: {
    color: "#B45309",
    fontSize: 13,
    fontWeight: "900",
  },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
    paddingBottom: 9,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressStep: { flex: 1, alignItems: "center" },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    marginBottom: 6,
  },
  circleCompleted: { backgroundColor: "#10B981", borderColor: "#10B981" },
  circleActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  circlePending: { backgroundColor: "#F1F5F9", borderColor: "#CBD5E1" },
  circleFailed: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
  circleText: { color: COLORS.textLight, fontSize: 12, fontWeight: "800" },
  circleTextActive: { color: COLORS.white },
  progressLabel: {
    color: COLORS.textLight,
    fontSize: 11,
    textAlign: "center",
  },
  progressLabelActive: { color: COLORS.primary, fontWeight: "800" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 10,
  },
  infoLabel: { flex: 1, color: COLORS.textLight, fontSize: 13 },
  infoValue: {
    flex: 1.5,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
  },
  checkLabel: { color: COLORS.text, fontSize: 13, fontWeight: "800" },
  checkTime: { color: COLORS.textLight, fontSize: 12, marginTop: 2 },
  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    padding: 14,
  },
  actionMessage: {
    borderWidth: 1,
    borderRadius: 9,
    padding: 10,
    marginBottom: 10,
  },
  actionMessageText: { fontSize: 12, lineHeight: 17 },
  actionError: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  actionErrorText: { color: "#B91C1C" },
  actionSuccess: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  actionSuccessText: { color: "#047857" },
  actionInfo: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  actionInfoText: { color: "#1D4ED8" },
  primaryButton: {
    minHeight: 52,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },
  disabledButton: { opacity: 0.55 },
});
