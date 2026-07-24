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
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";

// ================= MOCK DATA: EAV (Entity-Attribute-Value) =================
// Lưu ý: Tạm giữ biến này để render UI thông số động cho đến khi có API
const DYNAMIC_ATTRIBUTES: Record<string, any[]> = {
  "Tủ lạnh": [
    {
      id: "attr_1",
      name: "Dung tích (Lít)",
      type: "number",
      required: true,
      unit: "L",
    },
    {
      id: "attr_2",
      name: "Công suất tiêu thụ",
      type: "text",
      required: false,
      unit: "W",
    },
    {
      id: "attr_3",
      name: "Công nghệ Inverter",
      type: "boolean",
      required: true,
    },
    {
      id: "attr_4",
      name: "Kiểu tủ",
      type: "select",
      options: ["Ngăn đá trên", "Ngăn đá dưới", "Side by side"],
      required: true,
    },
  ],
  "Máy giặt": [
    {
      id: "attr_5",
      name: "Khối lượng giặt",
      type: "number",
      required: true,
      unit: "kg",
    },
    {
      id: "attr_6",
      name: "Lồng giặt",
      type: "select",
      options: ["Cửa trước (Lồng ngang)", "Cửa trên (Lồng đứng)"],
      required: true,
    },
    {
      id: "attr_7",
      name: "Động cơ truyền động",
      type: "select",
      options: ["Trực tiếp", "Dây curoa"],
      required: false,
    },
  ],
};

export default function CreatePostScreen() {
  const router = useRouter();

  // LẤY ROLE THẬT TỪ AUTH CONTEXT
  const { user } = useAuth();
  const userRole = user?.role || "personal";

  // STATE: THÔNG TIN CƠ BẢN
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedProductType, setSelectedProductType] = useState<string>("");

  // STATE: THÔNG SỐ ĐỘNG
  const [attributeValues, setAttributeValues] = useState<Record<string, any>>(
    {},
  );

  const handlePublish = () => {
    console.log("Product Type:", selectedProductType);
    console.log("Dynamic Attributes Data:", attributeValues);
    alert(
      `Đã gửi yêu cầu tạo tin ${userRole === "personal" ? "ĐĂNG BÁN" : "THU MUA"} thành công!`,
    );
    router.back();
  };

  const handleAttributeChange = (attrId: string, value: any) => {
    setAttributeValues((prev) => ({ ...prev, [attrId]: value }));
  };

  const SectionTitle = ({ title }: { title: string }) => (
    <View style={styles.sectionTitleContainer}>
      <View style={styles.sectionTitleBar} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );

  const renderDynamicField = (attr: any) => {
    const value = attributeValues[attr.id] || "";

    return (
      <View key={attr.id} style={styles.dynamicFieldWrapper}>
        <Text style={styles.label}>
          {attr.name}{" "}
          {attr.required ? <Text style={styles.required}>*</Text> : null}
        </Text>

        {attr.type === "boolean" ? (
          <View style={styles.row}>
            <TouchableOpacity
              style={[styles.chip, value === true ? styles.chipActive : null]}
              onPress={() => handleAttributeChange(attr.id, true)}
            >
              <Text
                style={[
                  styles.chipText,
                  value === true ? styles.chipTextActive : null,
                ]}
              >
                Có
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.chip, value === false ? styles.chipActive : null]}
              onPress={() => handleAttributeChange(attr.id, false)}
            >
              <Text
                style={[
                  styles.chipText,
                  value === false ? styles.chipTextActive : null,
                ]}
              >
                Không
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web"
                  ? ({ outlineStyle: "none" } as any)
                  : null,
              ]}
              placeholder={`Nhập ${attr.name.toLowerCase()}...`}
              keyboardType={attr.type === "number" ? "numeric" : "default"}
              value={value}
              onChangeText={(text) => handleAttributeChange(attr.id, text)}
            />
            {attr.unit ? (
              <Text style={styles.unitText}>{attr.unit}</Text>
            ) : null}
            {attr.type === "select" ? (
              <Ionicons
                name="chevron-down"
                size={20}
                color={COLORS.textLight}
              />
            ) : null}
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {userRole === "personal" ? "Đăng tin Bán" : "Tạo tin Thu mua"}
          </Text>
          <TouchableOpacity onPress={handlePublish}>
            <Text style={styles.publishButtonText}>Đăng</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* HÌNH ẢNH SẢN PHẨM */}
          {userRole === "personal" ? (
            <View style={styles.imageSection}>
              <Text style={styles.label}>
                Hình ảnh sản phẩm{" "}
                <Text style={styles.required}>* (2-5 ảnh)</Text>
              </Text>
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
                  <Text style={styles.addImageText}>Thêm ảnh</Text>
                </TouchableOpacity>
                <View style={styles.imagePlaceholder}>
                  <Ionicons
                    name="image-outline"
                    size={24}
                    color={COLORS.textLight}
                  />
                </View>
                <View style={styles.imagePlaceholder}>
                  <Ionicons
                    name="image-outline"
                    size={24}
                    color={COLORS.textLight}
                  />
                </View>
              </ScrollView>
            </View>
          ) : null}

          {/* ================= KHỐI 1: THÔNG TIN CƠ BẢN ================= */}
          <SectionTitle title="THÔNG TIN CƠ BẢN" />

          <Text style={styles.label}>
            {userRole === "personal"
              ? "Tên sản phẩm"
              : "Tiêu đề tin thu mua / Tên sản phẩm"}{" "}
            <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web"
                  ? ({ outlineStyle: "none" } as any)
                  : null,
              ]}
              placeholder="Nhập tiêu đề..."
            />
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                Phân loại chính{" "}
                {userRole === "personal" ? (
                  <Text style={styles.required}>*</Text>
                ) : null}
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === "web"
                      ? ({ outlineStyle: "none" } as any)
                      : null,
                  ]}
                  placeholder="Điện máy/Nội thất..."
                  value={selectedCategory}
                  onChangeText={setSelectedCategory}
                />
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={COLORS.textLight}
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                Loại sản phẩm{" "}
                {userRole === "personal" ? (
                  <Text style={styles.required}>*</Text>
                ) : null}
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === "web"
                      ? ({ outlineStyle: "none" } as any)
                      : null,
                  ]}
                  placeholder="Tủ lạnh, Máy giặt..."
                  value={selectedProductType}
                  onChangeText={setSelectedProductType}
                />
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={COLORS.textLight}
                />
              </View>
            </View>
          </View>

          {/* Gợi ý chọn phân loại nhanh để test Dynamic Fields */}
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 12,
                color: COLORS.textLight,
                alignSelf: "center",
              }}
            >
              Thử chọn loại SP:
            </Text>
            <TouchableOpacity
              style={styles.mockCategoryBtn}
              onPress={() => setSelectedProductType("Tủ lạnh")}
            >
              <Text style={styles.mockCategoryText}>Tủ lạnh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.mockCategoryBtn}
              onPress={() => setSelectedProductType("Máy giặt")}
            >
              <Text style={styles.mockCategoryText}>Máy giặt</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>
            Thương hiệu{" "}
            {userRole === "personal" ? (
              <Text style={styles.required}>*</Text>
            ) : null}
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web"
                  ? ({ outlineStyle: "none" } as any)
                  : null,
              ]}
              placeholder={
                userRole === "personal" ? "VD: Samsung..." : "Tất cả / Sony..."
              }
            />
          </View>

          <Text style={styles.label}>
            Mô tả chi tiết{" "}
            {userRole === "personal" ? (
              <Text style={styles.required}>*</Text>
            ) : null}
          </Text>
          <View
            style={[
              styles.inputContainer,
              { height: 100, alignItems: "flex-start", paddingTop: 12 },
            ]}
          >
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web"
                  ? ({ outlineStyle: "none" } as any)
                  : null,
              ]}
              multiline
              placeholder="Mô tả tình trạng, đặc điểm nổi bật..."
            />
          </View>

          {/* ================= KHỐI ĐỘNG: THÔNG SỐ CHUYÊN BIỆT (EAV) ================= */}
          {selectedProductType && DYNAMIC_ATTRIBUTES[selectedProductType] ? (
            <View style={styles.dynamicSection}>
              <SectionTitle title="THÔNG SỐ CHI TIẾT" />
              <View style={styles.dynamicGrid}>
                {DYNAMIC_ATTRIBUTES[selectedProductType].map(
                  renderDynamicField,
                )}
              </View>
            </View>
          ) : null}

          {/* ================= KHỐI 3: TÌNH TRẠNG & THÔNG SỐ CHUNG ================= */}
          <SectionTitle title="TÌNH TRẠNG CHUNG" />

          {userRole === "personal" ? (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  Kích thước (DxRxC) <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web"
                        ? ({ outlineStyle: "none" } as any)
                        : null,
                    ]}
                    placeholder="VD: 120x60x80 cm"
                  />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Cân nặng (kg)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web"
                        ? ({ outlineStyle: "none" } as any)
                        : null,
                    ]}
                    keyboardType="numeric"
                    placeholder="VD: 15"
                  />
                </View>
              </View>
            </View>
          ) : null}

          <Text style={styles.label}>
            Tình trạng sản phẩm <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web"
                  ? ({ outlineStyle: "none" } as any)
                  : null,
              ]}
              placeholder={
                userRole === "personal"
                  ? "Hoạt động tốt / Hư nhẹ..."
                  : "Tất cả tình trạng..."
              }
            />
            <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
          </View>

          <Text style={styles.label}>
            Thời gian đã sử dụng <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web"
                  ? ({ outlineStyle: "none" } as any)
                  : null,
              ]}
              placeholder="Dưới 1 tháng, Trên 1 năm..."
            />
            <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
          </View>

          {/* ================= KHỐI 4: GIAO DỊCH & MỨC GIÁ ================= */}
          <SectionTitle title="GIAO DỊCH & MỨC GIÁ" />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                {userRole === "personal"
                  ? "Giá mong muốn"
                  : "Khoảng giá dự kiến"}{" "}
                <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === "web"
                      ? ({ outlineStyle: "none" } as any)
                      : null,
                  ]}
                  keyboardType="numeric"
                  placeholder={
                    userRole === "personal" ? "VNĐ" : "VD: 1tr - 2tr"
                  }
                />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                Số lượng <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === "web"
                      ? ({ outlineStyle: "none" } as any)
                      : null,
                  ]}
                  keyboardType="numeric"
                  placeholder="Nhập SL..."
                />
              </View>
            </View>
          </View>

          <Text style={styles.label}>
            Khu vực giao dịch <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web"
                  ? ({ outlineStyle: "none" } as any)
                  : null,
              ]}
              placeholder="Chọn khu vực..."
            />
            <Ionicons
              name="location-outline"
              size={20}
              color={COLORS.textLight}
            />
          </View>

          <Text style={styles.label}>Mức độ ưu tiên</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web"
                  ? ({ outlineStyle: "none" } as any)
                  : null,
              ]}
              placeholder="Không / Bán gấp / Thanh lý SLL..."
            />
            <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
          </View>

          {userRole === "business" ? (
            <>
              <Text style={styles.label}>
                Thời hạn tin thu mua <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === "web"
                      ? ({ outlineStyle: "none" } as any)
                      : null,
                  ]}
                  placeholder="1 tuần / 1 tháng / Đến khi đủ SL..."
                />
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={COLORS.textLight}
                />
              </View>
            </>
          ) : null}
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
  publishButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  scrollContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 40 },

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
  sectionTitleText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#334155",
    textTransform: "uppercase",
  },

  imageSection: { marginTop: 8 },
  imageScroll: { gap: 12, paddingVertical: 8 },
  addImageBox: {
    width: 100,
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: "dashed",
    backgroundColor: "#F0F9FF",
    justifyContent: "center",
    alignItems: "center",
  },
  addImageText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "600",
    marginTop: 4,
  },
  imagePlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 12,
    backgroundColor: "#F1F5F9",
    justifyContent: "center",
    alignItems: "center",
  },

  label: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  required: { color: COLORS.error, fontWeight: "normal" },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 50,
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },
  input: { flex: 1, fontSize: 15, color: COLORS.text, height: "100%" },
  row: { flexDirection: "row", gap: 12 },
  unitText: { fontSize: 14, color: COLORS.textLight, marginLeft: 8 },

  dynamicSection: {
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 12,
    marginHorizontal: -12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    marginTop: 8,
  },
  dynamicGrid: { gap: 4 },
  dynamicFieldWrapper: { marginBottom: 8 },
  chip: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  chipActive: { backgroundColor: "#E0F2FE", borderColor: COLORS.primary },
  chipText: { fontSize: 14, color: COLORS.textLight, fontWeight: "500" },
  chipTextActive: { color: COLORS.primary, fontWeight: "bold" },

  mockCategoryBtn: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  mockCategoryText: { fontSize: 12, color: "#475569", fontWeight: "500" },
});
