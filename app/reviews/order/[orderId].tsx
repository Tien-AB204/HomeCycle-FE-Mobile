import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
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

import Header from "../../../src/components/shared/Header";
import { COLORS } from "../../../src/constants/theme";
import apiClient from "../../../src/services/apis/axiosClient";

const reviewApi = {
  getMine: (orderId: string) =>
    apiClient
      .get(`/reviews/orders/${orderId}/mine`)
      .then((response) => response.data),

  create: (orderId: string, formData: FormData) =>
    apiClient
      .post(`/reviews/orders/${orderId}`, formData, {
        timeout: 60000,
      })
      .then((response) => response.data),

  update: (reviewId: string, payload: { rating: number; comment?: string }) =>
    apiClient
      .put(`/reviews/${reviewId}`, payload)
      .then((response) => response.data),
};

const orderApi = {
  getDetail: (orderId: string) =>
    apiClient.get(`/orders/${orderId}`).then((response) => response.data),
};

type MessageState = {
  type: "error" | "success" | "warning";
  text: string;
} | null;

const unwrap = (value: any) => value?.data ?? value;

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

const appendImageToForm = async (
  formData: FormData,
  asset: ImagePicker.ImagePickerAsset,
  index: number,
) => {
  if (Platform.OS === "web") {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    formData.append("Images", blob, asset.fileName || `review-${index + 1}.jpg`);
    return;
  }

  formData.append("Images", {
    uri: asset.uri,
    name: asset.fileName || `review-${index + 1}.jpg`,
    type: asset.mimeType || "image/jpeg",
  } as any);
};

const isCompletedOrder = (status: unknown) => {
  const normalized = String(status ?? "")
    .replace(/[\s_-]/g, "")
    .toLowerCase();

  return normalized === "completed" || normalized === "2";
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export default function OrderReviewScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const orderId = Array.isArray(params.orderId)
    ? params.orderId[0]
    : params.orderId;

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderData, setOrderData] = useState<any>(null);
  const [myReview, setMyReview] = useState<any>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [message, setMessage] = useState<MessageState>(null);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [commentError, setCommentError] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);

  const order = orderData?.order || orderData;
  const completed = isCompletedOrder(order?.orderStatus ?? order?.status);

  const loadReviewData = useCallback(
    async (preserveMessage = false) => {
      if (!orderId) {
        setMessage({ type: "error", text: "Không tìm thấy mã đơn hàng." });
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        if (!preserveMessage) setMessage(null);

        const orderResult = await orderApi.getDetail(orderId);
        setOrderData(unwrap(orderResult));

        try {
          const mineResult = await reviewApi.getMine(orderId);
          const mine = unwrap(mineResult);
          setMyReview(mine || null);
          setRating(Number(mine?.rating || 0));
          setComment(String(mine?.comment || ""));
          setImages([]);
          setIsEditing(false);
        } catch (error: any) {
          const status = Number(error?.response?.status || 0);
          const code = getErrorCode(error);

          if (status === 404 || code === "Review.NotFound") {
            setMyReview(null);
            setRating(0);
            setComment("");
            setImages([]);
            setIsEditing(false);
          } else {
            throw error;
          }
        }
      } catch (error: any) {
        setMessage({
          type: "error",
          text: getErrorMessage(error, "Không thể tải thông tin đánh giá."),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [orderId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadReviewData(false);
    }, [loadReviewData]),
  );

  const clearFieldErrors = () => {
    setRatingError(null);
    setCommentError(null);
    setImageError(null);
    setMessage(null);
  };

  const validate = () => {
    let valid = true;
    setRatingError(null);
    setCommentError(null);
    setImageError(null);

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      setRatingError("Vui lòng chọn từ 1 đến 5 sao.");
      valid = false;
    }

    if (comment.length > 2000) {
      setCommentError("Nội dung đánh giá không được vượt quá 2000 ký tự.");
      valid = false;
    }

    if (images.length > 3) {
      setImageError("Mỗi đánh giá chỉ được đính kèm tối đa 3 ảnh.");
      valid = false;
    }

    return valid;
  };

  const pickImages = async () => {
    clearFieldErrors();

    if (images.length >= 3) {
      setImageError("Bạn đã chọn đủ 3 ảnh.");
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: 3 - images.length,
      quality: 0.75,
    });

    if (result.canceled) return;

    setImages((current) => [...current, ...result.assets].slice(0, 3));
  };

  const removeImage = (index: number) => {
    setImages((current) =>
      current.filter((_, itemIndex) => itemIndex !== index),
    );
    setImageError(null);
  };

  const submitCreateReview = async () => {
    if (!orderId || !validate()) return;

    try {
      setIsSubmitting(true);
      setMessage(null);

      const formData = new FormData();
      formData.append("Rating", String(rating));

      if (comment.trim()) {
        formData.append("Comment", comment.trim());
      }

      for (let index = 0; index < images.length; index += 1) {
        await appendImageToForm(formData, images[index], index);
      }

      await reviewApi.create(orderId, formData);
      await loadReviewData(true);
      setMessage({ type: "success", text: "Đã gửi đánh giá thành công." });
    } catch (error: any) {
      const code = getErrorCode(error);
      const fallback =
        code === "Order.NotCompleted"
          ? "Chỉ có thể đánh giá sau khi đơn hàng hoàn thành."
          : code === "Review.AlreadyExists"
            ? "Bạn đã đánh giá đơn hàng này."
            : code === "Validation.InvalidRequest"
              ? "Thông tin đánh giá chưa hợp lệ. Vui lòng kiểm tra số sao, nội dung và số ảnh."
              : "Không thể gửi đánh giá lúc này.";

      setMessage({ type: "error", text: getErrorMessage(error, fallback) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitUpdateReview = async () => {
    if (!myReview?.reviewId || !validate()) return;

    try {
      setIsSubmitting(true);
      setMessage(null);

      await reviewApi.update(myReview.reviewId, {
        rating,
        comment: comment.trim() || undefined,
      });

      setIsEditing(false);
      await loadReviewData(true);
      setMessage({ type: "success", text: "Đã cập nhật đánh giá." });
    } catch (error: any) {
      const code = getErrorCode(error);
      const fallback =
        code === "Review.EditWindowExpired"
          ? "Đánh giá đã hết thời hạn chỉnh sửa 3 ngày."
          : "Không thể cập nhật đánh giá lúc này.";

      setMessage({ type: "error", text: getErrorMessage(error, fallback) });
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = () => {
    if (!myReview?.canEdit) {
      setMessage({
        type: "warning",
        text: "Đánh giá này đã hết thời hạn chỉnh sửa 3 ngày.",
      });
      return;
    }

    setRating(Number(myReview.rating || 0));
    setComment(String(myReview.comment || ""));
    setImages([]);
    clearFieldErrors();
    setIsEditing(true);
  };

  const cancelEditing = () => {
    setRating(Number(myReview?.rating || 0));
    setComment(String(myReview?.comment || ""));
    setImages([]);
    clearFieldErrors();
    setIsEditing(false);
  };

  const starRow = useMemo(
    () => (
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((star) => (
          <TouchableOpacity
            key={star}
            style={styles.starButton}
            onPress={() => {
              setRating(star);
              setRatingError(null);
              setMessage(null);
            }}
            disabled={Boolean(myReview && !isEditing)}
          >
            <Ionicons
              name={star <= rating ? "star" : "star-outline"}
              size={34}
              color="#F59E0B"
            />
          </TouchableOpacity>
        ))}
      </View>
    ),
    [isEditing, myReview, rating],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Đánh giá đơn hàng" showBack />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải đánh giá...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <Header title="Đánh giá đơn hàng" showBack />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.orderCard}>
            <View style={styles.orderHeaderRow}>
              <View style={styles.flex}>
                <Text style={styles.orderTitle}>Đơn hàng</Text>
                <Text style={styles.orderCode}>
                  {order?.orderCode || orderId || "Không xác định"}
                </Text>
              </View>

              <View
                style={[
                  styles.statusBadge,
                  completed ? styles.completedBadge : styles.pendingBadge,
                ]}
              >
                <Text
                  style={[
                    styles.statusBadgeText,
                    completed ? styles.completedText : styles.pendingText,
                  ]}
                >
                  {completed ? "Đã hoàn thành" : "Chưa hoàn thành"}
                </Text>
              </View>
            </View>
          </View>

          {message ? (
            <View
              style={[
                styles.messageBox,
                message.type === "error"
                  ? styles.errorBox
                  : message.type === "success"
                    ? styles.successBox
                    : styles.warningBox,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  message.type === "error"
                    ? styles.errorText
                    : message.type === "success"
                      ? styles.successText
                      : styles.warningText,
                ]}
              >
                {message.text}
              </Text>
            </View>
          ) : null}

          {!completed ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Chưa thể đánh giá</Text>
              <Text style={styles.description}>
                Chỉ Buyer hoặc Seller của đơn hàng mới được đánh giá sau khi đơn
                chuyển sang trạng thái Completed.
              </Text>
            </View>
          ) : myReview && !isEditing ? (
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <Text style={styles.cardTitle}>Đánh giá của bạn</Text>
                <Text style={styles.reviewTime}>
                  {formatDateTime(myReview.updatedAt || myReview.createdAt)}
                </Text>
              </View>

              {starRow}

              <Text style={styles.commentReadOnly}>
                {myReview.comment || "Không có nhận xét."}
              </Text>

              {Array.isArray(myReview.images) && myReview.images.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.imageList}
                >
                  {myReview.images.map((item: any, index: number) => (
                    <Image
                      key={item.mediaId || item.url || index}
                      source={{ uri: item.url }}
                      style={styles.reviewImage}
                    />
                  ))}
                </ScrollView>
              ) : null}

              {myReview.canEdit ? (
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={startEditing}
                >
                  <Ionicons
                    name="create-outline"
                    size={18}
                    color={COLORS.primary}
                  />
                  <Text style={styles.secondaryButtonText}>Sửa đánh giá</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.editExpiredText}>
                  Đã hết thời hạn chỉnh sửa 3 ngày.
                </Text>
              )}
            </View>
          ) : (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {isEditing ? "Sửa đánh giá" : "Đánh giá giao dịch"}
              </Text>

              <Text style={styles.fieldLabel}>Mức độ hài lòng *</Text>
              {starRow}
              {ratingError ? (
                <Text style={styles.fieldError}>{ratingError}</Text>
              ) : null}

              <View style={styles.commentHeaderRow}>
                <Text style={styles.fieldLabel}>Nhận xét</Text>
                <Text
                  style={[
                    styles.counterText,
                    comment.length > 2000 ? styles.counterError : undefined,
                  ]}
                >
                  {comment.length}/2000
                </Text>
              </View>

              <TextInput
                style={[
                  styles.commentInput,
                  commentError ? styles.inputError : undefined,
                ]}
                value={comment}
                onChangeText={(value) => {
                  setComment(value);
                  setCommentError(null);
                  setMessage(null);
                }}
                placeholder="Chia sẻ trải nghiệm giao dịch..."
                placeholderTextColor={COLORS.textLight}
                multiline
                maxLength={2100}
                textAlignVertical="top"
              />

              {commentError ? (
                <Text style={styles.fieldError}>{commentError}</Text>
              ) : null}

              {!isEditing ? (
                <>
                  <View style={styles.commentHeaderRow}>
                    <Text style={styles.fieldLabel}>Ảnh đính kèm</Text>
                    <Text style={styles.counterText}>{images.length}/3</Text>
                  </View>

                  <View style={styles.selectedImagesRow}>
                    {images.map((asset, index) => (
                      <View
                        key={`${asset.uri}-${index}`}
                        style={styles.selectedImageWrap}
                      >
                        <Image
                          source={{ uri: asset.uri }}
                          style={styles.selectedImage}
                        />
                        <TouchableOpacity
                          style={styles.removeImageButton}
                          onPress={() => removeImage(index)}
                        >
                          <Ionicons
                            name="close"
                            size={16}
                            color={COLORS.white}
                          />
                        </TouchableOpacity>
                      </View>
                    ))}

                    {images.length < 3 ? (
                      <TouchableOpacity
                        style={styles.addImageButton}
                        onPress={pickImages}
                      >
                        <Ionicons
                          name="camera-outline"
                          size={25}
                          color={COLORS.primary}
                        />
                        <Text style={styles.addImageText}>Thêm ảnh</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  {imageError ? (
                    <Text style={styles.fieldError}>{imageError}</Text>
                  ) : null}
                </>
              ) : (
                <Text style={styles.editImageNote}>
                  Ảnh của đánh giá cũ được giữ nguyên; khi sửa chỉ cập nhật số sao
                  và nhận xét.
                </Text>
              )}

              <View style={styles.formActions}>
                {isEditing ? (
                  <TouchableOpacity
                    style={styles.cancelButton}
                    onPress={cancelEditing}
                    disabled={isSubmitting}
                  >
                    <Text style={styles.cancelButtonText}>Hủy sửa</Text>
                  </TouchableOpacity>
                ) : null}

                <TouchableOpacity
                  style={[
                    styles.primaryButton,
                    isEditing ? styles.flexButton : undefined,
                    isSubmitting ? styles.disabledButton : undefined,
                  ]}
                  onPress={() =>
                    void (isEditing
                      ? submitUpdateReview()
                      : submitCreateReview())
                  }
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.primaryButtonText}>
                      {isEditing ? "LƯU ĐÁNH GIÁ" : "GỬI ĐÁNH GIÁ"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity
            style={styles.backToOrderButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={styles.backToOrderText}>Quay lại đơn hàng</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  flex: { flex: 1 },
  flexButton: { flex: 1 },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { marginTop: 10, color: COLORS.textLight },
  scrollContent: { padding: 16, paddingBottom: 40 },
  orderCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  orderHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  orderTitle: { fontSize: 14, color: COLORS.textLight },
  orderCode: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginTop: 2,
  },
  statusBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  completedBadge: { backgroundColor: "#D1FAE5" },
  pendingBadge: { backgroundColor: "#FEF3C7" },
  statusBadgeText: { fontSize: 12, fontWeight: "700" },
  completedText: { color: "#047857" },
  pendingText: { color: "#B45309" },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 14,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 12,
  },
  description: { color: COLORS.textLight, lineHeight: 20, fontSize: 13 },
  starRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 8,
  },
  starButton: { padding: 4 },
  fieldLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 8,
  },
  fieldError: {
    color: COLORS.error,
    fontSize: 12,
    marginTop: 6,
    marginBottom: 4,
  },
  commentHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  counterText: { fontSize: 11, color: COLORS.textLight },
  counterError: { color: COLORS.error },
  commentInput: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  inputError: { borderColor: COLORS.error },
  commentReadOnly: {
    color: COLORS.text,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    lineHeight: 20,
    marginTop: 6,
  },
  selectedImagesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  selectedImageWrap: { position: "relative" },
  selectedImage: { width: 86, height: 86, borderRadius: 10 },
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
  addImageButton: {
    width: 86,
    height: 86,
    borderRadius: 10,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addImageText: {
    fontSize: 11,
    color: COLORS.primary,
    fontWeight: "600",
  },
  formActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  primaryButton: {
    minHeight: 48,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: "800",
    fontSize: 14,
  },
  secondaryButton: {
    marginTop: 14,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  secondaryButtonText: { color: COLORS.primary, fontWeight: "700" },
  cancelButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: { color: COLORS.text, fontWeight: "700" },
  disabledButton: { opacity: 0.6 },
  editExpiredText: {
    color: COLORS.textLight,
    fontSize: 12,
    marginTop: 12,
    fontStyle: "italic",
  },
  editImageNote: {
    color: COLORS.textLight,
    fontSize: 12,
    backgroundColor: "#F8FAFC",
    padding: 10,
    borderRadius: 8,
    marginTop: 12,
  },
  messageBox: {
    borderRadius: 10,
    padding: 11,
    marginBottom: 14,
    borderWidth: 1,
  },
  errorBox: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  successBox: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  warningBox: { backgroundColor: "#FFFBEB", borderColor: "#FDE68A" },
  messageText: { fontSize: 13, lineHeight: 18 },
  errorText: { color: "#B91C1C" },
  successText: { color: "#047857" },
  warningText: { color: "#B45309" },
  reviewTime: {
    fontSize: 10,
    color: COLORS.textLight,
    maxWidth: 105,
    textAlign: "right",
  },
  imageList: { gap: 8, marginTop: 10 },
  reviewImage: { width: 110, height: 110, borderRadius: 10 },
  backToOrderButton: {
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  backToOrderText: { color: COLORS.primary, fontWeight: "700" },
});
