import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import {
  ContentReportCategoryOption,
  ContentReportLimits,
  ContentReportTargetType,
  FALLBACK_CONTENT_REPORT_LIMITS,
  createContentReport,
  getContentReportCategories,
  getContentReportLimits,
} from "../../src/services/apis/contentDisputeApi";
import { validateNewLocalFiles } from "../../src/services/fileUploadPolicy";
import { NETWORK_ERROR_MESSAGE } from "../../src/utils/errorMessage";

type InlineMessage = {
  type: "error" | "warning" | "info";
  text: string;
} | null;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const getSingleParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const getErrorCode = (error: any): string =>
  String(
    error?.response?.data?.code ??
      error?.response?.data?.error?.code ??
      error?.code ??
      "",
  ).trim();

const getErrorMessageFromResponse = (error: any): string =>
  String(
    error?.response?.data?.message ??
      error?.response?.data?.error?.message ??
      "",
  ).trim();

// Backend error codes verified against HomeCycle.Application.Commons.Errors
// (ContentDisputeErrors / DisputeErrors) — matched by exact code, not by
// HTTP status, since the dispute controller returns 400 for every business
// error including duplicate-open-report.
const CONTENT_REPORT_ERROR_MESSAGES: Record<string, string> = {
  DISPUTE_SELF_REPORT_NOT_ALLOWED: "Không thể báo cáo nội dung do chính bạn tạo.",
  DISPUTE_DUPLICATE_OPEN_REPORT:
    "Bạn đã có báo cáo đang chờ xử lý hoặc đang được xem xét cho nội dung này.",
  DISPUTE_CONTENT_UNAVAILABLE:
    "Nội dung đã bị xóa, ẩn hoặc đình chỉ và không thể báo cáo.",
  POST_NOT_FOUND: "Không tìm thấy bài đăng cần báo cáo.",
  "Review.NotFound": "Không tìm thấy đánh giá cần báo cáo.",
  DISPUTE_TARGET_NOT_SUPPORTED: "Loại nội dung này hiện chưa hỗ trợ báo cáo.",
};

const TARGET_TYPE_TITLE: Record<ContentReportTargetType, string> = {
  Post: "Báo cáo bài đăng",
  Review: "Báo cáo đánh giá",
};

export default function ContentReportScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();

  const rawTargetType = getSingleParam(
    params.targetType as string | string[] | undefined,
  );
  const rawTargetId = getSingleParam(
    params.targetId as string | string[] | undefined,
  );

  const targetType: ContentReportTargetType | null =
    rawTargetType === "Post" || rawTargetType === "Review"
      ? rawTargetType
      : null;
  const targetId =
    rawTargetId && UUID_PATTERN.test(rawTargetId.trim())
      ? rawTargetId.trim()
      : null;
  const isParamsValid = Boolean(targetType && targetId);

  const [isLoadingMetadata, setIsLoadingMetadata] = useState(isParamsValid);
  const [categories, setCategories] = useState<ContentReportCategoryOption[]>(
    [],
  );
  const [categoriesError, setCategoriesError] = useState<string | null>(null);
  const [limits, setLimits] = useState<ContentReportLimits>(
    FALLBACK_CONTENT_REPORT_LIMITS,
  );

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(
    null,
  );
  const [description, setDescription] = useState("");
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [descriptionError, setDescriptionError] = useState<string | null>(
    null,
  );
  const [imageError, setImageError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<InlineMessage>(null);

  const loadCategories = useCallback(async () => {
    if (!targetType) return;

    try {
      setCategoriesError(null);
      const list = await getContentReportCategories(targetType);
      setCategories(list);
    } catch {
      setCategories([]);
      setCategoriesError(
        "Không thể tải danh sách lý do báo cáo lúc này. Vui lòng thử lại.",
      );
    }
  }, [targetType]);

  const loadMetadata = useCallback(async () => {
    if (!targetType) return;

    setIsLoadingMetadata(true);
    setPageMessage(null);

    const [categoriesResult, limitsResult] = await Promise.allSettled([
      getContentReportCategories(targetType),
      getContentReportLimits(targetType),
    ]);

    if (categoriesResult.status === "fulfilled") {
      setCategories(categoriesResult.value);
      setCategoriesError(null);
    } else {
      setCategories([]);
      setCategoriesError(
        "Không thể tải danh sách lý do báo cáo lúc này. Vui lòng thử lại.",
      );
    }

    // Limits có fallback an toàn sẵn (FALLBACK_CONTENT_REPORT_LIMITS) nên lỗi
    // tải limits không chặn màn hình — chỉ danh sách lý do báo cáo mới bắt buộc.
    if (limitsResult.status === "fulfilled") {
      setLimits(limitsResult.value);
    }

    setIsLoadingMetadata(false);
  }, [targetType]);

  useEffect(() => {
    if (!isParamsValid) return;
    void loadMetadata();
  }, [isParamsValid, loadMetadata]);

  const clearMessage = () => setPageMessage(null);

  const validate = () => {
    let valid = true;
    setCategoryError(null);
    setDescriptionError(null);
    setImageError(null);
    setPageMessage(null);

    if (!selectedCategoryId) {
      setCategoryError("Vui lòng chọn lý do báo cáo.");
      valid = false;
    }

    const trimmedDescription = description.trim();
    if (trimmedDescription.length < limits.minimumDescriptionLength) {
      setDescriptionError(
        `Mô tả phải có ít nhất ${limits.minimumDescriptionLength} ký tự.`,
      );
      valid = false;
    } else if (trimmedDescription.length > limits.maximumDescriptionLength) {
      setDescriptionError(
        `Mô tả không được vượt quá ${limits.maximumDescriptionLength} ký tự.`,
      );
      valid = false;
    }

    if (
      images.length < limits.minimumEvidenceImages ||
      images.length > limits.maximumEvidenceImages
    ) {
      setImageError(
        `Cần cung cấp từ ${limits.minimumEvidenceImages} đến ${limits.maximumEvidenceImages} ảnh bằng chứng.`,
      );
      valid = false;
    }

    return valid;
  };

  const pickImages = async () => {
    clearMessage();
    setImageError(null);

    if (images.length >= limits.maximumEvidenceImages) {
      setImageError(
        `Bạn đã chọn đủ tối đa ${limits.maximumEvidenceImages} ảnh bằng chứng.`,
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: limits.maximumEvidenceImages - images.length,
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

    setImages((current) =>
      [...current, ...result.assets].slice(0, limits.maximumEvidenceImages),
    );
  };

  const removeImage = (index: number) => {
    setImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
    setImageError(null);
    clearMessage();
  };

  const submit = async () => {
    if (!targetType || !targetId) return;
    if (!validate() || !selectedCategoryId) return;

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

      const created = await createContentReport({
        targetType,
        targetId,
        disputeCategoryId: selectedCategoryId,
        description: description.trim(),
        images: images.map((asset) => ({
          uri: asset.uri,
          fileName: asset.fileName,
          mimeType: asset.mimeType,
        })),
      });

      const disputeId = created?.disputeId;

      if (!disputeId) {
        setPageMessage({ type: "error", text: NETWORK_ERROR_MESSAGE });
        return;
      }

      router.replace(`/disputes/${disputeId}` as any);
    } catch (error: any) {
      const code = getErrorCode(error);

      if (code === "DISPUTE_INVALID_CONTENT_CATEGORY") {
        setSelectedCategoryId(null);
        await loadCategories();
        setPageMessage({
          type: "warning",
          text:
            CONTENT_REPORT_ERROR_MESSAGES[code] ||
            "Lý do báo cáo không còn phù hợp. Danh sách đã được làm mới, vui lòng chọn lại.",
        });
        return;
      }

      const mappedMessage = CONTENT_REPORT_ERROR_MESSAGES[code];

      setPageMessage({
        type: "error",
        text:
          mappedMessage ||
          getErrorMessageFromResponse(error) ||
          NETWORK_ERROR_MESSAGE,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isParamsValid) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Báo cáo nội dung" showBack />
        <View style={styles.centered}>
          <Ionicons name="alert-circle-outline" size={42} color={COLORS.error} />
          <Text style={styles.errorText}>
            Không xác định được nội dung cần báo cáo. Vui lòng quay lại và thử
            lại.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  const isSubmitDisabled =
    isSubmitting || isLoadingMetadata || categories.length === 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <Header title={TARGET_TYPE_TITLE[targetType!]} showBack />
        {isLoadingMetadata ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Đang tải biểu mẫu báo cáo...</Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {pageMessage ? (
              <View
                style={[
                  styles.messageBox,
                  pageMessage.type === "warning"
                    ? styles.warningBox
                    : styles.errorBox,
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    pageMessage.type === "warning"
                      ? styles.warningText
                      : styles.errorMessageText,
                  ]}
                >
                  {pageMessage.text}
                </Text>
              </View>
            ) : null}

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Lý do báo cáo</Text>

              {categoriesError ? (
                <View>
                  <Text style={styles.fieldError}>{categoriesError}</Text>
                  <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => void loadCategories()}
                  >
                    <Text style={styles.retryButtonText}>Thử lại</Text>
                  </TouchableOpacity>
                </View>
              ) : categories.length === 0 ? (
                <Text style={styles.helperText}>
                  Hiện không có lý do báo cáo phù hợp cho loại nội dung này.
                </Text>
              ) : null}

              <View style={styles.categoryList}>
                {categories.map((item) => {
                  const selected = selectedCategoryId === item.disputeCategoryId;
                  return (
                    <TouchableOpacity
                      key={item.disputeCategoryId}
                      style={[
                        styles.categoryItem,
                        selected && styles.categoryItemSelected,
                      ]}
                      onPress={() => {
                        setSelectedCategoryId(item.disputeCategoryId);
                        setCategoryError(null);
                        clearMessage();
                      }}
                    >
                      <View
                        style={[
                          styles.radioOuter,
                          selected && styles.radioOuterSelected,
                        ]}
                      >
                        {selected ? <View style={styles.radioInner} /> : null}
                      </View>
                      <View style={styles.categoryTextWrap}>
                        <Text
                          style={[
                            styles.categoryText,
                            selected && styles.categoryTextSelected,
                          ]}
                        >
                          {item.name}
                        </Text>
                        {item.description ? (
                          <Text style={styles.categoryDescription}>
                            {item.description}
                          </Text>
                        ) : null}
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {categoryError ? (
                <Text style={styles.fieldError}>{categoryError}</Text>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Mô tả vấn đề</Text>
              <TextInput
                style={[
                  styles.textArea,
                  descriptionError ? styles.inputError : undefined,
                ]}
                value={description}
                onChangeText={(value) => {
                  setDescription(value);
                  setDescriptionError(null);
                  clearMessage();
                }}
                placeholder="Mô tả rõ vấn đề bạn muốn báo cáo..."
                placeholderTextColor="#547B7D"
                multiline
                maxLength={limits.maximumDescriptionLength}
                textAlignVertical="top"
              />
              <View style={styles.descriptionFooter}>
                {descriptionError ? (
                  <Text style={styles.fieldError}>{descriptionError}</Text>
                ) : (
                  <Text style={styles.helperText}>
                    Tối thiểu {limits.minimumDescriptionLength} ký tự.
                  </Text>
                )}
                <Text style={styles.counterText}>
                  {description.length}/{limits.maximumDescriptionLength}
                </Text>
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ảnh bằng chứng</Text>
              <Text style={styles.helperText}>
                Bắt buộc {limits.minimumEvidenceImages}–
                {limits.maximumEvidenceImages} ảnh.
              </Text>

              <TouchableOpacity
                style={styles.pickButton}
                onPress={() => void pickImages()}
              >
                <Ionicons name="images-outline" size={20} color={COLORS.primary} />
                <Text style={styles.pickButtonText}>
                  Chọn ảnh ({images.length}/{limits.maximumEvidenceImages})
                </Text>
              </TouchableOpacity>

              {imageError ? (
                <Text style={styles.fieldError}>{imageError}</Text>
              ) : null}

              {images.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.imageList}
                >
                  {images.map((asset, index) => (
                    <View key={`${asset.uri}-${index}`} style={styles.imageItem}>
                      <Image
                        source={{ uri: asset.uri }}
                        style={styles.imagePreview}
                      />
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
                isSubmitDisabled && styles.submitButtonDisabled,
              ]}
              disabled={isSubmitDisabled}
              onPress={() => void submit()}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Ionicons name="warning-outline" size={20} color={COLORS.white} />
              )}
              <Text style={styles.submitButtonText}>
                {isSubmitting ? "Đang gửi..." : "Gửi báo cáo"}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
  },
  loadingText: { marginTop: 10, color: COLORS.textLight, fontSize: 13 },
  errorText: {
    marginTop: 10,
    color: COLORS.error,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  scrollContent: { padding: 16, paddingBottom: 36 },
  messageBox: { borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 14 },
  errorBox: {
    backgroundColor: "rgba(122, 16, 18, 0.08)",
    borderColor: "rgba(122, 16, 18, 0.22)",
  },
  warningBox: {
    backgroundColor: "rgba(154, 100, 24, 0.10)",
    borderColor: "rgba(154, 100, 24, 0.24)",
  },
  messageText: { fontSize: 13, lineHeight: 19 },
  errorMessageText: { color: "#7A1012" },
  warningText: { color: "#9A6418" },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    marginBottom: 10,
  },
  categoryList: { gap: 8, marginTop: 8 },
  categoryItem: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#BAC2C1",
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  categoryItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(84, 123, 125, 0.10)",
  },
  radioOuter: {
    width: 20,
    height: 20,
    marginTop: 1,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#BAC2C1",
    justifyContent: "center",
    alignItems: "center",
  },
  radioOuterSelected: { borderColor: COLORS.primary },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primary },
  categoryTextWrap: { flex: 1 },
  categoryText: { fontSize: 13, color: COLORS.text, fontWeight: "600" },
  categoryTextSelected: { color: COLORS.primary },
  categoryDescription: {
    marginTop: 3,
    fontSize: 11,
    lineHeight: 16,
    color: COLORS.textLight,
  },
  retryButton: {
    marginTop: 8,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#7A1012",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  retryButtonText: { color: "#7A1012", fontWeight: "800", fontSize: 12 },
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
  helperText: { fontSize: 12, lineHeight: 18, color: COLORS.textLight },
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
