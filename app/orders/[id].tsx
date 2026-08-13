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
import {
  InlineFeedback,
  useActionFeedback,
} from "../../src/components/shared/ActionFeedback";
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import apiClient from "../../src/services/apis/axiosClient";

const orderApi = {
  getOrderDetail: (orderId: string) =>
    apiClient.get(`/orders/${orderId}`).then((response) => response.data),

  // API lấy tracking vận chuyển theo orderId
  getShipmentTracking: (orderId: string) =>
    apiClient
      .get(`/orders/${orderId}/shipment-tracking`)
      .then((response) => response.data),
};

// Hàm map carrierStatus sang tiếng Việt theo tài liệu GHN
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
  return (
    map[status.toLowerCase()] || "Trạng thái vận chuyển đang được cập nhật"
  );
};

// Hàm map creationStatus
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
  const router = useRouter();
  const { id: orderId } = useLocalSearchParams();

  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>(null);
  const [trackingData, setTrackingData] = useState<any>(null);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);

  const { feedback, clearFeedback, showInfo, showError } = useActionFeedback();

  const fetchOrderDetail = useCallback(async () => {
    if (!orderId) return;
    try {
      setIsLoading(true);
      const res = await orderApi.getOrderDetail(orderId as string);
      const responseData = res?.data || res;
      setData(responseData);

      // Nếu đơn hàng có phương thức giao là GhnDelivery thì gọi thêm tracking
      const deliveryMethod =
        responseData?.shipment?.deliveryMethod ||
        responseData?.order?.deliveryMethod;
      if (orderId) {
        setIsTrackingLoading(true);
        try {
          const trackRes = await orderApi.getShipmentTracking(
            orderId as string,
          );
          setTrackingData(trackRes?.data || trackRes);
        } catch (err) {
          console.log("Không thể tải tracking vận chuyển:", err);
        } finally {
          setIsTrackingLoading(false);
        }
      }
    } catch (error: any) {
      console.error("Lỗi lấy chi tiết đơn hàng:", error);
      const status = error?.response?.status;
      if (status === 500) {
        showError("Lỗi server. Vui lòng thử lại sau.");
      } else {
        showError("Không thể tải dữ liệu đơn hàng lúc này.");
      }
    } finally {
      setIsLoading(false);
    }
  }, [orderId, showError]);

  useFocusEffect(
    useCallback(() => {
      void fetchOrderDetail();
    }, [fetchOrderDetail]),
  );

  const formatCurrency = (value: number) => {
    return value !== undefined && value !== null
      ? new Intl.NumberFormat("vi-VN", {
          style: "currency",
          currency: "VND",
        }).format(value)
      : "0 đ";
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const translatePaymentStatus = (status: number | string) => {
    const s = String(status);
    switch (s) {
      case "0":
        return "Chưa thanh toán đủ / Đang cọc";
      case "1":
        return "Đã thanh toán toàn phần";
      case "2":
        return "Đã hoàn tiền";
      default:
        return "Chưa rõ";
    }
  };

  const handleAction = (actionName: string) => {
    clearFeedback();
    showInfo(`Tính năng "${actionName}" đang được phát triển.`);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết Đơn hàng" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!data || !data.order) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết Đơn hàng" showBack={true} />
        <View style={styles.loadingContainer}>
          <Text style={{ color: COLORS.error, fontSize: 16 }}>
            Không tìm thấy đơn hàng!
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

  const order = data.order;
  const thumbnailUrl = data.thumbnailUrl;
  const productName =
    order.productName || data.postDescription || "Sản phẩm giao dịch";
  const counterpartyName = data.counterpartyName || "Đối tác";
  const negotiationId = data.negotiationId;
  const postId = order.postId;
  const shipment = data.shipment;

  const estimatedShippingFee = Math.max(
    0,
    (order.finalTotalAmount || 0) - (order.originalTotalAmount || 0),
  );

  const currentStatusCode = Number(order.orderStatus ?? 0);
  const isCancelled = currentStatusCode === 3;
  const progressStep = isCancelled
    ? 2
    : currentStatusCode >= 2
      ? 2
      : currentStatusCode;

  // Xử lý thông tin hiển thị vận chuyển từ trackingData (nếu có)
  const isGhn =
    shipment?.deliveryMethod === "GhnDelivery" ||
    trackingData?.deliveryMethod === "GhnDelivery";
  const creationStat = trackingData?.creationStatus;
  const trackingMsg = trackingData?.message;
  const trackingCode = trackingData?.trackingCode;
  const carrierStat = trackingData?.carrierStatus;
  const expectedDate =
    trackingData?.expectedDeliveryAt || shipment?.expectedDeliveryAt;
  const deliveredDate = trackingData?.deliveredAt || shipment?.deliveredAt;
  const lastSynced = trackingData?.lastSyncedAt;
  const isStaleData = trackingData?.isStale === true;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Chi tiết Đơn hàng" showBack={true} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerStatusCard}>
          <View style={styles.statusHeaderRow}>
            <View>
              <Text style={styles.headerCardTitle}>Đơn hàng giao dịch</Text>
              <Text style={styles.orderCodeText}>
                Mã đơn:{" "}
                <Text style={{ fontWeight: "bold" }}>{order.orderCode}</Text>
              </Text>
            </View>
          </View>
        </View>

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
                      isCancelled && index === 2 && styles.circleCancelled,
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
              <Text style={styles.productMeta}>
                Số lượng: {order.quantity || 1}
              </Text>
              <Text style={styles.productPrice}>
                {formatCurrency(order.finalTotalAmount)}
              </Text>
            </View>
            {postId && (
              <Ionicons
                name="chevron-forward"
                size={20}
                color={COLORS.textLight}
              />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thanh toán chi tiết</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Giá trị sản phẩm gốc:</Text>
            <Text style={styles.infoValue}>
              {formatCurrency(order.originalTotalAmount)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phí vận chuyển:</Text>
            <Text style={styles.infoValue}>
              {formatCurrency(estimatedShippingFee)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tổng giá trị đơn:</Text>
            <Text style={[styles.infoValue, { fontWeight: "bold" }]}>
              {formatCurrency(order.finalTotalAmount)}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Đã thanh toán:</Text>
            <Text style={[styles.infoValue, { color: "#10B981" }]}>
              {formatCurrency(order.amountPaid)}
            </Text>
          </View>
          <View style={[styles.infoRow, { marginBottom: 0 }]}>
            <Text style={styles.infoLabel}>Còn lại cần thu:</Text>
            <Text style={[styles.infoValue, { color: COLORS.error }]}>
              {formatCurrency(order.amountRemaining)}
            </Text>
          </View>

          <View style={styles.paymentStatusHighlight}>
            <Text style={styles.paymentStatusLabel}>
              Trạng thái thanh toán:
            </Text>
            <Text style={styles.paymentStatusValue}>
              {translatePaymentStatus(order.paymentStatus)}
            </Text>
          </View>
        </View>

        {/* --- CARD VẬN CHUYỂN & GIAO NHẬN TÍCH HỢP TRACKING GHN --- */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Vận chuyển & Giao nhận</Text>

          {isTrackingLoading ? (
            <View style={{ paddingVertical: 12, alignItems: "center" }}>
              <ActivityIndicator size="small" color={COLORS.primary} />
              <Text
                style={{ fontSize: 12, color: COLORS.textLight, marginTop: 4 }}
              >
                Đang cập nhật trạng thái vận chuyển...
              </Text>
            </View>
          ) : (
            <>
              {/* Cảnh báo nếu isStale = true */}
              {isStaleData && (
                <View style={styles.staleWarningBox}>
                  <Ionicons name="warning-outline" size={16} color="#D97706" />
                  <Text style={styles.staleWarningText}>
                    Không thể kết nối GHN. Đây là trạng thái được cập nhật gần
                    nhất.
                  </Text>
                </View>
              )}

              {/* Nếu là đơn GHN */}
              {isGhn ? (
                <>
                  {/* Trạng thái tạo đơn hoặc trạng thái giao hàng */}
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Trạng thái vận chuyển:</Text>
                    <Text
                      style={[
                        styles.infoValue,
                        { color: COLORS.primary, fontWeight: "bold" },
                      ]}
                    >
                      {creationStat && creationStat !== "Success"
                        ? translateCreationStatus(creationStat)
                        : trackingMsg || translateCarrierStatus(carrierStat)}
                    </Text>
                  </View>

                  {/* Mã vận đơn GHN */}
                  {trackingCode && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Mã vận đơn GHN:</Text>
                      <Text
                        style={[
                          styles.infoValue,
                          { fontWeight: "bold", color: COLORS.text },
                        ]}
                      >
                        {trackingCode}
                      </Text>
                    </View>
                  )}

                  {/* Thời gian giao dự kiến */}
                  {expectedDate && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Dự kiến giao:</Text>
                      <Text style={styles.infoValue}>
                        {formatDate(expectedDate)}
                      </Text>
                    </View>
                  )}

                  {/* Thời gian nhận hàng thực tế */}
                  {deliveredDate && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Thời gian nhận hàng:</Text>
                      <Text style={styles.infoValue}>
                        {formatDate(deliveredDate)}
                      </Text>
                    </View>
                  )}

                  {/* Thời gian đồng bộ gần nhất */}
                  {lastSynced && (
                    <Text style={styles.syncTimeText}>
                      Cập nhật lúc {formatDate(lastSynced)}
                    </Text>
                  )}
                </>
              ) : (
                /* Các phương thức vận chuyển khác */
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Phương thức:</Text>
                  <Text style={[styles.infoValue, { fontWeight: "bold" }]}>
                    {shipment?.deliveryMethod ||
                      order?.deliveryMethod ||
                      "Chưa cập nhật"}
                  </Text>
                </View>
              )}
            </>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Đối tác giao dịch</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Đối tác:</Text>
            <Text
              style={[
                styles.infoValue,
                { fontWeight: "bold", color: COLORS.text },
              ]}
            >
              {counterpartyName}
            </Text>
          </View>

          {negotiationId && (
            <TouchableOpacity
              style={styles.chatButton}
              onPress={() => router.push(`/chat/${negotiationId}`)}
            >
              <Ionicons
                name="chatbubbles-outline"
                size={18}
                color={COLORS.primary}
              />
              <Text style={styles.chatButtonText}>Mở hội thoại chat</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Thời gian</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Ngày tạo đơn:</Text>
            <Text style={styles.infoValue}>{formatDate(order.createdAt)}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Cập nhật lần cuối:</Text>
            <Text style={styles.infoValue}>{formatDate(order.updatedAt)}</Text>
          </View>
          {order.completedAt && (
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Ngày hoàn thành:</Text>
              <Text style={styles.infoValue}>
                {formatDate(order.completedAt)}
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={styles.outlineBtnError}
          onPress={() => handleAction("Hủy đơn hàng")}
        >
          <Text style={styles.outlineBtnErrorText}>Hủy Đơn Hàng</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.outlineBtnWarning}
          onPress={() => handleAction("Báo cáo sự cố")}
        >
          <Text style={styles.outlineBtnWarningText}>Báo Cáo</Text>
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
    padding: 18,
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  statusHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  headerCardTitle: { fontSize: 16, fontWeight: "bold", color: COLORS.white },
  orderCodeText: {
    fontSize: 13,
    color: COLORS.white,
    opacity: 0.85,
  },

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
  },
  infoLabel: { fontSize: 13, color: COLORS.textLight, flex: 1 },
  infoValue: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
    flex: 2,
    textAlign: "right",
  },

  syncTimeText: {
    fontSize: 11,
    color: "#94A3B8",
    fontStyle: "italic",
    textAlign: "right",
    marginTop: 4,
  },
  staleWarningBox: {
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
  staleWarningText: {
    fontSize: 12,
    color: "#92400E",
    flex: 1,
    fontWeight: "500",
  },

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
  chatButtonText: {
    color: COLORS.primary,
    fontWeight: "bold",
    fontSize: 14,
  },

  backBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  bottomBar: {
    flexDirection: "row",
    padding: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  outlineBtnError: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.error,
    justifyContent: "center",
    alignItems: "center",
  },
  outlineBtnErrorText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: "bold",
  },
  outlineBtnWarning: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#F59E0B",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FEF3C7",
  },
  outlineBtnWarningText: { color: "#F59E0B", fontSize: 14, fontWeight: "bold" },
});
