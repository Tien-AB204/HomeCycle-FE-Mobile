import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Platform,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";

type CartPost = {
  postId: string;
  ownerId?: string;
  avataUrl?: string | null;
  productName?: string | null;
  productTypeName?: string | null;
  categoryName?: string | null;
  brandName?: string | null;
  quantity?: number | null;
  remainingQuantity?: number | null;
  postType?: "Sell" | "Buy" | string;
  basePrice?: number | null;
  status?:
    | "Draft"
    | "Active"
    | "Suspended"
    | "Closed"
    | "Deleted"
    | string;
  medias?: Array<{
    mediaId?: string;
    url?: string | null;
    displayOrder?: number;
  }> | null;
};

type CartItem = {
  cartItemId: string;
  postId: string;
  quantity: number;
  addedAt?: string;
  post: CartPost;
};

type CartData = {
  items: CartItem[];
  totalQuantity: number;
  totalPrice: number;
};

const EMPTY_CART: CartData = {
  items: [],
  totalQuantity: 0,
  totalPrice: 0,
};

const cartApi = {
  getCart: () => apiClient.get("/cart").then((response) => response.data),

  removeItem: (cartItemId: string) =>
    apiClient
      .delete(`/cart/${cartItemId}`)
      .then((response) => response.data),
};

const getErrorMessage = (error: any, fallback: string) =>
  error?.response?.data?.error?.message ||
  error?.response?.data?.message ||
  error?.message ||
  fallback;

const formatCurrency = (value: number | null | undefined) =>
  `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const getPostImage = (post?: CartPost) => {
  if (!Array.isArray(post?.medias) || post.medias.length === 0) {
    return null;
  }

  const sortedMedias = [...post.medias].sort(
    (first, second) =>
      Number(first.displayOrder || 0) - Number(second.displayOrder || 0),
  );

  return sortedMedias.find((media) => Boolean(media.url))?.url || null;
};

export default function CartScreen() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [cartData, setCartData] = useState<CartData>(EMPTY_CART);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);

  const fetchCart = useCallback(
    async (showLoader = true) => {
      if (!user) return;

      if (showLoader) {
        setIsLoading(true);
      }

      setLoadError(null);

      try {
        const response = await cartApi.getCart();

        if (response?.isSuccess === false) {
          throw new Error(
            response?.error?.message || "Không thể tải giỏ hàng.",
          );
        }

        const data = response?.data || response || {};
        const items = Array.isArray(data.items) ? data.items : [];

        setCartData({
          items,
          totalQuantity: Number(data.totalQuantity || 0),
          totalPrice: Number(data.totalPrice || 0),
        });
      } catch (error: any) {
        setLoadError(getErrorMessage(error, "Không thể tải giỏ hàng."));
      } finally {
        if (showLoader) {
          setIsLoading(false);
        }
      }
    },
    [user],
  );

  useFocusEffect(
    useCallback(() => {
      if (isAuthLoading) {
        setIsLoading(true);
        return;
      }

      if (!user) {
        setCartData(EMPTY_CART);
        setLoadError(null);
        setIsLoading(false);
        return;
      }

      void fetchCart();
    }, [fetchCart, isAuthLoading, user]),
  );

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchCart(false);
    setIsRefreshing(false);
  };

  const handleRemoveItem = (item: CartItem) => {
    const executeRemove = async () => {
      try {
        setDeletingItemId(item.cartItemId);

        const response = await cartApi.removeItem(item.cartItemId);

        if (response?.isSuccess === false || response?.data === false) {
          throw new Error(
            response?.error?.message ||
              "Không thể xóa sản phẩm khỏi giỏ hàng.",
          );
        }

        await fetchCart(false);
      } catch (error: any) {
        const message = getErrorMessage(
          error,
          "Không thể xóa sản phẩm khỏi giỏ hàng.",
        );

        if (Platform.OS === "web") {
          window.alert(message);
        } else {
          Alert.alert("Lỗi", message);
        }
      } finally {
        setDeletingItemId(null);
      }
    };

    const productName = item.post?.productName || "sản phẩm này";
    const message = `Bạn có chắc muốn xóa ${productName} khỏi giỏ hàng?`;

    if (Platform.OS === "web") {
      if (window.confirm(message)) {
        void executeRemove();
      }

      return;
    }

    Alert.alert("Xóa khỏi giỏ hàng", message, [
      {
        text: "Không",
        style: "cancel",
      },
      {
        text: "Xóa",
        style: "destructive",
        onPress: () => void executeRemove(),
      },
    ]);
  };

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const post = item.post || ({} as CartPost);
    const imageUrl = getPostImage(post);
    const remainingQuantity = Number(post.remainingQuantity || 0);

    const isUnavailable =
      post.status !== "Active" || remainingQuantity <= 0;

    const exceedsStock =
      !isUnavailable && item.quantity > remainingQuantity;

    const isDeleting = deletingItemId === item.cartItemId;

    return (
      <TouchableOpacity
        style={[styles.cartItem, isUnavailable && styles.unavailableItem]}
        activeOpacity={0.8}
        onPress={() =>
          router.push({
            pathname: "/posts/[id]",
            params: {
              id: item.postId,
            },
          })
        }
      >
        {imageUrl ? (
          <Image
            source={{ uri: imageUrl }}
            style={[styles.image, isUnavailable && styles.faded]}
          />
        ) : (
          <View style={[styles.image, styles.imagePlaceholder]}>
            <Ionicons name="image-outline" size={28} color="#94A3B8" />
          </View>
        )}

        <View style={styles.info}>
          <Text style={styles.metaText} numberOfLines={1}>
            {[post.categoryName, post.brandName]
              .filter(Boolean)
              .join(" • ") ||
              post.productTypeName ||
              "Sản phẩm"}
          </Text>

          <Text
            style={[
              styles.productName,
              isUnavailable && styles.unavailableText,
            ]}
            numberOfLines={2}
          >
            {post.productName || "Sản phẩm không còn thông tin"}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {formatCurrency(post.basePrice)}
            </Text>

            <Text style={styles.quantity}>SL: {item.quantity}</Text>
          </View>

          {!isUnavailable && !exceedsStock && (
            <Text style={styles.subtotal}>
              Thành tiền:{" "}
              {formatCurrency(
                Number(post.basePrice || 0) * item.quantity,
              )}
            </Text>
          )}

          {isUnavailable && (
            <Text style={styles.warningText}>
              Sản phẩm hiện không khả dụng
            </Text>
          )}

          {exceedsStock && (
            <Text style={styles.warningText}>
              Chỉ còn {remainingQuantity} sản phẩm
            </Text>
          )}
        </View>

        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={(event) => {
            event.stopPropagation();
            handleRemoveItem(item);
          }}
          disabled={isDeleting}
          hitSlop={8}
        >
          {isDeleting ? (
            <ActivityIndicator size="small" color={COLORS.error} />
          ) : (
            <Ionicons
              name="trash-outline"
              size={21}
              color={COLORS.error}
            />
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const renderContent = () => {
    if (isAuthLoading || isLoading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />

          <Text style={styles.stateDescription}>
            Đang tải giỏ hàng...
          </Text>
        </View>
      );
    }

    if (!user) {
      return (
        <View style={styles.centerState}>
          <View style={styles.stateIcon}>
            <Ionicons
              name="lock-closed-outline"
              size={34}
              color={COLORS.primary}
            />
          </View>

          <Text style={styles.stateTitle}>Bạn cần đăng nhập</Text>

          <Text style={styles.stateDescription}>
            Đăng nhập để xem và quản lý các sản phẩm trong giỏ hàng.
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() =>
              router.push({
                pathname: "/(auth)/login",
                params: {
                  returnUrl: "/(tabs)/cart",
                },
              })
            }
          >
            <Text style={styles.primaryButtonText}>Đăng nhập</Text>
          </TouchableOpacity>
        </View>
      );
    }

    if (loadError && cartData.items.length === 0) {
      return (
        <View style={styles.centerState}>
          <View style={styles.stateIcon}>
            <Ionicons
              name="cloud-offline-outline"
              size={36}
              color={COLORS.primary}
            />
          </View>

          <Text style={styles.stateTitle}>Không thể tải giỏ hàng</Text>

          <Text style={styles.stateDescription}>{loadError}</Text>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => void fetchCart()}
          >
            <Text style={styles.primaryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <FlatList
        data={cartData.items}
        keyExtractor={(item) => item.cartItemId}
        renderItem={renderCartItem}
        contentContainerStyle={[
          styles.list,
          cartData.items.length === 0 && styles.emptyList,
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void handleRefresh()}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
        ListEmptyComponent={
          <View style={styles.centerState}>
            <View style={styles.stateIcon}>
              <Ionicons
                name="cart-outline"
                size={38}
                color={COLORS.primary}
              />
            </View>

            <Text style={styles.stateTitle}>Giỏ hàng đang trống</Text>

            <Text style={styles.stateDescription}>
              Những sản phẩm bạn muốn mua sẽ xuất hiện tại đây.
            </Text>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => router.push("/(tabs)")}
            >
              <Text style={styles.primaryButtonText}>
                Khám phá sản phẩm
              </Text>
            </TouchableOpacity>
          </View>
        }
      />
    );
  };

  const showFooter =
    Boolean(user) &&
    !isAuthLoading &&
    !isLoading &&
    cartData.items.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mobileWrapper}>
        <MainHeader title="Giỏ hàng của bạn" />

        {renderContent()}

        {showFooter && (
          <View style={styles.footer}>
            <View style={styles.totalBlock}>
              <Text style={styles.totalLabel}>
                Tổng cộng ({cartData.totalQuantity} sản phẩm)
              </Text>

              <Text style={styles.totalPrice}>
                {formatCurrency(cartData.totalPrice)}
              </Text>
            </View>

            <TouchableOpacity
              style={styles.continueButton}
              onPress={() => router.push("/(tabs)")}
            >
              <Text style={styles.continueButtonText}>Mua thêm</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    alignItems: "center",
    backgroundColor: COLORS.border,
  },

  mobileWrapper: {
    flex: 1,
    width: "100%",
    maxWidth: 480,
    backgroundColor: "#F6F8FA",
    ...(Platform.OS === "web"
      ? ({
          boxShadow: "0px 0px 20px rgba(0,0,0,0.08)",
        } as any)
      : {}),
  },

  list: {
    padding: 16,
    gap: 12,
    paddingBottom: 24,
  },

  emptyList: {
    flexGrow: 1,
  },

  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 116,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    elevation: 1,
  },

  unavailableItem: {
    backgroundColor: "#F8FAFC",
  },

  image: {
    width: 82,
    height: 82,
    borderRadius: 10,
    backgroundColor: "#E2E8F0",
  },

  imagePlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },

  faded: {
    opacity: 0.5,
  },

  info: {
    flex: 1,
    minWidth: 0,
    marginLeft: 12,
  },

  metaText: {
    marginBottom: 4,
    color: COLORS.textLight,
    fontSize: 11,
  },

  productName: {
    marginBottom: 7,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },

  unavailableText: {
    color: "#94A3B8",
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },

  price: {
    flexShrink: 1,
    color: COLORS.error,
    fontSize: 15,
    fontWeight: "800",
  },

  quantity: {
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: "600",
  },

  subtotal: {
    marginTop: 5,
    color: COLORS.textLight,
    fontSize: 11,
  },

  warningText: {
    marginTop: 5,
    color: COLORS.error,
    fontSize: 11,
    fontWeight: "600",
  },

  deleteBtn: {
    alignSelf: "flex-start",
    marginLeft: 8,
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#FEF2F2",
  },

  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    paddingVertical: 48,
  },

  stateIcon: {
    width: 68,
    height: 68,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderRadius: 34,
    backgroundColor: "#E9F0F0",
  },

  stateTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },

  stateDescription: {
    maxWidth: 300,
    marginTop: 8,
    color: COLORS.textLight,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
  },

  primaryButton: {
    minWidth: 132,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },

  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#E2E8F0",
    backgroundColor: COLORS.white,
  },

  totalBlock: {
    flex: 1,
  },

  totalLabel: {
    color: COLORS.textLight,
    fontSize: 12,
  },

  totalPrice: {
    marginTop: 2,
    color: COLORS.error,
    fontSize: 18,
    fontWeight: "800",
  },

  continueButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },

  continueButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "700",
  },
});