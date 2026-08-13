import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useRouter,
} from "expo-router";
import React, {
  useCallback,
  useEffect,
  useState,
} from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  Pressable,
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
} from "../../src/utils/apiFeedback";

type FeedbackTarget =
  | {
      type: "page";
    }
  | {
      type: "menu";
      route: string;
    }
  | {
      type: "modal";
    }
  | {
      type: "logout";
    }
  | null;

type ProfileMenuItem = {
  icon:
    React.ComponentProps<
      typeof Ionicons
    >["name"];
  title: string;
  route: string;
};

const getRobustUrl = (
  url: string,
) => {
  if (
    url?.includes(
      "googleusercontent.com",
    )
  ) {
    return `https://wsrv.nl/?url=${encodeURIComponent(
      url,
    )}`;
  }

  return url;
};

const formatFullDate = (
  dateString: string,
) => {
  if (!dateString) {
    return "N/A";
  }

  const date = new Date(dateString);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "N/A";
  }

  const day = String(
    date.getDate(),
  ).padStart(2, "0");

  const month = String(
    date.getMonth() + 1,
  ).padStart(2, "0");

  const year =
    date.getFullYear();

  return `${day}/${month}/${year}`;
};

export default function ProfileScreen() {
  const router = useRouter();

  const {
    width: screenWidth,
  } = useWindowDimensions();

  const width =
    Platform.OS === "web" &&
    screenWidth > 480
      ? 480
      : screenWidth;

  const {
    user,
    logout,
    isLoading,
  } = useAuth();

  const [
    imageError,
    setImageError,
  ] = useState(false);

  const [
    postCount,
    setPostCount,
  ] = useState(0);

  const [
    showActionModal,
    setShowActionModal,
  ] = useState(false);

  const [
    isLoggingOut,
    setIsLoggingOut,
  ] = useState(false);

  const [
    feedbackTarget,
    setFeedbackTarget,
  ] = useState<FeedbackTarget>(null);

  const {
    feedback,
    clearFeedback,
    showError,
    showInfo,
  } = useActionFeedback();

  const {
    confirm,
    confirmationModal,
  } = useConfirmAction();

  const currentUserId =
    user?.userId || user?.id;

  useEffect(() => {
    setImageError(false);
  }, [user?.avatarUrl, user?.avatar]);

  useFocusEffect(
    useCallback(() => {
      const fetchPostCount =
        async () => {
          if (!currentUserId) {
            setPostCount(0);
            return;
          }

          try {
            const response =
              await apiClient.get(
                `/posts/get-all/by-user/${currentUserId}`,
                {
                  params: {
                    PageNumber: 1,
                    PageSize: 1,
                  },
                },
              );

            if (
              response.data
                ?.isSuccess === false
            ) {
              throw response.data;
            }

            const responseData =
              response.data?.data ||
              response.data;

            const total =
              responseData?.totalCount ??
              responseData?.totalItems ??
              responseData?.items
                ?.length ??
              responseData?.length ??
              0;

            setPostCount(
              Number(total || 0),
            );
          } catch (error: unknown) {
            console.error(
              "[Profile] Lỗi lấy số lượng bài đăng:",
              error,
            );

            setFeedbackTarget({
              type: "page",
            });

            showError(
              getApiErrorMessage(
                error,
                "Không thể tải số lượng bài đăng.",
              ),
            );
          }
        };

      void fetchPostCount();
    }, [
      currentUserId,
      showError,
    ]),
  );

  const dismissFeedback = () => {
    clearFeedback();
    setFeedbackTarget(null);
  };

  const handleMenuPress = (
    route: string,
  ) => {
    dismissFeedback();

    if (route === "ACTION_DEV") {
      setFeedbackTarget({
        type: "menu",
        route,
      });

      showInfo(
        "Tính năng đang được phát triển.",
      );

      return;
    }

    if (
      route ===
      "ACTION_BUSINESS_ORDERS"
    ) {
      setShowActionModal(true);
      return;
    }

    router.push(route as any);
  };

  const handleOpenOrders = () => {
    dismissFeedback();
    setShowActionModal(false);

    router.push("/(tabs)/orders");
  };

  const handleShowStatisticsInfo =
    () => {
      clearFeedback();

      setFeedbackTarget({
        type: "modal",
      });

      showInfo(
        "Vui lòng truy cập phiên bản Web trên máy tính để xem biểu đồ thống kê chi tiết.",
      );
    };

  const handleCloseActionModal =
    () => {
      if (
        feedbackTarget?.type ===
        "modal"
      ) {
        dismissFeedback();
      }

      setShowActionModal(false);
    };

  const handleLogout = async () => {
    const confirmed = await confirm({
      title: "Đăng xuất",
      message:
        "Bạn có chắc muốn đăng xuất khỏi tài khoản hiện tại?",
      confirmLabel: "Đăng xuất",
      cancelLabel: "Ở lại",
      destructive: true,
    });

    if (!confirmed) {
      return;
    }

    dismissFeedback();

    try {
      setIsLoggingOut(true);

      await logout();

      router.replace("/(tabs)");
    } catch (error: unknown) {
      console.error(
        "Không thể đăng xuất:",
        error,
      );

      setFeedbackTarget({
        type: "logout",
      });

      showError(
        getApiErrorMessage(
          error,
          "Không thể đăng xuất lúc này.",
        ),
      );
    } finally {
      setIsLoggingOut(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />
      </View>
    );
  }

  if (!user) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <View
          style={[
            styles.mobileWrapper,
            {
              width,
            },
          ]}
        >
          <MainHeader
            title="Hồ sơ"
            showBack={false}
          />

          <View
            style={
              styles.unauthContainer
            }
          >
            <Ionicons
              name="person-circle-outline"
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
              Đăng nhập để cập nhật hồ sơ,
              theo dõi ví tiền và sử dụng đầy
              đủ tiện ích của HomeCycle.
            </Text>

            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => {
                router.push({
                  pathname:
                    "/(auth)/login",
                  params: {
                    returnUrl:
                      "/(tabs)/profile",
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

  const joinDateString =
    formatFullDate(user.createdAt);

  const actualAvatar =
    user.avatarUrl || user.avatar;

  const isValidAvatar =
    actualAvatar &&
    actualAvatar !== "string" &&
    actualAvatar !== "null";

  const defaultAvatar =
    `https://ui-avatars.com/api/?name=${encodeURIComponent(
      user.username || "U",
    )}&background=208AEF&color=fff&size=200`;

  const avatarSource =
    isValidAvatar && !imageError
      ? {
          uri: getRobustUrl(
            actualAvatar,
          ),
        }
      : {
          uri: defaultAvatar,
        };

  const menuItems: ProfileMenuItem[] =
    user.role === "business"
      ? [
          {
            icon: "business-outline",
            title:
              "Hồ sơ Doanh nghiệp",
            route:
              "/profile/business-account-info",
          },
          {
            icon: "bar-chart-outline",
            title:
              "Thống kê & Đơn hàng",
            route:
              "ACTION_BUSINESS_ORDERS",
          },
          {
            icon: "book-outline",
            title:
              "Quy định & Chính sách",
            route: "/policy", // Đã sửa đường dẫn
          },
          {
            icon: "settings-outline",
            title:
              "Thiết lập ứng dụng",
            route: "/settings",
          },
        ]
      : [
          {
            icon: "person-outline",
            title:
              "Thông tin tài khoản",
            route:
              "/profile/account-info",
          },
          {
            icon: "time-outline",
            title:
              "Lịch sử giao dịch",
            route: "ACTION_DEV",
          },
          {
            icon: "book-outline",
            title:
              "Quy định & Chính sách",
            route: "/policy", // Đã sửa đường dẫn
          },
          {
            icon: "settings-outline",
            title:
              "Thiết lập ứng dụng",
            route: "/settings",
          },
        ];

  const pageFeedback =
    feedbackTarget?.type === "page"
      ? feedback
      : null;

  const modalFeedback =
    feedbackTarget?.type === "modal"
      ? feedback
      : null;

  const logoutFeedback =
    feedbackTarget?.type ===
    "logout"
      ? feedback
      : null;

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View
        style={[
          styles.mobileWrapper,
          {
            width,
          },
        ]}
      >
        <MainHeader
          title="Hồ sơ"
          showBack={false}
        />

        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          style={styles.container}
          contentContainerStyle={
            styles.scrollContent
          }
        >
          <View
            style={
              styles.userInfoSection
            }
          >
            <Image
              source={avatarSource}
              style={styles.avatar}
              onError={() =>
                setImageError(true)
              }
            />

            <Text
              style={styles.userName}
            >
              {user.username}
            </Text>

            {user.verificationStatus ===
            "Verified" ? (
              <View
                style={
                  styles.verifiedBadge
                }
              >
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color={COLORS.primary}
                />

                <Text
                  style={
                    styles.verifiedText
                  }
                >
                  Đã xác thực
                </Text>
              </View>
            ) : null}

            <View style={styles.metaRow}>
              <Text
                style={styles.metaText}
              >
                Tham gia:{" "}
                {joinDateString}
              </Text>
            </View>

            <View
              style={styles.statsBadge}
            >
              <Text
                style={
                  styles.statsTextRating
                }
              >
                Điểm uy tín:{" "}
                {user.reputationScore ??
                  0}
              </Text>

              <Text
                style={
                  styles.statsDivider
                }
              >
                |
              </Text>

              <Text
                style={styles.statsText}
              >
                0{" "}
                {user.role === "business"
                  ? "Giao dịch hoàn tất"
                  : "Đơn hàng"}
              </Text>
            </View>
          </View>

          {user.role === "personal" ? (
            <View
              style={
                styles.upgradeBanner
              }
            >
              <View
                style={
                  styles.upgradeTextContainer
                }
              >
                <Text
                  style={
                    styles.upgradeTitle
                  }
                >
                  Nâng cấp lên Doanh nghiệp
                </Text>

                <Text
                  style={
                    styles.upgradeDesc
                  }
                >
                  Tăng độ uy tín, mở rộng hạn
                  mức đăng tin và nhận hỗ trợ
                  ưu tiên.
                </Text>

                <TouchableOpacity
                  style={
                    styles.upgradeBtn
                  }
                  onPress={() => {
                    router.push(
                      "/profile/business-upgrade" as any,
                    );
                  }}
                >
                  <Text
                    style={
                      styles.upgradeBtnText
                    }
                  >
                    Khám phá ngay
                  </Text>
                </TouchableOpacity>
              </View>

              <View
                style={
                  styles.upgradeIconBox
                }
              >
                <Ionicons
                  name="storefront"
                  size={32}
                  color={COLORS.text}
                />
              </View>
            </View>
          ) : null}

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Ionicons
                name="wallet-outline"
                size={24}
                color={COLORS.primary}
              />

              <Text
                style={styles.statLabel}
              >
                Số dư ví
              </Text>

              <Text
                style={styles.statValue}
              >
                0 đ
              </Text>
            </View>

            <TouchableOpacity
              style={styles.statCard}
              activeOpacity={0.7}
              onPress={() =>
                router.push(
                  "/(tabs)/posts",
                )
              }
            >
              <Ionicons
                name="newspaper-outline"
                size={24}
                color={COLORS.primary}
              />

              <Text
                style={styles.statLabel}
              >
                {user.role === "business"
                  ? "Tin đang thu mua"
                  : "Tin đang đăng bán"}
              </Text>

              <Text
                style={styles.statValue}
              >
                {postCount} bài
              </Text>
            </TouchableOpacity>
          </View>

          {pageFeedback ? (
            <InlineFeedback
              feedback={pageFeedback}
              onDismiss={
                dismissFeedback
              }
              style={
                styles.pageFeedback
              }
            />
          ) : null}

          <View
            style={
              styles.menuContainer
            }
          >
            {menuItems.map(
              (item, index) => {
                const showMenuFeedback =
                  feedbackTarget?.type ===
                    "menu" &&
                  feedbackTarget.route ===
                    item.route;

                return (
                  <View
                    key={item.route}
                  >
                    <TouchableOpacity
                      style={[
                        styles.menuItem,
                        index ===
                        menuItems.length -
                          1
                          ? styles.lastMenuItem
                          : undefined,
                      ]}
                      onPress={() =>
                        handleMenuPress(
                          item.route,
                        )
                      }
                    >
                      <View
                        style={
                          styles.menuIconBox
                        }
                      >
                        <Ionicons
                          name={item.icon}
                          size={22}
                          color={
                            COLORS.primary
                          }
                        />
                      </View>

                      <Text
                        style={
                          styles.menuText
                        }
                      >
                        {item.title}
                      </Text>

                      <Ionicons
                        name="chevron-forward"
                        size={20}
                        color={
                          COLORS.border
                        }
                      />
                    </TouchableOpacity>

                    {showMenuFeedback ? (
                      <InlineFeedback
                        feedback={
                          feedback
                        }
                        onDismiss={
                          dismissFeedback
                        }
                        style={
                          styles.menuFeedback
                        }
                      />
                    ) : null}
                  </View>
                );
              },
            )}
          </View>

          <TouchableOpacity
            style={[
              styles.logoutButton,
              isLoggingOut
                ? styles.disabledButton
                : undefined,
            ]}
            onPress={() => {
              void handleLogout();
            }}
            disabled={isLoggingOut}
          >
            {isLoggingOut ? (
              <ActivityIndicator
                size="small"
                color={COLORS.error}
              />
            ) : (
              <Ionicons
                name="log-out-outline"
                size={22}
                color={COLORS.error}
              />
            )}

            <Text
              style={styles.logoutText}
            >
              {isLoggingOut
                ? "Đang đăng xuất..."
                : "Đăng xuất"}
            </Text>
          </TouchableOpacity>

          {logoutFeedback ? (
            <InlineFeedback
              feedback={logoutFeedback}
              onDismiss={
                dismissFeedback
              }
              style={
                styles.logoutFeedback
              }
            />
          ) : null}

          <View
            style={styles.bottomSpacer}
          />
        </ScrollView>

        <Modal
          visible={showActionModal}
          animationType="slide"
          transparent
          onRequestClose={
            handleCloseActionModal
          }
        >
          <View
            style={styles.modalOverlay}
          >
            <Pressable
              accessibilityLabel="Đóng bảng chọn chức năng"
              style={
                StyleSheet.absoluteFill
              }
              onPress={
                handleCloseActionModal
              }
            />

            <View
              style={
                styles.actionModalContent
              }
            >
              <View
                style={
                  styles.modalDragIndicator
                }
              />

              <Text
                style={
                  styles.actionModalTitle
                }
              >
                Chọn chức năng
              </Text>

              <TouchableOpacity
                style={
                  styles.actionModalBtn
                }
                onPress={
                  handleOpenOrders
                }
              >
                <View
                  style={[
                    styles.actionModalIcon,
                    styles.orderModalIcon,
                  ]}
                >
                  <Ionicons
                    name="receipt-outline"
                    size={24}
                    color="#0EA5E9"
                  />
                </View>

                <View
                  style={
                    styles.actionModalTextContainer
                  }
                >
                  <Text
                    style={
                      styles.actionModalBtnText
                    }
                  >
                    Xem Đơn hàng
                  </Text>

                  <Text
                    style={
                      styles.actionModalBtnDesc
                    }
                  >
                    Quản lý và theo dõi trạng
                    thái giao dịch
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.border}
                />
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.actionModalBtn,
                  styles.lastActionModalButton,
                ]}
                onPress={
                  handleShowStatisticsInfo
                }
              >
                <View
                  style={[
                    styles.actionModalIcon,
                    styles.statisticsModalIcon,
                  ]}
                >
                  <Ionicons
                    name="bar-chart-outline"
                    size={24}
                    color="#F59E0B"
                  />
                </View>

                <View
                  style={
                    styles.actionModalTextContainer
                  }
                >
                  <Text
                    style={
                      styles.actionModalBtnText
                    }
                  >
                    Xem Thống kê
                  </Text>

                  <Text
                    style={
                      styles.actionModalBtnDesc
                    }
                  >
                    Báo cáo doanh thu (Chỉ hỗ
                    trợ trên Web)
                  </Text>
                </View>

                <Ionicons
                  name="chevron-forward"
                  size={20}
                  color={COLORS.border}
                />
              </TouchableOpacity>

              {modalFeedback ? (
                <InlineFeedback
                  feedback={
                    modalFeedback
                  }
                  onDismiss={
                    dismissFeedback
                  }
                  style={
                    styles.modalFeedback
                  }
                />
              ) : null}
            </View>
          </View>
        </Modal>

        {confirmationModal}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
  },

  safeArea: {
    flex: 1,
    alignItems: "center",
    backgroundColor: COLORS.border,
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

  container: {
    flex: 1,
    paddingHorizontal: 16,
  },

  scrollContent: {
    paddingBottom: 40,
  },

  unauthContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: COLORS.background,
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

  userInfoSection: {
    alignItems: "center",
    marginTop: 16,
    marginBottom: 20,
  },

  avatar: {
    width: 80,
    height: 80,
    marginBottom: 12,
    borderRadius: 40,
    backgroundColor: COLORS.border,
  },

  userName: {
    marginBottom: 6,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
  },

  verifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: "#E9F0F0",
  },

  verifiedText: {
    marginLeft: 4,
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "700",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },

  metaText: {
    color: COLORS.textLight,
    fontSize: 13,
  },

  statsBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    backgroundColor: COLORS.white,
  },

  statsTextRating: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },

  statsDivider: {
    marginHorizontal: 10,
    color: COLORS.border,
    fontSize: 14,
  },

  statsText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
  },

  upgradeBanner: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: COLORS.text,
  },

  upgradeTextContainer: {
    flex: 1,
    marginRight: 10,
  },

  upgradeTitle: {
    marginBottom: 6,
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },

  upgradeDesc: {
    marginBottom: 12,
    color: COLORS.border,
    fontSize: 11,
  },

  upgradeBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },

  upgradeBtnText: {
    color: COLORS.text,
    fontSize: 12,
    fontWeight: "700",
  },

  upgradeIconBox: {
    width: 60,
    height: 60,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    backgroundColor: COLORS.white,
  },

  statsGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
  },

  statCard: {
    flex: 1,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.white,
  },

  statLabel: {
    marginTop: 8,
    color: COLORS.textLight,
    fontSize: 12,
  },

  statValue: {
    marginTop: 4,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "700",
  },

  pageFeedback: {
    marginTop: -6,
    marginBottom: 16,
  },

  menuContainer: {
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    overflow: "hidden",
  },

  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.background,
  },

  lastMenuItem: {
    borderBottomWidth: 0,
  },

  menuIconBox: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    borderRadius: 10,
    backgroundColor: COLORS.background,
  },

  menuText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "500",
  },

  menuFeedback: {
    marginTop: 0,
    marginBottom: 10,
  },

  logoutButton: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: "#F2D5D5",
    borderRadius: 16,
    backgroundColor: COLORS.white,
  },

  logoutText: {
    marginLeft: 12,
    color: COLORS.error,
    fontSize: 15,
    fontWeight: "700",
  },

  disabledButton: {
    opacity: 0.7,
  },

  logoutFeedback: {
    marginTop: 8,
  },

  bottomSpacer: {
    height: 40,
  },

  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },

  actionModalContent: {
    padding: 24,
    paddingBottom: 40,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: COLORS.white,
  },

  modalDragIndicator: {
    width: 40,
    height: 4,
    alignSelf: "center",
    marginBottom: 16,
    borderRadius: 2,
    backgroundColor: "#E2E8F0",
  },

  actionModalTitle: {
    marginBottom: 20,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
  },

  actionModalBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },

  lastActionModalButton: {
    borderBottomWidth: 0,
  },

  actionModalIcon: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 16,
    borderRadius: 12,
  },

  orderModalIcon: {
    backgroundColor: "#E0F2FE",
  },

  statisticsModalIcon: {
    backgroundColor: "#FEF3C7",
  },

  actionModalTextContainer: {
    flex: 1,
  },

  actionModalBtnText: {
    marginBottom: 4,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
  },

  actionModalBtnDesc: {
    color: COLORS.textLight,
    fontSize: 13,
  },

  modalFeedback: {
    marginTop: 10,
  },
});