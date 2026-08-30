import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import AddressPickerField from "../../src/components/shared/AddressPickerField";
import BankPickerField from "../../src/components/shared/BankPickerField";
import CalendarDateField from "../../src/components/shared/CalendarDateField";
import IdentityNameField from "../../src/components/shared/IdentityNameField";
import SensitiveNumberField from "../../src/components/shared/SensitiveNumberField";
import { ModalBackdrop, ModalSurface } from "../../src/components/shared/ModalBackdrop";
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

type PersonalSection = "profile" | "identity" | "bank";

export default function AccountInfoScreen() {
  const router = useRouter();
  const { user, reloadUser } = useAuth();

  const [isSaving, setIsSaving] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [saveMessage, setSaveMessage] = useState<SaveMessage>(null);
  const [editingSection, setEditingSection] = useState<PersonalSection | null>(null);
  const [showAvatarPreview, setShowAvatarPreview] = useState(false);
  const [showAvatarActions, setShowAvatarActions] = useState(false);

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

  const resetSection = useCallback((section: PersonalSection) => {
    if (!user) return;

    if (section === "profile") {
      setUsername(sanitize(user.username));
      setFullName(capitalizeWordInitials(sanitize(user.fullName || user.name)));
      setPhoneNumber(sanitize(user.phoneNumber || user.phone));
      setAvatarUrl(sanitize(user.avatarUrl || user.avatar));
      setNewAvatarFile(null);
    }

    if (section === "identity") {
      setRepCode(sanitize(user.representativeCode));
      setRepName(toUppercaseText(sanitize(user.representativeName)));
      setRepDob(sanitize(user.representativeDob));
      setRepAddress(sanitize(user.representativeAddress));
      setFrontImage(null);
      setBackImage(null);
    }

    if (section === "bank") {
      const bank = user.bankAccount || {};
      setBankCode(sanitize(bank.bankCode));
      setBankName(toUppercaseText(sanitize(bank.bankName)));
      setAccountNumber(sanitize(bank.accountNumber));
      setAccountName(toUppercaseText(sanitize(bank.accountName)));
    }

    setSaveMessage(null);
  }, [user]);

  const beginEdit = (section: PersonalSection) => {
    if (isSaving) return;
    setShowAvatarActions(false);
    resetSection(section);
    setEditingSection(section);
  };

  const cancelEdit = (section: PersonalSection) => {
    if (isSaving) return;
    resetSection(section);
    setEditingSection(null);
  };

  const dismissActiveEdit = () => {
    Keyboard.dismiss();
    setShowAvatarActions(false);
    if (!editingSection || isSaving) return;
    cancelEdit(editingSection);
  };

  const handleSectionPress = (section: PersonalSection) => {
    if (isSaving) return;

    if (editingSection === section) return;

    if (editingSection) {
      cancelEdit(editingSection);
      beginEdit(section);
      return;
    }

    beginEdit(section);
  };

  const handleSectionSurfacePress = (
    section: PersonalSection,
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

    if (editingSection !== section) {
      handleSectionPress(section);
    }
  };


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


  const handleAvatarPress = (event: any) => {
    event.stopPropagation();
    if (isSaving) return;

    if (editingSection && editingSection !== "profile") {
      cancelEdit(editingSection);
    }

    setShowAvatarActions((current) => !current);
  };

  const handleAvatarImageChange = async () => {
    if (isSaving) return;

    setShowAvatarActions(false);

    if (editingSection && editingSection !== "profile") {
      cancelEdit(editingSection);
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
    });

    if (result.canceled) return;

    if (editingSection !== "profile") {
      beginEdit("profile");
    }

    setSaveMessage(null);
    setNewAvatarFile(result.assets[0]);
  };

  const handleSaveChanges = async (section: PersonalSection) => {
    setIsSaving(true);
    setSaveMessage(null);

    try {
      const apiTasks: Promise<any>[] = [];
      const originalData = user || {};
      const bank = originalData.bankAccount || {};

      if (section === "profile") {
        const normalizedUsername = username.trim();
        const normalizedFullName = capitalizeWordInitials(
          fullName.trim().replace(/\s+/gu, " "),
        );
        const normalizedPhone = normalizeVietnamPhone(phoneNumber);
        const originalUsername = sanitize(originalData.username).trim();
        const originalFullName = capitalizeWordInitials(
          sanitize(originalData.fullName || originalData.name),
        ).trim().replace(/\s+/gu, " ");
        const originalPhone = sanitize(
          originalData.phoneNumber || originalData.phone,
        );

        const usernameChanged = normalizedUsername !== originalUsername;
        const fullNameChanged = normalizedFullName !== originalFullName;
        const phoneChanged =
          normalizedPhone !== normalizeVietnamPhone(originalPhone);

        if (usernameChanged || fullNameChanged || phoneChanged) {
          const profileValidationError =
            (usernameChanged ? validateUsername(username) : "") ||
            (fullNameChanged ? validateFullName(fullName) : "") ||
            (phoneChanged ? validateVietnamPhone(phoneNumber) : "");

          if (profileValidationError) {
            setSaveMessage({ type: "error", text: profileValidationError });
            return;
          }

          apiTasks.push(
            apiClient.patch("/personal-profiles/me/profile", {
              username: usernameChanged ? normalizedUsername : originalUsername,
              fullName: fullNameChanged ? normalizedFullName : originalFullName,
              phoneNumber: phoneChanged ? normalizedPhone : originalPhone,
            }),
          );
        }

        if (newAvatarFile) {
          const formData = new FormData();
          await appendFileToForm(formData, "AvatarUrl", newAvatarFile, "avatar.jpg");
          apiTasks.push(
            apiClient.patch("/personal-profiles/me/avatar", formData, {
              timeout: 60000,
            }),
          );
        }
      }

      if (section === "identity") {
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
      }

      if (section === "bank") {
        const normalizedAccountName = toUppercaseText(accountName).trim();
        const bankChanged =
          bankCode !== sanitize(bank.bankCode) ||
          toUppercaseText(bankName) !==
            toUppercaseText(sanitize(bank.bankName)) ||
          accountNumber !== sanitize(bank.accountNumber) ||
          normalizedAccountName !==
            toUppercaseText(sanitize(bank.accountName)).trim();

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
      if (section === "profile") setNewAvatarFile(null);
      if (section === "identity") {
        setFrontImage(null);
        setBackImage(null);
      }
      setSaveMessage({
        type: "success",
        text: "Cập nhật thông tin thành công.",
      });
      setEditingSection(null);
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
  const hasActualAvatar = Boolean(newAvatarFile?.uri || avatarUrl);
  const avatarPreviewUri = newAvatarFile?.uri
    ? newAvatarFile.uri
    : avatarUrl
      ? getRobustUrl(avatarUrl)
      : "";

  const SectionHeader = ({
    title,
    section,
  }: {
    title: string;
    section: PersonalSection;
  }) => {
    const active = editingSection === section;

    return (
      <View style={styles.sectionHeader}>
        <View style={styles.sectionHeading}>
          <View style={styles.sectionBar} />
          <Text style={styles.sectionTitle}>{title}</Text>
        </View>

        <View
          style={[
            styles.sectionStateChip,
            active ? styles.sectionStateChipActive : undefined,
          ]}
        >
          <Ionicons
            name={active ? "create" : "create-outline"}
            size={14}
            color={COLORS.primary}
          />
          <Text style={styles.sectionStateText}>
            {active ? "Đang chỉnh sửa" : "Chỉnh sửa"}
          </Text>
        </View>
      </View>
    );
  };

  const EditActions = ({ section }: { section: PersonalSection }) =>
    editingSection === section ? (
      <View style={styles.sectionActions}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => cancelEdit(section)}
          disabled={isSaving}
        >
          <Text style={styles.cancelButtonText}>Hủy</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            styles.sectionSaveButton,
            isSaving ? styles.disabled : undefined,
          ]}
          onPress={() => void handleSaveChanges(section)}
          disabled={isSaving}
        >
          {isSaving ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <>
              <Ionicons name="save-outline" size={18} color={COLORS.white} />
              <Text style={styles.primaryButtonText}>Xác nhận chỉnh sửa</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    ) : null;

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
          onScrollBeginDrag={dismissActiveEdit}
        >
          <Pressable style={styles.contentPressArea} onPress={dismissActiveEdit}>
          <View style={styles.avatarWrapper}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={handleAvatarPress}
              disabled={isSaving}
              activeOpacity={0.85}
              accessibilityRole="button"
              accessibilityLabel="Mở tùy chọn ảnh đại diện"
            >
              <Image
                source={displayAvatar}
                style={styles.avatar}
                onError={() => setImageError(true)}
              />
            </TouchableOpacity>

            {showAvatarActions ? (
            <View style={styles.avatarActionRow}>
              {hasActualAvatar ? (
                <>
                  <TouchableOpacity
                    style={[styles.avatarActionButton, styles.avatarViewButton]}
                    onPress={(event) => {
                      event.stopPropagation();
                      setShowAvatarActions(false);
                      setShowAvatarPreview(true);
                    }}
                    disabled={isSaving}
                  >
                    <Ionicons
                      name="eye-outline"
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={styles.avatarViewButtonText} numberOfLines={1}>
                      Xem ảnh đại diện
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.avatarActionButton, styles.avatarChangeButton]}
                    onPress={(event) => {
                      event.stopPropagation();
                      setShowAvatarActions(false);
                      void handleAvatarImageChange();
                    }}
                    disabled={isSaving}
                  >
                    <Ionicons
                      name="camera-outline"
                      size={18}
                      color={COLORS.white}
                    />
                    <Text style={styles.avatarChangeButtonText} numberOfLines={1}>
                      Đổi ảnh đại diện
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.avatarActionButton,
                    styles.avatarChangeButton,
                    styles.avatarAddButton,
                  ]}
                  onPress={(event) => {
                    event.stopPropagation();
                    setShowAvatarActions(false);
                    void handleAvatarImageChange();
                  }}
                  disabled={isSaving}
                >
                  <Ionicons
                    name="add-circle-outline"
                    size={18}
                    color={COLORS.white}
                  />
                  <Text style={styles.avatarChangeButtonText} numberOfLines={1}>
                    Thêm ảnh đại diện
                  </Text>
                </TouchableOpacity>
              )}
            </View>
            ) : null}

            {editingSection === "profile" && newAvatarFile ? (
              <Text style={styles.avatarPendingText}>
                Ảnh mới đang được xem trước. Xác nhận chỉnh sửa để lưu.
              </Text>
            ) : null}
          </View>

          <View style={styles.sectionShell}>
            <Pressable
              style={[
                styles.sectionCard,
                editingSection === "profile"
                  ? styles.sectionCardEditing
                  : undefined,
              ]}
              onPress={(event) =>
                handleSectionSurfacePress("profile", event)
              }
            >
              <SectionHeader
                title="THÔNG TIN CÁ NHÂN"
                section="profile"
              />

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
              editable={editingSection === "profile" && !isSaving}
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
              editable={editingSection === "profile" && !isSaving}
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
              editable={editingSection === "profile" && !isSaving}
              placeholder="Chưa có"
              placeholderTextColor={PLACEHOLDER_COLOR}
            />
          </View>

          <EditActions section="profile" />

            </Pressable>
          </View>

          <View style={styles.sectionShell}>
            <Pressable
              style={[
                styles.sectionCard,
                editingSection === "identity"
                  ? styles.sectionCardEditing
                  : undefined,
              ]}
              onPress={(event) =>
                handleSectionSurfacePress("identity", event)
              }
            >
              <SectionHeader
                title="HỒ SƠ PHÁP LÝ"
                section="identity"
              />

          <Text style={styles.label}>CCCD của bạn</Text>
          <View style={styles.cccdRow}>
            <TouchableOpacity
              style={styles.cccdBox}
              onPress={() => void pickImage("front")}
              disabled={editingSection !== "identity" || isSaving}
            >
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

            <TouchableOpacity
              style={styles.cccdBox}
              onPress={() => void pickImage("back")}
              disabled={editingSection !== "identity" || isSaving}
            >
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
            editable={editingSection === "identity" && !isSaving}
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
            editable={editingSection === "identity" && !isSaving}
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
            disabled={editingSection !== "identity" || isSaving}
          />

          <Text style={styles.label}>Địa chỉ thường trú</Text>
          <AddressPickerField
            value={repAddress}
            onChange={(value) => {
              setRepAddress(value);
              setSaveMessage(null);
            }}
            placeholder="Chưa có"
            disabled={editingSection !== "identity" || isSaving}
          />

          <EditActions section="identity" />

            </Pressable>
          </View>

          <View style={styles.sectionShell}>
            <Pressable
              style={[
                styles.sectionCard,
                editingSection === "bank"
                  ? styles.sectionCardEditing
                  : undefined,
              ]}
              onPress={(event) =>
                handleSectionSurfacePress("bank", event)
              }
            >
              <SectionHeader
                title="THÔNG TIN THANH TOÁN"
                section="bank"
              />

          <Text style={styles.label}>Ngân hàng thụ hưởng</Text>
          {editingSection === "bank" ? (
            <BankPickerField
              bankBin={bankCode}
              bankName={bankName}
              onChange={(bank) => {
                setBankCode(String(bank.bin));
                setBankName(toUppercaseText(bank.shortName));
                setSaveMessage(null);
              }}
              onClear={() => {
                setBankCode("");
                setBankName("");
                setSaveMessage(null);
              }}
              disabled={isSaving}
              placeholder="Chưa có"
              style={{ marginBottom: 20 }}
            />
          ) : (
            <View style={styles.inputContainer}>
              <Text
                style={bankName ? styles.readOnlyValue : styles.placeholderText}
                numberOfLines={1}
              >
                {bankName || "Chưa có"}
              </Text>
            </View>
          )}

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
            editable={editingSection === "bank" && !isSaving}
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
            editable={editingSection === "bank" && !isSaving}
            labelStyle={styles.label}
            inputStyle={styles.identityNameInput}
          />

          <EditActions section="bank" />

            </Pressable>
          </View>

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
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal
        visible={showAvatarPreview && Boolean(avatarPreviewUri)}
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
            {avatarPreviewUri ? (
              <Image
                source={{ uri: avatarPreviewUri }}
                style={styles.avatarPreviewImage}
                resizeMode="contain"
              />
            ) : null}
          </ModalSurface>
        </ModalBackdrop>
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
  scrollContainer: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  contentPressArea: {
    flexGrow: 1,
  },
  sectionShell: {
    width: "100%",
    marginBottom: 16,
  },
  sectionCard: {
    width: "100%",
    borderWidth: 1,
    borderColor: "#D6DDDC",
    borderRadius: 16,
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    paddingTop: 16,
    paddingBottom: 18,
  },
  sectionCardEditing: {
    borderColor: "rgba(43, 86, 89, 0.62)",
    backgroundColor: "rgba(43, 86, 89, 0.035)",
  },
  avatarWrapper: {
    width: "100%",
    alignItems: "center",
    marginTop: 24,
    marginBottom: 16,
  },
  avatarContainer: { position: "relative" },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: COLORS.border,
    borderWidth: 1,
    borderColor: COLORS.border,
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
    minHeight: 42,
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
    flex: 0,
    width: 210,
    maxWidth: "100%",
  },
  avatarPendingText: {
    color: COLORS.textLight,
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 10,
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
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 0,
    marginBottom: 16,
  },
  sectionHeading: { flexDirection: "row", alignItems: "center", flex: 1 },
  sectionBar: {
    width: 4,
    height: 16,
    backgroundColor: "#2B5659",
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: "600", color: "#172830" },
  sectionStateChip: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderColor: "rgba(43, 86, 89, 0.20)",
    backgroundColor: "rgba(43, 86, 89, 0.05)",
    marginLeft: 10,
  },
  sectionStateChipActive: {
    borderColor: "rgba(43, 86, 89, 0.45)",
    backgroundColor: "rgba(43, 86, 89, 0.10)",
  },
  sectionStateText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "700",
  },
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
  readOnlyValue: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
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
  primaryButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "700" },
  sectionActions: { flexDirection: "row", gap: 10, alignItems: "center", marginTop: 4, marginBottom: 4 },
  cancelButton: { minHeight: 50, minWidth: 96, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  cancelButtonText: { color: COLORS.primary, fontSize: 14, fontWeight: "600" },
  sectionSaveButton: { flex: 1, minHeight: 50, height: 50, marginTop: 0, flexDirection: "row", gap: 7 },
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