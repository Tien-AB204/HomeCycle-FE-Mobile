import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import apiClient from "../../src/services/apis/axiosClient";
import {
  isUnavailableReviewStatus,
  normalizeReviewStatus,
} from "../../src/services/reviews/reviewStatus";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import { getAvatarSource } from "../../src/utils/avatar";

type ReviewImage = {
  mediaId?: string;
  url?: string;
};

type ReviewDetail = {
  reviewId: string;
  rating: number;
  comment: string;
  reviewerName: string;
  reviewerAvatarUrl: string | null;
  images: ReviewImage[];
  createdAt: string | null;
  updatedAt: string | null;
  reviewStatus: unknown;
};

const unwrap = (value: any) => value?.data ?? value;

const getSingleParam = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

const getErrorCode = (error: any) =>
  String(
    error?.response?.data?.code ??
      error?.response?.data?.error?.code ??
      error?.code ??
      "",
  );

const isUnavailableReviewError = (error: any) => {
  const status = Number(error?.response?.status ?? 0);
  const code = getErrorCode(error);

  return (
    status === 404 ||
    status === 410 ||
    code === "Review.NotFound" ||
    code === "Review.NotVisible"
  );
};

const normalizeReviewDetail = (value: any): ReviewDetail | null => {
  const reviewId = String(value?.reviewId ?? value?.ReviewId ?? "").trim();
  if (!reviewId) return null;

  const rating = Number(value?.rating ?? value?.Rating ?? 0);
  const rawImages = value?.images ?? value?.Images;

  return {
    reviewId,
    rating: Number.isFinite(rating) ? rating : 0,
    comment: String(value?.comment ?? value?.Comment ?? ""),
    reviewerName: String(
      value?.reviewerName ?? value?.ReviewerName ?? "Người dùng",
    ),
    reviewerAvatarUrl:
      value?.reviewerAvatarUrl ?? value?.ReviewerAvatarUrl ?? null,
    images: Array.isArray(rawImages) ? rawImages : [],
    createdAt: value?.createdAt ?? value?.CreatedAt ?? null,
    updatedAt: value?.updatedAt ?? value?.UpdatedAt ?? null,
    reviewStatus: value?.reviewStatus ?? value?.ReviewStatus ?? value?.status,
  };
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

export default function ReviewDetailScreen() {
  const params = useLocalSearchParams();
  const reviewId = getSingleParam(
    params.reviewId as string | string[] | undefined,
  );
  const [review, setReview] = useState<ReviewDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isUnavailable, setIsUnavailable] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadReview = useCallback(async () => {
    if (!reviewId) {
      setIsUnavailable(true);
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setIsUnavailable(false);
      setErrorMessage(null);

      const response = await apiClient.get(`/reviews/${reviewId}`);
      const nextReview = normalizeReviewDetail(unwrap(response.data));

      if (!nextReview || isUnavailableReviewStatus(nextReview.reviewStatus)) {
        setReview(null);
        setIsUnavailable(true);
        return;
      }

      setReview(nextReview);
    } catch (error: any) {
      setReview(null);

      if (isUnavailableReviewError(error)) {
        setIsUnavailable(true);
      } else {
        setErrorMessage(
          getApiErrorMessage(error, "Không thể tải đánh giá lúc này."),
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [reviewId]);

  useEffect(() => {
    void loadReview();
  }, [loadReview]);

  const reviewStatus = normalizeReviewStatus(review?.reviewStatus);
  const displayTime = formatDateTime(review?.updatedAt || review?.createdAt);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Chi tiết đánh giá" showBack />

      {isLoading ? (
        <View style={styles.centeredState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateText}>Đang tải đánh giá...</Text>
        </View>
      ) : isUnavailable ? (
        <View style={styles.centeredState}>
          <Ionicons
            name="chatbox-ellipses-outline"
            size={52}
            color={COLORS.textLight}
          />
          <Text style={styles.unavailableTitle}>
            Đánh giá không còn khả dụng
          </Text>
        </View>
      ) : errorMessage ? (
        <View style={styles.centeredState}>
          <Text style={styles.errorText}>{errorMessage}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={() => void loadReview()}>
            <Text style={styles.retryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      ) : review ? (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.reviewCard}>
            <View style={styles.reviewerRow}>
              <Image
                source={getAvatarSource(review.reviewerAvatarUrl)}
                style={styles.avatar}
              />
              <View style={styles.reviewerInfo}>
                <Text style={styles.reviewerName}>{review.reviewerName}</Text>
                <View style={styles.starRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={star <= review.rating ? "star" : "star-outline"}
                      size={18}
                      color="#9A6418"
                    />
                  ))}
                </View>
              </View>
              {displayTime ? (
                <Text style={styles.reviewTime}>{displayTime}</Text>
              ) : null}
            </View>

            {reviewStatus === "edited" ? (
              <Text style={styles.editedLabel}>Đã chỉnh sửa</Text>
            ) : null}

            {review.comment ? (
              <Text style={styles.comment}>{review.comment}</Text>
            ) : (
              <Text style={styles.noComment}>Không có nhận xét.</Text>
            )}

            {review.images.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.imageList}
              >
                {review.images.map((image, index) =>
                  image.url ? (
                    <Image
                      key={image.mediaId || image.url || index}
                      source={{ uri: image.url }}
                      style={styles.reviewImage}
                    />
                  ) : null,
                )}
              </ScrollView>
            ) : null}
          </View>
        </ScrollView>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  stateText: { marginTop: 10, color: COLORS.textLight },
  unavailableTitle: {
    marginTop: 12,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },
  errorText: { color: "#7A1012", fontSize: 13, textAlign: "center" },
  retryButton: {
    marginTop: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryButtonText: { color: COLORS.primary, fontWeight: "700" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  reviewCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
  },
  reviewerRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  reviewerInfo: { flex: 1 },
  reviewerName: { color: COLORS.text, fontWeight: "700", fontSize: 13 },
  starRow: { flexDirection: "row", marginTop: 3 },
  reviewTime: {
    color: COLORS.textLight,
    fontSize: 10,
    maxWidth: 110,
    textAlign: "right",
  },
  editedLabel: {
    alignSelf: "flex-start",
    marginTop: 12,
    color: "#2B5659",
    fontSize: 11,
    fontWeight: "700",
  },
  comment: { color: COLORS.text, fontSize: 13, lineHeight: 20, marginTop: 12 },
  noComment: {
    color: COLORS.textLight,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 12,
  },
  imageList: { gap: 8, marginTop: 12 },
  reviewImage: { width: 94, height: 94, borderRadius: 9 },
});
