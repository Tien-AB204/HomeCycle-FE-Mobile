import { getAvatarSource } from "../../../src/utils/avatar";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
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
import Header from "../../../src/components/shared/Header";
import { COLORS } from "../../../src/constants/theme";
import apiClient from "../../../src/services/apis/axiosClient";

const PAGE_SIZE = 10;

const reviewApi = {
  getByUser: (userId: string, pageNumber: number) =>
    apiClient
      .get(`/reviews/users/${userId}`, {
        params: { pageNumber, pageSize: PAGE_SIZE },
      })
      .then((response) => response.data),
};

const unwrap = (value: any) => value?.data ?? value;

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

export default function UserReviewsScreen() {
  const params = useLocalSearchParams();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;

  const [reviews, setReviews] = useState<any[]>([]);
  const [pageNumber, setPageNumber] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadPage = useCallback(
    async (page: number) => {
      if (!userId) {
        setErrorMessage("Không tìm thấy người dùng cần xem đánh giá.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setErrorMessage(null);

        const response = await reviewApi.getByUser(userId, page);
        const data = unwrap(response);
        const items = data?.items || data?.data?.items || [];

        setReviews(Array.isArray(items) ? items : []);
        setPageNumber(Number(data?.pageNumber || page));
        setTotalPages(Math.max(1, Number(data?.totalPages || 1)));
        setTotalCount(Number(data?.totalCount || 0));
      } catch (error: any) {
        setReviews([]);
        setErrorMessage(
          String(
            error?.response?.data?.message ||
              error?.response?.data?.error?.message ||
              "Không thể tải danh sách đánh giá của người dùng này.",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void loadPage(1);
  }, [loadPage]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Đánh giá nhận được" showBack />

      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải đánh giá...</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summaryCard}>
            <Ionicons name="star" size={24} color="#9A6418" />
            <View style={styles.summaryTextWrap}>
              <Text style={styles.summaryTitle}>Đánh giá từ các giao dịch</Text>
              <Text style={styles.summaryText}>{totalCount} đánh giá đã nhận</Text>
            </View>
          </View>

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={() => void loadPage(pageNumber)}
              >
                <Text style={styles.retryButtonText}>Thử lại</Text>
              </TouchableOpacity>
            </View>
          ) : null}

          {!errorMessage && reviews.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="chatbox-ellipses-outline" size={36} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>Chưa có đánh giá</Text>
              <Text style={styles.emptyText}>
                Người dùng này chưa nhận được đánh giá từ giao dịch đã hoàn thành.
              </Text>
            </View>
          ) : null}

          {reviews.map((review, index) => (
            <View key={review.reviewId || index} style={styles.reviewCard}>
              <View style={styles.reviewerRow}>
                <Image
                  source={getAvatarSource(review.reviewerAvatarUrl)}
                  style={styles.avatar}
                />

                <View style={styles.flex}>
                  <Text style={styles.reviewerName}>
                    {review.reviewerName || "Người dùng"}
                  </Text>
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Ionicons
                        key={star}
                        name={star <= Number(review.rating || 0) ? "star" : "star-outline"}
                        size={17}
                        color="#9A6418"
                      />
                    ))}
                  </View>
                </View>

                <Text style={styles.reviewTime}>
                  {formatDateTime(review.updatedAt || review.createdAt)}
                </Text>
              </View>

              {review.comment ? (
                <Text style={styles.comment}>{review.comment}</Text>
              ) : (
                <Text style={styles.noComment}>Không có nhận xét.</Text>
              )}

              {Array.isArray(review.images) && review.images.length > 0 ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.imageList}
                >
                  {review.images.map((item: any, imageIndex: number) => (
                    <Image
                      key={item.mediaId || item.url || imageIndex}
                      source={{ uri: item.url }}
                      style={styles.reviewImage}
                    />
                  ))}
                </ScrollView>
              ) : null}
            </View>
          ))}

          {totalPages > 1 ? (
            <View style={styles.paginationRow}>
              <TouchableOpacity
                style={[
                  styles.pageButton,
                  pageNumber <= 1 ? styles.disabledButton : undefined,
                ]}
                disabled={pageNumber <= 1}
                onPress={() => void loadPage(pageNumber - 1)}
              >
                <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
                <Text style={styles.pageButtonText}>Trước</Text>
              </TouchableOpacity>

              <Text style={styles.pageText}>
                Trang {pageNumber}/{totalPages}
              </Text>

              <TouchableOpacity
                style={[
                  styles.pageButton,
                  pageNumber >= totalPages ? styles.disabledButton : undefined,
                ]}
                disabled={pageNumber >= totalPages}
                onPress={() => void loadPage(pageNumber + 1)}
              >
                <Text style={styles.pageButtonText}>Sau</Text>
                <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  flex: { flex: 1 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: COLORS.textLight },
  scrollContent: { padding: 16, paddingBottom: 40 },
  summaryCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  summaryTextWrap: { flex: 1 },
  summaryTitle: { color: COLORS.text, fontWeight: "700", fontSize: 15 },
  summaryText: { color: COLORS.textLight, fontSize: 12, marginTop: 3 },
  errorBox: {
    backgroundColor: "rgba(122, 16, 18, 0.08)",
    borderWidth: 1,
    borderColor: "rgba(122, 16, 18, 0.22)",
    borderRadius: 10,
    padding: 12,
    marginBottom: 14,
  },
  errorText: { color: "#7A1012", fontSize: 13, lineHeight: 18 },
  retryButton: {
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: "#7A1012",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginTop: 9,
  },
  retryButtonText: { color: "#7A1012", fontWeight: "700", fontSize: 12 },
  emptyCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 28,
    alignItems: "center",
  },
  emptyTitle: { color: COLORS.text, fontSize: 16, fontWeight: "700", marginTop: 10 },
  emptyText: { color: COLORS.textLight, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 5 },
  reviewCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  reviewerRow: { flexDirection: "row", alignItems: "center", gap: 9 },
  avatar: { width: 42, height: 42, borderRadius: 21 },
  avatarPlaceholder: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
  },
  reviewerName: { color: COLORS.text, fontWeight: "700", fontSize: 13 },
  starRow: { flexDirection: "row", marginTop: 3 },
  reviewTime: { color: COLORS.textLight, fontSize: 10, maxWidth: 110, textAlign: "right" },
  comment: { color: COLORS.text, fontSize: 13, lineHeight: 20, marginTop: 12 },
  noComment: { color: COLORS.textLight, fontSize: 12, fontStyle: "italic", marginTop: 12 },
  imageList: { gap: 8, marginTop: 12 },
  reviewImage: { width: 94, height: 94, borderRadius: 9 },
  paginationRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
  },
  pageButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 9,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  pageButtonText: { color: COLORS.primary, fontWeight: "700", fontSize: 12 },
  pageText: { color: COLORS.textLight, fontSize: 12 },
  disabledButton: { opacity: 0.4 },
});
