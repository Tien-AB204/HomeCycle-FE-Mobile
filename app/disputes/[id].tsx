import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import DisputeResponseModal, {
  type DisputeResponseMode,
} from "../../src/components/disputes/DisputeResponseModal";
import DeadlineBanner from "../../src/components/shared/DeadlineBanner";
import Header from "../../src/components/shared/Header";
import {
  ModalBackdrop,
  ModalSurface,
} from "../../src/components/shared/ModalBackdrop";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { useChatRealtime } from "../../src/contexts/ChatRealtimeContext";
import apiClient from "../../src/services/apis/axiosClient";
import { normalizeTargetType } from "../../src/services/notifications/notificationTargets";
import {
  translateAppearanceStatus,
  translateConclusion,
  translateInspectionStatus,
  translateMatchStatus,
  translateOperatingStatus,
  translatePartsStatus,
} from "../../src/services/apis/inspectionFormApi";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import { getDisputeCategoryDisplayName } from "../../src/utils/disputeCategoryLabel";
import { formatBuyPostPrice, isBuyPostType } from "../../src/utils/postType";
import { useAutoDismissFeedback } from "../../src/utils/useAutoDismissFeedback";
import { useDeadlineCountdown } from "../../src/utils/useDeadlineCountdown";
import { useGuardedRouter } from "../../src/utils/tapGuard";

type InlineMessage = {
  type: "error" | "success";
  text: string;
} | null;

// BE hiện tại (đã xác minh runtime) vẫn trả category dạng chuỗi enum cũ
// (vd. "ItemMismatch"), chưa triển khai object {disputeCategoryId, code,
// name, description} như hợp đồng mới. Giữ bảng này CHỈ để hiển thị đúng
// dữ liệu cũ trong lúc chờ BE triển khai đầy đủ; ưu tiên category.name khi
// BE đã trả object.
const LEGACY_CATEGORY_LABELS: Record<string, string> = {
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
  "7": "Đánh giá có nội dung không phù hợp",
  abusivereview: "Đánh giá có nội dung không phù hợp",
  "8": "Không thanh toán theo thỏa thuận",
  paymentnotcompleted: "Không thanh toán theo thỏa thuận",
  "9": "Vi phạm cam kết giao dịch",
  commitmentviolation: "Vi phạm cam kết giao dịch",
  "99": "Khác",
  other: "Khác",
};

const getDisputeCategoryLabel = (category: unknown): string => {
  if (category && typeof category === "object") {
    const raw = category as Record<string, unknown>;
    return getDisputeCategoryDisplayName(
      raw.code ?? raw.Code,
      raw.name ?? raw.Name,
      "Chưa rõ",
    );
  }

  return getDisputeCategoryDisplayName(
    category,
    LEGACY_CATEGORY_LABELS[normalizeKey(category)],
    "Chưa rõ",
  );
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
  "4": "Đang xem xét",
  underreview: "Đang xem xét",
  "5": "Đang chờ hoàn trả",
  awaitingreturn: "Đang chờ hoàn trả",
  "6": "Đang chờ phản hồi",
  awaitingresponse: "Đang chờ phản hồi",
};

// BE trả enum dạng chuỗi tên; vẫn nhận số để tương thích.
const originLabels: Record<string, string> = {
  "1": "Người dùng gửi khiếu nại",
  userreported: "Người dùng gửi khiếu nại",
  "2": "Phát sinh sau khi phiếu kiểm định bị từ chối",
  inspectionrejected: "Phát sinh sau khi phiếu kiểm định bị từ chối",
  "3": "Hệ thống ghi nhận vắng mặt lúc kiểm định",
  inspectionnoshow: "Hệ thống ghi nhận vắng mặt lúc kiểm định",
  "4": "Hệ thống ghi nhận sự cố giao nhận",
  collectionnoshow: "Hệ thống ghi nhận sự cố giao nhận",
};

const SYSTEM_ORIGINS = new Set(["3", "4", "inspectionnoshow", "collectionnoshow"]);

const resolutionSourceLabels: Record<string, string> = {
  "1": "Hai bên tự thống nhất",
  mutualagreement: "Hai bên tự thống nhất",
  "2": "Kiểm duyệt viên quyết định",
  moderatordecision: "Kiểm duyệt viên quyết định",
  "3": "Hệ thống tự đóng",
  systemautoclosed: "Hệ thống tự đóng",
};

const outcomeLabels: Record<string, string> = {
  "1": "Có lợi cho người mua",
  buyerfavored: "Có lợi cho người mua",
  "2": "Có lợi cho người bán",
  sellerfavored: "Có lợi cho người bán",
  "3": "Xác nhận có vi phạm",
  violationconfirmed: "Xác nhận có vi phạm",
  "4": "Không có vi phạm",
  noviolation: "Không có vi phạm",
};

type Tone = { color: string; background: string; border: string; icon: React.ComponentProps<typeof Ionicons>["name"] };

const TONES: Record<"warning" | "info" | "success" | "danger" | "neutral", Tone> = {
  warning: { color: "#9A6418", background: "rgba(154, 100, 24, 0.10)", border: "rgba(154, 100, 24, 0.26)", icon: "hourglass-outline" },
  info: { color: COLORS.primary, background: "rgba(84, 123, 125, 0.10)", border: "rgba(84, 123, 125, 0.26)", icon: "chatbubbles-outline" },
  success: { color: "#2F765D", background: "rgba(47, 118, 93, 0.10)", border: "rgba(47, 118, 93, 0.26)", icon: "checkmark-circle-outline" },
  danger: { color: "#7A1012", background: "rgba(122, 16, 18, 0.08)", border: "rgba(122, 16, 18, 0.24)", icon: "close-circle-outline" },
  neutral: { color: COLORS.textLight, background: "rgba(84, 123, 125, 0.06)", border: COLORS.border, icon: "archive-outline" },
};

// Màu thẻ trạng thái: chờ phản hồi (xanh), chờ / đang xử lý (vàng), xong (xanh lá), bị từ chối (đỏ), đã đóng (xám).
const getStatusTone = (statusKey: string): Tone => {
  if (["6", "awaitingresponse"].includes(statusKey)) return TONES.info;
  if (["1", "resolved"].includes(statusKey)) return TONES.success;
  if (["2", "rejected"].includes(statusKey)) return TONES.danger;
  if (["3", "closed"].includes(statusKey)) return TONES.neutral;
  return TONES.warning;
};

const responseTypeIcons: Record<string, React.ComponentProps<typeof Ionicons>["name"]> = {
  "1": "checkmark-circle",
  accept: "checkmark-circle",
  "2": "chatbox-ellipses",
  rebut: "chatbox-ellipses",
  "3": "document-text",
  statement: "document-text",
};

// BE đôi khi chèn thời điểm dạng ISO (UTC) vào mô tả diễn biến: đổi sang giờ hiển thị cho dễ đọc.
const ISO_DATE_TIME_PATTERN = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})?/g;
const formatIsoInText = (text: string) =>
  text.replace(ISO_DATE_TIME_PATTERN, (match) => formatDateTime(match));

const getInitial = (name?: string | null) =>
  String(name || "?").trim().charAt(0).toUpperCase() || "?";

const responseTypeLabels: Record<string, string> = {
  "1": "Đồng ý",
  accept: "Đồng ý",
  "2": "Phản biện",
  rebut: "Phản biện",
  "3": "Tường trình",
  statement: "Tường trình",
};

const appointmentTypeLabels: Record<string, string> = {
  "0": "Lịch kiểm định liên quan",
  inspection: "Lịch kiểm định liên quan",
  "1": "Lịch thu gom liên quan",
  collection: "Lịch thu gom liên quan",
};

const inspectionModeLabels: Record<string, string> = {
  "1": "Kiểm định chi tiết",
  detailed: "Kiểm định chi tiết",
  "2": "Xác nhận nhanh",
  quickaccept: "Xác nhận nhanh",
};

const getImageUrl = (item: any) => item?.url || item?.Url || "";

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

// Post/Review content-report labels. Unmapped values fall back to "Chưa rõ"
// rather than guessing, since not every PostStatus/ReviewStatus value is
// reachable from a content dispute.
const postStatusLabels: Record<string, string> = {
  active: "Đang hoạt động",
  closed: "Đã đóng",
  suspended: "Đã bị đình chỉ",
  deleted: "Đã xóa",
  expired: "Đã hết hạn",
};

const postTypeLabels: Record<string, string> = {
  sell: "Bán",
  buy: "Mua",
};

const reviewStatusLabels: Record<string, string> = {
  active: "Đang hiển thị",
  hidden: "Đã bị ẩn",
  removed: "Đã bị gỡ",
};

export default function DisputeDetailScreen() {
  const router = useGuardedRouter();
  const params = useLocalSearchParams();
  const disputeId = getSingleParam(params.id as string | string[] | undefined);

  const [isLoading, setIsLoading] = useState(true);
  const [detail, setDetail] = useState<any>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<InlineMessage>(null);
  useAutoDismissFeedback(actionMessage, () => setActionMessage(null));
  const [isCloseModalVisible, setIsCloseModalVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const closeDisputeInFlightRef = useRef(false);
  const [closeError, setCloseError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [responseMode, setResponseMode] = useState<DisputeResponseMode | null>(null);
  const { connection, reconnectVersion } = useChatRealtime();
  const { user } = useAuth();
  const currentUserId = String(user?.userId || user?.id || "").trim().toLowerCase();

  // silent: làm mới nền (realtime / kéo để làm mới) — giữ nguyên nội dung đang hiển thị,
  // không che bằng loading toàn màn và không xóa dữ liệu cũ khi lỗi.
  const loadDetail = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;

    if (!disputeId) {
      setErrorMessage("Không tìm thấy mã tranh chấp.");
      setIsLoading(false);
      return;
    }

    try {
      if (!silent) {
        setIsLoading(true);
        setErrorMessage(null);
      }
      const response = await apiClient.get(`/disputes/${disputeId}`);
      setDetail(response.data?.data || response.data);
    } catch (error: any) {
      if (silent) return;
      setDetail(null);
      setErrorMessage(
        getApiErrorMessage(
          error,
          "Không thể tải chi tiết tranh chấp lúc này.",
        ),
      );
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [disputeId]);

  useFocusEffect(
    useCallback(() => {
      setActionMessage(null);
      void loadDetail();
    }, [loadDetail]),
  );

  // BE không có sự kiện riêng cho tranh chấp: mỗi quyết định của Moderator gửi
  // NotificationCreated (TargetType = Dispute, TargetId = disputeId) cho hai bên.
  useEffect(() => {
    if (!connection || !disputeId) return;

    const currentDisputeId = String(disputeId).trim().toLowerCase();
    let timer: ReturnType<typeof setTimeout> | undefined;

    const handleNotification = (event: any) => {
      if (normalizeTargetType(event?.targetType ?? event?.TargetType) !== "dispute") return;
      if (String(event?.targetId ?? event?.TargetId ?? "").trim().toLowerCase() !== currentDisputeId) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => void loadDetail({ silent: true }), 150);
    };

    connection.on("NotificationCreated", handleNotification);
    return () => {
      if (timer) clearTimeout(timer);
      connection.off("NotificationCreated", handleNotification);
    };
  }, [connection, disputeId, loadDetail]);

  useEffect(() => {
    if (reconnectVersion <= 0) return;
    void loadDetail({ silent: true });
  }, [loadDetail, reconnectVersion]);

  // Hạn phản hồi do BE chốt cho từng tranh chấp; hết hạn thì tải lại để lấy trạng thái mới.
  const isAwaitingResponse = ["6", "awaitingresponse"].includes(normalizeKey(detail?.status));
  const responseCountdown = useDeadlineCountdown(
    isAwaitingResponse ? detail?.responseDeadlineAt : null,
    () => void loadDetail({ silent: true }),
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadDetail({ silent: true });
    setIsRefreshing(false);
  };

  const openCloseModal = () => {
    if (isClosing) return;
    setCloseError(null);
    setIsCloseModalVisible(true);
  };

  const closeCloseModal = () => {
    if (isClosing) return;
    setIsCloseModalVisible(false);
  };

  const handleCloseDispute = async () => {
    if (!disputeId || isClosing || closeDisputeInFlightRef.current) return;

    closeDisputeInFlightRef.current = true;

    try {
      setIsClosing(true);
      setCloseError(null);
      await apiClient.post(`/disputes/${disputeId}/close`);

      setIsCloseModalVisible(false);
      await loadDetail({ silent: true });
      setActionMessage({ type: "success", text: "Đã đóng tranh chấp." });
    } catch (error) {
      setCloseError(
        getApiErrorMessage(error, "Không thể đóng tranh chấp lúc này."),
      );
    } finally {
      closeDisputeInFlightRef.current = false;
      setIsClosing(false);
    }
  };

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
  const targetTypeKey = normalizeKey(target.targetType);
  const isPostTarget = targetTypeKey === "post";
  const isReviewTarget = targetTypeKey === "review";
  const order = target.order || {};
  const contentPost = target.post || null;
  const contentReview = target.review || null;
  // Sự cố do hệ thống ghi nhận có thể không có người gửi / người bị khiếu nại.
  const senderName = detail.sender?.username || "Hệ thống";
  const targetUserName = detail.targetUser?.username || "Chưa xác định bên vi phạm";
  const evidenceImages = Array.isArray(detail.evidenceImages) ? detail.evidenceImages : [];
  const originKey = normalizeKey(detail.origin);
  const originLabel = originLabels[originKey] || null;
  const isSystemIncident = SYSTEM_ORIGINS.has(originKey);
  const responses = Array.isArray(detail.responses) ? detail.responses : [];
  const timeline = Array.isArray(detail.timeline) ? detail.timeline : [];
  const appointmentContext = detail.appointmentContext || null;
  const inspectionContext = detail.inspectionContext || null;
  const inspectionImages = Array.isArray(inspectionContext?.images) ? inspectionContext.images : [];
  const outcomeLabel = outcomeLabels[normalizeKey(detail.resolutionOutcome)] || null;
  const resolutionSourceLabel = resolutionSourceLabels[normalizeKey(detail.resolutionSource)] || null;
  const proposedOutcomeLabel = outcomeLabels[normalizeKey(detail.proposedResolutionOutcome)] || null;
  const canAccept = detail.actions?.canAccept === true;
  const canRebut = detail.actions?.canRebut === true;
  // BE chỉ nhận một phản hồi mỗi người nhưng cờ tường trình chưa loại người đã gửi.
  const hasResponded =
    Boolean(currentUserId) &&
    responses.some(
      (item: any) => String(item?.responder?.userId ?? "").trim().toLowerCase() === currentUserId,
    );
  const canSubmitStatement = detail.actions?.canSubmitStatement === true && !hasResponded;
  const hasResponseActions = canAccept || canRebut || canSubmitStatement;
  const statusKey = normalizeKey(detail.status);
  const statusLabel = statusLabels[statusKey] || "Chưa rõ";
  const statusTone = getStatusTone(statusKey);
  // Category luôn hiển thị đúng tên đã lưu, kể cả khi loại đó hiện không
  // còn active cho khiếu nại mới (lịch sử vẫn phải hiển thị đúng).
  const categoryLabel = getDisputeCategoryLabel(detail.category);
  const canCloseDispute = detail.actions?.canCloseDispute === true;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Chi tiết tranh chấp" showBack />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void handleRefresh()}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={[styles.headerCard, { backgroundColor: statusTone.background, borderColor: statusTone.border }]}>
          <View style={styles.headerTopRow}>
            <View style={[styles.headerIcon, { backgroundColor: statusTone.border }]}>
              <Ionicons name={statusTone.icon} size={22} color={statusTone.color} />
            </View>
            <View style={styles.headerContent}>
              <Text style={styles.headerEyebrow}>
                {isPostTarget ? "Báo cáo bài đăng" : isReviewTarget ? "Báo cáo đánh giá" : "Tranh chấp giao dịch"}
              </Text>
              <Text style={[styles.headerStatus, { color: statusTone.color }]}>{statusLabel}</Text>
            </View>
          </View>
          <View style={styles.headerChips}>
            <View style={styles.headerChip}>
              <Ionicons name="pricetag-outline" size={13} color={COLORS.text} />
              <Text style={styles.headerChipText} numberOfLines={1}>{categoryLabel}</Text>
            </View>
            {originLabel ? (
              <View style={styles.headerChip}>
                <Ionicons name="flag-outline" size={13} color={COLORS.text} />
                <Text style={styles.headerChipText} numberOfLines={1}>{originLabel}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.disputeIdText} numberOfLines={1}>
            Mã #{String(detail.disputeId || disputeId).slice(0, 8).toUpperCase()} · Gửi lúc {formatDateTime(detail.createdAt)}
          </Text>
        </View>

        {isAwaitingResponse ? (
          <DeadlineBanner
            countdown={responseCountdown}
            label="Thời hạn phản hồi còn lại"
            expiredText="Đã hết thời hạn phản hồi."
            note={`Hạn phản hồi: ${formatDateTime(detail.responseDeadlineAt)}`}
            style={styles.deadlineBanner}
          />
        ) : null}

        {errorMessage ? (
          <View style={styles.inlineErrorBox}>
            <Text style={styles.inlineErrorText}>{errorMessage}</Text>
          </View>
        ) : null}

        {actionMessage ? (
          <View
            style={[
              styles.inlineErrorBox,
              actionMessage.type === "success"
                ? styles.inlineSuccessBox
                : undefined,
            ]}
          >
            <Text
              style={[
                styles.inlineErrorText,
                actionMessage.type === "success"
                  ? styles.inlineSuccessText
                  : undefined,
              ]}
            >
              {actionMessage.text}
            </Text>
          </View>
        ) : null}

        {isPostTarget && contentPost ? (
          <PostTargetCard
            post={contentPost}
            onOpenPost={() =>
              router.push(`/posts/${contentPost.postId}` as any)
            }
          />
        ) : isReviewTarget && contentReview ? (
          <ReviewTargetCard review={contentReview} />
        ) : (
          <View style={styles.card}>
            <SectionTitle icon="receipt-outline" title="Đơn hàng liên quan" />
            <InfoRow label="Mã đơn hàng" value={order.orderCode || "Chưa có"} strong />
            <InfoRow label="Sản phẩm" value={order.productName || "Chưa có"} />
            <InfoRow label="Số lượng" value={String(order.quantity ?? "Chưa có")} />
            <InfoRow label="Giá trị giao dịch" value={formatCurrency(order.finalTotalAmount)} />
            <InfoRow label="Thời hạn khiếu nại" value={formatDateTime(order.disputeDeadlineUtc)} />
            {order.disputeWindowHours ? (
              <Text style={styles.helperText}>
                Thời hạn khiếu nại được áp dụng: {order.disputeWindowHours} giờ.
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
        )}

        <View style={styles.card}>
          <SectionTitle icon="people-outline" title="Các bên liên quan" />
          <PartyRow name={senderName} role="Người khiếu nại" tone={TONES.warning} />
          <PartyRow name={targetUserName} role="Người bị khiếu nại" tone={TONES.info} />
        </View>

        {appointmentContext ? (
          <View style={styles.card}>
            <SectionTitle
              icon="calendar-outline"
              title={appointmentTypeLabels[normalizeKey(appointmentContext.appointmentType)] || "Lịch hẹn liên quan"}
            />
            <InfoRow label="Thời gian hẹn" value={formatDateTime(appointmentContext.scheduledAt)} />
            {appointmentContext.location ? (
              <InfoRow label="Địa điểm" value={appointmentContext.location} />
            ) : null}
            <InfoRow label="Người mua có mặt" value={appointmentContext.buyerCheckAt ? formatDateTime(appointmentContext.buyerCheckAt) : "Chưa xác nhận"} />
            <InfoRow label="Người bán có mặt" value={appointmentContext.sellerCheckAt ? formatDateTime(appointmentContext.sellerCheckAt) : "Chưa xác nhận"} />
            {appointmentContext.lateThresholdAt ? (
              <InfoRow label="Mốc tính trễ hẹn" value={formatDateTime(appointmentContext.lateThresholdAt)} />
            ) : null}
            {appointmentContext.appointmentId ? (
              <TouchableOpacity
                style={styles.linkButton}
                onPress={() => router.push(`/appointments/${appointmentContext.appointmentId}` as any)}
              >
                <Ionicons name="calendar-outline" size={18} color={COLORS.primary} />
                <Text style={styles.linkButtonText}>Xem lịch hẹn</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        {inspectionContext ? (
          <View style={styles.card}>
            <SectionTitle icon="clipboard-outline" title="Phiếu kiểm định liên quan" />
            <InfoRow
              label="Hình thức"
              value={inspectionModeLabels[normalizeKey(inspectionContext.inspectionMode)] || "Chưa rõ"}
            />
            <InfoRow label="Trạng thái" value={translateInspectionStatus(inspectionContext.inspectionStatus)} />
            <InfoRow label="Kết luận" value={translateConclusion(inspectionContext.conclusion) || "Chưa có"} strong />
            {inspectionContext.operatingStatus != null ? (
              <InfoRow label="Hoạt động" value={translateOperatingStatus(inspectionContext.operatingStatus) || "Chưa có"} />
            ) : null}
            {inspectionContext.appearanceStatus != null ? (
              <InfoRow label="Ngoại quan" value={translateAppearanceStatus(inspectionContext.appearanceStatus) || "Chưa có"} />
            ) : null}
            {inspectionContext.partsStatus != null ? (
              <InfoRow label="Linh kiện" value={translatePartsStatus(inspectionContext.partsStatus) || "Chưa có"} />
            ) : null}
            {inspectionContext.matchStatus != null ? (
              <InfoRow label="Khớp mô tả" value={translateMatchStatus(inspectionContext.matchStatus) || "Chưa có"} />
            ) : null}
            {inspectionContext.inspectorNotes ? (
              <>
                <Text style={styles.descriptionLabel}>Ghi chú kiểm định</Text>
                <Text style={styles.descriptionText}>{inspectionContext.inspectorNotes}</Text>
              </>
            ) : null}
            {inspectionContext.sellerDecisionReason ? (
              <>
                <Text style={styles.descriptionLabel}>Lý do người bán từ chối</Text>
                <Text style={styles.descriptionText}>{inspectionContext.sellerDecisionReason}</Text>
              </>
            ) : null}
            {inspectionImages.length > 0 ? (
              <>
                <Text style={styles.descriptionLabel}>Ảnh kiểm định</Text>
                <EvidenceGrid images={inspectionImages} />
              </>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <SectionTitle icon="document-text-outline" title="Nội dung khiếu nại" />
          <Text style={[styles.descriptionText, styles.descriptionSpacing]}>
            {detail.description || "Không có mô tả."}
          </Text>
          <InfoRow label="Ngày gửi" value={formatDateTime(detail.createdAt)} />
          <InfoRow label="Cập nhật" value={formatDateTime(detail.updatedAt)} />
          {detail.resolvedAt ? (
            <InfoRow label="Ngày xử lý" value={formatDateTime(detail.resolvedAt)} />
          ) : null}
        </View>

        <View style={styles.card}>
          <SectionTitle icon="images-outline" title="Ảnh bằng chứng của bên khiếu nại" />
          {evidenceImages.length > 0 ? (
            <EvidenceGrid images={evidenceImages} />
          ) : (
            <Text style={styles.emptyText}>
              {isSystemIncident
                ? "Sự cố do hệ thống ghi nhận, bằng chứng lấy từ dữ liệu lịch hẹn và giao dịch."
                : "Không có ảnh bằng chứng để hiển thị."}
            </Text>
          )}
        </View>

        {responses.length > 0 ? (
          <View style={styles.card}>
            <SectionTitle icon="chatbubbles-outline" title="Phản hồi của các bên" />
            {responses.map((item: any, index: number) => {
              const responseImages = Array.isArray(item?.evidenceImages) ? item.evidenceImages : [];
              return (
                <View
                  key={item?.disputeResponseId || `response-${index}`}
                  style={[styles.responseItem, index > 0 ? styles.responseDivider : undefined]}
                >
                  <View style={styles.responseHeader}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{getInitial(item?.responder?.username)}</Text>
                    </View>
                    <View style={styles.responseHeaderBody}>
                      <Text style={styles.responseName} numberOfLines={1}>
                        {item?.responder?.username || "Người dùng"}
                      </Text>
                      <Text style={styles.responseMeta}>{formatDateTime(item?.createdAt)}</Text>
                    </View>
                    <View style={styles.responseTypeChip}>
                      <Ionicons
                        name={responseTypeIcons[normalizeKey(item?.responseType)] || "chatbox"}
                        size={12}
                        color={COLORS.primary}
                      />
                      <Text style={styles.responseTypeText}>
                        {responseTypeLabels[normalizeKey(item?.responseType)] || "Phản hồi"}
                      </Text>
                    </View>
                  </View>
                  {item?.content ? <Text style={styles.responseBubble}>{item.content}</Text> : null}
                  {responseImages.length > 0 ? (
                    <View style={styles.responseImages}>
                      <EvidenceGrid images={responseImages} />
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {hasResponseActions ? (
          <View style={styles.card}>
            <SectionTitle icon="create-outline" title="Phản hồi của bạn" />
            {canAccept && proposedOutcomeLabel ? (
              <Text style={styles.helperText}>
                Bên khiếu nại đề xuất: {proposedOutcomeLabel.toLowerCase()}.
              </Text>
            ) : null}
            <Text style={styles.helperText}>
              {canSubmitStatement && !canAccept && !canRebut
                ? "Bạn có thể gửi tường trình về sự cố lịch hẹn để kiểm duyệt viên xem xét."
                : canAccept
                  ? "Đồng ý thì tranh chấp được giải quyết ngay theo đề xuất trên. Phản biện thì tranh chấp được chuyển cho kiểm duyệt viên."
                  : "Phản biện thì tranh chấp được chuyển cho kiểm duyệt viên xem xét."}
            </Text>
            {canAccept ? (
              <TouchableOpacity style={styles.primaryActionButton} onPress={() => setResponseMode("accept")}>
                <Ionicons name="checkmark-circle-outline" size={19} color={COLORS.white} />
                <Text style={styles.primaryActionText}>Đồng ý</Text>
              </TouchableOpacity>
            ) : null}
            {canRebut ? (
              <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setResponseMode("rebut")}>
                <Ionicons name="chatbox-ellipses-outline" size={19} color={COLORS.primary} />
                <Text style={styles.secondaryActionText}>Phản biện</Text>
              </TouchableOpacity>
            ) : null}
            {canSubmitStatement ? (
              <TouchableOpacity style={styles.secondaryActionButton} onPress={() => setResponseMode("statement")}>
                <Ionicons name="document-text-outline" size={19} color={COLORS.primary} />
                <Text style={styles.secondaryActionText}>Gửi tường trình</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <SectionTitle icon="ribbon-outline" title="Kết quả xử lý" />
          {outcomeLabel ? <InfoRow label="Kết luận" value={outcomeLabel} strong /> : null}
          {resolutionSourceLabel ? <InfoRow label="Cách giải quyết" value={resolutionSourceLabel} /> : null}
          {detail.moderatorNote ? (
            <>
              <Text style={styles.descriptionLabel}>Ghi chú của kiểm duyệt viên</Text>
              <Text style={styles.descriptionText}>{detail.moderatorNote}</Text>
            </>
          ) : !outcomeLabel && !resolutionSourceLabel ? (
            <View style={styles.emptyState}>
              <Ionicons name="hourglass-outline" size={20} color={COLORS.textLight} />
              <Text style={styles.emptyText}>Tranh chấp chưa có kết quả xử lý.</Text>
            </View>
          ) : null}
        </View>

        {timeline.length > 0 ? (
          <View style={styles.card}>
            <SectionTitle icon="git-commit-outline" title="Diễn biến" />
            {timeline.map((step: any, index: number) => (
              <View key={`${step?.code || "step"}-${index}`} style={styles.timelineItem}>
                <View style={styles.timelineRail}>
                  <View
                    style={[
                      styles.timelineDot,
                      index === timeline.length - 1 ? styles.timelineDotCurrent : undefined,
                    ]}
                  />
                  {index < timeline.length - 1 ? <View style={styles.timelineLine} /> : null}
                </View>
                <View style={styles.timelineBody}>
                  <Text style={styles.timelineTitle}>{step?.title || "Cập nhật"}</Text>
                  {step?.description ? (
                    <Text style={styles.timelineDescription}>{formatIsoInText(String(step.description))}</Text>
                  ) : null}
                  <Text style={styles.timelineTime}>{formatDateTime(step?.occurredAt)}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {canCloseDispute ? (
          <View style={styles.card}>
            <SectionTitle icon="settings-outline" title="Thao tác" />
            <Text style={styles.helperText}>
              Chỉ nên đóng khi bạn không còn muốn tiếp tục yêu cầu xử lý tranh
              chấp này.
            </Text>
            <TouchableOpacity
              style={styles.closeDisputeButton}
              onPress={openCloseModal}
            >
              <Ionicons name="close-circle-outline" size={19} color="#7A1012" />
              <Text style={styles.closeDisputeButtonText}>Đóng tranh chấp</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={isCloseModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeCloseModal}
      >
        <ModalBackdrop
          style={styles.closeModalBackdrop}
          onPress={closeCloseModal}
          disabled={isClosing}
        >
          <ModalSurface style={styles.closeModalCard}>
            <Text style={styles.closeModalTitle}>Đóng tranh chấp?</Text>
            <Text style={styles.closeModalText}>
              Yêu cầu xử lý sẽ dừng lại và không còn được tiếp tục xem xét.
              Chỉ thực hiện thao tác này khi bạn chủ động muốn rút lại tranh
              chấp.
            </Text>

            {closeError ? (
              <Text style={styles.closeModalError}>{closeError}</Text>
            ) : null}

            <View style={styles.closeModalActions}>
              <TouchableOpacity
                style={styles.closeModalBackButton}
                onPress={closeCloseModal}
                disabled={isClosing}
              >
                <Text style={styles.closeModalBackButtonText}>Quay lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.closeModalConfirmButton}
                onPress={() => void handleCloseDispute()}
                disabled={isClosing}
              >
                {isClosing ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.closeModalConfirmButtonText}>
                    Đóng tranh chấp
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </ModalSurface>
        </ModalBackdrop>
      </Modal>

      <DisputeResponseModal
        disputeId={String(disputeId || "")}
        mode={responseMode}
        onClose={() => setResponseMode(null)}
        onSubmitted={(nextDetail, mode) => {
          setResponseMode(null);
          if (nextDetail && typeof nextDetail === "object" && nextDetail.disputeId) setDetail(nextDetail);
          void loadDetail({ silent: true });
          setActionMessage({
            type: "success",
            text:
              mode === "accept"
                ? "Bạn đã đồng ý. Tranh chấp được giải quyết theo đề xuất."
                : mode === "rebut"
                  ? "Đã gửi phản biện. Tranh chấp được chuyển cho kiểm duyệt viên."
                  : "Đã gửi tường trình.",
          });
        }}
      />
    </SafeAreaView>
  );
}

// Ô ảnh kích thước cố định; ảnh không tải được thì hiện ô báo lỗi thay vì khoảng trắng lớn.
function EvidenceThumb({ url }: { url: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <View style={[styles.evidenceImage, styles.evidenceFallback]}>
        <Ionicons name="image-outline" size={22} color={COLORS.textLight} />
        <Text style={styles.evidenceFallbackText}>Không tải được ảnh</Text>
      </View>
    );
  }
  return <Image source={{ uri: url }} style={styles.evidenceImage} onError={() => setFailed(true)} />;
}

function EvidenceGrid({ images }: { images: any[] }) {
  return (
    <View style={styles.evidenceGrid}>
      {images.map((item: any, index: number) => {
        const url = getImageUrl(item);
        if (!url) return null;
        return <EvidenceThumb key={item?.mediaId || item?.MediaId || `${url}-${index}`} url={url} />;
      })}
    </View>
  );
}

function SectionTitle({
  icon,
  title,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionIcon}>
        <Ionicons name={icon} size={16} color={COLORS.primary} />
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function PartyRow({ name, role, tone }: { name: string; role: string; tone: Tone }) {
  return (
    <View style={styles.partyRow}>
      <View style={[styles.avatar, { backgroundColor: tone.background }]}>
        <Text style={[styles.avatarText, { color: tone.color }]}>{getInitial(name)}</Text>
      </View>
      <Text style={styles.partyName} numberOfLines={1}>{name}</Text>
      <View style={[styles.partyRoleChip, { backgroundColor: tone.background }]}>
        <Text style={[styles.partyRoleText, { color: tone.color }]}>{role}</Text>
      </View>
    </View>
  );
}

// Original CONTENT images (target.post.images / target.review.images) are
// rendered here, kept fully separate from the reporter's "Ảnh bằng chứng"
// (detail.evidenceImages) section above — never merged into one gallery.
function ContentImageGrid({
  images,
  emptyText,
}: {
  images: any[];
  emptyText: string;
}) {
  if (images.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return (
    <View style={styles.evidenceGrid}>
      {images.map((item: any, index: number) => {
        const url = item?.url || item?.Url;
        if (!url) return null;
        return (
          <EvidenceThumb key={item?.mediaId || item?.MediaId || `${url}-${index}`} url={url} />
        );
      })}
    </View>
  );
}

function PostTargetCard({
  post,
  onOpenPost,
}: {
  post: any;
  onOpenPost: () => void;
}) {
  const images = Array.isArray(post?.images) ? post.images : [];
  const statusLabel = postStatusLabels[normalizeKey(post?.status)] || "Chưa rõ";
  const postTypeLabel = postTypeLabels[normalizeKey(post?.postType)] || null;

  return (
    <View style={styles.card}>
      <SectionTitle icon="newspaper-outline" title="Bài đăng bị báo cáo" />
      <InfoRow label="Sản phẩm" value={post?.productName || "Chưa có"} strong />
      {postTypeLabel ? <InfoRow label="Loại tin" value={postTypeLabel} /> : null}
      <InfoRow
        label="Giá"
        value={isBuyPostType(post?.postType) ? formatBuyPostPrice(post) : formatCurrency(post?.basePrice)}
      />
      <InfoRow label="Trạng thái hiện tại" value={statusLabel} />
      <InfoRow label="Ngày đăng" value={formatDateTime(post?.createdAt)} />
      <InfoRow label="Cập nhật" value={formatDateTime(post?.updatedAt)} />

      {post?.description ? (
        <>
          <Text style={styles.descriptionLabel}>Mô tả bài đăng</Text>
          <Text style={styles.descriptionText}>{post.description}</Text>
        </>
      ) : null}

      <ContentImageGrid images={images} emptyText="Bài đăng hiện không có ảnh." />

      {post?.postId ? (
        <TouchableOpacity style={styles.linkButton} onPress={onOpenPost}>
          <Ionicons name="cube-outline" size={18} color={COLORS.primary} />
          <Text style={styles.linkButtonText}>Xem bài đăng</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function ReviewTargetCard({ review }: { review: any }) {
  const images = Array.isArray(review?.images) ? review.images : [];
  const statusLabel =
    reviewStatusLabels[normalizeKey(review?.status)] || "Chưa rõ";
  const rating = Number(review?.rating);

  return (
    <View style={styles.card}>
      <SectionTitle icon="star-outline" title="Đánh giá bị báo cáo" />
      {Number.isFinite(rating) && rating > 0 ? (
        <InfoRow label="Số sao" value={`${rating}/5`} strong />
      ) : null}
      <InfoRow label="Trạng thái hiện tại" value={statusLabel} />
      <InfoRow label="Ngày đánh giá" value={formatDateTime(review?.createdAt)} />
      {/* orderId is contextual only — never treated as an Order dispute. */}
      <InfoRow
        label="Thuộc đơn hàng"
        value={review?.orderId ? String(review.orderId) : "Chưa có"}
      />

      {review?.comment ? (
        <>
          <Text style={styles.descriptionLabel}>Nội dung đánh giá</Text>
          <Text style={styles.descriptionText}>{review.comment}</Text>
        </>
      ) : null}

      <ContentImageGrid images={images} emptyText="Đánh giá hiện không có ảnh." />
    </View>
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
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    gap: 12,
  },
  headerTopRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerEyebrow: { color: COLORS.textLight, fontSize: 12, fontWeight: "600" },
  headerStatus: { fontSize: 18, fontWeight: "800", marginTop: 2 },
  headerChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  headerChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "100%",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: COLORS.white,
  },
  headerChipText: { color: COLORS.text, fontSize: 12, fontWeight: "600", flexShrink: 1 },
headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  headerContent: { flex: 1 },

disputeIdText: { color: COLORS.textLight, fontSize: 12 },

  deadlineBanner: { marginBottom: 12 },
responseItem: { paddingVertical: 12 },
  responseDivider: { borderTopWidth: 1, borderTopColor: COLORS.border },
responseHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  responseHeaderBody: { flex: 1 },
  responseName: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  responseTypeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(84, 123, 125, 0.12)",
  },
  responseTypeText: { color: COLORS.primary, fontSize: 11, fontWeight: "800" },
  responseBubble: {
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 21,
    backgroundColor: "#F3F6F6",
    borderRadius: 12,
    borderTopLeftRadius: 4,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginLeft: 46,
  },
  responseImages: { marginLeft: 46, marginTop: 10 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(84, 123, 125, 0.14)",
  },
  avatarText: { color: COLORS.primary, fontSize: 15, fontWeight: "800" },
  partyRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  partyName: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: "700" },
  partyRoleChip: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  partyRoleText: { fontSize: 11, fontWeight: "800" },
responseMeta: { color: COLORS.textLight, fontSize: 12, marginTop: 2 },
timelineItem: { flexDirection: "row", gap: 12 },
  timelineRail: { width: 12, alignItems: "center" },
  timelineLine: { flex: 1, width: 2, backgroundColor: COLORS.border, marginVertical: 2 },
timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.border,
    marginTop: 5,
  },
  timelineDotCurrent: {
    backgroundColor: COLORS.primary,
    borderWidth: 3,
    borderColor: "rgba(84, 123, 125, 0.25)",
    width: 14,
    height: 14,
    borderRadius: 7,
    marginTop: 3,
  },
timelineBody: { flex: 1, paddingBottom: 14 },
  timelineTitle: { color: COLORS.text, fontSize: 14, fontWeight: "600" },
  timelineDescription: { color: COLORS.textLight, fontSize: 13, lineHeight: 19, marginTop: 2 },
  timelineTime: { color: COLORS.textLight, fontSize: 12, marginTop: 2 },
  primaryActionButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  primaryActionText: { color: COLORS.white, fontSize: 14, fontWeight: "800" },
  secondaryActionButton: {
    marginTop: 10,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryActionText: { color: COLORS.primary, fontSize: 14, fontWeight: "800" },


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
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingBottom: 10,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#E3E8E8",
  },
  sectionIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(84, 123, 125, 0.10)",
  },
  sectionTitle: { flex: 1, fontSize: 15, fontWeight: "800", color: COLORS.text },
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
evidenceGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
evidenceImage: {
    width: 92,
    height: 92,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#EEF2F2",
  },
  evidenceFallback: { alignItems: "center", justifyContent: "center", gap: 4, padding: 6 },
  evidenceFallbackText: { color: COLORS.textLight, fontSize: 10, textAlign: "center" },
  descriptionSpacing: { marginBottom: 12 },
  emptyState: { flexDirection: "row", alignItems: "center", gap: 8 },
  emptyText: { color: COLORS.textLight, fontSize: 12, lineHeight: 18 },
  inlineSuccessBox: {
    backgroundColor: "rgba(47, 118, 93, 0.10)",
    borderColor: "rgba(47, 118, 93, 0.24)",
  },
  inlineSuccessText: { color: "#2F765D" },
  closeDisputeButton: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#7A1012",
    backgroundColor: "rgba(122, 16, 18, 0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  closeDisputeButtonText: {
    color: "#7A1012",
    fontSize: 14,
    fontWeight: "800",
  },
  closeModalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "rgba(23, 40, 48, 0.48)",
  },
  closeModalCard: {
    width: "100%",
    maxWidth: 380,
    padding: 18,
    borderRadius: 16,
    backgroundColor: COLORS.white,
  },
  closeModalTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 10,
  },
  closeModalText: {
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  closeModalError: {
    color: "#7A1012",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  closeModalActions: { flexDirection: "row", gap: 10 },
  closeModalBackButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  closeModalBackButtonText: { color: COLORS.text, fontWeight: "700" },
  closeModalConfirmButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#7A1012",
  },
  closeModalConfirmButtonText: { color: COLORS.white, fontWeight: "800" },
});
