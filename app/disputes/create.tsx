import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
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
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import apiClient from "../../src/services/apis/axiosClient";

const disputeCategories = [
  { value: 1, label: "Không xuất hiện / bùng hẹn" },
  { value: 2, label: "Hàng hóa không đúng mô tả" },
  { value: 3, label: "Người bán không giao hàng" },
  { value: 4, label: "Hàng hóa hư hỏng hoặc thất lạc" },
  { value: 5, label: "Không nhận được hàng" },
  { value: 6, label: "Gian lận / lừa đảo" },
  { value: 8, label: "Không thanh toán theo thỏa thuận" },
  { value: 9, label: "Vi phạm cam kết giao dịch" },
  { value: 99, label: "Khác" },
] as const;

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const allowedExtensions = [".jpg", ".jpeg", ".png", ".webp"];

type InlineMessage = {
  type: "error" | "warning" | "info";
  text: string;
} | null;

const getSingleParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const getErrorCode = (error: any) =>
  String(
    error?.response?.data?.code ||
      error?.response?.data?.error?.code ||
      error?.code ||
      "",
  );

const getErrorMessage = (error: any, fallback: string) =>
  String(
    error?.response?.data?.message ||
      error?.response?.data?.error?.message ||
      error?.message ||
      fallback,
  );

const isSupportedImage = (asset: ImagePicker.ImagePickerAsset) => {
  const fileName = String(asset.fileName || "").toLowerCase();
  const mimeType = String(asset.mimeType || "").toLowerCase();

  if (fileName) {
    return allowedExtensions.some((extension) => fileName.endsWith(extension));
  }

  return ["image/jpeg", "image/png", "image/webp"].includes(mimeType);
};

const appendEvidenceImage = async (
  formData: FormData,
  asset: ImagePicker.ImagePickerAsset,
  index: number,
) => {
  const fallbackName = `dispute-evidence-${index + 1}.jpg`;

  if (Platform.OS === "web") {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    formData.append("EvidenceImages", blob, asset.fileName || fallbackName);
    return;
  }

  formData.append("EvidenceImages", {
    uri: asset.uri,
    name: asset.fileName || fallbackName,
    type: asset.mimeType || "image/jpeg",
  } as any);
};

export default function CreateDisputeScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = getSingleParam(params.orderId as string | string[] | undefined);
  const orderCode = getSingleParam(params.orderCode as string | string[] | undefined);
  const productName = getSingleParam(params.productName as string | string[] | undefined);

  const [category, setCategory] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<InlineMessage>(null);

  const selectedCategoryLabel = useMemo(
    () => disputeCategories.find((item) => item.value === category)?.label,
    [category],
  );

  const clearMessage = () => setPageMessage(null);

  const validate = () => {
    let valid = true;
    setCategoryError(null);
    setDescriptionError(null);
    setImageError(null);
    setPageMessage(null);

    if (!orderId) {
      setPageMessage({ type: "error", text: "Không tìm thấy mã đơn hàng để khiếu nại." });
      valid = false;
    }

    if (!category) {
      setCategoryError("Vui lòng chọn loại khiếu nại.");
      valid = false;
    }

    const trimmedDescription = description.trim();
    if (trimmedDescription.length < 10) {
      setDescriptionError("Mô tả phải có ít nhất 10 ký tự.");
      valid = false;
    } else if (trimmedDescription.length > 2000) {
      setDescriptionError("Mô tả không được vượt quá 2000 ký tự.");
      valid = false;
    }

    if (images.length < 3 || images.length > 5) {
      setImageError("Cần cung cấp từ 3 đến 5 ảnh bằng chứng.");
      valid = false;
    } else {
      const unsupported = images.find((asset) => !isSupportedImage(asset));
      if (unsupported) {
        setImageError("Chỉ chấp nhận ảnh JPG, JPEG, PNG hoặc WEBP.");
        valid = false;
      }

      const oversized = images.find(
        (asset) => Number((asset as any).fileSize || 0) > MAX_IMAGE_SIZE,
      );
      if (oversized) {
        setImageError("Dung lượng mỗi ảnh không được vượt quá 5MB.");
        valid = false;
      }
    }

    return valid;
  };

  const pickImages = async () => {
    clearMessage();
    setImageError(null);

    if (images.length >= 5) {
      setImageError("Bạn đã chọn đủ tối đa 5 ảnh bằng chứng.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 5 - images.length,
      quality: 0.8,
    });

    if (result.canceled) return;

    const nextImages = [...images, ...result.assets].slice(0, 5);
    const unsupported = nextImages.find((asset) => !isSupportedImage(asset));
    if (unsupported) {
      setImageError("Có ảnh không đúng định dạng. Chỉ dùng JPG, JPEG, PNG hoặc WEBP.");
      return;
    }

    const oversized = nextImages.find(
      (asset) => Number((asset as any).fileSize || 0) > MAX_IMAGE_SIZE,
    );
    if (oversized) {
      setImageError("Có ảnh vượt quá 5MB. Vui lòng chọn ảnh nhỏ hơn.");
      return;
    }

    setImages(nextImages);
  };

  const removeImage = (index: number) => {
    setImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setImageError(null);
    clearMessage();
  };

  const goToExistingDispute = async () => {
    if (!orderId) return false;

    try {
      const response = await apiClient.get(`/orders/${orderId}`);
      const orderDetail = response.data?.data || response.data;
      const disputeId = orderDetail?.dispute?.latestDisputeId;

      if (disputeId) {
        router.replace(`/disputes/${disputeId}` as any);
        return true;
      }
    } catch {
      // Nếu không lấy được LatestDisputeId, giữ nguyên lỗi create để user thấy tại form.
    }

    return false;
  };

  const submit = async () => {
    if (!validate() || !orderId || !category) return;

    try {
      setIsSubmitting(true);
      setPageMessage(null);

      const formData = new FormData();
      // BE là source of truth. FE chỉ gửi đúng 5 field mà endpoint CreateDispute yêu cầu.
      formData.append("TargetType", "2");
      formData.append("TargetId", orderId);
      formData.append("Category", String(category));
      formData.append("Description", description.trim());

      for (let index = 0; index < images.length; index += 1) {
        await appendEvidenceImage(formData, images[index], index);
      }

      // Không tự set Content-Type để runtime/Axios tự tạo multipart boundary.
      const response = await apiClient.post("/disputes", formData, {
        timeout: 60000,
      });
      const created = response.data?.data || response.data;
      const disputeId = created?.disputeId;

      if (!disputeId) {
        setPageMessage({
          type: "error",
          text: "Đã gửi yêu cầu nhưng không nhận được mã tranh chấp từ hệ thống.",
        });
        return;
      }

      router.replace(`/disputes/${disputeId}` as any);
    } catch (error: any) {
      const code = getErrorCode(error);

      if (code === "DISPUTE_ALREADY_ACTIVE") {
        const redirected = await goToExistingDispute();
        if (redirected) return;
      }

      const fallbackByCode: Record<string, string> = {
        DISPUTE_ALREADY_ACTIVE: "Đơn hàng đã có một tranh chấp đang được xử lý.",
        DISPUTE_WINDOW_EXPIRED: "Đơn hàng đã hết thời hạn tạo khiếu nại.",
        DISPUTE_FORBIDDEN: "Bạn không có quyền khiếu nại đơn hàng này.",
        DISPUTE_INVALID_ORDER_STATUS: "Trạng thái hiện tại của đơn hàng không cho phép tạo khiếu nại.",
        "Validation.InvalidRequest": "Thông tin khiếu nại chưa hợp lệ. Vui lòng kiểm tra lại nội dung và ảnh bằng chứng.",
      };

      setPageMessage({
        type: code === "DISPUTE_WINDOW_EXPIRED" ? "warning" : "error",
        text: getErrorMessage(
          error,
          fallbackByCode[code] || "Không thể gửi khiếu nại lúc này.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <Header title="Gửi khiếu nại" showBack />
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.orderCard}>
            <Text style={styles.orderLabel}>Đơn hàng liên quan</Text>
            <Text style={styles.orderCode}>{orderCode || orderId || "Không xác định"}</Text>
            {productName ? <Text style={styles.productName}>{productName}</Text> : null}
            <Text style={styles.helperText}>
              Hệ thống sẽ tự xác định người gửi và người bị khiếu nại từ đơn hàng.
            </Text>
          </View>

          {pageMessage ? (
            <View
              style={[
                styles.messageBox,
                pageMessage.type === "warning" ? styles.warningBox : styles.errorBox,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  pageMessage.type === "warning" ? styles.warningText : styles.errorText,
                ]}
              >
                {pageMessage.text}
              </Text>
            </View>
          ) : null}

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Loại khiếu nại</Text>
            <View style={styles.categoryList}>
              {disputeCategories.map((item) => {
                const selected = category === item.value;
                return (
                  <TouchableOpacity
                    key={item.value}
                    style={[styles.categoryItem, selected && styles.categoryItemSelected]}
                    onPress={() => {
                      setCategory(item.value);
                      setCategoryError(null);
                      clearMessage();
                    }}
                  >
                    <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {categoryError ? <Text style={styles.fieldError}>{categoryError}</Text> : null}
            {selectedCategoryLabel ? (
              <Text style={styles.selectedHint}>Đã chọn: {selectedCategoryLabel}</Text>
            ) : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Mô tả vấn đề</Text>
            <TextInput
              style={[styles.textArea, descriptionError ? styles.inputError : undefined]}
              value={description}
              onChangeText={(value) => {
                setDescription(value);
                setDescriptionError(null);
                clearMessage();
              }}
              placeholder="Mô tả rõ vấn đề, diễn biến và cam kết đã bị vi phạm..."
              placeholderTextColor="#94A3B8"
              multiline
              maxLength={2000}
              textAlignVertical="top"
            />
            <View style={styles.descriptionFooter}>
              {descriptionError ? (
                <Text style={styles.fieldError}>{descriptionError}</Text>
              ) : (
                <Text style={styles.helperText}>Tối thiểu 10 ký tự.</Text>
              )}
              <Text style={styles.counterText}>{description.length}/2000</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Ảnh bằng chứng</Text>
            <Text style={styles.helperText}>
              Bắt buộc 3–5 ảnh. Mỗi ảnh tối đa 5MB, định dạng JPG/JPEG/PNG/WEBP.
            </Text>

            <TouchableOpacity style={styles.pickButton} onPress={() => void pickImages()}>
              <Ionicons name="images-outline" size={20} color={COLORS.primary} />
              <Text style={styles.pickButtonText}>Chọn ảnh ({images.length}/5)</Text>
            </TouchableOpacity>

            {imageError ? <Text style={styles.fieldError}>{imageError}</Text> : null}

            {images.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageList}
              >
                {images.map((asset, index) => (
                  <View key={`${asset.uri}-${index}`} style={styles.imageItem}>
                    <Image source={{ uri: asset.uri }} style={styles.imagePreview} />
                    <TouchableOpacity
                      style={styles.removeImageButton}
                      onPress={() => removeImage(index)}
                    >
                      <Ionicons name="close" size={16} color={COLORS.white} />
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            disabled={isSubmitting}
            onPress={() => void submit()}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="warning-outline" size={20} color={COLORS.white} />
            )}
            <Text style={styles.submitButtonText}>
              {isSubmitting ? "Đang gửi..." : "Gửi khiếu nại"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { padding: 16, paddingBottom: 36 },
  orderCard: {
    backgroundColor: "#EFF6FF",
    borderWidth: 1,
    borderColor: "#BFDBFE",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  orderLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  orderCode: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  productName: { fontSize: 13, color: COLORS.text, marginTop: 4 },
  helperText: { fontSize: 12, lineHeight: 18, color: COLORS.textLight },
  messageBox: { borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 14 },
  errorBox: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  warningBox: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
  messageText: { fontSize: 13, lineHeight: 19 },
  errorText: { color: "#B91C1C" },
  warningText: { color: "#B45309" },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text, marginBottom: 10 },
  categoryList: { gap: 8 },
  categoryItem: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  categoryItemSelected: { borderColor: COLORS.primary, backgroundColor: "#EFF6FF" },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    justifyContent: "center",
    alignItems: "center",
  },
  radioOuterSelected: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  categoryText: { flex: 1, fontSize: 13, color: COLORS.text },
  categoryTextSelected: { color: COLORS.primary, fontWeight: "700" },
  selectedHint: { marginTop: 8, fontSize: 12, color: COLORS.primary, fontWeight: "600" },
  textArea: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 20,
    backgroundColor: COLORS.white,
  },
  inputError: { borderColor: COLORS.error },
  descriptionFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 7,
  },
  counterText: { fontSize: 11, color: COLORS.textLight },
  fieldError: { color: COLORS.error, fontSize: 12, lineHeight: 17, marginTop: 7, flex: 1 },
  pickButton: {
    marginTop: 12,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BFDBFE",
    backgroundColor: "#EFF6FF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pickButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  imageList: { gap: 10, paddingTop: 12, paddingRight: 4 },
  imageItem: { position: "relative" },
  imagePreview: { width: 92, height: 92, borderRadius: 10, backgroundColor: "#E2E8F0" },
  removeImageButton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#B91C1C",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    minHeight: 50,
    borderRadius: 11,
    backgroundColor: "#D97706",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonDisabled: { opacity: 0.65 },
  submitButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "800" },
});
