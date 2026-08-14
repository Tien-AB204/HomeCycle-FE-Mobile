import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
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
    const response = await apiClient.patch(`/agreements/${agreementId}/accept`);
    return response.data;
  },

  /* [KHÔNG ĐƯỢC XÓA] - Tạm thời đóng tính năng Yêu cầu chỉnh sửa
  requestEditAgreement: async (agreementId: string) => {
    const response = await apiClient.patch(
      `/agreements/${agreementId}/request-edit`,
    );
    return response.data;
  },
  */
};

const unwrapResponse = (response: any) => response?.data || response;

const normalizeStatus = (status: unknown) =>
  String(status ?? "")
    .replace(/[\s_-]/g, "")
    .toLowerCase();

const normalizeId = (id: unknown) =>
  String(id ?? "")
    .trim()
    .toLowerCase();

type MessageState = {
  text: string;
  type: "error" | "success" | "warning";
} | null;

type ChangedFields = Record<string, { old: any; new: any }>;

export default function AgreementPreviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const agreementId = Array.isArray(params.agreementId)
    ? params.agreementId[0]
    : params.agreementId;

  const negotiationId = Array.isArray(params.negotiationId)
    ? params.negotiationId[0]
    : params.negotiationId;

  const successMsg = Array.isArray(params.successMsg)
    ? params.successMsg[0]
    : params.successMsg;

  const { user } = useAuth();
  const currentUserId = normalizeId(user?.userId || user?.id);

  const [agreementData, setAgreementData] = useState<any>(null);
  const [previewInfo, setPreviewInfo] = useState<any>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // const [isConfirmingRequestEdit, setIsConfirmingRequestEdit] = useState(false); // [KHÔNG ĐƯỢC XÓA]

  // [THÊM MỚI] State để hiển thị bảng cảnh báo khi có người vừa sửa xong hợp đồng
  const [isConfirmingEditConflict, setIsConfirmingEditConflict] =
    useState(false);

  const [statusMessage, setStatusMessage] = useState<MessageState>(
    successMsg ? { type: "success", text: successMsg } : null,
  );
  const [changedFields, setChangedFields] = useState<ChangedFields | null>(
    null,
  );

  const fetchAgreementDetails = useCallback(
    async (showLoader = true) => {
      if (!agreementId || !negotiationId) {
        setIsLoading(false);
        setStatusMessage({
          type: "error",
          text: "Không tìm thấy mã hợp đồng hoặc phiên thương lượng.",
        });
        return null;
      }

      try {
        if (showLoader) {
          setIsLoading(true);
        }

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
        setStatusMessage({
          type: "error",
          text: getApiErrorMessage(error, "Không thể tải chi tiết hợp đồng."),
        });
        return null;
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [agreementId, negotiationId],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchAgreementDetails();
    }, [fetchAgreementDetails]),
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    setStatusMessage(null);
    setChangedFields(null);
    setIsConfirmingEditConflict(false);
    await fetchAgreementDetails(false);
    setIsRefreshing(false);
  };

  const handleManualReload = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    setChangedFields(null);
    setIsConfirmingEditConflict(false);
    await fetchAgreementDetails(false);
    setIsProcessing(false);
  };

  const isBuyerForAgreement = useCallback(
    (agreement: any, preview: any) => {
      if (preview?.canPay === true) {
        return true;
      }

      const buyerId = normalizeId(
        agreement?.buyerId ||
          agreement?.buyerUserId ||
          preview?.buyerId ||
          preview?.buyerUserId,
      );

      return Boolean(currentUserId && buyerId && currentUserId === buyerId);
    },
    [currentUserId],
  );

  const goToPayment = useCallback(async () => {
    if (!agreementId) return;

    try {
      setIsProcessing(true); 
      setStatusMessage(null);
      
      // JIT Check trạng thái mới nhất trước khi cho phép qua trang thanh toán
      const checkRes = await agreementApi.getAgreementById(agreementId);
      const latestData = unwrapResponse(checkRes);
      const latestStatus = latestData?.agreementStatus;

      // Kiểm tra theo Enum: Confirmed = 2 (hoặc chuỗi "Confirmed")
      const isConfirmed = latestStatus === "Confirmed" || latestStatus === 2;
      const isAwaitingPayment = latestStatus === "Awaiting_Payment" || latestStatus === 1;

      // Nếu đã được xác nhận / thanh toán rồi (Confirmed = 2)
      if (isConfirmed) {
         setStatusMessage({
           type: "warning",
           text: "⚠️ Hợp đồng này đã được xác nhận và thanh toán trước đó rồi.", 
         });
         await fetchAgreementDetails(false); 
         return; 
      }

      // Nếu không phải trạng thái chờ thanh toán (Awaiting_Payment = 1)
      if (!isAwaitingPayment) {
         setStatusMessage({
           type: "error",
           text: "⚠️ Hợp đồng không còn ở trạng thái chờ thanh toán.", 
         });
         await fetchAgreementDetails(false); 
         return; 
      }

      // Thỏa mãn điều kiện (đang là Awaiting_Payment = 1), cho phép qua trang lựa chọn thanh toán
      router.push({
        pathname: "/payments/checkout",
        params: { agreementId },
      });
    } catch (error: any) {
      setStatusMessage({
        type: "error",
        text: getApiErrorMessage(error, "Không thể kết nối đến máy chủ để kiểm tra trạng thái."),
      });
    } finally {
      setIsProcessing(false);
    }
  }, [agreementId, router, fetchAgreementDetails]);

  const detectChanges = (oldData: any, newData: any): ChangedFields => {
    const diffs: ChangedFields = {};
    const oldDetails = oldData?.agreementDetails || {};
    const newDetails = newData?.agreementDetails || {};

    const rootKeys = ["quantity", "initialPrice", "finalPrice", "paymentType"];
    rootKeys.forEach((key) => {
      if (oldData[key] !== newData[key]) {
        diffs[key] = { old: oldData[key], new: newData[key] };
      }
    });

    const detailKeys = [
      "deliveryMethod",
      "collectionDate",
      "pickupAddress",
      "deliveryAddress",
      "inspectionDate",
      "inspectionAddress",
      "estimatedShippingFee",
      "notes",
    ];
    detailKeys.forEach((key) => {
      if (String(oldDetails[key] || "") !== String(newDetails[key] || "")) {
        diffs[key] = { old: oldDetails[key], new: newDetails[key] };
      }
    });

    return diffs;
  };

  const handleAccept = async () => {
    if (!agreementId) return;

    try {
      setIsProcessing(true);

      const checkRes = await agreementApi.getAgreementById(agreementId);
      const latestData = unwrapResponse(checkRes);

      const diffs = detectChanges(agreementData, latestData);

      const currentUpdatedTime = new Date(
        agreementData?.updatedAt || 0,
      ).getTime();
      const latestUpdatedTime = new Date(latestData?.updatedAt || 0).getTime();

      if (
        Object.keys(diffs).length > 0 ||
        currentUpdatedTime !== latestUpdatedTime
      ) {
        setStatusMessage({
          type: "warning",
          text: "⚠️ Cảnh báo: Đối tác vừa thay đổi thông tin hợp đồng. Các mục bị thay đổi được bôi đỏ bên dưới. Vui lòng kiểm tra lại trước khi xác nhận!",
        });
        setChangedFields(diffs);
        await fetchAgreementDetails(false);
        return;
      }

      setStatusMessage(null);
      setChangedFields(null);

      const acceptRes = await agreementApi.acceptAgreement(agreementId);
      const refreshed = await fetchAgreementDetails(false);

      const nextAgreement =
        refreshed?.agreement || unwrapResponse(acceptRes) || agreementData;
      const nextPreview = refreshed?.preview || previewInfo;
      const nextStatus = normalizeStatus(nextAgreement?.agreementStatus);

      const isAwaitingPayment =
        nextStatus === "awaitingpayment" || nextStatus === "accepted";
      const canPay =
        isAwaitingPayment && isBuyerForAgreement(nextAgreement, nextPreview);

      if (!isAwaitingPayment) {
        setStatusMessage({
          type: "success",
          text: "✅ Bạn đã xác nhận hợp đồng. Đang chờ phía còn lại xác nhận.",
        });
      } else if (!canPay) {
        setStatusMessage({
          type: "success",
          text: "✅ Hai bên đã xác nhận hợp đồng. Đang chờ người mua thanh toán.",
        });
      } else {
        setStatusMessage({
          type: "success",
          text: "✅ Hai bên đã xác nhận hợp đồng. Bạn có thể chuyển sang thanh toán.",
        });
      }
    } catch (error: any) {
      setStatusMessage({
        type: "error",
        text: getApiErrorMessage(error, "Không thể xác nhận hợp đồng."),
      });
      await fetchAgreementDetails(false);
    } finally {
      setIsProcessing(false);
    }
  };

  /* [KHÔNG ĐƯỢC XÓA] - Tạm thời đóng tính năng Yêu cầu chỉnh sửa
  const executeRequestEdit = async () => { ... }
  const handleRequestEdit = async () => { ... }
  */

  // [THÊM MỚI] Hàm xử lý nhảy sang trang Chỉnh sửa
  const executeEdit = () => {
    setIsConfirmingEditConflict(false);
    setChangedFields(null);
    setStatusMessage(null);
    router.push({
      pathname: "/agreements/form",
      params: {
        negotiationId,
        editAgreementId: agreementId,
      },
    });
  };

  const handleEdit = async () => {
    if (!agreementId || !negotiationId) return;

    try {
      setIsProcessing(true);

      // JIT CHECK (Kiểm tra xem đối tác có vừa sửa gì không)
      const checkRes = await agreementApi.getAgreementById(agreementId);
      const latestData = unwrapResponse(checkRes);
      const latestStatus = normalizeStatus(latestData?.agreementStatus);

      if (latestStatus === "awaitingpayment" || latestStatus === "accepted") {
        setStatusMessage({
          type: "warning",
          text: "⚠️ Đối tác đã xác nhận hợp đồng. Không thể chỉnh sửa.",
        });
        await fetchAgreementDetails(false);
        return;
      }

      // [THÊM MỚI] Bắt Conflict khi đối tác cũng vừa sửa
      const diffs = detectChanges(agreementData, latestData);
      const currentUpdatedTime = new Date(
        agreementData?.updatedAt || 0,
      ).getTime();
      const latestUpdatedTime = new Date(latestData?.updatedAt || 0).getTime();

      if (
        Object.keys(diffs).length > 0 ||
        currentUpdatedTime !== latestUpdatedTime
      ) {
        setStatusMessage({
          type: "warning",
          text: "⚠️ Đối tác vừa cập nhật hợp đồng! Các mục thay đổi được bôi đỏ ở trên. Bạn có chắc chắn muốn tiếp tục chỉnh sửa đè lên bản này không?",
        });
        setChangedFields(diffs);
        await fetchAgreementDetails(false); // Cập nhật lại UI để hiển thị bản mới nhất
        setIsConfirmingEditConflict(true); // Bật popup inline xác nhận
        return;
      }

      // Nếu không có conflict, cho phép chuyển sang trang Form luôn
      executeEdit();
    } catch (error: any) {
      setStatusMessage({
        type: "error",
        text: getApiErrorMessage(
          error,
          "Có lỗi xảy ra khi kiểm tra trạng thái hợp đồng.",
        ),
      });
      await fetchAgreementDetails(false);
    } finally {
      setIsProcessing(false);
    }
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

  const renderOldValue = (key: string, formatter?: (val: any) => string) => {
    if (!changedFields || !changedFields[key]) return null;
    const oldVal = changedFields[key].old;
    const displayVal = formatter ? formatter(oldVal) : oldVal || "Chưa có";
    return (
      <View style={styles.changeNote}>
        <Ionicons name="alert-circle" size={12} color={COLORS.error} />
        <Text style={styles.changeNoteText}>Cũ: {displayVal}</Text>
      </View>
    );
  };

  if (isLoading && !agreementData) {
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
          <Ionicons
            name="document-text-outline"
            size={46}
            color={COLORS.textLight}
          />
          <Text style={styles.emptyTitle}>Chưa tải được hợp đồng</Text>
          {statusMessage && (
            <Text style={[styles.inlineMessage, styles.errorText]}>
              {statusMessage.text}
            </Text>
          )}
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => void fetchAgreementDetails()}
          >
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isInspection =
    agreementData.agreementType === "Inspection" ||
    agreementData.agreementType === 0;
  const details = agreementData.agreementDetails || {};
  const status = normalizeStatus(agreementData.agreementStatus);

  const isPending = status === "pending";
  const isAwaitingPayment =
    status === "awaitingpayment" || status === "accepted";

  const sellerId = normalizeId(
    agreementData.sellerId ||
      agreementData.sellerUserId ||
      previewInfo?.sellerId ||
      previewInfo?.sellerUserId,
  );
  const buyerId = normalizeId(
    agreementData.buyerId ||
      agreementData.buyerUserId ||
      previewInfo?.buyerId ||
      previewInfo?.buyerUserId,
  );

  const hasParticipantIds = Boolean(sellerId || buyerId);

  const isSeller = Boolean(
    currentUserId && sellerId && currentUserId === sellerId,
  );
  const isBuyer = Boolean(
    currentUserId && buyerId && currentUserId === buyerId,
  );

  const isParticipant = hasParticipantIds
    ? isSeller || isBuyer
    : Boolean(
        previewInfo?.hasAgreement ||
        previewInfo?.canEdit ||
        previewInfo?.canConfirm ||
        previewInfo?.canRequestEdit ||
        previewInfo?.canPay,
      );

  const sellerConfirmed = Boolean(
    agreementData.sellerConfirmedAt || agreementData.sellerConfirmed,
  );
  const buyerConfirmed = Boolean(
    agreementData.buyerConfirmedAt || agreementData.buyerConfirmed,
  );

  const currentSideConfirmed = isSeller
    ? sellerConfirmed
    : isBuyer
      ? buyerConfirmed
      : false;

  const canEdit =
    isPending &&
    (previewInfo?.canEdit === true || (hasParticipantIds && isParticipant));
  const canAccept =
    isPending &&
    !currentSideConfirmed &&
    (previewInfo?.canConfirm === true || (hasParticipantIds && isParticipant));

  // Tạm ẩn quyền Yêu cầu chỉnh sửa
  // const canRequestEdit = isAwaitingPayment && isParticipant;
  const canPay = isAwaitingPayment && (previewInfo?.canPay === true || isBuyer);

  const hasPendingAction = canEdit || canAccept;
  const hasAwaitingAction = /* canRequestEdit || */ canPay;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Chi tiết hợp đồng" showBack={true} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={24} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Hợp đồng giao dịch</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Mã hợp đồng:</Text>
            <View style={styles.valueWrapper}>
              <Text style={[styles.value, styles.idValue]}>
                {agreementData.agreementId}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Trạng thái hợp đồng:</Text>
            <View style={styles.valueWrapper}>
              <Text style={[styles.value, styles.statusValue]}>
                {translateAgreementStatus(agreementData.agreementStatus)}
              </Text>
            </View>
          </View>

          {Number.isFinite(Number(details.revision)) && (
            <View style={styles.row}>
              <Text style={styles.label}>Phiên bản:</Text>
              <View style={styles.valueWrapper}>
                <Text style={styles.value}>{Number(details.revision)}</Text>
              </View>
            </View>
          )}

          <View style={styles.row}>
            <Text style={styles.label}>Loại giao dịch:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {isInspection ? "Có kiểm định trước" : "Thu gom ngay"}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Hình thức thanh toán:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {agreementData.paymentType === "Deposit"
                  ? "Đặt cọc"
                  : "Toàn phần"}
              </Text>
              {renderOldValue("paymentType", (v) =>
                v === "Deposit" ? "Đặt cọc" : "Toàn phần",
              )}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Số lượng:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>{agreementData.quantity || 1}</Text>
              {renderOldValue("quantity")}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Giá ban đầu:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {formatPrice(agreementData.initialPrice)}
              </Text>
              {renderOldValue("initialPrice", formatPrice)}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Giá chốt giao dịch:</Text>
            <View style={styles.valueWrapper}>
              <Text style={[styles.value, styles.finalPrice]}>
                {formatPrice(agreementData.finalPrice)}
              </Text>
              {renderOldValue("finalPrice", formatPrice)}
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Lịch trình & Giao nhận</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Vận chuyển:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {translateDeliveryMethod(details.deliveryMethod)}
              </Text>
              {renderOldValue("deliveryMethod", translateDeliveryMethod)}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Thời gian thu gom:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {formatDate(details.collectionDate)}
              </Text>
              {renderOldValue("collectionDate", formatDate)}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Địa chỉ lấy:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {details.pickupAddress || "Chưa có"}
              </Text>
              {renderOldValue("pickupAddress")}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Địa chỉ giao:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {details.deliveryAddress || "Chưa có"}
              </Text>
              {renderOldValue("deliveryAddress")}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Thời gian kiểm định:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {formatDate(details.inspectionDate)}
              </Text>
              {renderOldValue("inspectionDate", formatDate)}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Địa điểm kiểm định:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {details.inspectionAddress || "Chưa có"}
              </Text>
              {renderOldValue("inspectionAddress")}
            </View>
          </View>

          {typeof details.estimatedShippingFee === "number" && (
            <View style={styles.row}>
              <Text style={styles.label}>Phí giao hàng dự kiến:</Text>
              <View style={styles.valueWrapper}>
                <Text style={[styles.value, styles.finalPrice]}>
                  {formatPrice(details.estimatedShippingFee)}
                </Text>
                {renderOldValue("estimatedShippingFee", formatPrice)}
              </View>
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Xác nhận & Thời gian</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Ngày tạo hợp đồng:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {formatDate(agreementData.createdAt)}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Người bán xác nhận:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {sellerConfirmed
                  ? formatDate(agreementData.sellerConfirmedAt)
                  : "Chưa xác nhận"}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Người mua xác nhận:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {buyerConfirmed
                  ? formatDate(agreementData.buyerConfirmedAt)
                  : "Chưa xác nhận"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Ghi chú</Text>
          <View>
            <Text style={styles.notesText}>
              {details.notes || "Không có ghi chú"}
            </Text>
            {renderOldValue("notes")}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.reloadRow}>
          <TouchableOpacity
            style={styles.reloadBtn}
            onPress={handleManualReload}
            disabled={isProcessing}
          >
            <Ionicons
              name="sync-outline"
              size={16}
              color={COLORS.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.reloadBtnText}>Làm mới dữ liệu</Text>
          </TouchableOpacity>
        </View>

        {statusMessage && (
          <Text
            style={[
              styles.inlineMessage,
              statusMessage.type === "error"
                ? styles.errorText
                : statusMessage.type === "warning"
                  ? styles.warningText
                  : styles.successText,
            ]}
          >
            {statusMessage.text}
          </Text>
        )}

        {/* [THÊM MỚI] Giao diện hỏi xác nhận khi nhấn Edit mà đối tác vừa sửa xong */}
        {isConfirmingEditConflict ? (
          <View
            style={[
              styles.inlineConfirmation,
              { backgroundColor: "#FFF7ED", borderColor: "#FED7AA" },
            ]}
          >
            <View style={styles.inlineConfirmationHeader}>
              <Ionicons name="alert-circle" size={20} color="#B45309" />
              <Text
                style={[styles.inlineConfirmationTitle, { color: "#B45309" }]}
              >
                Cảnh báo cập nhật đồng thời
              </Text>
            </View>
            <Text style={styles.inlineConfirmationMessage}>
              Dữ liệu trên màn hình đã được làm mới. Bạn có chắc chắn muốn tiếp
              tục vào trang chỉnh sửa và làm mới lại toàn bộ tiến trình không?
            </Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  setIsConfirmingEditConflict(false);
                  setChangedFields(null);
                  setStatusMessage(null);
                }}
                disabled={isProcessing}
              >
                <Text style={styles.secondaryBtnText}>Hủy, để tôi xem lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: "#B45309", borderColor: "#B45309" },
                ]}
                onPress={executeEdit}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>Tiếp tục chỉnh sửa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Chỉ render các nút bên dưới nếu KHÔNG phải đang hỏi xác nhận conflict */}
        {!isConfirmingEditConflict && isPending && (
          <View style={styles.actionRow}>
            {canEdit && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => void handleEdit()}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <Text style={styles.secondaryBtnText}>
                    Chỉnh sửa hợp đồng
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {canAccept && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleAccept}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>Xác nhận hợp đồng</Text>
                )}
              </TouchableOpacity>
            )}

            {!hasPendingAction && (
              <Text style={styles.waitingText}>
                Bạn đã xác nhận. Đang chờ phía còn lại xử lý...
              </Text>
            )}
          </View>
        )}

        {!isConfirmingEditConflict && isAwaitingPayment && (
          <View style={styles.actionRow}>
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
              <Text style={styles.waitingText}>
                Hai bên đã chốt. Đang chờ người mua thanh toán...
              </Text>
            )}
          </View>
        )}

        {!isConfirmingEditConflict && !isPending && !isAwaitingPayment && (
          <Text style={styles.waitingText}>
            Hợp đồng hiện không có thao tác cần xử lý.
          </Text>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
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
  retryBtnText: {
    color: COLORS.white,
    fontWeight: "bold",
  },

  inlineMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    textAlign: "center",
  },
  errorText: {
    color: COLORS.error,
  },
  warningText: {
    color: "#B45309",
    backgroundColor: "#FEF3C7",
    padding: 12,
    borderRadius: 8,
    overflow: "hidden",
  },
  successText: {
    color: "#059669",
  },

  scrollContent: {
    padding: 16,
  },
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
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: COLORS.textLight,
    flex: 1,
  },
  valueWrapper: {
    flex: 2,
    alignItems: "flex-end",
  },
  value: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "500",
    textAlign: "right",
  },
  changeNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FEF2F2",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  changeNoteText: {
    fontSize: 11,
    color: COLORS.error,
    marginLeft: 4,
    fontStyle: "italic",
    fontWeight: "500",
  },
  idValue: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  statusValue: {
    fontWeight: "bold",
    color: COLORS.primary,
  },
  finalPrice: {
    color: COLORS.error,
    fontWeight: "bold",
  },
  notesText: {
    fontSize: 14,
    color: COLORS.text,
    fontStyle: "italic",
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 12,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },

  reloadRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  reloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  reloadBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "600",
  },

  actionRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  inlineConfirmation: {
    backgroundColor: "#EFF6FF",
    borderColor: "#BFDBFE",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    width: "100%",
  },
  inlineConfirmationHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  inlineConfirmationTitle: {
    color: COLORS.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  inlineConfirmationMessage: {
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
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
