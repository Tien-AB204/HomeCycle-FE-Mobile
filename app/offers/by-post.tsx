import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, {
  useCallback,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import { getAvatarSource } from "../../src/utils/avatar";

type ReceivedOfferItem = {
  offerId?: string;
  postId?: string;

  productName?: string;
  postTitle?: string;
  postThumbnailUrl?: string | null;

  senderId?: string;
  senderName?: string;
  senderAvatarUrl?: string | null;

  offerPrice?: number | null;
  offerQuantity?: number | null;
  offerStatus?: string | number | null;

  version?: number | null;
  createdAt?: string | null;
};

const PAGE_SIZE = 100;
const MAX_PAGE_GUARD = 1000;

const offerApi = {
  getReceivedOffers: (params: {
    PageNumber: number;
    PageSize: number;
  }) =>
    apiClient
      .get("/offers/received", { params })
      .then((response) => response.data),
};

const unwrapPage = (response: any) =>
  response?.data ?? response;

const getPageItems = (
  response: any,
): ReceivedOfferItem[] => {
  const page = unwrapPage(response);

  const items =
    page?.items ??
    page?.Items ??
    [];

  return Array.isArray(items)
    ? items
    : [];
};

const normalizeId = (value: unknown) =>
  String(value ?? "")
    .trim()
    .toLowerCase();

const normalizeStatus = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/[\s_-]/g, "")
    .toLowerCase();

const getStatusLabel = (value: unknown) => {
  switch (normalizeStatus(value)) {
    case "0":
    case "pending":
      return "Đang chờ phản hồi";

    case "1":
    case "accepted":
      return "Đã chấp nhận";

    case "2":
    case "rejected":
      return "Đã từ chối";

    case "3":
    case "cancelled":
    case "canceled":
      return "Đã hủy";

    default:
      return "Chưa xác định";
  }
};

const getStatusStyle = (value: unknown) => {
  switch (normalizeStatus(value)) {
    case "1":
    case "accepted":
      return styles.statusAccepted;

    case "2":
    case "rejected":
    case "3":
    case "cancelled":
    case "canceled":
      return styles.statusRejected;

    default:
      return styles.statusPending;
  }
};

const formatPrice = (value: unknown) =>
  `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const formatDate = (value: unknown) => {
  if (!value) return "";

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const fetchAllReceivedOffers =
  async (): Promise<ReceivedOfferItem[]> => {
    const result: ReceivedOfferItem[] = [];

    let pageNumber = 1;

    while (pageNumber <= MAX_PAGE_GUARD) {
      const response =
        await offerApi.getReceivedOffers({
          PageNumber: pageNumber,
          PageSize: PAGE_SIZE,
        });

      const page = unwrapPage(response);
      const items = getPageItems(response);

      result.push(...items);

      const rawTotalPages = Number(
        page?.totalPages ??
          page?.TotalPages,
      );

      const hasTotalPages =
        Number.isInteger(rawTotalPages) &&
        rawTotalPages > 0;

      const rawHasNext =
        page?.hasNextPage ??
        page?.HasNextPage;

      const hasNextKnown =
        typeof rawHasNext === "boolean";

      const shouldContinue =
        rawHasNext === true ||
        (
          hasTotalPages &&
          pageNumber < rawTotalPages
        ) ||
        (
          !hasNextKnown &&
          !hasTotalPages &&
          items.length === PAGE_SIZE
        );

      if (!shouldContinue) {
        break;
      }

      pageNumber += 1;
    }

    return result;
  };

export default function OffersByPostScreen() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const postId = Array.isArray(params.postId)
    ? params.postId[0]
    : params.postId;

  const postTitleParam = Array.isArray(
    params.postTitle,
  )
    ? params.postTitle[0]
    : params.postTitle;

  const [offers, setOffers] = useState<
    ReceivedOfferItem[]
  >([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [errorText, setErrorText] =
    useState<string | null>(null);

  const loadOffers = useCallback(
    async (refreshing = false) => {
      if (!postId) {
        setOffers([]);
        setErrorText(
          "Không tìm thấy bài đăng để tải đề nghị.",
        );
        setIsLoading(false);
        return;
      }

      try {
        if (refreshing) {
          setIsRefreshing(true);
        } else {
          setIsLoading(true);
        }

        setErrorText(null);

        const allReceivedOffers =
          await fetchAllReceivedOffers();

        const targetPostId =
          normalizeId(postId);

        const filtered =
          allReceivedOffers
            .filter(
              (offer) =>
                normalizeId(
                  offer?.postId,
                ) === targetPostId,
            )
            .sort((first, second) => {
              const priceDifference =
                Number(
                  second?.offerPrice ?? 0,
                ) -
                Number(
                  first?.offerPrice ?? 0,
                );

              if (priceDifference !== 0) {
                return priceDifference;
              }

              const secondTime =
                new Date(
                  String(
                    second?.createdAt ?? "",
                  ),
                ).getTime() || 0;

              const firstTime =
                new Date(
                  String(
                    first?.createdAt ?? "",
                  ),
                ).getTime() || 0;

              return secondTime - firstTime;
            });

        setOffers(filtered);
      } catch (error) {
        setOffers([]);

        setErrorText(
          getApiErrorMessage(
            error,
            "Không thể tải các đề nghị của bài đăng.",
          ),
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [postId],
  );

  useFocusEffect(
    useCallback(() => {
      void loadOffers();
    }, [loadOffers]),
  );

  const highestPrice = useMemo(() => {
    const prices = offers
      .map((offer) =>
        Number(offer?.offerPrice),
      )
      .filter(
        (value) =>
          Number.isFinite(value) &&
          value > 0,
      );

    return prices.length > 0
      ? Math.max(...prices)
      : null;
  }, [offers]);

  const productName =
    String(postTitleParam || "").trim() ||
    offers[0]?.productName ||
    offers[0]?.postTitle ||
    "Bài đăng hiện tại";

  const openOfferDetail = (
    offerId: unknown,
  ) => {
    const targetOfferId =
      String(offerId ?? "").trim();

    if (!targetOfferId) return;

    router.push({
      pathname: "/offers/[id]",
      params: {
        id: targetOfferId,
      },
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header
          title="Đề nghị cho bài đăng"
          showBack
        />

        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />

          <Text style={styles.loadingText}>
            Đang tải đề nghị...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header
        title="Đề nghị cho bài đăng"
        showBack
      />

      <FlatList
        data={offers}
        keyExtractor={(item, index) =>
          String(
            item.offerId ||
              `offer-${index}`,
          )
        }
        contentContainerStyle={
          styles.content
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() =>
              void loadOffers(true)
            }
          />
        }
        ListHeaderComponent={
          <View style={styles.listHeader}>
            <Text
              style={styles.productName}
              numberOfLines={2}
            >
              {productName}
            </Text>

            <View style={styles.summaryCard}>
              <View style={styles.summaryItem}>
                <Text style={styles.summaryValue}>
                  {offers.length}
                </Text>

                <Text style={styles.summaryLabel}>
                  Lời đề nghị
                </Text>
              </View>

              <View
                style={styles.summaryDivider}
              />

              <View style={styles.summaryItem}>
                <Text
                  style={styles.summaryPrice}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {highestPrice
                    ? formatPrice(highestPrice)
                    : "Chưa có"}
                </Text>

                <Text style={styles.summaryLabel}>
                  Giá cao nhất
                </Text>
              </View>
            </View>

            <View style={styles.sortBadge}>
              <Ionicons
                name="swap-vertical-outline"
                size={15}
                color={COLORS.primary}
              />

              <Text style={styles.sortText}>
                Giá cao nhất trước
              </Text>
            </View>

            {errorText ? (
              <View style={styles.errorBox}>
                <Ionicons
                  name="alert-circle-outline"
                  size={19}
                  color={COLORS.error}
                />

                <Text style={styles.errorText}>
                  {errorText}
                </Text>
              </View>
            ) : null}
          </View>
        }
        renderItem={({ item }) => {
          const senderName =
            String(
              item.senderName || "",
            ).trim() || "Người gửi";

          return (
            <TouchableOpacity
              style={styles.offerCard}
              activeOpacity={0.8}
              onPress={() =>
                openOfferDetail(
                  item.offerId,
                )
              }
            >
              <Image
                source={getAvatarSource(
                  item.senderAvatarUrl,
                )}
                style={styles.avatar}
                resizeMode="cover"
              />

              <View style={styles.offerContent}>
                <View style={styles.offerTopRow}>
                  <Text
                    style={styles.senderName}
                    numberOfLines={1}
                  >
                    {senderName}
                  </Text>

                  <Text style={styles.offerPrice}>
                    {formatPrice(
                      item.offerPrice,
                    )}
                  </Text>
                </View>

                <View style={styles.offerMetaRow}>
                  <Text style={styles.offerQuantity}>
                    Số lượng:{" "}
                    {Number(
                      item.offerQuantity || 0,
                    )}
                  </Text>

                  <Text style={styles.offerDate}>
                    {formatDate(
                      item.createdAt,
                    )}
                  </Text>
                </View>

                <View style={styles.offerBottomRow}>
                  <View
                    style={[
                      styles.statusBadge,
                      getStatusStyle(
                        item.offerStatus,
                      ),
                    ]}
                  >
                    <Text style={styles.statusText}>
                      {getStatusLabel(
                        item.offerStatus,
                      )}
                    </Text>
                  </View>

                  <View style={styles.detailLink}>
                    <Text
                      style={
                        styles.detailLinkText
                      }
                    >
                      Xem chi tiết
                    </Text>

                    <Ionicons
                      name="chevron-forward"
                      size={16}
                      color={COLORS.primary}
                    />
                  </View>
                </View>
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={
          !errorText ? (
            <View style={styles.emptyState}>
              <Ionicons
                name="chatbubbles-outline"
                size={44}
                color={COLORS.textLight}
              />

              <Text style={styles.emptyTitle}>
                Chưa có đề nghị
              </Text>

              <Text style={styles.emptyText}>
                Bài đăng này chưa nhận được đề nghị thương lượng nào.
              </Text>
            </View>
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    color: COLORS.textLight,
    fontSize: 14,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
  },
  listHeader: {
    gap: 12,
    marginBottom: 12,
  },
  productName: {
    color: COLORS.text,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: "800",
  },
  summaryCard: {
    minHeight: 76,
    flexDirection: "row",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 12,
  },
  summaryDivider: {
    width: 1,
    marginVertical: 12,
    backgroundColor: COLORS.border,
  },
  summaryValue: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "800",
  },
  summaryPrice: {
    maxWidth: "100%",
    color: COLORS.primary,
    fontSize: 16,
    fontWeight: "800",
  },
  summaryLabel: {
    marginTop: 4,
    color: COLORS.textLight,
    fontSize: 11,
  },
  sortBadge: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor:
      "rgba(43, 86, 89, 0.08)",
  },
  sortText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "600",
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 11,
    borderWidth: 1,
    borderColor:
      "rgba(122, 16, 18, 0.22)",
    borderRadius: 9,
    backgroundColor:
      "rgba(122, 16, 18, 0.07)",
  },
  errorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 18,
  },
  offerCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 11,
    marginBottom: 10,
    padding: 13,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#EEF2F2",
  },
  offerContent: {
    flex: 1,
    minWidth: 0,
  },
  offerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  senderName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "800",
  },
  offerPrice: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  offerMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 6,
  },
  offerQuantity: {
    color: COLORS.textLight,
    fontSize: 12,
  },
  offerDate: {
    flexShrink: 1,
    color: COLORS.textLight,
    fontSize: 10,
    textAlign: "right",
  },
  offerBottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    marginTop: 10,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  statusPending: {
    backgroundColor:
      "rgba(154, 100, 24, 0.10)",
  },
  statusAccepted: {
    backgroundColor:
      "rgba(47, 118, 93, 0.10)",
  },
  statusRejected: {
    backgroundColor:
      "rgba(122, 16, 18, 0.08)",
  },
  statusText: {
    color: COLORS.text,
    fontSize: 11,
    fontWeight: "700",
  },
  detailLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  detailLinkText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 54,
  },
  emptyTitle: {
    marginTop: 12,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
  },
  emptyText: {
    marginTop: 6,
    maxWidth: 300,
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
  },
});