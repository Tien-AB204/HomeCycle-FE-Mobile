import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useRouter,
} from "expo-router";
import {
  useCallback,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
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

type PostTab =
  | "active"
  | "closed";

type FeedbackTarget =
  | {
      type: "page";
    }
  | {
      type: "post";
      postId: string;
    }
  | null;

const PAGE_SIZE = 10;

const postApi = {
  getPostsByUser: (
    userId: string,
    params?: {
      PageNumber?: number;
      PageSize?: number;
    },
  ) =>
    apiClient
      .get(
        `/posts/get-all/by-user/${userId}`,
        {
          params,
        },
      )
      .then((response) => response.data),

  closePost: (postId: string) =>
    apiClient
      .patch(`/posts/${postId}/close`)
      .then((response) => response.data),

  reactivatePost: (postId: string) =>
    apiClient
      .patch(
        `/posts/${postId}/reactivate`,
      )
      .then((response) => response.data),
};

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });

export default function PostsScreen() {
  const router = useRouter();

  const { width } =
    useWindowDimensions();

  const isWeb =
    Platform.OS === "web" &&
    width > 480;

  const { user } = useAuth();

  const userRole =
    user?.role?.toLowerCase() ||
    "personal";

  const currentUserId =
    user?.userId || user?.id;

  const [
    activeTab,
    setActiveTab,
  ] = useState<PostTab>("active");

  const [posts, setPosts] =
    useState<any[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
  ] = useState(false);

  const [
    processingPostId,
    setProcessingPostId,
  ] = useState<string | null>(null);

  const [
    feedbackTarget,
    setFeedbackTarget,
  ] = useState<FeedbackTarget>(null);

  const [
    pageNumber,
    setPageNumber,
  ] = useState(1);

  const [hasMore, setHasMore] =
    useState(true);

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

  const fetchPosts = useCallback(
    async (
      page = 1,
      isRefresh = false,
    ) => {
      if (!currentUserId) {
        setPosts([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      try {
        if (
          page === 1 &&
          !isRefresh
        ) {
          setIsLoading(true);
        }

        const response =
          await postApi.getPostsByUser(
            currentUserId,
            {
              PageNumber: page,
              PageSize: PAGE_SIZE,
            },
          );

        if (
          response?.isSuccess === false
        ) {
          throw response;
        }

        const rawData =
          response?.items ||
          response?.data?.items ||
          response?.data ||
          [];

        const data =
          Array.isArray(rawData)
            ? rawData
            : [];

        if (
          isRefresh ||
          page === 1
        ) {
          setPosts(data);
        } else {
          setPosts((previous) => {
            const existingIds =
              new Set(
                previous.map(
                  (post) =>
                    post.postId,
                ),
              );

            const newItems =
              data.filter(
                (post) =>
                  !existingIds.has(
                    post.postId,
                  ),
              );

            return [
              ...previous,
              ...newItems,
            ];
          });
        }

        setHasMore(
          data.length === PAGE_SIZE,
        );
      } catch (error: unknown) {
        console.error(
          "Lỗi lấy danh sách bài đăng:",
          error,
        );

        setFeedbackTarget({
          type: "page",
        });

        showError(
          getApiErrorMessage(
            error,
            "Không thể tải danh sách bài đăng.",
          ),
        );
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      currentUserId,
      showError,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      if (!currentUserId) {
        setPosts([]);
        setIsLoading(false);
        return;
      }

      setPageNumber(1);

      void fetchPosts(1, false);
    }, [
      currentUserId,
      fetchPosts,
    ]),
  );

  const dismissFeedback = () => {
    clearFeedback();
    setFeedbackTarget(null);
  };

  const handleChangeTab = (
    nextTab: PostTab,
  ) => {
    dismissFeedback();
    setActiveTab(nextTab);
  };

  const onRefresh = async () => {
    dismissFeedback();
    setIsRefreshing(true);
    setPageNumber(1);

    await fetchPosts(1, true);
  };

  const loadMore = () => {
    if (
      isLoading ||
      isRefreshing ||
      !hasMore
    ) {
      return;
    }

    const nextPage =
      pageNumber + 1;

    setPageNumber(nextPage);

    void fetchPosts(nextPage);
  };

  const handleClosePost = async (
    postId: string,
  ) => {
    const accepted = await confirm({
      title: "Đóng bài đăng",
      message:
        "Bài đăng sẽ kết thúc giao dịch và không còn hiển thị công khai. Bạn có chắc muốn tiếp tục?",
      confirmLabel: "Đóng bài",
      cancelLabel: "Giữ bài",
      destructive: true,
    });

    if (!accepted) {
      return;
    }

    clearFeedback();

    setFeedbackTarget({
      type: "post",
      postId,
    });

    try {
      setProcessingPostId(postId);

      const response =
        await postApi.closePost(postId);

      if (
        response?.isSuccess === false
      ) {
        throw response;
      }

      showSuccess(
        getApiSuccessMessage(
          response,
          "Đã đóng bài đăng.",
        ),
      );

      /*
       * Giữ message ngay dưới thẻ trước khi bài
       * chuyển sang tab Đã đóng.
       */
      await wait(1200);

      dismissFeedback();
      setPageNumber(1);

      await fetchPosts(1, true);
    } catch (error: unknown) {
      console.error(
        "Lỗi đóng bài:",
        error,
      );

      showError(
        getApiErrorMessage(
          error,
          "Không thể đóng bài đăng lúc này.",
        ),
      );
    } finally {
      setProcessingPostId(null);
    }
  };

  const handleReactivatePost =
    async (postId: string) => {
      const accepted = await confirm({
        title: "Mở lại bài đăng",
        message:
          "Bài đăng sẽ xuất hiện trở lại với người dùng. Bạn muốn mở lại?",
        confirmLabel: "Mở lại",
        cancelLabel: "Chưa mở",
      });

      if (!accepted) {
        return;
      }

      clearFeedback();

      setFeedbackTarget({
        type: "post",
        postId,
      });

      try {
        setProcessingPostId(postId);

        const response =
          await postApi.reactivatePost(
            postId,
          );

        if (
          response?.isSuccess === false
        ) {
          throw response;
        }

        showSuccess(
          getApiSuccessMessage(
            response,
            "Đã mở lại bài đăng.",
          ),
        );

        await wait(1200);

        dismissFeedback();
        setPageNumber(1);

        await fetchPosts(1, true);
      } catch (error: unknown) {
        console.error(
          "Lỗi mở lại bài:",
          error,
        );

        showError(
          getApiErrorMessage(
            error,
            "Không thể mở lại bài đăng lúc này.",
          ),
        );
      } finally {
        setProcessingPostId(null);
      }
    };

  const formatPrice = (
    price: number,
  ) => {
    if (!price) {
      return "0 đ";
    }

    return `${Number(
      price,
    ).toLocaleString("vi-VN")} đ`;
  };

  const getTimeAgo = (
    dateString: string,
  ) => {
    if (!dateString) {
      return "N/A";
    }

    const now = new Date();
    const past = new Date(dateString);

    if (
      Number.isNaN(past.getTime())
    ) {
      return "N/A";
    }

    const diffMilliseconds =
      now.getTime() - past.getTime();

    const diffMinutes = Math.floor(
      diffMilliseconds /
        (1000 * 60),
    );

    const diffHours = Math.floor(
      diffMinutes / 60,
    );

    const diffDays = Math.floor(
      diffHours / 24,
    );

    if (diffMinutes < 60) {
      return "Vừa xong";
    }

    if (diffHours < 24) {
      return `${diffHours} giờ trước`;
    }

    return `${diffDays} ngày trước`;
  };

  const getDaysLeft = (
    expiryDate: string,
  ) => {
    if (!expiryDate) {
      return "Không rõ";
    }

    const expiry =
      new Date(expiryDate);

    if (
      Number.isNaN(expiry.getTime())
    ) {
      return "Không rõ";
    }

    const difference =
      expiry.getTime() -
      Date.now();

    const days = Math.ceil(
      difference /
        (1000 * 60 * 60 * 24),
    );

    return days > 0
      ? `${days} ngày nữa`
      : "Đã hết hạn";
  };

  const translateStatus = (
    status: string,
  ) => {
    switch (status) {
      case "Active":
        return {
          text: "Đang hoạt động",
          color: "#10B981",
          background: "#D1FAE5",
        };

      case "Pending":
        return {
          text: "Chờ duyệt",
          color: "#F59E0B",
          background: "#FEF3C7",
        };

      case "Deleted":
        return {
          text: "Đã xóa",
          color: "#EF4444",
          background: "#FEE2E2",
        };

      case "Closed":
        return {
          text: "Đã đóng",
          color: "#64748B",
          background: "#E2E8F0",
        };

      default:
        return {
          text: status || "N/A",
          color: "#475569",
          background: "#F1F5F9",
        };
    }
  };

  if (!user) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={[
            styles.mobileWrapper,
            isWeb
              ? styles.webWrapper
              : undefined,
          ]}
        >
          <MainHeader title="Quản lý tin đăng" />

          <View
            style={
              styles.unauthContainer
            }
          >
            <Ionicons
              name="document-text-outline"
              size={80}
              color="#CBD5E1"
              style={
                styles.unauthIcon
              }
            />

            <Text
              style={styles.unauthTitle}
            >
              Bạn chưa đăng nhập
            </Text>

            <Text
              style={styles.unauthDesc}
            >
              Hãy đăng nhập để quản lý bài đăng,
              theo dõi trạng thái giao dịch và
              đăng tin mới.
            </Text>

            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => {
                router.push({
                  pathname:
                    "/(auth)/login",
                  params: {
                    returnUrl:
                      "/(tabs)/posts",
                  },
                });
              }}
            >
              <Text
                style={
                  styles.loginBtnText
                }
              >
                Đăng nhập ngay
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const validPosts = posts.filter(
    (post) =>
      post.status !== "Deleted",
  );

  const activePosts =
    validPosts.filter((post) => {
      return (
        post.status === "Active" ||
        post.status === "Pending"
      );
    });

  const closedPosts =
    validPosts.filter((post) => {
      return post.status === "Closed";
    });

  const renderCard = (post: any) => {
    const status =
      translateStatus(post.status);

    const address = [
      post.streetAddress,
      post.ward,
      post.city,
    ]
      .filter(Boolean)
      .join(", ");

    const displayPrice =
      post.basePrice ||
      post.expectedPrice ||
      0;

    const isProcessing =
      processingPostId ===
      post.postId;

    const showPostFeedback =
      feedbackTarget?.type === "post" &&
      feedbackTarget.postId ===
        post.postId;

    const imageUrl =
      Array.isArray(post.medias) &&
      post.medias.length > 0
        ? post.medias[0]?.url
        : null;

    return (
      <View
        key={post.postId}
        style={styles.cardWrapper}
      >
        <TouchableOpacity
          style={styles.card}
          activeOpacity={0.7}
          onPress={() => {
            router.push({
              pathname: "/posts/[id]",
              params: {
                id: post.postId,
              },
            });
          }}
        >
          {imageUrl ? (
            <Image
              source={{
                uri: imageUrl,
              }}
              style={styles.postImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.iconBox}>
              <Ionicons
                name={
                  post.postType === "Sell"
                    ? "cube-outline"
                    : "megaphone-outline"
                }
                size={32}
                color={COLORS.primary}
              />
            </View>
          )}

          <View
            style={styles.cardContent}
          >
            <Text
              style={styles.cardTitle}
              numberOfLines={2}
            >
              {post.productName ||
                post.description ||
                "Không có tiêu đề"}
            </Text>

            <Text
              style={styles.cardPrice}
            >
              {formatPrice(
                displayPrice,
              )}
            </Text>

            <Text
              style={styles.descText}
              numberOfLines={2}
            >
              {post.description ||
                "Chưa có mô tả"}
            </Text>

            <View
              style={styles.addressRow}
            >
              <Ionicons
                name="location-outline"
                size={12}
                color="#64748B"
              />

              <Text
                style={
                  styles.addressText
                }
                numberOfLines={1}
              >
                {address ||
                  "Chưa cập nhật địa chỉ"}
              </Text>
            </View>

            <View
              style={styles.tagGrid}
            >
              <View
                style={[
                  styles.tag,
                  {
                    backgroundColor:
                      status.background,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tagText,
                    {
                      color:
                        status.color,
                      fontWeight:
                        "bold",
                    },
                  ]}
                >
                  {status.text}
                </Text>
              </View>

              <View style={styles.tag}>
                <Text
                  style={styles.tagText}
                >
                  Loại:{" "}
                  {post.postType ||
                    "N/A"}
                </Text>
              </View>

              <View style={styles.tag}>
                <Text
                  style={styles.tagText}
                >
                  SL:{" "}
                  {post.remainingQuantity ??
                    0}{" "}
                  / {post.quantity ?? 0}
                </Text>
              </View>

              {post.deliveryMethod ? (
                <View style={styles.tag}>
                  <Text
                    style={
                      styles.tagText
                    }
                  >
                    Giao hàng:{" "}
                    {
                      post.deliveryMethod
                    }
                  </Text>
                </View>
              ) : null}

              {post.priorityLevel ? (
                <View style={styles.tag}>
                  <Text
                    style={
                      styles.tagText
                    }
                  >
                    Ưu tiên:{" "}
                    {
                      post.priorityLevel
                    }
                  </Text>
                </View>
              ) : null}
            </View>

            <View
              style={styles.cardFooter}
            >
              <Text
                style={styles.statsText}
              >
                {getTimeAgo(
                  post.createdAt,
                )}
              </Text>

              <View
                style={
                  styles.footerRight
                }
              >
                <Text
                  style={
                    styles.expiryText
                  }
                >
                  Hết hạn:{" "}
                  {getDaysLeft(
                    post.expiryDate,
                  )}
                </Text>

                <View
                  style={
                    styles.actionButtons
                  }
                >
                  <TouchableOpacity
                    style={styles.iconBtn}
                    onPress={(event) => {
                      event.stopPropagation();

                      router.push({
                        pathname:
                          "/posts/post-form",
                        params: {
                          editId:
                            post.postId,
                          postType:
                            post.postType,
                        },
                      });
                    }}
                    disabled={
                      isProcessing
                    }
                  >
                    <Ionicons
                      name="pencil-outline"
                      size={18}
                      color={
                        COLORS.primary
                      }
                    />
                  </TouchableOpacity>

                  {post.status ===
                  "Active" ? (
                    <TouchableOpacity
                      style={[
                        styles.iconBtn,
                        styles.closeButton,
                      ]}
                      onPress={(
                        event,
                      ) => {
                        event.stopPropagation();

                        void handleClosePost(
                          post.postId,
                        );
                      }}
                      disabled={
                        isProcessing
                      }
                    >
                      {isProcessing ? (
                        <ActivityIndicator
                          size="small"
                          color={
                            COLORS.error
                          }
                        />
                      ) : (
                        <Ionicons
                          name="close-circle-outline"
                          size={18}
                          color={
                            COLORS.error
                          }
                        />
                      )}
                    </TouchableOpacity>
                  ) : post.status ===
                    "Closed" ? (
                    <TouchableOpacity
                      style={[
                        styles.iconBtn,
                        styles.reactivateButton,
                      ]}
                      onPress={(
                        event,
                      ) => {
                        event.stopPropagation();

                        void handleReactivatePost(
                          post.postId,
                        );
                      }}
                      disabled={
                        isProcessing
                      }
                    >
                      {isProcessing ? (
                        <ActivityIndicator
                          size="small"
                          color={
                            COLORS.primary
                          }
                        />
                      ) : (
                        <Ionicons
                          name="refresh-circle-outline"
                          size={18}
                          color={
                            COLORS.primary
                          }
                        />
                      )}
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {showPostFeedback ? (
          <InlineFeedback
            feedback={feedback}
            onDismiss={dismissFeedback}
            style={
              styles.postFeedback
            }
          />
        ) : null}
      </View>
    );
  };

  const pageFeedback =
    feedbackTarget?.type === "page"
      ? feedback
      : null;

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View
        style={[
          styles.mobileWrapper,
          isWeb
            ? styles.webWrapper
            : undefined,
        ]}
      >
        <MainHeader title="Quản lý tin đăng" />

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "active"
                ? styles.tabBtnActive
                : undefined,
            ]}
            onPress={() =>
              handleChangeTab("active")
            }
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "active"
                  ? styles.tabTextActive
                  : undefined,
              ]}
            >
              {userRole === "personal"
                ? "Đang hiển thị"
                : "Đang thu mua"}{" "}
              ({activePosts.length})
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "closed"
                ? styles.tabBtnActive
                : undefined,
            ]}
            onPress={() =>
              handleChangeTab("closed")
            }
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "closed"
                  ? styles.tabTextActive
                  : undefined,
              ]}
            >
              Đã đóng (
              {closedPosts.length})
            </Text>
          </TouchableOpacity>
        </View>

        {pageFeedback ? (
          <InlineFeedback
            feedback={pageFeedback}
            onDismiss={
              dismissFeedback
            }
            style={styles.pageFeedback}
          />
        ) : null}

        {isLoading &&
        pageNumber === 1 ? (
          <View
            style={
              styles.loadingContainer
            }
          >
            <ActivityIndicator
              size="large"
              color={COLORS.primary}
            />

            <Text
              style={styles.loadingText}
            >
              Đang tải tin đăng...
            </Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={
              false
            }
            contentContainerStyle={
              styles.scrollContent
            }
            refreshControl={
              <RefreshControl
                refreshing={
                  isRefreshing
                }
                onRefresh={() => {
                  void onRefresh();
                }}
                colors={[
                  COLORS.primary,
                ]}
                tintColor={
                  COLORS.primary
                }
              />
            }
          >
            {activeTab === "active" ? (
              activePosts.length > 0 ? (
                activePosts.map(
                  renderCard,
                )
              ) : (
                <Text
                  style={styles.emptyText}
                >
                  {userRole ===
                  "personal"
                    ? "Chưa có tin đăng nào đang hoạt động."
                    : "Chưa có tin thu mua nào đang hoạt động."}
                </Text>
              )
            ) : closedPosts.length >
              0 ? (
              closedPosts.map(
                renderCard,
              )
            ) : (
              <Text
                style={styles.emptyText}
              >
                Bạn chưa đóng tin đăng nào.
              </Text>
            )}

            {hasMore &&
            !isLoading ? (
              <TouchableOpacity
                style={
                  styles.loadMoreBtn
                }
                onPress={loadMore}
              >
                <Text
                  style={
                    styles.loadMoreText
                  }
                >
                  Tải thêm
                </Text>
              </TouchableOpacity>
            ) : null}

            {isLoading &&
            pageNumber > 1 ? (
              <ActivityIndicator
                color={COLORS.primary}
                style={
                  styles.loadMoreIndicator
                }
              />
            ) : null}

            <View
              style={styles.bottomSpacer}
            />
          </ScrollView>
        )}

        <TouchableOpacity
          style={styles.fabButton}
          onPress={() =>
            router.push(
              "/posts/post-form",
            )
          }
        >
          <Ionicons
            name="add"
            size={32}
            color={COLORS.white}
          />
        </TouchableOpacity>

        {confirmationModal}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.border,
  },

  mobileWrapper: {
    flex: 1,
    backgroundColor: "#F8F9FA",
  },

  webWrapper: {
    width: 480,
    alignSelf: "center",
  },

  unauthContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: COLORS.white,
  },

  unauthIcon: {
    marginBottom: 16,
  },

  unauthTitle: {
    marginBottom: 12,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "bold",
  },

  unauthDesc: {
    marginBottom: 32,
    color: COLORS.textLight,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },

  loginBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },

  loginBtnText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "bold",
  },

  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },

  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },

  tabBtnActive: {
    borderBottomColor: COLORS.primary,
  },

  tabText: {
    color: COLORS.textLight,
    fontSize: 14,
    fontWeight: "600",
  },

  tabTextActive: {
    color: COLORS.primary,
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

  scrollContent: {
    padding: 16,
  },

  emptyText: {
    marginTop: 40,
    color: COLORS.textLight,
    fontSize: 14,
    textAlign: "center",
  },

  cardWrapper: {
    marginBottom: 16,
  },

  card: {
    flexDirection: "row",
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },

  postImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#F0F9FF",
  },

  iconBox: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: "#F0F9FF",
  },

  cardContent: {
    flex: 1,
    justifyContent: "space-between",
    marginLeft: 12,
  },

  cardTitle: {
    marginBottom: 2,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "bold",
  },

  cardPrice: {
    marginBottom: 4,
    color: COLORS.error,
    fontSize: 15,
    fontWeight: "bold",
  },

  descText: {
    marginBottom: 4,
    color: COLORS.textLight,
    fontSize: 12,
  },

  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginBottom: 8,
  },

  addressText: {
    flex: 1,
    color: "#64748B",
    fontSize: 11,
    fontStyle: "italic",
  },

  tagGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },

  tag: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    backgroundColor: "#F1F5F9",
  },

  tagText: {
    color: "#475569",
    fontSize: 10,
    fontWeight: "500",
  },

  cardFooter: {
    flexDirection: "row",
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#F1F5F9",
  },

  statsText: {
    marginBottom: 2,
    color: COLORS.textLight,
    fontSize: 12,
  },

  footerRight: {
    alignItems: "flex-end",
  },

  expiryText: {
    marginBottom: 2,
    color: COLORS.error,
    fontSize: 12,
    fontWeight: "bold",
  },

  actionButtons: {
    flexDirection: "row",
    gap: 8,
    marginTop: 4,
  },

  iconBtn: {
    minWidth: 30,
    minHeight: 30,
    alignItems: "center",
    justifyContent: "center",
    padding: 4,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 4,
    backgroundColor: "#F8FAFC",
  },

  closeButton: {
    borderColor: COLORS.error,
  },

  reactivateButton: {
    borderColor: COLORS.primary,
  },

  postFeedback: {
    marginTop: 8,
  },

  loadMoreBtn: {
    alignItems: "center",
    marginVertical: 10,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#E2E8F0",
  },

  loadMoreText: {
    color: COLORS.text,
    fontWeight: "bold",
  },

  loadMoreIndicator: {
    marginTop: 20,
  },

  bottomSpacer: {
    height: 80,
  },

  fabButton: {
    position: "absolute",
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 30,
    backgroundColor: COLORS.primary,

    ...(Platform.OS === "web"
      ? ({
          boxShadow:
            "0px 4px 6px rgba(0,0,0,0.3)",
        } as any)
      : {
          shadowColor:
            COLORS.primary,
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.3,
          shadowRadius: 6,
          elevation: 6,
        }),
  },
});