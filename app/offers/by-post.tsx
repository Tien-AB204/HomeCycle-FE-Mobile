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
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
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

  getOfferById: (offerId: string) =>
    apiClient
      .get(`/offers/${offerId}`)
      .then((response) => response.data),

  acceptOffer: (
    offerId: string,
    version: number,
  ) =>
    apiClient
      .patch(`/offers/${offerId}/accept`, {
        version,
      })
      .then((response) => response.data),

  rejectOffer: (offerId: string) =>
    apiClient
      .post(`/offers/${offerId}/reject`)
      .then((response) => response.data),

  counterOffer: (
    offerId: string,
    data: {
      offerPrice: number;
      offerQuantity: number;
      version: number;
    },
  ) =>
    apiClient
      .patch(`/offers/${offerId}/counter`, data)
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

const isPendingOffer = (value: unknown) => {
  const status = normalizeStatus(value);

  return status === "0" || status === "pending";
};

const getOfferErrorCode = (error: any) =>
  String(
    error?.response?.data?.error?.code ??
      error?.response?.data?.code ??
      error?.error?.code ??
      error?.code ??
      "",
  )
    .trim()
    .toUpperCase();

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

  const [actionMode, setActionMode] =
    useState<
      "accept" | "reject" | "counter" | null
    >(null);

  const [selectedOffer, setSelectedOffer] =
    useState<any>(null);

  const [counterPrice, setCounterPrice] =
    useState("");

  const [counterQuantity, setCounterQuantity] =
    useState("");

  const [isProcessingAction, setIsProcessingAction] =
    useState(false);

  const [actionFeedback, setActionFeedback] =
    useState<{
      type: "success" | "error";
      text: string;
    } | null>(null);

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

  const closeOfferAction = () => {
    if (isProcessingAction) return;

    setActionMode(null);
    setSelectedOffer(null);
    setCounterPrice("");
    setCounterQuantity("");
    setActionFeedback(null);
  };

  const handleOpenOfferAction = async (
    mode: "accept" | "reject" | "counter",
    listOffer: ReceivedOfferItem,
  ) => {
    const offerId = String(
      listOffer.offerId ?? "",
    ).trim();

    if (!offerId) {
      setActionFeedback({
        type: "error",
        text: "Không xác định được đề nghị.",
      });
      return;
    }

    if (!isPendingOffer(listOffer.offerStatus)) {
      setActionFeedback({
        type: "error",
        text: "Đề nghị này không còn ở trạng thái chờ phản hồi.",
      });
      await loadOffers(true);
      return;
    }

    try {
      setIsProcessingAction(true);
      setActionFeedback(null);

      const response =
        await offerApi.getOfferById(offerId);

      const detail = unwrapPage(response);

      const currentStatus =
        detail?.offerStatus ??
        detail?.OfferStatus ??
        listOffer.offerStatus;

      if (!isPendingOffer(currentStatus)) {
        await loadOffers(true);

        setActionFeedback({
          type: "error",
          text: "Đề nghị vừa thay đổi trạng thái. Danh sách đã được làm mới.",
        });
        return;
      }

      const canAccept =
        detail?.canAccept ??
        detail?.CanAccept;

      const canReject =
        detail?.canReject ??
        detail?.CanReject;

      if (
        mode === "accept" &&
        canAccept !== true
      ) {
        await loadOffers(true);

        setActionFeedback({
          type: "error",
          text: "Đề nghị này hiện không thể được chấp nhận.",
        });
        return;
      }

      if (
        mode === "reject" &&
        canReject !== true
      ) {
        await loadOffers(true);

        setActionFeedback({
          type: "error",
          text: "Đề nghị này hiện không thể bị từ chối.",
        });
        return;
      }

      const hydratedOffer = {
        ...listOffer,
        ...detail,
        offerId:
          detail?.offerId ??
          detail?.OfferId ??
          offerId,
        offerStatus: currentStatus,
        version:
          detail?.version ??
          detail?.Version ??
          listOffer.version,
      };

      setSelectedOffer(hydratedOffer);

      if (mode === "counter") {
        setCounterPrice(
          String(
            hydratedOffer.offerPrice ??
              hydratedOffer.OfferPrice ??
              "",
          ),
        );

        setCounterQuantity(
          String(
            hydratedOffer.offerQuantity ??
              hydratedOffer.OfferQuantity ??
              1,
          ),
        );
      }

      setActionMode(mode);
    } catch (error) {
      setActionFeedback({
        type: "error",
        text: getApiErrorMessage(
          error,
          "Không thể tải trạng thái mới nhất của đề nghị.",
        ),
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleSubmitOfferAction = async () => {
    if (!selectedOffer || !actionMode) {
      return;
    }

    const offerId = String(
      selectedOffer.offerId ??
        selectedOffer.OfferId ??
        "",
    ).trim();

    const version = Number(
      selectedOffer.version ??
        selectedOffer.Version,
    );

    if (!offerId) {
      setActionFeedback({
        type: "error",
        text: "Không xác định được đề nghị.",
      });
      return;
    }

    if (
      (actionMode === "accept" ||
        actionMode === "counter") &&
      (
        !Number.isInteger(version) ||
        version < 0
      )
    ) {
      setActionMode(null);
      setSelectedOffer(null);

      await loadOffers(true);

      setActionFeedback({
        type: "error",
        text: "Không xác định được phiên bản hiện tại của đề nghị. Danh sách đã được làm mới.",
      });
      return;
    }

    const price = Number(
      counterPrice.trim(),
    );

    const quantity = Number(
      counterQuantity.trim(),
    );

    if (
      actionMode === "counter" &&
      (
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      )
    ) {
      setActionFeedback({
        type: "error",
        text: "Vui lòng nhập giá và số lượng hợp lệ.",
      });
      return;
    }

    try {
      setIsProcessingAction(true);
      setActionFeedback(null);

      let response: any;

      if (actionMode === "accept") {
        response =
          await offerApi.acceptOffer(
            offerId,
            version,
          );
      } else if (actionMode === "reject") {
        response =
          await offerApi.rejectOffer(
            offerId,
          );
      } else {
        response =
          await offerApi.counterOffer(
            offerId,
            {
              offerPrice: price,
              offerQuantity: quantity,
              version,
            },
          );
      }

      if (response?.isSuccess === false) {
        throw response;
      }

      const completedMode = actionMode;

      setActionMode(null);
      setSelectedOffer(null);
      setCounterPrice("");
      setCounterQuantity("");

      await loadOffers(true);

      setActionFeedback({
        type: "success",
        text:
          completedMode === "accept"
            ? "Đã chấp nhận thương lượng. Phòng chat đã được mở."
            : completedMode === "reject"
              ? "Đã từ chối đề nghị."
              : "Đã gửi đề xuất giá mới.",
      });
    } catch (error) {
      const code =
        getOfferErrorCode(error);

      setActionMode(null);
      setSelectedOffer(null);
      setCounterPrice("");
      setCounterQuantity("");

      await loadOffers(true);

      if (
        code === "OFFER_TERMS_CHANGED"
      ) {
        setActionFeedback({
          type: "error",
          text: "Đề nghị vừa được cập nhật. Danh sách đã được làm mới, vui lòng xem lại trước khi thao tác.",
        });
        return;
      }

      setActionFeedback({
        type: "error",
        text: getApiErrorMessage(
          error,
          "Không thể xử lý đề nghị lúc này.",
        ),
      });
    } finally {
      setIsProcessingAction(false);
    }
  };

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

            {actionFeedback && !actionMode ? (
              <View
                style={[
                  styles.actionFeedbackBox,
                  actionFeedback.type === "error"
                    ? styles.actionFeedbackError
                    : styles.actionFeedbackSuccess,
                ]}
              >
                <Ionicons
                  name={
                    actionFeedback.type === "error"
                      ? "alert-circle-outline"
                      : "checkmark-circle-outline"
                  }
                  size={19}
                  color={
                    actionFeedback.type === "error"
                      ? COLORS.error
                      : COLORS.success
                  }
                />

                <Text
                  style={[
                    styles.actionFeedbackText,
                    {
                      color:
                        actionFeedback.type === "error"
                          ? COLORS.error
                          : COLORS.success,
                    },
                  ]}
                >
                  {actionFeedback.text}
                </Text>
              </View>
            ) : null}

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

                {isPendingOffer(
                  item.offerStatus,
                ) ? (
                  <View style={styles.offerActionRow}>
                    <TouchableOpacity
                      style={styles.rejectActionButton}
                      disabled={isProcessingAction}
                      onPress={(event) => {
                        event.stopPropagation();
                        void handleOpenOfferAction(
                          "reject",
                          item,
                        );
                      }}
                    >
                      <Text style={styles.rejectActionText}>
                        Từ chối
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.counterActionButton}
                      disabled={isProcessingAction}
                      onPress={(event) => {
                        event.stopPropagation();
                        void handleOpenOfferAction(
                          "counter",
                          item,
                        );
                      }}
                    >
                      <Text style={styles.counterActionText}>
                        Trao đổi
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.acceptActionButton}
                      disabled={isProcessingAction}
                      onPress={(event) => {
                        event.stopPropagation();
                        void handleOpenOfferAction(
                          "accept",
                          item,
                        );
                      }}
                    >
                      <Text style={styles.acceptActionText}>
                        Đồng ý
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
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

      <Modal
        visible={actionMode !== null}
        transparent
        animationType="fade"
        onRequestClose={closeOfferAction}
      >
        <ModalBackdrop
          style={styles.modalBackdrop}
          disabled={isProcessingAction}
          onPress={closeOfferAction}
        >
          <KeyboardAvoidingView
            style={styles.modalKeyboard}
            behavior={
              Platform.OS === "ios"
                ? "padding"
                : "height"
            }
          >
            <ModalSurface style={styles.actionModal}>
              <View style={styles.actionModalHeader}>
                <Text style={styles.actionModalTitle}>
                  {actionMode === "accept"
                    ? "Đồng ý đề nghị"
                    : actionMode === "reject"
                      ? "Từ chối đề nghị"
                      : "Trao đổi đề nghị"}
                </Text>

                <TouchableOpacity
                  disabled={isProcessingAction}
                  onPress={closeOfferAction}
                >
                  <Ionicons
                    name="close"
                    size={23}
                    color={COLORS.text}
                  />
                </TouchableOpacity>
              </View>

              {actionMode === "counter" ? (
                <>
                  <Text style={styles.actionInputLabel}>
                    Giá đề xuất mới (VNĐ)
                  </Text>

                  <TextInput
                    style={styles.actionInput}
                    value={counterPrice}
                    keyboardType="number-pad"
                    editable={!isProcessingAction}
                    onChangeText={(value) => {
                      setCounterPrice(
                        value.replace(
                          /[^0-9]/g,
                          "",
                        ),
                      );
                      setActionFeedback(null);
                    }}
                    placeholder="Nhập giá mới"
                    placeholderTextColor={
                      COLORS.textLight
                    }
                  />

                  <Text style={styles.actionInputLabel}>
                    Số lượng
                  </Text>

                  <TextInput
                    style={styles.actionInput}
                    value={counterQuantity}
                    keyboardType="number-pad"
                    editable={!isProcessingAction}
                    onChangeText={(value) => {
                      setCounterQuantity(
                        value.replace(
                          /[^0-9]/g,
                          "",
                        ),
                      );
                      setActionFeedback(null);
                    }}
                    placeholder="Nhập số lượng"
                    placeholderTextColor={
                      COLORS.textLight
                    }
                  />
                </>
              ) : (
                <Text style={styles.actionModalMessage}>
                  {actionMode === "accept"
                    ? "Bạn có muốn đồng ý với đề nghị này và mở phiên thương lượng?"
                    : "Bạn có chắc muốn từ chối đề nghị này?"}
                </Text>
              )}

              {actionFeedback?.type === "error" ? (
                <Text style={styles.actionModalError}>
                  {actionFeedback.text}
                </Text>
              ) : null}

              <View style={styles.actionModalButtons}>
                <TouchableOpacity
                  style={styles.actionCancelButton}
                  disabled={isProcessingAction}
                  onPress={closeOfferAction}
                >
                  <Text style={styles.actionCancelText}>
                    Quay lại
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.actionSubmitButton,
                    actionMode === "reject"
                      ? styles.actionRejectSubmitButton
                      : undefined,
                  ]}
                  disabled={isProcessingAction}
                  onPress={() =>
                    void handleSubmitOfferAction()
                  }
                >
                  {isProcessingAction ? (
                    <ActivityIndicator
                      size="small"
                      color={COLORS.white}
                    />
                  ) : (
                    <Text style={styles.actionSubmitText}>
                      {actionMode === "accept"
                        ? "Đồng ý"
                        : actionMode === "reject"
                          ? "Từ chối"
                          : "Gửi đề xuất"}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>
            </ModalSurface>
          </KeyboardAvoidingView>
        </ModalBackdrop>
      </Modal>
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
  actionFeedbackBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    padding: 11,
    borderWidth: 1,
    borderRadius: 9,
  },
  actionFeedbackError: {
    borderColor:
      "rgba(122, 16, 18, 0.22)",
    backgroundColor:
      "rgba(122, 16, 18, 0.07)",
  },
  actionFeedbackSuccess: {
    borderColor:
      "rgba(47, 118, 93, 0.24)",
    backgroundColor:
      "rgba(47, 118, 93, 0.08)",
  },
  actionFeedbackText: {
    flex: 1,
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
  offerActionRow: {
    flexDirection: "row",
    gap: 7,
    marginTop: 12,
  },
  rejectActionButton: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.error,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },
  rejectActionText: {
    color: COLORS.error,
    fontSize: 11,
    fontWeight: "700",
  },
  counterActionButton: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },
  counterActionText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  acceptActionButton: {
    flex: 1,
    minHeight: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  acceptActionText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "700",
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalKeyboard: {
    width: "100%",
    alignItems: "center",
  },
  actionModal: {
    width: "100%",
    maxWidth: 420,
    padding: 18,
    borderRadius: 14,
    backgroundColor: COLORS.white,
  },
  actionModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  actionModalTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
  },
  actionModalMessage: {
    marginTop: 12,
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 19,
  },
  actionInputLabel: {
    marginTop: 15,
    marginBottom: 7,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  actionInput: {
    minHeight: 46,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  actionModalError: {
    marginTop: 12,
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 18,
  },
  actionModalButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  actionCancelButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 9,
  },
  actionCancelText: {
    color: COLORS.text,
    fontWeight: "700",
  },
  actionSubmitButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: COLORS.primary,
  },
  actionRejectSubmitButton: {
    backgroundColor: COLORS.error,
  },
  actionSubmitText: {
    color: COLORS.white,
    fontWeight: "800",
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