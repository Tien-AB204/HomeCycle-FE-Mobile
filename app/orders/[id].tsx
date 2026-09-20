import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useChatRealtime } from "../../src/contexts/ChatRealtimeContext";
import {
  ActivityIndicator,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../../src/components/shared/Header";
import {
  ModalBackdrop,
  ModalSurface,
} from "../../src/components/shared/ModalBackdrop";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import { getPosterRoleLabel, isBuyPostType } from "../../src/utils/postType";
import { normalizeTargetType } from "../../src/services/notifications/notificationTargets";
import { useAutoDismissFeedback } from "../../src/utils/useAutoDismissFeedback";
import { useGuardedRouter } from "../../src/utils/tapGuard";
import { localizeSystemText } from "../../src/utils/localizeSystemText";

type InlineMessage = {
  type: "error" | "warning" | "info" | "success";
  text: string;
} | null;

type TransactionRole = "buyer" | "seller" | null;
type PendingAction = "handover" | "received" | null;
type LifecycleAction = "cancel" | "confirmReturn" | "confirmReturnReceived" | null;
type DeliveryMethod =
  | "GhnDelivery"
  | "SellerDelivers"
  | "BuyerPickUp"
  | "Unknown";

// Đồng bộ GHN: tối đa 3 lần gọi mỗi chu kỳ, dừng ngay khi có phản hồi thành công.
const TRACKING_MAX_ATTEMPTS = 3;
const TRACKING_INITIAL_DELAY_MS = 4000;
const TRACKING_RETRY_DELAY_MS = 1500;
const NON_RETRYABLE_TRACKING_CODES = new Set([
  "order.notfound",
  "agreement.notfound",
  "shipment.notghndelivery",
]);
const RETRYABLE_TRACKING_CODES = new Set([
  "shipment.notfound",
  "shipment.ghnrecordnotfound",
  "shipment.ghnordercodemissing",
  "ghn.trackingchanged",
]);
const isRetryableTrackingError = (error: unknown): boolean => {
  const status = Number((error as any)?.response?.status || 0);
  const data = (error as any)?.response?.data;
  const code = String(data?.code ?? data?.error?.code ?? "").trim().toLowerCase();
  if (status === 401 || status === 403) return false;
  if (code && NON_RETRYABLE_TRACKING_CODES.has(code)) return false;
  if (code && RETRYABLE_TRACKING_CODES.has(code)) return true;
  // Không có phản hồi (mạng/hết thời gian chờ) hoặc lỗi máy chủ: tạm thời.
  if (!(error as any)?.response) return true;
  if (status >= 500) return true;
  return false;
};

const orderApi = {
  getOrderDetail: (orderId: string) =>
    apiClient.get(`/orders/${orderId}`).then((response) => response.data),
  getAgreement: (agreementId: string) =>
    apiClient.get(`/agreements/${agreementId}`).then((response) => response.data),
  getPost: (postId: string) =>
    apiClient.get(`/posts/get-by-id/${postId}`).then((response) => response.data),
  getShipmentTracking: (orderId: string) =>
    apiClient
      .get(`/orders/${orderId}/shipment-tracking`)
      .then((response) => response.data),
  confirmSellerReady: (shipmentId: string) =>
    apiClient
      .post(`/shipments/${shipmentId}/seller-ready`)
      .then((response) => response.data),
  confirmHandover: (orderId: string) =>
    apiClient
      .post(`/orders/${orderId}/confirm-handover`)
      .then((response) => response.data),
  confirmReceived: (orderId: string) =>
    apiClient
      .post(`/orders/${orderId}/confirm-received`)
      .then((response) => response.data),
  cancelOrder: (orderId: string) =>
    apiClient
      .post(`/orders/${orderId}/cancel`)
      .then((response) => response.data),
  confirmReturn: (orderId: string) =>
    apiClient
      .post(`/orders/${orderId}/confirm-return`)
      .then((response) => response.data),
  confirmReturnReceived: (orderId: string) =>
    apiClient
      .post(`/orders/${orderId}/confirm-return-received`)
      .then((response) => response.data),
};

const unwrap = (value: any) => value?.data ?? value;

const normalizeStatus = (value: unknown) =>
  String(value ?? "")
    .replace(/[\s_-]/g, "")
    .toLowerCase();

const normalizeDeliveryMethod = (value: unknown): DeliveryMethod => {
  const normalized = normalizeStatus(value);
  if (normalized === "1" || normalized === "ghndelivery") return "GhnDelivery";
  if (normalized === "2" || normalized === "sellerdelivers") return "SellerDelivers";
  if (normalized === "3" || normalized === "buyerpickup") return "BuyerPickUp";
  return "Unknown";
};

const translateDeliveryMethod = (method: DeliveryMethod) => {
  switch (method) {
    case "GhnDelivery":
      return "Dịch vụ giao hàng GHN";
    case "SellerDelivers":
      return "Bên bán tự giao";
    case "BuyerPickUp":
      return "Bên mua đến lấy";
    default:
      return "Chưa cập nhật";
  }
};

const translateRelatedAppointmentType = (value: unknown) => {
  const normalized = normalizeStatus(value);
  return normalized === "1" || normalized === "collection"
    ? "Lịch thu gom"
    : "Lịch kiểm định";
};

const HIDDEN_ORDER_TIMELINE_CODES = new Set([
  "collectionschedule",
  "inspectionscheduled",
  // Dispute is an exception branch, not a mandatory happy-path step —
  // it has its own dedicated warning card below the timeline instead.
  "dispute",
]);

const findActiveTimelineText = (steps: any[]): string => {
  for (const step of steps) {
    const status = normalizeStatus(step?.status);
    if (status === "inprogress" || status === "1") {
      return (
        sanitizeTimelineText(step?.description) ||
        sanitizeTimelineText(step?.title) ||
        ""
      );
    }
    if (Array.isArray(step?.subSteps) && step.subSteps.length > 0) {
      const nested = findActiveTimelineText(step.subSteps);
      if (nested) return nested;
    }
  }
  return "";
};

const filterOrderTimelineForDisplay = (steps: any[]): any[] =>
  steps
    .filter(
      (step) =>
        !HIDDEN_ORDER_TIMELINE_CODES.has(
          normalizeStatus(step?.code),
        ),
    )
    .map((step) => {
      const subSteps = Array.isArray(step?.subSteps)
        ? filterOrderTimelineForDisplay(step.subSteps)
        : [];

      return {
        ...step,
        subSteps,
      };
    });

// Presentation only: when the order is already completed, omit stale
// Upcoming/InProgress milestones instead of pretending they completed or
// inventing timestamps. Surviving substeps are promoted if their parent is stale.
const filterPendingTimelineAfterCompletion = (
  steps: any[],
  completed: boolean,
): any[] => {
  if (!completed) return steps;

  return steps.flatMap((step) => {
    const subSteps = Array.isArray(step?.subSteps)
      ? filterPendingTimelineAfterCompletion(
          step.subSteps,
          true,
        )
      : [];

    const status = normalizeStatus(
      step?.status,
    );

    const isPending =
      status === "upcoming" ||
      status === "0" ||
      status === "inprogress" ||
      status === "1";

    if (isPending) {
      return subSteps;
    }

    return [
      {
        ...step,
        subSteps,
      },
    ];
  });
};

// Presentation only: omit an unconfirmed seller action once pickup has moved
// past it. Never infer completion or change authoritative status/timestamps.
const normalizePickupTimelineForDisplay = (
  steps: any[], completed: boolean, sellerHandoverConfirmedAt: unknown,
): any[] => {
  if (sellerHandoverConfirmedAt != null) return steps;
  const hasCompletedHandover = (items: any[]): boolean => items.some(step =>
    (["buyerreceived", "handover", "ordercompleted"].includes(normalizeStatus(step?.code)) &&
      isTimelineCompletedStatus(step?.status)) ||
    (Array.isArray(step?.subSteps) && hasCompletedHandover(step.subSteps)),
  );
  const handoverCompleted = completed || hasCompletedHandover(steps);
  if (!handoverCompleted) return steps;
  const copy = (items: any[]): any[] => items
    .filter(step => normalizeStatus(step?.code) !== "sellerhandover")
    .map(step => ({
    ...step,
    ...(Array.isArray(step?.subSteps) ? { subSteps: copy(step.subSteps) } : {}),
  }));
  return copy(steps);
};

const translateRelatedAppointmentStatus = (value: unknown) => {
  switch (normalizeStatus(value)) {
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
      return "Đang cập nhật";
  }
};

const translateCarrierStatus = (status: string) => {
  if (!status) return "Trạng thái vận chuyển đang được cập nhật";

  const map: Record<string, string> = {
    ready_to_pick: "Đã tạo vận đơn, đang chờ GHN lấy hàng",
    picking: "Nhân viên GHN đang đến lấy hàng",
    money_collect_picking: "GHN đang làm việc với người gửi",
    picked: "GHN đã lấy hàng thành công",
    storing: "Hàng đang được lưu tại kho GHN",
    transporting: "Hàng đang được luân chuyển",
    sorting: "Hàng đang được phân loại tại kho",
    delivering: "Nhân viên GHN đang giao hàng",
    money_collect_delivering: "GHN đang làm việc với người nhận",
    delivered: "Giao hàng thành công",
    delivery_fail: "Lần giao hàng chưa thành công",
    waiting_to_return: "Đang chờ xử lý hoàn hàng",
    return: "Đơn hàng đang được xử lý hoàn",
    return_transporting: "Hàng hoàn đang được luân chuyển",
    return_sorting: "Hàng hoàn đang được phân loại",
    returning: "GHN đang trả hàng cho người gửi",
    return_fail: "Trả hàng cho người gửi chưa thành công",
    returned: "Đã trả hàng thành công cho người gửi",
    cancel: "Vận đơn đã bị hủy",
    exception: "Đơn hàng đang được xử lý ngoại lệ",
    damage: "Hàng hóa bị hư hỏng",
    lost: "Hàng hóa bị thất lạc",
    scrap: "Hàng hóa đã được GHN ghi nhận tiêu hủy",
  };

  return map[status.toLowerCase()] || "Trạng thái vận chuyển đang được cập nhật";
};

const translateCreationStatus = (status: string) => {
  if (!status) return null;
  switch (status.toLowerCase()) {
    case "pending":
      return "Đang chờ tạo vận đơn GHN";
    case "processing":
      return "Đang tạo vận đơn...";
    case "failed":
      return "Chưa thể tạo vận đơn";
    case "uncertain":
      return "Hệ thống đang xác minh vận đơn";
    default:
      return null;
  }
};

export default function OrderDetailScreen() {
  const router = useGuardedRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const currentUserId = String(user?.userId || user?.id || "").toLowerCase();

  const {
    connection,
    reconnectVersion,
    joinOrder,
    leaveOrder,
  } = useChatRealtime();

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [agreement, setAgreement] = useState<any>(null);
  const [postContext, setPostContext] = useState<any>(null);
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>("Unknown");
  const [transactionRole, setTransactionRole] =
    useState<TransactionRole>(null);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const trackingRequestInFlightRef = useRef(false);
  const orderActionInFlightRef = useRef<string | null>(null);
  const trackingRequestGenerationRef = useRef(0);
  const [pageMessage, setPageMessage] = useState<InlineMessage>(null);
  useAutoDismissFeedback(pageMessage, () => setPageMessage(null));
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [isSellerReadyLoading, setIsSellerReadyLoading] = useState(false);
  const [isOrderTimelineExpanded, setOrderTimelineExpanded] = useState(true);
  const [showDisputeConfirmation, setShowDisputeConfirmation] = useState(false);
  const [showOverflowMenu, setShowOverflowMenu] = useState(false);
  const [lifecycleAction, setLifecycleAction] = useState<LifecycleAction>(null);
  const [isLifecycleActionLoading, setIsLifecycleActionLoading] = useState(false);
  const [lifecycleActionError, setLifecycleActionError] = useState<string | null>(null);

  const fetchOrderDetail = useCallback(async () => {
    if (!orderId) {
      setPageMessage({ type: "error", text: "Không tìm thấy mã đơn hàng." });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setPageMessage(null);
      setTrackingError(null);
      setPendingAction(null);

      const detailResponse = await orderApi.getOrderDetail(orderId);
      const rawOrder = unwrap(detailResponse);
      const responseData =
        rawOrder?.order
          ? rawOrder
          : rawOrder?.orderId
            ? {
                ...rawOrder,
                order: rawOrder,
                counterpartyName:
                  rawOrder?.counterparty?.username ||
                  "Đối tác",
              }
            : rawOrder;
      setData(responseData);

      const order = responseData?.order;

      if (order?.postId) {
        try {
          const postResponse = await orderApi.getPost(String(order.postId));
          setPostContext(unwrap(postResponse));
        } catch {
          setPostContext(null);
        }
      } else {
        setPostContext(null);
      }
      let nextAgreement: any = null;
      let nextDeliveryMethod: DeliveryMethod = "Unknown";
      let nextRole: TransactionRole = null;

      if (order?.agreementId) {
        try {
          const agreementResponse = await orderApi.getAgreement(order.agreementId);
          nextAgreement = unwrap(agreementResponse);
          setAgreement(nextAgreement);

          nextDeliveryMethod = normalizeDeliveryMethod(
            nextAgreement?.agreementDetails?.deliveryMethod,
          );
          setDeliveryMethod(nextDeliveryMethod);

          const sellerId = String(nextAgreement?.sellerId || "").toLowerCase();
          const buyerId = String(nextAgreement?.buyerId || "").toLowerCase();
          if (currentUserId && currentUserId === sellerId) nextRole = "seller";
          if (currentUserId && currentUserId === buyerId) nextRole = "buyer";
          setTransactionRole(nextRole);
        } catch (error) {
          setAgreement(null);
          setDeliveryMethod("Unknown");
          setTransactionRole(null);
          setPageMessage({
            type: "warning",
            text: getApiErrorMessage(
              error,
              "Không thể xác định phương thức giao nhận của đơn hàng.",
            ),
          });
        }
      } else {
        setAgreement(null);
        setDeliveryMethod("Unknown");
        setTransactionRole(null);
      }

      if (nextDeliveryMethod !== "GhnDelivery") {
        setTrackingData(null);
        setTrackingError(null);
        setIsTrackingLoading(false);
      }
    } catch (error: any) {
      const status = Number(error?.response?.status || 0);
      setPageMessage({
        type: "error",
        text:
          status >= 500
            ? "Không thể tải đơn hàng từ hệ thống lúc này. Vui lòng thử lại sau."
            : getApiErrorMessage(error, "Không thể tải dữ liệu đơn hàng lúc này."),
      });
      setData(null);
      setAgreement(null);
      setPostContext(null);
      setDeliveryMethod("Unknown");
      setTransactionRole(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, orderId]);

  useEffect(() => {
    const targetOrderId = String(orderId || "").trim();
    const generation = ++trackingRequestGenerationRef.current;

    let active = true;
    let timer: ReturnType<typeof setTimeout> | undefined;

    if (!targetOrderId || deliveryMethod !== "GhnDelivery" || !data) {
      if (deliveryMethod !== "GhnDelivery") {
        setTrackingData(null);
        setTrackingError(null);
      }
      setIsTrackingLoading(false);

      return () => {
        active = false;
        if (timer) clearTimeout(timer);
      };
    }

    // Base Order Detail renders first. Wait for GHN/worker state to settle.
    setIsTrackingLoading(true);
    setTrackingError(null);

    // Mỗi chu kỳ tối đa 3 lần gọi shipment-tracking (không phải 1 + 3 lần thử lại):
    // thành công (kể cả isStale = true, là phản hồi hợp lệ) → dừng ngay; chỉ thử lại
    // lỗi tạm thời; lỗi cố định (401/403/không phải GHN/không tìm thấy đơn) → dừng.
    let attempt = 0;

    const runTrackingRequest = async () => {
      if (!active || generation !== trackingRequestGenerationRef.current) {
        return;
      }

      if (trackingRequestInFlightRef.current) {
        timer = setTimeout(() => {
          void runTrackingRequest();
        }, 500);
        return;
      }

      attempt += 1;
      trackingRequestInFlightRef.current = true;
      let scheduleRetry = false;

      try {
        const trackResponse =
          await orderApi.getShipmentTracking(targetOrderId);

        if (!active || generation !== trackingRequestGenerationRef.current) {
          return;
        }

        setTrackingData(unwrap(trackResponse));
        setTrackingError(null);
      } catch (error) {
        if (!active || generation !== trackingRequestGenerationRef.current) {
          return;
        }

        if (attempt < TRACKING_MAX_ATTEMPTS && isRetryableTrackingError(error)) {
          scheduleRetry = true;
          return;
        }

        setTrackingData(null);
        setTrackingError(
          "Không thể đồng bộ GHN lúc này. Thông tin đơn hàng vẫn được giữ nguyên.",
        );
      } finally {
        trackingRequestInFlightRef.current = false;

        if (active && generation === trackingRequestGenerationRef.current) {
          if (scheduleRetry) {
            timer = setTimeout(() => {
              void runTrackingRequest();
            }, TRACKING_RETRY_DELAY_MS);
          } else {
            setIsTrackingLoading(false);
          }
        }
      }
    };

    timer = setTimeout(() => {
      void runTrackingRequest();
    }, TRACKING_INITIAL_DELAY_MS);

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
    };
  }, [data, deliveryMethod, orderId]);

  useFocusEffect(
    useCallback(() => {
      void fetchOrderDetail();
    }, [fetchOrderDetail]),
  );

  useEffect(() => {
    if (!connection || !orderId) return;

    const currentOrderId = String(orderId).trim().toLowerCase();
    let active = true;
    let pending = false;
    let running = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      if (running || !active) return;
      running = true;
      do {
        pending = false;
        await fetchOrderDetail();
      } while (active && pending);
      running = false;
    };
    const scheduleRefresh = () => {
      pending = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { if (pending) void refresh(); }, 150);
    };
    const handleNotification = (event: any) => {
      if (normalizeTargetType(event?.targetType ?? event?.TargetType) !== "order") return;
      if (String(event?.targetId ?? event?.TargetId ?? "").trim().toLowerCase() !== currentOrderId) return;
      scheduleRefresh();
    };

    const handleOrderTrackingUpdated = (payload: {
      orderId?: string;
      OrderId?: string;
    }) => {
      const eventOrderId = String(
        payload?.orderId ?? payload?.OrderId ?? "",
      )
        .trim()
        .toLowerCase();

      if (!eventOrderId || eventOrderId !== currentOrderId) {
        return;
      }

      scheduleRefresh();
    };

    connection.on(
      "OrderTrackingUpdated",
      handleOrderTrackingUpdated,
    );
    connection.on("NotificationCreated", handleNotification);

    void joinOrder(String(orderId)).catch(() => {
      // Order Detail vẫn dùng dữ liệu API nếu realtime tạm thời chưa join được.
    });

    return () => {
      active = false;
      if (timer) clearTimeout(timer);
      connection.off("NotificationCreated", handleNotification);
      connection.off(
        "OrderTrackingUpdated",
        handleOrderTrackingUpdated,
      );

      void leaveOrder(String(orderId));
    };
  }, [
    connection,
    fetchOrderDetail,
    joinOrder,
    leaveOrder,
    orderId,
  ]);

  useEffect(() => {
    if (!orderId || reconnectVersion <= 0) return;

    void fetchOrderDetail();
  }, [fetchOrderDetail, orderId, reconnectVersion]);

  const handleConfirmSellerReady = async () => {
    if (isSellerReadyLoading || orderActionInFlightRef.current) return;

    if (!canConfirmSellerReady) {
      setPageMessage({
        type: "warning",
        text: "Thao tác này hiện không khả dụng.",
      });
      return;
    }

    if (!shipmentId) {
      setPageMessage({
        type: "error",
        text: "Chưa thể xác định thông tin vận chuyển để xác nhận.",
      });
      return;
    }

    const lockKey = `seller-ready:${shipmentId}`;
    orderActionInFlightRef.current = lockKey;

    try {
      setIsSellerReadyLoading(true);
      setPageMessage(null);

      await orderApi.confirmSellerReady(shipmentId);

      setPageMessage({
        type: "success",
        text: "Đã xác nhận hàng sẵn sàng để giao.",
      });

      await fetchOrderDetail();
    } catch (error) {
      setPageMessage({
        type: "error",
        text: getApiErrorMessage(
          error,
          "Chưa thể xác nhận hàng đã sẵn sàng lúc này.",
        ),
      });
    } finally {
      if (orderActionInFlightRef.current === lockKey) {
        orderActionInFlightRef.current = null;
      }
      setIsSellerReadyLoading(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!orderId || !pendingAction || isActionLoading || orderActionInFlightRef.current) return;

    const action = pendingAction;
    const lockKey = `${action}:${orderId}`;
    orderActionInFlightRef.current = lockKey;

    try {
      setIsActionLoading(true);
      setPageMessage(null);

      if (action === "handover") {
        await orderApi.confirmHandover(orderId);
        setPageMessage({
          type: "success",
          text: "Đã xác nhận bàn giao hàng. Đơn hàng vẫn chờ người mua xác nhận đã nhận.",
        });
      } else {
        await orderApi.confirmReceived(orderId);
        setPageMessage({
          type: "success",
          text: "Đã xác nhận nhận hàng. Đơn hàng đã được hoàn thành.",
        });
      }

      setPendingAction(null);
      await fetchOrderDetail();
    } catch (error) {
      setPageMessage({
        type: "error",
        text: getApiErrorMessage(
          error,
          action === "handover"
            ? "Chưa thể xác nhận bàn giao hàng."
            : "Chưa thể xác nhận đã nhận hàng.",
        ),
      });
    } finally {
      if (orderActionInFlightRef.current === lockKey) {
        orderActionInFlightRef.current = null;
      }
      setIsActionLoading(false);
    }
  };

  const openLifecycleAction = (action: LifecycleAction) => {
    if (isLifecycleActionLoading) return;
    setLifecycleActionError(null);
    setLifecycleAction(action);
  };

  const closeLifecycleAction = () => {
    if (isLifecycleActionLoading) return;
    setLifecycleAction(null);
    setLifecycleActionError(null);
  };

  const handleLifecycleAction = async () => {
    if (!orderId || !lifecycleAction || isLifecycleActionLoading || orderActionInFlightRef.current) return;

    const action = lifecycleAction;
    const lockKey = `${action}:${orderId}`;
    orderActionInFlightRef.current = lockKey;

    try {
      setIsLifecycleActionLoading(true);
      setLifecycleActionError(null);

      if (action === "cancel") {
        await orderApi.cancelOrder(orderId);
      } else if (action === "confirmReturn") {
        await orderApi.confirmReturn(orderId);
      } else {
        await orderApi.confirmReturnReceived(orderId);
      }

      setLifecycleAction(null);
      await fetchOrderDetail();

      setPageMessage({
        type: "success",
        text:
          action === "cancel"
            ? "Đã hủy đơn hàng."
            : action === "confirmReturn"
              ? "Đã xác nhận trả hàng."
              : "Đã xác nhận nhận lại hàng trả về.",
      });
    } catch (error) {
      setLifecycleActionError(
        getApiErrorMessage(
          error,
          action === "cancel"
            ? "Không thể hủy đơn hàng lúc này."
            : action === "confirmReturn"
              ? "Không thể xác nhận đã trả hàng lúc này."
              : "Không thể xác nhận đã nhận lại hàng lúc này.",
        ),
      );
    } finally {
      if (orderActionInFlightRef.current === lockKey) {
        orderActionInFlightRef.current = null;
      }
      setIsLifecycleActionLoading(false);
    }
  };

  const formatCurrency = (value: number) =>
    value !== undefined && value !== null
      ? new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
        }).format(value)
      : "0 đ";

  const formatDate = (dateString: string) => {
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

  const translatePaymentStatus = (status: number | string) => {
    switch (normalizeStatus(status)) {
      case "0":
      case "pending":
        return "Chưa thanh toán đủ / Đang cọc";
      case "1":
      case "completed":
      case "paid":
        return "Đã thanh toán toàn phần";
      case "2":
      case "failed":
        return "Thanh toán thất bại";
      case "3":
      case "refunded":
        return "Đã hoàn tiền";
      case "4":
      case "partiallyrefunded":
        return "Đã hoàn tiền một phần";
      case "5":
      case "expired":
        return "Đã hết hạn";
      case "6":
      case "cancelled":
      case "canceled":
        return "Đã hủy";
      default:
        return "Chưa rõ";
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết Đơn hàng" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data || !data.order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết Đơn hàng" showBack />
        <View style={styles.loadingContainer}>
          <Text style={styles.loadErrorText}>
            {pageMessage?.text || "Không tìm thấy đơn hàng."}
          </Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => void fetchOrderDetail()}
          >
            <Text style={styles.backBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const order = data.order;
  const thumbnailUrl = data.thumbnailUrl;
  const productName =
    order.productName || data.postDescription || "Sản phẩm giao dịch";
  const counterpartyName = data?.counterparty?.username || order?.counterparty?.username || "Chưa có tên người dùng";
  const negotiationId = data.negotiationId;
  const postId = order.postId;
  const isBuyPost = isBuyPostType(postContext?.postType);
  const shipment = data.shipment;
  const dispute = data.dispute || {};
  const relatedAppointments = Array.isArray(order.appointments)
    ? order.appointments
    : Array.isArray(data.appointments)
      ? data.appointments
      : [];

  const estimatedShippingFee = Math.max(
    0,
    Number(
      data.shippingFee ??
        (order.finalTotalAmount || 0) - (order.originalTotalAmount || 0),
    ),
  );

  const rawOrderStatus = order.orderStatus ?? order.status ?? 0;
  const normalizedOrderStatus = normalizeStatus(rawOrderStatus);
  const currentStatusCode = Number(rawOrderStatus ?? 0);
  const isProcessing =
    currentStatusCode === 1 || normalizedOrderStatus === "processing";
  const isCancelled =
    currentStatusCode === 3 || normalizedOrderStatus === "cancelled";
  const isCompleted =
    currentStatusCode === 2 || normalizedOrderStatus === "completed";
  const rawOrderTimeline = Array.isArray(data?.timeline)
    ? data.timeline
    : Array.isArray(order?.timeline)
      ? order.timeline
      : [];

  const completedSafeTimeline =
    filterPendingTimelineAfterCompletion(
      rawOrderTimeline,
      isCompleted,
    );

  const displayTimeline = deliveryMethod === "BuyerPickUp"
    ? normalizePickupTimelineForDisplay(
        completedSafeTimeline,
        isCompleted,
        order.sellerHandoverConfirmedAt,
      )
    : completedSafeTimeline;
  const orderTimeline = filterOrderTimelineForDisplay(displayTimeline).flatMap(
    (step: any) =>
      deliveryMethod === "BuyerPickUp" &&
      normalizeStatus(step?.code) === "handover" &&
      Array.isArray(step?.subSteps) &&
      step.subSteps.length > 0
        ? step.subSteps
        : [step],
  );

  const compactTimelineStatusText =
    findActiveTimelineText(orderTimeline) ||
    (orderTimeline.length > 0
      ? sanitizeTimelineText(orderTimeline[orderTimeline.length - 1]?.title)
      : "");

  const hasActiveDispute = dispute?.hasActiveDispute === true;
  const latestDisputeId = dispute?.latestDisputeId;
  const canOpenDispute = hasActiveDispute && Boolean(latestDisputeId);
  const disputeStatusKey = normalizeStatus(dispute?.latestDisputeStatus);
  const disputeStatusText =
    disputeStatusKey === "0" || disputeStatusKey === "pending"
      ? "Đang chờ xử lý"
      : disputeStatusKey === "4" || disputeStatusKey === "underreview"
        ? "Đang được bộ phận kiểm duyệt xem xét"
        : disputeStatusKey === "5" || disputeStatusKey === "awaitingreturn"
          ? "Đang chờ hoàn trả"
          : null;
  const canCreateDispute =
    (data?.actions ?? order?.actions ?? {}).canDispute === true;

  const isGhn = deliveryMethod === "GhnDelivery";
  const creationStat = trackingData?.creationStatus;
  const trackingMsg = trackingData?.message;
  const trackingCode = trackingData?.trackingCode;
  const carrierStat = trackingData?.carrierStatus;
  const expectedDate =
    trackingData?.expectedDeliveryAt || shipment?.expectedDeliveryAt;
  const deliveredDate = trackingData?.deliveredAt || shipment?.deliveredAt;
  const lastSynced = trackingData?.lastSyncedAt;
  const isStaleData = trackingData?.isStale === true;
  const orderActions = data?.actions ?? order?.actions ?? {};
  const normalizedConfirmAction = normalizeStatus(orderActions.confirmAction);
  const canConfirmFromBackend = orderActions.canConfirm === true;
  const canConfirmSellerReady = orderActions.canConfirmSellerReady === true;
  const canCancelOrder = orderActions.canCancel === true;
  const canConfirmReturn = orderActions.canConfirmReturn === true;
  const canConfirmReturnReceived = orderActions.canConfirmReturnReceived === true;
  const showLifecycleActionsCard =
    canCancelOrder || canConfirmReturn || canConfirmReturnReceived;
  const shipmentId = String(shipment?.shipmentId ?? "").trim();
  const sellerReadyAt = shipment?.sellerReadyAt;
  const pickedUpAt = shipment?.pickedUpAt;

  const sellerAlreadyConfirmed = Boolean(order.sellerHandoverConfirmedAt);
  const buyerAlreadyConfirmed = Boolean(order.buyerReceivedConfirmedAt);

  const canConfirmHandover =
    canConfirmFromBackend &&
    (
      normalizedConfirmAction === "confirmhandover" ||
      normalizedConfirmAction === "handover" ||
      normalizedConfirmAction === "1"
    );

  const canConfirmReceived =
    canConfirmFromBackend &&
    (
      normalizedConfirmAction === "confirmreceived" ||
      normalizedConfirmAction === "received" ||
      normalizedConfirmAction === "2"
    );

  const shouldShowActionCard =
    !isCancelled &&
    (
      canConfirmFromBackend ||
      sellerAlreadyConfirmed ||
      buyerAlreadyConfirmed ||
      hasActiveDispute ||
      (isGhn && transactionRole === "seller" && isProcessing)
    );
  const postOwnerId = String(postContext?.ownerId || "").trim().toLowerCase();
  const counterpartyId = String(data?.counterparty?.userId || "").trim().toLowerCase();
  const currentUserName = String(
    user?.username || "Bạn",
  ).trim();
  const posterRoleLabel = getPosterRoleLabel(isBuyPost);
  const currentPartyRoles = transactionRole
    ? currentUserId && currentUserId === postOwnerId
      ? [posterRoleLabel]
      : [transactionRole === "seller" ? "Người bán" : "Người mua"]
    : [];
  const counterpartyRoles = transactionRole
    ? counterpartyId && counterpartyId === postOwnerId
      ? [posterRoleLabel]
      : [transactionRole === "seller" ? "Người mua" : "Người bán"]
    : [];

  const reviewSummary = data?.review ?? order?.review ?? {};
  const orderReviews = Array.isArray(data?.reviews)
    ? data.reviews
    : Array.isArray(order?.reviews)
      ? order.reviews
      : [];

  const ownReviewFromList = orderReviews.find(
    (review: any) =>
      String(review?.reviewerId ?? review?.ReviewerId ?? "")
        .trim()
        .toLowerCase() === currentUserId,
  );

  const ownReviewId = String(
    reviewSummary?.reviewId ??
      reviewSummary?.ReviewId ??
      ownReviewFromList?.reviewId ??
      ownReviewFromList?.ReviewId ??
      "",
  ).trim();

  const hasOwnReview =
    reviewSummary?.hasReviewed === true || Boolean(ownReviewId);

  const receivedReview = orderReviews.find(
    (review: any) =>
      String(review?.revieweeId ?? review?.RevieweeId ?? "")
        .trim()
        .toLowerCase() === currentUserId &&
      String(review?.reviewerId ?? review?.ReviewerId ?? "")
        .trim()
        .toLowerCase() !== currentUserId,
  );

  const receivedReviewId = String(
    receivedReview?.reviewId ?? receivedReview?.ReviewId ?? "",
  ).trim();

  const isSellBuyer =
    transactionRole === "buyer" &&
    Boolean(currentUserId) &&
    Boolean(postOwnerId) &&
    currentUserId !== postOwnerId;

  const isSellSeller =
    transactionRole === "seller" &&
    Boolean(currentUserId) &&
    Boolean(postOwnerId) &&
    currentUserId === postOwnerId;

  const reviewAction =
    isCompleted && orderId
      ? isSellBuyer
        ? {
            label: hasOwnReview ? "Xem đánh giá" : "Đánh giá",
            description: hasOwnReview
              ? "Bạn đã đánh giá giao dịch này. Bạn có thể xem lại đánh giá của mình."
              : "Đơn hàng đã hoàn thành. Bạn có thể đánh giá người đăng bài từ 1–5 sao, thêm nhận xét và tối đa 3 ảnh.",
            onPress: () =>
              router.push(
                hasOwnReview
                  ? (`/reviews/order/${orderId}?mode=view-own` as any)
                  : (`/reviews/order/${orderId}?mode=create` as any),
              ),
          }
        : isSellSeller && receivedReviewId
          ? {
              label: "Xem đánh giá",
              description:
                "Người mua đã đánh giá giao dịch này. Bạn có thể xem đánh giá đã nhận.",
              onPress: () =>
                router.push(`/reviews/${receivedReviewId}` as any),
            }
          : null
      : null;

  const renderDeliveryInfo = () => (
    <>
          <Text style={styles.sectionTitle}>Vận chuyển & Giao nhận</Text>
          <InfoRow
            label="Phương thức:"
            value={translateDeliveryMethod(deliveryMethod)}
            bold
          />

          {sellerReadyAt ? (
            <InfoRow
              label="Hàng sẵn sàng từ:"
              value={formatDate(sellerReadyAt)}
            />
          ) : null}

          {pickedUpAt ? (
            <InfoRow
              label="Đã lấy hàng lúc:"
              value={formatDate(pickedUpAt)}
            />
          ) : null}

          {trackingError ? (
            <View style={styles.inlineTrackingWarning}>
              <Ionicons name="warning-outline" size={16} color="#9A6418" />
              <Text style={styles.inlineTrackingWarningText}>{trackingError}</Text>
            </View>
          ) : null}

          {isTrackingLoading ? (
            <View style={styles.trackingLoadingBox}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text style={styles.trackingLoadingText}>
                Đang cập nhật trạng thái vận chuyển...
              </Text>
            </View>
          ) : isGhn ? (
            <>
              {isStaleData ? (
                <View style={styles.inlineTrackingWarning}>
                  <Ionicons name="warning-outline" size={16} color="#9A6418" />
                  <Text style={styles.inlineTrackingWarningText}>
                    Đây là trạng thái GHN được cập nhật gần nhất.
                  </Text>
                </View>
              ) : null}
              <InfoRow
                label="Trạng thái vận chuyển:"
                value={
                  creationStat && creationStat !== "Success"
                    ? translateCreationStatus(creationStat) || "Đang cập nhật"
                    : trackingMsg || translateCarrierStatus(carrierStat)
                }
                valueStyle={styles.primaryValue}
              />
              {trackingCode ? (
                <InfoRow label="Mã vận đơn GHN:" value={trackingCode} bold />
              ) : null}
              {expectedDate ? (
                <InfoRow label="Dự kiến giao:" value={formatDate(expectedDate)} />
              ) : null}
              {deliveredDate ? (
                <InfoRow
                  label="Thời gian GHN giao thành công:"
                  value={formatDate(deliveredDate)}
                />
              ) : null}
              {lastSynced ? (
                <Text style={styles.syncTimeText}>
                  Cập nhật lúc {formatDate(lastSynced)}
                </Text>
              ) : null}
            </>
          ) : null}

    </>
  );

  const overflowActions: { key: string; label: string; icon: React.ComponentProps<typeof Ionicons>["name"]; destructive?: boolean; onPress: () => void }[] = [];
  if (canOpenDispute) {
    overflowActions.push({
      key: "view-dispute",
      label: "Xem tranh chấp",
      icon: "document-text-outline",
      onPress: () => router.push(`/disputes/${latestDisputeId}` as any),
    });
  } else if (canCreateDispute) {
    overflowActions.push({
      key: "create-dispute",
      label: "Gửi khiếu nại",
      icon: "alert-circle-outline",
      destructive: true,
      onPress: () => setShowDisputeConfirmation(true),
    });
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title="Chi tiết Đơn hàng"
        showBack
        rightContent={
          overflowActions.length > 0 ? (
            <TouchableOpacity
              style={styles.overflowButton}
              accessibilityRole="button"
              accessibilityLabel="Tùy chọn khác"
              hitSlop={8}
              onPress={() => setShowOverflowMenu(true)}
            >
              <Ionicons name="ellipsis-vertical" size={22} color={COLORS.text} />
            </TouchableOpacity>
          ) : null
        }
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerStatusCard}>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerCardTitle}>Đơn hàng giao dịch</Text>
          </View>
          <Text style={styles.orderCodeText}>
            Mã đơn: <Text style={styles.boldText}>{order.orderCode}</Text>
          </Text>
        </View>

        {pageMessage ? (
          <View
            style={[
              styles.messageBox,
              pageMessage.type === "error"
                ? styles.errorMessageBox
                : pageMessage.type === "warning"
                  ? styles.warningMessageBox
                  : pageMessage.type === "success"
                    ? styles.successMessageBox
                    : styles.infoMessageBox,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                pageMessage.type === "error"
                  ? styles.errorMessageText
                  : pageMessage.type === "warning"
                    ? styles.warningMessageText
                    : pageMessage.type === "success"
                      ? styles.successMessageText
                      : styles.infoMessageText,
              ]}
            >
              {pageMessage.text}
            </Text>
          </View>
        ) : null}

        <View style={styles.card}>
          <TouchableOpacity
            style={styles.timelineSectionHeader}
            activeOpacity={0.7}
            onPress={() =>
              setOrderTimelineExpanded((previous) => !previous)
            }
          >
            <Text style={styles.timelineSectionTitle}>
              Tiến trình đơn hàng
            </Text>

            <Ionicons
              name={
                isOrderTimelineExpanded
                  ? "chevron-up"
                  : "chevron-down"
              }
              size={20}
              color={COLORS.primary}
            />
          </TouchableOpacity>

          {isOrderTimelineExpanded ? (
            orderTimeline.length > 0 ? (
              <View style={styles.timelineList}>
                {orderTimeline.map((step: any, index: number) => (
                  <OrderTimelineItem
                    key={`${String(step?.code ?? "step")}-${index}`}
                    step={step}
                    isLast={index === orderTimeline.length - 1}
                  />
                ))}
              </View>
            ) : (
              <Text style={styles.timelineEmptyText}>
                Tiến trình đơn hàng đang được cập nhật.
              </Text>
            )
          ) : orderTimeline.length > 0 ? (
            <View style={styles.compactTimelineWrap}>
              <CompactOrderTimeline steps={orderTimeline} />
              {compactTimelineStatusText ? (
                <Text style={styles.compactStatusSummary}>
                  {compactTimelineStatusText}
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thông tin Sản phẩm</Text>
          <TouchableOpacity
            style={styles.productRow}
            activeOpacity={postId ? 0.7 : 1}
            onPress={() => {
              if (postId) {
                router.push({
                  pathname: "/posts/[id]",
                  params: { id: postId, viewOnly: "true" },
                });
              }
            }}
          >
            {!isBuyPost ? (
              thumbnailUrl ? (
                <Image source={{ uri: thumbnailUrl }} style={styles.productImg} />
              ) : (
                <View style={styles.productImgPlaceholder}>
                  <Ionicons name="image-outline" size={24} color="#547B7D" />
                </View>
              )
            ) : null}
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {productName}
              </Text>
              <Text style={styles.productMeta}>Số lượng: {order.quantity || 1}</Text>
              <Text style={styles.productPrice}>
                {formatCurrency(order.originalTotalAmount)}
              </Text>
            </View>
            {postId ? (
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.textLight}
              />
            ) : null}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thanh toán chi tiết</Text>
          <InfoRow
            label="Giá trị sản phẩm:"
            value={formatCurrency(order.originalTotalAmount)}
          />
          <InfoRow
            label="Phí vận chuyển:"
            value={formatCurrency(estimatedShippingFee)}
          />
          <InfoRow
            label="Tổng giá trị đơn:"
            value={formatCurrency(order.finalTotalAmount)}
            bold
          />
          <InfoRow
            label="Đã thanh toán:"
            value={formatCurrency(order.amountPaid)}
            valueStyle={styles.paidText}
          />
          <InfoRow
            label="Còn lại cần thu:"
            value={formatCurrency(order.amountRemaining)}
            valueStyle={styles.remainingText}
          />

          <View style={styles.paymentStatusHighlight}>
            <Text style={styles.paymentStatusLabel}>Trạng thái thanh toán:</Text>
            <Text style={styles.paymentStatusValue}>
              {translatePaymentStatus(order.paymentStatus)}
            </Text>
          </View>
        </View>

        {canConfirmSellerReady ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Chuẩn bị giao hàng</Text>
            <Text style={styles.actionHint}>
              Xác nhận khi hàng đã được chuẩn bị xong và sẵn sàng để giao hoặc bàn giao.
            </Text>
            <TouchableOpacity
              style={[
                styles.actionButton,
                isSellerReadyLoading ? { opacity: 0.65 } : undefined,
              ]}
              onPress={() => void handleConfirmSellerReady()}
              disabled={isSellerReadyLoading}
            >
              {isSellerReadyLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <>
                  <Ionicons
                    name="cube-outline"
                    size={20}
                    color={COLORS.white}
                  />
                  <Text style={styles.actionButtonText}>Hàng đã sẵn sàng</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        ) : null}

        {relatedAppointments.length === 0 ? (
          <View style={styles.card}>
            {renderDeliveryInfo()}
          </View>
        ) : null}

        {relatedAppointments.length > 0 ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Lịch hẹn liên quan</Text>

            {relatedAppointments.map((appointmentItem: any, index: number) => {
              const relatedAppointmentId = appointmentItem?.appointmentId;
              if (!relatedAppointmentId) return null;

              return (
                <TouchableOpacity
                  key={String(relatedAppointmentId)}
                  style={[
                    styles.relatedAppointmentButton,
                    index > 0 ? styles.relatedAppointmentButtonSpaced : undefined,
                  ]}
                  onPress={() =>
                    router.push(("/appointments/" + relatedAppointmentId) as any)
                  }
                >
                  <View style={styles.relatedAppointmentIcon}>
                    <Ionicons
                      name="calendar-outline"
                      size={19}
                      color={COLORS.primary}
                    />
                  </View>

                  <View style={styles.relatedAppointmentContent}>
                    <Text style={styles.relatedAppointmentTitle}>
                      {translateRelatedAppointmentType(
                        appointmentItem?.appointmentType,
                      )}
                    </Text>
                    <Text style={styles.relatedAppointmentMeta}>
                      {translateRelatedAppointmentStatus(
                        appointmentItem?.appointmentStatus,
                      )}
                      {appointmentItem?.scheduledAt
                        ? " • " + formatDate(appointmentItem.scheduledAt)
                        : ""}
                    </Text>
                  </View>

                  <View style={styles.relatedAppointmentAction}>
                    <Text style={styles.relatedAppointmentActionText}>
                      Xem lịch hẹn
                    </Text>
                    <Ionicons
                      name="chevron-forward"
                      size={18}
                      color={COLORS.primary}
                    />
                  </View>
                </TouchableOpacity>
              );
            })}
            <View style={styles.relatedDeliverySection}>
              {renderDeliveryInfo()}
            </View>
          </View>
        ) : null}

        {shouldShowActionCard ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Xác nhận giao nhận</Text>

            {sellerAlreadyConfirmed ? (
              <StatusLine
                icon="checkmark-circle"
                text={`Người bán đã xác nhận bàn giao${
                  order.sellerHandoverConfirmedAt
                    ? ` lúc ${formatDate(order.sellerHandoverConfirmedAt)}`
                    : ""
                }.`}
              />
            ) : null}
            {buyerAlreadyConfirmed ? (
              <StatusLine
                icon="checkmark-circle"
                text={`Người mua đã xác nhận nhận hàng${
                  order.buyerReceivedConfirmedAt
                    ? ` lúc ${formatDate(order.buyerReceivedConfirmedAt)}`
                    : ""
                }.`}
              />
            ) : null}

            {hasActiveDispute ? (
              <Text style={styles.actionHintWarning}>
                Đơn hàng đang có tranh chấp nên tạm thời chưa thể xác nhận giao nhận.
              </Text>
            ) : null}

            {isGhn && transactionRole === "seller" && isProcessing ? (
              <Text style={styles.actionHint}>
                Đơn GHN không cần Người bán xác nhận bàn giao. Trạng thái giao thành công của GHN là bằng
                chứng giao hàng.
              </Text>
            ) : null}

            {pendingAction ? (
              <View style={styles.inlineConfirmBox}>
                <Text style={styles.inlineConfirmTitle}>
                  {pendingAction === "handover"
                    ? "Xác nhận bạn đã bàn giao hàng cho Người mua?"
                    : "Xác nhận bạn đã thực sự nhận hàng? Thao tác này sẽ hoàn thành đơn hàng."}
                </Text>
                <View style={styles.inlineConfirmActions}>
                  <TouchableOpacity
                    style={styles.cancelConfirmBtn}
                    onPress={() => setPendingAction(null)}
                    disabled={isActionLoading}
                  >
                    <Text style={styles.cancelConfirmText}>Hủy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryConfirmBtn}
                    onPress={() => void handleConfirmAction()}
                    disabled={isActionLoading}
                  >
                    {isActionLoading ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <Text style={styles.primaryConfirmText}>Xác nhận</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                {canConfirmHandover ? (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setPendingAction("handover")}
                  >
                    <Ionicons name="cube-outline" size={20} color={COLORS.white} />
                    <Text style={styles.actionButtonText}>Đã bàn giao hàng</Text>
                  </TouchableOpacity>
                ) : null}

                {canConfirmReceived ? (
                  <TouchableOpacity
                    style={styles.actionButton}
                    onPress={() => setPendingAction("received")}
                  >
                    <Ionicons
                      name="checkmark-done-outline"
                      size={20}
                      color={COLORS.white}
                    />
                    <Text style={styles.actionButtonText}>Đã nhận hàng</Text>
                  </TouchableOpacity>
                ) : null}
              </>
            )}
          </View>
        ) : null}

        {showLifecycleActionsCard ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Thao tác đơn hàng</Text>

            {canConfirmReturn ? (
              <TouchableOpacity
                style={styles.secondaryOutlineBtn}
                onPress={() => openLifecycleAction("confirmReturn")}
              >
                <Ionicons
                  name="return-up-back-outline"
                  size={19}
                  color={COLORS.primary}
                />
                <Text style={styles.secondaryOutlineBtnText}>
                  Xác nhận đã trả hàng
                </Text>
              </TouchableOpacity>
            ) : null}

            {canConfirmReturnReceived ? (
              <TouchableOpacity
                style={[
                  styles.secondaryOutlineBtn,
                  canConfirmReturn ? styles.actionSpacingTop : undefined,
                ]}
                onPress={() => openLifecycleAction("confirmReturnReceived")}
              >
                <Ionicons
                  name="checkmark-done-outline"
                  size={19}
                  color={COLORS.primary}
                />
                <Text style={styles.secondaryOutlineBtnText}>
                  Xác nhận đã nhận lại hàng
                </Text>
              </TouchableOpacity>
            ) : null}

            {canCancelOrder ? (
              <TouchableOpacity
                style={[
                  styles.outlineBtnDanger,
                  (canConfirmReturn || canConfirmReturnReceived)
                    ? styles.actionSpacingTop
                    : undefined,
                ]}
                onPress={() => openLifecycleAction("cancel")}
              >
                <Ionicons
                  name="close-circle-outline"
                  size={19}
                  color={COLORS.error}
                />
                <Text style={styles.outlineBtnDangerText}>Hủy đơn hàng</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Đối tác giao dịch</Text>
          {transactionRole ? (
            <View style={styles.participantList}>
              <View style={styles.participantRow}>
                <Text style={styles.participantName} numberOfLines={1}>{currentUserName}</Text>
                <Text style={styles.participantRoles}>{currentPartyRoles.join(" · ")}</Text>
              </View>
              <View style={styles.participantRow}>
                <Text style={styles.participantName} numberOfLines={1}>{counterpartyName}</Text>
                <Text style={styles.participantRoles}>{counterpartyRoles.join(" · ")}</Text>
              </View>
            </View>
          ) : (
            <InfoRow label="Đối tác:" value={counterpartyName} bold />
          )}
          {negotiationId ? (
            <TouchableOpacity
              style={styles.chatButton}
              onPress={() => router.push(`/chat/${negotiationId}` as any)}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={18}
                color={COLORS.primary}
              />
              <Text style={styles.chatButtonText}>Mở hội thoại chat</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thời gian</Text>
          <InfoRow label="Ngày tạo đơn:" value={formatDate(order.createdAt)} />
          <InfoRow
            label="Cập nhật lần cuối:"
            value={formatDate(order.updatedAt)}
          />
          {order.completedAt ? (
            <InfoRow
              label="Ngày hoàn thành:"
              value={formatDate(order.completedAt)}
            />
          ) : null}
        </View>

        {hasActiveDispute && latestDisputeId ? (
          <View style={styles.disputeInfoCard}>
            <Ionicons name="warning-outline" size={20} color="#7A1012" />
            <View style={styles.disputeInfoContent}>
              <Text style={styles.disputeInfoTitle}>Đơn hàng đang có tranh chấp</Text>
              {disputeStatusText ? (
                <Text style={styles.disputeInfoStatus}>{disputeStatusText}</Text>
              ) : null}
              <Text style={styles.disputeInfoText}>
                Quy trình hoàn tất giao dịch đang tạm khóa trong thời gian xử lý tranh chấp.
              </Text>
            </View>
          </View>
        ) : null}

        {reviewAction ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Đánh giá giao dịch</Text>
            <Text style={styles.reviewDescription}>
              {reviewAction.description}
            </Text>
            <TouchableOpacity
              style={styles.reviewButton}
              onPress={reviewAction.onPress}
            >
              <Ionicons name="star-outline" size={20} color={COLORS.white} />
              <Text style={styles.reviewButtonText}>{reviewAction.label}</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      {canOpenDispute ? (
        <View style={styles.bottomBar}>
            <TouchableOpacity
              style={styles.outlineBtnWarning}
              onPress={() => router.push(`/disputes/${latestDisputeId}` as any)}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color="#7A1012"
              />
              <Text style={styles.outlineBtnWarningText}>Xem tranh chấp</Text>
            </TouchableOpacity>
        </View>
      ) : null}

      <Modal
        visible={showOverflowMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowOverflowMenu(false)}
      >
        <ModalBackdrop style={styles.overflowBackdrop} onPress={() => setShowOverflowMenu(false)}>
          <ModalSurface style={styles.overflowSheet}>
            <Text style={styles.overflowSheetTitle}>Tùy chọn đơn hàng</Text>
            {overflowActions.map((action) => (
              <TouchableOpacity
                key={action.key}
                style={styles.overflowItem}
                onPress={() => {
                  setShowOverflowMenu(false);
                  action.onPress();
                }}
              >
                <Ionicons
                  name={action.icon}
                  size={20}
                  color={action.destructive ? COLORS.error : COLORS.text}
                />
                <Text
                  style={[
                    styles.overflowItemText,
                    action.destructive ? styles.overflowItemTextDanger : undefined,
                  ]}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ModalSurface>
        </ModalBackdrop>
      </Modal>

      <Modal visible={showDisputeConfirmation} transparent animationType="fade"
        onRequestClose={() => setShowDisputeConfirmation(false)}>
        <ModalBackdrop style={styles.lifecycleModalBackdrop} onPress={() => setShowDisputeConfirmation(false)}>
          <ModalSurface style={styles.lifecycleModalCard}>
            <Text style={styles.lifecycleModalTitle}>Bạn muốn khiếu nại đơn hàng?</Text>
            <View style={styles.lifecycleModalActions}>
              <TouchableOpacity style={styles.cancelConfirmBtn} onPress={() => setShowDisputeConfirmation(false)}>
                <Text style={styles.cancelConfirmText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.primaryConfirmBtn, styles.primaryConfirmBtnDanger]}
                disabled={!canCreateDispute || canOpenDispute}
                onPress={() => {
                  setShowDisputeConfirmation(false);
                  if (!canCreateDispute || canOpenDispute) return;
                  router.push({ pathname: "/disputes/create",
                    params: { orderId, orderCode: order.orderCode || "", productName },
                  } as any);
                }}>
                <Text style={styles.primaryConfirmText}>Tiếp tục</Text>
              </TouchableOpacity>
            </View>
          </ModalSurface>
        </ModalBackdrop>
      </Modal>

      <Modal
        visible={lifecycleAction !== null}
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
              {lifecycleAction === "cancel"
                ? "Hủy đơn hàng?"
                : lifecycleAction === "confirmReturn"
                  ? "Xác nhận đã trả hàng?"
                  : "Xác nhận đã nhận lại hàng trả về?"}
            </Text>
            <Text style={styles.lifecycleModalText}>
              {lifecycleAction === "cancel"
                ? "Thao tác này sẽ hủy đơn hàng và không thể hoàn tác."
                : lifecycleAction === "confirmReturn"
                  ? "Xác nhận bạn đã gửi trả sản phẩm cho người bán."
                  : "Xác nhận bạn đã nhận lại sản phẩm trả về. Hệ thống sẽ hoàn tất hoàn tiền còn giữ cho đơn hàng."}
            </Text>

            {lifecycleActionError ? (
              <Text style={styles.lifecycleModalError}>
                {lifecycleActionError}
              </Text>
            ) : null}

            <View style={styles.lifecycleModalActions}>
              <TouchableOpacity
                style={styles.cancelConfirmBtn}
                onPress={closeLifecycleAction}
                disabled={isLifecycleActionLoading}
              >
                <Text style={styles.cancelConfirmText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryConfirmBtn,
                  lifecycleAction === "cancel"
                    ? styles.primaryConfirmBtnDanger
                    : undefined,
                ]}
                onPress={() => void handleLifecycleAction()}
                disabled={isLifecycleActionLoading}
              >
                {isLifecycleActionLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryConfirmText}>Xác nhận</Text>
                )}
              </TouchableOpacity>
            </View>
          </ModalSurface>
        </ModalBackdrop>
      </Modal>
    </SafeAreaView>
  );
}

function sanitizeTimelineText(value: unknown) {
  return localizeSystemText(value, "");
}

function formatTimelineDate(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getTimelineVisual(status: unknown) {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();

  switch (normalized) {
    case "completed":
      return {
        icon: "checkmark" as const,
        dotStyle: styles.timelineDotCompleted,
      };
    case "inprogress":
      return {
        icon: "time-outline" as const,
        dotStyle: styles.timelineDotActive,
      };
    case "failed":
      return {
        icon: "close" as const,
        dotStyle: styles.timelineDotFailed,
      };
    case "cancelled":
    case "canceled":
      return {
        icon: "close" as const,
        dotStyle: styles.timelineDotCancelled,
      };
    case "upcoming":
    default:
      return {
        icon: "ellipse" as const,
        dotStyle: styles.timelineDotUpcoming,
      };
  }
}

function isTimelineCompletedStatus(status: unknown) {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();

  return normalized === "completed" || normalized === "2";
}

function isTimelineUpcomingStatus(status: unknown) {
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();

  return normalized === "upcoming" || normalized === "0";
}

function shouldShowTimelineDescription(status: unknown) {
  // Chỉ bước đang xử lý hoặc gặp sự cố mới cần mô tả; bước đã xong giữ gọn.
  const normalized = String(status ?? "")
    .trim()
    .toLowerCase();

  return (
    normalized === "inprogress" ||
    normalized === "1" ||
    normalized === "failed" ||
    normalized === "3" ||
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "4"
  );
}

function CompactOrderTimeline({ steps }: { steps: any[] }) {
  if (!steps.length) return null;

  return (
    <View style={styles.compactMilestoneRow}>
      {steps.map((step: any, index: number) => {
        const visual = getTimelineVisual(step?.status);
        const isPassed = isTimelineCompletedStatus(step?.status);
        const prevPassed =
          index > 0 && isTimelineCompletedStatus(steps[index - 1]?.status);

        return (
          <View
            key={`${String(step?.code ?? "step")}-${index}`}
            style={styles.compactMilestoneCol}
          >
            <View style={styles.compactMilestoneLineTrack}>
              <View
                style={[
                  styles.compactMilestoneLineHalf,
                  index === 0
                    ? styles.compactMilestoneLineHidden
                    : prevPassed
                      ? styles.compactMilestoneLineDone
                      : undefined,
                ]}
              />
              <View style={[styles.compactMilestoneDot, visual.dotStyle]}>
                <Ionicons
                  name={visual.icon}
                  size={9}
                  color={
                    isTimelineUpcomingStatus(step?.status)
                      ? COLORS.textLight
                      : COLORS.white
                  }
                />
              </View>
              <View
                style={[
                  styles.compactMilestoneLineHalf,
                  index === steps.length - 1
                    ? styles.compactMilestoneLineHidden
                    : isPassed
                      ? styles.compactMilestoneLineDone
                      : undefined,
                ]}
              />
            </View>
            <Text style={styles.compactMilestoneLabel} numberOfLines={2}>
              {sanitizeTimelineText(step?.title) || "Cập nhật"}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function OrderTimelineItem({
  step,
  isLast,
  depth = 0,
}: {
  step: any;
  isLast: boolean;
  depth?: number;
}) {
  const visual = getTimelineVisual(step?.status);
  const title = sanitizeTimelineText(step?.title) || "Cập nhật đơn hàng";
  const occurredAt = formatTimelineDate(step?.occurredAt);

  // Receive display-only normalization; timestamps remain Backend-provided.
  const subSteps = Array.isArray(step?.subSteps)
    ? step.subSteps
    : [];
  const description = shouldShowTimelineDescription(step?.status)
    ? sanitizeTimelineText(step?.description)
    : "";

  const hasSubSteps = subSteps.length > 0;
  const isCompleted =
    isTimelineCompletedStatus(step?.status);

  const [isSubStepsExpanded, setSubStepsExpanded] =
    useState(!isCompleted);

  useEffect(() => {
    if (!hasSubSteps) return;

    // Khi parent chuyển sang Completed:
    // tự thu gọn các bước con.
    // Parent chưa xong thì mặc định mở.
    setSubStepsExpanded(!isCompleted);
  }, [
    hasSubSteps,
    isCompleted,
    step?.code,
  ]);

  return (
    <View
      style={[
        styles.timelineItem,
        depth > 0 ? styles.timelineSubItem : undefined,
      ]}
    >
      <View style={styles.timelineMainRow}>
        <View style={styles.timelineRail}>
          <View style={[styles.timelineDot, visual.dotStyle]}>
            <Ionicons
              name={visual.icon}
              size={12}
              color={
                isTimelineUpcomingStatus(step?.status)
                  ? COLORS.textLight
                  : COLORS.white
              }
            />
          </View>

          {!isLast ? <View style={styles.timelineConnector} /> : null}
        </View>

        <View style={styles.timelineContent}>
          <TouchableOpacity
            style={styles.timelineTitleRow}
            activeOpacity={hasSubSteps ? 0.7 : 1}
            disabled={!hasSubSteps}
            onPress={() =>
              setSubStepsExpanded((previous) => !previous)
            }
          >
            <Text style={styles.timelineTitle}>
              {title}
            </Text>

            {hasSubSteps ? (
              <Ionicons
                name={
                  isSubStepsExpanded
                    ? "chevron-up"
                    : "chevron-down"
                }
                size={17}
                color={COLORS.textLight}
              />
            ) : null}
          </TouchableOpacity>

          {description ? (
            <Text style={styles.timelineDescription}>
              {description}
            </Text>
          ) : null}

          {occurredAt ? (
            <Text style={styles.timelineTime}>
              {occurredAt}
            </Text>
          ) : null}

          {hasSubSteps && isSubStepsExpanded ? (
            <View style={styles.timelineSubSteps}>
              {subSteps.map((subStep: any, index: number) => (
                <OrderTimelineItem
                  key={`${String(
                    subStep?.code ?? "sub-step",
                  )}-${depth}-${index}`}
                  step={subStep}
                  isLast={index === subSteps.length - 1}
                  depth={depth + 1}
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </View>
  );
}

function InfoRow({
  label,
  value,
  bold = false,
  valueStyle,
}: {
  label: string;
  value: string;
  bold?: boolean;
  valueStyle?: any;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text
        style={[
          styles.infoValue,
          bold ? styles.boldText : undefined,
          valueStyle,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function StatusLine({ icon, text }: { icon: any; text: string }) {
  return (
    <View style={styles.statusLine}>
      <Ionicons name={icon} size={19} color="#2F765D" />
      <Text style={styles.statusLineText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadErrorText: {
    color: COLORS.error,
    fontSize: 15,
    textAlign: "center",
    paddingHorizontal: 28,
  },
  scrollContent: { padding: 16, paddingBottom: 40 },
  headerStatusCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  headerCardTitle: {
    flexShrink: 1,
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.white,
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 },
  overflowButton: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: "center", justifyContent: "center",
  },
  overflowBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(23, 40, 48, 0.48)",
  },
  overflowSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  overflowSheetTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 8,
  },
  overflowItem: {
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  overflowItemText: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  overflowItemTextDanger: { color: COLORS.error },
  orderCodeText: {
    fontSize: 13,
    color: COLORS.white,
    opacity: 0.85,
    marginTop: 6,
  },
  boldText: { fontWeight: "bold" },
  messageBox: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    marginBottom: 14,
  },
  errorMessageBox: { backgroundColor: "rgba(122, 16, 18, 0.08)", borderColor: "rgba(122, 16, 18, 0.22)" },
  warningMessageBox: {
    backgroundColor: "rgba(154, 100, 24, 0.10)",
    borderColor: "rgba(154, 100, 24, 0.24)",
  },
  infoMessageBox: { backgroundColor: "rgba(84, 123, 125, 0.10)", borderColor: "rgba(84, 123, 125, 0.24)" },
  successMessageBox: {
    backgroundColor: "rgba(47, 118, 93, 0.10)",
    borderColor: "rgba(47, 118, 93, 0.24)",
  },
  messageText: { fontSize: 13, lineHeight: 18 },
  errorMessageText: { color: "#7A1012" },
  warningMessageText: { color: "#9A6418" },
  infoMessageText: { color: "#2B5659" },
  successMessageText: { color: "#2F765D" },
  timelineSectionHeader: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#BAC2C1",
    paddingBottom: 8,
  },

  timelineSectionTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.text,
  },

  timelineList: {
    marginTop: 12,
  },
  timelineItem: {
    width: "100%",
  },
  timelineSubItem: {
    marginTop: 6,
  },
  timelineMainRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  timelineRail: {
    width: 28,
    alignItems: "center",
  },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  timelineDotCompleted: {
    backgroundColor: "#2F765D",
    borderColor: "#2F765D",
  },
  timelineDotActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  timelineDotUpcoming: {
    backgroundColor: "#F8F9FA",
    borderColor: "#BAC2C1",
  },
  timelineDotFailed: {
    backgroundColor: "#7A1012",
    borderColor: "#7A1012",
  },
  timelineDotCancelled: {
    backgroundColor: "#7A1012",
    borderColor: "#7A1012",
  },
  timelineConnector: {
    width: 2,
    flex: 1,
    minHeight: 18,
    backgroundColor: "rgba(186, 194, 193, 0.55)",
  },
  timelineContent: {
    flex: 1,
    paddingLeft: 8,
    paddingBottom: 14,
  },
  timelineTitleRow: {
    minHeight: 24,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  timelineTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.text,
  },
  timelineDescription: {
    marginTop: 4,
    fontSize: 12,
    lineHeight: 18,
    color: COLORS.textLight,
  },
  timelineTime: {
    marginTop: 5,
    fontSize: 11,
    color: COLORS.textLight,
  },
  timelineSubSteps: {
    marginTop: 10,
    marginLeft: 2,
  },
  timelineEmptyText: {
    marginTop: 12,
    fontSize: 13,
    color: COLORS.textLight,
  },
  compactTimelineWrap: {
    marginTop: 12,
  },
  compactMilestoneRow: {
    flexDirection: "row",
  },
  compactMilestoneCol: {
    flex: 1,
    alignItems: "center",
  },
  compactMilestoneLineTrack: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
  },
  compactMilestoneLineHalf: {
    flex: 1,
    height: 2,
    backgroundColor: "rgba(186, 194, 193, 0.55)",
  },
  compactMilestoneLineHidden: {
    backgroundColor: "transparent",
  },
  compactMilestoneLineDone: {
    backgroundColor: "#2F765D",
  },
  compactMilestoneDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  compactMilestoneLabel: {
    marginTop: 6,
    fontSize: 10,
    lineHeight: 13,
    color: COLORS.textLight,
    textAlign: "center",
  },
  compactStatusSummary: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    textAlign: "center",
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
    borderBottomColor: "#BAC2C1",
    paddingBottom: 8,
  },
  paymentStatusHighlight: {
    backgroundColor: "rgba(154, 100, 24, 0.10)",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: -16,
    marginBottom: -16,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "rgba(154, 100, 24, 0.24)",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  paymentStatusLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#9A6418",
  },
  paymentStatusValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#9A6418",
  },
  productRow: { flexDirection: "row", alignItems: "center" },
  productImg: { width: 64, height: 64, borderRadius: 8, marginRight: 12 },
  productImgPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: "#F8F9FA",
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: { flex: 1, justifyContent: "center" },
  participantList: { gap: 8, marginBottom: 12 },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 10,
    borderRadius: 9,
    backgroundColor: "rgba(84, 123, 125, 0.08)",
  },
  participantName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  participantRoles: {
    flexShrink: 1,
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  productName: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  productMeta: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  productPrice: { fontSize: 15, fontWeight: "bold", color: COLORS.error },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 12,
  },
  infoLabel: { fontSize: 13, color: COLORS.textLight, flex: 1 },
  infoValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
    flex: 2,
    textAlign: "right",
  },
  paidText: { color: "#2F765D" },
  remainingText: { color: COLORS.error },
  primaryValue: { color: COLORS.primary, fontWeight: "bold" },
  trackingLoadingBox: { paddingVertical: 12, alignItems: "center" },
  trackingLoadingText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
  },
  inlineTrackingWarning: {
    backgroundColor: "rgba(154, 100, 24, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(154, 100, 24, 0.24)",
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  inlineTrackingWarningText: {
    fontSize: 12,
    color: "#9A6418",
    flex: 1,
    fontWeight: "500",
  },
  syncTimeText: {
    fontSize: 11,
    color: "#547B7D",
    fontStyle: "italic",
    textAlign: "right",
    marginTop: 4,
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  statusLineText: { flex: 1, color: "#2F765D", fontSize: 13, lineHeight: 18 },
  relatedAppointmentButton: {
    minHeight: 64,
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
  relatedAppointmentButtonSpaced: { marginTop: 10 },
  relatedAppointmentIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  relatedAppointmentContent: { flex: 1 },
  relatedAppointmentTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "800",
  },
  relatedAppointmentMeta: {
    color: COLORS.textLight,
    fontSize: 11,
    marginTop: 3,
  },
  relatedAppointmentAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  relatedAppointmentActionText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "800",
  },
  relatedDeliverySection: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  actionHint: {
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  actionHintWarning: {
    color: "#7A1012",
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  actionButton: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 4,
  },
  actionButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "800" },
  inlineConfirmBox: {
    borderWidth: 1,
    borderColor: "rgba(84, 123, 125, 0.24)",
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    borderRadius: 10,
    padding: 12,
  },
  inlineConfirmTitle: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 19,
    marginBottom: 12,
  },
  inlineConfirmActions: { flexDirection: "row", gap: 10 },
  cancelConfirmBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  cancelConfirmText: { color: COLORS.text, fontWeight: "700" },
  primaryConfirmBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
  },
  primaryConfirmBtnDanger: { backgroundColor: COLORS.error },
  primaryConfirmText: { color: COLORS.white, fontWeight: "800" },
  secondaryOutlineBtn: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: "rgba(43, 86, 89, 0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  secondaryOutlineBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  outlineBtnDanger: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: "rgba(122, 16, 18, 0.06)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  outlineBtnDangerText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: "800",
  },
  actionSpacingTop: { marginTop: 10 },
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
    marginBottom: 10,
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
  lifecycleModalActions: { flexDirection: "row", gap: 10 },
  chatButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(84, 123, 125, 0.24)",
  },
  chatButtonText: { color: COLORS.primary, fontWeight: "bold", fontSize: 14 },
  disputeInfoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "rgba(122, 16, 18, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(122, 16, 18, 0.22)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  disputeInfoContent: { flex: 1 },
  disputeInfoTitle: { color: "#7A1012", fontSize: 13, fontWeight: "800" },
  disputeInfoStatus: {
    color: "#7A1012",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 2,
  },
  disputeInfoText: {
    color: "#7A1012",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 3,
  },
  reviewDescription: {
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  reviewButton: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  reviewButtonText: { color: COLORS.white, fontWeight: "800", fontSize: 14 },
  backBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  backBtnText: { color: COLORS.white, fontWeight: "700" },
  bottomBar: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  outlineBtnWarning: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#7A1012",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "rgba(122, 16, 18, 0.08)",
  },
  outlineBtnWarningText: {
    color: "#7A1012",
    fontSize: 14,
    fontWeight: "bold",
  },
});
