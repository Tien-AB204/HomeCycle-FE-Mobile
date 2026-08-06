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

export default function BusinessSetupScreen() {
  const router = useRouter();

  // Quản lý Step: 1 (Chọn mô hình), 2 (Điền Form), 3 (Chờ duyệt)
  const [step, setStep] = useState(1);
  // Quản lý Mô hình: 'household' (Hộ kinh doanh) hoặc 'enterprise' (Doanh nghiệp)
  const [model, setModel] = useState<"household" | "enterprise" | null>(null);

  const handleNextToForm = () => {
    if (!model) {
      alert("Vui lòng chọn mô hình kinh doanh!");
      return;
    }
    setStep(2);
  };

  const handleSubmit = () => {
    // Tạm thời log ra, thực tế sẽ gọi API nộp hồ sơ ở đây
    console.log("Đã nộp hồ sơ mô hình:", model);
    setStep(3);
  };

  const handleGoHome = () => {
    router.replace("/(tabs)");
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 1) router.back();
  };

  // --- COMPONENT DÙNG CHUNG BÊN TRONG ---

  // Tiêu đề từng khu vực (VD: | THÔNG TIN ĐỊNH DANH)
  const SectionHeader = ({ title }: { title: string }) => (
    <View style={styles.sectionHeaderContainer}>
      <View style={styles.sectionHeaderBar} />
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  // Nút tải file
  const UploadBox = ({ icon, text }: { icon: any; text: string }) => (
    <TouchableOpacity style={styles.uploadBox}>
      <Ionicons
        name={icon}
        size={24}
        color={COLORS.primary}
        style={{ marginBottom: 8 }}
      />
      <Text style={styles.uploadBoxText}>{text}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        {/* Header với nút Back (Ẩn nút Back ở Bước 3) */}
        <View style={styles.header}>
          {step < 3 ? (
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 40 }} />
          )}
          <Text style={styles.headerTitle}>HomeCycle</Text>
          <View style={{ width: 40 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
        >
          {/* THANH TIẾN TRÌNH (Progress Bar) */}
          <View style={styles.progressContainer}>
            <Text
              style={[
                styles.progressText,
                step >= 1 && styles.progressTextActive,
              ]}
            >
              Chọn loại hình
            </Text>
            <Text style={styles.progressSeparator}>{">"}</Text>
            <Text
              style={[
                styles.progressText,
                step >= 2 && styles.progressTextActive,
              ]}
            >
              Thông tin pháp lý
            </Text>
            <Text style={styles.progressSeparator}>{">"}</Text>
            <Text
              style={[
                styles.progressText,
                step === 3 && styles.progressTextActive,
              ]}
            >
              Hoàn tất
            </Text>
          </View>

          {/* BƯỚC 1 & 2: KHU VỰC CHỌN MÔ HÌNH KINH DOANH */}
          {step < 3 && (
            <View style={styles.modelSelectionWrapper}>
              {step === 1 && (
                <View style={{ alignItems: "center", marginBottom: 24 }}>
                  <Text style={styles.title}>Chọn mô hình kinh doanh</Text>
                  <Text style={styles.subtitle}>
                    Vui lòng chọn mô hình phù hợp để chúng tôi cung cấp biểu mẫu
                    khai báo chính xác.
                  </Text>
                </View>
              )}

              <View style={styles.cardsContainer}>
                {/* Thẻ Hộ Kinh Doanh */}
                <TouchableOpacity
                  style={[
                    styles.card,
                    model === "household" && styles.cardActive,
                    step === 2 && styles.cardLocked, // Giảm mờ nếu đang ở Bước 2
                  ]}
                  onPress={() => setModel("household")}
                  disabled={step === 2} // Khóa không cho chọn lại ở Bước 2
                >
                  <View style={styles.cardIconBox}>
                    <Ionicons
                      name="home-outline"
                      size={24}
                      color={
                        model === "household"
                          ? COLORS.primary
                          : COLORS.textLight
                      }
                    />
                  </View>
                  <Text style={styles.cardTitle}>Hộ kinh doanh</Text>
                  <Text style={styles.cardDesc}>
                    Dành cho cá nhân hoặc hộ gia đình đăng ký kinh doanh nhỏ lẻ.
                  </Text>
                  {model === "household" && step === 1 && (
                    <View style={styles.checkBadge}>
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={COLORS.white}
                      />
                    </View>
                  )}
                </TouchableOpacity>

                {/* Thẻ Doanh Nghiệp */}
                <TouchableOpacity
                  style={[
                    styles.card,
                    model === "enterprise" && styles.cardActive,
                    step === 2 && styles.cardLocked,
                  ]}
                  onPress={() => setModel("enterprise")}
                  disabled={step === 2}
                >
                  <View style={styles.cardIconBox}>
                    <Ionicons
                      name="business-outline"
                      size={24}
                      color={
                        model === "enterprise"
                          ? COLORS.primary
                          : COLORS.textLight
                      }
                    />
                  </View>
                  <Text style={styles.cardTitle}>Doanh nghiệp</Text>
                  <Text style={styles.cardDesc}>
                    Dành cho các công ty, tổ chức có pháp nhân và quy mô lớn.
                  </Text>
                  {model === "enterprise" && step === 1 && (
                    <View style={styles.checkBadge}>
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={COLORS.white}
                      />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {/* Nút Tiếp Tục của Bước 1 */}
              {step === 1 && (
                <View style={styles.dividerTop}>
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      !model && { backgroundColor: "#A0B4B3" },
                    ]}
                    onPress={handleNextToForm}
                    disabled={!model}
                  >
                    <Text style={styles.primaryButtonText}>
                      TIẾP TỤC <Ionicons name="arrow-forward" size={16} />
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* BƯỚC 2: FORM THÔNG TIN PHÁP LÝ (Mở rộng bên dưới) */}
          {step === 2 && (
            <View style={styles.formContainer}>
              {/* --- FORM CHO HỘ KINH DOANH --- */}
              {model === "household" && (
                <>
                  <SectionHeader title="THÔNG TIN ĐỊNH DANH" />
                  <Text style={styles.label}>Tên hộ kinh doanh</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập tên đăng ký kinh doanh"
                  />
                  <Text style={styles.label}>Mã số thuế hộ kinh doanh</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập 10 hoặc 13 số"
                    keyboardType="numeric"
                  />
                  <Text style={styles.label}>
                    Địa chỉ, địa điểm kinh doanh cố định
                  </Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Số nhà, tên đường, phường/xã..."
                    multiline
                  />

                  <SectionHeader title="THÔNG TIN CHỦ HỘ" />
                  <Text style={styles.label}>Họ và tên chủ hộ kinh doanh</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="NHẬP ĐẦY ĐỦ HỌ VÀ TÊN"
                    autoCapitalize="characters"
                  />
                  <Text style={styles.helperText}>
                    *Phải trùng khớp hoàn toàn với CCCD và TK Ngân hàng
                  </Text>
                  <Text style={styles.label}>Số CCCD/CMND</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập số căn cước công dân"
                    keyboardType="numeric"
                  />

                  <SectionHeader title="HỒ SƠ PHÁP LÝ" />
                  <Text style={styles.label}>
                    Giấy chứng nhận đăng ký hộ kinh doanh
                  </Text>
                  <UploadBox
                    icon="cloud-upload-outline"
                    text="Tải lên file ảnh hoặc PDF (tối đa 10MB)"
                  />
                  <Text style={styles.label}>CCCD của chủ hộ</Text>
                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <UploadBox icon="camera-outline" text="Mặt trước" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <UploadBox icon="camera-outline" text="Mặt sau" />
                    </View>
                  </View>

                  <SectionHeader title="THÔNG TIN THANH TOÁN" />
                  <View style={styles.paymentBox}>
                    <Text style={styles.label}>Ngân hàng thụ hưởng</Text>
                    <TextInput
                      style={styles.inputPayment}
                      placeholder="VD: Vietcombank, Techcombank..."
                    />
                    <Text style={styles.label}>Số tài khoản</Text>
                    <TextInput
                      style={styles.inputPayment}
                      placeholder="Nhập số tài khoản ngân hàng"
                      keyboardType="numeric"
                    />
                    <Text style={styles.label}>
                      Tên chủ tài khoản (Phải khớp với tên ĐN/Đại diện)
                    </Text>
                    <TextInput
                      style={styles.inputPayment}
                      placeholder="VD: NGUYEN VAN A"
                      autoCapitalize="characters"
                    />
                  </View>
                </>
              )}

              {/* --- FORM CHO DOANH NGHIỆP --- */}
              {model === "enterprise" && (
                <>
                  <SectionHeader title="THÔNG TIN ĐỊNH DANH TỔ CHỨC" />
                  <Text style={styles.label}>Tên doanh nghiệp đầy đủ</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="VD: Công ty TNHH HomeCycle Việt Nam"
                  />
                  <Text style={styles.label}>Mã số thuế doanh nghiệp</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="10 chữ số hoặc 13 chữ số"
                    keyboardType="numeric"
                  />
                  <Text style={styles.label}>Địa chỉ trụ sở chính</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Số nhà, tên đường, phường/xã..."
                    multiline
                  />
                  <View style={styles.rowBetween}>
                    <Text style={styles.label}>Địa chỉ kho bãi</Text>
                    <Text style={styles.helperText}>(Tùy chọn)</Text>
                  </View>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Nhập địa chỉ kho tập kết hàng hóa"
                    multiline
                  />

                  <SectionHeader title="THÔNG TIN NGƯỜI ĐẠI DIỆN" />
                  <Text style={styles.label}>Họ và tên người đại diện</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Nhập đầy đủ họ và tên"
                  />
                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.label}>Chức vụ</Text>
                      <View style={styles.dropdown}>
                        <Text style={styles.dropdownText}>Chọn chức vụ</Text>
                        <Ionicons
                          name="chevron-down"
                          size={16}
                          color={COLORS.textLight}
                        />
                      </View>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.label}>Số CCCD/CMND</Text>
                      <TextInput
                        style={styles.input}
                        placeholder="Số định danh"
                        keyboardType="numeric"
                      />
                    </View>
                  </View>

                  <SectionHeader title="HỒ SƠ PHÁP LÝ" />
                  <Text style={styles.label}>
                    Giấy chứng nhận đăng ký doanh nghiệp
                  </Text>
                  <UploadBox
                    icon="cloud-upload-outline"
                    text="Tải lên file ảnh hoặc PDF (tối đa 10MB)"
                  />
                  <Text style={styles.label}>CCCD/Hộ chiếu người đại diện</Text>
                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <UploadBox icon="camera-outline" text="Mặt trước" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <UploadBox icon="camera-outline" text="Mặt sau" />
                    </View>
                  </View>
                  <View style={styles.rowBetween}>
                    <Text style={styles.label}>
                      Giấy ủy quyền + CCCD người được ủy quyền
                    </Text>
                    <Text style={styles.helperText}>(Tùy chọn)</Text>
                  </View>
                  <UploadBox
                    icon="attach-outline"
                    text="Kéo thả file vào đây để đính kèm"
                  />

                  <SectionHeader title="THÔNG TIN THANH TOÁN" />
                  <View style={styles.paymentBox}>
                    <Text style={styles.label}>Ngân hàng thụ hưởng</Text>
                    <TextInput
                      style={styles.inputPayment}
                      placeholder="VD: Vietcombank, Techcombank..."
                    />
                    <Text style={styles.label}>Số tài khoản</Text>
                    <TextInput
                      style={styles.inputPayment}
                      placeholder="Nhập số tài khoản ngân hàng"
                      keyboardType="numeric"
                    />
                    <Text style={styles.label}>
                      Tên chủ tài khoản (Phải khớp với tên ĐN/Đại diện)
                    </Text>
                    <TextInput
                      style={styles.inputPayment}
                      placeholder="VD: NGUYEN VAN A"
                      autoCapitalize="characters"
                    />
                  </View>
                </>
              )}

              {/* Nút Gửi Yêu Cầu (Màu đỏ mận) */}
              <TouchableOpacity
                style={styles.submitButton}
                onPress={handleSubmit}
              >
                <Text style={styles.submitButtonText}>
                  Gửi yêu cầu <Ionicons name="send" size={14} />
                </Text>
              </TouchableOpacity>
              <Text style={styles.footerNote}>
                Bằng cách nhấn gửi, bạn đồng ý với các điều khoản bảo mật thông
                tin của chúng tôi.
              </Text>
            </View>
          )}

          {/* BƯỚC 3: MÀN HÌNH CHỜ KIỂM DUYỆT */}
          {step === 3 && (
            <View style={styles.successContainer}>
              <View style={styles.hourglassBox}>
                <Ionicons
                  name="hourglass-outline"
                  size={48}
                  color={COLORS.primary}
                />
              </View>
              <Text style={styles.successTitle}>Hồ sơ đang chờ kiểm duyệt</Text>
              <Text style={styles.successSubtitle}>
                Hồ sơ của bạn đã được tiếp nhận và đang chờ đội ngũ Moderator
                kiểm duyệt. Kết quả sẽ được gửi về email trong vòng 24-48h.
              </Text>
              <View style={styles.dividerTop}>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={handleGoHome}
                >
                  <Text style={styles.primaryButtonText}>
                    <Ionicons name="home-outline" size={16} /> VỀ TRANG CHỦ
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// BỘ STYLES CSS
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 16,
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: COLORS.primary },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },

  // Progress Bar
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
  },
  progressText: { fontSize: 12, fontWeight: "600", color: COLORS.textLight },
  progressTextActive: { color: COLORS.primary, fontWeight: "bold" },
  progressSeparator: {
    marginHorizontal: 8,
    color: COLORS.textLight,
    fontSize: 12,
  },

  modelSelectionWrapper: { width: "100%" },
  title: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 20,
    paddingHorizontal: 20,
  },

  // Cards
  cardsContainer: { flexDirection: "row", gap: 12, marginBottom: 24 },
  card: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    backgroundColor: COLORS.white,
    position: "relative",
  },
  cardActive: {
    borderColor: COLORS.primary,
    borderWidth: 1.5,
    backgroundColor: "#FAFAFA",
  },
  cardLocked: { opacity: 0.6 },
  cardIconBox: {
    backgroundColor: "#F0F4F4",
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 6,
  },
  cardDesc: { fontSize: 12, color: COLORS.textLight, lineHeight: 18 },
  checkBadge: {
    position: "absolute",
    top: -8,
    right: -8,
    backgroundColor: COLORS.primary,
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.white,
  },

  // Form chung
  formContainer: { marginTop: 16 },
  sectionHeaderContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  sectionHeaderBar: {
    width: 4,
    height: 18,
    backgroundColor: COLORS.primary,
    marginRight: 8,
    borderRadius: 2,
  },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: "bold",
    color: COLORS.primary,
    letterSpacing: 0.5,
  },
  label: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 6,
  },
  helperText: {
    fontSize: 11,
    color: COLORS.textLight,
    fontStyle: "italic",
    marginTop: -12,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 14,
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },
  textArea: { height: 80, paddingTop: 12, textAlignVertical: "top" },
  dropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: COLORS.white,
  },
  dropdownText: { fontSize: 14, color: COLORS.textLight },

  // Upload Box
  uploadBox: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    backgroundColor: "#FAFAFA",
  },
  uploadBoxText: { fontSize: 12, color: COLORS.textLight, textAlign: "center" },

  // Payment Box (Nền xanh nhạt)
  paymentBox: {
    backgroundColor: "#F0F7F6",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  inputPayment: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 14,
    backgroundColor: COLORS.white,
    marginBottom: 12,
  },

  // Nút bấm & Divider
  dividerTop: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 24,
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },

  submitButton: {
    backgroundColor: "#7B1E1E",
    height: 52,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
  },
  submitButtonText: { color: COLORS.white, fontSize: 15, fontWeight: "bold" },
  footerNote: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: "center",
    fontStyle: "italic",
    paddingHorizontal: 20,
  },

  // Success Screen (Bước 3)
  successContainer: { alignItems: "center", paddingTop: 40 },
  hourglassBox: {
    backgroundColor: "#EFFFFE",
    width: 100,
    height: 100,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 12,
  },
  successSubtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 40,
    paddingHorizontal: 20,
  },
});
