import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
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
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";

// HÀM CHỐNG CHẶN ẢNH TỪ NHÀ MẠNG
const getRobustUrl = (url: string) => {
  if (url?.includes("googleusercontent.com")) {
    return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
  }
  return url;
};

const sanitize = (val: any) => {
  if (val === "string" || val === "null" || val === null || val === undefined)
    return "";
  return val;
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

export default function AccountInfoScreen() {
  const router = useRouter();
  const { user, reloadUser } = useAuth();

  const [isSaving, setIsSaving] = useState(false);
  const [imageError, setImageError] = useState(false);

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
    if (user) {
      setUsername(sanitize(user.username));
      setFullName(sanitize(user.fullName || user.name));
      setPhoneNumber(sanitize(user.phoneNumber || user.phone));

      const userAvatar = user.avatarUrl || user.avatar;
      setAvatarUrl(sanitize(userAvatar));

      setRepCode(sanitize(user.representativeCode));
      setRepName(sanitize(user.representativeName));
      setRepDob(sanitize(user.representativeDob));
      setRepAddress(sanitize(user.representativeAddress));

      const bank = user.bankAccount || {};
      setBankCode(sanitize(bank.bankCode));
      setBankName(sanitize(bank.bankName));
      setAccountNumber(sanitize(bank.accountNumber));
      setAccountName(sanitize(bank.accountName));
    }
  }, [user]);

  const pickImage = async (type: "avatar" | "front" | "back") => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: type === "avatar" ? [1, 1] : [4, 3],
      quality: 0.5,
    });

    if (!result.canceled) {
      const asset = result.assets[0];
      if (type === "avatar") setNewAvatarFile(asset);
      if (type === "front") setFrontImage(asset);
      if (type === "back") setBackImage(asset);
    }
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      const apiTasks: Promise<any>[] = [];
      const originalData = user || {};
      const bank = originalData.bankAccount || {};

      const profileChanged =
        username !== sanitize(originalData.username) ||
        fullName !== sanitize(originalData.name) ||
        phoneNumber !== sanitize(originalData.phone);

      if (profileChanged) {
        apiTasks.push(
          apiClient.put("/personal-profiles/me/profile", {
            username,
            fullName,
            phoneNumber,
          }),
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
        repName !== sanitize(originalData.representativeName) ||
        repDob !== sanitize(originalData.representativeDob) ||
        repAddress !== sanitize(originalData.representativeAddress) ||
        frontImage !== null ||
        backImage !== null;

      if (identityChanged) {
        const formData = new FormData();
        formData.append("RepresentativeCode", repCode || "");
        formData.append("RepresentativeName", repName || "");
        formData.append("RepresentativeDob", repDob || "");
        formData.append("RepresentativeAddress", repAddress || "");

        if (frontImage)
          await appendFileToForm(
            formData,
            "FrontIDCardImage",
            frontImage,
            "front.jpg",
          );
        if (backImage)
          await appendFileToForm(
            formData,
            "BackIDCardImage",
            backImage,
            "back.jpg",
          );

        apiTasks.push(
          apiClient.put("/personal-profiles/me/identity", formData, {
            timeout: 60000,
          }),
        );
      }

      const bankChanged =
        bankName !== sanitize(bank.bankName) ||
        accountNumber !== sanitize(bank.accountNumber) ||
        accountName !== sanitize(bank.accountName);

      if (bankChanged) {
        apiTasks.push(
          apiClient.put("/personal-profiles/me/bank", {
            bankCode: bankCode || "VNBANK",
            bankName,
            accountNumber,
            accountName,
          }),
        );
      }

      if (apiTasks.length > 0) {
        await Promise.all(apiTasks);
        alert("Cập nhật thông tin thành công!");
        await reloadUser();
      } else {
        alert("Không có thông tin nào bị thay đổi.");
      }
    } catch (error) {
      console.log("Save error:", error);
      alert("Đã xảy ra lỗi khi lưu thông tin. Vui lòng thử lại!");
    } finally {
      setIsSaving(false);
    }
  };

  const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(username || "U")}&background=random&color=fff&size=200`;
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
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)");
              }
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
                onPress={() => pickImage("avatar")}
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
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
            />
          </View>

          <Text style={styles.label}>Họ và Tên</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Nhập họ và tên..."
            />
          </View>

          <Text style={styles.label}>Số điện thoại</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              keyboardType="phone-pad"
            />
          </View>

          <SectionHeader title="HỒ SƠ PHÁP LÝ" />

          <Text style={styles.label}>CCCD của bạn</Text>
          <View style={styles.cccdRow}>
            <TouchableOpacity
              style={styles.cccdBox}
              onPress={() => pickImage("front")}
            >
              {frontImage?.uri || sanitize(user?.frontIDCardImage) ? (
                <Image
                  source={{
                    uri: getRobustUrl(
                      frontImage?.uri || sanitize(user?.frontIDCardImage),
                    ),
                  }}
                  style={{ width: "100%", height: "100%", borderRadius: 12 }}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <Ionicons
                    name="camera-outline"
                    size={24}
                    color={COLORS.primary}
                    style={{ marginBottom: 4 }}
                  />
                  <Text style={styles.uploadText}>Mặt trước</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cccdBox}
              onPress={() => pickImage("back")}
            >
              {backImage?.uri || sanitize(user?.backIDCardImage) ? (
                <Image
                  source={{
                    uri: getRobustUrl(
                      backImage?.uri || sanitize(user?.backIDCardImage),
                    ),
                  }}
                  style={{ width: "100%", height: "100%", borderRadius: 12 }}
                  resizeMode="cover"
                />
              ) : (
                <>
                  <Ionicons
                    name="camera-outline"
                    size={24}
                    color={COLORS.primary}
                    style={{ marginBottom: 4 }}
                  />
                  <Text style={styles.uploadText}>Mặt sau</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Số CCCD</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={repCode}
              onChangeText={setRepCode}
              keyboardType="number-pad"
              placeholder="Nhập số thẻ CCCD..."
            />
          </View>

          <Text style={styles.label}>Họ tên trên CCCD</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={repName}
              onChangeText={setRepName}
              autoCapitalize="characters"
              placeholder="Nhập chính xác họ tên..."
            />
          </View>

          <Text style={styles.label}>Ngày sinh (trên CCCD)</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={repDob}
              onChangeText={setRepDob}
              placeholder="YYYY-MM-DD"
            />
            <Ionicons
              name="calendar-outline"
              size={20}
              color={COLORS.textLight}
            />
          </View>

          <Text style={styles.label}>Địa chỉ thường trú</Text>
          <View
            style={[
              styles.inputContainer,
              { height: 80, alignItems: "flex-start", paddingTop: 12 },
            ]}
          >
            <TextInput
              style={styles.input}
              value={repAddress}
              onChangeText={setRepAddress}
              multiline
              placeholder="Nhập địa chỉ thường trú..."
            />
          </View>

          <SectionHeader title="THÔNG TIN THANH TOÁN" />

          <Text style={styles.label}>Ngân hàng thụ hưởng</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={bankName}
              onChangeText={setBankName}
              placeholder="VD: Vietcombank, Techcombank..."
            />
          </View>

          <Text style={styles.label}>Số tài khoản</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={accountNumber}
              onChangeText={setAccountNumber}
              keyboardType="number-pad"
              placeholder="Nhập số tài khoản..."
            />
          </View>

          <Text style={styles.label}>
            Tên chủ tài khoản (Phải khớp với CCCD)
          </Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.input}
              value={accountName}
              onChangeText={setAccountName}
              autoCapitalize="characters"
              placeholder="VD: NGUYEN VAN A"
            />
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleSaveChanges}
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
    backgroundColor: "#2C5A56",
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
    backgroundColor: "#2C5A56",
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#172B30" },
  label: { fontSize: 13, fontWeight: "600", color: "#334155", marginBottom: 8 },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
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
  cccdRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  cccdBox: {
    flex: 1,
    height: 90,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
  },
  uploadText: { fontSize: 13, color: "#475569", fontWeight: "500" },
  primaryButton: {
    backgroundColor: "#2C5A56",
    borderRadius: 12,
    height: 54,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 24,
  },
  primaryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },
});
