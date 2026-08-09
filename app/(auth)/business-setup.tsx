import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
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
import apiClient from "../../src/services/apis/axiosClient";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "../../src/contexts/AuthContext";

interface Bank {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
}

const appendFileToForm = async (
  formData: FormData,
  key: string,
  fileUri: string,
  defaultName: string
) => {
  if (!fileUri || fileUri === "undefined" || fileUri === "null") return;

  if (Platform.OS === "web") {
    try {
      const response = await fetch(fileUri);
      const blob = await response.blob();
      formData.append(key, blob, defaultName);
    } catch (err) {
      console.error(`Lỗi fetch blob trên web cho ${key}:`, err);
    }
  } else {
    const filename = fileUri.split("/").pop() || defaultName;
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : `image/jpeg`;

    formData.append(key, {
      uri: Platform.OS === "ios" ? fileUri.replace("file://", "") : fileUri,
      name: filename,
      type: type,
    } as any);
  }
};

export default function BusinessSetupScreen() {
  const router = useRouter();
  const { reloadUser } = useAuth(); // Lấy hàm reloadUser để kích hoạt AuthContext

  const [step, setStep] = useState(1);
  const [model, setModel] = useState<"household" | "enterprise" | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // --- FORM STATES ---
  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [identityNumber, setIdentityNumber] = useState("");
  const [identityName, setIdentityName] = useState("");
  const [identityDob, setIdentityDob] = useState("");
  const [identityAddress, setIdentityAddress] = useState("");

  const [ward, setWard] = useState("Phường Mặc Định");
  const [city, setCity] = useState("Hồ Chí Minh");
  const [operatingScope, setOperatingScope] = useState("Toàn quốc");
  const [warehouseAddress, setWarehouseAddress] = useState("");

  const [businessLicense, setBusinessLicense] = useState<string | null>(null);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);

  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankDisplayCode, setBankDisplayCode] = useState("");
  const [bankLogo, setBankLogo] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const [showBankModal, setShowBankModal] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [filteredBanks, setFilteredBanks] = useState<Bank[]>([]);
  const [isBankLoading, setIsBankLoading] = useState(false);
  const [searchBankQuery, setSearchBankQuery] = useState("");

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        setIsBankLoading(true);
        const response = await fetch("https://api.vietqr.io/v2/banks");
        const json = await response.json();
        if (json.code === "00") {
          setBanks(json.data);
          setFilteredBanks(json.data);
        }
      } catch (error) {
        console.error("Lỗi tải danh sách ngân hàng:", error);
      } finally {
        setIsBankLoading(false);
      }
    };
    fetchBanks();
  }, []);

  const handleSearchBank = (text: string) => {
    setSearchBankQuery(text);
    if (text) {
      const lowerText = text.toLowerCase();
      const filtered = banks.filter(
        (b) =>
          b.shortName.toLowerCase().includes(lowerText) ||
          b.name.toLowerCase().includes(lowerText) ||
          b.code.toLowerCase().includes(lowerText)
      );
      setFilteredBanks(filtered);
    } else {
      setFilteredBanks(banks);
    }
  };

  const handleSelectBank = (bank: Bank) => {
    setBankCode(String(bank.bin));
    setBankName(bank.shortName);
    setBankDisplayCode(bank.code);
    setBankLogo(bank.logo);
    setShowBankModal(false);
    setSearchBankQuery("");
    setFilteredBanks(banks);
  };

  const pickImage = async (type: "license" | "front" | "back") => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      const uri = result.assets[0].uri;
      if (type === "license") setBusinessLicense(uri);
      else if (type === "front") setFrontImage(uri);
      else if (type === "back") setBackImage(uri);
    }
  };

  const handleNextToForm = () => {
    if (!model) {
      Platform.OS === "web" ? window.alert("Vui lòng chọn mô hình kinh doanh!") : alert("Vui lòng chọn mô hình kinh doanh!");
      return;
    }
    setStep(2);
  };

  const handleSubmit = async () => {
    if (!fullName.trim() || !businessName.trim() || !taxCode.trim() || !identityNumber.trim() || !identityName.trim()) {
      Platform.OS === "web" ? window.alert("Vui lòng điền đầy đủ các thông tin bắt buộc!") : alert("Vui lòng điền đầy đủ các thông tin bắt buộc!");
      return;
    }

    if (fullName.trim().toLowerCase() !== identityName.trim().toLowerCase()) {
      Platform.OS === "web" ? window.alert("Lỗi: 'Họ và tên người đại diện' bắt buộc phải giống hệt với 'Họ tên trên CCCD'!") : alert("Lỗi: 'Họ và tên người đại diện' bắt buộc phải giống hệt với 'Họ tên trên CCCD'!");
      return;
    }

    if (!businessLicense || !frontImage || !backImage) {
      Platform.OS === "web" ? window.alert("Vui lòng tải lên đầy đủ Giấy chứng nhận ĐKKD và CCCD (2 mặt)!") : alert("Vui lòng tải lên đầy đủ Giấy chứng nhận ĐKKD và CCCD (2 mặt)!");
      return;
    }

    try {
      setIsLoading(true);
      const formData = new FormData();

      formData.append("FullName", fullName.trim());
      formData.append("BusinessName", businessName.trim());
      formData.append("BusinessDescription", model === "household" ? "Hộ kinh doanh" : "Doanh nghiệp");
      formData.append("TaxCode", taxCode.trim());
      formData.append("IdentityNumber", identityNumber.trim());
      formData.append("IdentityName", identityName.trim());
      formData.append("IdentityDob", identityDob ? new Date(identityDob).toISOString() : new Date().toISOString());
      formData.append("IdentityAddress", identityAddress.trim());
      formData.append("BusinessAddress", businessAddress.trim());
      formData.append("Ward", ward);
      formData.append("City", city);
      formData.append("OperatingScope", operatingScope);
      formData.append("BusinessModel", model === "household" ? "0" : "1");

      if (bankCode) formData.append("BankCode", bankCode);
      if (bankName) formData.append("BankName", bankName);
      if (accountNumber) formData.append("AccountNumber", accountNumber.trim());
      if (accountName) formData.append("AccountName", accountName.trim());

      formData.append("Documents[0].DocumentType", "0");
      await appendFileToForm(formData, "Documents[0].DocumentUrl", businessLicense!, "business_license.jpg");

      formData.append("Documents[1].DocumentType", "1");
      await appendFileToForm(formData, "Documents[1].DocumentUrl", frontImage!, "cccd_front.jpg");

      formData.append("Documents[2].DocumentType", "2");
      await appendFileToForm(formData, "Documents[2].DocumentUrl", backImage!, "cccd_back.jpg");

      if (warehouseAddress) {
        formData.append("ServiceAreas[0].City", city);
        formData.append("ServiceAreas[0].District", "Quận trung tâm");
        formData.append("ServiceAreas[0].Ward", warehouseAddress);
      }

      const token = await AsyncStorage.getItem('accessToken');

      if (!token || token === "null") {
        Platform.OS === "web" ? window.alert("Lỗi: Không tìm thấy Token xác thực. Vui lòng đăng nhập lại!") : alert("Lỗi: Không tìm thấy Token xác thực. Vui lòng đăng nhập lại!");
        setIsLoading(false);
        return;
      }

      const response = await apiClient.post("/business-profiles/submit", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          "Authorization": `Bearer ${token}`
        },
        timeout: 60000,
      });

      console.log("[DEBUG] Nộp hồ sơ thành công:", response.data);

      // ========================================================
      // GỌI RELOADUSER ĐỂ AUTHCONTEXT CẬP NHẬT GIAO DIỆN PROFILE
      // ========================================================
      if (reloadUser) {
        await reloadUser();
      }

      setStep(3);

    } catch (error: any) {
      console.error("Lỗi nộp hồ sơ doanh nghiệp:", error.response?.data || error);
      const errorMsg = error.response?.data?.message || "Mạng chậm, upload ảnh thất bại hoặc lỗi server!";
      Platform.OS === "web" ? window.alert(errorMsg) : alert(errorMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoHome = () => {
    router.replace("/(tabs)/profile");
  };

  const handleBack = () => {
    if (step === 2) setStep(1);
    else if (step === 1) router.back();
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <View style={styles.sectionHeaderContainer}>
      <View style={styles.sectionHeaderBar} />
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const UploadBox = ({ icon, text, uri, onPress }: { icon: any; text: string; uri?: string | null; onPress: () => void }) => (
    <TouchableOpacity style={styles.uploadBox} onPress={onPress} disabled={isLoading}>
      {uri ? (
        <Image source={{ uri }} style={styles.uploadedImage} resizeMode="cover" />
      ) : (
        <>
          <Ionicons name={icon} size={24} color={COLORS.primary} style={{ marginBottom: 8 }} />
          <Text style={styles.uploadBoxText}>{text}</Text>
        </>
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>

        {/* CHỈ HIỆN HEADER Ở BƯỚC 1 VÀ 2 */}
        {step < 3 && (
          <View style={styles.header}>
            <TouchableOpacity onPress={handleBack} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>HomeCycle</Text>
            <View style={{ width: 40 }} />
          </View>
        )}

        <ScrollView contentContainerStyle={step === 3 ? styles.successScrollContainer : styles.scrollContainer} showsVerticalScrollIndicator={false}>

          {/* THANH TIẾN TRÌNH */}
          {step < 3 && (
            <View style={styles.progressContainer}>
              <Text style={[styles.progressText, step >= 1 && styles.progressTextActive]}>Chọn loại hình</Text>
              <Text style={styles.progressSeparator}>{">"}</Text>
              <Text style={[styles.progressText, step >= 2 && styles.progressTextActive]}>Thông tin pháp lý</Text>
              <Text style={styles.progressSeparator}>{">"}</Text>
              <Text style={styles.progressText}>Hoàn tất</Text>
            </View>
          )}

          {step < 3 && (
            <View style={styles.modelSelectionWrapper}>
              {step === 1 && (
                <View style={{ alignItems: "center", marginBottom: 24 }}>
                  <Text style={styles.title}>Chọn mô hình kinh doanh</Text>
                  <Text style={styles.subtitle}>Vui lòng chọn mô hình phù hợp để chúng tôi cung cấp biểu mẫu khai báo chính xác.</Text>
                </View>
              )}

              <View style={styles.cardsContainer}>
                <TouchableOpacity
                  style={[styles.card, model === "household" && styles.cardActive, step === 2 && styles.cardLocked]}
                  onPress={() => setModel("household")}
                  disabled={step === 2}
                >
                  <View style={styles.cardIconBox}>
                    <Ionicons name="home-outline" size={24} color={model === "household" ? COLORS.primary : COLORS.textLight} />
                  </View>
                  <Text style={styles.cardTitle}>Hộ kinh doanh</Text>
                  <Text style={styles.cardDesc}>Dành cho cá nhân hoặc hộ gia đình đăng ký kinh doanh nhỏ lẻ.</Text>
                  {model === "household" && step === 1 && (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark" size={14} color={COLORS.white} />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.card, model === "enterprise" && styles.cardActive, step === 2 && styles.cardLocked]}
                  onPress={() => setModel("enterprise")}
                  disabled={step === 2}
                >
                  <View style={styles.cardIconBox}>
                    <Ionicons name="business-outline" size={24} color={model === "enterprise" ? COLORS.primary : COLORS.textLight} />
                  </View>
                  <Text style={styles.cardTitle}>Doanh nghiệp</Text>
                  <Text style={styles.cardDesc}>Dành cho các công ty, tổ chức có pháp nhân và quy mô lớn.</Text>
                  {model === "enterprise" && step === 1 && (
                    <View style={styles.checkBadge}>
                      <Ionicons name="checkmark" size={14} color={COLORS.white} />
                    </View>
                  )}
                </TouchableOpacity>
              </View>

              {step === 1 && (
                <View style={styles.dividerTop}>
                  <TouchableOpacity
                    style={[styles.primaryButton, !model && { backgroundColor: "#A0B4B3" }]}
                    onPress={handleNextToForm}
                    disabled={!model}
                  >
                    <Text style={styles.primaryButtonText}>TIẾP TỤC <Ionicons name="arrow-forward" size={16} /></Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}

          {/* BƯỚC 2: FORM NHẬP LIỆU */}
          {step === 2 && (
            <View style={styles.formContainer}>
              <SectionHeader title="THÔNG TIN ĐỊNH DANH" />
              <Text style={styles.label}>{model === "household" ? "Tên hộ kinh doanh" : "Tên doanh nghiệp đầy đủ"}</Text>
              <TextInput style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]} placeholder="Nhập tên đăng ký kinh doanh" value={businessName} onChangeText={setBusinessName} />

              <Text style={styles.label}>Mã số thuế</Text>
              <TextInput style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]} placeholder="Nhập 10 hoặc 13 số" keyboardType="numeric" value={taxCode} onChangeText={setTaxCode} />

              <Text style={styles.label}>Địa chỉ trụ sở chính / Cơ sở kinh doanh</Text>
              <TextInput style={[styles.input, styles.textArea, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]} placeholder="Số nhà, tên đường, phường/xã..." multiline value={businessAddress} onChangeText={setBusinessAddress} />

              {model === "enterprise" && (
                <>
                  <Text style={styles.label}>Địa chỉ kho bãi (Tùy chọn)</Text>
                  <TextInput style={[styles.input, styles.textArea, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]} placeholder="Nhập địa chỉ kho tập kết hàng hóa" multiline value={warehouseAddress} onChangeText={setWarehouseAddress} />
                </>
              )}

              <SectionHeader title="THÔNG TIN NGƯỜI ĐẠI DIỆN / CHỦ HỘ" />
              <Text style={styles.label}>Họ và tên</Text>
              <TextInput style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]} placeholder="NHẬP ĐẦY ĐỦ HỌ VÀ TÊN" autoCapitalize="characters" value={fullName} onChangeText={setFullName} />
              <Text style={styles.helperText}>*Phải trùng khớp hoàn toàn với CCCD và TK Ngân hàng</Text>

              <Text style={styles.label}>Số CCCD/CMND</Text>
              <TextInput style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]} placeholder="Nhập số căn cước công dân" keyboardType="numeric" value={identityNumber} onChangeText={setIdentityNumber} />

              <Text style={styles.label}>Họ tên trên CCCD</Text>
              <TextInput style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]} placeholder="Nhập họ tên như trên CCCD" value={identityName} onChangeText={setIdentityName} />

              <Text style={styles.label}>Ngày sinh (YYYY-MM-DD)</Text>
              <TextInput style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]} placeholder="VD: 1995-05-20" value={identityDob} onChangeText={setIdentityDob} />

              <Text style={styles.label}>Địa chỉ thường trú (Trên CCCD)</Text>
              <TextInput style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]} placeholder="Nhập địa chỉ thường trú" value={identityAddress} onChangeText={setIdentityAddress} />

              <SectionHeader title="HỒ SƠ PHÁP LÝ" />
              <Text style={styles.label}>{model === "household" ? "Giấy chứng nhận đăng ký hộ kinh doanh" : "Giấy chứng nhận đăng ký doanh nghiệp"}</Text>
              <UploadBox icon="cloud-upload-outline" text="Tải lên file giấy phép kinh doanh" uri={businessLicense} onPress={() => pickImage("license")} />

              <Text style={styles.label}>CCCD/CMND (Mặt trước & Mặt sau)</Text>
              <View style={styles.row}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <UploadBox icon="camera-outline" text="Mặt trước" uri={frontImage} onPress={() => pickImage("front")} />
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <UploadBox icon="camera-outline" text="Mặt sau" uri={backImage} onPress={() => pickImage("back")} />
                </View>
              </View>

              <SectionHeader title="THÔNG TIN THANH TOÁN" />
              <View style={styles.paymentBox}>
                <Text style={styles.label}>Ngân hàng thụ hưởng</Text>
                <TouchableOpacity style={styles.bankSelector} onPress={() => setShowBankModal(true)} disabled={isLoading}>
                  {bankName ? (
                    <View style={styles.selectedBankRow}>
                      {bankLogo && <Image source={{ uri: bankLogo }} style={styles.selectedBankLogo} resizeMode="contain" />}
                      <Text style={styles.inputBankText}>{bankName} ({bankDisplayCode})</Text>
                    </View>
                  ) : (
                    <Text style={styles.placeholderText}>Chọn ngân hàng của bạn...</Text>
                  )}
                  <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
                </TouchableOpacity>

                <Text style={styles.label}>Số tài khoản</Text>
                <TextInput style={[styles.inputPayment, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]} placeholder="Nhập số tài khoản ngân hàng" keyboardType="numeric" value={accountNumber} onChangeText={setAccountNumber} />

                <Text style={styles.label}>Tên chủ tài khoản (Phải khớp với tên ĐN/Đại diện)</Text>
                <TextInput style={[styles.inputPayment, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]} placeholder="VD: NGUYEN VAN A" autoCapitalize="characters" value={accountName} onChangeText={setAccountName} />
              </View>

              <TouchableOpacity style={styles.submitButton} onPress={handleSubmit} disabled={isLoading}>
                {isLoading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitButtonText}>Gửi yêu cầu <Ionicons name="send" size={14} /></Text>}
              </TouchableOpacity>
              <Text style={styles.footerNote}>Bằng cách nhấn gửi, bạn đồng ý với các điều khoản bảo mật thông tin của chúng tôi.</Text>
            </View>
          )}

          {/* BƯỚC 3: MÀN HÌNH CHỜ KIỂM DUYỆT ĐƯỢC LÀM LẠI CHO ĐẸP HƠN */}
          {step === 3 && (
            <View style={styles.successWrapper}>
              <View style={styles.successCard}>
                <View style={styles.iconCircle}>
                  <Ionicons name="time" size={64} color="#0EA5E9" />
                </View>

                <Text style={styles.successTitle}>Nộp hồ sơ thành công!</Text>

                <Text style={styles.successSubtitle}>
                  Tài khoản Doanh nghiệp của bạn đang được đội ngũ HomeCycle xét duyệt.
                </Text>

                <View style={styles.infoBox}>
                  <View style={styles.infoRow}>
                    <Ionicons name="mail-unread-outline" size={20} color={COLORS.textLight} />
                    <Text style={styles.infoText}>Kết quả sẽ được gửi qua Email</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Ionicons name="hourglass-outline" size={20} color={COLORS.textLight} />
                    <Text style={styles.infoText}>Thời gian xử lý: 24h - 48h làm việc</Text>
                  </View>
                </View>

                <TouchableOpacity style={styles.btnGoHome} onPress={handleGoHome}>
                  <Text style={styles.btnGoHomeText}>Về trang Profile</Text>
                  <Ionicons name="arrow-forward" size={18} color={COLORS.white} style={{ marginLeft: 8 }}/>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL CHỌN NGÂN HÀNG */}
      <Modal visible={showBankModal} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn Ngân Hàng</Text>
              <TouchableOpacity onPress={() => setShowBankModal(false)} style={{ padding: 4 }}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBarContainer}>
              <Ionicons name="search" size={20} color={COLORS.textLight} style={{ marginRight: 8 }} />
              <TextInput
                style={[styles.input, { flex: 1, height: "100%", marginBottom: 0, borderWidth: 0, backgroundColor: "transparent" }, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
                placeholder="Tìm tên hoặc mã ngân hàng..."
                value={searchBankQuery}
                onChangeText={handleSearchBank}
              />
            </View>

            {isBankLoading ? (
              <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={filteredBanks}
                keyExtractor={(item) => item.id.toString()}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity style={styles.bankItem} onPress={() => handleSelectBank(item)}>
                    <Image source={{ uri: item.logo }} style={styles.bankLogo} resizeMode="contain" />
                    <View style={styles.bankInfo}>
                      <Text style={styles.bankShortName}>{item.shortName} <Text style={{ color: COLORS.primary }}>({item.code})</Text></Text>
                      <Text style={styles.bankFullName} numberOfLines={1}>{item.name}</Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={() => (
                   <Text style={{textAlign: 'center', marginTop: 40, color: COLORS.textLight}}>Không tìm thấy ngân hàng</Text>
                )}
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 16, marginBottom: 16, paddingHorizontal: 20 },
  backButton: { padding: 8, marginLeft: -8 },
  headerTitle: { fontSize: 20, fontWeight: "700", color: COLORS.primary },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  successScrollContainer: { flexGrow: 1, paddingHorizontal: 20, paddingBottom: 40, justifyContent: 'center' },

  progressContainer: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginBottom: 32 },
  progressText: { fontSize: 12, fontWeight: "600", color: COLORS.textLight },
  progressTextActive: { color: COLORS.primary, fontWeight: "bold" },
  progressSeparator: { marginHorizontal: 8, color: COLORS.textLight, fontSize: 12 },

  modelSelectionWrapper: { width: "100%" },
  title: { fontSize: 22, fontWeight: "bold", color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textLight, textAlign: "center", lineHeight: 20, paddingHorizontal: 20 },

  cardsContainer: { flexDirection: "row", gap: 12, marginBottom: 24 },
  card: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 16, backgroundColor: COLORS.white, position: "relative" },
  cardActive: { borderColor: COLORS.primary, borderWidth: 1.5, backgroundColor: "#FAFAFA" },
  cardLocked: { opacity: 0.6 },
  cardIconBox: { backgroundColor: "#F0F4F4", width: 48, height: 48, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 15, fontWeight: "bold", color: COLORS.text, marginBottom: 6 },
  cardDesc: { fontSize: 12, color: COLORS.textLight, lineHeight: 18 },
  checkBadge: { position: "absolute", top: -8, right: -8, backgroundColor: COLORS.primary, width: 24, height: 24, borderRadius: 12, justifyContent: "center", alignItems: "center", borderWidth: 2, borderColor: COLORS.white },

  formContainer: { marginTop: 16 },
  sectionHeaderContainer: { flexDirection: "row", alignItems: "center", marginBottom: 16, marginTop: 8 },
  sectionHeaderBar: { width: 4, height: 18, backgroundColor: COLORS.primary, marginRight: 8, borderRadius: 2 },
  sectionHeaderText: { fontSize: 14, fontWeight: "bold", color: COLORS.primary, letterSpacing: 0.5 },
  label: { fontSize: 12, fontWeight: "700", color: COLORS.text, marginBottom: 6 },
  helperText: { fontSize: 11, color: COLORS.textLight, fontStyle: "italic", marginTop: -12, marginBottom: 16 },
  row: { flexDirection: "row", justifyContent: "space-between", marginBottom: 16 },

  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, height: 48, fontSize: 14, backgroundColor: COLORS.white, marginBottom: 16 },
  textArea: { height: 80, paddingTop: 12, textAlignVertical: "top" },

  uploadBox: { borderWidth: 1.5, borderColor: COLORS.border, borderStyle: "dashed", borderRadius: 8, height: 100, alignItems: "center", justifyContent: "center", marginBottom: 16, backgroundColor: "#FAFAFA", overflow: "hidden" },
  uploadBoxText: { fontSize: 12, color: COLORS.textLight, textAlign: "center" },
  uploadedImage: { width: "100%", height: "100%" },

  paymentBox: { backgroundColor: "#F0F7F6", padding: 16, borderRadius: 12, marginBottom: 24 },
  inputPayment: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, height: 48, fontSize: 14, backgroundColor: COLORS.white, marginBottom: 12 },
  bankSelector: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, height: 48, backgroundColor: COLORS.white, marginBottom: 12 },
  selectedBankRow: { flex: 1, flexDirection: "row", alignItems: "center" },
  selectedBankLogo: { width: 24, height: 24, marginRight: 8 },
  inputBankText: { fontSize: 14, color: COLORS.text },
  placeholderText: { fontSize: 14, color: COLORS.textLight },

  dividerTop: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 24, marginTop: 8 },
  primaryButton: { backgroundColor: COLORS.primary, height: 52, borderRadius: 12, justifyContent: "center", alignItems: "center", flexDirection: "row" },
  primaryButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "bold", letterSpacing: 0.5 },

  submitButton: { backgroundColor: "#7B1E1E", height: 52, borderRadius: 8, justifyContent: "center", alignItems: "center", marginBottom: 12 },
  submitButtonText: { color: COLORS.white, fontSize: 15, fontWeight: "bold" },
  footerNote: { fontSize: 12, color: COLORS.textLight, textAlign: "center", fontStyle: "italic", paddingHorizontal: 20 },

  // --- STYLE CHO MÀN HÌNH SUCCESS BƯỚC 3 ---
  successWrapper: { flex: 1, justifyContent: "center", alignItems: "center" },
  successCard: { backgroundColor: COLORS.white, width: "100%", padding: 32, borderRadius: 24, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.05, shadowRadius: 20, elevation: 5, borderWidth: 1, borderColor: "#F1F5F9" },
  iconCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: "#F0F9FF", justifyContent: "center", alignItems: "center", marginBottom: 24 },
  successTitle: { fontSize: 22, fontWeight: "800", color: COLORS.text, marginBottom: 12, textAlign: "center" },
  successSubtitle: { fontSize: 15, color: COLORS.textLight, textAlign: "center", lineHeight: 22, marginBottom: 24 },
  infoBox: { backgroundColor: "#F8FAFC", width: "100%", padding: 16, borderRadius: 12, marginBottom: 32, gap: 12 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoText: { fontSize: 14, color: "#475569", fontWeight: "500", flex: 1 },
  btnGoHome: { backgroundColor: COLORS.primary, width: "100%", height: 54, borderRadius: 14, flexDirection: "row", justifyContent: "center", alignItems: "center" },
  btnGoHomeText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, height: "80%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  searchBarContainer: { flexDirection: "row", alignItems: "center", backgroundColor: "#F5F6F8", borderRadius: 12, paddingHorizontal: 12, height: 44, marginBottom: 16 },
  bankItem: { flexDirection: "row", alignItems: "center", paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  bankLogo: { width: 40, height: 40, marginRight: 16, borderRadius: 8, backgroundColor: COLORS.white },
  bankInfo: { flex: 1, justifyContent: "center" },
  bankShortName: { fontSize: 15, fontWeight: "bold", color: COLORS.text, marginBottom: 4 },
  bankFullName: { fontSize: 12, color: COLORS.textLight },
});