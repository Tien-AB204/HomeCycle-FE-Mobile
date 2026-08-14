import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { COLORS } from "../../src/constants/theme";
import apiClient from "../../src/services/apis/axiosClient";

export default function BusinessPendingScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<any>(null);

  // State quản lý việc ẩn/hiện Modal chi tiết
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  useEffect(() => {
    const fetchPendingData = async () => {
      try {
        const res = await apiClient.get(
          "/business-profiles/registration-detail",
        );
        setData(res.data?.data || res.data);
      } catch (error) {
        console.log("Lỗi lấy dữ liệu chờ duyệt", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchPendingData();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  // Hàm helper để render tên loại tài liệu đính kèm
  const getDocumentName = (type: number) => {
    switch (type) {
      case 0:
        return "CCCD (Mặt trước)";
      case 1:
        return "CCCD (Mặt sau)";
      case 2:
        return "Giấy phép kinh doanh";
      case 3:
        return "Giấy ủy quyền";
      default:
        return "Tài liệu khác";
    }
  };

  // Hàm helper để format địa chỉ kho bãi (Service Areas)
  const getWarehouseAddress = (serviceAreas: any) => {
    if (!serviceAreas) return "Không có";

    // API có thể trả về Object hoặc Array tùy theo BE, ta cover cả 2 trường hợp
    let area = serviceAreas;
    if (Array.isArray(serviceAreas) && serviceAreas.length > 0) {
      area = serviceAreas[0];
    }

    if (area && (area.street || area.ward || area.city)) {
      return [area.street, area.ward, area.city].filter(Boolean).join(", ");
    }

    return "Không có";
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hồ sơ Đang chờ duyệt</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.pendingBanner}>
          <Ionicons name="time" size={48} color="#F59E0B" />
          <Text style={styles.bannerTitle}>Đang chờ Moderator xét duyệt</Text>
          <Text style={styles.bannerText}>
            Hồ sơ doanh nghiệp của bạn đang trong hàng đợi kiểm tra pháp lý.
            Thời gian xử lý từ 24h - 48h làm việc.
          </Text>
        </View>

        {/* Nút Xem Chi Tiết thay vì show nguyên cục Data */}
        {data && (
          <TouchableOpacity
            style={styles.btnOutline}
            onPress={() => setShowDetailsModal(true)}
          >
            <Ionicons
              name="document-text-outline"
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.btnOutlineText}>Xem chi tiết hồ sơ đã nộp</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.btnGoHome}
          onPress={() => router.replace("/(tabs)/profile")}
        >
          <Text style={styles.btnGoHomeText}>Về trang Profile</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* ================= MODAL HIỂN THỊ CHI TIẾT HỒ SƠ ================= */}
      <Modal
        visible={showDetailsModal}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setShowDetailsModal(false)}
      >
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.header}>
            <TouchableOpacity
              onPress={() => setShowDetailsModal(false)}
              style={styles.backButton}
            >
              <Ionicons name="close" size={26} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Chi tiết hồ sơ</Text>
            <View style={{ width: 24 }} />
          </View>

          {data && (
            <ScrollView
              contentContainerStyle={styles.modalScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Thông tin cơ bản</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Mô hình:</Text>
                  <Text style={styles.detailValue}>
                    {data.businessModel === "Enterprise"
                      ? "Doanh nghiệp"
                      : "Hộ kinh doanh"}
                  </Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Tên đăng ký:</Text>
                  <Text style={styles.detailValue}>{data.businessName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Mã số thuế:</Text>
                  <Text style={styles.detailValue}>{data.taxCode}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Địa chỉ trụ sở:</Text>
                  <Text style={styles.detailValue}>{data.businessAddress}</Text>
                </View>

                {/* ĐỊA CHỈ KHO BÃI THÊM VÀO ĐÂY */}
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Địa chỉ kho bãi:</Text>
                  <Text style={styles.detailValue}>
                    {getWarehouseAddress(data.serviceAreas)}
                  </Text>
                </View>

                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Khu vực hoạt động:</Text>
                  <Text style={styles.detailValue}>{data.operatingScope}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>
                  Thông tin người đại diện
                </Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Họ và tên:</Text>
                  <Text style={styles.detailValue}>{data.fullName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Số CCCD:</Text>
                  <Text style={styles.detailValue}>{data.identityNumber}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Ngày sinh:</Text>
                  <Text style={styles.detailValue}>{data.identityDob}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Địa chỉ (CCCD):</Text>
                  <Text style={styles.detailValue}>{data.identityAddress}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Thông tin thanh toán</Text>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Ngân hàng:</Text>
                  <Text style={styles.detailValue}>{data.bankName}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Số tài khoản:</Text>
                  <Text style={styles.detailValue}>{data.accountNumber}</Text>
                </View>
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Chủ tài khoản:</Text>
                  <Text style={styles.detailValue}>{data.accountName}</Text>
                </View>
              </View>

              <View style={styles.detailSection}>
                <Text style={styles.sectionTitle}>Tài liệu đính kèm</Text>
                {data.documents &&
                  data.documents.map((doc: any) => (
                    <View
                      key={doc.businessDocumentId}
                      style={styles.documentItem}
                    >
                      <Text style={styles.documentLabel}>
                        {getDocumentName(doc.documentType)}
                      </Text>
                      <Image
                        source={{ uri: doc.documentUrl }}
                        style={styles.documentImage}
                        resizeMode="contain"
                      />
                    </View>
                  ))}
              </View>

              <View style={{ height: 40 }} />
            </ScrollView>
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  loadingScreen: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  backButton: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  container: { padding: 20 },

  pendingBanner: {
    backgroundColor: "#FEF3C7",
    padding: 32,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 24,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  bannerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#B45309",
    marginTop: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  bannerText: {
    fontSize: 14,
    color: "#92400E",
    textAlign: "center",
    lineHeight: 22,
  },

  btnOutline: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  btnOutlineText: { color: COLORS.primary, fontSize: 15, fontWeight: "bold" },

  btnGoHome: {
    backgroundColor: COLORS.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
  },
  btnGoHomeText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },

  modalScrollContent: { padding: 20 },
  detailSection: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    paddingBottom: 8,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  detailLabel: { fontSize: 13, color: COLORS.textLight, flex: 1 },
  detailValue: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    flex: 2,
    textAlign: "right",
  },

  documentItem: {
    marginBottom: 16,
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  documentLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 8,
    textAlign: "center",
  },
  documentImage: {
    width: "100%",
    height: 200,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
  },
});
