// app/(auth)/verification-setup.tsx
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import BankPickerField from "../../src/components/shared/BankPickerField";
import CalendarDateField from "../../src/components/shared/CalendarDateField";
import IdentityNameField from "../../src/components/shared/IdentityNameField";
import SensitiveNumberField from "../../src/components/shared/SensitiveNumberField";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { authApi } from "../../src/services/apis/authApi";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";


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

const getStringParam = (
  value: string | string[] | undefined,
) => {
  return Array.isArray(value)
    ? value[0] ?? ""
    : value ?? "";
};

const isRegistrationSessionExpiredError = (
  error: unknown,
) => {
  const responseData = (error as any)
    ?.response?.data;

  const payload =
    responseData?.data ?? responseData;

  const code = String(
    payload?.code ??
      responseData?.code ??
      "",
  ).toUpperCase();

  const message = String(
    payload?.message ??
      responseData?.message ??
      "",
  ).toLowerCase();

  return (
    code === "VALIDATION_ERROR" &&
    message.includes("registration session") &&
    (
      message.includes("invalid") ||
      message.includes("expired")
    )
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
  const [message, setMessage] = useState<InlineMessage>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const emailValue = getStringParam(email);

  const [
    activeRegistrationToken,
    setActiveRegistrationToken,
  ] = useState(
    getStringParam(registrationToken),
  );

  const [
    needsReverification,
    setNeedsReverification,
  ] = useState(false);

  const [
    showReverifyModal,
    setShowReverifyModal,
  ] = useState(false);

  const [reverifyOtp, setReverifyOtp] =
    useState("");

  const [
    reverifyError,
    setReverifyError,
  ] = useState("");

  const [
    isReverifyLoading,
    setIsReverifyLoading,
  ] = useState(false);

  const [
    pendingIncludeVerification,
    setPendingIncludeVerification,
  ] = useState<boolean | null>(null);

  const [repCode, setRepCode] = useState("");
  const [repName, setRepName] = useState("");
  const [repDob, setRepDob] = useState("");
  const [repAddress, setRepAddress] = useState("");
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);

  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankAccount, setBankAccount] = useState("");
  const [bankAccountName, setBankAccountName] = useState("");


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

  const executeRegistration = async (
    includeVerification: boolean,
    tokenOverride?: string,
  ) => {
    setMessage(null);

    if (
      includeVerification &&
      !validateVerification()
    ) {
      return;
    }

    const tokenToUse =
      tokenOverride ??
      activeRegistrationToken;

    if (!tokenToUse) {
      setNeedsReverification(true);
      setPendingIncludeVerification(
        includeVerification,
      );

      setMessage({
        type: "error",
        text:
          "Phiên xác thực email không còn hợp lệ. " +
          "Vui lòng xác thực lại email để tiếp tục đăng ký.",
      });

      return;
    }

    try {
      setIsLoading(true);

      const formData = new FormData();

      formData.append(
        "Username",
        String(username || ""),
      );

      formData.append(
        "Password",
        String(password || ""),
      );

      formData.append(
        "PhoneNumber",
        String(phoneNumber || ""),
      );

      formData.append(
        "FullName",
        String(fullName || ""),
      );

      const hasAvatar =
        avatarUri &&
        avatarUri !== "undefined" &&
        avatarUri !== "null" &&
        String(avatarUri).trim() !== "";

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
            uppercaseName(
              repName.trim(),
            ),
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
          formData.append(
            "BankCode",
            bankCode.trim(),
          );
        }

        if (bankName.trim()) {
          formData.append(
            "BankName",
            uppercaseName(
              bankName.trim(),
            ),
          );
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
            uppercaseName(
              bankAccountName.trim(),
            ),
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

      const response =
        await authApi.registerPersonal(
          tokenToUse,
          formData,
        );

      setNeedsReverification(false);
      setPendingIncludeVerification(null);

      const realEmail =
        response.data?.data?.user?.email ||
        emailValue;

      if (!realEmail || !password) {
        setMessage({
          type: "success",
          text:
            "Tạo tài khoản thành công. " +
            "Vui lòng đăng nhập để tiếp tục.",
        });

        router.replace("/(auth)/login");
        return;
      }

      try {
        await login(
          String(realEmail),
          String(password),
        );

        router.replace("/(tabs)");
      } catch {
        router.replace("/(auth)/login");
      }
    } catch (error) {
      if (
        isRegistrationSessionExpiredError(
          error,
        )
      ) {
        setNeedsReverification(true);

        setPendingIncludeVerification(
          includeVerification,
        );

        setMessage({
          type: "error",
          text:
            "Phiên xác thực email đã hết hạn. " +
            "Vui lòng xác thực lại email để tiếp tục đăng ký.",
        });

        return;
      }

      setMessage({
        type: "error",
        text: getApiErrorMessage(
          error,
          "Không thể tạo tài khoản. Vui lòng thử lại.",
        ),
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartReverification =
    async () => {
      if (!emailValue) {
        setMessage({
          type: "error",
          text:
            "Không tìm thấy email đăng ký. " +
            "Vui lòng thực hiện lại quá trình đăng ký.",
        });

        return;
      }

      try {
        setIsReverifyLoading(true);
        setReverifyError("");

        await authApi.sendOtp(emailValue);

        setReverifyOtp("");
        setShowReverifyModal(true);
      } catch (error) {
        setMessage({
          type: "error",
          text: getApiErrorMessage(
            error,
            "Không thể gửi mã OTP. Vui lòng thử lại.",
          ),
        });
      } finally {
        setIsReverifyLoading(false);
      }
    };

  const handleVerifyRegistrationOtp =
    async () => {
      const normalizedOtp =
        reverifyOtp
          .replace(/\D/g, "")
          .slice(0, 6);

      if (normalizedOtp.length !== 6) {
        setReverifyError(
          "Vui lòng nhập đủ 6 chữ số OTP.",
        );

        return;
      }

      if (!emailValue) {
        setReverifyError(
          "Không tìm thấy email đăng ký.",
        );

        return;
      }

      try {
        setIsReverifyLoading(true);
        setReverifyError("");

        const response =
          await authApi.verifyOtp(
            emailValue,
            normalizedOtp,
          );

        const newRegistrationToken =
          response.data
            ?.registrationToken ??
          response.data?.data
            ?.registrationToken;

        if (!newRegistrationToken) {
          setReverifyError(
            "Không nhận được phiên đăng ký mới. Vui lòng thử lại.",
          );

          return;
        }

        const newToken = String(
          newRegistrationToken,
        );

        setActiveRegistrationToken(
          newToken,
        );

        setNeedsReverification(false);
        setShowReverifyModal(false);
        setReverifyOtp("");

        const shouldIncludeVerification =
          pendingIncludeVerification ??
          hasVerificationData;

        setPendingIncludeVerification(
          null,
        );

        await executeRegistration(
          shouldIncludeVerification,
          newToken,
        );
      } catch (error) {
        setReverifyError(
          getApiErrorMessage(
            error,
            "Mã OTP không chính xác hoặc đã hết hạn.",
          ),
        );
      } finally {
        setIsReverifyLoading(false);
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
              color="#2F765D"
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
          <SensitiveNumberField
            containerStyle={[
              styles.input,
              { paddingHorizontal: 0 },
            ]}
            inputStyle={{
              paddingHorizontal: 16,
            }}
            hasError={Boolean(errors.repCode)}
            placeholder="Nhập số CCCD (12 số)..."
            placeholderTextColor={
              COLORS.textLight
            }
            keyboardType="numeric"
            value={repCode}
            onChangeText={(value) => {
              setRepCode(
                value
                  .replace(/[^0-9]/g, "")
                  .slice(0, 12),
              );

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
            <BankPickerField
              bankBin={bankCode}
              bankName={bankName}
              onChange={(bank) => {
                setBankCode(String(bank.bin));
                setBankName(uppercaseName(bank.shortName));
                clearError("bank");
              }}
              onClear={() => {
                setBankCode("");
                setBankName("");
                clearError("bank");
              }}
              disabled={isLoading}
              hasError={Boolean(errors.bank)}
              placeholder="Chọn ngân hàng của bạn..."
              style={{ marginBottom: 16 }}
            />
            {errors.bank ? (
              <Text style={styles.fieldError}>{errors.bank}</Text>
            ) : null}

            <Text style={styles.fieldLabel}>Số tài khoản</Text>
            <SensitiveNumberField
              containerStyle={[
                styles.input,
                { paddingHorizontal: 0 },
              ]}
              inputStyle={{
                paddingHorizontal: 16,
              }}
              hasError={Boolean(
                errors.bankAccount,
              )}
              placeholder="Nhập số tài khoản..."
              placeholderTextColor={
                COLORS.textLight
              }
              keyboardType="number-pad"
              value={bankAccount}
              onChangeText={(value) => {
                setBankAccount(
                  value.replace(
                    /[^0-9]/g,
                    "",
                  ),
                );

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

          {needsReverification ? (
            <TouchableOpacity
              style={[
                styles.reverifyButton,
                isReverifyLoading
                  ? styles.disabledButton
                  : undefined,
              ]}
              disabled={
                isLoading ||
                isReverifyLoading
              }
              onPress={() =>
                void handleStartReverification()
              }
            >
              {isReverifyLoading ? (
                <ActivityIndicator
                  color={COLORS.primary}
                />
              ) : (
                <>
                  <Ionicons
                    name="mail-unread-outline"
                    size={19}
                    color={COLORS.primary}
                  />

                  <Text
                    style={
                      styles.reverifyButtonText
                    }
                  >
                    Xác thực lại email
                  </Text>
                </>
              )}
            </TouchableOpacity>
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
        visible={showReverifyModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!isReverifyLoading) {
            setShowReverifyModal(false);
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : "height"
          }
          style={styles.modalOverlay}
        >
          <View
            style={
              styles.reverifyModalContent
            }
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Xác thực lại email
              </Text>

              <TouchableOpacity
                disabled={isReverifyLoading}
                onPress={() =>
                  setShowReverifyModal(false)
                }
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={COLORS.text}
                />
              </TouchableOpacity>
            </View>

            <Text
              style={
                styles.reverifyDescription
              }
            >
              Mã OTP mới đã được gửi đến{" "}
              {emailValue}. Nhập mã để tiếp tục
              đăng ký mà không mất thông tin đã
              điền.
            </Text>

            <TextInput
              style={[
                styles.reverifyOtpInput,
                reverifyError
                  ? styles.inputError
                  : undefined,
              ]}
              value={reverifyOtp}
              onChangeText={(value) => {
                setReverifyOtp(
                  value
                    .replace(/\D/g, "")
                    .slice(0, 6),
                );

                setReverifyError("");
              }}
              placeholder="000000"
              placeholderTextColor={
                COLORS.textLight
              }
              keyboardType="number-pad"
              maxLength={6}
              autoFocus
              returnKeyType="done"
              onSubmitEditing={() =>
                void handleVerifyRegistrationOtp()
              }
              editable={!isReverifyLoading}
            />

            {reverifyError ? (
              <Text
                style={
                  styles.reverifyErrorText
                }
              >
                {reverifyError}
              </Text>
            ) : null}

            <View
              style={styles.reverifyActions}
            >
              <TouchableOpacity
                style={
                  styles.reverifyCancelButton
                }
                disabled={isReverifyLoading}
                onPress={() =>
                  setShowReverifyModal(false)
                }
              >
                <Text
                  style={
                    styles.reverifyCancelText
                  }
                >
                  HỦY
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.reverifyConfirmButton,
                  isReverifyLoading
                    ? styles.disabledButton
                    : undefined,
                ]}
                disabled={isReverifyLoading}
                onPress={() =>
                  void handleVerifyRegistrationOtp()
                }
              >
                {isReverifyLoading ? (
                  <ActivityIndicator
                    color={COLORS.white}
                  />
                ) : (
                  <Text
                    style={
                      styles.reverifyConfirmText
                    }
                  >
                    XÁC NHẬN
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
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
  sectionTitle: { fontSize: 17, fontWeight: "900", color: "#172830" },
  fieldLabel: { color: "#172830", fontSize: 13, fontWeight: "800", marginBottom: 8 },
  sharedLabel: { color: "#172830", fontSize: 13, fontWeight: "800", marginBottom: 8 },
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
    borderColor: "#BAC2C1",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: COLORS.white,
  },
  imagePickerText: { marginTop: 8, color: COLORS.textLight, fontSize: 13 },
  previewImage: { width: "100%", height: "100%", resizeMode: "cover" },
  paymentCard: { backgroundColor: "#F8F9FA", borderRadius: 14, padding: 16 },
  bankPicker: {
    width: "100%",
    minHeight: 54,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  bankPickerSelection: {
    flex: 1,
    minWidth: 0,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingLeft: 14,
    paddingRight: 8,
  },

  bankActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    marginLeft: "auto",
    paddingRight: 6,
  },

  bankClearButton: {
    width: 34,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },

  bankChevronButton: {
    width: 34,
    height: 54,
    alignItems: "center",
    justifyContent: "center",
  },

  bankLogo: {
    width: 26,
    height: 26,
    resizeMode: "contain",
  },

  bankValue: {
    flex: 1,
    minWidth: 0,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },

  bankPlaceholder: {
    flex: 1,
    minWidth: 0,
    color: COLORS.textLight,
    fontSize: 14,
  },
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
  reverifyButton: {
    minHeight: 52,
    marginTop: 14,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  reverifyButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "900",
  },
  reverifyModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    padding: 20,
  },
  reverifyDescription: {
    color: COLORS.textLight,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  reverifyOtpInput: {
    minHeight: 56,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    color: COLORS.text,
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: 8,
    paddingHorizontal: 16,
  },
  reverifyErrorText: {
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 8,
  },
  reverifyActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  reverifyCancelButton: {
    flex: 1,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
  },
  reverifyCancelText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  reverifyConfirmButton: {
    flex: 1,
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  reverifyConfirmText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "900",
  },
  messageBox: { borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 20 },
  messageText: { fontSize: 12, lineHeight: 18 },
  messageError: { backgroundColor: "rgba(122, 16, 18, 0.08)", borderColor: "rgba(122, 16, 18, 0.22)" },
  messageErrorText: { color: "#7A1012" },
  messageSuccess: { backgroundColor: "rgba(47, 118, 93, 0.10)", borderColor: "rgba(47, 118, 93, 0.24)" },
  messageSuccessText: { color: "#2F765D" },
  messageInfo: { backgroundColor: "rgba(84, 123, 125, 0.10)", borderColor: "rgba(84, 123, 125, 0.24)" },
  messageInfoText: { color: "#2B5659" },
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(23, 40, 48, 0.45)" },
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
    borderBottomColor: "#BAC2C1",
  },
  bankOptionLogo: { width: 34, height: 34, resizeMode: "contain" },
  bankOptionName: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  bankOptionCode: { color: COLORS.textLight, fontSize: 12, marginTop: 2 },
  emptyText: { color: COLORS.textLight, textAlign: "center", paddingVertical: 24 },
});