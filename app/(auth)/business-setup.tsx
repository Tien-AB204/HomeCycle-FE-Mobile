import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
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

import { notifyUser } from "../../src/components/shared/ActionFeedback";
import AddressPickerField, {
  AddressPickerFieldHandle,
  AddressSelection,
} from "../../src/components/shared/AddressPickerField";
import CalendarDateField, {
  CalendarDateFieldHandle,
} from "../../src/components/shared/CalendarDateField";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

interface Bank {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
}

const readValidationError = (errors: unknown, fieldName: string): string => {
  if (!errors || typeof errors !== "object") return "";
  const entries = Object.entries(errors as Record<string, unknown>);
  const matchedEntry = entries.find(
    ([key]) =>
      key.toLowerCase() === fieldName.toLowerCase() ||
      key.toLowerCase().startsWith(`${fieldName.toLowerCase()}.`),
  );
  if (!matchedEntry) return "";
  const value = matchedEntry[1];
  if (Array.isArray(value))
    return value
      .filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
      .join(" ");
  return typeof value === "string" ? value.trim() : "";
};

const appendFileToForm = async (
  formData: FormData,
  key: string,
  fileUri: string,
  defaultName: string,
) => {
  if (
    !fileUri ||
    fileUri === "undefined" ||
    fileUri === "null" ||
    fileUri.startsWith("http")
  )
    return;
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

export default function BusinessSetupScreen() {
  const router = useRouter();

  // CHỈ LẤY ISREJECTED ĐỂ FETCH DATA EDIT
  const { isRejected } = useLocalSearchParams();
  const { reloadUser } = useAuth();

  const identityDobPickerRef = useRef<CalendarDateFieldHandle | null>(null);
  const identityAddressPickerRef = useRef<AddressPickerFieldHandle | null>(
    null,
  );
  const businessAddressPickerRef = useRef<AddressPickerFieldHandle | null>(
    null,
  );
  const warehouseAddressPickerRef = useRef<AddressPickerFieldHandle | null>(
    null,
  );

  const [step, setStep] = useState(1);
  const [model, setModel] = useState<"household" | "enterprise" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingOldData, setIsFetchingOldData] = useState(false);

  // Lý do từ chối
  const [rejectReasonMsg, setRejectReasonMsg] = useState("");

  const [identityNumberError, setIdentityNumberError] = useState("");
  const [identityDobError, setIdentityDobError] = useState("");
  const [serviceAreaError, setServiceAreaError] = useState("");
  const [businessAddressError, setBusinessAddressError] = useState("");
  const [submitError, setSubmitError] = useState("");

  const [fullName, setFullName] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [taxCode, setTaxCode] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [businessAddressSelection, setBusinessAddressSelection] =
    useState<AddressSelection | null>(null);

  // Lưu riêng City và Ward để:
  // 1. Gửi đúng hai field bắt buộc của BE.
  // 2. Giữ được dữ liệu khi tải lại hồ sơ bị từ chối.
  const [businessCity, setBusinessCity] = useState("");
  const [businessWard, setBusinessWard] = useState("");

  const [identityNumber, setIdentityNumber] = useState("");
  const [identityName, setIdentityName] = useState("");
  const [identityDob, setIdentityDob] = useState("");
  const [identityAddress, setIdentityAddress] = useState("");
  const [operatingScope, setOperatingScope] = useState("Toàn quốc");

  const [warehouseAddress, setWarehouseAddress] = useState("");
  const [warehouseAddressSelection, setWarehouseAddressSelection] =
    useState<AddressSelection | null>(null);

  const [businessLicense, setBusinessLicense] = useState<string | null>(null);
  const [frontImage, setFrontImage] = useState<string | null>(null);
  const [backImage, setBackImage] = useState<string | null>(null);
  const [authorizationLetter, setAuthorizationLetter] = useState<string | null>(
    null,
  );

  const [bankCode, setBankCode] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankDisplayCode, setBankDisplayCode] = useState("");
  const [bankLogo, setBankLogo] = useState<string | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [isAccountNameManuallyEdited, setIsAccountNameManuallyEdited] =
    useState(false);

  const [showBankModal, setShowBankModal] = useState(false);
  const [banks, setBanks] = useState<Bank[]>([]);
  const [filteredBanks, setFilteredBanks] = useState<Bank[]>([]);
  const [isBankLoading, setIsBankLoading] = useState(false);
  const [searchBankQuery, setSearchBankQuery] = useState("");

  // FETCH DATA CŨ NẾU LÀ REJECTED
  useEffect(() => {
    const fetchOldData = async () => {
      if (isRejected === "true") {
        try {
          setIsFetchingOldData(true);
          const res = await apiClient.get(
            "/business-profiles/registration-detail",
          );
          const data = res.data?.data;

          if (data) {
            setRejectReasonMsg(
              data.rejectReason ||
                "Hồ sơ cần được bổ sung thêm thông tin. Vui lòng kiểm tra lại.",
            );
            setModel(
              data.businessModel === "Enterprise" ? "enterprise" : "household",
            );
            setBusinessAddress(data.businessAddress || "");
            setBusinessCity(data.city || "");
            setBusinessWard(data.ward || "");
            setFullName(data.fullName || "");
            setTaxCode(data.taxCode || "");
            setIdentityNumber(data.identityNumber || "");
            setIdentityName(data.identityName || "");
            setIdentityDob(data.identityDob || "");
            setIdentityAddress(data.identityAddress || "");
            setOperatingScope(data.operatingScope || "Toàn quốc");
            setBusinessAddress(data.businessAddress || "");

            setBankCode(data.bankCode || "");
            setBankName(data.bankName || "");
            setAccountNumber(data.accountNumber || "");
            setAccountName(data.accountName || "");

            if (data.documents) {
              data.documents.forEach((doc: any) => {
                if (doc.documentType === 0) setFrontImage(doc.documentUrl);
                if (doc.documentType === 1) setBackImage(doc.documentUrl);
                if (doc.documentType === 2) setBusinessLicense(doc.documentUrl);
                if (doc.documentType === 3)
                  setAuthorizationLetter(doc.documentUrl);
              });
            }
          }
        } catch (error) {
          console.log("Lỗi fetch old data", error);
        } finally {
          setIsFetchingOldData(false);
        }
      }
    };
    fetchOldData();
  }, [isRejected]);

  useEffect(() => {
    const fetchBanks = async () => {
      try {
        setIsBankLoading(true);
        const response = await fetch("https://api.vietqr.io/v2/banks");
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const json = await response.json();
        if (json.code === "00" && Array.isArray(json.data)) {
          setBanks(json.data);
          setFilteredBanks(json.data);
          return;
        }
      } catch (error: unknown) {
        console.error("Lỗi tải danh sách ngân hàng:", error);
      } finally {
        setIsBankLoading(false);
      }
    };
    fetchBanks();
  }, []);

  const handleSearchBank = (text: string) => {
    setSearchBankQuery(text);
    const normalizedText = text.trim().toLowerCase();
    if (!normalizedText) return setFilteredBanks(banks);
    setFilteredBanks(
      banks.filter(
        (b) =>
          b.shortName.toLowerCase().includes(normalizedText) ||
          b.name.toLowerCase().includes(normalizedText) ||
          b.code.toLowerCase().includes(normalizedText),
      ),
    );
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

  const pickImage = async (
    type: "license" | "front" | "back" | "authorization",
  ) => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (result.canceled) return;
      const selectedUri = result.assets?.[0]?.uri;
      if (!selectedUri) return setSubmitError("Không thể đọc ảnh vừa chọn.");

      if (type === "license") setBusinessLicense(selectedUri);
      if (type === "front") setFrontImage(selectedUri);
      if (type === "back") setBackImage(selectedUri);
      if (type === "authorization") setAuthorizationLetter(selectedUri);
    } catch (error: unknown) {
      setSubmitError("Không thể chọn hình ảnh.");
    }
  };

  const handleNextToForm = () => {
    if (!model) return notifyUser("Vui lòng chọn mô hình kinh doanh.", "error");
    setStep(2);
  };

  const handleRepresentativeNameChange = (value: string) => {
    setFullName(value);
    setIdentityName(value);
    if (!isAccountNameManuallyEdited) setAccountName(value);
  };

  const handleSubmit = async () => {
    setIdentityNumberError("");
    setIdentityDobError("");
    setServiceAreaError("");
    setBusinessAddressError("");
    setSubmitError("");

    if (
      !fullName.trim() ||
      !businessName.trim() ||
      !taxCode.trim() ||
      !identityNumber.trim() ||
      !identityName.trim() ||
      !identityAddress.trim()
    ) {
      return setSubmitError("Vui lòng điền đầy đủ các thông tin bắt buộc.");
    }
    if (!/^\d{12}$/.test(identityNumber.trim()))
      return setIdentityNumberError("Số CCCD phải gồm đúng 12 chữ số.");
    if (!identityDob) return setIdentityDobError("Vui lòng chọn ngày sinh.");
    if (
      !businessAddress.trim() ||
      !businessCity.trim() ||
      !businessWard.trim()
    ) {
      return setBusinessAddressError(
        "Vui lòng chọn đầy đủ tỉnh/thành, phường/xã và địa chỉ trụ sở.",
      );
    }
    if (fullName.trim().toLowerCase() !== identityName.trim().toLowerCase())
      return setSubmitError(
        "Họ và tên người đại diện phải giống họ tên trên CCCD.",
      );
    if (!businessLicense || !frontImage || !backImage)
      return setSubmitError(
        "Vui lòng tải lên giấy chứng nhận đăng ký kinh doanh và hai mặt CCCD.",
      );

    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append("FullName", fullName.trim());
      formData.append("BusinessName", businessName.trim());
      formData.append(
        "BusinessDescription",
        model === "household" ? "Hộ kinh doanh" : "Doanh nghiệp",
      );
      formData.append("TaxCode", taxCode.trim());
      formData.append("IdentityNumber", identityNumber.trim());
      formData.append("IdentityName", identityName.trim());
      formData.append("IdentityDob", identityDob);
      formData.append("IdentityAddress", identityAddress.trim());
      // Địa chỉ trụ sở/cơ sở kinh doanh.
      formData.append(
        "BusinessAddress",
        businessAddress.trim(),
      );

      // City và Ward vẫn là field bắt buộc của BE.
      // Giá trị lấy từ AddressPickerField hoặc hồ sơ cũ.
      formData.append("City", businessCity.trim());
      formData.append("Ward", businessWard.trim());

      formData.append(
        "OperatingScope",
        operatingScope.trim(),
      );

      formData.append(
        "BusinessModel",
        model === "household" ? "0" : "1",
      );

      /*
      * ServiceArea hiện có thể bỏ qua.
      *
      * Hộ kinh doanh:
      * - Tuyệt đối không gửi ServiceArea.
      *
      * Doanh nghiệp:
      * - Chỉ gửi khi người dùng thật sự chọn địa chỉ kho bãi.
      * - Không tự lấy địa chỉ trụ sở làm địa chỉ kho.
      */
      if (
        model === "enterprise" &&
        warehouseAddressSelection
      ) {
        formData.append(
          "ServiceArea.City",
          warehouseAddressSelection.provinceName,
        );

        formData.append(
          "ServiceArea.Street",
          warehouseAddressSelection.streetAddress,
        );

        formData.append(
          "ServiceArea.Ward",
          warehouseAddressSelection.wardName,
        );
      }

      if (bankCode) formData.append("BankCode", bankCode);
      if (bankName) formData.append("BankName", bankName);
      if (accountNumber.trim())
        formData.append("AccountNumber", accountNumber.trim());
      if (accountName.trim())
        formData.append("AccountName", accountName.trim());

      formData.append("Documents[0].DocumentType", "0");
      await appendFileToForm(
        formData,
        "Documents[0].DocumentUrl",
        frontImage,
        "cccd_front.jpg",
      );

      formData.append("Documents[1].DocumentType", "1");
      await appendFileToForm(
        formData,
        "Documents[1].DocumentUrl",
        backImage,
        "cccd_back.jpg",
      );

      formData.append("Documents[2].DocumentType", "2");
      await appendFileToForm(
        formData,
        "Documents[2].DocumentUrl",
        businessLicense,
        "business_registration.jpg",
      );

      if (model === "enterprise" && authorizationLetter) {
        formData.append("Documents[3].DocumentType", "3");
        await appendFileToForm(
          formData,
          "Documents[3].DocumentUrl",
          authorizationLetter,
          "authorization_letter.jpg",
        );
      }

      const token = await AsyncStorage.getItem("accessToken");
      if (!token || token === "null")
        return setSubmitError("Phiên đăng nhập hết hạn.");

      await apiClient.post("/business-profiles/submit", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
        timeout: 60000,
      });

      if (reloadUser) await reloadUser();

      setStep(3); // Hiện Success
    } catch (error: unknown) {
      console.error("Lỗi nộp hồ sơ doanh nghiệp:", error);
      const responseData = (error as any)?.response?.data;
      const responseErrors = responseData?.errors;
      const responseMessage =
        typeof responseData?.message === "string" ? responseData.message : "";

      const nextIdentityNumberError =
        readValidationError(responseErrors, "IdentityNumber") ||
        (/identity number/i.test(responseMessage) ? responseMessage : "");
      const nextIdentityDobError = readValidationError(
        responseErrors,
        "IdentityDob",
      );
      const nextServiceAreaError = readValidationError(
        responseErrors,
        "ServiceArea",
      );
      const nextCityError = readValidationError(responseErrors, "City");
      const nextWardError = readValidationError(responseErrors, "Ward");
      const nextBusinessAddressError = readValidationError(
        responseErrors,
        "BusinessAddress",
      );

      const nextAddressError = [
        nextBusinessAddressError,
        nextCityError,
        nextWardError,
      ]
        .filter(Boolean)
        .join(" ");

      setIdentityNumberError(nextIdentityNumberError);
      setIdentityDobError(nextIdentityDobError);
      // City/Ward/BusinessAddress thuộc địa chỉ trụ sở.
      setBusinessAddressError(nextAddressError);

      // ServiceArea chỉ thuộc phần kho bãi của doanh nghiệp.
      setServiceAreaError(
        model === "enterprise"
          ? nextServiceAreaError
          : "",
      );

      const relevantServiceAreaError =
        model === "enterprise"
          ? nextServiceAreaError
          : "";

      if (
        !nextIdentityNumberError &&
        !nextIdentityDobError &&
        !nextAddressError &&
        !relevantServiceAreaError
      ) {
        setSubmitError(
          getApiErrorMessage(error, "Không thể gửi hồ sơ doanh nghiệp."),
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    if (step === 2) return setStep(1);
    router.back();
  };

  const SectionHeader = ({ title }: { title: string }) => (
    <View style={styles.sectionHeaderContainer}>
      <View style={styles.sectionHeaderBar} />
      <Text style={styles.sectionHeaderText}>{title}</Text>
    </View>
  );

  const UploadBox = ({
    icon,
    text,
    uri,
    onPress,
  }: {
    icon: any;
    text: string;
    uri?: string | null;
    onPress: () => void;
  }) => (
    <TouchableOpacity
      style={styles.uploadBox}
      onPress={onPress}
      disabled={isLoading}
    >
      {uri ? (
        <Image
          source={{ uri }}
          style={styles.uploadedImage}
          resizeMode="cover"
        />
      ) : (
        <>
          <Ionicons
            name={icon}
            size={24}
            color={COLORS.primary}
            style={styles.uploadIcon}
          />
          <Text style={styles.uploadBoxText}>{text}</Text>
        </>
      )}
    </TouchableOpacity>
  );

  const webInputStyle =
    Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : undefined;

  if (isFetchingOldData) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        {step < 3 && (
          <View style={styles.header}>
            <TouchableOpacity
              onPress={handleBack}
              style={styles.backButton}
              disabled={isLoading}
            >
              <Ionicons name="arrow-back" size={24} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>HomeCycle</Text>
            <View style={styles.headerSpacer} />
          </View>
        )}

        <ScrollView
          contentContainerStyle={
            step === 3 ? styles.successScrollContainer : styles.scrollContainer
          }
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {step < 3 ? (
            <View style={styles.progressContainer}>
              <Text
                style={[
                  styles.progressText,
                  step >= 1 ? styles.progressTextActive : undefined,
                ]}
              >
                Chọn loại hình
              </Text>
              <Text style={styles.progressSeparator}>{">"}</Text>
              <Text
                style={[
                  styles.progressText,
                  step >= 2 ? styles.progressTextActive : undefined,
                ]}
              >
                Thông tin pháp lý
              </Text>
              <Text style={styles.progressSeparator}>{">"}</Text>
              <Text style={styles.progressText}>Hoàn tất</Text>
            </View>
          ) : null}

          {rejectReasonMsg && step === 2 && (
            <View style={styles.warningBanner}>
              <Ionicons name="warning" size={20} color="#B45309" />
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: "bold", color: "#92400E" }}>
                  Yêu cầu chỉnh sửa:
                </Text>
                <Text style={styles.warningText}>{rejectReasonMsg}</Text>
              </View>
            </View>
          )}

          {step === 1 ? (
            <View style={styles.modelSelectionWrapper}>
              <View style={styles.modelIntroduction}>
                <Text style={styles.title}>Chọn mô hình kinh doanh</Text>
                <Text style={styles.subtitle}>
                  Vui lòng chọn mô hình phù hợp để chúng tôi cung cấp biểu mẫu
                  khai báo chính xác.
                </Text>
              </View>

              <View style={styles.cardsContainer}>
                <TouchableOpacity
                  style={[
                    styles.card,
                    model === "household" ? styles.cardActive : undefined,
                  ]}
                  onPress={() => setModel("household")}
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
                  {model === "household" && (
                    <View style={styles.checkBadge}>
                      <Ionicons
                        name="checkmark"
                        size={14}
                        color={COLORS.white}
                      />
                    </View>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.card,
                    model === "enterprise" ? styles.cardActive : undefined,
                  ]}
                  onPress={() => setModel("enterprise")}
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
                  {model === "enterprise" && (
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

              <View style={styles.dividerTop}>
                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    !model ? styles.inactiveButton : undefined,
                  ]}
                  onPress={handleNextToForm}
                  disabled={!model}
                >
                  <Text style={styles.primaryButtonText}>TIẾP TỤC</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={16}
                    color={COLORS.white}
                    style={styles.buttonIcon}
                  />
                </TouchableOpacity>
              </View>
            </View>
          ) : null}

          {step === 2 ? (
            <View style={styles.formContainer}>
              <SectionHeader title="THÔNG TIN ĐỊNH DANH" />

              <Text style={styles.label}>
                {model === "household"
                  ? "Tên hộ kinh doanh"
                  : "Tên doanh nghiệp đầy đủ"}
              </Text>
              <TextInput
                style={[styles.input, webInputStyle]}
                placeholder="Nhập tên đăng ký kinh doanh"
                placeholderTextColor={COLORS.textLight}
                value={businessName}
                onChangeText={setBusinessName}
                editable={!isLoading}
              />

              <Text style={styles.label}>Mã số thuế</Text>
              <TextInput
                style={[styles.input, webInputStyle]}
                placeholder="Nhập 10 hoặc 13 số"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                value={taxCode}
                onChangeText={setTaxCode}
                editable={!isLoading}
              />

              <Text style={styles.label}>
                Địa chỉ trụ sở chính / Cơ sở kinh doanh
              </Text>
              <AddressPickerField
                ref={businessAddressPickerRef}
                value={businessAddress}
                onChange={(nextAddress, selection) => {
                  setBusinessAddress(nextAddress);
                  setBusinessAddressSelection(selection);

                  // City và Ward được lấy từ lựa chọn thật của người dùng.
                  setBusinessCity(selection.provinceName);
                  setBusinessWard(selection.wardName);

                  setBusinessAddressError("");
                }}
                placeholder="Chọn địa chỉ trụ sở / cơ sở kinh doanh"
                disabled={isLoading}
                hasError={Boolean(businessAddressError)}
              />
              {businessAddressError ? (
                <Text style={styles.fieldErrorText}>
                  {businessAddressError}
                </Text>
              ) : null}

              {model === "enterprise" ? (
                <>
                  <Text style={styles.label}>Địa chỉ kho bãi (Tùy chọn)</Text>
                  <AddressPickerField
                    ref={warehouseAddressPickerRef}
                    value={warehouseAddress}
                    onChange={(nextAddress, selection) => {
                      setWarehouseAddress(nextAddress);
                      setWarehouseAddressSelection(selection);
                      setServiceAreaError("");
                    }}
                    placeholder="Chọn địa chỉ kho tập kết hàng hóa"
                    disabled={isLoading}
                    hasError={Boolean(serviceAreaError)}
                  />
                  {serviceAreaError ? (
                    <Text style={styles.fieldErrorText}>
                      {serviceAreaError}
                    </Text>
                  ) : null}
                </>
              ) : null}

              <SectionHeader title="THÔNG TIN NGƯỜI ĐẠI DIỆN / CHỦ HỘ" />

              <Text style={styles.label}>Họ và tên</Text>
              <TextInput
                style={[styles.input, webInputStyle]}
                placeholder="NHẬP ĐẦY ĐỦ HỌ VÀ TÊN"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="characters"
                value={fullName}
                onChangeText={handleRepresentativeNameChange}
                editable={!isLoading}
                returnKeyType="next"
              />
              <Text style={styles.helperText}>
                *Phải trùng khớp hoàn toàn với CCCD và tài khoản ngân hàng
              </Text>

              <Text style={styles.label}>Số CCCD</Text>
              <TextInput
                style={[
                  styles.input,
                  webInputStyle,
                  identityNumberError ? styles.inputError : null,
                ]}
                placeholder="Nhập 12 chữ số CCCD"
                placeholderTextColor={COLORS.textLight}
                keyboardType="numeric"
                inputMode="numeric"
                maxLength={12}
                value={identityNumber}
                onChangeText={(value) => {
                  const numericValue = value.replace(/\D/g, "").slice(0, 12);
                  setIdentityNumber(numericValue);
                  if (identityNumberError) setIdentityNumberError("");
                }}
                editable={!isLoading}
                returnKeyType="next"
              />
              {identityNumberError ? (
                <Text style={styles.fieldErrorText}>{identityNumberError}</Text>
              ) : null}

              <Text style={styles.label}>Họ tên trên CCCD</Text>
              <TextInput
                style={[styles.input, webInputStyle]}
                placeholder="Nhập họ tên như trên CCCD"
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="characters"
                value={identityName}
                onChangeText={handleRepresentativeNameChange}
                editable={!isLoading}
                returnKeyType="next"
                blurOnSubmit={false}
                onSubmitEditing={() => identityDobPickerRef.current?.open()}
              />

              <Text style={styles.label}>Ngày sinh</Text>
              <CalendarDateField
                ref={identityDobPickerRef}
                value={identityDob}
                onChange={(value) => {
                  setIdentityDob(value);
                  setIdentityDobError("");
                  requestAnimationFrame(() => {
                    identityAddressPickerRef.current?.open();
                  });
                }}
                placeholder="Chọn ngày sinh"
                defaultViewDate="2000-01-01"
                maximumDate={new Date()}
                disabled={isLoading}
              />
              {identityDobError ? (
                <Text style={styles.fieldErrorText}>{identityDobError}</Text>
              ) : null}

              <Text style={styles.label}>Địa chỉ thường trú (Trên CCCD)</Text>
              <AddressPickerField
                ref={identityAddressPickerRef}
                value={identityAddress}
                onChange={(nextAddress) => setIdentityAddress(nextAddress)}
                placeholder="Chọn địa chỉ thường trú"
                disabled={isLoading}
              />

              <SectionHeader title="HỒ SƠ PHÁP LÝ" />

              <Text style={styles.label}>
                {model === "household"
                  ? "Giấy chứng nhận đăng ký hộ kinh doanh"
                  : "Giấy chứng nhận đăng ký doanh nghiệp"}
              </Text>
              <UploadBox
                icon="cloud-upload-outline"
                text="Tải lên file giấy phép kinh doanh"
                uri={businessLicense}
                onPress={() => pickImage("license")}
              />

              <Text style={styles.label}>CCCD/CMND (Mặt trước & Mặt sau)</Text>
              <View style={styles.row}>
                <View style={styles.leftUploadColumn}>
                  <UploadBox
                    icon="camera-outline"
                    text="Mặt trước"
                    uri={frontImage}
                    onPress={() => pickImage("front")}
                  />
                </View>
                <View style={styles.rightUploadColumn}>
                  <UploadBox
                    icon="camera-outline"
                    text="Mặt sau"
                    uri={backImage}
                    onPress={() => pickImage("back")}
                  />
                </View>
              </View>

              {model === "enterprise" ? (
                <>
                  <Text style={styles.label}>
                    Giấy ủy quyền + CCCD người được ủy quyền (Tùy chọn)
                  </Text>
                  <UploadBox
                    icon="attach-outline"
                    text="Tải lên ảnh giấy ủy quyền"
                    uri={authorizationLetter}
                    onPress={() => pickImage("authorization")}
                  />
                </>
              ) : null}

              <SectionHeader title="THÔNG TIN THANH TOÁN" />

              <View style={styles.paymentBox}>
                <Text style={styles.label}>Ngân hàng thụ hưởng</Text>
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
                      <Text style={styles.inputBankText}>
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

                <Text style={styles.label}>Số tài khoản</Text>
                <TextInput
                  style={[styles.inputPayment, webInputStyle]}
                  placeholder="Nhập số tài khoản ngân hàng"
                  placeholderTextColor={COLORS.textLight}
                  keyboardType="numeric"
                  value={accountNumber}
                  onChangeText={setAccountNumber}
                  editable={!isLoading}
                />

                <Text style={styles.label}>
                  Tên chủ tài khoản (Nên giống với tên doanh nghiệp/đại diện)
                </Text>
                <TextInput
                  style={[
                    styles.inputPayment,
                    webInputStyle,
                    { marginBottom: 0 },
                  ]}
                  placeholder="VD: NGUYEN VAN A"
                  placeholderTextColor={COLORS.textLight}
                  autoCapitalize="characters"
                  value={accountName}
                  onChangeText={(value) => {
                    setIsAccountNameManuallyEdited(true);
                    setAccountName(value);
                  }}
                  selectTextOnFocus={
                    !isAccountNameManuallyEdited && Boolean(accountName)
                  }
                  editable={!isLoading}
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    if (!isLoading) void handleSubmit();
                  }}
                />
              </View>

              {submitError ? (
                <Text style={styles.submitErrorText}>{submitError}</Text>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.submitButton,
                  isLoading ? styles.loadingButton : undefined,
                ]}
                onPress={handleSubmit}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>
                      {isRejected === "true" ? "NỘP LẠI HỒ SƠ" : "GỬI YÊU CẦU"}
                    </Text>
                    <Ionicons
                      name="send"
                      size={14}
                      color={COLORS.white}
                      style={styles.buttonIcon}
                    />
                  </>
                )}
              </TouchableOpacity>
              <Text style={styles.footerNote}>
                Bằng cách nhấn gửi, bạn đồng ý với các điều khoản bảo mật thông
                tin của chúng tôi.
              </Text>
            </View>
          ) : null}

          {/* CHỈ CÒN HIỆN SUCCESS Ở ĐÂY */}
          {step === 3 && (
            <View style={styles.successWrapper}>
              <View style={styles.iconCircle}>
                <Ionicons name="checkmark-circle" size={64} color="#0EA5E9" />
              </View>

              <Text style={styles.successTitle}>Nộp hồ sơ thành công!</Text>
              <Text style={styles.successSubtitle}>
                Tài khoản doanh nghiệp của bạn đang được đội ngũ HomeCycle xét
                duyệt.
              </Text>

              <TouchableOpacity
                style={styles.btnGoHome}
                onPress={() => router.replace("/(tabs)/profile")}
              >
                <Text style={styles.btnGoHomeText}>Về trang Profile</Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={COLORS.white}
                  style={styles.goHomeIcon}
                />
              </TouchableOpacity>
            </View>
          )}
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
                style={[styles.bankSearchInput, webInputStyle]}
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
                        {item.shortName}{" "}
                        <Text style={styles.bankCodeText}>({item.code})</Text>
                      </Text>
                      <Text style={styles.bankFullName} numberOfLines={1}>
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
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: COLORS.border,
  },
  backButton: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  headerSpacer: { width: 40 },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  successScrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    justifyContent: "center",
  },
  progressContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 32,
    marginTop: 16,
  },
  progressText: { fontSize: 12, fontWeight: "600", color: COLORS.textLight },
  progressTextActive: { color: COLORS.primary, fontWeight: "bold" },
  progressSeparator: {
    marginHorizontal: 8,
    color: COLORS.textLight,
    fontSize: 12,
  },
  modelSelectionWrapper: { width: "100%" },
  modelIntroduction: { alignItems: "center", marginBottom: 24 },
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
  cardsContainer: { flexDirection: "row", gap: 12, marginBottom: 24 },
  inputError: { borderColor: "#B91C1C" },
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
  fieldErrorText: {
    color: "#B91C1C",
    fontSize: 12,
    lineHeight: 17,
    marginTop: -10,
    marginBottom: 14,
  },
  submitErrorText: {
    color: "#B91C1C",
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  leftUploadColumn: { flex: 1, marginRight: 8 },
  rightUploadColumn: { flex: 1, marginLeft: 8 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 48,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },
  textArea: { height: 80, paddingTop: 12, textAlignVertical: "top" },
  uploadBox: {
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderStyle: "dashed",
    borderRadius: 8,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    backgroundColor: "#FAFAFA",
    overflow: "hidden",
  },
  uploadIcon: { marginBottom: 8 },
  uploadBoxText: { fontSize: 12, color: COLORS.textLight, textAlign: "center" },
  uploadedImage: { width: "100%", height: "100%" },
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
    color: COLORS.text,
    backgroundColor: COLORS.white,
    marginBottom: 12,
  },
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
    marginBottom: 12,
  },
  selectedBankRow: { flex: 1, flexDirection: "row", alignItems: "center" },
  selectedBankLogo: { width: 24, height: 24, marginRight: 8 },
  inputBankText: { flex: 1, fontSize: 14, color: COLORS.text },
  placeholderText: { flex: 1, fontSize: 14, color: COLORS.textLight },
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
    flexDirection: "row",
  },
  inactiveButton: { backgroundColor: "#A0B4B3" },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "bold",
    letterSpacing: 0.5,
  },
  buttonIcon: { marginLeft: 8 },
  submitButton: {
    backgroundColor: "#7B1E1E",
    height: 52,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "row",
    marginBottom: 12,
  },
  loadingButton: { opacity: 0.7 },
  submitButtonText: { color: COLORS.white, fontSize: 15, fontWeight: "bold" },
  footerNote: {
    fontSize: 12,
    color: COLORS.textLight,
    textAlign: "center",
    fontStyle: "italic",
    paddingHorizontal: 20,
  },

  successWrapper: { flex: 1, justifyContent: "center", alignItems: "center" },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F0F9FF",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 12,
    textAlign: "center",
  },
  successSubtitle: {
    fontSize: 15,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
  },

  btnOutline: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 8,
    marginBottom: 24,
  },
  btnOutlineText: { color: COLORS.primary, fontWeight: "600" },

  readOnlyCard: {
    width: "100%",
    backgroundColor: "#F8FAFC",
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  readOnlyTitle: {
    fontSize: 15,
    fontWeight: "bold",
    marginBottom: 12,
    color: COLORS.text,
  },
  readOnlyRow: { flexDirection: "row", marginBottom: 8 },
  readOnlyLabel: { fontSize: 13, color: COLORS.textLight, flex: 1 },
  readOnlyValue: {
    fontSize: 13,
    fontWeight: "500",
    color: COLORS.text,
    flex: 2,
    textAlign: "right",
  },

  btnGoHome: {
    backgroundColor: COLORS.primary,
    width: "100%",
    height: 54,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  btnGoHomeText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },
  goHomeIcon: { marginLeft: 8 },

  warningBanner: {
    flexDirection: "row",
    backgroundColor: "#FEF3C7",
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: "flex-start",
    gap: 10,
  },
  warningText: {
    fontSize: 13,
    color: "#92400E",
    lineHeight: 18,
    marginTop: 4,
    paddingRight: 20,
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
  modalTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  modalCloseButton: { padding: 4 },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F5F6F8",
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
  },
  bankLoading: { marginTop: 40 },
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
});
