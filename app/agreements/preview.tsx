import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
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

const agreementApi = {
  getPreview: async (negotiationId: string) => {
    const response = await apiClient.get(
      `/agreements/preview/${negotiationId}`,
    );
    return response.data;
  },
  getAgreementById: async (agreementId: string) => {
    const response = await apiClient.get(`/agreements/${agreementId}`);
    return response.data;
  },
  acceptAgreement: async (agreementId: string) => {
    const response = await apiClient.patch(
      `/agreements/${agreementId}/accept`,
    );
    return response.data;
  },
  requestEditAgreement: async (agreementId: string) => {
    const response = await apiClient.patch(
      `/agreements/${agreementId}/request-edit`,
    );
    return response.data;
  },
};

const unwrapResponse = (response: any) => response?.data || response;

const normalizeStatus = (status: unknown) =>
  String(status ?? "")
    .replace(/[\s_-]/g, "")
    .toLowerCase();

const normalizeId = (id: unknown) => String(id ?? "").trim().toLowerCase();

const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.error?.message
  || error?.response?.data?.message
  || error?.message
  || fallback;

export default function AgreementPreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const agreementId = Array.isArray(params.agreementId)
    ? params.agreementId[0]
    : params.agreementId;
  const negotiationId = Array.isArray(params.negotiationId)
    ? params.negotiationId[0]
    : params.negotiationId;

  const { user } = useAuth();
  const currentUserId = normalizeId(user?.userId || user?.id);

  const [agreementData, setAgreementData] = useState<any>(null);
  const [previewInfo, setPreviewInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const showError = useCallback((message: string) => {
    if (Platform.OS === "web") {
      window.alert(message);
    } else {
      Alert.alert("Lỗi", message);
    }
  }, []);

  const fetchAgreementDetails = useCallback(async (showLoader = true) => {
    if (!agreementId || !negotiationId) {
      setIsLoading(false);
      return null;
    }

    try {
      if (showLoader) setIsLoading(true);

      const [detailRes, previewRes] = await Promise.all([
        agreementApi.getAgreementById(agreementId),
        agreementApi.getPreview(negotiationId),
      ]);

      const agreement = unwrapResponse(detailRes);
      const preview = unwrapResponse(previewRes);

      setAgreementData(agreement);
      setPreviewInfo(preview);

      return { agreement, preview };
    } catch (error) {
      console.error("Lỗi tải chi tiết hợp đồng:", error);
      showError(getErrorMessage(error, "Không thể tải chi tiết hợp đồng."));
      return null;
    } finally {
      if (showLoader) setIsLoading(false);
    }
  }, [agreementId, negotiationId, showError]);

  useFocusEffect(
    useCallback(() => {
      void fetchAgreementDetails();
    }, [fetchAgreementDetails])
  );

  const isBuyerForAgreement = useCallback((agreement: any, preview: any) => {
    if (preview?.canPay === true) return true;

    const buyerId = normalizeId(
      agreement?.buyerId
      || agreement?.buyerUserId
      || preview?.buyerId
      || preview?.buyerUserId
    );

    return Boolean(currentUserId && buyerId && currentUserId === buyerId);
  }, [currentUserId]);

  const goToPayment = useCallback(() => {
  if (!agreementId) return;

  router.push({
    pathname: "/payments/checkout",
    params: { agreementId },
  });
}, [agreementId, router]);

  const notifyAcceptResult = useCallback((isAwaitingPayment: boolean, canPay: boolean) => {
    if (!isAwaitingPayment) {
      const message = "Bạn đã xác nhận hợp đồng. Đang chờ phía còn lại xác nhận.";
      Platform.OS === "web"
        ? window.alert(message)
        : Alert.alert("Đã xác nhận", message);
      return;
    }

    if (!canPay) {
      const message = "Hai bên đã xác nhận hợp đồng. Đang chờ người mua thanh toán.";
      Platform.OS === "web"
        ? window.alert(message)
        : Alert.alert("Hợp đồng đã được xác nhận", message);
      return;
    }

    const message = "Hai bên đã xác nhận hợp đồng. Bạn có muốn chuyển sang thanh toán ngay không?";
    if (Platform.OS === "web") {
      if (window.confirm(message)) goToPayment();
      return;
    }

    Alert.alert("Hợp đồng đã được xác nhận", message, [
      { text: "Để sau", style: "cancel" },
      { text: "Thanh toán", onPress: goToPayment },
    ]);
  }, [goToPayment]);

  const handleAccept = async () => {
    if (!agreementId) return;

    try {
      setIsProcessing(true);
      const acceptRes = await agreementApi.acceptAgreement(agreementId);
      const refreshed = await fetchAgreementDetails(false);
      const nextAgreement = refreshed?.agreement || unwrapResponse(acceptRes) || agreementData;
      const nextPreview = refreshed?.preview || previewInfo;
      const nextStatus = normalizeStatus(nextAgreement?.agreementStatus);
      const isAwaitingPayment =
        nextStatus === "awaitingpayment" || nextStatus === "accepted";
      const canPay = isAwaitingPayment && isBuyerForAgreement(nextAgreement, nextPreview);

      notifyAcceptResult(isAwaitingPayment, canPay);
    } catch (error: any) {
      showError(getErrorMessage(error, "Không thể xác nhận hợp đồng."));
    } finally {
      setIsProcessing(false);
    }
  };

  const executeRequestEdit = async () => {
  if (!agreementId || !negotiationId) return;

  try {
    setIsProcessing(true);

    await agreementApi.requestEditAgreement(agreementId);
    await fetchAgreementDetails(false);

    router.push({
      pathname: "/agreements/form",
      params: {
        negotiationId,
        editAgreementId: agreementId,
      },
    });
  } catch (error: any) {
    showError(
      getErrorMessage(error, "Không thể mở lại hợp đồng để chỉnh sửa."),
    );
  } finally {
    setIsProcessing(false);
  }
};

  const handleRequestEdit = () => {
    const message =
      "Hợp đồng sẽ trở về trạng thái chờ xác nhận và lượt xác nhận của cả hai bên sẽ được đặt lại. Tiếp tục?";

    if (Platform.OS === "web") {
      if (window.confirm(message)) void executeRequestEdit();
      return;
    }

    Alert.alert("Yêu cầu chỉnh sửa hợp đồng", message, [
      { text: "Không", style: "cancel" },
      { text: "Tiếp tục", onPress: () => void executeRequestEdit() },
    ]);
  };

  const handleEdit = () => {
  if (!agreementId || !negotiationId) return;

  router.push({
    pathname: "/agreements/form",
    params: {
      negotiationId,
      editAgreementId: agreementId,
    },
  });
};

  const formatPrice = (price: number) =>
    Number(price || 0).toLocaleString("vi-VN") + " đ";

  const formatDate = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString("vi-VN") : "Chưa có";

  const translateDeliveryMethod = (method: string) => {
    switch (method) {
      case "BuyerPickUp":
        return "Bên mua đến lấy";
      case "SellerDelivers":
        return "Bên bán tự giao";
      case "GhnDelivery":
        return "Giao hàng nhanh (GHN)";
      case "Unknown":
        return "Chưa xác định";
      default:
        return method || "Chưa xác định";
    }
  };

  const translateAgreementStatus = (status: string) => {
    switch (normalizeStatus(status)) {
      case "pending":
        return "Chờ hai bên xác nhận";
      case "awaitingpayment":
      case "accepted":
        return "Chờ thanh toán";
      case "paid":
        return "Đã thanh toán";
      case "completed":
        return "Đã hoàn tất";
      case "rejected":
        return "Đã từ chối";
      case "cancelled":
      case "canceled":
        return "Đã hủy";
      default:
        return status || "Chưa xác định";
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết hợp đồng" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!agreementData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết hợp đồng" showBack={true} />
        <View style={styles.emptyContainer}>
          <Ionicons name="document-text-outline" size={46} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>Chưa tải được hợp đồng</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => void fetchAgreementDetails()}>
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isInspection =
    agreementData.agreementType === "Inspection" || agreementData.agreementType === 0;
  const details = agreementData.agreementDetails || {};
  const status = normalizeStatus(agreementData.agreementStatus);
  const isPending = status === "pending";
  const isAwaitingPayment = status === "awaitingpayment" || status === "accepted";

  const sellerId = normalizeId(
    agreementData.sellerId
    || agreementData.sellerUserId
    || previewInfo?.sellerId
    || previewInfo?.sellerUserId
  );
  const buyerId = normalizeId(
    agreementData.buyerId
    || agreementData.buyerUserId
    || previewInfo?.buyerId
    || previewInfo?.buyerUserId
  );
  const hasParticipantIds = Boolean(sellerId || buyerId);
  const isSeller = Boolean(currentUserId && sellerId && currentUserId === sellerId);
  const isBuyer = Boolean(currentUserId && buyerId && currentUserId === buyerId);
  const isParticipant = hasParticipantIds
    ? isSeller || isBuyer
    : Boolean(
      previewInfo?.hasAgreement
      || previewInfo?.canEdit
      || previewInfo?.canConfirm
      || previewInfo?.canRequestEdit
      || previewInfo?.canPay
    );

  const sellerConfirmed = Boolean(
    agreementData.sellerConfirmedAt || agreementData.sellerConfirmed
  );
  const buyerConfirmed = Boolean(
    agreementData.buyerConfirmedAt || agreementData.buyerConfirmed
  );
  const currentSideConfirmed = isSeller
    ? sellerConfirmed
    : isBuyer
      ? buyerConfirmed
      : false;

  const canEdit = isPending && (
    previewInfo?.canEdit === true || (hasParticipantIds && isParticipant)
  );
  const canAccept = isPending
    && !currentSideConfirmed
    && (
      previewInfo?.canConfirm === true
      || (hasParticipantIds && isParticipant)
    );
  const canRequestEdit = isAwaitingPayment && isParticipant;
  const canPay = isAwaitingPayment && (
    previewInfo?.canPay === true || isBuyer
  );
  const hasPendingAction = canEdit || canAccept;
  const hasAwaitingAction = canRequestEdit || canPay;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Chi tiết hợp đồng" showBack={true} />

      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={24} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Hợp đồng giao dịch</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Mã hợp đồng:</Text>
            <Text style={[styles.value, styles.idValue]}>{agreementData.agreementId}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Trạng thái hợp đồng:</Text>
            <Text style={[styles.value, styles.statusValue]}>
              {translateAgreementStatus(agreementData.agreementStatus)}
            </Text>
          </View>
          {Number.isFinite(Number(details.revision)) && (
            <View style={styles.row}>
              <Text style={styles.label}>Phiên bản:</Text>
              <Text style={styles.value}>{Number(details.revision)}</Text>
            </View>
          )}
          <View style={styles.row}>
            <Text style={styles.label}>Loại giao dịch:</Text>
            <Text style={styles.value}>
              {isInspection ? "Có kiểm định trước" : "Thu gom ngay"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Hình thức thanh toán:</Text>
            <Text style={styles.value}>
              {agreementData.paymentType === "Deposit" ? "Đặt cọc" : "Toàn phần"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Số lượng:</Text>
            <Text style={styles.value}>{agreementData.quantity || 1}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Giá ban đầu:</Text>
            <Text style={styles.value}>{formatPrice(agreementData.initialPrice)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Giá chốt giao dịch:</Text>
            <Text style={[styles.value, styles.finalPrice]}>
              {formatPrice(agreementData.finalPrice)}
            </Text>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Lịch trình & Giao nhận</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Vận chuyển:</Text>
            <Text style={styles.value}>
              {translateDeliveryMethod(details.deliveryMethod)}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Thời gian thu gom:</Text>
            <Text style={styles.value}>{formatDate(details.collectionDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Địa chỉ lấy:</Text>
            <Text style={styles.value}>{details.pickupAddress || "Chưa có"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Địa chỉ giao:</Text>
            <Text style={styles.value}>{details.deliveryAddress || "Chưa có"}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Thời gian kiểm định:</Text>
            <Text style={styles.value}>{formatDate(details.inspectionDate)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Địa điểm kiểm định:</Text>
            <Text style={styles.value}>{details.inspectionAddress || "Chưa có"}</Text>
          </View>
          {typeof details.estimatedShippingFee === "number" && (
            <View style={styles.row}>
              <Text style={styles.label}>Phí giao hàng dự kiến:</Text>
              <Text style={[styles.value, styles.finalPrice]}>
                {formatPrice(details.estimatedShippingFee)}
              </Text>
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Xác nhận & Thời gian</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Ngày tạo hợp đồng:</Text>
            <Text style={styles.value}>{formatDate(agreementData.createdAt)}</Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Người bán xác nhận:</Text>
            <Text style={styles.value}>
              {sellerConfirmed ? formatDate(agreementData.sellerConfirmedAt) : "Chưa xác nhận"}
            </Text>
          </View>
          <View style={styles.row}>
            <Text style={styles.label}>Người mua xác nhận:</Text>
            <Text style={styles.value}>
              {buyerConfirmed ? formatDate(agreementData.buyerConfirmedAt) : "Chưa xác nhận"}
            </Text>
          </View>

          {details.notes && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Ghi chú</Text>
              <Text style={styles.notesText}>{details.notes}</Text>
            </>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        {isPending && (
          <>
            {canEdit && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleEdit}
                disabled={isProcessing}
              >
                <Text style={styles.secondaryBtnText}>Chỉnh sửa hợp đồng</Text>
              </TouchableOpacity>
            )}
            {canAccept && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleAccept}
                disabled={isProcessing}
              >
                {isProcessing
                  ? <ActivityIndicator color={COLORS.white} />
                  : <Text style={styles.primaryBtnText}>Xác nhận hợp đồng</Text>}
              </TouchableOpacity>
            )}
            {!hasPendingAction && (
              <Text style={styles.waitingText}>
                Bạn đã xác nhận. Đang chờ phía còn lại xử lý...
              </Text>
            )}
          </>
        )}

        {isAwaitingPayment && (
          <>
            {canRequestEdit && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={handleRequestEdit}
                disabled={isProcessing}
              >
                <Text style={styles.secondaryBtnText}>Yêu cầu chỉnh sửa</Text>
              </TouchableOpacity>
            )}
            {canPay && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={goToPayment}
                disabled={isProcessing}
              >
                <Text style={styles.primaryBtnText}>Đi đến thanh toán</Text>
              </TouchableOpacity>
            )}
            {!hasAwaitingAction && (
              <Text style={styles.waitingText}>Đang chờ người mua thanh toán...</Text>
            )}
          </>
        )}

        {!isPending && !isAwaitingPayment && (
          <Text style={styles.waitingText}>
            Hợp đồng hiện không có thao tác cần xử lý.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyTitle: {
    marginTop: 12,
    marginBottom: 16,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryBtnText: { color: COLORS.white, fontWeight: "bold" },
  scrollContent: { padding: 16 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
    color: COLORS.text,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  label: { fontSize: 14, color: COLORS.textLight, flex: 1 },
  value: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "500",
    flex: 2,
    textAlign: "right",
  },
  idValue: { fontSize: 11, color: COLORS.textLight },
  statusValue: { fontWeight: "bold", color: COLORS.primary },
  finalPrice: { color: COLORS.error, fontWeight: "bold" },
  notesText: {
    fontSize: 14,
    color: COLORS.text,
    fontStyle: "italic",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 12,
  },
  bottomBar: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  waitingText: {
    textAlign: "center",
    flex: 1,
    color: COLORS.textLight,
    paddingVertical: 8,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: COLORS.white,
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
  },
});
