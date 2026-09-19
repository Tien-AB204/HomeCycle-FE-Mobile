import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
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
import Header from "../../src/components/shared/Header";
import { ModalBackdrop, ModalSurface } from "../../src/components/shared/ModalBackdrop";
import { COLORS } from "../../src/constants/theme";
import apiClient from "../../src/services/apis/axiosClient";
import { validateNewLocalFiles } from "../../src/services/fileUploadPolicy";
import { NETWORK_ERROR_MESSAGE } from "../../src/utils/errorMessage";
import { getDisputeCategoryDisplayName } from "../../src/utils/disputeCategoryLabel";
import { useAutoDismissFeedback } from "../../src/utils/useAutoDismissFeedback";
import { useGuardedRouter } from "../../src/utils/tapGuard";

// Dispute category is dynamic (BE-owned), never a hard-coded enum/list.
// Order Detail's actions.allowedDisputeCategories already carries the
// full, context-filtered category objects — use it as-is.
type DisputeCategoryOption = {
  disputeCategoryId: number;
  code: string;
  name: string;
  description: string | null;
};

// BE hiện tại (đã xác minh runtime) vẫn trả allowedDisputeCategories dạng
// mảng chuỗi enum cũ (vd. "ItemMismatch"), chưa triển khai object contract
// mới. Giữ bảng này CHỈ để suy ra id/label hợp lệ từ enum cũ trong lúc chờ
// BE triển khai đầy đủ; nhánh object phía trên vẫn là đường chính khi BE
// đã trả đúng contract mới.
const LEGACY_CATEGORY_BY_KEY: Record<string, { id: number; name: string }> = {
  "1": { id: 1, name: "Không xuất hiện / bùng hẹn" },
  noshow: { id: 1, name: "Không xuất hiện / bùng hẹn" },
  "2": { id: 2, name: "Hàng hóa không đúng mô tả" },
  itemmismatch: { id: 2, name: "Hàng hóa không đúng mô tả" },
  "3": { id: 3, name: "Người bán không giao hàng" },
  sellernotshipped: { id: 3, name: "Người bán không giao hàng" },
  "4": { id: 4, name: "Hàng hóa hư hỏng hoặc thất lạc" },
  damagedorlost: { id: 4, name: "Hàng hóa hư hỏng hoặc thất lạc" },
  "5": { id: 5, name: "Không nhận được hàng" },
  itemnotreceived: { id: 5, name: "Không nhận được hàng" },
  "6": { id: 6, name: "Gian lận / lừa đảo" },
  fraudorscam: { id: 6, name: "Gian lận / lừa đảo" },
  "8": { id: 8, name: "Không thanh toán theo thỏa thuận" },
  paymentnotcompleted: { id: 8, name: "Không thanh toán theo thỏa thuận" },
  "9": { id: 9, name: "Vi phạm cam kết giao dịch" },
  commitmentviolation: { id: 9, name: "Vi phạm cam kết giao dịch" },
  "99": { id: 99, name: "Khác" },
  other: { id: 99, name: "Khác" },
};

const normalizeAllowedDisputeCategory = (
  value: unknown,
): DisputeCategoryOption | null => {
  if (value && typeof value === "object") {
    const raw = value as Record<string, unknown>;
    const disputeCategoryId = Number(raw.disputeCategoryId ?? raw.DisputeCategoryId);
    if (!Number.isFinite(disputeCategoryId)) return null;

    return {
      disputeCategoryId,
      code: String(raw.code ?? raw.Code ?? ""),
      name: String(raw.name ?? raw.Name ?? `Loại #${disputeCategoryId}`),
      description: (raw.description ?? raw.Description ?? null) as string | null,
    };
  }

  const rawValue = String(value ?? "").trim();
  const legacyKey = rawValue.replace(/[\s_-]/g, "").toLowerCase();
  const legacy = LEGACY_CATEGORY_BY_KEY[legacyKey];
  if (!legacy) return null;

  // Giữ nguyên chuỗi gốc trong `code` — đây chính là giá trị enum hợp lệ
  // mà field `Category` cũ của BE đang mong đợi khi submit.
  return { disputeCategoryId: legacy.id, code: rawValue, name: legacy.name, description: null };
};

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
  const router = useGuardedRouter();
  const params = useLocalSearchParams();
  const orderId = getSingleParam(params.orderId as string | string[] | undefined);
  const orderCode = getSingleParam(params.orderCode as string | string[] | undefined);
  const productName = getSingleParam(params.productName as string | string[] | undefined);

  const [category, setCategory] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSubmitConfirmation, setShowSubmitConfirmation] = useState(false);
  const submitInFlightRef = useRef(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<InlineMessage>(null);
  useAutoDismissFeedback(pageMessage, () => setPageMessage(null));
  const [isCheckingDisputeEligibility, setIsCheckingDisputeEligibility] = useState(
    Boolean(orderId),
  );
  const [disputeEligibilityError, setDisputeEligibilityError] = useState<string | null>(
    null,
  );
  const [disputeEligibility, setDisputeEligibility] = useState<{
    canDispute: boolean;
    allowedCategories: DisputeCategoryOption[];
  } | null>(null);

  useEffect(() => {
    let active = true;

    const loadDisputeEligibility = async () => {
      if (!orderId) {
        if (active) {
          setDisputeEligibility(null);
          setDisputeEligibilityError(null);
          setIsCheckingDisputeEligibility(false);
        }
        return;
      }

      try {
        setIsCheckingDisputeEligibility(true);
        setDisputeEligibilityError(null);

        const response = await apiClient.get(`/orders/${orderId}`);
        const orderDetail = response.data?.data || response.data;
        const actions = orderDetail?.actions ?? orderDetail?.order?.actions;

        if (
          !actions ||
          typeof actions.canDispute !== "boolean" ||
          !Array.isArray(actions.allowedDisputeCategories)
        ) {
          throw new Error("ORDER_DISPUTE_ACTION_CONTRACT_UNAVAILABLE");
        }

        const allowedCategories: DisputeCategoryOption[] =
          actions.allowedDisputeCategories
            .map(
              (value: unknown): DisputeCategoryOption | null =>
                normalizeAllowedDisputeCategory(value),
            )
            .filter(
              (value: DisputeCategoryOption | null): value is DisputeCategoryOption =>
                value !== null,
            );

        if (!active) return;

        setDisputeEligibility({
          canDispute: actions.canDispute,
          allowedCategories,
        });

        setCategory((current) =>
          current !== null &&
          !allowedCategories.some((item) => item.disputeCategoryId === current)
            ? null
            : current,
        );
      } catch {
        if (!active) return;

        setDisputeEligibility(null);
        setDisputeEligibilityError(
          "Không thể kiểm tra điều kiện khiếu nại của đơn hàng lúc này.",
        );
      } finally {
        if (active) {
          setIsCheckingDisputeEligibility(false);
        }
      }
    };

    void loadDisputeEligibility();

    return () => {
      active = false;
    };
  }, [orderId]);

  const availableDisputeCategories = useMemo(() => {
    if (!disputeEligibility?.canDispute) return [];
    return disputeEligibility.allowedCategories;
  }, [disputeEligibility]);

  const selectedCategoryLabel = useMemo(() => {
    const selectedCategory = disputeEligibility?.allowedCategories.find(
      (item) => item.disputeCategoryId === category,
    );

    return selectedCategory
      ? getDisputeCategoryDisplayName(
          selectedCategory.code,
          selectedCategory.name,
        )
      : undefined;
  }, [category, disputeEligibility]);

  const isDisputeSubmitDisabled =
    isSubmitting ||
    isCheckingDisputeEligibility ||
    disputeEligibility?.canDispute !== true ||
    availableDisputeCategories.length === 0;

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
    } else if (isCheckingDisputeEligibility) {
      setPageMessage({
        type: "warning",
        text: "Đang kiểm tra điều kiện khiếu nại. Vui lòng chờ trong giây lát.",
      });
      valid = false;
    } else if (!disputeEligibility) {
      setPageMessage({
        type: "error",
        text:
          disputeEligibilityError ||
          "Không thể kiểm tra điều kiện khiếu nại của đơn hàng lúc này.",
      });
      valid = false;
    } else if (!disputeEligibility.canDispute) {
      setPageMessage({
        type: "warning",
        text: "Trạng thái hiện tại của đơn hàng không cho phép tạo khiếu nại.",
      });
      valid = false;
    }

    if (!category) {
      setCategoryError("Vui lòng chọn loại khiếu nại.");
      valid = false;
    } else if (
      disputeEligibility &&
      !disputeEligibility.allowedCategories.some(
        (item) => item.disputeCategoryId === category,
      )
    ) {
      setCategoryError(
        "Loại khiếu nại này không còn được phép với trạng thái hiện tại của đơn hàng.",
      );
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

    if (images.length < 2 || images.length > 5) {
      setImageError("Cần cung cấp từ 2 đến 5 ảnh bằng chứng.");
      valid = false;
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

    const validation = await validateNewLocalFiles(
      "DisputeEvidence",
      result.assets.map((asset) => ({
        fileName: asset.fileName,
        uri: asset.uri,
        fileSize: asset.fileSize,
      })),
    );

    if (!validation.valid) {
      setImageError(validation.message);
      return;
    }

    setImages((current) => [...current, ...result.assets].slice(0, 5));
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

    const filesValidation = await validateNewLocalFiles(
      "DisputeEvidence",
      images.map((asset) => ({
        fileName: asset.fileName,
        uri: asset.uri,
        fileSize: asset.fileSize,
      })),
    );

    if (!filesValidation.valid) {
      setImageError(filesValidation.message);
      return;
    }

    try {
      setIsSubmitting(true);
      setPageMessage(null);

      const formData = new FormData();
      // BE là source of truth. FE chỉ gửi đúng field mà endpoint CreateDispute yêu cầu.
      // Runtime đã xác minh Order actions.allowedDisputeCategories trả đúng
      // contract mới (disputeCategoryId thật), nên submit chỉ gửi
      // DisputeCategoryId — không gửi kèm field `Category` enum cũ vì code
      // mới (vd. "ITEM_MISMATCH") không khớp giá trị enum cũ BE từng dùng.
      formData.append("TargetType", "2");
      formData.append("TargetId", orderId);
      formData.append("DisputeCategoryId", String(category));
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
          text: NETWORK_ERROR_MESSAGE,
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

      const messageByCode: Record<string, string> = {
        DISPUTE_ALREADY_ACTIVE: "Đơn hàng đã có một tranh chấp đang được xử lý.",
        DISPUTE_WINDOW_EXPIRED: "Đơn hàng đã hết thời hạn tạo khiếu nại.",
        DISPUTE_FORBIDDEN: "Bạn không có quyền khiếu nại đơn hàng này.",
        DISPUTE_INVALID_ORDER_STATUS: "Trạng thái hiện tại của đơn hàng không cho phép tạo khiếu nại.",
        "Validation.InvalidRequest": "Thông tin khiếu nại chưa hợp lệ. Vui lòng kiểm tra lại nội dung và ảnh bằng chứng.",
      };

      setPageMessage({
        type: code === "DISPUTE_WINDOW_EXPIRED" ? "warning" : "error",
        text: messageByCode[code] || NETWORK_ERROR_MESSAGE,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmSubmit = async () => {
    if (!showSubmitConfirmation || submitInFlightRef.current) return;
    submitInFlightRef.current = true;
    setShowSubmitConfirmation(false);
    setIsSubmitting(true);
    try {
      await submit();
    } finally {
      submitInFlightRef.current = false;
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

            {isCheckingDisputeEligibility ? (
              <Text style={styles.helperText}>
                Đang kiểm tra các loại khiếu nại được phép...
              </Text>
            ) : disputeEligibilityError ? (
              <Text style={styles.fieldError}>{disputeEligibilityError}</Text>
            ) : disputeEligibility && !disputeEligibility.canDispute ? (
              <Text style={styles.fieldError}>
                Trạng thái hiện tại của đơn hàng không cho phép tạo khiếu nại.
              </Text>
            ) : disputeEligibility && availableDisputeCategories.length === 0 ? (
              <Text style={styles.helperText}>
                Hiện không có loại khiếu nại phù hợp với đơn hàng này.
              </Text>
            ) : null}

            <View style={styles.categoryList}>
              {availableDisputeCategories.map((item) => {
                const selected = category === item.disputeCategoryId;
                return (
                  <TouchableOpacity
                    key={item.disputeCategoryId}
                    style={[styles.categoryItem, selected && styles.categoryItemSelected]}
                    onPress={() => {
                      // Chạm lại lựa chọn hiện tại để bỏ chọn.
                      setCategory(selected ? null : item.disputeCategoryId);
                      setCategoryError(null);
                      clearMessage();
                    }}
                  >
                    <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                      {selected ? <View style={styles.radioInner} /> : null}
                    </View>
                    <Text style={[styles.categoryText, selected && styles.categoryTextSelected]}>
                      {getDisputeCategoryDisplayName(item.code, item.name)}
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
              placeholderTextColor="#547B7D"
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
              Bắt buộc 2–5 ảnh. Mỗi ảnh tối đa 5MB, định dạng JPG/JPEG/PNG/WEBP.
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
            style={[
              styles.submitButton,
              isDisputeSubmitDisabled && styles.submitButtonDisabled,
            ]}
            disabled={isDisputeSubmitDisabled}
            onPress={() => {
              if (!submitInFlightRef.current && validate()) setShowSubmitConfirmation(true);
            }}
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
      <Modal visible={showSubmitConfirmation} transparent animationType="fade"
        onRequestClose={() => setShowSubmitConfirmation(false)}>
        <ModalBackdrop style={styles.confirmBackdrop} onPress={() => setShowSubmitConfirmation(false)}>
          <ModalSurface style={styles.confirmCard}>
            <Text style={styles.sectionTitle}>Bạn có chắc muốn gửi khiếu nại này?</Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity style={styles.confirmCancel} onPress={() => setShowSubmitConfirmation(false)}>
                <Text style={styles.pickButtonText}>Hủy</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitButton, styles.flex]} disabled={isDisputeSubmitDisabled}
                onPress={() => void confirmSubmit()}>
                <Text style={styles.submitButtonText}>Gửi khiếu nại</Text>
              </TouchableOpacity>
            </View>
          </ModalSurface>
        </ModalBackdrop>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  confirmBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", alignItems: "center", padding: 20 },
  confirmCard: { width: "100%", maxWidth: 420, padding: 20, borderRadius: 16, backgroundColor: COLORS.white },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 12 },
  confirmCancel: { flex: 1, minHeight: 50, borderWidth: 1, borderColor: COLORS.border, borderRadius: 11, alignItems: "center", justifyContent: "center" },
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  scrollContent: { padding: 16, paddingBottom: 36 },
  orderCard: {
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(84, 123, 125, 0.24)",
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  orderLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },
  orderCode: { fontSize: 16, fontWeight: "800", color: COLORS.text },
  productName: { fontSize: 13, color: COLORS.text, marginTop: 4 },
  helperText: { fontSize: 12, lineHeight: 18, color: COLORS.textLight },
  messageBox: { borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 14 },
  errorBox: { backgroundColor: "rgba(122, 16, 18, 0.08)", borderColor: "rgba(122, 16, 18, 0.22)" },
  warningBox: { backgroundColor: "rgba(154, 100, 24, 0.10)", borderColor: "rgba(154, 100, 24, 0.24)" },
  messageText: { fontSize: 13, lineHeight: 19 },
  errorText: { color: "#7A1012" },
  warningText: { color: "#9A6418" },
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
    borderColor: "#BAC2C1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  categoryItemSelected: { borderColor: COLORS.primary, backgroundColor: "rgba(84, 123, 125, 0.10)" },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#BAC2C1",
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
    borderColor: "rgba(84, 123, 125, 0.24)",
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  pickButtonText: { color: COLORS.primary, fontSize: 13, fontWeight: "700" },
  imageList: { gap: 10, paddingTop: 12, paddingRight: 4 },
  imageItem: { position: "relative" },
  imagePreview: { width: 92, height: 92, borderRadius: 10, backgroundColor: "#F8F9FA" },
  removeImageButton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#7A1012",
    alignItems: "center",
    justifyContent: "center",
  },
  submitButton: {
    minHeight: 50,
    borderRadius: 11,
    backgroundColor: "#9A6418",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  submitButtonDisabled: { opacity: 0.65 },
  submitButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "800" },
});
