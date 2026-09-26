import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import Header from "../../src/components/shared/Header";
import {
  ModalBackdrop,
  ModalSurface,
} from "../../src/components/shared/ModalBackdrop";
import { COLORS } from "../../src/constants/theme";
import apiClient from "../../src/services/apis/axiosClient";
import { validateNewLocalFiles } from "../../src/services/fileUploadPolicy";
import inspectionFormApi, {
  APPEARANCE_STATUS_OPTIONS,
  CONCLUSION_OPTIONS,
  MATCH_STATUS_OPTIONS,
  OPERATING_STATUS_OPTIONS,
  PARTS_STATUS_OPTIONS,
  isPriceAdjustmentConclusion,
  parseAppearanceStatus,
  parseConclusion,
  parseMatchStatus,
  parseOperatingStatus,
  parsePartsStatus,
  translateAppearanceStatus,
  translateConclusion,
  translateInspectionStatus,
  translateMatchStatus,
  translateOperatingStatus,
  translatePartsStatus,
  type InspectionFormChecklist,
  type InspectionFormSummary,
  type InspectionImageAsset,
} from "../../src/services/apis/inspectionFormApi";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import { readSafeApiMessage } from "../../src/utils/errorMessage";
import { useAutoDismissFeedback } from "../../src/utils/useAutoDismissFeedback";
import { useGuardedRouter } from "../../src/utils/tapGuard";

type InlineMessage = {
  type: "error" | "success" | "info";
  text: string;
} | null;

type SellerAction = "confirm" | "reject" | null;

const unwrap = (value: any) => value?.data ?? value;

// Thông điệp BE (nếu có) được ưu tiên hơn chuỗi FE theo mã lỗi.
const readBeMessage = (error: any) =>
  readSafeApiMessage(error?.response?.data);

const getErrorCode = (error: any) =>
  String(
    error?.response?.data?.code ||
      error?.response?.data?.error?.code ||
      "",
  );

const REVISION_CHANGED_MESSAGE =
  "Phiếu kiểm định vừa được cập nhật. Dữ liệu mới nhất đã được tải lại, vui lòng kiểm tra trước khi thực hiện lại thao tác.";

const formatDateTime = (dateString?: string | null) => {
  if (!dateString) return "Chưa có";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "Chưa có";
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatCurrency = (value?: number | null) =>
  value === undefined || value === null
    ? "Chưa có"
    : new Intl.NumberFormat("vi-VN", {
        style: "currency",
        currency: "VND",
      }).format(value);

const toImageAsset = (
  asset: ImagePicker.ImagePickerAsset,
): InspectionImageAsset => ({
  uri: asset.uri,
  name: asset.fileName || undefined,
  type: asset.mimeType || undefined,
});

export default function InspectionFormScreen() {
  const router = useGuardedRouter();
  const params = useLocalSearchParams();
  const appointmentId = Array.isArray(params.appointmentId)
    ? params.appointmentId[0]
    : params.appointmentId;

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageMessage, setPageMessage] = useState<InlineMessage>(null);
  useAutoDismissFeedback(pageMessage, () => setPageMessage(null));

  const [canCreateInspectionForm, setCanCreateInspectionForm] =
    useState(false);
  const [relatedOrderId, setRelatedOrderId] = useState<string | null>(null);
  const [form, setForm] = useState<InspectionFormSummary | null>(null);

  const [operatingStatus, setOperatingStatus] = useState<number | null>(null);
  const [appearanceStatus, setAppearanceStatus] = useState<number | null>(
    null,
  );
  const [partsStatus, setPartsStatus] = useState<number | null>(null);
  const [matchStatus, setMatchStatus] = useState<number | null>(null);
  const [inspectorNotes, setInspectorNotes] = useState("");
  const [conclusion, setConclusion] = useState<number | null>(null);
  const [suggestedPrice, setSuggestedPrice] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const [newImages, setNewImages] = useState<ImagePicker.ImagePickerAsset[]>(
    [],
  );
  const [isReplacingImages, setIsReplacingImages] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inspectionWriteInFlightRef = useRef<string | null>(null);

  const [sellerAction, setSellerAction] = useState<SellerAction>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [isSellerActionSubmitting, setIsSellerActionSubmitting] =
    useState(false);
  const [sellerActionError, setSellerActionError] = useState<string | null>(
    null,
  );

  const hydrateFromForm = (formData: InspectionFormSummary) => {
    setOperatingStatus(parseOperatingStatus(formData.operatingStatus));
    setAppearanceStatus(parseAppearanceStatus(formData.appearanceStatus));
    setPartsStatus(parsePartsStatus(formData.partsStatus));
    setMatchStatus(parseMatchStatus(formData.matchStatus));
    setInspectorNotes(formData.inspectorNotes || "");

    const parsedConclusion = parseConclusion(formData.conclusion);
    setConclusion(parsedConclusion);
    setSuggestedPrice(
      parsedConclusion === 2 && formData.suggestedPrice != null
        ? String(formData.suggestedPrice)
        : "",
    );

    setIsDirty(false);
    setIsReplacingImages(false);
    setNewImages([]);
  };

  const fetchAll = useCallback(
    async (showLoading = true) => {
      if (!appointmentId) {
        setLoadError("Không tìm thấy mã lịch hẹn.");
        setIsLoading(false);
        return;
      }

      try {
        if (showLoading) setIsLoading(true);
        setLoadError(null);

        const appointmentResponse = await apiClient.get(
          `/appointments/${appointmentId}`,
        );
        const appointment = unwrap(appointmentResponse.data);
        setCanCreateInspectionForm(
          appointment?.actions?.canCreateInspectionForm === true,
        );
        setRelatedOrderId(appointment?.order?.orderId || null);

        try {
          const formData = await inspectionFormApi.getByAppointment(
            String(appointmentId),
          );
          setForm(formData);
          hydrateFromForm(formData);
        } catch (formError: any) {
          const status = Number(formError?.response?.status ?? 0);
          setForm(null);

          if (status !== 404) {
            setPageMessage({
              type: "error",
              text: getApiErrorMessage(
                formError,
                "Không thể tải phiếu kiểm định lúc này.",
              ),
            });
          }
        }
      } catch (error) {
        setLoadError(
          getApiErrorMessage(error, "Không thể tải thông tin lịch hẹn lúc này."),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [appointmentId],
  );

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const pickImages = async () => {
    if (newImages.length >= 5) {
      setPageMessage({
        type: "info",
        text: "Bạn đã chọn đủ tối đa 5 ảnh kiểm định.",
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 5 - newImages.length,
      quality: 0.8,
    });

    if (result.canceled) return;

    const validation = await validateNewLocalFiles(
      "InspectionEvidence",
      result.assets.map((asset) => ({
        fileName: asset.fileName,
        uri: asset.uri,
        fileSize: asset.fileSize,
      })),
    );

    if (!validation.valid) {
      setPageMessage({ type: "error", text: validation.message });
      return;
    }

    setNewImages((current) => [...current, ...result.assets].slice(0, 5));
    setIsDirty(true);
    setPageMessage(null);
  };

  const removeNewImage = (index: number) => {
    setNewImages((current) => current.filter((_, i) => i !== index));
    setIsDirty(true);
  };

  const startReplacingImages = () => {
    setIsReplacingImages(true);
    setNewImages([]);
    setIsDirty(true);
    setPageMessage(null);
  };

  const cancelReplacingImages = () => {
    setIsReplacingImages(false);
    setNewImages([]);
  };

  const handleSelectConclusion = (value: number | null) => {
    setConclusion(value);
    if (value === null || !isPriceAdjustmentConclusion(value)) {
      setSuggestedPrice("");
    }
    setIsDirty(true);
  };

  const buildChecklist = (): InspectionFormChecklist => ({
    operatingStatus,
    appearanceStatus,
    partsStatus,
    matchStatus,
    inspectorNotes: inspectorNotes.trim() || null,
    conclusion,
    suggestedPrice:
      conclusion !== null && isPriceAdjustmentConclusion(conclusion)
        ? Number(suggestedPrice) || null
        : null,
  });

  const handleSaveDraft = async () => {
    if (!appointmentId || isSaving || inspectionWriteInFlightRef.current) return;

    const lockKey = `draft:${appointmentId}`;
    inspectionWriteInFlightRef.current = lockKey;

    try {
      setIsSaving(true);
      setPageMessage(null);

      const checklist = buildChecklist();
      const assets = newImages.map(toImageAsset);
      const willSendImages = !form || isReplacingImages;

      if (willSendImages && assets.length > 0) {
        const validation = await validateNewLocalFiles(
          "InspectionEvidence",
          assets,
        );

        if (!validation.valid) {
          setPageMessage({ type: "error", text: validation.message });
          return;
        }
      }

      const updated = form
        ? await inspectionFormApi.updateDraft(
            form.inspectionFormId,
            form.revision,
            checklist,
            isReplacingImages,
            assets,
          )
        : await inspectionFormApi.createDraft(
            String(appointmentId),
            checklist,
            assets,
          );

      setForm(updated);
      hydrateFromForm(updated);
      setPageMessage({
        type: "success",
        text: form
          ? "Đã cập nhật phiếu kiểm định."
          : "Đã lưu bản nháp phiếu kiểm định.",
      });
    } catch (error: any) {
      const code = getErrorCode(error);

      if (code === "Inspection.RevisionMismatch") {
        await fetchAll(false);
        setPageMessage({
          type: "info",
          text: readBeMessage(error) ?? REVISION_CHANGED_MESSAGE,
        });
        return;
      }

      if (code === "Inspection.AlreadyExists") {
        await fetchAll(false);
        setPageMessage({
          type: "info",
          text:
            readBeMessage(error) ??
            "Phiếu kiểm định đã được tạo trước đó. Dữ liệu mới nhất đã được tải lại.",
        });
        return;
      }

      setPageMessage({
        type: "error",
        text: getApiErrorMessage(
          error,
          form
            ? "Không thể cập nhật phiếu kiểm định lúc này."
            : "Không thể lưu phiếu kiểm định lúc này.",
        ),
      });
    } finally {
      if (inspectionWriteInFlightRef.current === lockKey) {
        inspectionWriteInFlightRef.current = null;
      }
      setIsSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!form || isSubmitting || isDirty || inspectionWriteInFlightRef.current) return;

    if (
      !operatingStatus ||
      !appearanceStatus ||
      !partsStatus ||
      !matchStatus ||
      !conclusion
    ) {
      setPageMessage({
        type: "error",
        text: "Vui lòng hoàn thành đầy đủ checklist và chọn kết luận trước khi gửi.",
      });
      return;
    }

    if (isPriceAdjustmentConclusion(conclusion)) {
      const price = Number(suggestedPrice);

      if (!Number.isFinite(price) || price <= 0) {
        setPageMessage({
          type: "error",
          text: "Kết luận điều chỉnh giá cần nhập giá đề xuất hợp lệ.",
        });
        return;
      }

      if (form.originalPrice != null && price === Number(form.originalPrice)) {
        setPageMessage({
          type: "error",
          text: "Giá đề xuất phải khác giá giao dịch hiện tại.",
        });
        return;
      }
    }

    const lockKey = `submit:${form.inspectionFormId}`;
    inspectionWriteInFlightRef.current = lockKey;

    try {
      setIsSubmitting(true);
      setPageMessage(null);

      const updated = await inspectionFormApi.submit(
        form.inspectionFormId,
        form.revision,
      );

      setForm(updated);
      hydrateFromForm(updated);
      setPageMessage({
        type: "success",
        text: "Đã gửi kết quả kiểm định. Đang chờ người bán xác nhận.",
      });
    } catch (error: any) {
      const code = getErrorCode(error);

      if (code === "Inspection.RevisionMismatch") {
        await fetchAll(false);
        setPageMessage({
          type: "info",
          text: readBeMessage(error) ?? REVISION_CHANGED_MESSAGE,
        });
        return;
      }

      const knownMessages: Record<string, string> = {
        "Inspection.Incomplete":
          "Vui lòng hoàn thành đầy đủ checklist và kết luận kiểm định trước khi gửi.",
        "Inspection.SuggestedPriceRequired":
          "Kết luận điều chỉnh giá cần nhập giá đề xuất hợp lệ.",
        "Inspection.SuggestedPriceUnchanged":
          "Giá đề xuất phải khác giá giao dịch hiện tại.",
        "Inspection.AppointmentNotInProgress":
          "Lịch kiểm định hiện không ở trạng thái đang diễn ra.",
        "Inspection.BothCheckInRequired":
          "Cả hai bên cần xác nhận có mặt trước khi gửi kết quả kiểm định.",
      };

      setPageMessage({
        type: "error",
        text:
          readBeMessage(error) ||
          knownMessages[code] ||
          getApiErrorMessage(error, "Không thể gửi kết quả kiểm định lúc này."),
      });
    } finally {
      if (inspectionWriteInFlightRef.current === lockKey) {
        inspectionWriteInFlightRef.current = null;
      }
      setIsSubmitting(false);
    }
  };

  const openSellerAction = (action: SellerAction) => {
    if (isSellerActionSubmitting) return;
    setRejectReason("");
    setSellerActionError(null);
    setSellerAction(action);
  };

  const closeSellerAction = () => {
    if (isSellerActionSubmitting) return;
    setSellerAction(null);
    setRejectReason("");
    setSellerActionError(null);
  };

  const handleSubmitSellerAction = async () => {
    if (!form || !sellerAction || isSellerActionSubmitting || inspectionWriteInFlightRef.current) return;

    const trimmedReason = rejectReason.trim();

    if (sellerAction === "reject") {
      if (!trimmedReason) {
        setSellerActionError("Vui lòng nhập lý do từ chối.");
        return;
      }
      if (trimmedReason.length > 500) {
        setSellerActionError("Lý do từ chối tối đa 500 ký tự.");
        return;
      }
    }

    const action = sellerAction;
    const lockKey = `${action}:${form.inspectionFormId}`;
    inspectionWriteInFlightRef.current = lockKey;

    try {
      setIsSellerActionSubmitting(true);
      setSellerActionError(null);

      const updated =
        action === "confirm"
          ? await inspectionFormApi.sellerConfirm(
              form.inspectionFormId,
              form.revision,
            )
          : await inspectionFormApi.sellerReject(
              form.inspectionFormId,
              form.revision,
              trimmedReason,
            );

      setForm(updated);
      hydrateFromForm(updated);
      setSellerAction(null);
      setRejectReason("");
      setPageMessage({
        type: "success",
        text:
          action === "confirm"
            ? "Đã xác nhận kết quả kiểm định."
            : "Đã từ chối kết quả kiểm định.",
      });
    } catch (error: any) {
      const code = getErrorCode(error);

      if (code === "Inspection.RevisionMismatch") {
        setSellerAction(null);
        await fetchAll(false);
        setPageMessage({
          type: "info",
          text: readBeMessage(error) ?? REVISION_CHANGED_MESSAGE,
        });
        return;
      }

      setSellerActionError(
        getApiErrorMessage(
          error,
          action === "confirm"
            ? "Không thể xác nhận kết quả kiểm định lúc này."
            : "Không thể từ chối kết quả kiểm định lúc này.",
        ),
      );
    } finally {
      if (inspectionWriteInFlightRef.current === lockKey) {
        inspectionWriteInFlightRef.current = null;
      }
      setIsSellerActionSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Phiếu kiểm định" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải phiếu kiểm định...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (loadError) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Phiếu kiểm định" showBack />
        <View style={styles.centered}>
          <Ionicons
            name="document-text-outline"
            size={48}
            color={COLORS.textLight}
          />
          <Text style={styles.loadErrorText}>{loadError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => void fetchAll()}
          >
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const canEdit = form?.actions?.canEdit === true;
  const canSubmit = form?.actions?.canSubmit === true;
  const canSellerConfirm = form?.actions?.canSellerConfirm === true;
  const canSellerReject = form?.actions?.canSellerReject === true;
  const isEditableMode = !form ? canCreateInspectionForm : canEdit;
  const showExistingImages =
    !!form && form.images && form.images.length > 0 && !isReplacingImages;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Phiếu kiểm định" showBack />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerStatusCard}>
          <Text style={styles.statusTitle}>
            {form
              ? translateInspectionStatus(form.inspectionStatus)
              : "Chưa có phiếu kiểm định"}
          </Text>
          {form ? (
            <Text style={styles.statusMeta}>
              Phiên bản hiện tại: {form.revision}
            </Text>
          ) : null}
        </View>

        {pageMessage ? (
          <View
            style={[
              styles.messageBox,
              pageMessage.type === "error"
                ? styles.errorBox
                : pageMessage.type === "success"
                  ? styles.successBox
                  : styles.infoBox,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                pageMessage.type === "error"
                  ? styles.errorText
                  : pageMessage.type === "success"
                    ? styles.successText
                    : styles.infoText,
              ]}
            >
              {pageMessage.text}
            </Text>
          </View>
        ) : null}

        {relatedOrderId ? (
          <TouchableOpacity
            style={styles.relatedOrderButton}
            onPress={() => router.push(("/orders/" + relatedOrderId) as any)}
          >
            <Ionicons name="receipt-outline" size={18} color={COLORS.primary} />
            <Text style={styles.relatedOrderText}>Xem đơn hàng liên quan</Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={COLORS.primary}
            />
          </TouchableOpacity>
        ) : null}

        {!form && !canCreateInspectionForm ? (
          <View style={styles.card}>
            <Text style={styles.helperText}>
              Chưa thể tạo phiếu kiểm định cho lịch hẹn này.
            </Text>
          </View>
        ) : null}

        {isEditableMode ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Checklist kiểm định</Text>

              <EnumChipGroup
                label="Tình trạng hoạt động"
                options={OPERATING_STATUS_OPTIONS}
                value={operatingStatus}
                translate={translateOperatingStatus}
                onSelect={(value) => {
                  setOperatingStatus(value);
                  setIsDirty(true);
                }}
              />

              <EnumChipGroup
                label="Ngoại quan"
                options={APPEARANCE_STATUS_OPTIONS}
                value={appearanceStatus}
                translate={translateAppearanceStatus}
                onSelect={(value) => {
                  setAppearanceStatus(value);
                  setIsDirty(true);
                }}
              />

              <EnumChipGroup
                label="Bộ phận / phụ kiện"
                options={PARTS_STATUS_OPTIONS}
                value={partsStatus}
                translate={translatePartsStatus}
                onSelect={(value) => {
                  setPartsStatus(value);
                  setIsDirty(true);
                }}
              />

              <EnumChipGroup
                label="Mức độ khớp với mô tả"
                options={MATCH_STATUS_OPTIONS}
                value={matchStatus}
                translate={translateMatchStatus}
                onSelect={(value) => {
                  setMatchStatus(value);
                  setIsDirty(true);
                }}
              />

              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Ghi chú kiểm định</Text>
                <TextInput
                  value={inspectorNotes}
                  onChangeText={(text) => {
                    setInspectorNotes(text);
                    setIsDirty(true);
                  }}
                  placeholder="Ghi chú thêm về kết quả kiểm định..."
                  placeholderTextColor={COLORS.textLight}
                  multiline
                  maxLength={2000}
                  style={[styles.textInput, styles.multilineInput]}
                />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Kết luận</Text>

              <EnumChipGroup
                label="Kết luận kiểm định"
                options={CONCLUSION_OPTIONS}
                value={conclusion}
                translate={translateConclusion}
                onSelect={handleSelectConclusion}
              />

              {form?.originalPrice != null ? (
                <Text style={styles.helperText}>
                  Giá giao dịch hiện tại: {formatCurrency(form.originalPrice)}
                </Text>
              ) : null}

              {conclusion !== null && isPriceAdjustmentConclusion(conclusion) ? (
                <View style={styles.fieldGroup}>
                  <Text style={styles.label}>Giá đề xuất <Text style={{ color: COLORS.error }}>*</Text></Text>
                  <TextInput
                    value={suggestedPrice}
                    onChangeText={(text) => {
                      setSuggestedPrice(text.replace(/[^0-9]/g, ""));
                      setIsDirty(true);
                    }}
                    placeholder="Nhập giá đề xuất"
                    placeholderTextColor={COLORS.textLight}
                    keyboardType="number-pad"
                    style={styles.textInput}
                  />
                </View>
              ) : null}
            </View>

            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Ảnh kiểm định</Text>
              <Text style={styles.helperText}>Tối đa 5 ảnh bằng chứng.</Text>

              {showExistingImages ? (
                <>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.imageList}
                  >
                    {form!.images!.map((image, index) => (
                      <Image
                        key={image.mediaId || `${image.url}-${index}`}
                        source={{ uri: image.url }}
                        style={styles.imagePreview}
                      />
                    ))}
                  </ScrollView>
                  <TouchableOpacity
                    style={styles.pickButton}
                    onPress={startReplacingImages}
                  >
                    <Ionicons
                      name="sync-outline"
                      size={18}
                      color={COLORS.primary}
                    />
                    <Text style={styles.pickButtonText}>
                      Thay ảnh kiểm định
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {isReplacingImages ? (
                    <View style={styles.replaceNoticeBox}>
                      <Text style={styles.replaceNoticeText}>
                        Ảnh bạn chọn bên dưới sẽ thay thế toàn bộ ảnh hiện tại.
                        Không chọn ảnh nào nghĩa là xóa toàn bộ ảnh kiểm định.
                      </Text>
                      <TouchableOpacity onPress={cancelReplacingImages}>
                        <Text style={styles.replaceCancelText}>
                          Hủy, giữ ảnh hiện tại
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : null}

                  <TouchableOpacity
                    style={styles.pickButton}
                    onPress={() => void pickImages()}
                  >
                    <Ionicons
                      name="images-outline"
                      size={20}
                      color={COLORS.primary}
                    />
                    <Text style={styles.pickButtonText}>
                      Chọn ảnh ({newImages.length}/5)
                    </Text>
                  </TouchableOpacity>

                  {newImages.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.imageList}
                    >
                      {newImages.map((asset, index) => (
                        <View key={`${asset.uri}-${index}`} style={styles.imageItem}>
                          <Image
                            source={{ uri: asset.uri }}
                            style={styles.imagePreview}
                          />
                          <TouchableOpacity
                            style={styles.removeImageButton}
                            onPress={() => removeNewImage(index)}
                          >
                            <Ionicons name="close" size={16} color={COLORS.white} />
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                  ) : null}
                </>
              )}
            </View>

            <View style={styles.formActionsRow}>
              <TouchableOpacity
                style={[
                  styles.secondaryButtonFlex,
                  isSaving ? styles.disabledButton : undefined,
                ]}
                onPress={() => void handleSaveDraft()}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <Text style={styles.secondaryButtonFlexText}>
                    {form ? "Lưu thay đổi" : "Lưu nháp"}
                  </Text>
                )}
              </TouchableOpacity>

              {form && canSubmit ? (
                <TouchableOpacity
                  style={[
                    styles.primarySmallButtonFlex,
                    isSubmitting || isDirty ? styles.disabledButton : undefined,
                  ]}
                  onPress={() => void handleSubmit()}
                  disabled={isSubmitting || isDirty}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.primarySmallButtonText}>
                      Gửi kết quả kiểm định
                    </Text>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>

            {form && canSubmit && isDirty ? (
              <Text style={styles.dirtyHintText}>
                Vui lòng lưu thay đổi trước khi gửi kết quả kiểm định.
              </Text>
            ) : null}
          </>
        ) : form ? (
          <>
            <View style={styles.card}>
              <Text style={styles.sectionTitle}>Kết quả kiểm định</Text>
              <InfoRow
                label="Tình trạng hoạt động"
                value={translateOperatingStatus(form.operatingStatus) || "Chưa có"}
              />
              <InfoRow
                label="Ngoại quan"
                value={translateAppearanceStatus(form.appearanceStatus) || "Chưa có"}
              />
              <InfoRow
                label="Bộ phận / phụ kiện"
                value={translatePartsStatus(form.partsStatus) || "Chưa có"}
              />
              <InfoRow
                label="Mức độ khớp với mô tả"
                value={translateMatchStatus(form.matchStatus) || "Chưa có"}
              />
              <InfoRow
                label="Kết luận"
                value={translateConclusion(form.conclusion) || "Chưa có"}
              />
              {form.originalPrice != null ? (
                <InfoRow
                  label="Giá giao dịch hiện tại"
                  value={formatCurrency(form.originalPrice)}
                />
              ) : null}
              {isPriceAdjustmentConclusion(form.conclusion) &&
              form.suggestedPrice != null ? (
                <InfoRow
                  label="Giá đề xuất"
                  value={formatCurrency(form.suggestedPrice)}
                />
              ) : null}
              {form.inspectorNotes ? (
                <InfoRow label="Ghi chú" value={form.inspectorNotes} />
              ) : null}
              <InfoRow
                label="Thời điểm gửi"
                value={formatDateTime(form.submittedAt)}
              />
              {form.sellerDecisionAt ? (
                <InfoRow
                  label="Người bán phản hồi lúc"
                  value={formatDateTime(form.sellerDecisionAt)}
                />
              ) : null}
              {form.sellerDecisionReason ? (
                <InfoRow
                  label="Lý do từ chối"
                  value={form.sellerDecisionReason}
                />
              ) : null}
            </View>

            {form.images && form.images.length > 0 ? (
              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Ảnh kiểm định</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.imageList}
                >
                  {form.images.map((image, index) => (
                    <Image
                      key={image.mediaId || `${image.url}-${index}`}
                      source={{ uri: image.url }}
                      style={styles.imagePreview}
                    />
                  ))}
                </ScrollView>
              </View>
            ) : null}

            {canSellerConfirm || canSellerReject ? (
              <View style={styles.formActionsRow}>
                {canSellerReject ? (
                  <TouchableOpacity
                    style={styles.outlineBtnDanger}
                    onPress={() => openSellerAction("reject")}
                  >
                    <Text style={styles.outlineBtnDangerText}>
                      Từ chối kết quả
                    </Text>
                  </TouchableOpacity>
                ) : null}
                {canSellerConfirm ? (
                  <TouchableOpacity
                    style={styles.primarySmallButtonFlex}
                    onPress={() => openSellerAction("confirm")}
                  >
                    <Text style={styles.primarySmallButtonText}>
                      Xác nhận kết quả
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            ) : null}
          </>
        ) : null}
      </ScrollView>

      <Modal
        visible={sellerAction !== null}
        transparent
        animationType="fade"
        onRequestClose={closeSellerAction}
      >
        <ModalBackdrop
          style={styles.modalBackdrop}
          onPress={closeSellerAction}
        >
          <ModalSurface style={styles.modalCard}>
            <Text style={styles.modalTitle}>
              {sellerAction === "confirm"
                ? "Xác nhận kết quả kiểm định?"
                : "Từ chối kết quả kiểm định?"}
            </Text>

            {sellerAction === "reject" ? (
              <>
                <Text style={styles.label}>Lý do từ chối <Text style={{ color: COLORS.error }}>*</Text></Text>
                <TextInput
                  value={rejectReason}
                  onChangeText={setRejectReason}
                  placeholder="Nhập lý do từ chối kết quả kiểm định"
                  placeholderTextColor={COLORS.textLight}
                  multiline
                  maxLength={500}
                  editable={!isSellerActionSubmitting}
                  style={[styles.textInput, styles.multilineInput]}
                />
              </>
            ) : (
              <Text style={styles.modalText}>
                Kết quả kiểm định sẽ được xác nhận và không thể hoàn tác.
              </Text>
            )}

            {sellerActionError ? (
              <Text style={styles.modalError}>{sellerActionError}</Text>
            ) : null}

            <View style={styles.lifecycleModalActions}>
              <TouchableOpacity
                style={styles.secondaryButtonFlex}
                onPress={closeSellerAction}
                disabled={isSellerActionSubmitting}
              >
                <Text style={styles.secondaryButtonFlexText}>Đóng</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primarySmallButtonFlex,
                  sellerAction === "reject"
                    ? styles.primaryButtonDanger
                    : undefined,
                ]}
                onPress={() => void handleSubmitSellerAction()}
                disabled={isSellerActionSubmitting}
              >
                {isSellerActionSubmitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primarySmallButtonText}>Xác nhận</Text>
                )}
              </TouchableOpacity>
            </View>
          </ModalSurface>
        </ModalBackdrop>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function EnumChipGroup<T extends number>({
  label,
  options,
  value,
  onSelect,
  translate,
}: {
  label: string;
  options: readonly T[];
  value: T | null;
  onSelect: (value: T | null) => void;
  translate: (value: T) => string | null;
}) {
  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.chipRow}>
        {options.map((option) => {
          const selected = value === option;
          return (
            <TouchableOpacity
              key={option}
              style={[styles.chip, selected ? styles.chipSelected : undefined]}
              // Chạm lại lựa chọn hiện tại để bỏ chọn.
              onPress={() => onSelect(selected ? null : option)}
            >
              <Text
                style={[
                  styles.chipText,
                  selected ? styles.chipTextSelected : undefined,
                ]}
              >
                {translate(option) || String(option)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: { color: COLORS.textLight, fontSize: 14 },
  loadErrorText: {
    color: COLORS.error,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },
  retryButton: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  retryButtonText: { color: COLORS.white, fontWeight: "800" },
  scrollContent: { padding: 16, paddingBottom: 36, gap: 14 },
  headerStatusCard: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    padding: 16,
  },
  statusTitle: { color: COLORS.white, fontSize: 18, fontWeight: "900" },
  statusMeta: {
    color: "rgba(255,255,255,0.78)",
    fontSize: 12,
    marginTop: 6,
  },
  messageBox: { borderWidth: 1, borderRadius: 10, padding: 12 },
  errorBox: {
    backgroundColor: "rgba(122, 16, 18, 0.08)",
    borderColor: "rgba(122, 16, 18, 0.22)",
  },
  successBox: {
    backgroundColor: "rgba(47, 118, 93, 0.10)",
    borderColor: "rgba(47, 118, 93, 0.24)",
  },
  infoBox: {
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    borderColor: "rgba(84, 123, 125, 0.24)",
  },
  messageText: { fontSize: 13, lineHeight: 19 },
  errorText: { color: COLORS.error },
  successText: { color: COLORS.success },
  infoText: { color: "#2B5659" },
  relatedOrderButton: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  relatedOrderText: {
    flex: 1,
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "800",
  },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
  },
  sectionTitle: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "900",
    paddingBottom: 9,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#BAC2C1",
  },
  helperText: {
    color: COLORS.textLight,
    fontSize: 12,
    lineHeight: 18,
    marginBottom: 10,
  },
  fieldGroup: { marginBottom: 14 },
  label: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 7,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#BAC2C1",
    paddingHorizontal: 14,
    justifyContent: "center",
  },
  chipSelected: {
    borderColor: COLORS.primary,
    backgroundColor: "rgba(43, 86, 89, 0.10)",
  },
  chipText: { color: COLORS.text, fontSize: 13 },
  chipTextSelected: { color: COLORS.primary, fontWeight: "800" },
  textInput: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#BAC2C1",
    borderRadius: 9,
    backgroundColor: COLORS.white,
    color: COLORS.text,
    fontSize: 14,
  },
  multilineInput: { minHeight: 90, paddingTop: 12, textAlignVertical: "top" },
  pickButton: {
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
  imageList: { gap: 10, paddingTop: 12, paddingBottom: 4 },
  imageItem: { position: "relative" },
  imagePreview: {
    width: 92,
    height: 92,
    borderRadius: 10,
    backgroundColor: COLORS.background,
  },
  removeImageButton: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: COLORS.error,
    alignItems: "center",
    justifyContent: "center",
  },
  replaceNoticeBox: {
    borderWidth: 1,
    borderColor: "rgba(154, 100, 24, 0.24)",
    backgroundColor: "rgba(154, 100, 24, 0.10)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  replaceNoticeText: { color: COLORS.warning, fontSize: 12, lineHeight: 18 },
  replaceCancelText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
  },
  formActionsRow: { flexDirection: "row", gap: 10 },
  dirtyHintText: {
    color: COLORS.warning,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "center",
  },
  secondaryButtonFlex: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  secondaryButtonFlexText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  primarySmallButtonFlex: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primarySmallButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },
  primaryButtonDanger: { backgroundColor: COLORS.error },
  outlineBtnDanger: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: "rgba(122, 16, 18, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  outlineBtnDangerText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: "800",
  },
  disabledButton: { opacity: 0.55 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    marginBottom: 10,
  },
  infoLabel: { flex: 1, color: COLORS.textLight, fontSize: 13 },
  infoValue: {
    flex: 1.5,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "right",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "rgba(23, 40, 48, 0.48)",
  },
  modalCard: {
    width: "100%",
    maxWidth: 380,
    padding: 18,
    borderRadius: 16,
    backgroundColor: COLORS.white,
  },
  modalTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 12,
  },
  modalText: {
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  modalError: {
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 12,
  },
  lifecycleModalActions: { flexDirection: "row", gap: 10, marginTop: 4 },
});
