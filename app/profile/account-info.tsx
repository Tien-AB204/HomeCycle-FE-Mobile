import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import SensitiveNumberField from "../../src/components/shared/SensitiveNumberField";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import {
  FULL_NAME_MAX_LENGTH,
  USERNAME_MAX_LENGTH,
  normalizeVietnamPhone,
  validateFullName,
  validateUsername,
  validateVietnamPhone,
} from "../../src/utils/formValidation";
import {
  capitalizeWordInitials,
  toUppercaseText,
} from "../../src/utils/textFormat";

const PLACEHOLDER_COLOR = "#547B7D";

interface Bank {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
}

const getRobustUrl = (url: string) => {
  if (url?.includes("googleusercontent.com")) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
  }
  return url;
};

const sanitize = (val: any) => {
  if (val === "string" || val === "null" || val === null || val === undefined)
    return "";
  return String(val);
};

const appendFileToForm = async (
  formData: FormData,
  key: string,
  asset: any,
  defaultName: string,
) => {
  if (Platform.OS === "web") {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    formData.append(key, blob, asset.fileName || defaultName);
  } else {
    formData.append(key, {
      uri: asset.uri,
      name: asset.fileName || defaultName,
      type: asset.mimeType || "image/jpeg",
    } as any);
  }
};

type SaveMessage = {
  type: "success" | "warning" | "error";
  text: string;
} | null;

export default function AccountInfoScreen() {
  const router = useRouter();
  const { user, reloadUser } = useAuth();

  const [isSaving, setIsSaving] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [saveMessage, setSaveMessage] = useState<SaveMessage>(null);

  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [newAvatarFile, setNewAvatarFile] = useState<any>(null);

  const [repCode, setRepCode] = useState("");
  const [repName, setRepName] = useState("");
  const [repDob, setRepDob] = useState("");
  const [repAddress, setRepAddress] = useState("");
  const [frontImage, setFrontImage] = useState<any>(null);
  const [backImage, setBackImage] = useState<any>(null);

  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");

  const [banks, setBanks] = useState<Bank[]>([]);
  const [isBankLoading, setIsBankLoading] = useState(false);
  const [bankLoadError, setBankLoadError] = useState("");
  const [showBankModal, setShowBankModal] = useState(false);
  const [bankSearch, setBankSearch] = useState("");

  const fetchBanks = useCallback(async () => {
    try {
      setIsBankLoading(true);
      setBankLoadError("");
      const response = await fetch("https://api.vietqr.io/v2/banks");
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const json = await response.json();
      if (json.code !== "00" || !Array.isArray(json.data)) {
        throw new Error("Invalid bank response");
      }
      setBanks(json.data);
    } catch {
      setBankLoadError("Không thể tải danh sách ngân hàng. Vui lòng thử lại.");
    } finally {
      setIsBankLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBanks();
  }, [fetchBanks]);

  useEffect(() => {
    setImageError(false);
  }, [avatarUrl, newAvatarFile]);

  useEffect(() => {
    if (!user) return;

    setUsername(sanitize(user.username));
    setFullName(capitalizeWordInitials(sanitize(user.fullName || user.name)));
    setPhoneNumber(sanitize(user.phoneNumber || user.phone));

    const userAvatar = user.avatarUrl || user.avatar;
    setAvatarUrl(sanitize(userAvatar));

    setRepCode(sanitize(user.representativeCode));
    setRepName(toUppercaseText(sanitize(user.representativeName)));
    setRepDob(sanitize(user.representativeDob));
    setRepAddress(sanitize(user.representativeAddress));

    const bank = user.bankAccount || {};
    setBankCode(sanitize(bank.bankCode));
    setBankName(toUppercaseText(sanitize(bank.bankName)));
    setAccountNumber(sanitize(bank.accountNumber));
    setAccountName(toUppercaseText(sanitize(bank.accountName)));
  }, [user]);

  const selectedBank = useMemo(
    () =>
      banks.find(
        (bank) =>
          String(bank.bin) === String(bankCode) ||
          bank.code.toLocaleLowerCase("vi-VN") ===
            bankCode.toLocaleLowerCase("vi-VN"),
      ),
    [bankCode, banks],
  );

  const filteredBanks = useMemo(() => {
    const keyword = bankSearch.trim().toLocaleLowerCase("vi-VN");
    if (!keyword) return banks;

    return banks.filter((bank) =>
      [bank.shortName, bank.name, bank.code, bank.bin].some((value) =>
        String(value).toLocaleLowerCase("vi-VN").includes(keyword),
      ),
    );
  }, [bankSearch, banks]);

  const pickImage = async (type: "avatar" | "front" | "back") => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: type === "avatar" ? [1, 1] : [4, 3],
        quality: 0.5,
      });

      if (!result.canceled) {
        setSaveMessage(null);
        const asset = result.assets[0];
        if (type === "avatar") setNewAvatarFile(asset);
        if (type === "front") setFrontImage(asset);
        if (type === "back") setBackImage(asset);
      }
    } catch (error) {
      setSaveMessage({
        type: "error",
        text: getApiErrorMessage(error, "Không thể chọn ảnh lúc này."),
      });
    }
  };

  const handleSelectBank = (bank: Bank) => {
    setBankCode(String(bank.bin));
    setBankName(toUppercaseText(bank.shortName));
    setBankSearch("");
    setShowBankModal(false);
    setSaveMessage(null);
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const apiTasks: Promise<any>[] = [];
      const originalData = user || {};
      const bank = originalData.bankAccount || {};

      const normalizedUsername =
        username.trim();

      const normalizedFullName =
        capitalizeWordInitials(
          fullName.trim().replace(/\s+/gu, " "),
        );

      const normalizedPhone =
        normalizeVietnamPhone(phoneNumber);

      const normalizedAccountName =
        toUppercaseText(accountName).trim();

      const originalUsername =
        sanitize(originalData.username).trim();

      const originalFullName =
        capitalizeWordInitials(
          sanitize(
            originalData.fullName ||
              originalData.name,
          ),
        )
          .trim()
          .replace(/\s+/gu, " ");

      const originalPhone =
        sanitize(
          originalData.phoneNumber ||
            originalData.phone,
        );

      const usernameChanged =
        normalizedUsername !== originalUsername;

      const fullNameChanged =
        normalizedFullName !== originalFullName;

      const phoneChanged =
        normalizedPhone !==
        normalizeVietnamPhone(originalPhone);

      const profileChanged =
        usernameChanged ||
        fullNameChanged ||
        phoneChanged;

      if (profileChanged) {
        const usernameValidationError =
          usernameChanged
            ? validateUsername(username)
            : "";

        const fullNameValidationError =
          fullNameChanged
            ? validateFullName(fullName)
            : "";

        const phoneValidationError =
          phoneChanged
            ? validateVietnamPhone(phoneNumber)
            : "";

        const profileValidationError =
          usernameValidationError ||
          fullNameValidationError ||
          phoneValidationError;

        if (profileValidationError) {
          setSaveMessage({
            type: "error",
            text: profileValidationError,
          });
          return;
        }

        apiTasks.push(
          apiClient.patch(
            "/personal-profiles/me/profile",
            {
              username: usernameChanged
                ? normalizedUsername
                : originalUsername,

              fullName: fullNameChanged
                ? normalizedFullName
                : originalFullName,

              phoneNumber: phoneChanged
                ? normalizedPhone
                : originalPhone,
            },
          ),
        );
      }
      if (newAvatarFile) {
        const formData = new FormData();
        await appendFileToForm(
          formData,
          "AvatarUrl",
          newAvatarFile,
          "avatar.jpg",
        );
        apiTasks.push(
          apiClient.patch("/personal-profiles/me/avatar", formData, {
            timeout: 60000,
          }),
        );
      }

      const identityChanged =
        repCode !== sanitize(originalData.representativeCode) ||
        toUppercaseText(repName) !==
          toUppercaseText(sanitize(originalData.representativeName)) ||
        repDob !== sanitize(originalData.representativeDob) ||
        repAddress !== sanitize(originalData.representativeAddress) ||
        frontImage !== null ||
        backImage !== null;

      if (identityChanged) {
        const formData = new FormData();
        formData.append("RepresentativeCode", repCode || "");
        formData.append("RepresentativeName", toUppercaseText(repName));
        formData.append("RepresentativeDob", repDob || "");
        formData.append("RepresentativeAddress", repAddress || "");

        if (frontImage) {
          await appendFileToForm(
            formData,
            "FrontIDCardImage",
            frontImage,
            "front.jpg",
          );
        }
        if (backImage) {
          await appendFileToForm(
            formData,
            "BackIDCardImage",
            backImage,
            "back.jpg",
          );
        }

        apiTasks.push(
          apiClient.patch("/personal-profiles/me/identity", formData, {
            timeout: 60000,
          }),
        );
      }

      const bankChanged =
        bankCode !== sanitize(bank.bankCode) ||
        toUppercaseText(bankName) !== toUppercaseText(sanitize(bank.bankName)) ||
        accountNumber !== sanitize(bank.accountNumber) ||
        normalizedAccountName !== toUppercaseText(sanitize(bank.accountName)).trim();

      if (bankChanged) {
        if (
          !bankCode.trim() ||
          !bankName.trim() ||
          !accountNumber.trim() ||
          !normalizedAccountName
        ) {
          setSaveMessage({
            type: "warning",
            text: "Vui lòng chọn ngân hàng và điền đủ số tài khoản, tên chủ tài khoản.",
          });
          return;
        }

        apiTasks.push(
          apiClient.patch("/personal-profiles/me/bank", {
            bankCode: bankCode.trim(),
            bankName: toUppercaseText(bankName).trim(),
            accountNumber: accountNumber.trim(),
            accountName: normalizedAccountName,
          }),
        );
      }

      if (apiTasks.length === 0) {
        setSaveMessage({
          type: "warning",
          text: "Không có thông tin nào bị thay đổi.",
        });
        return;
      }

      await Promise.all(apiTasks);
      await reloadUser();
      setNewAvatarFile(null);
      setFrontImage(null);
      setBackImage(null);
      setSaveMessage({
        type: "success",
        text: "Cập nhật thông tin thành công.",
      });
    } catch (error: unknown) {
      setSaveMessage({
        type: "error",
        text: getApiErrorMessage(
          error,
          "Không thể lưu thay đổi. Vui lòng kiểm tra lại thông tin và thử lại.",
        ),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(
    username || "U",
  )}&background=random&color=fff&size=200`;
  const displayAvatar = newAvatarFile?.uri
    ? { uri: newAvatarFile.uri }
    : avatarUrl && !imageError
      ? { uri: getRobustUrl(avatarUrl) }
      : { uri: defaultAvatar };

  const SectionHeader = ({ title }: { title: string }) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionBar} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace("/(tabs)");
            }}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thông tin tài khoản</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.avatarWrapper}>
            <View style={styles.avatarContainer}>
              <Image
                source={displayAvatar}
                style={styles.avatar}
                onError={() => setImageError(true)}
              />
              <TouchableOpacity
                style={styles.cameraIcon}
                onPress={() => void pickImage("avatar")}
              >
                <Ionicons name="camera" size={16} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>

          <SectionHeader title="THÔNG TIN CÁ NHÂN" />

          <Text style={styles.label}>Tên đăng nhập (Username)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              maxLength={USERNAME_MAX_LENGTH}
              value={username}
              onChangeText={(value) => {
                setUsername(value);
                setSaveMessage(null);
              }}
              autoCapitalize="none"
              placeholder="Chưa có"
              placeholderTextColor={PLACEHOLDER_COLOR}
            />
          </View>

          <Text style={styles.label}>Họ và Tên</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              maxLength={FULL_NAME_MAX_LENGTH}
              value={fullName}
              onChangeText={(value) => {
                setFullName(capitalizeWordInitials(value));
                setSaveMessage(null);
              }}
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Chưa có"
              placeholderTextColor={PLACEHOLDER_COLOR}
            />
          </View>

          <Text style={styles.label}>Số điện thoại</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              maxLength={20}
              value={phoneNumber}
              onChangeText={(value) => {
                setPhoneNumber(value);
                setSaveMessage(null);
              }}
              keyboardType="phone-pad"
              placeholder="Chưa có"
              placeholderTextColor={PLACEHOLDER_COLOR}
            />
          </View>

          <SectionHeader title="HỒ SƠ PHÁP LÝ" />

          <Text style={styles.label}>CCCD của bạn</Text>
          <View style={styles.cccdRow}>
            <TouchableOpacity style={styles.cccdBox} onPress={() => void pickImage("front")}>
              {frontImage?.uri || sanitize(user?.frontIDCardImage) ? (
                <Image
                  source={{
                    uri: getRobustUrl(
                      frontImage?.uri || sanitize(user?.frontIDCardImage),
                    ),
                  }}
                  style={styles.documentImage}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <Ionicons
                    name="camera-outline"
                    size={24}
                    color={COLORS.primary}
                    style={styles.uploadIcon}
                  />
                  <Text style={styles.uploadText}>Chưa có mặt trước</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.cccdBox} onPress={() => void pickImage("back")}>
              {backImage?.uri || sanitize(user?.backIDCardImage) ? (
                <Image
                  source={{
                    uri: getRobustUrl(
                      backImage?.uri || sanitize(user?.backIDCardImage),
                    ),
                  }}
                  style={styles.documentImage}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <Ionicons
                    name="camera-outline"
                    size={24}
                    color={COLORS.primary}
                    style={styles.uploadIcon}
                  />
                  <Text style={styles.uploadText}>Chưa có mặt sau</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Số CCCD</Text>
          <SensitiveNumberField
            containerStyle={[
              styles.inputContainer,
              { paddingHorizontal: 0 },
            ]}
            inputStyle={[
              styles.input,
              { paddingHorizontal: 12 },
            ]}
            value={repCode}
            onChangeText={(value) => {
              setRepCode(
                value.replace(
                  /[^0-9]/g,
                  "",
                ),
              );
              setSaveMessage(null);
            }}
            keyboardType="number-pad"
            maxLength={12}
            editable={!isSaving}
            placeholder="Chưa có"
            placeholderTextColor={
              PLACEHOLDER_COLOR
            }
          />

          <IdentityNameField
            label="Họ tên trên CCCD"
            value={repName}
            onChangeText={(value) => {
              setRepName(value);
              setSaveMessage(null);
            }}
            placeholder="Chưa có"
            labelStyle={styles.label}
            inputStyle={styles.identityNameInput}
          />

          <Text style={styles.label}>Ngày sinh (trên CCCD)</Text>
          <CalendarDateField
            value={repDob}
            onChange={(value) => {
              setRepDob(value);
              setSaveMessage(null);
            }}
            placeholder="Chưa có"
            defaultViewDate="2000-01-01"
            maximumDate={new Date()}
            disabled={isSaving}
          />

          <Text style={styles.label}>Địa chỉ thường trú</Text>
          <AddressPickerField
            value={repAddress}
            onChange={(value) => {
              setRepAddress(value);
              setSaveMessage(null);
            }}
            placeholder="Chưa có"
            disabled={isSaving}
          />

          <SectionHeader title="THÔNG TIN THANH TOÁN" />

          <Text style={styles.label}>Ngân hàng thụ hưởng</Text>
          <TouchableOpacity
            style={styles.bankSelector}
            onPress={() => {
              setBankSearch("");
              setShowBankModal(true);
            }}
            disabled={isSaving}
          >
            {bankName ? (
              <View style={styles.selectedBankRow}>
                {selectedBank?.logo ? (
                  <Image
                    source={{ uri: selectedBank.logo }}
                    style={styles.selectedBankLogo}
                    resizeMode="contain"
                  />
                ) : null}
                <Text style={styles.inputBankText} numberOfLines={1}>
                  {toUppercaseText(bankName)}
                  {selectedBank?.code
                    ? ` (${toUppercaseText(selectedBank.code)})`
                    : ""}
                </Text>
              </View>
            ) : (
              <Text style={styles.placeholderText}>Chưa có</Text>
            )}
            <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
          </TouchableOpacity>

          {bankLoadError ? (
            <Text style={styles.bankLoadHint}>{bankLoadError}</Text>
          ) : null}

          <Text style={styles.label}>Số tài khoản</Text>
          <SensitiveNumberField
            containerStyle={[
              styles.inputContainer,
              { paddingHorizontal: 0 },
            ]}
            inputStyle={[
              styles.input,
              { paddingHorizontal: 12 },
            ]}
            value={accountNumber}
            onChangeText={(value) => {
              setAccountNumber(
                value.replace(
                  /[^0-9]/g,
                  "",
                ),
              );
              setSaveMessage(null);
            }}
            keyboardType="number-pad"
            editable={!isSaving}
            placeholder="Chưa có"
            placeholderTextColor={
              PLACEHOLDER_COLOR
            }
          />

          <IdentityNameField
            label="Tên chủ tài khoản (Phải khớp với CCCD)"
            value={accountName}
            onChangeText={(value) => {
              setAccountName(value);
              setSaveMessage(null);
            }}
            placeholder="VD: NGUYEN VAN A"
            editable={!isSaving}
            labelStyle={styles.label}
            inputStyle={styles.identityNameInput}
          />

          {saveMessage ? (
            <Text
              accessibilityRole="alert"
              style={[
                styles.saveMessage,
                saveMessage.type === "success"
                  ? styles.saveMessageSuccess
                  : saveMessage.type === "warning"
                    ? styles.saveMessageWarning
                    : styles.saveMessageError,
              ]}
            >
              {saveMessage.text}
            </Text>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, isSaving ? styles.disabled : undefined]}
            onPress={() => void handleSaveChanges()}
            disabled={isSaving}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.primaryButtonText}>LƯU THAY ĐỔI</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showBankModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowBankModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Chọn Ngân Hàng</Text>
              <TouchableOpacity
                onPress={() => setShowBankModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBarContainer}>
              <Ionicons
                name="search"
                size={20}
                color={COLORS.textLight}
                style={styles.searchIcon}
              />
              <TextInput
                style={styles.bankSearchInput}
                placeholder="Tìm tên hoặc mã ngân hàng..."
                placeholderTextColor={COLORS.textLight}
                value={bankSearch}
                onChangeText={setBankSearch}
                autoCapitalize="none"
              />
            </View>

            {isBankLoading ? (
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={styles.bankLoading}
              />
            ) : bankLoadError ? (
              <View style={styles.bankModalState}>
                <Text style={styles.bankErrorText}>{bankLoadError}</Text>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={() => void fetchBanks()}
                >
                  <Text style={styles.retryButtonText}>Thử lại</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <FlatList
                data={filteredBanks}
                keyExtractor={(item) => item.id.toString()}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.bankItem}
                    onPress={() => handleSelectBank(item)}
                  >
                    <Image
                      source={{ uri: item.logo }}
                      style={styles.bankLogo}
                      resizeMode="contain"
                    />
                    <View style={styles.bankInfo}>
                      <Text style={styles.bankShortName}>
                        {toUppercaseText(item.shortName)}{" "}
                        <Text style={styles.bankCodeText}>
                          ({toUppercaseText(item.code)})
                        </Text>
                      </Text>
                      <Text style={styles.bankFullName} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyBankText}>Không tìm thấy ngân hàng</Text>
                }
              />
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "bold", color: COLORS.text },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  avatarWrapper: { alignItems: "center", marginTop: 24, marginBottom: 16 },
  avatarContainer: { position: "relative" },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.border,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    backgroundColor: "#2B5659",
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  sectionBar: {
    width: 4,
    height: 16,
    backgroundColor: "#2B5659",
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#172830" },
  label: { fontSize: 13, fontWeight: "600", color: "#172830", marginBottom: 8 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BAC2C1",
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 52,
    backgroundColor: COLORS.white,
    marginBottom: 20,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    height: "100%",
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  } as any,
  placeholderText: {
    flex: 1,
    fontSize: 14,
    color: PLACEHOLDER_COLOR,
  },
  identityNameInput: {
    minHeight: 52,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    borderColor: "#BAC2C1",
    marginBottom: 20,
  },
  cccdRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  cccdBox: {
    flex: 1,
    height: 90,
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#BAC2C1",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  documentImage: { width: "100%", height: "100%", borderRadius: 12 },
  uploadIcon: { marginBottom: 4 },
  uploadText: { fontSize: 12, color: PLACEHOLDER_COLOR, fontWeight: "500" },
  bankSelector: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    backgroundColor: COLORS.white,
    marginBottom: 20,
  },
  selectedBankRow: { flex: 1, flexDirection: "row", alignItems: "center" },
  selectedBankLogo: { width: 24, height: 24, marginRight: 8 },
  inputBankText: { flex: 1, fontSize: 14, color: COLORS.text },
  bankLoadHint: {
    marginTop: -12,
    marginBottom: 16,
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 17,
  },
  saveMessage: {
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  saveMessageSuccess: { color: "#2F765D" },
  saveMessageWarning: { color: "#9A6418" },
  saveMessageError: { color: COLORS.error },
  primaryButton: {
    backgroundColor: "#2B5659",
    borderRadius: 12,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 16,
  },
  primaryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },
  disabled: { opacity: 0.65 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    height: "80%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  modalCloseButton: { padding: 4 },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  searchIcon: { marginRight: 8 },
  bankSearchInput: {
    flex: 1,
    height: "100%",
    borderWidth: 0,
    backgroundColor: "transparent",
    color: COLORS.text,
    ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}),
  } as any,
  bankLoading: { marginTop: 40 },
  bankItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#BAC2C1",
  },
  bankLogo: {
    width: 40,
    height: 40,
    marginRight: 16,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },
  bankInfo: { flex: 1, justifyContent: "center" },
  bankShortName: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 4,
  },
  bankCodeText: { color: COLORS.primary },
  bankFullName: { fontSize: 12, color: COLORS.textLight },
  emptyBankText: {
    textAlign: "center",
    marginTop: 40,
    color: COLORS.textLight,
  },
  bankModalState: { alignItems: "center", paddingVertical: 28, gap: 10 },
  bankErrorText: { color: COLORS.error, fontSize: 13, textAlign: "center" },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  retryButtonText: { color: COLORS.white, fontWeight: "700" },
});