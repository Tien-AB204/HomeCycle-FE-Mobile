import { getAvatarSource } from "../../src/utils/avatar";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import AddressPickerField, {
  AddressSelection,
} from "../../src/components/shared/AddressPickerField";
import BankPickerField from "../../src/components/shared/BankPickerField";
import CalendarDateField from "../../src/components/shared/CalendarDateField";
import IdentityNameField from "../../src/components/shared/IdentityNameField";
import SensitiveNumberField from "../../src/components/shared/SensitiveNumberField";
import { ModalBackdrop, ModalSurface } from "../../src/components/shared/ModalBackdrop";
import { COLORS } from "../../src/constants/theme";
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

const OPERATING_SCOPE_OPTIONS = [
  "Toàn quốc",
  "Khu vực miền Bắc",
  "Khu vực miền Trung",
  "Khu vực miền Nam",
] as const;
type MessageState = {
  type: "success" | "warning" | "error" | "info";
  text: string;
} | null;
type BusinessServiceArea = {
  businessServiceAreaId: string;
  city: string;
  street: string;
  ward: string;
};
type FieldErrors = Record<string, string | undefined>;
type SectionKey =
  | "account"
  | "avatar"
  | "registration"
  | "identity"
  | "serviceArea"
  | "bank";
type EditableSectionKey = Exclude<SectionKey, "serviceArea">;

const businessProfileApi = {
  getProfile: () => apiClient.get("/business-profiles").then((r) => r.data),
  updateUsername: (username: string) =>
    apiClient
      .put("/business-profiles/username", { username })
      .then((r) => r.data),
  updatePhoneNumber: (phoneNumber: string) =>
    apiClient
      .put("/business-profiles/phone-number", { phoneNumber })
      .then((r) => r.data),
  updateAvatar: (formData: FormData) =>
    apiClient
      .put("/business-profiles/avatar", formData, { timeout: 60000 })
      .then((r) => r.data),
  updateBankAccount: (payload: {
    bankCode: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
  }) =>
    apiClient
      .put("/business-profiles/bank-account", payload)
      .then((r) => r.data),
  updateIdentity: (formData: FormData) =>
    apiClient
      .put("/business-profiles/identity", formData, { timeout: 60000 })
      .then((r) => r.data),
  updateBusinessRegistration: (formData: FormData) =>
    apiClient
      .put("/business-profiles/business-registration", formData, {
        timeout: 60000,
      })
      .then((r) => r.data),
  createServiceArea: (payload: {
    city: string;
    street: string;
    ward: string;
  }) =>
    apiClient
      .post("/business-profiles/service-areas", payload)
      .then((r) => r.data),
  updateServiceArea: (
    id: string,
    payload: { city: string; street: string; ward: string },
  ) =>
    apiClient
      .put(`/business-profiles/service-areas/${id}`, payload)
      .then((r) => r.data),
  deleteServiceArea: (id: string) =>
    apiClient
      .delete(`/business-profiles/service-areas/${id}`)
      .then((r) => r.data),
};
const walletApi = {
  getMyWallet: () => apiClient.get("/wallet/me").then((r) => r.data),
};
const unwrap = (value: any) => value?.data ?? value;
const clean = (value: unknown) => String(value ?? "").trim();
const normalizeName = (value: string) =>
  toUppercaseText(value).trim().replace(/\s+/g, " ");
const formatCurrency = (value: unknown) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const appendAssetToForm = async (
  formData: FormData,
  fieldName: string,
  asset: ImagePicker.ImagePickerAsset,
  defaultName: string,
) => {
  if (Platform.OS === "web") {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    formData.append(fieldName, blob, asset.fileName || defaultName);
    return;
  }
  formData.append(fieldName, {
    uri: asset.uri,
    name: asset.fileName || defaultName,
    type: asset.mimeType || "image/jpeg",
  } as any);
};
const pickSingleImage = async () => {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    allowsEditing: false,
    quality: 0.8,
  });
  return result.canceled ? null : result.assets[0];
};

function InlineMessage({ message }: { message: MessageState }) {
  if (!message) return null;
  return (
    <View
      style={[
        styles.messageBox,
        message.type === "error"
          ? styles.messageError
          : message.type === "success"
            ? styles.messageSuccess
            : message.type === "warning"
              ? styles.messageWarning
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
              : message.type === "warning"
                ? styles.messageWarningText
                : styles.messageInfoText,
        ]}
      >
        {message.text}
      </Text>
    </View>
  );
}

export default function BusinessAccountInfoScreen() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingSection, setSavingSection] = useState<SectionKey | null>(null);
  const [editingSection, setEditingSection] =
    useState<EditableSectionKey | null>(null);
  const [messages, setMessages] = useState<
    Partial<Record<SectionKey, MessageState>>
  >({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [avatarAsset, setAvatarAsset] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [showAvatarActions, setShowAvatarActions] = useState(false);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [businessName, setBusinessName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessAddressSelection, setBusinessAddressSelection] =
    useState<AddressSelection | null>(null);
  const [operatingScope, setOperatingScope] = useState("");
  const [showScopeModal, setShowScopeModal] = useState(false);
  const [registrationCertificate, setRegistrationCertificate] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [fullName, setFullName] = useState("");
  const [identityNumber, setIdentityNumber] = useState("");
  const [identityName, setIdentityName] = useState("");
  const [identityDob, setIdentityDob] = useState("");
  const [identityAddress, setIdentityAddress] = useState("");
  const [identityAddressSelection, setIdentityAddressSelection] =
    useState<AddressSelection | null>(null);
  const [cccdFront, setCccdFront] =
    useState<ImagePicker.ImagePickerAsset | null>(null);
  const [cccdBack, setCccdBack] = useState<ImagePicker.ImagePickerAsset | null>(
    null,
  );
  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [serviceAreaValue, setServiceAreaValue] = useState("");
  const [serviceAreaSelection, setServiceAreaSelection] =
    useState<AddressSelection | null>(null);
  const [editingServiceAreaId, setEditingServiceAreaId] = useState<
    string | null
  >(null);
  const [deleteTarget, setDeleteTarget] = useState<BusinessServiceArea | null>(
    null,
  );

  const documents = useMemo(() => {
    const items = Array.isArray(data?.documents) ? data.documents : [];
    return {
      front: items.find((item: any) => Number(item.documentType) === 0)
        ?.documentUrl,
      back: items.find((item: any) => Number(item.documentType) === 1)
        ?.documentUrl,
      registration: items.find((item: any) => Number(item.documentType) === 2)
        ?.documentUrl,
    };
  }, [data]);

  const hydrate = useCallback((profile: any) => {
    setUsername(clean(profile?.username));
    setPhoneNumber(clean(profile?.phoneNumber));
    setBusinessName(clean(profile?.businessName));
    setBusinessDescription(clean(profile?.businessDescription));
    setTaxCode(clean(profile?.taxCode));
    setBusinessAddress(clean(profile?.businessAddress));
    setBusinessAddressSelection(null);
    setOperatingScope(clean(profile?.operatingScope));
    setFullName(capitalizeWordInitials(clean(profile?.fullName)));
    setIdentityNumber(clean(profile?.identityNumber));
    setIdentityName(toUppercaseText(clean(profile?.identityName)));
    setIdentityDob(clean(profile?.identityDob));
    setIdentityAddress(clean(profile?.identityAddress));
    setIdentityAddressSelection(null);
    const bank = profile?.bankAccount || {};
    setBankCode(clean(bank.bankCode));
    setBankName(clean(bank.bankName));
    setAccountNumber(clean(bank.accountNumber));
    setAccountName(toUppercaseText(clean(bank.accountName)));
  }, []);

  const fetchPageData = useCallback(async () => {
    try {
      setIsLoading(true);
      setLoadError(null);
      const [profileResult, walletResult] = await Promise.allSettled([
        businessProfileApi.getProfile(),
        walletApi.getMyWallet(),
      ]);
      if (profileResult.status === "rejected") throw profileResult.reason;
      const profile = unwrap(profileResult.value);
      setData(profile);
      hydrate(profile);
      setWallet(
        walletResult.status === "fulfilled" ? unwrap(walletResult.value) : null,
      );
    } catch (error) {
      setData(null);
      setLoadError(
        getApiErrorMessage(error, "Không thể tải hồ sơ doanh nghiệp."),
      );
    } finally {
      setIsLoading(false);
    }
  }, [hydrate]);

  useFocusEffect(
    useCallback(() => {
      void fetchPageData();
    }, [fetchPageData]),
  );
  const setSectionMessage = (section: SectionKey, message: MessageState) =>
    setMessages((current) => ({ ...current, [section]: message }));
  const clearFieldError = (field: string, section?: SectionKey) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    if (section) setSectionMessage(section, null);
  };

  const resetEditableSection = (section: EditableSectionKey) => {
    if (!data) return;

    if (section === "account") {
      setUsername(clean(data.username));
      setPhoneNumber(clean(data.phoneNumber));
    } else if (section === "avatar") {
      setAvatarAsset(null);
    } else if (section === "registration") {
      setBusinessName(clean(data.businessName));
      setBusinessDescription(clean(data.businessDescription));
      setTaxCode(clean(data.taxCode));
      setBusinessAddress(clean(data.businessAddress));
      setBusinessAddressSelection(null);
      setOperatingScope(clean(data.operatingScope));
      setRegistrationCertificate(null);
      setShowScopeModal(false);
    } else if (section === "identity") {
      setFullName(capitalizeWordInitials(clean(data.fullName)));
      setIdentityNumber(clean(data.identityNumber));
      setIdentityName(toUppercaseText(clean(data.identityName)));
      setIdentityDob(clean(data.identityDob));
      setIdentityAddress(clean(data.identityAddress));
      setIdentityAddressSelection(null);
      setCccdFront(null);
      setCccdBack(null);
    } else if (section === "bank") {
      const bank = data.bankAccount || {};
      setBankCode(clean(bank.bankCode));
      setBankName(clean(bank.bankName));
      setAccountNumber(clean(bank.accountNumber));
      setAccountName(toUppercaseText(clean(bank.accountName)));
    }

    setMessages((current) => ({ ...current, [section]: null }));
    setErrors({});
  };

  const beginEdit = (section: EditableSectionKey) => {
    if (savingSection) return;
    setShowAvatarActions(false);
    resetEditableSection(section);
    setEditingSection(section);
  };

  const cancelEdit = (section: EditableSectionKey) => {
    if (savingSection) return;
    Keyboard.dismiss();
    setShowAvatarActions(false);
    resetEditableSection(section);
    setEditingSection(null);
  };

  const dismissActiveEdit = () => {
    setShowAvatarActions(false);
    if (!editingSection || savingSection) return;
    cancelEdit(editingSection);
  };

  const handleEditableSectionPress = (
    section: EditableSectionKey,
    event: any,
  ) => {
    const pressedDirectSectionSurface =
      event.target === event.currentTarget;

    event.stopPropagation();

    if (
      editingSection === section &&
      pressedDirectSectionSurface
    ) {
      dismissActiveEdit();
      return;
    }

    if (editingSection && editingSection !== section) {
      cancelEdit(editingSection);
    }
  };

  const handleEditableCardPress = (
    event: any,
  ) => {
    const pressedDirectCardSurface =
      event.target === event.currentTarget;

    event.stopPropagation();

    if (editingSection && pressedDirectCardSurface) {
      dismissActiveEdit();
    }
  };

  const handleFieldFocus = (section: EditableSectionKey) => {
    if (savingSection) return;
    setShowAvatarActions(false);

    if (editingSection === section) return;

    if (editingSection) {
      resetEditableSection(editingSection);
    }

    beginEdit(section);
  };

  const handleAvatarPress = () => {
    if (savingSection || editingSection === "avatar") return;

    if (editingSection) {
      cancelEdit(editingSection);
    }

    setShowAvatarActions((current) => !current);
  };

  const handleAvatarImageChange = async () => {
    if (savingSection) return;

    setShowAvatarActions(false);

    if (editingSection && editingSection !== "avatar") {
      cancelEdit(editingSection);
    }

    const asset = await pickSingleImage();
    if (!asset) return;

    if (editingSection !== "avatar") {
      beginEdit("avatar");
    }

    setShowAvatarActions(false);
    setAvatarAsset(asset);
    clearFieldError("avatar", "avatar");
  };

  const saveAccount = async () => {
    const normalizedUsername = clean(username);

    const normalizedPhone = normalizeVietnamPhone(phoneNumber);

    const originalUsername = clean(data?.username);

    const originalPhone = clean(data?.phoneNumber);

    const usernameChanged = normalizedUsername !== originalUsername;

    const phoneChanged =
      normalizedPhone !== normalizeVietnamPhone(originalPhone);

    if (!usernameChanged && !phoneChanged) {
      setSectionMessage("account", {
        type: "warning",
        text: "Tên tài khoản và số điện thoại chưa có thay đổi.",
      });
      return;
    }

    const nextErrors: FieldErrors = {};

    if (usernameChanged) {
      const validationError = validateUsername(username);

      if (validationError) {
        nextErrors.username = validationError;
      }
    }

    if (phoneChanged) {
      const validationError = validateVietnamPhone(phoneNumber);

      if (validationError) {
        nextErrors.phoneNumber = validationError;
      }
    }

    setErrors((current) => ({
      ...current,
      username: nextErrors.username,
      phoneNumber: nextErrors.phoneNumber,
    }));

    if (Object.keys(nextErrors).length) {
      return;
    }

    try {
      setSavingSection("account");
      setSectionMessage("account", null);

      if (usernameChanged) {
        await businessProfileApi.updateUsername(normalizedUsername);
      }

      if (phoneChanged) {
        await businessProfileApi.updatePhoneNumber(normalizedPhone);
      }

      setSectionMessage("account", {
        type: "success",
        text: "Đã cập nhật thông tin tài khoản.",
      });

      await fetchPageData();
      setEditingSection(null);
    } catch (error) {
      setSectionMessage("account", {
        type: "error",
        text: getApiErrorMessage(
          error,
          "Không thể cập nhật thông tin tài khoản.",
        ),
      });
    } finally {
      setSavingSection(null);
    }
  };
  const saveAvatar = async () => {
    if (!avatarAsset) {
      setErrors((current) => ({
        ...current,
        avatar: "Vui lòng chọn ảnh đại diện mới.",
      }));
      return;
    }
    try {
      setSavingSection("avatar");
      setSectionMessage("avatar", null);
      const formData = new FormData();
      await appendAssetToForm(formData, "AvatarUrl", avatarAsset, "avatar.jpg");
      await businessProfileApi.updateAvatar(formData);
      setAvatarAsset(null);
      setSectionMessage("avatar", {
        type: "success",
        text: "Đã cập nhật ảnh đại diện.",
      });
      await fetchPageData();
      setEditingSection(null);
    } catch (error) {
      setSectionMessage("avatar", {
        type: "error",
        text: getApiErrorMessage(error, "Không thể cập nhật ảnh đại diện."),
      });
    } finally {
      setSavingSection(null);
    }
  };

  const saveRegistration = async () => {
    const nextErrors: FieldErrors = {};
    if (!clean(businessName))
      nextErrors.businessName = "Vui lòng nhập tên doanh nghiệp.";
    if (!clean(taxCode)) nextErrors.taxCode = "Vui lòng nhập mã số thuế.";
    if (!clean(businessAddress))
      nextErrors.businessAddress = "Vui lòng chọn địa chỉ trụ sở.";
    if (!businessAddressSelection)
      nextErrors.businessAddress =
        "Vui lòng chọn lại địa chỉ bằng bộ chọn địa chỉ để xác định Thành phố và Phường/Xã.";
    if (!registrationCertificate)
      nextErrors.registrationCertificate =
        "BE yêu cầu tải lại giấy đăng ký kinh doanh mỗi lần cập nhật.";
    setErrors((current) => ({ ...current, ...nextErrors }));
    if (Object.keys(nextErrors).length) return;
    try {
      setSavingSection("registration");
      setSectionMessage("registration", null);
      const formData = new FormData();
      formData.append("BusinessName", clean(businessName));
      if (clean(businessDescription))
        formData.append("BusinessDescription", clean(businessDescription));
      formData.append("TaxCode", clean(taxCode));
      formData.append("BusinessAddress", clean(businessAddress));
      formData.append("Ward", clean(businessAddressSelection!.wardName));
      formData.append("City", clean(businessAddressSelection!.provinceName));
      if (clean(operatingScope))
        formData.append("OperatingScope", clean(operatingScope));
      await appendAssetToForm(
        formData,
        "BusinessRegistrationCertificate",
        registrationCertificate!,
        "business-registration.jpg",
      );
      await businessProfileApi.updateBusinessRegistration(formData);
      setRegistrationCertificate(null);
      setSectionMessage("registration", {
        type: "success",
        text: "Đã cập nhật thông tin đăng ký kinh doanh.",
      });
      await fetchPageData();
      setEditingSection(null);
    } catch (error) {
      setSectionMessage("registration", {
        type: "error",
        text: getApiErrorMessage(
          error,
          "Không thể cập nhật đăng ký kinh doanh.",
        ),
      });
    } finally {
      setSavingSection(null);
    }
  };

  const saveIdentity = async () => {
    const nextErrors: FieldErrors = {};
    const fullNameValidationError = validateFullName(fullName);

    if (fullNameValidationError) {
      nextErrors.fullName = fullNameValidationError;
    }
    if (!/^\d{12}$/.test(clean(identityNumber)))
      nextErrors.identityNumber = "CCCD phải đúng 12 số.";
    if (!clean(identityName))
      nextErrors.identityName = "Vui lòng nhập họ tên trên CCCD.";
    if (normalizeName(fullName) !== normalizeName(identityName))
      nextErrors.identityName =
        "Họ tên thường và họ tên trên CCCD phải khớp nhau.";
    if (!clean(identityDob))
      nextErrors.identityDob = "Vui lòng chọn ngày sinh.";
    if (!clean(identityAddress))
      nextErrors.identityAddress = "Vui lòng chọn địa chỉ thường trú.";
    if (!identityAddressSelection)
      nextErrors.identityAddress =
        "Vui lòng chọn lại địa chỉ bằng bộ chọn địa chỉ.";
    if (!cccdFront)
      nextErrors.cccdFront =
        "BE yêu cầu tải lại mặt trước CCCD mỗi lần cập nhật.";
    if (!cccdBack)
      nextErrors.cccdBack = "BE yêu cầu tải lại mặt sau CCCD mỗi lần cập nhật.";
    setErrors((current) => ({ ...current, ...nextErrors }));
    if (Object.keys(nextErrors).length) return;
    try {
      setSavingSection("identity");
      setSectionMessage("identity", null);
      const formData = new FormData();
      formData.append("FullName", capitalizeWordInitials(clean(fullName)));
      formData.append("IdentityNumber", clean(identityNumber));
      formData.append("IdentityName", toUppercaseText(identityName).trim());
      formData.append("IdentityDob", clean(identityDob));
      formData.append("IdentityAddress", clean(identityAddress));
      await appendAssetToForm(
        formData,
        "CccdFront",
        cccdFront!,
        "cccd-front.jpg",
      );
      await appendAssetToForm(formData, "CccdBack", cccdBack!, "cccd-back.jpg");
      await businessProfileApi.updateIdentity(formData);
      setCccdFront(null);
      setCccdBack(null);
      setSectionMessage("identity", {
        type: "success",
        text: "Đã cập nhật thông tin định danh.",
      });
      await fetchPageData();
      setEditingSection(null);
    } catch (error) {
      setSectionMessage("identity", {
        type: "error",
        text: getApiErrorMessage(
          error,
          "Không thể cập nhật thông tin định danh.",
        ),
      });
    } finally {
      setSavingSection(null);
    }
  };

  const saveBank = async () => {
    const nextErrors: FieldErrors = {};
    if (!clean(bankCode) || !clean(bankName))
      nextErrors.bankCode = "Vui lòng chọn ngân hàng thụ hưởng.";
    if (!clean(accountNumber))
      nextErrors.accountNumber = "Vui lòng nhập số tài khoản.";
    if (!clean(accountName))
      nextErrors.accountName = "Vui lòng nhập tên chủ tài khoản.";
    setErrors((current) => ({ ...current, ...nextErrors }));
    if (Object.keys(nextErrors).length) return;
    try {
      setSavingSection("bank");
      setSectionMessage("bank", null);
      await businessProfileApi.updateBankAccount({
        bankCode: clean(bankCode),
        bankName: toUppercaseText(clean(bankName)),
        accountNumber: clean(accountNumber),
        accountName: toUppercaseText(clean(accountName)),
      });
      setSectionMessage("bank", {
        type: "success",
        text: "Đã cập nhật thông tin ngân hàng.",
      });
      await fetchPageData();
      setEditingSection(null);
    } catch (error) {
      setSectionMessage("bank", {
        type: "error",
        text: getApiErrorMessage(
          error,
          "Không thể cập nhật thông tin ngân hàng.",
        ),
      });
    } finally {
      setSavingSection(null);
    }
  };

  const resetServiceAreaEditor = () => {
    setEditingServiceAreaId(null);
    setServiceAreaValue("");
    setServiceAreaSelection(null);
    setErrors((current) => ({ ...current, serviceArea: undefined }));
  };
  const saveServiceArea = async () => {
    if (!serviceAreaSelection) {
      setErrors((current) => ({
        ...current,
        serviceArea: "Vui lòng chọn đầy đủ địa chỉ khu vực dịch vụ.",
      }));
      return;
    }
    const payload = {
      city: clean(serviceAreaSelection.provinceName),
      street: capitalizeWordInitials(clean(serviceAreaSelection.streetAddress)),
      ward: clean(serviceAreaSelection.wardName),
    };
    try {
      setSavingSection("serviceArea");
      setSectionMessage("serviceArea", null);
      if (editingServiceAreaId)
        await businessProfileApi.updateServiceArea(
          editingServiceAreaId,
          payload,
        );
      else await businessProfileApi.createServiceArea(payload);
      setSectionMessage("serviceArea", {
        type: "success",
        text: editingServiceAreaId
          ? "Đã cập nhật khu vực dịch vụ."
          : "Đã thêm khu vực dịch vụ.",
      });
      resetServiceAreaEditor();
      await fetchPageData();
    } catch (error) {
      setSectionMessage("serviceArea", {
        type: "error",
        text: getApiErrorMessage(error, "Không thể lưu khu vực dịch vụ."),
      });
    } finally {
      setSavingSection(null);
    }
  };
  const confirmDeleteServiceArea = async () => {
    if (!deleteTarget) return;
    try {
      setSavingSection("serviceArea");
      setSectionMessage("serviceArea", null);
      await businessProfileApi.deleteServiceArea(
        deleteTarget.businessServiceAreaId,
      );
      setSectionMessage("serviceArea", {
        type: "success",
        text: "Đã xóa khu vực dịch vụ.",
      });
      setDeleteTarget(null);
      await fetchPageData();
    } catch (error) {
      setSectionMessage("serviceArea", {
        type: "error",
        text: getApiErrorMessage(error, "Không thể xóa khu vực dịch vụ."),
      });
    } finally {
      setSavingSection(null);
    }
  };

  if (isLoading && !data)
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải hồ sơ doanh nghiệp...</Text>
        </View>
      </SafeAreaView>
    );
  if (!data)
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Hồ sơ Doanh nghiệp</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <Text style={styles.loadErrorText}>
            {loadError || "Không thể tải hồ sơ."}
          </Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => void fetchPageData()}
          >
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );

  const serviceAreas: BusinessServiceArea[] = Array.isArray(data.serviceAreas)
    ? data.serviceAreas
    : [];
  const avatarUri = avatarAsset?.uri || data.avatarUrl;
  const availableBalance =
    wallet?.availableBalance ?? wallet?.AvailableBalance ?? 0;
  const holdBalance = wallet?.holdBalance ?? wallet?.HoldBalance ?? 0;
  const isEditing = (section: EditableSectionKey) => editingSection === section;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Hồ sơ Doanh nghiệp</Text>
          <View style={{ width: 24 }} />
        </View>
        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onScrollBeginDrag={dismissActiveEdit}
        >
          <Pressable
            style={styles.contentPressArea}
            onPress={dismissActiveEdit}
          >
            <Pressable
              style={styles.avatarTopSection}
              onPress={(event) => event.stopPropagation()}
            >
              <TouchableOpacity
                style={styles.avatarTopContent}
                onPress={handleAvatarPress}
                disabled={Boolean(savingSection) || isEditing("avatar")}
                accessibilityRole="button"
                accessibilityLabel="Mở tùy chọn ảnh đại diện doanh nghiệp"
              >
                <Image
                  source={getAvatarSource(avatarUri)}
                  style={styles.avatarTopImage}
                />
              </TouchableOpacity>

              {showAvatarActions && !isEditing("avatar") ? (
                <View style={styles.avatarActionRow}>
                  {avatarUri ? (
                    <>
                      <TouchableOpacity
                        style={[
                          styles.avatarActionButton,
                          styles.avatarViewButton,
                        ]}
                        onPress={() => {
                          setShowAvatarActions(false);
                          setShowAvatarPreview(true);
                        }}
                        disabled={savingSection === "avatar"}
                      >
                        <Ionicons
                          name="eye-outline"
                          size={18}
                          color={COLORS.primary}
                        />
                        <Text
                          style={styles.avatarViewButtonText}
                          numberOfLines={1}
                        >
                          Xem ảnh đại diện
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.avatarActionButton,
                          styles.avatarChangeButton,
                        ]}
                        onPress={() => void handleAvatarImageChange()}
                        disabled={Boolean(savingSection)}
                      >
                        <Ionicons
                          name="camera-outline"
                          size={18}
                          color={COLORS.white}
                        />
                        <Text
                          style={styles.avatarChangeButtonText}
                          numberOfLines={1}
                        >
                          Đổi ảnh đại diện
                        </Text>
                      </TouchableOpacity>
                    </>
                  ) : (
                    <TouchableOpacity
                      style={[
                        styles.avatarActionButton,
                        styles.avatarAddButton,
                      ]}
                      onPress={() => void handleAvatarImageChange()}
                      disabled={Boolean(savingSection)}
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={18}
                        color={COLORS.white}
                      />
                      <Text
                        style={styles.avatarChangeButtonText}
                        numberOfLines={1}
                      >
                        Thêm ảnh đại diện
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              ) : null}

              {isEditing("avatar") ? (
                <View style={styles.avatarEditPanel}>
                  <Text style={styles.avatarPendingText}>
                    Ảnh mới đang được xem trước. Xác nhận để lưu thay đổi.
                  </Text>
                  <FieldError text={errors.avatar} />
                  <InlineMessage message={messages.avatar || null} />
                  <EditActions
                    loading={savingSection === "avatar"}
                    onCancel={() => cancelEdit("avatar")}
                    onSave={() => void saveAvatar()}
                    saveTitle="Xác nhận chỉnh sửa"
                  />
                </View>
              ) : null}
            </Pressable>

          <Pressable
            style={styles.editableSection}
            onPress={(event) =>
              handleEditableSectionPress("account", event)
            }
          >
            <SectionTitle title="TÀI KHOẢN" />
            <Pressable
              style={styles.card}
              onPress={handleEditableCardPress}
            >
              <Text style={styles.inputLabel}>Tên tài khoản *</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.username ? styles.inputError : undefined,
                ]}
                value={username}
                maxLength={USERNAME_MAX_LENGTH}
                onChangeText={(value) => {
                  setUsername(value);
                  clearFieldError("username", "account");
                }}
                onPressIn={(event) => event.stopPropagation()}
                onFocus={() => handleFieldFocus("account")}
                editable={!savingSection}
                placeholder="Nhập tên tài khoản"
              />
              <FieldError text={errors.username} />
              <Text style={styles.inputLabel}>Số điện thoại *</Text>
              <TextInput
                style={[
                  styles.input,
                  errors.phoneNumber ? styles.inputError : undefined,
                ]}
                value={phoneNumber}
                maxLength={20}
                onChangeText={(value) => {
                  setPhoneNumber(value);
                  clearFieldError("phoneNumber", "account");
                }}
                onPressIn={(event) => event.stopPropagation()}
                onFocus={() => handleFieldFocus("account")}
                editable={!savingSection}
                keyboardType="phone-pad"
                placeholder="VD: 0987654321"
              />
              <FieldError text={errors.phoneNumber} />
              <InlineMessage message={messages.account || null} />
              {isEditing("account") ? (
                <EditActions
                  loading={savingSection === "account"}
                  onCancel={() => cancelEdit("account")}
                  onSave={() => void saveAccount()}
                  saveTitle="Xác nhận chỉnh sửa"
                />
              ) : null}
            </Pressable>
          </Pressable>

          <Pressable
            style={styles.editableSection}
            onPress={(event) =>
              handleEditableSectionPress("registration", event)
            }
          >
            <SectionTitle title="ĐĂNG KÝ KINH DOANH" />
          <Pressable
              style={styles.card}
              onPress={handleEditableCardPress}
            >
            <Text style={styles.inputLabel}>
              Tên doanh nghiệp / Hộ kinh doanh *
            </Text>
            <TextInput
              style={[
                styles.input,
                errors.businessName ? styles.inputError : undefined,
              ]}
              value={businessName}
              onChangeText={(value) => {
                setBusinessName(value);
                clearFieldError("businessName", "registration");
              }}
              onPressIn={(event) => event.stopPropagation()}
              onFocus={() => handleFieldFocus("registration")}
              editable={!savingSection}
            />
            <FieldError text={errors.businessName} />
            <Text style={styles.inputLabel}>Mô tả hoạt động kinh doanh</Text>
            <TextInput
              style={[styles.input, styles.multilineInput]}
              value={businessDescription}
              onChangeText={(value) => {
                setBusinessDescription(value);
                setSectionMessage("registration", null);
              }}
              onPressIn={(event) => event.stopPropagation()}
              onFocus={() => handleFieldFocus("registration")}
              editable={!savingSection}
              multiline
              placeholder="Nhập mô tả hoạt động, lĩnh vực hoặc dịch vụ kinh doanh..."
            />
            <Text style={styles.inputLabel}>Mã số thuế *</Text>
            <TextInput
              style={[
                styles.input,
                errors.taxCode ? styles.inputError : undefined,
              ]}
              value={taxCode}
              onChangeText={(value) => {
                setTaxCode(value.replace(/[^0-9]/g, ""));
                clearFieldError("taxCode", "registration");
              }}
              onPressIn={(event) => event.stopPropagation()}
              onFocus={() => handleFieldFocus("registration")}
              editable={!savingSection}
              keyboardType="number-pad"
            />
            <FieldError text={errors.taxCode} />
            <Text style={styles.inputLabel}>Địa chỉ trụ sở *</Text>
            <AddressPickerField
              value={businessAddress}
              onChange={(value, selection) => {
                setBusinessAddress(value);
                setBusinessAddressSelection(selection);
                clearFieldError("businessAddress", "registration");
              }}
              placeholder="Chọn địa chỉ trụ sở"
              hasError={Boolean(errors.businessAddress)}
              disabled={
                !isEditing("registration") || savingSection === "registration"
              }
            />
            <FieldError text={errors.businessAddress} />
            <Text style={styles.inputLabel}>Phạm vi hoạt động</Text>
            <TouchableOpacity
              style={styles.selectTrigger}
              onPress={() => setShowScopeModal(true)}
              disabled={
                !isEditing("registration") || savingSection === "registration"
              }
            >
              <Text
                style={
                  operatingScope ? styles.selectValue : styles.selectPlaceholder
                }
              >
                {operatingScope || "Không chọn / không gửi"}
              </Text>
              <Ionicons name="chevron-down" size={20} color={COLORS.primary} />
            </TouchableOpacity>
            <Text style={styles.inputLabel}>Giấy đăng ký kinh doanh mới *</Text>
            {documents.registration ? (
              <Text style={styles.existingFileText}>
                Đã có giấy tờ hiện tại. BE vẫn yêu cầu tải file mới khi cập
                nhật.
              </Text>
            ) : null}
            {isEditing("registration") ? (
              <>
                <FilePickerButton
                  label={
                    registrationCertificate?.fileName ||
                    "Chọn file/ảnh giấy đăng ký mới"
                  }
                  hasFile={Boolean(registrationCertificate)}
                  onPress={async () => {
                    const asset = await pickSingleImage();
                    if (asset) {
                      setRegistrationCertificate(asset);
                      clearFieldError(
                        "registrationCertificate",
                        "registration",
                      );
                    }
                  }}
                />
                <FieldError text={errors.registrationCertificate} />
              </>
            ) : null}
            <InlineMessage message={messages.registration || null} />
            {isEditing("registration") ? (
              <EditActions
                loading={savingSection === "registration"}
                onCancel={() => cancelEdit("registration")}
                onSave={() => void saveRegistration()}
                saveTitle="Xác nhận chỉnh sửa"
              />
            ) : null}
          </Pressable>


          </Pressable>

          <Pressable
            style={styles.editableSection}
            onPress={(event) =>
              handleEditableSectionPress("identity", event)
            }
          >
            <SectionTitle title="THÔNG TIN ĐỊNH DANH" />
          <Pressable
              style={styles.card}
              onPress={handleEditableCardPress}
            >
            <Text style={styles.inputLabel}>Họ và tên *</Text>
            <TextInput
              style={[
                styles.input,
                errors.fullName ? styles.inputError : undefined,
              ]}
              value={fullName}
              maxLength={FULL_NAME_MAX_LENGTH}
              onChangeText={(value) => {
                setFullName(capitalizeWordInitials(value));
                clearFieldError("fullName", "identity");
              }}
              onPressIn={(event) => event.stopPropagation()}
              onFocus={() => handleFieldFocus("identity")}
              editable={!savingSection}
              autoCapitalize="words"
              autoCorrect={false}
              placeholder="Nhập họ và tên"
            />
            <FieldError text={errors.fullName} />
            <Text style={styles.inputLabel}>Số CCCD *</Text>
            <SensitiveNumberField
              containerStyle={[
                styles.input,
                errors.identityNumber ? styles.inputError : undefined,
                { paddingHorizontal: 0 },
              ]}
              inputStyle={{
                paddingHorizontal: 12,
              }}
              hasError={Boolean(errors.identityNumber)}
              value={identityNumber}
              isEditing={isEditing("identity")}
              onChangeText={(value) => {
                setIdentityNumber(value.replace(/[^0-9]/g, "").slice(0, 12));

                clearFieldError("identityNumber", "identity");
              }}
              keyboardType="number-pad"
              maxLength={12}
              placeholder="Nhập 12 số CCCD"
              onPressIn={(event) => event.stopPropagation()}
              onFocus={() => handleFieldFocus("identity")}
              editable={!savingSection}
            />
            <FieldError text={errors.identityNumber} />
            <IdentityNameField
              label="Họ tên trên CCCD"
              required
              value={identityName}
              onChangeText={(value) => {
                setIdentityName(value);
                clearFieldError("identityName", "identity");
              }}
              onPressIn={(event) => event.stopPropagation()}
              onFocus={() => handleFieldFocus("identity")}
              editable={!savingSection}
              error={errors.identityName}
              containerStyle={styles.identityFieldContainer}
              inputStyle={styles.identityInput}
            />
            <Text style={styles.inputLabel}>Ngày sinh *</Text>
            <CalendarDateField
              value={identityDob}
              onChange={(value) => {
                setIdentityDob(value);
                clearFieldError("identityDob", "identity");
              }}
              maximumDate={new Date()}
              hasError={Boolean(errors.identityDob)}
              placeholder="Chọn ngày sinh"
              disabled={!isEditing("identity") || savingSection === "identity"}
            />
            <FieldError text={errors.identityDob} />
            <Text style={styles.inputLabel}>Địa chỉ thường trú *</Text>
            <AddressPickerField
              value={identityAddress}
              onChange={(value, selection) => {
                setIdentityAddress(value);
                setIdentityAddressSelection(selection);
                clearFieldError("identityAddress", "identity");
              }}
              hasError={Boolean(errors.identityAddress)}
              placeholder="Chọn địa chỉ thường trú"
              disabled={!isEditing("identity") || savingSection === "identity"}
            />
            <FieldError text={errors.identityAddress} />
            <Text style={styles.inputLabel}>CCCD mặt trước mới *</Text>
            {documents.front ? (
              <Image
                source={{ uri: documents.front }}
                style={styles.documentPreview}
              />
            ) : null}
            {isEditing("identity") ? (
              <>
                <FilePickerButton
                  label={cccdFront?.fileName || "Chọn ảnh mặt trước mới"}
                  hasFile={Boolean(cccdFront)}
                  onPress={async () => {
                    const asset = await pickSingleImage();
                    if (asset) {
                      setCccdFront(asset);
                      clearFieldError("cccdFront", "identity");
                    }
                  }}
                />
                <FieldError text={errors.cccdFront} />
              </>
            ) : null}
            <Text style={styles.inputLabel}>CCCD mặt sau mới *</Text>
            {documents.back ? (
              <Image
                source={{ uri: documents.back }}
                style={styles.documentPreview}
              />
            ) : null}
            {isEditing("identity") ? (
              <>
                <FilePickerButton
                  label={cccdBack?.fileName || "Chọn ảnh mặt sau mới"}
                  hasFile={Boolean(cccdBack)}
                  onPress={async () => {
                    const asset = await pickSingleImage();
                    if (asset) {
                      setCccdBack(asset);
                      clearFieldError("cccdBack", "identity");
                    }
                  }}
                />
                <FieldError text={errors.cccdBack} />
              </>
            ) : null}
            <InlineMessage message={messages.identity || null} />
            {isEditing("identity") ? (
              <EditActions
                loading={savingSection === "identity"}
                onCancel={() => cancelEdit("identity")}
                onSave={() => void saveIdentity()}
                saveTitle="Xác nhận chỉnh sửa"
              />
            ) : null}
          </Pressable>


          </Pressable>

          <SectionTitle title="KHU VỰC DỊCH VỤ" />
          <View style={styles.card}>
            {serviceAreas.length === 0 ? (
              <Text style={styles.emptyText}>Chưa có khu vực dịch vụ.</Text>
            ) : (
              serviceAreas.map((area) => (
                <View key={area.businessServiceAreaId}>
                  <View style={styles.serviceAreaRow}>
                    <View style={styles.flex}>
                      <Text style={styles.serviceAreaText}>
                        {[area.street, area.ward, area.city]
                          .filter(Boolean)
                          .join(", ")}
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => {
                        setEditingServiceAreaId(area.businessServiceAreaId);
                        setServiceAreaValue(
                          [area.street, area.ward, area.city]
                            .filter(Boolean)
                            .join(", "),
                        );
                        setServiceAreaSelection(null);
                        setDeleteTarget(null);
                        setSectionMessage("serviceArea", {
                          type: "info",
                          text: "Chọn lại địa chỉ bên dưới rồi bấm Lưu để cập nhật khu vực này.",
                        });
                      }}
                    >
                      <Ionicons
                        name="create-outline"
                        size={19}
                        color={COLORS.primary}
                      />
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.iconButton}
                      onPress={() => {
                        setSectionMessage("serviceArea", null);
                        setDeleteTarget(
                          deleteTarget?.businessServiceAreaId ===
                            area.businessServiceAreaId
                            ? null
                            : area,
                        );
                      }}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={19}
                        color={COLORS.error}
                      />
                    </TouchableOpacity>
                  </View>
                  {deleteTarget?.businessServiceAreaId ===
                  area.businessServiceAreaId ? (
                    <View style={styles.inlineDeleteConfirm}>
                      <Text style={styles.inlineDeleteTitle}>
                        Xóa khu vực dịch vụ này?
                      </Text>
                      <Text style={styles.confirmText}>
                        {[area.street, area.ward, area.city]
                          .filter(Boolean)
                          .join(", ")}
                      </Text>
                      <View style={styles.confirmActions}>
                        <TouchableOpacity
                          style={styles.secondaryButton}
                          onPress={() => setDeleteTarget(null)}
                          disabled={savingSection === "serviceArea"}
                        >
                          <Text style={styles.secondaryButtonText}>Ở lại</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.deleteButton}
                          onPress={() => void confirmDeleteServiceArea()}
                          disabled={savingSection === "serviceArea"}
                        >
                          {savingSection === "serviceArea" ? (
                            <ActivityIndicator color={COLORS.white} />
                          ) : (
                            <Text style={styles.deleteButtonText}>Xóa</Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : null}
                </View>
              ))
            )}
            <Text style={styles.inputLabel}>
              {editingServiceAreaId
                ? "Địa chỉ khu vực cần cập nhật *"
                : "Thêm khu vực dịch vụ *"}
            </Text>
            <AddressPickerField
              value={serviceAreaValue}
              onChange={(value, selection) => {
                setServiceAreaValue(value);
                setServiceAreaSelection(selection);
                clearFieldError("serviceArea", "serviceArea");
              }}
              hasError={Boolean(errors.serviceArea)}
              placeholder="Chọn khu vực dịch vụ"
            />
            <FieldError text={errors.serviceArea} />
            <InlineMessage message={messages.serviceArea || null} />
            <View style={styles.inlineButtons}>
              {editingServiceAreaId ? (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={resetServiceAreaEditor}
                >
                  <Text style={styles.secondaryButtonText}>Hủy sửa</Text>
                </TouchableOpacity>
              ) : null}
              <View style={styles.flex}>
                <SaveButton
                  title={editingServiceAreaId ? "Lưu khu vực" : "Thêm khu vực"}
                  loading={savingSection === "serviceArea"}
                  onPress={() => void saveServiceArea()}
                />
              </View>
            </View>
          </View>

          <Pressable
            style={styles.editableSection}
            onPress={(event) =>
              handleEditableSectionPress("bank", event)
            }
          >
            <SectionTitle title="THÔNG TIN NGÂN HÀNG" />
          <Pressable
              style={styles.card}
              onPress={handleEditableCardPress}
            >
            <Text style={styles.helperText}>
              Cần điền đủ thông tin ngân hàng để đi tiếp tới thanh toán.
            </Text>
            <Text style={styles.inputLabel}>Ngân hàng thụ hưởng *</Text>
            {isEditing("bank") ? (
              <BankPickerField
                bankBin={bankCode}
                bankName={bankName}
                onChange={(bank) => {
                  setBankCode(String(bank.bin));
                  setBankName(bank.shortName);
                  clearFieldError("bankCode", "bank");
                  clearFieldError("bankName", "bank");
                }}
                onClear={() => {
                  setBankCode("");
                  setBankName("");
                  clearFieldError("bankCode", "bank");
                  clearFieldError("bankName", "bank");
                }}
                disabled={savingSection === "bank"}
                hasError={Boolean(errors.bankCode || errors.bankName)}
                placeholder="Chọn ngân hàng thụ hưởng"
                style={{ marginBottom: 12 }}
              />
            ) : (
              <View style={[styles.input, styles.readOnlyBankField]}>
                <Text
                  style={
                    bankName
                      ? styles.readOnlyBankText
                      : styles.selectPlaceholder
                  }
                  numberOfLines={1}
                >
                  {bankName || "Chưa có"}
                </Text>
              </View>
            )}
            <FieldError text={errors.bankCode || errors.bankName} />
            <Text style={styles.inputLabel}>Số tài khoản *</Text>
            <SensitiveNumberField
              containerStyle={[
                styles.input,
                errors.accountNumber ? styles.inputError : undefined,
                { paddingHorizontal: 0 },
              ]}
              inputStyle={{
                paddingHorizontal: 12,
              }}
              hasError={Boolean(errors.accountNumber)}
              value={accountNumber}
              isEditing={isEditing("bank")}
              onChangeText={(value) => {
                setAccountNumber(value.replace(/[^0-9]/g, ""));

                clearFieldError("accountNumber", "bank");
              }}
              keyboardType="number-pad"
              placeholder="Nhập số tài khoản"
              onPressIn={(event) => event.stopPropagation()}
              onFocus={() => handleFieldFocus("bank")}
              editable={!savingSection}
            />
            <FieldError text={errors.accountNumber} />
            <IdentityNameField
              label="Tên chủ tài khoản"
              required
              value={accountName}
              onChangeText={(value) => {
                setAccountName(toUppercaseText(value));
                clearFieldError("accountName", "bank");
              }}
              onPressIn={(event) => event.stopPropagation()}
              onFocus={() => handleFieldFocus("bank")}
              editable={!savingSection}
              error={errors.accountName}
              containerStyle={styles.identityFieldContainer}
              inputStyle={styles.identityInput}
              placeholder="VD: NGUYEN VAN A"
            />
            <InlineMessage message={messages.bank || null} />
            {isEditing("bank") ? (
              <EditActions
                loading={savingSection === "bank"}
                onCancel={() => cancelEdit("bank")}
                onSave={() => void saveBank()}
                saveTitle="Xác nhận chỉnh sửa"
              />
            ) : null}
          </Pressable>


          </Pressable>

          <View style={styles.walletCard}>
            <View style={styles.walletRow}>
              <View>
                <Text style={styles.walletLabel}>Số dư khả dụng</Text>
                <Text style={styles.walletValue}>
                  {formatCurrency(availableBalance)}
                </Text>
              </View>
              <Ionicons
                name="wallet-outline"
                size={30}
                color={COLORS.primary}
              />
            </View>
            <Text style={styles.walletHold}>
              Đang giữ: {formatCurrency(holdBalance)}
            </Text>
            <TouchableOpacity
              style={styles.historyButton}
              onPress={() => router.push("/payments/history" as any)}
            >
              <Text style={styles.historyButtonText}>
                Xem lịch sử thanh toán
              </Text>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={COLORS.primary}
              />
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.surveyButton}
            onPress={() => router.push("/profile/business-survey" as any)}
          >
            <Ionicons
              name="document-text-outline"
              size={20}
              color={COLORS.primary}
            />
            <Text style={styles.surveyButtonText}>
              Xem lại bản Khảo sát thu mua
            </Text>
          </TouchableOpacity>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showAvatarPreview && Boolean(avatarUri)}
        transparent
        animationType="fade"
        onRequestClose={() => setShowAvatarPreview(false)}
      >
        <ModalBackdrop
          style={styles.avatarPreviewOverlay}
          onPress={() => setShowAvatarPreview(false)}
        >
          <ModalSurface style={styles.avatarPreviewCard}>
            <View style={styles.avatarPreviewHeader}>
              <Text style={styles.avatarPreviewTitle}>Ảnh đại diện</Text>
              <TouchableOpacity
                style={styles.avatarPreviewClose}
                onPress={() => setShowAvatarPreview(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {avatarUri ? (
              <Image
                source={getAvatarSource(avatarUri)}
                style={styles.avatarPreviewImage}
                resizeMode="contain"
              />
            ) : null}
          </ModalSurface>
        </ModalBackdrop>
      </Modal>

      <Modal
        visible={showScopeModal && isEditing("registration")}
        transparent
        animationType="fade"
        onRequestClose={() => setShowScopeModal(false)}
      >
        <ModalBackdrop
          style={styles.modalOverlay}
          onPress={() => setShowScopeModal(false)}
        >
          <ModalSurface style={styles.modalCard}>
            <Text style={styles.modalTitle}>Chọn phạm vi hoạt động</Text>
            <TouchableOpacity
              style={styles.optionRow}
              onPress={() => {
                setOperatingScope("");
                setShowScopeModal(false);
              }}
            >
              <Text style={styles.optionText}>Không chọn / không gửi</Text>
            </TouchableOpacity>
            {OPERATING_SCOPE_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                style={styles.optionRow}
                onPress={() => {
                  setOperatingScope(option);
                  setShowScopeModal(false);
                }}
              >
                <Text style={styles.optionText}>{option}</Text>
              </TouchableOpacity>
            ))}
          </ModalSurface>
        </ModalBackdrop>
      </Modal>
    </SafeAreaView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return (
    <View style={styles.sectionTitleContainer}>
      <View style={styles.sectionTitleHeading}>
        <View style={styles.sectionTitleBar} />
        <Text style={styles.sectionTitleText}>{title}</Text>
      </View>
    </View>
  );
}
function FieldError({ text }: { text?: string }) {
  return text ? <Text style={styles.fieldError}>{text}</Text> : null;
}
function EditActions({
  loading,
  onCancel,
  onSave,
  saveTitle,
}: {
  loading: boolean;
  onCancel: () => void;
  onSave: () => void;
  saveTitle: string;
}) {
  return (
    <View style={styles.editActions}>
      <TouchableOpacity
        style={styles.secondaryButton}
        onPress={onCancel}
        disabled={loading}
      >
        <Text style={styles.secondaryButtonText}>Hủy</Text>
      </TouchableOpacity>
      <View style={styles.flex}>
        <SaveButton title={saveTitle} loading={loading} onPress={onSave} />
      </View>
    </View>
  );
}
function SaveButton({
  title,
  loading,
  onPress,
}: {
  title: string;
  loading: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.saveButton, loading ? styles.disabledButton : undefined]}
      onPress={onPress}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color={COLORS.white} />
      ) : (
        <>
          <Ionicons name="save-outline" size={19} color={COLORS.white} />
          <Text style={styles.saveButtonText}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
function FilePickerButton({
  label,
  hasFile,
  onPress,
}: {
  label: string;
  hasFile: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.filePicker} onPress={onPress}>
      <Ionicons
        name={hasFile ? "checkmark-circle-outline" : "cloud-upload-outline"}
        size={20}
        color={hasFile ? "#2F765D" : COLORS.primary}
      />
      <Text style={styles.filePickerText} numberOfLines={1}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  flex: { flex: 1 },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  loadingText: { marginTop: 10, color: COLORS.textLight },
  loadErrorText: { color: COLORS.error, textAlign: "center", lineHeight: 20 },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
  },
  retryButtonText: { color: COLORS.white, fontWeight: "800" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  backButton: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 50 },
  contentPressArea: { flexGrow: 1, width: "100%" },
  editableSection: { width: "100%" },
  avatarTopSection: {
    width: "100%",
    marginTop: 22,
    alignItems: "center",
  },
  avatarTopContent: {
    alignItems: "center",
  },
  avatarTopImage: {
    width: 92,
    height: 92,
    borderRadius: 46,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  avatarTopPlaceholder: {
    width: 92,
    height: 92,
    borderRadius: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  avatarActionRow: {
    width: "100%",
    alignSelf: "stretch",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    marginTop: 14,
    paddingHorizontal: 8,
  },
  avatarActionButton: {
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  avatarViewButton: {
    flex: 1,
    maxWidth: 210,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  avatarViewButtonText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "600",
  },
  avatarChangeButton: {
    flex: 1,
    maxWidth: 210,
    backgroundColor: COLORS.primary,
  },
  avatarChangeButtonText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "600",
  },
  avatarAddButton: {
    width: 210,
    flexGrow: 0,
    flexShrink: 0,
    backgroundColor: COLORS.primary,
  },
  avatarEditPanel: {
    width: "100%",
    marginTop: 10,
  },
  avatarPendingText: {
    color: COLORS.textLight,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginBottom: 10,
  },
  avatarPreviewOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.62)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  avatarPreviewCard: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    overflow: "hidden",
  },
  avatarPreviewHeader: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarPreviewTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
  avatarPreviewClose: { padding: 6 },
  avatarPreviewImage: {
    width: "100%",
    height: 420,
    backgroundColor: "#F8F9FA",
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 12,
  },
  sectionTitleHeading: { flexDirection: "row", alignItems: "center", flex: 1 },
  sectionTitleBar: {
    width: 4,
    height: 18,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitleText: { fontSize: 14, fontWeight: "700", color: "#172830" },
  editButton: {
    minHeight: 34,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(43, 86, 89, 0.28)",
    backgroundColor: "rgba(84, 123, 125, 0.08)",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginLeft: 12,
  },
  editButtonText: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  editingLabel: { color: COLORS.textLight, fontSize: 12, fontWeight: "600" },
  card: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  walletCard: {
    marginTop: 20,
    backgroundColor: "rgba(47, 118, 93, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(47, 118, 93, 0.24)",
    borderRadius: 14,
    padding: 16,
  },
  walletRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  walletLabel: { color: "#2F765D", fontSize: 12, fontWeight: "700" },
  walletValue: {
    color: "#2F765D",
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
  },
  walletHold: { color: "#2F765D", marginTop: 6, fontSize: 12 },
  historyButton: {
    marginTop: 14,
    minHeight: 42,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  historyButtonText: { color: COLORS.primary, fontWeight: "600", fontSize: 13 },
  inputLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 7,
    marginTop: 2,
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    fontSize: 14,
    marginBottom: 12,
  },
  multilineInput: { minHeight: 92, textAlignVertical: "top", paddingTop: 12 },
  inputError: { borderColor: COLORS.error },
  readOnlyBankField: { justifyContent: "center", backgroundColor: "#F8F9FA" },
  readOnlyBankText: { color: COLORS.text, fontSize: 14 },
  fieldError: {
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 17,
    marginTop: -7,
    marginBottom: 12,
  },
  helperText: {
    color: COLORS.textLight,
    fontSize: 12,
    lineHeight: 18,
    fontStyle: "italic",
    marginBottom: 14,
  },
  existingFileText: {
    color: COLORS.textLight,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 8,
  },
  selectTrigger: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: COLORS.white,
  },
  selectValue: { color: COLORS.text, fontSize: 14 },
  selectPlaceholder: { color: COLORS.textLight, fontSize: 14 },
  filePicker: {
    minHeight: 52,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 12,
  },
  filePickerText: { flex: 1, color: COLORS.text, fontSize: 13 },
  saveButton: {
    minHeight: 50,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveButtonText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  disabledButton: { opacity: 0.6 },
  messageBox: {
    borderWidth: 1,
    borderRadius: 9,
    padding: 10,
    marginBottom: 12,
  },
  messageText: { fontSize: 12, lineHeight: 18 },
  messageError: {
    backgroundColor: "rgba(122, 16, 18, 0.08)",
    borderColor: "rgba(122, 16, 18, 0.22)",
  },
  messageErrorText: { color: "#7A1012" },
  messageSuccess: {
    backgroundColor: "rgba(47, 118, 93, 0.10)",
    borderColor: "rgba(47, 118, 93, 0.24)",
  },
  messageSuccessText: { color: "#2F765D" },
  messageWarning: {
    backgroundColor: "rgba(154, 100, 24, 0.10)",
    borderColor: "rgba(154, 100, 24, 0.24)",
  },
  messageWarningText: { color: "#9A6418" },
  messageInfo: {
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    borderColor: "rgba(84, 123, 125, 0.24)",
  },
  messageInfoText: { color: "#2B5659" },
  avatarRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 84, height: 84, borderRadius: 42 },
  avatarPlaceholder: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  outlineButton: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 9,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  outlineButtonText: { color: COLORS.primary, fontWeight: "600", fontSize: 13 },
  identityFieldContainer: { marginBottom: 0 },
  identityInput: { minHeight: 50, borderRadius: 10 },
  documentPreview: {
    width: "100%",
    height: 150,
    borderRadius: 10,
    marginBottom: 10,
    resizeMode: "cover",
    backgroundColor: "#F8F9FA",
  },
  serviceAreaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#BAC2C1",
    paddingVertical: 11,
  },
  serviceAreaText: { color: COLORS.text, fontSize: 13, lineHeight: 18 },
  iconButton: { padding: 8 },
  emptyText: { color: COLORS.textLight, fontStyle: "italic", marginBottom: 14 },
  inlineButtons: { flexDirection: "row", gap: 10, alignItems: "center" },
  editActions: {
    flexDirection: "row",
    gap: 10,
    alignItems: "center",
    marginTop: 4,
  },
  secondaryButton: {
    minHeight: 46,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonText: { color: COLORS.primary, fontWeight: "600" },
  inlineDeleteConfirm: {
    marginTop: 8,
    marginBottom: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(122, 16, 18, 0.22)",
    borderRadius: 10,
    backgroundColor: "rgba(122, 16, 18, 0.08)",
  },
  inlineDeleteTitle: {
    color: "#7A1012",
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 5,
  },
  confirmText: { color: COLORS.textLight, lineHeight: 20, marginBottom: 12 },
  confirmActions: { flexDirection: "row", justifyContent: "flex-end", gap: 10 },
  deleteButton: {
    minHeight: 46,
    borderRadius: 9,
    backgroundColor: "#7A1012",
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButtonText: { color: COLORS.white, fontWeight: "800" },
  surveyButton: {
    marginTop: 26,
    minHeight: 52,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(84, 123, 125, 0.24)",
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  surveyButtonText: { color: COLORS.primary, fontWeight: "800", fontSize: 14 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(23, 40, 48, 0.45)",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 18 },
  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 12,
  },
  optionRow: {
    minHeight: 50,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#BAC2C1",
  },
  optionText: { color: COLORS.text, fontSize: 14 },
});
