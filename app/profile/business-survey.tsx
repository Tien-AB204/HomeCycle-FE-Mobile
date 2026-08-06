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

export default function BusinessSurveyScreen() {
  const router = useRouter();

  // ================= STATE: TÌM KIẾM =================
  const [productSearch, setProductSearch] = useState("");
  const [locationSearch, setLocationSearch] = useState("");

  // ================= STATE: LỰA CHỌN (MULTI-SELECT) =================
  const [selectedProducts, setSelectedProducts] = useState<string[]>([
    "Máy giặt",
    "Tủ lạnh",
  ]);
  const [selectedLocations, setSelectedLocations] = useState<string[]>([
    "TP. Hồ Chí Minh",
    "Bình Dương",
  ]);

  // ================= STATE: LỰA CHỌN (TÌNH TRẠNG & SỐ LƯỢNG) =================
  const [selectedOpStatus, setSelectedOpStatus] = useState<string[]>([
    "Hoạt động tốt",
  ]);
  const [selectedAppStatus, setSelectedAppStatus] = useState<string[]>([
    "Như mới",
    "Trầy xước nhẹ",
  ]);
  const [selectedQuantity, setSelectedQuantity] = useState<string[]>([
    "Số lượng lớn",
  ]); // Yêu cầu bổ sung

  // Hàm Toggle Multi-select
  const toggleSelection = (
    item: string,
    list: string[],
    setList: (val: string[]) => void,
  ) => {
    if (list.includes(item)) {
      setList(list.filter((i) => i !== item));
    } else {
      setList([...list, item]);
    }
  };

  const handleSave = () => {
    console.log({
      products: selectedProducts,
      locations: selectedLocations,
      quantity: selectedQuantity,
      operationalStatus: selectedOpStatus,
      appearanceStatus: selectedAppStatus,
    });
    alert(
      "Thiết lập thành công! Hệ thống sẽ gợi ý bài đăng dựa trên tiêu chí này.",
    );
    router.back();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* Header text */}
          <View style={styles.headerBlock}>
            <Text style={styles.title}>Thiết lập nhận thông báo</Text>
            <Text style={styles.subtitle}>
              Chọn tiêu chí để nhận thông báo khi có bài đăng phù hợp. Có thể
              chỉnh lại sau trong Cài đặt.
            </Text>
          </View>

          {/* ================= 1. LOẠI SẢN PHẨM ================= */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="grid-outline" size={20} color={COLORS.text} />
              <Text style={styles.sectionTitle}>1. Loại sản phẩm quan tâm</Text>
            </View>
            <Text style={styles.sectionSubtitle}>Chọn ít nhất 1 mục</Text>

            <View style={styles.searchBox}>
              <Ionicons
                name="search"
                size={20}
                color={COLORS.textLight}
                style={styles.searchIcon}
              />
              <TextInput
                style={[
                  styles.searchInput,
                  Platform.OS === "web" && ({ outlineStyle: "none" } as any),
                ]}
                placeholder="Tìm loại sản phẩm..."
                value={productSearch}
                onChangeText={setProductSearch}
              />
            </View>

            <View style={styles.chipRow}>
              {["Máy giặt", "Tủ lạnh", "Điều hoà"].map((item) => {
                const isActive = selectedProducts.includes(item);
                return (
                  <TouchableOpacity
                    key={item}
                    style={[styles.chip, isActive && styles.chipActive]}
                    onPress={() =>
                      toggleSelection(
                        item,
                        selectedProducts,
                        setSelectedProducts,
                      )
                    }
                  >
                    {isActive && (
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={COLORS.primary}
                        style={{ marginRight: 4 }}
                      />
                    )}
                    <Text
                      style={[
                        styles.chipText,
                        isActive && styles.chipTextActive,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                );
              })}
              <TouchableOpacity style={styles.chipOutline}>
                <Text style={styles.chipOutlineText}>+ Thêm loại</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.divider} />

          {/* ================= 2. TỈNH / THÀNH PHỐ ================= */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="location-outline" size={20} color={COLORS.text} />
              <Text style={styles.sectionTitle}>2. Tỉnh / thành quan tâm</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Có thể chọn nhiều tỉnh, thành phố
            </Text>

            <View style={styles.searchBox}>
              <Ionicons
                name="search"
                size={20}
                color={COLORS.textLight}
                style={styles.searchIcon}
              />
              <TextInput
                style={[
                  styles.searchInput,
                  Platform.OS === "web" && ({ outlineStyle: "none" } as any),
                ]}
                placeholder="Tìm tỉnh, thành phố..."
                value={locationSearch}
                onChangeText={setLocationSearch}
              />
            </View>

            <View style={styles.chipRow}>
              {selectedLocations.map((item) => (
                <TouchableOpacity
                  key={item}
                  style={styles.chipActive}
                  onPress={() =>
                    toggleSelection(
                      item,
                      selectedLocations,
                      setSelectedLocations,
                    )
                  }
                >
                  <Text style={styles.chipTextActive}>{item}</Text>
                  <Ionicons
                    name="close"
                    size={16}
                    color={COLORS.primary}
                    style={{ marginLeft: 6 }}
                  />
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={styles.divider} />

          {/* ================= MỤC BỔ SUNG: SỐ LƯỢNG THU MUA ================= */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="layers-outline" size={20} color={COLORS.text} />
              <Text style={styles.sectionTitle}>3. Quy mô thu mua</Text>
            </View>
            <Text style={styles.sectionSubtitle}>
              Lựa chọn nhu cầu số lượng thu mua
            </Text>

            <View style={styles.gridContainer}>
              {[
                {
                  label: "Mua lẻ / Ít",
                  sub: "(1 - 5 món)",
                  icon: "cube-outline",
                },
                {
                  label: "Số lượng lớn",
                  sub: "(Thu gom lô / bãi)",
                  icon: "cube",
                },
              ].map((item) => {
                const isActive = selectedQuantity.includes(item.label);
                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.gridBox, isActive && styles.gridBoxActive]}
                    onPress={() =>
                      toggleSelection(
                        item.label,
                        selectedQuantity,
                        setSelectedQuantity,
                      )
                    }
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={24}
                      color={isActive ? COLORS.primary : COLORS.textLight}
                    />
                    <Text
                      style={[
                        styles.gridBoxText,
                        isActive && styles.gridBoxTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                    <Text style={styles.gridBoxSubText}>{item.sub}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={styles.divider} />

          {/* ================= 4. TÌNH TRẠNG SẢN PHẨM ================= */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name="build-outline" size={20} color={COLORS.text} />
              <Text style={styles.sectionTitle}>
                4. Tình trạng sản phẩm chấp nhận
              </Text>
            </View>

            {/* Tình trạng hoạt động */}
            <Text style={styles.subCategoryText}>Tình trạng hoạt động</Text>
            <View style={styles.gridContainer}>
              {[
                { label: "Hoạt động tốt", icon: "checkmark-circle-outline" },
                { label: "Lỗi nhẹ", icon: "alert-circle-outline" },
                { label: "Hỏng, cần sửa", icon: "construct-outline" },
              ].map((item) => {
                const isActive = selectedOpStatus.includes(item.label);
                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.gridBox, isActive && styles.gridBoxActive]}
                    onPress={() =>
                      toggleSelection(
                        item.label,
                        selectedOpStatus,
                        setSelectedOpStatus,
                      )
                    }
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={24}
                      color={isActive ? COLORS.primary : COLORS.textLight}
                    />
                    <Text
                      style={[
                        styles.gridBoxText,
                        isActive && styles.gridBoxTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Tình trạng ngoại hình */}
            <Text style={[styles.subCategoryText, { marginTop: 16 }]}>
              Tình trạng ngoại hình
            </Text>
            <View style={styles.gridContainer}>
              {[
                { label: "Như mới", icon: "sparkles-outline" },
                { label: "Trầy xước nhẹ", icon: "color-wand-outline" },
                { label: "Móp méo, nứt vỡ", icon: "warning-outline" },
              ].map((item) => {
                const isActive = selectedAppStatus.includes(item.label);
                return (
                  <TouchableOpacity
                    key={item.label}
                    style={[styles.gridBox, isActive && styles.gridBoxActive]}
                    onPress={() =>
                      toggleSelection(
                        item.label,
                        selectedAppStatus,
                        setSelectedAppStatus,
                      )
                    }
                  >
                    <Ionicons
                      name={item.icon as any}
                      size={24}
                      color={isActive ? COLORS.primary : COLORS.textLight}
                    />
                    <Text
                      style={[
                        styles.gridBoxText,
                        isActive && styles.gridBoxTextActive,
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          <View style={{ height: 100 }} />
        </ScrollView>

        {/* ================= BOTTOM ACTIONS ================= */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={styles.skipBtn}
            onPress={() => router.back()}
          >
            <Text style={styles.skipBtnText}>Bỏ qua</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
            <Text style={styles.saveBtnText}>Lưu thiết lập</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  scrollContainer: { paddingHorizontal: 20, paddingTop: 30, paddingBottom: 40 },

  headerBlock: { marginBottom: 32 },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: { fontSize: 14, color: COLORS.textLight, lineHeight: 20 },

  section: { marginBottom: 20 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginLeft: 8,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    marginLeft: 28,
    marginBottom: 12,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
    marginBottom: 12,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.text, height: "100%" },

  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  chipActive: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  chipOutline: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },

  chipText: { fontSize: 13, color: "#475569", fontWeight: "500" },
  chipTextActive: { fontSize: 13, color: "#0284C7", fontWeight: "600" },
  chipOutlineText: { fontSize: 13, color: COLORS.text, fontWeight: "500" },

  divider: { height: 1, backgroundColor: "#F1F5F9", marginVertical: 20 },

  subCategoryText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 12,
    marginTop: 8,
  },
  gridContainer: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridBox: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  gridBoxActive: { backgroundColor: "#E0F2FE", borderColor: COLORS.primary },
  gridBoxText: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "500",
    marginTop: 8,
    textAlign: "center",
  },
  gridBoxTextActive: { color: "#0369A1", fontWeight: "700" },
  gridBoxSubText: {
    fontSize: 11,
    color: COLORS.textLight,
    marginTop: 4,
    textAlign: "center",
  },

  bottomBar: {
    flexDirection: "row",
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
    gap: 12,
  },
  skipBtn: {
    flex: 1,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  skipBtnText: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  saveBtn: {
    flex: 2,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#172B30",
  },
  saveBtnText: { fontSize: 15, fontWeight: "bold", color: COLORS.white },
});
