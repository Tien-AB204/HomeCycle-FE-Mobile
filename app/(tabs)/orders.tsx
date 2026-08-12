import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  useFocusEffect,
  useRouter,
} from "expo-router";
import React, {
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
} from "../../src/components/shared/ActionFeedback";
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import {
  getApiErrorMessage,
} from "../../src/utils/apiFeedback";

type OrderTab =
  | "processing"
  | "history"
  | "complaint";

type OrderItem = {
  id: string;
  orderCode: string;
  productName: string;
  price: number;
  imageUrl: string;
  role: string;
  partnerName: string;
  appointmentDate: string;
  orderStatus: string;
  shippingStatus: string;
};

type FeedbackTarget =
  | {
      type: "page";
    }
  | {
      type: "order";
      orderId: string;
    }
  | null;

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
};

/*
 * TODO: Đây là dữ liệu tạm, không phải dữ liệu Order thật.
 * Xóa toàn bộ các hằng số này khi gắn API Order.
 */
const MOCK_STATUSES = [
  "Chờ xác nhận",
  "Đang xử lý",
  "Đã lấy hàng",
  "Đang giao",
];

const MOCK_SHIPPING = [
  "Chưa có thông tin",
  "Shipper đang trên đường lấy hàng",
  "Đang trung chuyển",
  "Đang giao đến bạn",
];

const MOCK_PARTNERS = [
  "Trần Hải Đăng",
  "Nguyễn Văn Đối Tác",
  "Công ty Thu Gom Xanh",
  "Lê Thị Mua Bán",
];

export default function OrdersScreen() {
  const router = useRouter();

  const { width } =
    useWindowDimensions();

  const isWeb =
    Platform.OS === "web" &&
    width > 480;

  const { user } = useAuth();

  const currentUserId =
    user?.userId || user?.id;

  const [
    activeTab,
    setActiveTab,
  ] = useState<OrderTab>("processing");

  const [orders, setOrders] =
    useState<OrderItem[]>([]);

  const [isLoading, setIsLoading] =
    useState(true);

  const [
    isRefreshing,
    setIsRefreshing,
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

  /*
   * TODO: Thay toàn bộ hàm này bằng GET API Order thật.
   */
  const fetchMockOrders = useCallback(
    async (isRefresh = false) => {
      if (!currentUserId) {
        setOrders([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      try {
        if (!isRefresh) {
          setIsLoading(true);
        }

        const storageKey =
          `MOCK_ORDERS_LIST_${currentUserId}`;

        if (!isRefresh) {
          const cached =
            await AsyncStorage.getItem(
              storageKey,
            );

          if (cached) {
            const parsedOrders =
              JSON.parse(cached);

            setOrders(
              Array.isArray(parsedOrders)
                ? parsedOrders
                : [],
            );

            return;
          }
        }

        let generatedOrders: OrderItem[] =
          [];

        try {
          const response =
            await postApi.getPostsByUser(
              currentUserId,
              {
                PageNumber: 1,
                PageSize: 5,
              },
            );

          const posts =
            response?.items ||
            response?.data?.items ||
            response?.data ||
            [];

          generatedOrders = (
            Array.isArray(posts)
              ? posts
              : []
          ).map(
            (
              post: any,
              index: number,
            ) => {
              return {
                id: `AGR-${
                  post.postId || index
                }`,

                orderCode: `HC-${Math.floor(
                  10000000 +
                    Math.random() *
                      90000000,
                )}`,

                productName:
                  post.productName ||
                  post.description ||
                  "Sản phẩm giao dịch",

                price:
                  post.basePrice ||
                  post.expectedPrice ||
                  0,

                imageUrl:
                  post.medias?.[0]?.url ||
                  "https://ui-avatars.com/api/?name=SP&background=F0F9FF&color=0EA5E9",

                role:
                  user?.role === "business"
                    ? "Người Mua"
                    : "Người Bán",

                partnerName:
                  MOCK_PARTNERS[
                    Math.floor(
                      Math.random() *
                        MOCK_PARTNERS.length,
                    )
                  ],

                appointmentDate:
                  new Date(
                    Date.now() +
                      86400000 *
                        (1 +
                          Math.floor(
                            Math.random() *
                              3,
                          )),
                  ).toISOString(),

                orderStatus:
                  MOCK_STATUSES[
                    Math.floor(
                      Math.random() *
                        MOCK_STATUSES.length,
                    )
                  ],

                shippingStatus:
                  MOCK_SHIPPING[
                    Math.floor(
                      Math.random() *
                        MOCK_SHIPPING.length,
                    )
                  ],
              };
            },
          );
        } catch (error: unknown) {
          console.error(
            "Không lấy được bài đăng để tạo dữ liệu tạm:",
            error,
          );
        }

        if (
          generatedOrders.length === 0
        ) {
          generatedOrders = [
            {
              id: "MOCK-1",

              orderCode: `HC-${Math.floor(
                10000000 +
                  Math.random() *
                    90000000,
              )}`,

              productName:
                "Smart Tivi Samsung UHD 4K 55 inch",

              price: 9870003,

              imageUrl:
                "https://ui-avatars.com/api/?name=TV&background=F0F9FF&color=0EA5E9",

              role: "Người Mua",

              partnerName:
                "Điện máy Nguyễn Kim",

              appointmentDate:
                new Date(
                  Date.now() +
                    86400000 * 2,
                ).toISOString(),

              orderStatus:
                "Đang xử lý",

              shippingStatus:
                "Đơn vị vận chuyển đang lấy hàng",
            },
            {
              id: "MOCK-2",

              orderCode: `HC-${Math.floor(
                10000000 +
                  Math.random() *
                    90000000,
              )}`,

              productName:
                "Tủ lạnh LG Inverter 208 Lít",

              price: 2500000,

              imageUrl:
                "https://ui-avatars.com/api/?name=TL&background=FEF2F2&color=EF4444",

              role: "Người Bán",

              partnerName: "Trần Thị B",

              appointmentDate:
                new Date(
                  Date.now() +
                    86400000,
                ).toISOString(),

              orderStatus:
                "Chờ xác nhận",

              shippingStatus:
                "Chưa có thông tin",
            },
          ];
        }

        await AsyncStorage.setItem(
          storageKey,
          JSON.stringify(
            generatedOrders,
          ),
        );

        setOrders(generatedOrders);
      } catch (error: unknown) {
        console.error(
          "Lỗi tải danh sách đơn hàng:",
          error,
        );

        setFeedbackTarget({
          type: "page",
        });

        showError(
          getApiErrorMessage(
            error,
            "Không thể tải danh sách đơn hàng.",
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
      user?.role,
    ],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchMockOrders(false);
    }, [fetchMockOrders]),
  );

  const onRefresh = () => {
    clearFeedback();
    setFeedbackTarget(null);
    setIsRefreshing(true);

    void fetchMockOrders(true);
  };

  const handleChangeTab = (
    nextTab: OrderTab,
  ) => {
    clearFeedback();
    setFeedbackTarget(null);
    setActiveTab(nextTab);
  };

  const handleAction = (
    orderId: string,
    actionName: string,
  ) => {
    clearFeedback();

    setFeedbackTarget({
      type: "order",
      orderId,
    });

    showInfo(
      `Tính năng "${actionName}" đang được cấu hình API.`,
    );
  };

  const dismissFeedback = () => {
    clearFeedback();
    setFeedbackTarget(null);
  };

  const formatCurrency = (
    value: number,
  ) => {
    if (!value) {
      return "0 đ";
    }

    return new Intl.NumberFormat(
      "vi-VN",
      {
        style: "currency",
        currency: "VND",
      },
    ).format(value);
  };

  const formatDate = (
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

    return date.toLocaleString(
      "vi-VN",
      {
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      },
    );
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
          <MainHeader title="Quản lý Đơn hàng" />

          <View
            style={
              styles.unauthContainer
            }
          >
            <Ionicons
              name="receipt-outline"
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
              Vui lòng đăng nhập để xem danh
              sách đơn hàng, lịch trình giao
              nhận và quản lý khiếu nại.
            </Text>

            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() => {
                router.push({
                  pathname:
                    "/(auth)/login",
                  params: {
                    returnUrl:
                      "/(tabs)/orders",
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
        <MainHeader title="Quản lý Đơn hàng" />

        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "processing"
                ? styles.tabBtnActive
                : undefined,
            ]}
            onPress={() =>
              handleChangeTab(
                "processing",
              )
            }
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "processing"
                  ? styles.tabTextActive
                  : undefined,
              ]}
            >
              Đang xử lý
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "history"
                ? styles.tabBtnActive
                : undefined,
            ]}
            onPress={() =>
              handleChangeTab("history")
            }
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "history"
                  ? styles.tabTextActive
                  : undefined,
              ]}
            >
              Lịch sử
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "complaint"
                ? styles.tabBtnActive
                : undefined,
            ]}
            onPress={() =>
              handleChangeTab(
                "complaint",
              )
            }
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "complaint"
                  ? styles.tabTextActive
                  : undefined,
              ]}
            >
              Khiếu nại
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

        {isLoading ? (
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
              Đang tải đơn hàng...
            </Text>
          </View>
        ) : (
          <ScrollView
            contentContainerStyle={
              styles.scrollContent
            }
            showsVerticalScrollIndicator={
              false
            }
            refreshControl={
              <RefreshControl
                refreshing={
                  isRefreshing
                }
                onRefresh={onRefresh}
                colors={[
                  COLORS.primary,
                ]}
                tintColor={
                  COLORS.primary
                }
              />
            }
          >
            {activeTab ===
            "processing" ? (
              orders.length > 0 ? (
                orders.map((order) => {
                  const showOrderFeedback =
                    feedbackTarget?.type ===
                      "order" &&
                    feedbackTarget.orderId ===
                      order.id;

                  return (
                    <View
                      key={order.id}
                      style={styles.card}
                    >
                      <View
                        style={
                          styles.cardHeader
                        }
                      >
                        <View>
                          <Text
                            style={
                              styles.orderCode
                            }
                          >
                            Mã:{" "}
                            {order.orderCode}
                          </Text>

                          <Text
                            style={
                              styles.orderRole
                            }
                          >
                            Vai trò:{" "}
                            <Text
                              style={
                                styles.roleValue
                              }
                            >
                              {order.role}
                            </Text>
                          </Text>
                        </View>

                        <View
                          style={
                            styles.statusBadge
                          }
                        >
                          <Text
                            style={
                              styles.statusText
                            }
                          >
                            {
                              order.orderStatus
                            }
                          </Text>
                        </View>
                      </View>

                      <TouchableOpacity
                        style={
                          styles.cardBody
                        }
                        activeOpacity={0.7}
                        onPress={() => {
                          router.push(
                            `/orders/${order.id}` as any,
                          );
                        }}
                      >
                        <Image
                          source={{
                            uri: order.imageUrl,
                          }}
                          style={
                            styles.productImg
                          }
                        />

                        <View
                          style={
                            styles.productInfo
                          }
                        >
                          <Text
                            style={
                              styles.productName
                            }
                            numberOfLines={2}
                          >
                            {
                              order.productName
                            }
                          </Text>

                          <View
                            style={
                              styles.partnerRow
                            }
                          >
                            <Ionicons
                              name="person-outline"
                              size={12}
                              color={
                                COLORS.textLight
                              }
                            />

                            <Text
                              style={
                                styles.partnerName
                              }
                              numberOfLines={1}
                            >
                              Đối tác:{" "}
                              {
                                order.partnerName
                              }
                            </Text>
                          </View>

                          <Text
                            style={
                              styles.productPrice
                            }
                          >
                            {formatCurrency(
                              order.price,
                            )}
                          </Text>
                        </View>
                      </TouchableOpacity>

                      <View
                        style={
                          styles.divider
                        }
                      />

                      <View
                        style={
                          styles.metaBox
                        }
                      >
                        <View
                          style={
                            styles.metaRow
                          }
                        >
                          <Ionicons
                            name="calendar-outline"
                            size={14}
                            color={
                              COLORS.textLight
                            }
                          />

                          <Text
                            style={
                              styles.metaText
                            }
                          >
                            Lịch hẹn:{" "}
                            {formatDate(
                              order.appointmentDate,
                            )}
                          </Text>
                        </View>

                        <View
                          style={
                            styles.metaRow
                          }
                        >
                          <Ionicons
                            name="car-outline"
                            size={14}
                            color={
                              COLORS.textLight
                            }
                          />

                          <Text
                            style={
                              styles.metaText
                            }
                          >
                            Vận chuyển:{" "}
                            {
                              order.shippingStatus
                            }
                          </Text>
                        </View>
                      </View>

                      <View
                        style={
                          styles.cardFooter
                        }
                      >
                        <TouchableOpacity
                          style={
                            styles.outlineBtnError
                          }
                          onPress={() =>
                            handleAction(
                              order.id,
                              "Hủy đơn hàng",
                            )
                          }
                        >
                          <Text
                            style={
                              styles.outlineBtnErrorText
                            }
                          >
                            Hủy Đơn
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={
                            styles.outlineBtnWarning
                          }
                          onPress={() =>
                            handleAction(
                              order.id,
                              "Báo cáo sự cố",
                            )
                          }
                        >
                          <Text
                            style={
                              styles.outlineBtnWarningText
                            }
                          >
                            Báo Cáo
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={
                            styles.primaryBtn
                          }
                          onPress={() => {
                            router.push(
                              `/orders/${order.id}` as any,
                            );
                          }}
                        >
                          <Text
                            style={
                              styles.primaryBtnText
                            }
                          >
                            Chi tiết
                          </Text>
                        </TouchableOpacity>
                      </View>

                      {showOrderFeedback ? (
                        <InlineFeedback
                          feedback={feedback}
                          onDismiss={
                            dismissFeedback
                          }
                          style={
                            styles.orderFeedback
                          }
                        />
                      ) : null}
                    </View>
                  );
                })
              ) : (
                <Text
                  style={styles.emptyText}
                >
                  Chưa có đơn hàng nào đang xử
                  lý.
                </Text>
              )
            ) : (
              <Text
                style={styles.emptyText}
              >
                Chưa có dữ liệu cho mục này.
              </Text>
            )}

            <View
              style={styles.bottomSpacer}
            />
          </ScrollView>
        )}
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
    backgroundColor: "#F1F5F9",
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

  card: {
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
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

  cardHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  orderCode: {
    marginBottom: 4,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "bold",
  },

  orderRole: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: "500",
  },

  roleValue: {
    color: COLORS.primary,
  },

  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "#FEF3C7",
  },

  statusText: {
    color: "#F59E0B",
    fontSize: 11,
    fontWeight: "bold",
  },

  cardBody: {
    flexDirection: "row",
    alignItems: "center",
  },

  productImg: {
    width: 70,
    height: 70,
    marginRight: 12,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
  },

  productInfo: {
    flex: 1,
  },

  productName: {
    marginBottom: 4,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "bold",
  },

  partnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 4,
  },

  partnerName: {
    flex: 1,
    color: COLORS.textLight,
    fontSize: 12,
  },

  productPrice: {
    color: COLORS.error,
    fontSize: 15,
    fontWeight: "bold",
  },

  divider: {
    height: 1,
    marginVertical: 12,
    backgroundColor: "#F1F5F9",
  },

  metaBox: {
    gap: 6,
    marginBottom: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#F8FAFC",
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  metaText: {
    flex: 1,
    color: "#475569",
    fontSize: 12,
    fontWeight: "500",
  },

  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },

  outlineBtnError: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
  },

  outlineBtnErrorText: {
    color: COLORS.error,
    fontSize: 12,
    fontWeight: "bold",
  },

  outlineBtnWarning: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#F59E0B",
  },

  outlineBtnWarningText: {
    color: "#F59E0B",
    fontSize: 12,
    fontWeight: "bold",
  },

  primaryBtn: {
    flex: 1.2,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },

  primaryBtnText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "bold",
  },

  orderFeedback: {
    marginTop: 10,
  },

  bottomSpacer: {
    height: 40,
  },
});