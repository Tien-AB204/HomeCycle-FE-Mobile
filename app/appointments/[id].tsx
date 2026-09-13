import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import CalendarDateField from "../../src/components/shared/CalendarDateField";
import Header from "../../src/components/shared/Header";
import {
  ModalBackdrop,
  ModalSurface,
} from "../../src/components/shared/ModalBackdrop";
import { COLORS } from "../../src/constants/theme";
import apiClient from "../../src/services/apis/axiosClient";
import inspectionFormApi, {
  translateConclusion,
  translateInspectionStatus,
  type InspectionFormSummary,
} from "../../src/services/apis/inspectionFormApi";
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

  requestReschedule: (appointmentId: string, proposedAt: string) =>
    apiClient
      .post(`/appointments/${appointmentId}/reschedule`, { proposedAt })
      .then((response) => response.data),

  acceptReschedule: (proposalAppointmentId: string) =>
    apiClient
      .post(`/appointments/${proposalAppointmentId}/reschedule/accept`)
      .then((response) => response.data),

  rejectReschedule: (proposalAppointmentId: string, reason: string) =>
    apiClient
      .post(`/appointments/${proposalAppointmentId}/reschedule/reject`, {
        reason: reason || undefined,
      })
      .then((response) => response.data),

  cancelAppointment: (appointmentId: string, reason: string) =>
    apiClient
      .post(`/appointments/${appointmentId}/cancel`, { reason })
      .then((response) => response.data),
};

type InlineMessage = {
  type: "error" | "success" | "info";
  text: string;
} | null;

type PendingLifecycleAction = "accept" | "reject" | "cancel" | null;

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

const normalizeAppointmentStatus = (value: unknown) =>
  String(value ?? "")
    .replace(/[\s_-]/g, "")
    .toLowerCase();

const translateStatus = (status: number | string) => {
  switch (normalizeAppointmentStatus(status)) {
    case "0":
    case "proposed":
      return "Chờ xác nhận";
    case "1":
    case "scheduled":
      return "Đã lên lịch";
    case "5":
    case "inprogress":
      return "Đang diễn ra";
    case "2":
    case "completed":
      return "Đã hoàn thành";
    case "3":
    case "cancelled":
      return "Đã hủy";
    case "4":
    case "expired":
      return "Quá hạn";
    default:
      return "Chưa xác định";
  }
};

const isCollectionAppointmentType = (type: unknown) => {
  const normalized = String(type ?? "").trim().toLowerCase();
  return normalized === "1" || normalized === "collection";
};

const translateAppointmentType = (type: number | string) =>
  isCollectionAppointmentType(type) ? "Lịch thu gom" : "Lịch kiểm định";

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatDateInput = (date: Date) =>
  [date.getFullYear(), pad2(date.getMonth() + 1), pad2(date.getDate())].join(
    "-",
  );

const defaultReschedulePartsFrom = () => {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);

  return {
    date: formatDateInput(next),
    time: "09:00",
  };
};

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
  const [isCollectingNow, setIsCollectingNow] = useState(false);
  const [data, setData] = useState<any>(null);
  const [inspectionForm, setInspectionForm] =
    useState<InspectionFormSummary | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<InlineMessage>(null);

  const [isRescheduleModalVisible, setIsRescheduleModalVisible] =
    useState(false);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");
  const [isReschedulingSubmitting, setIsReschedulingSubmitting] =
    useState(false);
  const [rescheduleFormError, setRescheduleFormError] = useState<
    string | null
  >(null);

  const [pendingLifecycleAction, setPendingLifecycleAction] =
    useState<PendingLifecycleAction>(null);
  const [lifecycleReason, setLifecycleReason] = useState("");
  const [isLifecycleSubmitting, setIsLifecycleSubmitting] = useState(false);
  const [lifecycleError, setLifecycleError] = useState<string | null>(null);

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
        const rawAppointment = unwrap(response);
        const normalizedData =
          rawAppointment?.appointment
            ? rawAppointment
            : rawAppointment?.appointmentId
              ? {
                  ...rawAppointment,
                  appointment: rawAppointment,
                  inspectionAppointment: rawAppointment?.inspection,
                  collectionAppointment: rawAppointment?.collection,
                }
              : rawAppointment;
        setData(normalizedData);

        const normalizedAppointment =
          normalizedData?.appointment;

        const normalizedIsCollection =
          isCollectionAppointmentType(
            normalizedAppointment?.appointmentType,
          ) ||
          Boolean(
            normalizedData?.collectionAppointment,
          );

        if (!normalizedIsCollection) {
          try {
            const form =
              await inspectionFormApi.getByAppointment(
                String(appointmentId),
              );

            setInspectionForm(form);
          } catch (inspectionError: any) {
            const inspectionStatus =
              Number(
                inspectionError?.response?.status ??
                  0,
              );

            setInspectionForm(null);

            if (inspectionStatus !== 404) {
              setActionMessage({
                type: "info",
                text: "Chưa thể tải các thao tác sau kiểm định. Vui lòng mở lại lịch hẹn để thử lại.",
              });
            }
          }
        } else {
          setInspectionForm(null);
        }
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

      const completedStatus =
        normalizeAppointmentStatus(result?.appointmentStatus);
      const completed =
        completedStatus === "2" || completedStatus === "completed";
      setActionMessage({
        type: "success",
        text: completed
          ? "Check-in thành công. Lịch hẹn hiện đã hoàn thành."
          : "Check-in thành công. Hệ thống đã ghi nhận thời điểm check-in.",
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

  const openRescheduleModal = () => {
    const defaults = defaultReschedulePartsFrom();
    setRescheduleDate(defaults.date);
    setRescheduleTime(defaults.time);
    setRescheduleFormError(null);
    setIsRescheduleModalVisible(true);
  };

  const closeRescheduleModal = () => {
    if (isReschedulingSubmitting) return;
    setIsRescheduleModalVisible(false);
  };

  const handleSubmitReschedule = async () => {
    if (!appointmentId || isReschedulingSubmitting) return;

    if (!rescheduleDate || !/^\d{2}:\d{2}$/.test(rescheduleTime)) {
      setRescheduleFormError(
        "Vui lòng chọn ngày và nhập giờ hẹn mới theo dạng HH:mm.",
      );
      return;
    }

    const proposedDate = new Date(`${rescheduleDate}T${rescheduleTime}:00`);

    if (
      Number.isNaN(proposedDate.getTime()) ||
      proposedDate.getTime() <= Date.now()
    ) {
      setRescheduleFormError("Thời gian đề xuất phải ở tương lai.");
      return;
    }

    try {
      setIsReschedulingSubmitting(true);
      setRescheduleFormError(null);

      await appointmentApi.requestReschedule(
        String(appointmentId),
        proposedDate.toISOString(),
      );

      setIsRescheduleModalVisible(false);
      await fetchDetail(false);

      setActionMessage({
        type: "success",
        text: "Đã gửi yêu cầu đổi lịch hẹn.",
      });
    } catch (error) {
      setRescheduleFormError(
        getApiErrorMessage(error, "Không thể gửi yêu cầu đổi lịch."),
      );
    } finally {
      setIsReschedulingSubmitting(false);
    }
  };

  const openLifecycleAction = (action: PendingLifecycleAction) => {
    if (isLifecycleSubmitting) return;
    setLifecycleReason("");
    setLifecycleError(null);
    setPendingLifecycleAction(action);
  };

  const closeLifecycleAction = () => {
    if (isLifecycleSubmitting) return;
    setPendingLifecycleAction(null);
    setLifecycleReason("");
    setLifecycleError(null);
  };

  const handleSubmitLifecycleAction = async () => {
    if (!appointmentId || !pendingLifecycleAction || isLifecycleSubmitting) {
      return;
    }

    if (pendingLifecycleAction === "cancel" && !lifecycleReason.trim()) {
      setLifecycleError("Vui lòng nhập lý do hủy lịch hẹn.");
      return;
    }

    const reschedule = data?.reschedule;
    const proposalId = reschedule?.proposalAppointmentId
      ? String(reschedule.proposalAppointmentId)
      : null;

    if (
      (pendingLifecycleAction === "accept" ||
        pendingLifecycleAction === "reject") &&
      !proposalId
    ) {
      setLifecycleError("Không tìm thấy đề xuất đổi lịch để xử lý.");
      return;
    }

    try {
      setIsLifecycleSubmitting(true);
      setLifecycleError(null);

      if (pendingLifecycleAction === "accept") {
        await appointmentApi.acceptReschedule(proposalId!);
      } else if (pendingLifecycleAction === "reject") {
        await appointmentApi.rejectReschedule(
          proposalId!,
          lifecycleReason.trim(),
        );
      } else {
        await appointmentApi.cancelAppointment(
          String(appointmentId),
          lifecycleReason.trim(),
        );
      }

      const completedAction = pendingLifecycleAction;
      setPendingLifecycleAction(null);
      setLifecycleReason("");
      await fetchDetail(false);

      setActionMessage({
        type: "success",
        text:
          completedAction === "accept"
            ? "Đã xác nhận lịch hẹn mới."
            : completedAction === "reject"
              ? "Đã từ chối lịch hẹn mới."
              : "Đã hủy lịch hẹn.",
      });
    } catch (error) {
      setLifecycleError(
        getApiErrorMessage(
          error,
          pendingLifecycleAction === "accept"
            ? "Không thể xác nhận lịch mới."
            : pendingLifecycleAction === "reject"
              ? "Không thể từ chối lịch mới."
              : "Không thể hủy lịch hẹn.",
        ),
      );
    } finally {
      setIsLifecycleSubmitting(false);
    }
  };

  const handleScheduleCollection = () => {
    if (
      !appointmentId ||
      inspectionForm?.actions
        ?.canScheduleCollection !== true
    ) {
      return;
    }

    router.push(
      {
        pathname:
          "/inspections/collection",

        params: {
          appointmentId:
            String(appointmentId),
        },
      } as any,
    );
  };

  const handleCollectNow = async () => {
    if (
      !appointmentId ||
      !inspectionForm ||
      inspectionForm.actions
        ?.canCollectNow !== true ||
      isCollectingNow
    ) {
      return;
    }

    try {
      setIsCollectingNow(true);
      setActionMessage(null);

      const result =
        await inspectionFormApi.collectNow(
          inspectionForm.inspectionFormId,
          inspectionForm.revision,
        );

      const targetOrderId =
        result?.orderId ||
        inspectionForm.orderId ||
        data?.order?.orderId;

      if (targetOrderId) {
        router.replace(
          (
            `/orders/${targetOrderId}`
          ) as any,
        );

        return;
      }

      await fetchDetail(false);

      setActionMessage({
        type: "success",
        text: "Đã xác nhận nhận hàng ngay.",
      });
    } catch (error: any) {
      const code = String(
        error?.response?.data?.code ||
          error?.response?.data
            ?.error?.code ||
          "",
      );

      if (
        code ===
        "Inspection.RevisionMismatch"
      ) {
        try {
          const latest =
            await inspectionFormApi
              .getByAppointment(
                String(appointmentId),
              );

          setInspectionForm(latest);
        } catch {
          // Không retry thao tác với revision cũ.
        }

        setActionMessage({
          type: "info",
          text: "Kết quả kiểm định vừa được cập nhật. Vui lòng kiểm tra lại trước khi xác nhận nhận hàng.",
        });

        return;
      }

      setActionMessage({
        type: "error",
        text: getApiErrorMessage(
          error,
          "Không thể xác nhận nhận hàng lúc này.",
        ),
      });
    } finally {
      setIsCollectingNow(false);
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
    isCollectionAppointmentType(appt.appointmentType) ||
    Boolean(data.collectionAppointment);
  const detail = isCollection
    ? data.collectionAppointment || {}
    : data.inspectionAppointment || {};
  const normalizedStatus = normalizeAppointmentStatus(appt.appointmentStatus);
  const isCancelled =
    normalizedStatus === "3" ||
    normalizedStatus === "cancelled" ||
    Boolean(data?.cancellation?.cancelledAt);
  const isCompleted =
    normalizedStatus === "2" ||
    normalizedStatus === "completed" ||
    Boolean(appt.completedAt);
  const isExpired =
    normalizedStatus === "4" || normalizedStatus === "expired";
  const isScheduled =
    normalizedStatus === "1" || normalizedStatus === "scheduled";
  const isInProgress =
    normalizedStatus === "5" || normalizedStatus === "inprogress";
  const progressStep =
    isCompleted || isCancelled || isExpired
      ? 2
      : isScheduled || isInProgress
        ? 1
        : 0;

  // Backend explicitly allows Scheduled + isOverdue = true — this is a
  // TIME status ("late"), never a terminal/failed state. Late Inspection
  // check-in or late direct Collection can still proceed per Backend
  // business rules, so this must never be shown or treated as Expired.
  const isOverdueActive =
    Boolean(appt.isOverdue) && !isCompleted && !isCancelled && !isExpired;

  const checkIn = isCollection ? null : detail?.checkIn || null;
  const buyerCheckAt =
    checkIn?.buyerCheckAt || appt.buyerCheckAt || appt.buyerCheckedAt || null;
  const sellerCheckAt =
    checkIn?.sellerCheckAt || appt.sellerCheckAt || appt.sellerCheckedAt || null;

  const stepLabels = [
    "Chờ xác nhận",
    isOverdueActive
      ? "Đã quá hạn"
      : isInProgress
        ? "Đang diễn ra"
        : "Đã lên lịch",
    isCancelled ? "Đã hủy" : isExpired ? "Quá hạn" : "Hoàn thành",
  ];

  const checkInDisabled =
    isCheckingIn || checkIn?.canCheckIn !== true;
  const checkInOpenAt = checkIn?.checkInOpenAt || null;
  const checkInOpenDate = checkInOpenAt ? new Date(checkInOpenAt) : null;
  const isBeforeCheckInWindow =
    !isCollection &&
    !isCompleted &&
    !isCancelled &&
    !isExpired &&
    checkInOpenDate instanceof Date &&
    !Number.isNaN(checkInOpenDate.getTime()) &&
    Date.now() < checkInOpenDate.getTime();
  const relatedOrderId = data?.order?.orderId || null;

  const canCollectNow =
    !isCollection &&
    inspectionForm?.actions
      ?.canCollectNow === true;

  const canScheduleCollection =
    !isCollection &&
    inspectionForm?.actions
      ?.canScheduleCollection === true;

  const hasPostInspectionActions =
    canCollectNow ||
    canScheduleCollection;

  const appointmentActions = appt.actions || {};
  const canRequestReschedule = appointmentActions.canRequestReschedule === true;
  const canAcceptReschedule = appointmentActions.canAcceptReschedule === true;
  const canRejectReschedule = appointmentActions.canRejectReschedule === true;
  const canCancelAppointment = appointmentActions.canCancel === true;
  const activeReschedule = data?.reschedule || null;

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
                      (isCancelled || isExpired) && index === 2
                        ? styles.circleFailed
                        : isOverdueActive && index === 1
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
                      isOverdueActive && index === 1
                        ? styles.progressLabelOverdue
                        : undefined,
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

        {relatedOrderId ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Đơn hàng liên quan</Text>
            <TouchableOpacity
              style={styles.relatedOrderButton}
              onPress={() => router.push(("/orders/" + relatedOrderId) as any)}
            >
              <View style={styles.relatedOrderIcon}>
                <Ionicons
                  name="receipt-outline"
                  size={19}
                  color={COLORS.primary}
                />
              </View>
              <View style={styles.flex}>
                <Text style={styles.relatedOrderTitle}>Xem đơn hàng</Text>
                <Text style={styles.relatedOrderMeta}>
                  {data?.order?.orderCode
                    ? "Mã đơn: " + data.order.orderCode
                    : "Mở chi tiết đơn hàng liên quan"}
                </Text>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>
        ) : null}

        {!isCollection ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Trạng thái Check-in</Text>
            <View style={styles.checkRow}>
              <Ionicons
                name={buyerCheckAt ? "checkmark-circle" : "ellipse-outline"}
                size={20}
                color={buyerCheckAt ? "#2F765D" : COLORS.textLight}
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
                color={sellerCheckAt ? "#2F765D" : COLORS.textLight}
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
        ) : null}

        {!isCollection &&
        (inspectionForm || appointmentActions.canCreateInspectionForm) ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Phiếu kiểm định</Text>

            {inspectionForm ? (
              <>
                <InfoRow
                  label="Trạng thái"
                  value={translateInspectionStatus(
                    inspectionForm.inspectionStatus,
                  )}
                />
                {inspectionForm.conclusion ? (
                  <InfoRow
                    label="Kết luận"
                    value={
                      translateConclusion(inspectionForm.conclusion) ||
                      "Chưa có"
                    }
                  />
                ) : null}
                <TouchableOpacity
                  style={styles.primarySmallButtonFlex}
                  onPress={() =>
                    router.push({
                      pathname: "/inspections/form",
                      params: { appointmentId: String(appointmentId) },
                    } as any)
                  }
                >
                  <Text style={styles.primarySmallButtonText}>
                    {inspectionForm.actions?.canEdit
                      ? "Chỉnh sửa phiếu kiểm định"
                      : "Xem phiếu kiểm định"}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.actionHintText}>
                  Bạn có thể tạo phiếu kiểm định cho lịch hẹn này.
                </Text>
                <TouchableOpacity
                  style={styles.primarySmallButtonFlex}
                  onPress={() =>
                    router.push({
                      pathname: "/inspections/form",
                      params: { appointmentId: String(appointmentId) },
                    } as any)
                  }
                >
                  <Text style={styles.primarySmallButtonText}>
                    Tạo phiếu kiểm định
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        ) : null}

        {activeReschedule ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Đề xuất đổi lịch hẹn</Text>
            <InfoRow
              label="Thời gian đề xuất"
              value={formatDateTime(activeReschedule.proposedAt)}
            />
            <Text style={styles.rescheduleNote}>
              {activeReschedule.isCurrentUserRequester
                ? "Bạn đã gửi đề xuất này. Đang chờ đối tác phản hồi."
                : "Đối tác đã đề xuất lịch hẹn mới. Vui lòng phản hồi."}
            </Text>

            {canAcceptReschedule || canRejectReschedule ? (
              <View style={styles.rescheduleActionsRow}>
                {canAcceptReschedule ? (
                  <TouchableOpacity
                    style={styles.primarySmallButtonFlex}
                    onPress={() => openLifecycleAction("accept")}
                  >
                    <Text style={styles.primarySmallButtonText}>
                      Chấp nhận lịch mới
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {canRejectReschedule ? (
                  <TouchableOpacity
                    style={styles.secondaryButtonFlex}
                    onPress={() => openLifecycleAction("reject")}
                  >
                    <Text style={styles.secondaryButtonText}>Từ chối</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : canRequestReschedule ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Đổi lịch hẹn</Text>
            <Text style={styles.actionHintText}>
              Bạn có thể đề xuất một thời gian hẹn khác cho lịch hẹn này.
            </Text>
            <TouchableOpacity
              style={styles.primarySmallButtonFlex}
              onPress={openRescheduleModal}
            >
              <Text style={styles.primarySmallButtonText}>
                Yêu cầu đổi lịch hẹn
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}

        {canCancelAppointment ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Hủy lịch hẹn</Text>
            <Text style={styles.actionHintDangerText}>
              Thao tác này sẽ hủy lịch hẹn và không thể hoàn tác.
            </Text>
            <TouchableOpacity
              style={styles.outlineBtnDanger}
              onPress={() => openLifecycleAction("cancel")}
            >
              <Text style={styles.outlineBtnDangerText}>Hủy lịch hẹn</Text>
            </TouchableOpacity>
          </View>
        ) : null}

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

        {!isCollection &&
        hasPostInspectionActions ? (
          <View
            style={
              styles.postInspectionActions
            }
          >
            {canCollectNow ? (
              <TouchableOpacity
                style={[
                  styles.secondaryActionButton,
                  isCollectingNow
                    ? styles.disabledButton
                    : undefined,
                ]}
                disabled={isCollectingNow}
                onPress={() =>
                  void handleCollectNow()
                }
              >
                {isCollectingNow ? (
                  <ActivityIndicator
                    color={COLORS.primary}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="hand-left-outline"
                      size={19}
                      color={COLORS.primary}
                    />

                    <Text
                      style={
                        styles.secondaryActionButtonText
                      }
                    >
                      Nhận hàng ngay
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : null}

            {canScheduleCollection ? (
              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  isCollectingNow
                    ? styles.disabledButton
                    : undefined,
                ]}
                disabled={isCollectingNow}
                onPress={
                  handleScheduleCollection
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={19}
                  color={COLORS.white}
                />

                <Text
                  style={
                    styles.primaryButtonText
                  }
                >
                  Đặt lịch giao nhận
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {!isCollection &&
        !hasPostInspectionActions ? (
          <>
            {isBeforeCheckInWindow && checkInOpenAt ? (
              <View style={styles.checkInWindowHint}>
                <Ionicons
                  name="time-outline"
                  size={17}
                  color={COLORS.primary}
                />
                <Text style={styles.checkInWindowHintText}>
                  Check-in mở lúc {formatDateTime(checkInOpenAt)}
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
                      : isExpired
                        ? "Lịch hẹn đã quá hạn"
                        : "Check-in tại điểm hẹn"}
                </Text>
              </>
            )}
            </TouchableOpacity>
          </>
        ) : null}
      </View>

      <Modal
        visible={isRescheduleModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeRescheduleModal}
      >
        <ModalBackdrop
          style={styles.lifecycleModalBackdrop}
          onPress={closeRescheduleModal}
        >
          <ModalSurface style={styles.lifecycleModalCard}>
            <Text style={styles.lifecycleModalTitle}>Đề xuất lịch hẹn mới</Text>

            <Text style={styles.label}>Ngày *</Text>
            <CalendarDateField
              value={rescheduleDate}
              onChange={setRescheduleDate}
              placeholder="Chọn ngày hẹn mới"
              defaultViewDate={rescheduleDate || undefined}
              disabled={isReschedulingSubmitting}
            />

            <Text style={styles.label}>Giờ *</Text>
            <TextInput
              value={rescheduleTime}
              onChangeText={(text) =>
                setRescheduleTime(text.replace(/[^0-9:]/g, "").slice(0, 5))
              }
              placeholder="09:00"
              placeholderTextColor={COLORS.textLight}
              keyboardType="numbers-and-punctuation"
              editable={!isReschedulingSubmitting}
              style={styles.textInput}
            />
            <Text style={styles.helperText}>Nhập theo dạng HH:mm.</Text>

            {rescheduleFormError ? (
              <Text style={styles.lifecycleModalError}>
                {rescheduleFormError}
              </Text>
            ) : null}

            <View style={styles.lifecycleModalActions}>
              <TouchableOpacity
                style={styles.secondaryButtonFlex}
                onPress={closeRescheduleModal}
                disabled={isReschedulingSubmitting}
              >
                <Text style={styles.secondaryButtonText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primarySmallButtonFlex}
                onPress={() => void handleSubmitReschedule()}
                disabled={isReschedulingSubmitting}
              >
                {isReschedulingSubmitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primarySmallButtonText}>Gửi đề xuất</Text>
                )}
              </TouchableOpacity>
            </View>
          </ModalSurface>
        </ModalBackdrop>
      </Modal>

      <Modal
        visible={pendingLifecycleAction !== null}
        transparent
        animationType="fade"
        onRequestClose={closeLifecycleAction}
      >
        <ModalBackdrop
          style={styles.lifecycleModalBackdrop}
          onPress={closeLifecycleAction}
        >
          <ModalSurface style={styles.lifecycleModalCard}>
            <Text style={styles.lifecycleModalTitle}>
              {pendingLifecycleAction === "accept"
                ? "Chấp nhận lịch hẹn mới?"
                : pendingLifecycleAction === "reject"
                  ? "Từ chối lịch hẹn mới?"
                  : "Hủy lịch hẹn?"}
            </Text>

            {pendingLifecycleAction === "cancel" ? (
              <>
                <Text style={styles.label}>Lý do hủy *</Text>
                <TextInput
                  value={lifecycleReason}
                  onChangeText={setLifecycleReason}
                  placeholder="Nhập lý do hủy lịch hẹn"
                  placeholderTextColor={COLORS.textLight}
                  multiline
                  editable={!isLifecycleSubmitting}
                  style={[styles.textInput, styles.multilineInput]}
                />
              </>
            ) : pendingLifecycleAction === "reject" ? (
              <>
                <Text style={styles.label}>Lý do từ chối (không bắt buộc)</Text>
                <TextInput
                  value={lifecycleReason}
                  onChangeText={setLifecycleReason}
                  placeholder="Nhập lý do từ chối"
                  placeholderTextColor={COLORS.textLight}
                  multiline
                  editable={!isLifecycleSubmitting}
                  style={[styles.textInput, styles.multilineInput]}
                />
              </>
            ) : (
              <Text style={styles.lifecycleModalText}>
                Xác nhận lịch hẹn mới sẽ thay thế lịch hẹn hiện tại.
              </Text>
            )}

            {lifecycleError ? (
              <Text style={styles.lifecycleModalError}>{lifecycleError}</Text>
            ) : null}

            <View style={styles.lifecycleModalActions}>
              <TouchableOpacity
                style={styles.secondaryButtonFlex}
                onPress={closeLifecycleAction}
                disabled={isLifecycleSubmitting}
              >
                <Text style={styles.secondaryButtonText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primarySmallButtonFlex,
                  pendingLifecycleAction === "cancel"
                    ? styles.primaryButtonDanger
                    : undefined,
                  pendingLifecycleAction === "cancel" &&
                  !lifecycleReason.trim()
                    ? styles.disabledButton
                    : undefined,
                ]}
                onPress={() => void handleSubmitLifecycleAction()}
                disabled={
                  isLifecycleSubmitting ||
                  (pendingLifecycleAction === "cancel" &&
                    !lifecycleReason.trim())
                }
              >
                {isLifecycleSubmitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primarySmallButtonText}>Xác nhận</Text>
                )}
              </TouchableOpacity>
            </View>
          </ModalSurface>
        </ModalBackdrop>
      </Modal>
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
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
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
    backgroundColor: "rgba(154, 100, 24, 0.10)",
    borderTopWidth: 1,
    borderTopColor: "rgba(154, 100, 24, 0.24)",
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  statusHighlightLabel: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 13,
    fontWeight: "700",
  },
  statusHighlightValue: {
    color: "#FFFFFF",
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
    borderBottomColor: "#BAC2C1",
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
  circleCompleted: { backgroundColor: "#2F765D", borderColor: "#2F765D" },
  circleActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  circlePending: { backgroundColor: "#F8F9FA", borderColor: "#BAC2C1" },
  circleFailed: { backgroundColor: "#7A1012", borderColor: "#7A1012" },
  circleText: { color: COLORS.textLight, fontSize: 12, fontWeight: "800" },
  circleTextActive: { color: COLORS.white },
  progressLabel: {
    color: COLORS.textLight,
    fontSize: 11,
    textAlign: "center",
  },
  progressLabelActive: { color: COLORS.primary, fontWeight: "800" },
  progressLabelOverdue: { color: "#7A1012", fontWeight: "800" },
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
  relatedOrderButton: {
    minHeight: 62,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  relatedOrderIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  relatedOrderTitle: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "900",
  },
  relatedOrderMeta: {
    color: COLORS.textLight,
    fontSize: 11,
    marginTop: 3,
  },
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
  actionError: { backgroundColor: "rgba(122, 16, 18, 0.08)", borderColor: "rgba(122, 16, 18, 0.22)" },
  actionErrorText: { color: "#7A1012" },
  actionSuccess: { backgroundColor: "rgba(47, 118, 93, 0.10)", borderColor: "rgba(47, 118, 93, 0.24)" },
  actionSuccessText: { color: "#2F765D" },
  actionInfo: { backgroundColor: "rgba(84, 123, 125, 0.10)", borderColor: "rgba(84, 123, 125, 0.24)" },
  actionInfoText: { color: "#2B5659" },
  checkInWindowHint: {
    minHeight: 40,
    borderRadius: 9,
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(84, 123, 125, 0.22)",
    paddingHorizontal: 12,
    marginBottom: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  checkInWindowHintText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  postInspectionActions: {
    gap: 10,
  },

  secondaryActionButton: {
    minHeight: 52,
    borderRadius: 11,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  secondaryActionButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "900",
  },

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
  actionHintText: {
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  actionHintDangerText: {
    color: COLORS.error,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  rescheduleNote: {
    color: COLORS.textLight,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    marginBottom: 12,
  },
  rescheduleActionsRow: { flexDirection: "row", gap: 10 },
  primarySmallButtonFlex: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonFlex: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  primaryButtonDanger: { backgroundColor: COLORS.error },
  outlineBtnDanger: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: "rgba(122, 16, 18, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnDangerText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: "800",
  },
  label: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 7,
  },
  textInput: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#BAC2C1",
    borderRadius: 9,
    backgroundColor: COLORS.white,
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 8,
  },
  multilineInput: {
    minHeight: 80,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  helperText: {
    color: COLORS.textLight,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },
  lifecycleModalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "rgba(23, 40, 48, 0.48)",
  },
  lifecycleModalCard: {
    width: "100%",
    maxWidth: 380,
    padding: 18,
    borderRadius: 16,
    backgroundColor: COLORS.white,
  },
  lifecycleModalTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 12,
  },
  lifecycleModalText: {
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  lifecycleModalError: {
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  lifecycleModalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
});
