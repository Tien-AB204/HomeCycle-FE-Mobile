// app/(auth)/verification-setup.tsx
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  Alert, // Dùng Alert chuẩn trên RN hoặc window.confirm cho web
} from "react-native";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { authApi } from "../../src/services/apis/authApi";

interface Bank {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
}

// HÀM CHUYỂN ĐỔI URI THÀNH FILE/BLOB CHUẨN ĐỂ GỬI LÊN MULTIPART FORM-DATA
const appendFileToForm = async (
  formData: FormData,
  key: string,
  fileUri: string,
  defaultName: string
) => {
  if (!fileUri || fileUri === "undefined" || fileUri === "null") return;

  console.log(`[DEBUG] Đang xử lý file cho trường [${key}] với uri:`, fileUri);

  if (Platform.OS === "web") {
    try {
      const response = await fetch(fileUri);
      const blob = await response.blob();
      formData.append(key, blob, defaultName);
      console.log(`[DEBUG] Đã đính kèm file Web thành công cho ${key}`);
    } catch (err) {
      console.error(`[DEBUG] Lỗi fetch blob trên web cho ${key}:`, err);
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
    console.log(`[DEBUG] Đã đính kèm file Mobile thành công cho ${key}`, { name: filename, type });
  }
};

export default function VerificationSetupScreen() {
  const router = useRouter();
  const { login } = useAuth();

  const {
    email,
    registrationToken,
    password,
    fullName,
    username,
    phoneNumber,
    avatarUri,
  } = useLocalSearchParams();

  const [isLoading, setIsLoading] = useState(false);

  // State Hồ sơ pháp lý
  const [repCode, setRepCode] = useState("");
  const [repName, setRepName] = useState("");
  const [repDob, setRepDob] = useState("");
  const [repAddress, setRepAddress] = useState("");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);

  // State Ngân hàng
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankDisplayCode, setBankDisplayCode] = useState("");
  const [bankLogo, setBankLogo] = useState<string | null>(null);
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");

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
          b.code.toLowerCase().includes(lowerText),
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

  const pickImage = async (side: "front" | "back") => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (!result.canceled) {
      if (side === "front") setFrontImage(result.assets[0].uri);
      else setBackImage(result.assets[0].uri);
    }
  };

  // --- HÀM XÁC NHẬN VÀ GỬI ĐĂNG KÝ ---
  const executeRegistration = async (includeVerification: boolean) => {
    // Kiểm tra nếu chưa chọn avatar thì bật cảnh báo
    const hasAvatar = avatarUri && avatarUri !== "undefined" && avatarUri !== "null" && String(avatarUri).trim() !== "";
    
    if (!hasAvatar) {
      const confirmSkip = Platform.OS === 'web' 
        ? window.confirm("Bạn chưa chọn ảnh đại diện. Xác nhận bỏ qua avatar?")
        : await new Promise((resolve) => {
            Alert.alert(
              "Thiếu ảnh đại diện",
              "Bạn chưa chọn ảnh đại diện. Xác nhận bỏ qua avatar?",
              [
                { text: "Không", onPress: () => resolve(false), style: "cancel" },
                { text: "Có, tiếp tục", onPress: () => resolve(true) }
              ]
            );
          });

      if (!confirmSkip) {
        return; // Dừng lại để người dùng quay lại chọn ảnh
      }
    }

    if (includeVerification) {
      const hasBankData = bankCode || bankAccount || bankAccountName;
      if (hasBankData && (!bankCode || !bankAccount || !bankAccountName)) {
        alert("Vui lòng nhập ĐẦY ĐỦ Số tài khoản và Tên chủ tài khoản ngân hàng!");
        return;
      }

      const hasCccdData = repCode || repName || repDob || repAddress;
      if (hasCccdData && (!repCode || !repName || !repDob || !repAddress)) {
        alert("Vui lòng điền ĐẦY ĐỦ 4 trường thông tin của CCCD!");
        return;
      }
    }

    try {
      setIsLoading(true);
      const formData = new FormData();

      // LOG THÔNG TIN CƠ BẢN ĐỂ DEBUG
      console.log("[DEBUG REGISTRATION] Params nhận được:", {
        username,
        email,
        phoneNumber,
        fullName,
        avatarUri,
      });

      formData.append("Username", username as string);
      formData.append("Password", password as string);
      formData.append("PhoneNumber", phoneNumber as string);
      formData.append("FullName", fullName as string);

      // ĐÍNH KÈM AVATAR CHUẨN XÁC
      if (hasAvatar) {
        await appendFileToForm(formData, "AvatarUrl", avatarUri as string, "avatar.jpg");
      }

      // GẮN XÁC MINH
      if (includeVerification) {
        if (repCode.trim()) formData.append("RepresentativeCode", repCode.trim());
        if (repName.trim()) formData.append("RepresentativeName", repName.trim());
        if (repDob.trim()) formData.append("RepresentativeDob", repDob.trim());
        if (repAddress.trim()) formData.append("RepresentativeAddress", repAddress.trim());

        if (bankCode.trim()) formData.append("BankCode", bankCode.trim());
        if (bankName.trim()) formData.append("BankName", bankName.trim());
        if (bankAccount.trim()) formData.append("AccountNumber", bankAccount.trim());
        if (bankAccountName.trim()) formData.append("AccountName", bankAccountName.trim());

        if (frontImage) await appendFileToForm(formData, "FrontIDCardImage", frontImage, "front.jpg");
        if (backImage) await appendFileToForm(formData, "BackIDCardImage", backImage, "back.jpg");
      }

      const response = await authApi.registerPersonal(registrationToken as string, formData);
      console.log("[DEBUG REGISTRATION RESPONSE]:", response.data);
      
      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        const realEmail = response.data?.data?.user?.email || email;
        if (realEmail && password) {
          await login(realEmail as string, password as string);
        } else {
          throw new Error("Thiếu thông tin đăng nhập tự động");
        }
      } catch (loginErr) {
        console.error("Lỗi Auto-login:", loginErr);
        alert("Tạo tài khoản thành công! Vui lòng đăng nhập lại.");
        router.replace("/(auth)/login");
      }
    } catch (error: any) {
      console.error("Lỗi đăng ký API:", error.response || error);
      alert(error.response?.data?.message || "Có lỗi xảy ra khi tạo tài khoản!");
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.headerCenter}>
            <Ionicons name="shield-checkmark" size={48} color="#27AE60" style={{ marginBottom: 8 }} />
            <Text style={styles.title}>Xác minh & Thanh toán</Text>
            <Text style={styles.subtitle}>Bước 2/2: Bổ sung để tăng uy tín và nhận tiền bán hàng. Có thể thiết lập sau.</Text>
          </View>

          {/* ================= HỒ SƠ PHÁP LÝ ================= */}
          <View style={styles.sectionHeader}>
            <View style={styles.verticalBar} />
            <Text style={styles.sectionTitle}>HỒ SƠ PHÁP LÝ</Text>
          </View>

          <Text style={styles.fieldLabel}>Số CCCD/CMND</Text>
          <View style={styles.inputContainerWhite}>
            <TextInput
              style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
              placeholder="Nhập số CCCD (12 số)..."
              placeholderTextColor={COLORS.textLight}
              keyboardType="numeric"
              value={repCode}
              onChangeText={setRepCode}
              editable={!isLoading}
            />
          </View>

          <Text style={styles.fieldLabel}>Họ và tên (Theo CCCD)</Text>
          <View style={styles.inputContainerWhite}>
            <TextInput
              style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
              placeholder="VD: NGUYEN VAN A"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="characters"
              value={repName}
              onChangeText={setRepName}
              editable={!isLoading}
            />
          </View>

          <Text style={styles.fieldLabel}>Ngày sinh (YYYY-MM-DD)</Text>
          <View style={styles.inputContainerWhite}>
            <TextInput
              style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
              placeholder="VD: 2000-01-25"
              placeholderTextColor={COLORS.textLight}
              value={repDob}
              onChangeText={setRepDob}
              editable={!isLoading}
            />
          </View>

          <Text style={styles.fieldLabel}>Địa chỉ thường trú</Text>
          <View style={styles.inputContainerWhite}>
            <TextInput
              style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
              placeholder="Nhập địa chỉ theo CCCD..."
              placeholderTextColor={COLORS.textLight}
              value={repAddress}
              onChangeText={setRepAddress}
              editable={!isLoading}
            />
          </View>

          <Text style={styles.fieldLabel}>Hình ảnh CCCD</Text>
          <View style={styles.cccdContainer}>
            <TouchableOpacity style={styles.cccdUploadBox} onPress={() => pickImage("front")} disabled={isLoading}>
              {frontImage ? (
                <Image source={{ uri: frontImage }} style={styles.cccdImage} resizeMode="cover" />
              ) : (
                <><Ionicons name="camera-outline" size={24} color={COLORS.textLight} /><Text style={styles.cccdUploadText}>Mặt trước</Text></>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cccdUploadBox} onPress={() => pickImage("back")} disabled={isLoading}>
              {backImage ? (
                <Image source={{ uri: backImage }} style={styles.cccdImage} resizeMode="cover" />
              ) : (
                <><Ionicons name="camera-outline" size={24} color={COLORS.textLight} /><Text style={styles.cccdUploadText}>Mặt sau</Text></>
              )}
            </TouchableOpacity>
          </View>

          {/* ================= THÔNG TIN THANH TOÁN ================= */}
          <View style={styles.sectionHeader}>
            <View style={styles.verticalBar} />
            <Text style={styles.sectionTitle}>THÔNG TIN THANH TOÁN</Text>
          </View>

          <View style={styles.paymentWrapper}>
            <Text style={styles.fieldLabel}>Ngân hàng thụ hưởng</Text>
            <TouchableOpacity style={styles.bankSelector} onPress={() => setShowBankModal(true)} disabled={isLoading}>
              {bankName ? (
                <View style={styles.selectedBankRow}>
                  {bankLogo && <Image source={{ uri: bankLogo }} style={styles.selectedBankLogo} resizeMode="contain" />}
                  <Text style={styles.input}>{bankName} ({bankDisplayCode})</Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>Chọn ngân hàng của bạn...</Text>
              )}
              <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>Số tài khoản</Text>
            <View style={styles.inputContainerWhite}>
              <TextInput
                style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
                placeholder="Nhập số tài khoản..."
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                value={bankAccount}
                onChangeText={setBankAccount}
                editable={!isLoading}
              />
            </View>

            <Text style={styles.fieldLabel}>Tên chủ tài khoản (Khớp với CCCD)</Text>
            <View style={styles.inputContainerWhite}>
              <TextInput
                style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
                placeholder="VD: NGUYEN VAN A"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="characters"
                value={bankAccountName}
                onChangeText={setBankAccountName}
                editable={!isLoading}
              />
            </View>
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={() => executeRegistration(true)} disabled={isLoading}>
             {isLoading ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>HOÀN THÀNH</Text>}
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={() => executeRegistration(false)} disabled={isLoading}>
            <Text style={styles.skipButtonText}>Bỏ qua & Đăng ký ngay</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* ================= MODAL CHỌN NGÂN HÀNG ================= */}
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
                style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]} 
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
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  backButton: { padding: 4, marginLeft: -4, alignSelf: "flex-start" },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  headerCenter: { alignItems: "center", marginBottom: 32 },
  title: { fontSize: 22, fontWeight: "bold", color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textLight, textAlign: "center", lineHeight: 20, paddingHorizontal: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 16, marginTop: 8 },
  verticalBar: { width: 4, height: 16, backgroundColor: "#34495E", marginRight: 8, borderRadius: 2 },
  sectionTitle: { fontSize: 14, fontWeight: "bold", color: "#34495E", textTransform: "uppercase", letterSpacing: 0.5 },
  fieldLabel: { fontSize: 13, fontWeight: "bold", color: "#2C3E50", marginBottom: 8 },
  inputContainerWhite: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, paddingHorizontal: 16, height: 48, backgroundColor: COLORS.white, marginBottom: 16 },
  input: { flex: 1, fontSize: 14, color: COLORS.text },
  placeholderText: { flex: 1, fontSize: 14, color: COLORS.textLight },
  cccdContainer: { flexDirection: "row", gap: 12, marginBottom: 32 },
  cccdUploadBox: { flex: 1, height: 100, borderWidth: 1, borderColor: "#E2E8F0", borderStyle: "dashed", borderRadius: 8, justifyContent: "center", alignItems: "center", backgroundColor: "#FAFAFA", overflow: "hidden" },
  cccdUploadText: { fontSize: 12, color: COLORS.textLight, marginTop: 8 },
  cccdImage: { width: "100%", height: "100%" },
  paymentWrapper: { backgroundColor: "#F4F7F8", padding: 16, borderRadius: 12, marginBottom: 32 },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: 12, height: 52, justifyContent: "center", alignItems: "center", marginBottom: 16 },
  primaryButtonText: { color: COLORS.white, fontSize: 15, fontWeight: "bold" },
  skipButton: { height: 48, justifyContent: "center", alignItems: "center" },
  skipButtonText: { color: "#607D8B", fontSize: 15, fontWeight: "600" },
  bankSelector: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, paddingHorizontal: 16, height: 48, backgroundColor: COLORS.white, marginBottom: 16 },
  selectedBankRow: { flex: 1, flexDirection: "row", alignItems: "center" },
  selectedBankLogo: { width: 24, height: 24, marginRight: 8 },
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