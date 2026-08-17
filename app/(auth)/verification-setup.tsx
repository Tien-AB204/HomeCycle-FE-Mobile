// app/(auth)/verification-setup.tsx
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
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

import AddressPickerField from "../../src/components/shared/AddressPickerField";
import CalendarDateField from "../../src/components/shared/CalendarDateField";
import IdentityNameField from "../../src/components/shared/IdentityNameField";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { authApi } from "../../src/services/apis/authApi";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

interface Bank {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
}

type InlineMessage = {
  type: "error" | "success" | "info";
  text: string;
} | null;

type FieldErrors = Partial<
  Record<
    | "repCode"
    | "repName"
    | "repDob"
    | "repAddress"
    | "identityImages"
    | "bank"
    | "bankAccount"
    | "bankAccountName",
    string
  >
>;

const appendFileToForm = async (
  formData: FormData,
  key: string,
  fileUri: string,
  defaultName: string,
) => {
  if (!fileUri || fileUri === "undefined" || fileUri === "null") return;

  if (Platform.OS === "web") {
    const response = await fetch(fileUri);
    if (!response.ok) throw new Error(`Không thể đọc tệp ${defaultName}.`);
    const blob = await response.blob();
    formData.append(key, blob, defaultName);
    return;
  }

  const filename = fileUri.split("/").pop() || defaultName;
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  formData.append(key, {
    uri: Platform.OS === "ios" ? fileUri.replace("file://", "") : fileUri,
    name: filename,
    type,
  } as any);
};

const uppercaseName = (value: string) =>
  value.normalize("NFC").toLocaleUpperCase("vi-VN");

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
  const [message, setMessage] = useState<InlineMessage>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const [repCode, setRepCode] = useState("");
  const [repName, setRepName] = useState("");
  const [repDob, setRepDob] = useState("");
  const [repAddress, setRepAddress] = useState("");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);

  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankDisplayCode, setBankDisplayCode] = useState("");
  const [bankLogo, setBankLogo] = useState<string | null>(null);
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");

  const [showBankModal, setShowBankModal] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [isBankLoading, setIsBankLoading] = useState(false);
  const [bankLoadError, setBankLoadError] = useState("");
  const [searchBankQuery, setSearchBankQuery] = useState("");

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        setIsBankLoading(true);
        setBankLoadError("");
        const response = await fetch("https://api.vietqr.io/v2/banks");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (json.code !== "00" || !Array.isArray(json.data)) {
          throw new Error("Dữ liệu ngân hàng không hợp lệ.");
        }
        setBanks(json.data);
      } catch (error) {
        setBankLoadError(
          getApiErrorMessage(error, "Không thể tải danh sách ngân hàng. Vui lòng thử lại."),
        );
      } finally {
        setIsBankLoading(false);
      }
    };

    void fetchBanks();
  }, []);

  const filteredBanks = useMemo(() => {
    const keyword = searchBankQuery.trim().toLocaleLowerCase("vi-VN");
    if (!keyword) return banks;
    return banks.filter((bank) =>
      [bank.shortName, bank.name, bank.code, bank.bin].some((value) =>
        String(value).toLocaleLowerCase("vi-VN").includes(keyword),
      ),
    );
  }, [banks, searchBankQuery]);

  const hasVerificationData = useMemo(
    () =>
      Boolean(
        repCode.trim() ||
          repName.trim() ||
          repDob.trim() ||
          repAddress.trim() ||
          frontImage ||
          backImage ||
          bankCode.trim() ||
          bankAccount.trim() ||
          bankAccountName.trim(),
      ),
    [
      repCode,
      repName,
      repDob,
      repAddress,
      frontImage,
      backImage,
      bankCode,
      bankAccount,
      bankAccountName,
    ],
  );

  const clearError = (field: keyof FieldErrors) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage(null);
  };

  const handleSelectBank = (bank: Bank) => {
    setBankCode(String(bank.bin));
    setBankName(uppercaseName(bank.shortName));
    setBankDisplayCode(uppercaseName(bank.code));
    setBankLogo(bank.logo);
    setSearchBankQuery("");
    setShowBankModal(false);
    clearError("bank");
  };

  const pickImage = async (side: "front" | "back") => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (result.canceled) return;

      const selectedUri = result.assets?.[0]?.uri;
      if (!selectedUri) {
        setErrors((current) => ({
          ...current,
          identityImages: "Không thể đọc ảnh đã chọn.",
        }));
        return;
      }

      if (side === "front") setFrontImage(selectedUri);
      else setBackImage(selectedUri);
      clearError("identityImages");
    } catch (error) {
      setErrors((current) => ({
        ...current,
        identityImages: getApiErrorMessage(error, "Không thể chọn ảnh CCCD."),
      }));
    }
  };

  const validateVerification = () => {
    const next: FieldErrors = {};

    const hasIdentityData = Boolean(
      repCode.trim() ||
        repName.trim() ||
        repDob.trim() ||
        repAddress.trim() ||
        frontImage ||
        backImage,
    );
    const hasBankData = Boolean(
      bankCode.trim() || bankAccount.trim() || bankAccountName.trim(),
    );

    if (hasIdentityData) {
      if (!/^\d{12}$/.test(repCode.trim())) {
        next.repCode = "Số CCCD phải gồm đúng 12 chữ số.";
      }
      if (!repName.trim()) next.repName = "Vui lòng nhập họ tên theo CCCD.";
      if (!repDob.trim()) next.repDob = "Vui lòng chọn ngày sinh.";
      if (!repAddress.trim()) next.repAddress = "Vui lòng chọn địa chỉ thường trú.";
      if (!frontImage || !backImage) {
        next.identityImages = "Vui lòng cung cấp đủ mặt trước và mặt sau CCCD.";
      }
    }

    if (hasBankData) {
      if (!bankCode.trim()) next.bank = "Vui lòng chọn ngân hàng thụ hưởng.";
      if (!bankAccount.trim()) next.bankAccount = "Vui lòng nhập số tài khoản.";
      if (!bankAccountName.trim()) {
        next.bankAccountName = "Vui lòng nhập tên chủ tài khoản.";
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const executeRegistration = async (includeVerification: boolean) => {
    setMessage(null);
    if (includeVerification && !validateVerification()) return;

    try {
      setIsLoading(true);
      const formData = new FormData();

      formData.append("Username", String(username || ""));
      formData.append("Password", String(password || ""));
      formData.append("PhoneNumber", String(phoneNumber || ""));
      formData.append("FullName", String(fullName || ""));

      const hasAvatar =
        avatarUri &&
        avatarUri !== "undefined" &&
        avatarUri !== "null" &&
        String(avatarUri).trim() !== "";
      if (hasAvatar) {
        await appendFileToForm(formData, "AvatarUrl", String(avatarUri), "avatar.jpg");
      }

      if (includeVerification) {
        if (repCode.trim()) formData.append("RepresentativeCode", repCode.trim());
        if (repName.trim()) formData.append("RepresentativeName", uppercaseName(repName.trim()));
        if (repDob.trim()) formData.append("RepresentativeDob", repDob.trim());
        if (repAddress.trim()) formData.append("RepresentativeAddress", repAddress.trim());
        if (bankCode.trim()) formData.append("BankCode", bankCode.trim());
        if (bankName.trim()) formData.append("BankName", uppercaseName(bankName.trim()));
        if (bankAccount.trim()) formData.append("AccountNumber", bankAccount.trim());
        if (bankAccountName.trim()) {
          formData.append("AccountName", uppercaseName(bankAccountName.trim()));
        }
        if (frontImage) {
          await appendFileToForm(formData, "FrontIDCardImage", frontImage, "front.jpg");
        }
        if (backImage) {
          await appendFileToForm(formData, "BackIDCardImage", backImage, "back.jpg");
        }
      }

      const response = await authApi.registerPersonal(
        String(registrationToken || ""),
        formData,
      );

      const realEmail = response.data?.data?.user?.email || email;
      if (!realEmail || !password) {
        setMessage({
          type: "success",
          text: "Tạo tài khoản thành công. Vui lòng đăng nhập để tiếp tục.",
        });
        router.replace("/(auth)/login");
        return;
      }

      try {
        await login(String(realEmail), String(password));
        router.replace("/(tabs)");
      } catch {
        router.replace("/(auth)/login");
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: getApiErrorMessage(error, "Không thể tạo tài khoản. Vui lòng thử lại."),
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            disabled={isLoading}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.headerCenter}>
            <Ionicons
              name="shield-checkmark"
              size={48}
              color="#27AE60"
              style={styles.headerIcon}
            />
            <Text style={styles.title}>Xác minh & Thanh toán</Text>
            <Text style={styles.subtitle}>
              Bước 2/2: Bổ sung để tăng uy tín và nhận tiền bán hàng. Có thể thiết lập sau.
            </Text>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.verticalBar} />
            <Text style={styles.sectionTitle}>HỒ SƠ PHÁP LÝ</Text>
          </View>

          <Text style={styles.fieldLabel}>Số CCCD/CMND</Text>
          <TextInput
            style={[styles.input, errors.repCode ? styles.inputError : undefined]}
            placeholder="Nhập số CCCD (12 số)..."
            placeholderTextColor={COLORS.textLight}
            keyboardType="numeric"
            value={repCode}
            onChangeText={(value) => {
              setRepCode(value.replace(/[^0-9]/g, ""));
              clearError("repCode");
            }}
            editable={!isLoading}
            maxLength={12}
          />
          {errors.repCode ? <Text style={styles.fieldError}>{errors.repCode}</Text> : null}

          <IdentityNameField
            label="Họ và tên (Theo CCCD)"
            value={repName}
            onChangeText={(value) => {
              setRepName(value);
              clearError("repName");
            }}
            placeholder="VD: NGUYEN VAN A"
            editable={!isLoading}
            error={errors.repName}
            inputStyle={styles.sharedInput}
            labelStyle={styles.sharedLabel}
          />

          <Text style={styles.fieldLabel}>Ngày sinh</Text>
          <CalendarDateField
            value={repDob}
            onChange={(value) => {
              setRepDob(value);
              clearError("repDob");
            }}
            placeholder="Chọn ngày sinh"
            disabled={isLoading}
            hasError={Boolean(errors.repDob)}
            maximumDate={new Date()}
          />
          {errors.repDob ? <Text style={styles.fieldError}>{errors.repDob}</Text> : null}

          <Text style={styles.fieldLabel}>Địa chỉ thường trú</Text>
          <AddressPickerField
            value={repAddress}
            onChange={(value) => {
              setRepAddress(value);
              clearError("repAddress");
            }}
            placeholder="Chọn địa chỉ theo CCCD"
            disabled={isLoading}
            hasError={Boolean(errors.repAddress)}
          />
          {errors.repAddress ? (
            <Text style={styles.fieldError}>{errors.repAddress}</Text>
          ) : null}

          <Text style={styles.fieldLabel}>Hình ảnh CCCD</Text>
          <View style={styles.imageRow}>
            <TouchableOpacity
              style={[styles.imagePicker, errors.identityImages ? styles.inputError : undefined]}
              onPress={() => void pickImage("front")}
              disabled={isLoading}
            >
              {frontImage ? (
                <Image source={{ uri: frontImage }} style={styles.previewImage} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={28} color={COLORS.primary} />
                  <Text style={styles.imagePickerText}>Mặt trước</Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.imagePicker, errors.identityImages ? styles.inputError : undefined]}
              onPress={() => void pickImage("back")}
              disabled={isLoading}
            >
              {backImage ? (
                <Image source={{ uri: backImage }} style={styles.previewImage} />
              ) : (
                <>
                  <Ionicons name="camera-outline" size={28} color={COLORS.primary} />
                  <Text style={styles.imagePickerText}>Mặt sau</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
          {errors.identityImages ? (
            <Text style={styles.fieldError}>{errors.identityImages}</Text>
          ) : null}

          <View style={[styles.sectionHeader, styles.paymentHeader]}>
            <View style={styles.verticalBar} />
            <Text style={styles.sectionTitle}>THÔNG TIN THANH TOÁN</Text>
          </View>

          <View style={styles.paymentCard}>
            <Text style={styles.fieldLabel}>Ngân hàng thụ hưởng</Text>
            <TouchableOpacity
              style={[styles.bankPicker, errors.bank ? styles.inputError : undefined]}
              onPress={() => setShowBankModal(true)}
              disabled={isLoading}
            >
              {bankLogo ? <Image source={{ uri: bankLogo }} style={styles.bankLogo} /> : null}
              <Text
                style={bankCode ? styles.bankValue : styles.bankPlaceholder}
                numberOfLines={1}
              >
                {bankCode
                  ? `${bankName}${bankDisplayCode ? ` (${bankDisplayCode})` : ""}`
                  : "Chọn ngân hàng của bạn..."}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
            {isBankLoading ? (
              <Text style={styles.helperText}>Đang tải danh sách ngân hàng...</Text>
            ) : null}
            {bankLoadError ? <Text style={styles.fieldError}>{bankLoadError}</Text> : null}
            {errors.bank ? <Text style={styles.fieldError}>{errors.bank}</Text> : null}

            <Text style={styles.fieldLabel}>Số tài khoản</Text>
            <TextInput
              style={[styles.input, errors.bankAccount ? styles.inputError : undefined]}
              placeholder="Nhập số tài khoản..."
              placeholderTextColor={COLORS.textLight}
              keyboardType="number-pad"
              value={bankAccount}
              onChangeText={(value) => {
                setBankAccount(value.replace(/[^0-9]/g, ""));
                clearError("bankAccount");
              }}
              editable={!isLoading}
            />
            {errors.bankAccount ? (
              <Text style={styles.fieldError}>{errors.bankAccount}</Text>
            ) : null}

            <Text style={styles.fieldLabel}>Tên chủ tài khoản (Khớp với CCCD)</Text>
            <TextInput
              style={[styles.input, errors.bankAccountName ? styles.inputError : undefined]}
              placeholder="VD: NGUYEN VAN A"
              placeholderTextColor={COLORS.textLight}
              value={bankAccountName}
              onChangeText={(value) => {
                setBankAccountName(uppercaseName(value));
                clearError("bankAccountName");
              }}
              autoCapitalize="characters"
              autoCorrect={false}
              editable={!isLoading}
            />
            {errors.bankAccountName ? (
              <Text style={styles.fieldError}>{errors.bankAccountName}</Text>
            ) : null}
          </View>

          {message ? (
            <View
              style={[
                styles.messageBox,
                message.type === "error"
                  ? styles.messageError
                  : message.type === "success"
                    ? styles.messageSuccess
                    : styles.messageInfo,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.type === "error"
                    ? styles.messageErrorText
                    : message.type === "success"
                      ? styles.messageSuccessText
                      : styles.messageInfoText,
                ]}
              >
                {message.text}
              </Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, isLoading ? styles.disabledButton : undefined]}
            disabled={isLoading}
            onPress={() => void executeRegistration(hasVerificationData)}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryButtonText}>
                {hasVerificationData ? "XÁC NHẬN & ĐĂNG KÝ" : "Bỏ qua & Đăng ký ngay"}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showBankModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowBankModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn ngân hàng</Text>
              <TouchableOpacity onPress={() => setShowBankModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm tên hoặc mã ngân hàng..."
              placeholderTextColor={COLORS.textLight}
              value={searchBankQuery}
              onChangeText={setSearchBankQuery}
              autoCapitalize="characters"
            />
            {bankLoadError ? (
              <Text style={styles.fieldError}>{bankLoadError}</Text>
            ) : null}
            <FlatList
              data={filteredBanks}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.bankOption}
                  onPress={() => handleSelectBank(item)}
                >
                  {item.logo ? <Image source={{ uri: item.logo }} style={styles.bankOptionLogo} /> : null}
                  <View style={styles.flex}>
                    <Text style={styles.bankOptionName}>{uppercaseName(item.shortName)}</Text>
                    <Text style={styles.bankOptionCode}>{uppercaseName(item.code)}</Text>
                  </View>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>
                  {isBankLoading ? "Đang tải..." : "Không tìm thấy ngân hàng."}
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  header: { paddingHorizontal: 20, paddingTop: 16 },
  backButton: { alignSelf: "flex-start", padding: 4 },
  scrollContainer: { padding: 24, paddingTop: 12, paddingBottom: 44 },
  headerCenter: { alignItems: "center", marginBottom: 34 },
  headerIcon: { marginBottom: 12 },
  title: { fontSize: 24, fontWeight: "900", color: COLORS.text, textAlign: "center" },
  subtitle: {
    marginTop: 8,
    color: COLORS.textLight,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 18,
  },
  paymentHeader: { marginTop: 30 },
  verticalBar: { width: 4, height: 20, borderRadius: 2, backgroundColor: COLORS.primary },
  sectionTitle: { fontSize: 17, fontWeight: "900", color: "#334155" },
  fieldLabel: { color: "#334155", fontSize: 13, fontWeight: "800", marginBottom: 8 },
  sharedLabel: { color: "#334155", fontSize: 13, fontWeight: "800", marginBottom: 8 },
  input: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 16,
    marginBottom: 16,
    backgroundColor: COLORS.white,
    color: COLORS.text,
    fontSize: 15,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  sharedInput: {
    minHeight: 54,
    borderRadius: 10,
    paddingHorizontal: 16,
    fontSize: 15,
    backgroundColor: COLORS.white,
  },
  inputError: { borderColor: COLORS.error },
  fieldError: { color: COLORS.error, fontSize: 12, lineHeight: 17, marginTop: -10, marginBottom: 14 },
  imageRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  imagePicker: {
    flex: 1,
    height: 126,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#CBD5E1",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: COLORS.white,
  },
  imagePickerText: { marginTop: 8, color: COLORS.textLight, fontSize: 13 },
  previewImage: { width: "100%", height: "100%", resizeMode: "cover" },
  paymentCard: { backgroundColor: "#F1F5F9", borderRadius: 14, padding: 16 },
  bankPicker: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  bankLogo: { width: 26, height: 26, resizeMode: "contain" },
  bankValue: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: "700" },
  bankPlaceholder: { flex: 1, color: COLORS.textLight, fontSize: 14 },
  helperText: { color: COLORS.textLight, fontSize: 11, marginTop: -10, marginBottom: 14 },
  primaryButton: {
    minHeight: 58,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    marginTop: 26,
  },
  primaryButtonText: { color: COLORS.white, fontSize: 15, fontWeight: "900" },
  disabledButton: { opacity: 0.65 },
  messageBox: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 20 },
  messageText: { fontSize: 12, lineHeight: 18 },
  messageError: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  messageErrorText: { color: "#B91C1C" },
  messageSuccess: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  messageSuccessText: { color: "#047857" },
  messageInfo: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  messageInfoText: { color: "#1D4ED8" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.45)" },
  modalContent: {
    maxHeight: "75%",
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modalTitle: { color: COLORS.text, fontSize: 18, fontWeight: "900" },
  searchInput: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 12,
    color: COLORS.text,
  },
  bankOption: {
    minHeight: 62,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  bankOptionLogo: { width: 34, height: 34, resizeMode: "contain" },
  bankOptionName: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  bankOptionCode: { color: COLORS.textLight, fontSize: 12, marginTop: 2 },
  emptyText: { color: COLORS.textLight, textAlign: "center", paddingVertical: 24 },
});