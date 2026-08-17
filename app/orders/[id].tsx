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
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

type InlineMessage = {
  type: "error" | "warning" | "info" | "success";
  text: string;
} | null;

type TransactionRole = "buyer" | "seller" | null;
type PendingAction = "handover" | "received" | null;
type DeliveryMethod =
  | "GhnDelivery"
  | "SellerDelivers"
  | "BuyerPickUp"
  | "Unknown";

type CollectionState = {
  bothCheckedIn: boolean | null;
  buyerCheckedIn: boolean | null;
  sellerCheckedIn: boolean | null;
};

const orderApi = {
  getOrderDetail: (orderId: string) =>
    apiClient.get(`/orders/${orderId}`).then((response) => response.data),
  getAgreement: (agreementId: string) =>
    apiClient.get(`/agreements/${agreementId}`).then((response) => response.data),
  getShipmentTracking: (orderId: string) =>
    apiClient
      .get(`/orders/${orderId}/shipment-tracking`)
      .then((response) => response.data),
  getBuyerCollections: () =>
    apiClient
      .get("/appointments/buyer/collections", {
        params: { PageSize: 100, PageNumber: 1 },
      })
      .then((response) => response.data),
  getSellerCollections: () =>
    apiClient
      .get("/appointments/seller/collections", {
        params: { PageSize: 100, PageNumber: 1 },
      })
      .then((response) => response.data),
  confirmHandover: (orderId: string) =>
    apiClient
      .post(`/orders/${orderId}/confirm-handover`)
      .then((response) => response.data),
  confirmReceived: (orderId: string) =>
    apiClient
      .post(`/orders/${orderId}/confirm-received`)
      .then((response) => response.data),
};

const unwrap = (value: any) => value?.data ?? value;

const normalizeStatus = (value: unknown) =>
  String(value ?? "")
    .replace(/[\s_-]/g, "")
    .toLowerCase();

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .normalize("NFC")
    .trim()
    .replace(/\s+/g, " ")
    .toLocaleLowerCase("vi-VN");

const normalizeDate = (value: unknown) => {
  if (!value) return "";
  const date = new Date(String(value));
  return Number.isNaN(date.getTime())
    ? String(value).slice(0, 10)
    : date.toISOString().slice(0, 10);
};

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

const extractItems = (response: any) => {
  const raw = unwrap(response);
  return raw?.items || raw?.data?.items || raw?.data || raw || [];
};

const getCollectionState = (
  response: any,
  agreementDetails: any,
  deliveryMethod: DeliveryMethod,
): CollectionState => {
  const items = extractItems(response);
  if (!Array.isArray(items) || items.length === 0) {
    return {
      bothCheckedIn: null,
      buyerCheckedIn: null,
      sellerCheckedIn: null,
    };
  }

  const expectedDate = normalizeDate(agreementDetails?.collectionDate);
  const expectedPickup = normalizeText(agreementDetails?.pickupAddress);
  const expectedDelivery = normalizeText(agreementDetails?.deliveryAddress);

  const scored = items
    .map((item: any) => {
      let score = 0;
      if (normalizeDeliveryMethod(item?.deliveryMethod) === deliveryMethod) score += 2;
      if (expectedDate && normalizeDate(item?.collectionDate) === expectedDate) score += 3;
      if (expectedPickup && normalizeText(item?.pickupAddress) === expectedPickup) score += 3;
      if (expectedDelivery && normalizeText(item?.deliveryAddress) === expectedDelivery) score += 3;
      return { item, score };
    })
    .sort((a, b) => b.score - a.score);

  const best = scored[0];
  if (!best || (items.length > 1 && best.score < 5)) {
    return {
      bothCheckedIn: null,
      buyerCheckedIn: null,
      sellerCheckedIn: null,
    };
  }

  const buyerCheckedIn = Boolean(
    best.item?.buyerCheckedIn || best.item?.buyerCheckAt,
  );
  const sellerCheckedIn = Boolean(
    best.item?.sellerCheckedIn || best.item?.sellerCheckAt,
  );

  return {
    buyerCheckedIn,
    sellerCheckedIn,
    bothCheckedIn: buyerCheckedIn && sellerCheckedIn,
  };
};

export default function OrderDetailScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const params = useLocalSearchParams();
  const orderId = Array.isArray(params.id) ? params.id[0] : params.id;
  const currentUserId = String(user?.userId || user?.id || "").toLowerCase();

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [agreement, setAgreement] = useState<any>(null);
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>("Unknown");
  const [transactionRole, setTransactionRole] =
    useState<TransactionRole>(null);
  const [collectionState, setCollectionState] = useState<CollectionState>({
    bothCheckedIn: null,
    buyerCheckedIn: null,
    sellerCheckedIn: null,
  });
  const [trackingData, setTrackingData] = useState<any>(null);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);
  const [trackingError, setTrackingError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<InlineMessage>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [isActionLoading, setIsActionLoading] = useState(false);

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
      const responseData = unwrap(detailResponse);
      setData(responseData);

      const order = responseData?.order;
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

      if (
        nextAgreement &&
        nextRole &&
        (nextDeliveryMethod === "BuyerPickUp" ||
          nextDeliveryMethod === "SellerDelivers")
      ) {
        try {
          const collectionResponse =
            nextRole === "seller"
              ? await orderApi.getSellerCollections()
              : await orderApi.getBuyerCollections();
          setCollectionState(
            getCollectionState(
              collectionResponse,
              nextAgreement?.agreementDetails,
              nextDeliveryMethod,
            ),
          );
        } catch {
          setCollectionState({
            bothCheckedIn: null,
            buyerCheckedIn: null,
            sellerCheckedIn: null,
          });
        }
      } else {
        setCollectionState({
          bothCheckedIn: null,
          buyerCheckedIn: null,
          sellerCheckedIn: null,
        });
      }

      if (nextDeliveryMethod === "GhnDelivery") {
        setIsTrackingLoading(true);
        try {
          const trackResponse = await orderApi.getShipmentTracking(orderId);
          setTrackingData(unwrap(trackResponse));
        } catch {
          setTrackingData(null);
          setTrackingError(
            "Không thể đồng bộ GHN lúc này. Thông tin đơn hàng vẫn được giữ nguyên.",
          );
        } finally {
          setIsTrackingLoading(false);
        }
      } else {
        setTrackingData(null);
        setIsTrackingLoading(false);
      }
    } catch (error: any) {
      const status = Number(error?.response?.status || 0);
      setPageMessage({
        type: "error",
        text:
          status >= 500
            ? "Lỗi server khi tải đơn hàng. Vui lòng thử lại sau."
            : getApiErrorMessage(error, "Không thể tải dữ liệu đơn hàng lúc này."),
      });
      setData(null);
      setAgreement(null);
      setDeliveryMethod("Unknown");
      setTransactionRole(null);
    } finally {
      setIsLoading(false);
    }
  }, [currentUserId, orderId]);

  useFocusEffect(
    useCallback(() => {
      void fetchOrderDetail();
    }, [fetchOrderDetail]),
  );

  const handleConfirmAction = async () => {
    if (!orderId || !pendingAction || isActionLoading) return;

    try {
      setIsActionLoading(true);
      setPageMessage(null);

      if (pendingAction === "handover") {
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
          pendingAction === "handover"
            ? "Chưa thể xác nhận bàn giao hàng."
            : "Chưa thể xác nhận đã nhận hàng.",
        ),
      });
    } finally {
      setIsActionLoading(false);
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

  const translatePaymentStatus = (status: number | string) => {
    switch (String(status)) {
      case "0":
        return "Chưa thanh toán đủ / Đang cọc";
      case "1":
        return "Đã thanh toán toàn phần";
      case "2":
        return "Đã hoàn tiền";
      default:
        return String(status || "Chưa rõ");
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
  const counterpartyName = data.counterpartyName || "Đối tác";
  const negotiationId = data.negotiationId;
  const postId = order.postId;
  const shipment = data.shipment;
  const dispute = data.dispute || {};

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
  const progressStep = isCancelled ? 2 : isCompleted ? 2 : isProcessing ? 1 : 0;

  const hasActiveDispute = dispute?.hasActiveDispute === true;
  const latestDisputeId = dispute?.latestDisputeId;
  const canOpenDispute = hasActiveDispute && Boolean(latestDisputeId);
  const canCreateDispute =
    !hasActiveDispute && (currentStatusCode === 1 || currentStatusCode === 2);

  const isDirect =
    deliveryMethod === "BuyerPickUp" || deliveryMethod === "SellerDelivers";
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
  const shipmentStatus = Number(
    trackingData?.shipmentStatus ?? shipment?.shipmentStatus ?? 0,
  );
  const isGhnDelivered =
    isGhn && shipmentStatus === 3 && Boolean(deliveredDate);

  const directCheckInKnown = collectionState.bothCheckedIn !== null;
  const directReady = isDirect && collectionState.bothCheckedIn === true;
  const sellerAlreadyConfirmed = Boolean(order.sellerHandoverConfirmedAt);
  const buyerAlreadyConfirmed = Boolean(order.buyerReceivedConfirmedAt);

  const canConfirmHandover =
    isProcessing &&
    !hasActiveDispute &&
    transactionRole === "seller" &&
    isDirect &&
    directReady &&
    !sellerAlreadyConfirmed;

  const canConfirmReceived =
    isProcessing &&
    !hasActiveDispute &&
    transactionRole === "buyer" &&
    !buyerAlreadyConfirmed &&
    ((isDirect && directReady) || isGhnDelivered);

  const shouldShowActionCard =
    !isCancelled &&
    (isProcessing ||
      sellerAlreadyConfirmed ||
      buyerAlreadyConfirmed ||
      (isGhn && transactionRole === "buyer"));

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Chi tiết Đơn hàng" showBack />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerStatusCard}>
          <Text style={styles.headerCardTitle}>Đơn hàng giao dịch</Text>
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
          <Text style={styles.sectionTitle}>Tiến trình đơn hàng</Text>
          <View style={styles.progressContainer}>
            {[
              "Chờ thanh toán",
              "Đang xử lý",
              isCancelled ? "Đã hủy" : "Hoàn thành",
            ].map((label, index) => {
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
                      isCancelled && index === 2
                        ? styles.circleCancelled
                        : undefined,
                    ]}
                  >
                    {isPassed ? (
                      <Ionicons name="checkmark" size={14} color={COLORS.white} />
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
            {thumbnailUrl ? (
              <Image source={{ uri: thumbnailUrl }} style={styles.productImg} />
            ) : (
              <View style={styles.productImgPlaceholder}>
                <Ionicons name="image-outline" size={24} color="#94A3B8" />
              </View>
            )}
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {productName}
              </Text>
              <Text style={styles.productMeta}>Số lượng: {order.quantity || 1}</Text>
              <Text style={styles.productPrice}>
                {formatCurrency(order.finalTotalAmount)}
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
            label="Giá trị sản phẩm gốc:"
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

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Vận chuyển & Giao nhận</Text>
          <InfoRow
            label="Phương thức:"
            value={translateDeliveryMethod(deliveryMethod)}
            bold
          />

          {trackingError ? (
            <View style={styles.inlineTrackingWarning}>
              <Ionicons name="warning-outline" size={16} color="#D97706" />
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
                  <Ionicons name="warning-outline" size={16} color="#D97706" />
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

          {isDirect ? (
            <View style={styles.checkInBox}>
              <View style={styles.checkInRow}>
                <Ionicons
                  name={
                    collectionState.buyerCheckedIn === true
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={18}
                  color={
                    collectionState.buyerCheckedIn === true
                      ? "#059669"
                      : COLORS.textLight
                  }
                />
                <Text style={styles.checkInText}>Buyer check-in</Text>
              </View>
              <View style={styles.checkInRow}>
                <Ionicons
                  name={
                    collectionState.sellerCheckedIn === true
                      ? "checkmark-circle"
                      : "ellipse-outline"
                  }
                  size={18}
                  color={
                    collectionState.sellerCheckedIn === true
                      ? "#059669"
                      : COLORS.textLight
                  }
                />
                <Text style={styles.checkInText}>Seller check-in</Text>
              </View>
              {!directCheckInKnown ? (
                <Text style={styles.checkInHint}>
                  Chưa đối chiếu được chính xác lịch thu gom với đơn hàng này. FE sẽ
                  không hiện nút xác nhận cho tới khi có đủ bằng chứng check-in.
                </Text>
              ) : null}
            </View>
          ) : null}
        </View>

        {shouldShowActionCard ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Xác nhận giao nhận</Text>

            {sellerAlreadyConfirmed ? (
              <StatusLine
                icon="checkmark-circle"
                text={`Seller đã xác nhận bàn giao${
                  order.sellerHandoverConfirmedAt
                    ? ` lúc ${formatDate(order.sellerHandoverConfirmedAt)}`
                    : ""
                }.`}
              />
            ) : null}
            {buyerAlreadyConfirmed ? (
              <StatusLine
                icon="checkmark-circle"
                text={`Buyer đã xác nhận nhận hàng${
                  order.buyerReceivedConfirmedAt
                    ? ` lúc ${formatDate(order.buyerReceivedConfirmedAt)}`
                    : ""
                }.`}
              />
            ) : null}

            {hasActiveDispute ? (
              <Text style={styles.actionHintWarning}>
                Đơn hàng đang có tranh chấp, FE tạm khóa thao tác xác nhận giao nhận.
              </Text>
            ) : null}

            {isDirect && collectionState.bothCheckedIn === false ? (
              <Text style={styles.actionHintWarning}>
                Buyer và Seller cần check-in đủ lịch thu gom trước khi xác nhận giao
                nhận.
              </Text>
            ) : null}

            {isDirect && collectionState.bothCheckedIn === null && isProcessing ? (
              <Text style={styles.actionHintWarning}>
                Chưa xác minh được đủ check-in của lịch thu gom nên FE chưa mở thao
                tác xác nhận giao nhận.
              </Text>
            ) : null}

            {isGhn && transactionRole === "buyer" && !isGhnDelivered && isProcessing ? (
              <Text style={styles.actionHint}>
                GHN chưa có ShipmentStatus Delivered và DeliveredAt nên chưa thể hiện
                nút “Đã nhận hàng”.
              </Text>
            ) : null}

            {isGhn && transactionRole === "seller" && isProcessing ? (
              <Text style={styles.actionHint}>
                Đơn GHN không cần Seller xác nhận bàn giao. GHN Delivered là bằng
                chứng giao hàng.
              </Text>
            ) : null}

            {pendingAction ? (
              <View style={styles.inlineConfirmBox}>
                <Text style={styles.inlineConfirmTitle}>
                  {pendingAction === "handover"
                    ? "Xác nhận bạn đã bàn giao hàng cho Buyer?"
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

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Đối tác giao dịch</Text>
          <InfoRow label="Đối tác:" value={counterpartyName} bold />
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
            <Ionicons name="warning-outline" size={20} color="#B45309" />
            <View style={styles.disputeInfoContent}>
              <Text style={styles.disputeInfoTitle}>Đơn hàng đang có tranh chấp</Text>
              <Text style={styles.disputeInfoText}>
                Trạng thái giao dịch đang được khóa ở phía FE để chờ xử lý tranh
                chấp.
              </Text>
            </View>
          </View>
        ) : null}

        {isCompleted && orderId ? (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Đánh giá giao dịch</Text>
            <Text style={styles.reviewDescription}>
              Đơn hàng đã hoàn thành. Bạn có thể đánh giá đối tác từ 1–5 sao,
              thêm nhận xét và tối đa 3 ảnh.
            </Text>
            <TouchableOpacity
              style={styles.reviewButton}
              onPress={() => router.push(`/reviews/order/${orderId}` as any)}
            >
              <Ionicons name="star-outline" size={20} color={COLORS.white} />
              <Text style={styles.reviewButtonText}>Đánh giá / Xem đánh giá</Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </ScrollView>

      {canCreateDispute || canOpenDispute ? (
        <View style={styles.bottomBar}>
          {canOpenDispute ? (
            <TouchableOpacity
              style={styles.outlineBtnWarning}
              onPress={() => router.push(`/disputes/${latestDisputeId}` as any)}
            >
              <Ionicons
                name="document-text-outline"
                size={18}
                color="#B45309"
              />
              <Text style={styles.outlineBtnWarningText}>Xem Tranh Chấp</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={styles.outlineBtnWarning}
              onPress={() =>
                router.push({
                  pathname: "/disputes/create",
                  params: {
                    orderId,
                    orderCode: order.orderCode || "",
                    productName,
                  },
                } as any)
              }
            >
              <Ionicons name="warning-outline" size={18} color="#B45309" />
              <Text style={styles.outlineBtnWarningText}>Gửi Khiếu Nại</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
    </SafeAreaView>
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
      <Ionicons name={icon} size={19} color="#059669" />
      <Text style={styles.statusLineText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
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
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.white,
  },
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
  errorMessageBox: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  warningMessageBox: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  infoMessageBox: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  successMessageBox: {
    backgroundColor: "#ECFDF5",
    borderColor: "#A7F3D0",
  },
  messageText: { fontSize: 13, lineHeight: 18 },
  errorMessageText: { color: "#B91C1C" },
  warningMessageText: { color: "#B45309" },
  infoMessageText: { color: "#1D4ED8" },
  successMessageText: { color: "#047857" },
  progressContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    marginTop: 8,
  },
  progressStep: { alignItems: "center", flex: 1 },
  circle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
    borderWidth: 1.5,
  },
  circleCompleted: { backgroundColor: "#10B981", borderColor: "#10B981" },
  circleActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  circlePending: { backgroundColor: "#F1F5F9", borderColor: "#CBD5E1" },
  circleCancelled: { backgroundColor: "#EF4444", borderColor: "#EF4444" },
  circleText: {
    fontSize: 12,
    fontWeight: "bold",
    color: COLORS.textLight,
  },
  circleTextActive: { color: COLORS.white },
  progressLabel: {
    fontSize: 11,
    color: COLORS.textLight,
    textAlign: "center",
  },
  progressLabelActive: { color: COLORS.primary, fontWeight: "bold" },
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
  paymentStatusHighlight: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: -16,
    marginBottom: -16,
    marginTop: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#FDE68A",
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  paymentStatusLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#92400E",
  },
  paymentStatusValue: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#B45309",
  },
  productRow: { flexDirection: "row", alignItems: "center" },
  productImg: { width: 64, height: 64, borderRadius: 8, marginRight: 12 },
  productImgPlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },
  productInfo: { flex: 1, justifyContent: "center" },
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
  paidText: { color: "#10B981" },
  remainingText: { color: COLORS.error },
  primaryValue: { color: COLORS.primary, fontWeight: "bold" },
  trackingLoadingBox: { paddingVertical: 12, alignItems: "center" },
  trackingLoadingText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 4,
  },
  inlineTrackingWarning: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 8,
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  inlineTrackingWarningText: {
    fontSize: 12,
    color: "#92400E",
    flex: 1,
    fontWeight: "500",
  },
  syncTimeText: {
    fontSize: 11,
    color: "#94A3B8",
    fontStyle: "italic",
    textAlign: "right",
    marginTop: 4,
  },
  checkInBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginTop: 4,
  },
  checkInRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  checkInText: { color: COLORS.text, fontSize: 13, fontWeight: "600" },
  checkInHint: {
    color: COLORS.textLight,
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },
  statusLine: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 10,
  },
  statusLineText: { flex: 1, color: "#047857", fontSize: 13, lineHeight: 18 },
  actionHint: {
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 10,
  },
  actionHintWarning: {
    color: "#B45309",
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
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
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
  primaryConfirmText: { color: COLORS.white, fontWeight: "800" },
  chatButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
  },
  chatButtonText: { color: COLORS.primary, fontWeight: "bold", fontSize: 14 },
  disputeInfoCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
  },
  disputeInfoContent: { flex: 1 },
  disputeInfoTitle: { color: "#92400E", fontSize: 13, fontWeight: "800" },
  disputeInfoText: {
    color: "#B45309",
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
    borderColor: "#D97706",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    backgroundColor: "#FEF3C7",
  },
  outlineBtnWarningText: {
    color: "#B45309",
    fontSize: 14,
    fontWeight: "bold",
  },
});