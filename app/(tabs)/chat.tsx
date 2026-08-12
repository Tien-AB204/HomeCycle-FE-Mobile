import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
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
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import {
  InlineFeedback,
  useActionFeedback,
  useConfirmAction,
} from "../../src/components/shared/ActionFeedback";
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import {
  getApiErrorMessage,
  getApiSuccessMessage,
} from "../../src/utils/apiFeedback";

type ActiveTab =
  | "chat"
  | "received"
  | "sent";

type FeedbackTarget =
  | {
      type: "page";
    }
  | {
      type: "offer";
      offerId: string;
    }
  | {
      type: "counter";
    }
  | null;

const negotiationApi = {
  getNegotiations: (params?: {
    PageNumber?: number;
    PageSize?: number;
  }) =>
    apiClient
      .get("/negotiations", {
        params,
      })
      .then((response) => response.data),
};

const offerApi = {
  getSentOffers: (params?: {
    PageNumber?: number;
    PageSize?: number;
  }) =>
    apiClient
      .get("/offers/sent", {
        params,
      })
      .then((response) => response.data),

  getReceivedOffers: (params?: {
    PageNumber?: number;
    PageSize?: number;
  }) =>
    apiClient
      .get("/offers/received", {
        params,
      })
      .then((response) => response.data),

  acceptOffer: (offerId: string) =>
    apiClient
      .patch(`/offers/${offerId}/accept`)
      .then((response) => response.data),

  rejectOffer: (offerId: string) =>
    apiClient
      .post(`/offers/${offerId}/reject`)
      .then((response) => response.data),

  counterInitialOffer: (
    offerId: string,
    data: {
      offerPrice: number;
      offerQuantity: number;
      messageContent?: string;
    },
  ) =>
    apiClient
      .patch(
        `/offers/${offerId}/counter`,
        data,
      )
      .then((response) => response.data),
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const getRobustAvatar = (
  url: string | null | undefined,
  name: string,
) => {
  const isValid =
    url &&
    url !== "string" &&
    url !== "null" &&
    url.startsWith("http");

  if (isValid) {
    if (
      url.includes(
        "googleusercontent.com",
      )
    ) {
      return `https://wsrv.nl/?url=${encodeURIComponent(
        url,
      )}`;
    }

    return url;
  }

  return `https://ui-avatars.com/api/?name=${encodeURIComponent(
    name || "U",
  )}&background=547B7D&color=fff`;
};

const normalizeSearchText = (
  value: unknown,
) => {
  return String(value || "")
    .trim()
    .toLocaleLowerCase("vi-VN");
};

export default function ChatListScreen() {
  const router = useRouter();

  const {
    width: screenWidth,
  } = useWindowDimensions();

  const width =
    Platform.OS === "web" &&
    screenWidth > 480
      ? 480
      : screenWidth;

  const { user } = useAuth();

  const [activeTab, setActiveTab] =
    useState<ActiveTab>("chat");

  const [
    searchQuery,
    setSearchQuery,
  ] = useState("");

  const [
    offersList,
    setOffersList,
  ] = useState<any[]>([]);

  const [
    negotiationsList,
    setNegotiationsList,
  ] = useState<any[]>([]);

  const [isLoading, setIsLoading] =
    useState(false);

  const [
    isProcessingAction,
    setIsProcessingAction,
  ] = useState(false);

  const [
    showCounterModal,
    setShowCounterModal,
  ] = useState(false);

  const [
    selectedOffer,
    setSelectedOffer,
  ] = useState<any>(null);

  const [
    counterPrice,
    setCounterPrice,
  ] = useState("");

  const [
    counterQuantity,
    setCounterQuantity,
  ] = useState("");

  const [
    counterMessage,
    setCounterMessage,
  ] = useState("");

  const [
    feedbackTarget,
    setFeedbackTarget,
  ] = useState<FeedbackTarget>(null);

  const {
    feedback,
    clearFeedback,
    showError,
    showSuccess,
  } = useActionFeedback();

  const {
    confirm,
    confirmationModal,
  } = useConfirmAction();

  const currentUserId =
    user?.userId || user?.id;

  const fetchData =
    useCallback(async () => {
      if (!user) {
        setOffersList([]);
        setNegotiationsList([]);
        return;
      }

      setIsLoading(true);

      try {
        if (activeTab === "chat") {
          const response =
            await negotiationApi.getNegotiations({
              PageSize: 50,
              PageNumber: 1,
            });

          if (
            response?.isSuccess === false
          ) {
            throw response;
          }

          const items =
            response?.data?.items ||
            response?.items ||
            [];

          setNegotiationsList(
            Array.isArray(items)
              ? items
              : [],
          );

          return;
        }

        const response =
          activeTab === "received"
            ? await offerApi.getReceivedOffers(
                {
                  PageSize: 50,
                  PageNumber: 1,
                },
              )
            : await offerApi.getSentOffers({
                PageSize: 50,
                PageNumber: 1,
              });

        if (
          response?.isSuccess === false
        ) {
          throw response;
        }

        const items =
          response?.items ||
          response?.data?.items ||
          [];

        const pendingOffers = (
          Array.isArray(items)
            ? items
            : []
        )
          .filter((offer: any) => {
            return (
              offer.offerStatus ===
                "Pending" ||
              offer.offerStatus === 0
            );
          })
          .sort((first: any, second: any) => {
            return (
              new Date(
                second.createdAt,
              ).getTime() -
              new Date(
                first.createdAt,
              ).getTime()
            );
          });

        setOffersList(pendingOffers);
      } catch (error: unknown) {
        console.error(
          `Lỗi lấy dữ liệu (${activeTab}):`,
          error,
        );

        setFeedbackTarget({
          type: "page",
        });

        showError(
          getApiErrorMessage(
            error,
            "Không thể tải danh sách thương lượng.",
          ),
        );
      } finally {
        setIsLoading(false);
      }
    }, [
      activeTab,
      showError,
      user,
    ]);

  useFocusEffect(
    useCallback(() => {
      void fetchData();
    }, [fetchData]),
  );

  const filteredNegotiations =
    useMemo(() => {
      const query =
        normalizeSearchText(
          searchQuery,
        );

      if (!query) {
        return negotiationsList;
      }

      return negotiationsList.filter(
        (item) => {
          const searchableText = [
            item.otherPartyName,
            item.productName,
            item.postTitle,
            item.currentOfferPrice,
            item.currentOfferQuantity,
          ]
            .map(normalizeSearchText)
            .join(" ");

          return searchableText.includes(
            query,
          );
        },
      );
    }, [
      negotiationsList,
      searchQuery,
    ]);

  const filteredOffers = useMemo(() => {
    const query =
      normalizeSearchText(
        searchQuery,
      );

    if (!query) {
      return offersList;
    }

    return offersList.filter((item) => {
      const searchableText = [
        item.senderName,
        item.receiverName,
        item.productName,
        item.postTitle,
        item.offerPrice,
        item.offerQuantity,
      ]
        .map(normalizeSearchText)
        .join(" ");

      return searchableText.includes(
        query,
      );
    });
  }, [
    offersList,
    searchQuery,
  ]);

  const clearCurrentFeedback = () => {
    clearFeedback();
    setFeedbackTarget(null);
  };

  const handleChangeTab = (
    nextTab: ActiveTab,
  ) => {
    clearCurrentFeedback();
    setSearchQuery("");
    setActiveTab(nextTab);
  };

  const handleAcceptOffer = async (
    offerId: string,
  ) => {
    const confirmed = await confirm({
      title: "Chấp nhận thương lượng",
      message:
        "Bạn đồng ý mở phiên thương lượng với mức giá này?",
      confirmLabel: "Đồng ý",
      cancelLabel: "Quay lại",
    });

    if (!confirmed) {
      return;
    }

    clearFeedback();

    setFeedbackTarget({
      type: "offer",
      offerId,
    });

    try {
      setIsProcessingAction(true);

      const response =
        await offerApi.acceptOffer(
          offerId,
        );

      if (
        response?.isSuccess === false
      ) {
        throw response;
      }

      showSuccess(
        getApiSuccessMessage(
          response,
          "Đã chấp nhận thương lượng. Phòng chat đã được mở.",
        ),
      );

      /*
       * Giữ message ngay dưới nút trong một khoảng ngắn
       * trước khi offer biến khỏi danh sách Pending.
       */
      await wait(1200);

      clearCurrentFeedback();

      await fetchData();
    } catch (error: unknown) {
      showError(
        getApiErrorMessage(
          error,
          "Không thể chấp nhận thương lượng.",
        ),
      );
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleRejectOffer = async (
    offerId: string,
  ) => {
    const confirmed = await confirm({
      title: "Từ chối đề nghị",
      message:
        "Bạn có chắc muốn từ chối đề nghị này?",
      confirmLabel: "Từ chối",
      cancelLabel: "Quay lại",
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    clearFeedback();

    setFeedbackTarget({
      type: "offer",
      offerId,
    });

    try {
      setIsProcessingAction(true);

      const response =
        await offerApi.rejectOffer(
          offerId,
        );

      if (
        response?.isSuccess === false
      ) {
        throw response;
      }

      showSuccess(
        getApiSuccessMessage(
          response,
          "Đã từ chối đề nghị.",
        ),
      );

      await wait(1200);

      clearCurrentFeedback();

      await fetchData();
    } catch (error: unknown) {
      showError(
        getApiErrorMessage(
          error,
          "Không thể từ chối đề nghị.",
        ),
      );
    } finally {
      setIsProcessingAction(false);
    }
  };

  const handleOpenCounterModal = (
    offer: any,
  ) => {
    clearCurrentFeedback();

    setSelectedOffer(offer);

    setCounterPrice(
      offer.offerPrice?.toString() || "",
    );

    setCounterQuantity(
      offer.offerQuantity?.toString() ||
        "1",
    );

    setCounterMessage(
      "Chào bạn, tôi muốn đề xuất mức giá mới này.",
    );

    setShowCounterModal(true);
  };

  const handleCloseCounterModal = () => {
    if (isProcessingAction) {
      return;
    }

    clearCurrentFeedback();
    setShowCounterModal(false);
    setSelectedOffer(null);
  };

  const handleSubmitCounter =
    async () => {
      if (!selectedOffer) {
        return;
      }

      clearFeedback();

      setFeedbackTarget({
        type: "counter",
      });

      const price = Number(
        counterPrice.trim(),
      );

      const quantity = Number(
        counterQuantity.trim(),
      );

      if (
        !Number.isFinite(price) ||
        price <= 0 ||
        !Number.isInteger(quantity) ||
        quantity <= 0
      ) {
        showError(
          "Vui lòng nhập giá và số lượng hợp lệ.",
        );
        return;
      }

      try {
        setIsProcessingAction(true);

        const response =
          await offerApi.counterInitialOffer(
            selectedOffer.offerId,
            {
              offerPrice: price,
              offerQuantity: quantity,
              messageContent:
                counterMessage.trim() ||
                undefined,
            },
          );

        if (
          response?.isSuccess === false
        ) {
          throw response;
        }

        showSuccess(
          getApiSuccessMessage(
            response,
            "Đã gửi đề xuất giá mới thành công.",
          ),
        );

        await wait(1200);

        clearCurrentFeedback();
        setShowCounterModal(false);
        setSelectedOffer(null);

        await fetchData();
      } catch (error: unknown) {
        showError(
          getApiErrorMessage(
            error,
            "Không thể gửi đề xuất.",
          ),
        );
      } finally {
        setIsProcessingAction(false);
      }
    };

  const renderNegotiationItem = ({
    item,
  }: {
    item: any;
  }) => {
    const rawTime =
      item.lastMessageAt ||
      item.createdAt;

    const timeString = rawTime
      ? new Date(
          rawTime,
        ).toLocaleString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
        })
      : "";

    const partnerName =
      item.otherPartyName ||
      "Đối tác";

    const avatarUri =
      getRobustAvatar(
        item.otherPartyAvatarUrl,
        partnerName,
      );

    const unreadCount = Number(
      item.unreadCount || 0,
    );

    return (
      <TouchableOpacity
        style={styles.offerCard}
        onPress={() => {
          router.push(
            `/chat/${item.negotiationId}` as any,
          );
        }}
      >
        <View
          style={
            styles.negotiationRow
          }
        >
          <Image
            source={{ uri: avatarUri }}
            style={
              styles.negotiationAvatar
            }
          />

          <View style={styles.flex}>
            <View
              style={
                styles.negotiationHeader
              }
            >
              <Text
                style={styles.offerName}
                numberOfLines={1}
              >
                {partnerName}
              </Text>

              <Text
                style={styles.offerTime}
              >
                {timeString}
              </Text>
            </View>

            <View
              style={
                styles.negotiationPreviewRow
              }
            >
              <Text
                style={
                  styles.negotiationPrice
                }
                numberOfLines={1}
              >
                Mức giá:{" "}
                <Text
                  style={
                    styles.negotiationPriceValue
                  }
                >
                  {Number(
                    item.currentOfferPrice ||
                      0,
                  ).toLocaleString(
                    "vi-VN",
                  )}{" "}
                  đ
                </Text>{" "}
                (x
                {item.currentOfferQuantity ||
                  0}
                )
              </Text>

              {unreadCount > 0 ? (
                <View
                  style={
                    styles.unreadBadge
                  }
                >
                  <Text
                    style={
                      styles.unreadBadgeText
                    }
                  >
                    {unreadCount > 99
                      ? "99+"
                      : unreadCount}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderOfferItem = ({
    item,
  }: {
    item: any;
  }) => {
    const isMySentOffer =
      item.senderId === currentUserId;

    const partnerName =
      (isMySentOffer
        ? item.receiverName
        : item.senderName) ||
      "Đối tác";

    const partnerAvatarUrl =
      isMySentOffer
        ? item.receiverAvatarUrl
        : item.senderAvatarUrl;

    const avatarUri =
      getRobustAvatar(
        partnerAvatarUrl,
        partnerName,
      );

    const timeString = item.createdAt
      ? new Date(
          item.createdAt,
        ).toLocaleString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "";

    const showOfferFeedback =
      feedbackTarget?.type ===
        "offer" &&
      feedbackTarget.offerId ===
        item.offerId;

    return (
      <View style={styles.offerCard}>
        <View style={styles.offerHeader}>
          <Image
            source={{ uri: avatarUri }}
            style={styles.offerAvatar}
          />

          <View style={styles.flex}>
            <Text style={styles.offerName}>
              {isMySentOffer
                ? `Bạn đã gửi cho ${partnerName}`
                : `${partnerName} đã gửi đề nghị`}
            </Text>

            <Text style={styles.offerTime}>
              {timeString}
            </Text>
          </View>
        </View>

        <View style={styles.offerDetails}>
          <Text
            style={styles.offerProduct}
            numberOfLines={1}
          >
            {item.productName ||
              item.postTitle ||
              "Sản phẩm"}
          </Text>

          <Text style={styles.offerPrice}>
            Giá thương lượng:{" "}
            {Number(
              item.offerPrice || 0,
            ).toLocaleString("vi-VN")}{" "}
            đ
          </Text>

          <Text style={styles.offerPrice}>
            Số lượng:{" "}
            {item.offerQuantity || 0}
          </Text>
        </View>

        {!isMySentOffer ? (
          <View style={styles.actionArea}>
            <View
              style={styles.actionRow}
            >
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => {
                  void handleRejectOffer(
                    item.offerId,
                  );
                }}
                disabled={
                  isProcessingAction
                }
              >
                <Text
                  style={
                    styles.rejectBtnText
                  }
                >
                  Từ chối
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => {
                  void handleAcceptOffer(
                    item.offerId,
                  );
                }}
                disabled={
                  isProcessingAction
                }
              >
                <Text
                  style={
                    styles.acceptBtnText
                  }
                >
                  Đồng ý
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={
                styles.counterBtnOutline
              }
              onPress={() =>
                handleOpenCounterModal(
                  item,
                )
              }
              disabled={
                isProcessingAction
              }
            >
              <Text
                style={
                  styles.counterBtnText
                }
              >
                Đề xuất giá mới
              </Text>
            </TouchableOpacity>

            {showOfferFeedback ? (
              <InlineFeedback
                feedback={feedback}
                onDismiss={
                  clearCurrentFeedback
                }
                style={
                  styles.actionFeedback
                }
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.actionArea}>
            <TouchableOpacity
              style={styles.fullActionButton}
              onPress={() => {
                router.push(
                  `/posts/${item.postId}` as any,
                );
              }}
            >
              <Text
                style={
                  styles.rejectBtnText
                }
              >
                Xem lại bài đăng
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const pageFeedback =
    feedbackTarget?.type === "page"
      ? feedback
      : null;

  const counterFeedback =
    feedbackTarget?.type === "counter"
      ? feedback
      : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View
        style={[
          styles.mobileWrapper,
          {
            width,
          },
        ]}
      >
        <MainHeader
          title="Tin nhắn"
          showBack={false}
        />

        <View
          style={styles.searchContainer}
        >
          <View style={styles.searchBox}>
            <Ionicons
              name="search"
              size={20}
              color={COLORS.textLight}
              style={styles.searchIcon}
            />

            <TextInput
              style={[
                styles.searchInput,
                Platform.OS === "web"
                  ? ({
                      outlineStyle:
                        "none",
                    } as any)
                  : undefined,
              ]}
              placeholder="Tìm kiếm đoạn chat..."
              placeholderTextColor={
                COLORS.textLight
              }
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "chat"
                ? styles.tabBtnActive
                : undefined,
            ]}
            onPress={() =>
              handleChangeTab("chat")
            }
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "chat"
                  ? styles.tabTextActive
                  : undefined,
              ]}
            >
              Đoạn chat
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "received"
                ? styles.tabBtnActive
                : undefined,
            ]}
            onPress={() =>
              handleChangeTab(
                "received",
              )
            }
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "received"
                  ? styles.tabTextActive
                  : undefined,
              ]}
            >
              Yêu cầu mới
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "sent"
                ? styles.tabBtnActive
                : undefined,
            ]}
            onPress={() =>
              handleChangeTab("sent")
            }
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "sent"
                  ? styles.tabTextActive
                  : undefined,
              ]}
            >
              Đã gửi
            </Text>
          </TouchableOpacity>
        </View>

        {pageFeedback ? (
          <InlineFeedback
            feedback={pageFeedback}
            onDismiss={
              clearCurrentFeedback
            }
            style={styles.pageFeedback}
          />
        ) : null}

        <View style={styles.contentArea}>
          {isLoading ? (
            <View
              style={styles.loadingContainer}
            >
              <ActivityIndicator
                size="large"
                color={COLORS.primary}
              />

              <Text
                style={styles.loadingText}
              >
                Đang tải dữ liệu...
              </Text>
            </View>
          ) : activeTab === "chat" ? (
            <FlatList
              data={
                filteredNegotiations
              }
              keyExtractor={(item) =>
                item.negotiationId
              }
              renderItem={
                renderNegotiationItem
              }
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.listContent
              }
              ListEmptyComponent={
                <Text
                  style={
                    styles.emptyListText
                  }
                >
                  {searchQuery.trim()
                    ? "Không tìm thấy cuộc trò chuyện phù hợp."
                    : "Chưa có cuộc trò chuyện nào đang diễn ra."}
                </Text>
              }
            />
          ) : (
            <FlatList
              data={filteredOffers}
              keyExtractor={(item) =>
                item.offerId
              }
              renderItem={
                renderOfferItem
              }
              showsVerticalScrollIndicator={
                false
              }
              contentContainerStyle={
                styles.listContent
              }
              ListEmptyComponent={
                <Text
                  style={
                    styles.emptyListText
                  }
                >
                  {searchQuery.trim()
                    ? "Không tìm thấy yêu cầu thương lượng phù hợp."
                    : "Bạn chưa có yêu cầu thương lượng nào."}
                </Text>
              }
            />
          )}
        </View>

        <Modal
          visible={showCounterModal}
          transparent
          animationType="slide"
          onRequestClose={
            handleCloseCounterModal
          }
        >
          <KeyboardAvoidingView
            behavior={
              Platform.OS === "ios"
                ? "padding"
                : "height"
            }
            style={styles.modalOverlay}
          >
            <View
              style={styles.modalContent}
            >
              <View
                style={styles.modalHeader}
              >
                <Text
                  style={styles.modalTitle}
                >
                  Đề xuất giá mới
                </Text>

                <TouchableOpacity
                  onPress={
                    handleCloseCounterModal
                  }
                  disabled={
                    isProcessingAction
                  }
                  style={
                    styles.modalCloseButton
                  }
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={COLORS.text}
                  />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View
                  style={styles.inputGroup}
                >
                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Giá đề xuất (VNĐ){" "}
                    <Text
                      style={
                        styles.requiredMark
                      }
                    >
                      *
                    </Text>
                  </Text>

                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web"
                        ? ({
                            outlineStyle:
                              "none",
                          } as any)
                        : undefined,
                    ]}
                    keyboardType="numeric"
                    value={counterPrice}
                    onChangeText={
                      setCounterPrice
                    }
                    editable={
                      !isProcessingAction
                    }
                  />
                </View>

                <View
                  style={styles.inputGroup}
                >
                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Số lượng{" "}
                    <Text
                      style={
                        styles.requiredMark
                      }
                    >
                      *
                    </Text>
                  </Text>

                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web"
                        ? ({
                            outlineStyle:
                              "none",
                          } as any)
                        : undefined,
                    ]}
                    keyboardType="numeric"
                    value={counterQuantity}
                    onChangeText={
                      setCounterQuantity
                    }
                    editable={
                      !isProcessingAction
                    }
                  />
                </View>

                <View
                  style={styles.inputGroup}
                >
                  <Text
                    style={
                      styles.inputLabel
                    }
                  >
                    Lời nhắn cho khách hàng
                  </Text>

                  <TextInput
                    style={[
                      styles.input,
                      styles.messageInput,
                      Platform.OS === "web"
                        ? ({
                            outlineStyle:
                              "none",
                          } as any)
                        : undefined,
                    ]}
                    multiline
                    value={counterMessage}
                    onChangeText={
                      setCounterMessage
                    }
                    placeholder="Nhập lời nhắn..."
                    placeholderTextColor={
                      COLORS.textLight
                    }
                    editable={
                      !isProcessingAction
                    }
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    isProcessingAction
                      ? styles.disabledButton
                      : undefined,
                  ]}
                  onPress={() => {
                    void handleSubmitCounter();
                  }}
                  disabled={
                    isProcessingAction
                  }
                >
                  {isProcessingAction ? (
                    <ActivityIndicator
                      color={COLORS.white}
                    />
                  ) : (
                    <Text
                      style={
                        styles.primaryBtnText
                      }
                    >
                      Gửi đề xuất
                    </Text>
                  )}
                </TouchableOpacity>

                {counterFeedback ? (
                  <InlineFeedback
                    feedback={
                      counterFeedback
                    }
                    onDismiss={
                      clearCurrentFeedback
                    }
                    style={
                      styles.counterFeedback
                    }
                  />
                ) : null}
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>

        {confirmationModal}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },

  safeArea: {
    flex: 1,
    backgroundColor: COLORS.border,
    alignItems: "center",
  },

  mobileWrapper: {
    flex: 1,
    backgroundColor: COLORS.background,

    ...(Platform.OS === "web"
      ? ({
          boxShadow:
            "0px 0px 20px rgba(0,0,0,0.1)",
        } as any)
      : {}),
  },

  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    height: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: "#F8FAFC",
  },

  searchIcon: {
    marginRight: 8,
  },

  searchInput: {
    flex: 1,
    height: "100%",
    color: COLORS.text,
    fontSize: 15,
  },

  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    padding: 4,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },

  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 8,
    borderRadius: 6,
  },

  tabBtnActive: {
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },

  tabText: {
    color: COLORS.textLight,
    fontSize: 13,
    fontWeight: "600",
  },

  tabTextActive: {
    color: COLORS.primary,
  },

  contentArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  pageFeedback: {
    marginHorizontal: 16,
    marginBottom: 8,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 10,
    color: COLORS.textLight,
    fontSize: 13,
  },

  listContent: {
    padding: 16,
    gap: 12,
    paddingBottom: 40,
  },

  emptyListText: {
    marginTop: 40,
    color: COLORS.textLight,
    textAlign: "center",
  },

  offerCard: {
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  negotiationRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  negotiationAvatar: {
    width: 44,
    height: 44,
    marginRight: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  negotiationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },

  negotiationPreviewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  negotiationPrice: {
    flex: 1,
    color: COLORS.textLight,
    fontSize: 13,
  },

  negotiationPriceValue: {
    color: COLORS.primary,
    fontWeight: "bold",
  },

  unreadBadge: {
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: COLORS.error,
  },

  unreadBadgeText: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "800",
  },

  offerHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },

  offerAvatar: {
    width: 40,
    height: 40,
    marginRight: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },

  offerName: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "bold",
  },

  offerTime: {
    marginTop: 2,
    color: COLORS.textLight,
    fontSize: 12,
  },

  offerDetails: {
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },

  offerProduct: {
    marginBottom: 4,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },

  offerPrice: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "bold",
  },

  actionArea: {
    gap: 8,
  },

  actionRow: {
    flexDirection: "row",
    gap: 12,
  },

  rejectBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F1F5F9",
  },

  rejectBtnText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },

  acceptBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },

  acceptBtnText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "600",
  },

  counterBtnOutline: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },

  counterBtnText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "bold",
  },

  fullActionButton: {
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F1F5F9",
  },

  actionFeedback: {
    marginTop: 2,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },

  modalContent: {
    padding: 24,
    paddingBottom:
      Platform.OS === "ios" ? 40 : 24,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: COLORS.white,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },

  modalTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "bold",
  },

  modalCloseButton: {
    padding: 4,
  },

  modalBody: {
    gap: 16,
  },

  inputGroup: {
    gap: 8,
  },

  inputLabel: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },

  requiredMark: {
    color: COLORS.error,
  },

  input: {
    height: 50,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    color: COLORS.text,
    fontSize: 15,
    backgroundColor: "#F8FAFC",
  },

  messageInput: {
    height: 80,
    paddingTop: 12,
    textAlignVertical: "top",
  },

  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },

  primaryBtnText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "bold",
  },

  disabledButton: {
    opacity: 0.7,
  },

  counterFeedback: {
    marginTop: -4,
  },
});