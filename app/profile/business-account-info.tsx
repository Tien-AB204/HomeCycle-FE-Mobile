import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../../src/constants/theme";
import apiClient from "../../src/services/apis/axiosClient";

export default function BusinessAccountInfoScreen() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await apiClient.get("/business-profiles");
        setData(res.data?.data || res.data);
      } catch (e) {
        console.log("Lỗi fetch business profile:", e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchProfile();
  }, []);

  const SectionTitle = ({ title }: { title: string }) => (
    <View style={styles.sectionTitleContainer}>
      <View style={styles.sectionTitleBar} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  if (!data)
    return (
      <SafeAreaView style={styles.safeArea}>
        <Text style={{ textAlign: "center", marginTop: 20 }}>
          Không thể tải hồ sơ.
        </Text>
      </SafeAreaView>
    );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Hồ sơ Doanh nghiệp</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatarContainer}>
          <View style={styles.avatarPlaceholder}>
            <Ionicons
              name="business-outline"
              size={40}
              color={COLORS.textLight}
            />
          </View>
          <Text style={styles.avatarLabel}>{data.businessName}</Text>
          <View
            style={{ flexDirection: "row", alignItems: "center", marginTop: 8 }}
          >
            <Ionicons name="shield-checkmark" size={16} color="#10B981" />
            <Text
              style={{
                color: "#10B981",
                fontSize: 13,
                fontWeight: "bold",
                marginLeft: 4,
              }}
            >
              Hồ sơ đã được xác thực pháp lý
            </Text>
          </View>
        </View>

        <SectionTitle title="THÔNG TIN CƠ BẢN" />
        <View style={styles.infoBlock}>
          <Text style={styles.label}>Tên doanh nghiệp / Hộ kinh doanh</Text>
          <Text style={styles.value}>{data.businessName}</Text>

          <Text style={styles.label}>Mã số thuế</Text>
          <Text style={styles.value}>
            ***{data.taxCode?.slice(-4) || "N/A"}
          </Text>

          <Text style={styles.label}>Địa chỉ Trụ sở</Text>
          <Text style={styles.value}>{data.businessAddress}</Text>
        </View>

        <SectionTitle title="THÔNG TIN NGƯỜI ĐẠI DIỆN" />
        <View style={styles.infoBlock}>
          <Text style={styles.label}>Họ và tên</Text>
          <Text style={styles.value}>{data.fullName}</Text>

          <Text style={styles.label}>Số CCCD/CMND</Text>
          <Text style={styles.value}>
            ***{data.identityNumber?.slice(-4) || "N/A"}
          </Text>
        </View>

        <SectionTitle title="THÔNG TIN NGÂN HÀNG" />
        <View style={styles.infoBlock}>
          <Text style={styles.label}>Ngân hàng thụ hưởng</Text>
          <Text style={styles.value}>
            {data.bankAccount?.bankName || "Chưa cập nhật"}
          </Text>

          <Text style={styles.label}>Số tài khoản</Text>
          <Text style={styles.value}>
            ***{data.bankAccount?.accountNumber?.slice(-4) || "N/A"}
          </Text>

          <Text style={styles.label}>Chủ tài khoản</Text>
          <Text style={styles.value}>
            {data.bankAccount?.accountName || "N/A"}
          </Text>
        </View>

        <TouchableOpacity style={styles.surveyButton}>
          <Ionicons
            name="document-text-outline"
            size={20}
            color={COLORS.primary}
          />
          <Text style={styles.surveyButtonText}>
            Xem lại bản Khảo sát thu mua
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  avatarContainer: { alignItems: "center", marginTop: 24, marginBottom: 16 },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  avatarLabel: {
    fontSize: 18,
    color: COLORS.text,
    marginTop: 12,
    fontWeight: "bold",
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitleBar: {
    width: 4,
    height: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitleText: { fontSize: 15, fontWeight: "bold", color: "#334155" },
  infoBlock: {
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  label: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  value: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 16,
  },
  surveyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 32,
    padding: 16,
    borderRadius: 12,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
  },
  surveyButtonText: {
    color: COLORS.primary,
    fontWeight: "bold",
    fontSize: 15,
    marginLeft: 8,
  },
});
