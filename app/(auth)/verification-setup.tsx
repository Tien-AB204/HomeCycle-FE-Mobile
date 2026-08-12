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
} from "react-native";

import {
  confirmUserAction,
  notifyUser,
} from "../../src/components/shared/ActionFeedback";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { authApi } from "../../src/services/apis/authApi";
import {
  getApiErrorMessage,
  getApiSuccessMessage,
} from "../../src/utils/apiFeedback";

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
  defaultName: string,
) => {
  if (!fileUri || fileUri === "undefined" || fileUri === "null") {
    return;
  }

  console.log(
    `[DEBUG] Đang xử lý file cho trường [${key}] với uri:`,
    fileUri,
  );

  if (Platform.OS === "web") {
    try {
      const response = await fetch(fileUri);
      const blob = await response.blob();

      formData.append(key, blob, defaultName);

      console.log(
        `[DEBUG] Đã đính kèm file Web thành công cho ${key}`,
      );
    } catch (error) {
      console.error(
        `[DEBUG] Lỗi fetch blob trên web cho ${key}:`,
        error,
      );

      throw error;
    }

    return;
  }

  const filename = fileUri.split("/").pop() || defaultName;
  const match = /\.(\w+)$/.exec(filename);
  const type = match ? `image/${match[1]}` : "image/jpeg";

  formData.append(key, {
    uri:
      Platform.OS === "ios"
        ? fileUri.replace("file://", "")
        : fileUri,
    name: filename,
    type,
  } as any);

  console.log(
    `[DEBUG] Đã đính kèm file Mobile thành công cho ${key}`,
    {
      name: filename,
      type,
    },
  );
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

  // Hồ sơ pháp lý
  const [repCode, setRepCode] = useState("");
  const [repName, setRepName] = useState("");
  const [repDob, setRepDob] = useState("");
  const [repAddress, setRepAddress] = useState("");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);

  // Ngân hàng
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

        if (!response.ok) {
          throw new Error(
            `Không thể tải danh sách ngân hàng: HTTP ${response.status}`,
          );
        }

        const json = await response.json();

        if (json.code === "00" && Array.isArray(json.data)) {
          setBanks(json.data);
          setFilteredBanks(json.data);
          return;
        }

        throw new Error(
          json?.desc || "Dữ liệu ngân hàng không hợp lệ.",
        );
      } catch (error: unknown) {
        console.error("Lỗi tải danh sách ngân hàng:", error);

        notifyUser(
          getApiErrorMessage(
            error,
            "Không thể tải danh sách ngân hàng.",
          ),
          "error",
        );
      } finally {
        setIsBankLoading(false);
      }
    };

    fetchBanks();
  }, []);

  const handleSearchBank = (text: string) => {
    setSearchBankQuery(text);

    const normalizedQuery = text.trim().toLowerCase();

    if (!normalizedQuery) {
      setFilteredBanks(banks);
      return;
    }

    const filtered = banks.filter((bank) => {
      return (
        bank.shortName.toLowerCase().includes(normalizedQuery) ||
        bank.name.toLowerCase().includes(normalizedQuery) ||
        bank.code.toLowerCase().includes(normalizedQuery)
      );
    });

    setFilteredBanks(filtered);
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
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (result.canceled) {
        return;
      }

      const selectedUri = result.assets?.[0]?.uri;

      if (!selectedUri) {
        notifyUser("Không thể đọc ảnh đã chọn.", "error");
        return;
      }

      if (side === "front") {
        setFrontImage(selectedUri);
      } else {
        setBackImage(selectedUri);
      }
    } catch (error: unknown) {
      console.error("Lỗi chọn ảnh CCCD:", error);

      notifyUser(
        getApiErrorMessage(error, "Không thể chọn ảnh."),
        "error",
      );
    }
  };

  const executeRegistration = async (
    includeVerification: boolean,
  ) => {
    const hasAvatar =
      avatarUri &&
      avatarUri !== "undefined" &&
      avatarUri !== "null" &&
      String(avatarUri).trim() !== "";

    if (!hasAvatar) {
      const confirmSkip = await confirmUserAction({
        title: "Thiếu ảnh đại diện",
        message:
          "Bạn chưa chọn ảnh đại diện. Bạn có muốn tiếp tục không?",
        confirmLabel: "Tiếp tục",
        cancelLabel: "Chọn ảnh",
      });

      if (!confirmSkip) {
        return;
      }
    }

    if (includeVerification) {
      const hasBankData =
        Boolean(bankCode.trim()) ||
        Boolean(bankAccount.trim()) ||
        Boolean(bankAccountName.trim());

      if (
        hasBankData &&
        (!bankCode.trim() ||
          !bankAccount.trim() ||
          !bankAccountName.trim())
      ) {
        notifyUser(
          "Vui lòng nhập đầy đủ ngân hàng, số tài khoản và tên chủ tài khoản.",
          "error",
        );
        return;
      }

      const hasCccdData =
        Boolean(repCode.trim()) ||
        Boolean(repName.trim()) ||
        Boolean(repDob.trim()) ||
        Boolean(repAddress.trim()) ||
        Boolean(frontImage) ||
        Boolean(backImage);

      if (
        hasCccdData &&
        (!repCode.trim() ||
          !repName.trim() ||
          !repDob.trim() ||
          !repAddress.trim())
      ) {
        notifyUser(
          "Vui lòng điền đầy đủ số CCCD, họ tên, ngày sinh và địa chỉ thường trú.",
          "error",
        );
        return;
      }

      if (
        (frontImage && !backImage) ||
        (!frontImage && backImage)
      ) {
        notifyUser(
          "Vui lòng cung cấp đầy đủ cả mặt trước và mặt sau CCCD.",
          "error",
        );
        return;
      }
    }

    try {
      setIsLoading(true);

      const formData = new FormData();

      console.log("[DEBUG REGISTRATION] Params nhận được:", {
        username,
        email,
        phoneNumber,
        fullName,
        avatarUri,
      });

      formData.append("Username", String(username || ""));
      formData.append("Password", String(password || ""));
      formData.append("PhoneNumber", String(phoneNumber || ""));
      formData.append("FullName", String(fullName || ""));

      if (hasAvatar) {
        await appendFileToForm(
          formData,
          "AvatarUrl",
          String(avatarUri),
          "avatar.jpg",
        );
      }

      if (includeVerification) {
        if (repCode.trim()) {
          formData.append(
            "RepresentativeCode",
            repCode.trim(),
          );
        }

        if (repName.trim()) {
          formData.append(
            "RepresentativeName",
            repName.trim(),
          );
        }

        if (repDob.trim()) {
          formData.append(
            "RepresentativeDob",
            repDob.trim(),
          );
        }

        if (repAddress.trim()) {
          formData.append(
            "RepresentativeAddress",
            repAddress.trim(),
          );
        }

        if (bankCode.trim()) {
          formData.append("BankCode", bankCode.trim());
        }

        if (bankName.trim()) {
          formData.append("BankName", bankName.trim());
        }

        if (bankAccount.trim()) {
          formData.append(
            "AccountNumber",
            bankAccount.trim(),
          );
        }

        if (bankAccountName.trim()) {
          formData.append(
            "AccountName",
            bankAccountName.trim(),
          );
        }

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
      }

      const response = await authApi.registerPersonal(
        String(registrationToken || ""),
        formData,
      );

      console.log(
        "[DEBUG REGISTRATION RESPONSE]:",
        response.data,
      );

      notifyUser(
        getApiSuccessMessage(
          response.data,
          "Tạo tài khoản thành công.",
        ),
        "success",
      );

      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
      });

      try {
        const realEmail =
          response.data?.data?.user?.email || email;

        if (!realEmail || !password) {
          throw new Error(
            "Thiếu thông tin đăng nhập tự động.",
          );
        }

        await login(
          String(realEmail),
          String(password),
        );
      } catch (loginError: unknown) {
        console.error("Lỗi tự động đăng nhập:", loginError);

        notifyUser(
          "Tạo tài khoản thành công. Vui lòng đăng nhập lại.",
          "success",
        );

        router.replace("/(auth)/login");
      }
    } catch (error: unknown) {
      console.error("Lỗi đăng ký API:", error);

      notifyUser(
        getApiErrorMessage(
          error,
          "Không thể tạo tài khoản.",
        ),
        "error",
      );
    } finally {
      setIsLoading(false);
    }
  };

  const webInputStyle =
    Platform.OS === "web"
      ? ({ outlineStyle: "none" } as any)
      : undefined;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "ios" ? "padding" : "height"
        }
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
            disabled={isLoading}
          >
            <Ionicons
              name="arrow-back"
              size={24}
              color={COLORS.text}
            />
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

            <Text style={styles.title}>
              Xác minh & Thanh toán
            </Text>

            <Text style={styles.subtitle}>
              Bước 2/2: Bổ sung để tăng uy tín và nhận tiền
              bán hàng. Có thể thiết lập sau.
            </Text>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.verticalBar} />

            <Text style={styles.sectionTitle}>
              HỒ SƠ PHÁP LÝ
            </Text>
          </View>

          <Text style={styles.fieldLabel}>
            Số CCCD/CMND
          </Text>

          <View style={styles.inputContainerWhite}>
            <TextInput
              style={[styles.input, webInputStyle]}
              placeholder="Nhập số CCCD (12 số)..."
              placeholderTextColor={COLORS.textLight}
              keyboardType="numeric"
              value={repCode}
              onChangeText={setRepCode}
              editable={!isLoading}
              maxLength={12}
            />
          </View>

          <Text style={styles.fieldLabel}>
            Họ và tên (Theo CCCD)
          </Text>

          <View style={styles.inputContainerWhite}>
            <TextInput
              style={[styles.input, webInputStyle]}
              placeholder="VD: NGUYEN VAN A"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="characters"
              value={repName}
              onChangeText={setRepName}
              editable={!isLoading}
            />
          </View>

          <Text style={styles.fieldLabel}>
            Ngày sinh (YYYY-MM-DD)
          </Text>

          <View style={styles.inputContainerWhite}>
            <TextInput
              style={[styles.input, webInputStyle]}
              placeholder="VD: 2000-01-25"
              placeholderTextColor={COLORS.textLight}
              value={repDob}
              onChangeText={setRepDob}
              editable={!isLoading}
            />
          </View>

          <Text style={styles.fieldLabel}>
            Địa chỉ thường trú
          </Text>

          <View style={styles.inputContainerWhite}>
            <TextInput
              style={[styles.input, webInputStyle]}
              placeholder="Nhập địa chỉ theo CCCD..."
              placeholderTextColor={COLORS.textLight}
              value={repAddress}
              onChangeText={setRepAddress}
              editable={!isLoading}
            />
          </View>

          <Text style={styles.fieldLabel}>
            Hình ảnh CCCD
          </Text>

          <View style={styles.cccdContainer}>
            <TouchableOpacity
              style={styles.cccdUploadBox}
              onPress={() => pickImage("front")}
              disabled={isLoading}
            >
              {frontImage ? (
                <Image
                  source={{ uri: frontImage }}
                  style={styles.cccdImage}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <Ionicons
                    name="camera-outline"
                    size={24}
                    color={COLORS.textLight}
                  />

                  <Text style={styles.cccdUploadText}>
                    Mặt trước
                  </Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cccdUploadBox}
              onPress={() => pickImage("back")}
              disabled={isLoading}
            >
              {backImage ? (
                <Image
                  source={{ uri: backImage }}
                  style={styles.cccdImage}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <Ionicons
                    name="camera-outline"
                    size={24}
                    color={COLORS.textLight}
                  />

                  <Text style={styles.cccdUploadText}>
                    Mặt sau
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.verticalBar} />

            <Text style={styles.sectionTitle}>
              THÔNG TIN THANH TOÁN
            </Text>
          </View>

          <View style={styles.paymentWrapper}>
            <Text style={styles.fieldLabel}>
              Ngân hàng thụ hưởng
            </Text>

            <TouchableOpacity
              style={styles.bankSelector}
              onPress={() => setShowBankModal(true)}
              disabled={isLoading}
            >
              {bankName ? (
                <View style={styles.selectedBankRow}>
                  {bankLogo ? (
                    <Image
                      source={{ uri: bankLogo }}
                      style={styles.selectedBankLogo}
                      resizeMode="contain"
                    />
                  ) : null}

                  <Text style={styles.selectedBankText}>
                    {bankName} ({bankDisplayCode})
                  </Text>
                </View>
              ) : (
                <Text style={styles.placeholderText}>
                  Chọn ngân hàng của bạn...
                </Text>
              )}

              <Ionicons
                name="chevron-down"
                size={20}
                color={COLORS.textLight}
              />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>
              Số tài khoản
            </Text>

            <View style={styles.inputContainerWhite}>
              <TextInput
                style={[styles.input, webInputStyle]}
                placeholder="Nhập số tài khoản..."
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                value={bankAccount}
                onChangeText={setBankAccount}
                editable={!isLoading}
              />
            </View>

            <Text style={styles.fieldLabel}>
              Tên chủ tài khoản (Khớp với CCCD)
            </Text>

            <View style={styles.inputContainerWhite}>
              <TextInput
                style={[styles.input, webInputStyle]}
                placeholder="VD: NGUYEN VAN A"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="characters"
                value={bankAccountName}
                onChangeText={setBankAccountName}
                editable={!isLoading}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              isLoading ? styles.disabledButton : undefined,
            ]}
            onPress={() => executeRegistration(true)}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.primaryButtonText}>
                HOÀN THÀNH
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.skipButton}
            onPress={() => executeRegistration(false)}
            disabled={isLoading}
          >
            <Text style={styles.skipButtonText}>
              Bỏ qua & Đăng ký ngay
            </Text>
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
              <Text style={styles.modalTitle}>
                Chọn Ngân Hàng
              </Text>

              <TouchableOpacity
                onPress={() => setShowBankModal(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={COLORS.text}
                />
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
                style={[styles.input, webInputStyle]}
                placeholder="Tìm tên hoặc mã ngân hàng..."
                placeholderTextColor={COLORS.textLight}
                value={searchBankQuery}
                onChangeText={handleSearchBank}
                autoCapitalize="none"
              />
            </View>

            {isBankLoading ? (
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
                style={styles.bankLoading}
              />
            ) : (
              <FlatList
                data={filteredBanks}
                keyExtractor={(item) =>
                  item.id.toString()
                }
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.bankItem}
                    onPress={() =>
                      handleSelectBank(item)
                    }
                  >
                    <Image
                      source={{ uri: item.logo }}
                      style={styles.bankLogo}
                      resizeMode="contain"
                    />

                    <View style={styles.bankInfo}>
                      <Text style={styles.bankShortName}>
                        {item.shortName}{" "}
                        <Text style={styles.bankCodeText}>
                          ({item.code})
                        </Text>
                      </Text>

                      <Text
                        style={styles.bankFullName}
                        numberOfLines={1}
                      >
                        {item.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyBankText}>
                    Không tìm thấy ngân hàng
                  </Text>
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
  flex: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },

  backButton: {
    padding: 4,
    marginLeft: -4,
    alignSelf: "flex-start",
  },

  scrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  headerCenter: {
    alignItems: "center",
    marginBottom: 32,
  },

  headerIcon: {
    marginBottom: 8,
  },

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
    paddingHorizontal: 10,
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },

  verticalBar: {
    width: 4,
    height: 16,
    backgroundColor: "#34495E",
    marginRight: 8,
    borderRadius: 2,
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#34495E",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  fieldLabel: {
    fontSize: 13,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 8,
  },

  inputContainerWhite: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },

  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },

  selectedBankText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
  },

  placeholderText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textLight,
  },

  cccdContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },

  cccdUploadBox: {
    flex: 1,
    height: 100,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderStyle: "dashed",
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#FAFAFA",
    overflow: "hidden",
  },

  cccdUploadText: {
    fontSize: 12,
    color: COLORS.textLight,
    marginTop: 8,
  },

  cccdImage: {
    width: "100%",
    height: "100%",
  },

  paymentWrapper: {
    backgroundColor: "#F4F7F8",
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
  },

  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },

  disabledButton: {
    opacity: 0.7,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "bold",
  },

  skipButton: {
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },

  skipButtonText: {
    color: "#607D8B",
    fontSize: 15,
    fontWeight: "600",
  },

  bankSelector: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 16,
    height: 48,
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },

  selectedBankRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
  },

  selectedBankLogo: {
    width: 24,
    height: 24,
    marginRight: 8,
  },

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

  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
  },

  modalCloseButton: {
    padding: 4,
  },

  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F6F8",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },

  searchIcon: {
    marginRight: 8,
  },

  bankLoading: {
    marginTop: 40,
  },

  bankItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },

  bankLogo: {
    width: 40,
    height: 40,
    marginRight: 16,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },

  bankInfo: {
    flex: 1,
    justifyContent: "center",
  },

  bankShortName: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 4,
  },

  bankCodeText: {
    color: COLORS.primary,
  },

  bankFullName: {
    fontSize: 12,
    color: COLORS.textLight,
  },

  emptyBankText: {
    textAlign: "center",
    marginTop: 40,
    color: COLORS.textLight,
  },
});