import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../src/constants/theme";

export default function InspectionFormScreen() {
  const router = useRouter();

  // ================= MOCK DATA: THÔNG TIN ĐƠN HÀNG =================
  const orderInfo = {
    id: "ORD-882910",
    productName: "Tủ lạnh Samsung Inverter 236L",
    inspector: "Nhân viên thu mua (Công Ty Ánh Sáng)",
    initialPrice: "3.500.000 đ",
  };

  // ================= STATE: CHECKLIST TÌNH TRẠNG =================
  const [operationalStatus, setOperationalStatus] = useState("");
  const [appearanceStatus, setAppearanceStatus] = useState("");
  const [accessoryStatus, setAccessoryStatus] = useState("");
  const [matchStatus, setMatchStatus] = useState("");

  // ================= STATE: GHI CHÚ & HÌNH ẢNH =================
  const [techNotes, setTechNotes] = useState("");

  // ================= STATE: KẾT LUẬN & GIÁ =================
  const [conclusion, setConclusion] = useState("");
  const [proposedPrice, setProposedPrice] = useState("");

  // Hàm Submit
  const handleSubmit = () => {
    console.log({
      operationalStatus,
      appearanceStatus,
      accessoryStatus,
      matchStatus,
      techNotes,
      conclusion,
      proposedPrice,
    });
    alert("Đã gửi biểu mẫu kiểm định thành công cho người bán!");
    router.back();
  };

  // Component Tái sử dụng: Tiêu đề Mục
  const SectionTitle = ({ title }: { title: string }) => (
    <View style={styles.sectionTitleContainer}>
      <View style={styles.sectionTitleBar} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );

  // Component Tái sử dụng: Nhóm nút chọn nhanh (Chips)
  const OptionGroup = ({
    options,
    selected,
    onSelect,
  }: {
    options: string[];
    selected: string;
    onSelect: (val: string) => void;
  }) => (
    <View style={styles.chipContainer}>
      {options.map((opt, index) => (
        <TouchableOpacity
          key={index}
          style={[styles.chip, selected === opt && styles.chipActive]}
          onPress={() => onSelect(opt)}
        >
          <Text
            style={[styles.chipText, selected === opt && styles.chipTextActive]}
          >
            {opt}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Biểu mẫu Kiểm định</Text>
          <View style={{ width: 28 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Thông tin đơn hàng (Readonly) */}
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Mã đơn hàng:</Text>
              <Text style={styles.infoValue}>{orderInfo.id}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Sản phẩm:</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {orderInfo.productName}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Người kiểm định:</Text>
              <Text style={styles.infoValue} numberOfLines={1}>
                {orderInfo.inspector}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Giá ban đầu:</Text>
              <Text
                style={[
                  styles.infoValue,
                  { color: COLORS.error, fontWeight: "bold" },
                ]}
              >
                {orderInfo.initialPrice}
              </Text>
            </View>
          </View>

          {/* ================= KHỐI 1: CHECKLIST THỰC TẾ ================= */}
          <SectionTitle title="1. TÌNH TRẠNG THỰC TẾ" />

          <Text style={styles.label}>
            Tình trạng hoạt động <Text style={styles.required}>*</Text>
          </Text>
          <OptionGroup
            options={[
              "Hoạt động tốt",
              "Hoạt động nhưng có lỗi nhẹ",
              "Hoạt động không ổn định",
              "Không hoạt động",
              "Không thể kiểm tra",
            ]}
            selected={operationalStatus}
            onSelect={setOperationalStatus}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>
            Tình trạng ngoại quan <Text style={styles.required}>*</Text>
          </Text>
          <OptionGroup
            options={[
              "Nguyên vẹn",
              "Trầy xước nhẹ",
              "Trầy xước nhiều",
              "Biến dạng / Nứt / Vỡ",
              "Có dấu hiệu sửa chữa trước đó",
            ]}
            selected={appearanceStatus}
            onSelect={setAppearanceStatus}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>
            Linh kiện & Phụ kiện <Text style={styles.required}>*</Text>
          </Text>
          <OptionGroup
            options={["Đầy đủ linh kiện", "Thiếu linh kiện"]}
            selected={accessoryStatus}
            onSelect={setAccessoryStatus}
          />

          <Text style={[styles.label, { marginTop: 16 }]}>
            Mức độ khớp với mô tả bài đăng{" "}
            <Text style={styles.required}>*</Text>
          </Text>
          <OptionGroup
            options={[
              "Đúng với mô tả bài đăng",
              "Có khác biệt nhỏ",
              "Có khác biệt đáng kể",
              "Không đúng với mô tả",
            ]}
            selected={matchStatus}
            onSelect={setMatchStatus}
          />

          {/* ================= KHỐI 2: GHI CHÚ & HÌNH ẢNH ================= */}
          <SectionTitle title="2. GHI CHÚ & HÌNH ẢNH" />

          <Text style={styles.label}>Ghi chú kỹ thuật (Tùy chọn)</Text>
          <View
            style={[
              styles.inputContainer,
              { height: 100, alignItems: "flex-start", paddingTop: 12 },
            ]}
          >
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web" && ({ outlineStyle: "none" } as any),
              ]}
              multiline
              placeholder="Mô tả chi tiết lỗi hoặc tình trạng thực tế..."
              value={techNotes}
              onChangeText={setTechNotes}
            />
          </View>

          <Text style={styles.label}>Hình ảnh thực tế (Tối đa 5 ảnh)</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.imageScroll}
          >
            <TouchableOpacity style={styles.addImageBox}>
              <Ionicons
                name="camera-outline"
                size={32}
                color={COLORS.primary}
              />
            </TouchableOpacity>
            <View style={styles.imagePlaceholder}>
              <Ionicons
                name="image-outline"
                size={24}
                color={COLORS.textLight}
              />
            </View>
          </ScrollView>

          {/* ================= KHỐI 3: KẾT LUẬN KIỂM ĐỊNH ================= */}
          <SectionTitle title="3. KẾT LUẬN GIAO DỊCH" />

          <Text style={styles.label}>
            Kết luận cuối cùng <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.conclusionContainer}>
            {["Đạt yêu cầu", "Cần điều chỉnh giá", "Không đạt yêu cầu"].map(
              (opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.conclusionBtn,
                    conclusion === opt && styles.conclusionBtnActive,
                    conclusion === "Không đạt yêu cầu" &&
                      opt === "Không đạt yêu cầu" && {
                        borderColor: COLORS.error,
                        backgroundColor: "#FEF2F2",
                      },
                  ]}
                  onPress={() => setConclusion(opt)}
                >
                  <Ionicons
                    name={
                      opt === "Đạt yêu cầu"
                        ? "checkmark-circle"
                        : opt === "Cần điều chỉnh giá"
                          ? "pricetag"
                          : "close-circle"
                    }
                    size={20}
                    color={
                      conclusion === opt
                        ? opt === "Không đạt yêu cầu"
                          ? COLORS.error
                          : COLORS.primary
                        : COLORS.textLight
                    }
                  />
                  <Text
                    style={[
                      styles.conclusionText,
                      conclusion === opt && styles.conclusionTextActive,
                      conclusion === "Không đạt yêu cầu" &&
                        opt === "Không đạt yêu cầu" && { color: COLORS.error },
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ),
            )}
          </View>

          {/* Hiển thị ô đề xuất giá nếu chọn "Cần điều chỉnh giá" */}
          {conclusion === "Cần điều chỉnh giá" && (
            <View style={styles.priceProposalBox}>
              <Text style={styles.label}>
                Đề xuất giá mới (VNĐ) <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === "web" && ({ outlineStyle: "none" } as any),
                  ]}
                  keyboardType="numeric"
                  placeholder="Nhập mức giá bạn muốn đề xuất..."
                  value={proposedPrice}
                  onChangeText={setProposedPrice}
                />
              </View>
              <Text style={styles.priceNote}>
                Mức giá này sẽ được gửi cho Người bán để xác nhận lại.
              </Text>
            </View>
          )}

          {/* SUBMIT BUTTON */}
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!operationalStatus || !conclusion) && { opacity: 0.5 },
            ]}
            onPress={handleSubmit}
          >
            <Text style={styles.primaryButtonText}>GỬI KẾT QUẢ KIỂM ĐỊNH</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "bold", color: COLORS.text },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },

  infoCard: {
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  infoLabel: { fontSize: 13, color: COLORS.textLight, flex: 1 },
  infoValue: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    flex: 2,
    textAlign: "right",
  },

  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  sectionTitleBar: {
    width: 4,
    height: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitleText: { fontSize: 15, fontWeight: "bold", color: "#334155" },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  required: { color: COLORS.error },

  // Chips
  chipContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "transparent",
  },
  chipActive: { backgroundColor: "#E0F2FE", borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: "#475569", fontWeight: "500" },
  chipTextActive: { color: COLORS.primary, fontWeight: "bold" },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 50,
    backgroundColor: COLORS.white,
  },
  input: { flex: 1, fontSize: 15, color: COLORS.text, height: "100%" },

  imageScroll: { gap: 12, paddingVertical: 8, marginBottom: 16 },
  addImageBox: {
    width: 90,
    height: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: "dashed",
    backgroundColor: "#F0F9FF",
    justifyContent: "center",
    alignItems: "center",
  },
  imagePlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },

  conclusionContainer: { gap: 12, marginBottom: 20 },
  conclusionBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    gap: 12,
  },
  conclusionBtnActive: {
    borderColor: COLORS.primary,
    backgroundColor: "#F0F9FF",
  },
  conclusionText: { fontSize: 14, fontWeight: "600", color: COLORS.textLight },
  conclusionTextActive: { color: COLORS.primary },

  priceProposalBox: {
    backgroundColor: "#FEF9C3",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#FDE047",
  },
  priceNote: {
    fontSize: 12,
    color: "#A16207",
    marginTop: 8,
    fontStyle: "italic",
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 10,
  },
  primaryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },
});
