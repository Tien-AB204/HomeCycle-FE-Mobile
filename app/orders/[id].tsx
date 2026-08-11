import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  getAgreementById: (agreementId: string) =>
    apiClient
      .get(`/agreements/${agreementId}`)
      .then((response) => response.data),
};

const postApi = {
  getPostById: (postId: string) =>
    apiClient
      .get(`/posts/get-by-id/${postId}`)
      .then((response) => response.data),
};

// CÁC DATA MOCK RANDOM
const MOCK_ORDER_STATUSES = [
  "Chờ xác nhận",
  "Đang xử lý",
  "Đã lấy hàng",
  "Đang giao",
  "Thành công",
];
const MOCK_SHIPPING_STATUSES = [
  "Chưa có thông tin",
  "Đơn vị vận chuyển đang lấy hàng",
  "Đang trung chuyển",
  "Shipper đang giao đến bạn",
];

export default function OrderDetailScreen() {
  const router = useRouter();
  const { id: agreementId } = useLocalSearchParams();
  const { user } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [agreement, setAgreement] = useState<any>(null);
  const [post, setPost] = useState<any>(null);
  const [mockOrderData, setMockOrderData] = useState<any>(null);

  // LOGIC MOCK TINH VI: Lưu hoặc tạo mới data ảo dựa trên agreementId
  const loadOrGenerateMockData = async (agrId: string) => {
    const storageKey = `mock_order_${agrId}`;
    const existing = await AsyncStorage.getItem(storageKey);

    if (existing) {
      return JSON.parse(existing);
    }

    // Nếu chưa có, tạo Random và lưu lại vĩnh viễn cho đơn này
    const newMockData = {
      orderCode: `HC-${Math.floor(10000000 + Math.random() * 90000000)}`, // Random mã đơn HC-12345678
      orderStatus: MOCK_ORDER_STATUSES[Math.floor(Math.random() * 3)], // Ưu tiên các trạng thái đầu
      shippingStatus: MOCK_SHIPPING_STATUSES[Math.floor(Math.random() * 3)],
      // Random ngày hẹn: 1 đến 3 ngày tới
      appointmentDate: new Date(
        Date.now() + 86400000 * (1 + Math.floor(Math.random() * 3)),
      ).toISOString(),
    };

    await AsyncStorage.setItem(storageKey, JSON.stringify(newMockData));
    return newMockData;
  };

  const fetchOrderDetails = useCallback(async () => {
    if (!agreementId) return;
    try {
      setIsLoading(true);

      // 1. Load Data ảo
      const mockData = await loadOrGenerateMockData(agreementId as string);
      setMockOrderData(mockData);

      // 2. Fetch Data thật từ Agreement
      const agrRes = await agreementApi.getAgreementById(agreementId as string);
      const agrData = agrRes?.data || agrRes;
      setAgreement(agrData);

      // 3. Fetch Data thật từ Post
      if (agrData?.postId) {
        const postRes = await postApi.getPostById(agrData.postId);
        setPost(postRes?.data || postRes);
      }
    } catch (error) {
      console.error("Lỗi lấy chi tiết đơn hàng:", error);
      const msg = "Không thể tải dữ liệu đơn hàng lúc này.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Lỗi", msg);
    } finally {
      setIsLoading(false);
    }
  }, [agreementId]);

  useFocusEffect(
    useCallback(() => {
      fetchOrderDetails();
    }, [fetchOrderDetails]),
  );

  const formatCurrency = (value: number) => {
    return value
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

  const handleAction = (actionName: string) => {
    const msg = `Tính năng "${actionName}" đang được phát triển (API chưa sẵn sàng).`;
    Platform.OS === "web" ? window.alert(msg) : Alert.alert("Thông báo", msg);
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

  const isMeBuyer =
    user?.userId === agreement?.buyerId || user?.id === agreement?.buyerId;
  const isInspection = agreement?.agreementType === "Inspection";
  const details = agreement?.agreementDetails || {};

  // Giao diện
  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Chi tiết Đơn hàng" showBack={true} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. TRẠNG THÁI VÀ MÃ ĐƠN (DATA MOCK) */}
        <View style={styles.headerStatusCard}>
          <View style={styles.statusRow}>
            <Text style={styles.statusTitle}>{mockOrderData?.orderStatus}</Text>
            <Ionicons
              name="cube-outline"
              size={40}
              color={COLORS.white}
              style={{ opacity: 0.8 }}
            />
          </View>
          <Text style={styles.orderCodeText}>
            Mã đơn:{" "}
            <Text style={{ fontWeight: "bold" }}>
              {mockOrderData?.orderCode}
            </Text>
          </Text>
          <Text style={styles.shippingStatusText}>
            Vận chuyển: {mockOrderData?.shippingStatus}
          </Text>
        </View>

        {/* 2. THÔNG TIN SẢN PHẨM (DATA THẬT) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="cart-outline" size={16} /> Thông tin Sản phẩm
          </Text>
          <View style={styles.productRow}>
            {post?.medias?.[0]?.url ? (
              <Image
                source={{ uri: post.medias[0].url || post.medias[0].mediaUrl }}
                style={styles.productImg}
              />
            ) : (
              <View style={styles.productImgPlaceholder}>
                <Ionicons name="image-outline" size={24} color="#94A3B8" />
              </View>
            )}
            <View style={styles.productInfo}>
              <Text style={styles.productName} numberOfLines={2}>
                {post?.product?.productName ||
                  post?.productName ||
                  "Sản phẩm không xác định"}
              </Text>
              <Text style={styles.productMeta}>
                Số lượng chốt: {agreement?.quantity || 1}
              </Text>
              <Text style={styles.productPrice}>
                {formatCurrency(agreement?.finalPrice)}
              </Text>
            </View>
          </View>
        </View>

        {/* 3. LỊCH HẸN VÀ GIAO NHẬN (TRỘN THẬT & MOCK) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="calendar-outline" size={16} /> Lịch trình & Giao
            nhận
          </Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Loại giao dịch:</Text>
            <Text style={styles.infoValue}>
              {isInspection ? "Có kiểm định trước" : "Giao hàng ngay"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Lịch hẹn dự kiến:</Text>
            <Text style={styles.infoValue}>
              {formatDate(
                details.inspectionDate ||
                  details.collectionDate ||
                  mockOrderData?.appointmentDate,
              )}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Lấy hàng tại:</Text>
            <Text style={styles.infoValue}>
              {details.pickupAddress || "Chưa cập nhật"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Giao hàng đến:</Text>
            <Text style={styles.infoValue}>
              {details.deliveryAddress || "Chưa cập nhật"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Phương thức giao:</Text>
            <Text style={styles.infoValue}>
              {details.deliveryMethod || "Không rõ"}
            </Text>
          </View>
        </View>

        {/* 4. THÔNG TIN BÊN MUA VÀ BÁN (DATA THẬT) */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            <Ionicons name="people-outline" size={16} /> Đối tác giao dịch
          </Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vai trò của bạn:</Text>
            <Text
              style={[
                styles.infoValue,
                { color: COLORS.primary, fontWeight: "bold" },
              ]}
            >
              {isMeBuyer ? "Người Mua" : "Người Bán"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID Bán:</Text>
            <Text
              style={styles.infoValue}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {agreement?.sellerId}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>ID Mua:</Text>
            <Text
              style={styles.infoValue}
              numberOfLines={1}
              ellipsizeMode="middle"
            >
              {agreement?.buyerId}
            </Text>
          </View>
        </View>

        {/* 5. GHI CHÚ ĐƠN HÀNG */}
        {details.notes && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              <Ionicons name="document-text-outline" size={16} /> Ghi chú
            </Text>
            <Text style={styles.noteText}>{details.notes}</Text>
          </View>
        )}
      </ScrollView>

      {/* FOOTER BUTTONS */}
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
    padding: 20,
    marginBottom: 16,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  statusTitle: { fontSize: 22, fontWeight: "bold", color: COLORS.white },
  orderCodeText: {
    fontSize: 14,
    color: COLORS.white,
    opacity: 0.9,
    marginBottom: 4,
  },
  shippingStatusText: {
    fontSize: 13,
    color: COLORS.white,
    opacity: 0.9,
    fontStyle: "italic",
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

  noteText: {
    fontSize: 13,
    color: COLORS.text,
    fontStyle: "italic",
    lineHeight: 20,
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
