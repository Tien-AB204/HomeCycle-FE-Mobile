import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
import {
  getApiErrorMessage,
  getApiSuccessMessage,
} from "../../src/utils/apiFeedback";

type CartPost = {
  postId: string;
  ownerId?: string;
  productName?: string | null;
  productTypeName?: string | null;
  categoryName?: string | null;
  brandName?: string | null;
  remainingQuantity?: number | null;
  postType?: "Sell" | "Buy" | string;
  basePrice?: number | null;
  status?: string;
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

type ItemMessage = {
  itemId: string;
  type: "error" | "success";
  text: string;
} | null;

const EMPTY_CART: CartData = {
  items: [],
  totalQuantity: 0,
  totalPrice: 0,
};

const cartApi = {
  getCart: () => apiClient.get("/cart").then((response) => response.data),
  removeItem: (cartItemId: string) =>
    apiClient.delete(`/cart/${cartItemId}`).then((response) => response.data),
};

const formatCurrency = (value: number | null | undefined) =>
  `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const getPostImage = (post?: CartPost) => {
  if (!Array.isArray(post?.medias) || post.medias.length === 0) return null;

  return [...post.medias]
    .sort(
      (first, second) =>
        Number(first.displayOrder || 0) - Number(second.displayOrder || 0),
    )
    .find((media) => Boolean(media.url))?.url || null;
};

export default function CartScreen() {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();

  const [cartData, setCartData] = useState<CartData>(EMPTY_CART);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deletingItemId, setDeletingItemId] = useState<string | null>(null);
  const [itemMessage, setItemMessage] = useState<ItemMessage>(null);

  const fetchCart = useCallback(
    async (showLoader = true) => {
      if (!user) return;

      try {
        if (showLoader) setIsLoading(true);
        setLoadError(null);

        const response = await cartApi.getCart();
        if (response?.isSuccess === false) throw response;

        const data = response?.data || response || {};
        const items = Array.isArray(data.items) ? data.items : [];

        setCartData({
          items,
          totalQuantity: Number(data.totalQuantity || 0),
          totalPrice: Number(data.totalPrice || 0),
        });
      } catch (error: unknown) {
        setLoadError(getApiErrorMessage(error, "Không thể tải giỏ hàng."));
      } finally {
        if (showLoader) setIsLoading(false);
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

      setPendingDeleteId(null);
      setItemMessage(null);
      void fetchCart();
    }, [fetchCart, isAuthLoading, user]),
  );

  const handleRefresh = async () => {
    setPendingDeleteId(null);
    setItemMessage(null);
    setIsRefreshing(true);
    await fetchCart(false);
    setIsRefreshing(false);
  };

  const requestDelete = (itemId: string) => {
    setItemMessage(null);
    setPendingDeleteId((current) => (current === itemId ? null : itemId));
  };

  const confirmDelete = async (item: CartItem) => {
    if (deletingItemId) return;

    try {
      setDeletingItemId(item.cartItemId);
      setItemMessage(null);

      const response = await cartApi.removeItem(item.cartItemId);
      if (response?.isSuccess === false || response?.data === false) throw response;

      setPendingDeleteId(null);
      setItemMessage({
        itemId: item.cartItemId,
        type: "success",
        text: getApiSuccessMessage(response, "Đã xóa sản phẩm khỏi giỏ hàng."),
      });
    } catch (error: unknown) {
      setItemMessage({
        itemId: item.cartItemId,
        type: "error",
        text: getApiErrorMessage(error, "Không thể xóa sản phẩm khỏi giỏ hàng."),
      });
    } finally {
      setDeletingItemId(null);
    }
  };

  const dismissItemMessage = async () => {
    const shouldReload = itemMessage?.type === "success";
    setItemMessage(null);
    if (shouldReload) await fetchCart(false);
  };

  const renderCartItem = ({ item }: { item: CartItem }) => {
    const post = item.post || ({} as CartPost);
    const imageUrl = getPostImage(post);
    const remainingQuantity = Number(post.remainingQuantity || 0);
    const isUnavailable = post.status !== "Active" || remainingQuantity <= 0;
    const exceedsStock = !isUnavailable && item.quantity > remainingQuantity;
    const isDeleting = deletingItemId === item.cartItemId;
    const isConfirming = pendingDeleteId === item.cartItemId;
    const message = itemMessage?.itemId === item.cartItemId ? itemMessage : null;

    return (
      <View style={styles.cartItemWrapper}>
        <TouchableOpacity
          style={[
            styles.cartItem,
            isUnavailable ? styles.unavailableItem : undefined,
          ]}
          activeOpacity={0.8}
          onPress={() =>
            router.push({
              pathname: "/posts/[id]",
              params: { id: item.postId },
            })
          }
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={[styles.image, isUnavailable ? styles.faded : undefined]}
            />
          ) : (
            <View style={[styles.image, styles.imagePlaceholder]}>
              <Ionicons name="image-outline" size={28} color="#547B7D" />
            </View>
          )}

          <View style={styles.info}>
            <Text style={styles.metaText} numberOfLines={1}>
              {[post.categoryName, post.brandName].filter(Boolean).join(" • ") ||
                post.productTypeName ||
                "Sản phẩm"}
            </Text>
            <Text
              style={[
                styles.productName,
                isUnavailable ? styles.unavailableText : undefined,
              ]}
              numberOfLines={2}
            >
              {post.productName || "Sản phẩm không còn thông tin"}
            </Text>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{formatCurrency(post.basePrice)}</Text>
              <Text style={styles.quantity}>SL: {item.quantity}</Text>
            </View>
            {!isUnavailable && !exceedsStock ? (
              <Text style={styles.subtotal}>
                Thành tiền: {formatCurrency(Number(post.basePrice || 0) * item.quantity)}
              </Text>
            ) : null}
            {isUnavailable ? (
              <Text style={styles.warningText}>Sản phẩm hiện không khả dụng</Text>
            ) : null}
            {exceedsStock ? (
              <Text style={styles.warningText}>Chỉ còn {remainingQuantity} sản phẩm</Text>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.deleteBtn}
            onPress={(event) => {
              event.stopPropagation();
              requestDelete(item.cartItemId);
            }}
            disabled={isDeleting}
            hitSlop={8}
          >
            {isDeleting ? (
              <ActivityIndicator size="small" color={COLORS.error} />
            ) : (
              <Ionicons name="trash-outline" size={21} color={COLORS.error} />
            )}
          </TouchableOpacity>
        </TouchableOpacity>

        {isConfirming ? (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmText}>
              Xóa {post.productName || "sản phẩm này"} khỏi giỏ hàng?
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.keepButton}
                onPress={() => setPendingDeleteId(null)}
                disabled={isDeleting}
              >
                <Text style={styles.keepButtonText}>Giữ lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => void confirmDelete(item)}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.removeButtonText}>Xóa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {message ? (
          <View
            style={[
              styles.itemMessage,
              message.type === "error"
                ? styles.itemMessageError
                : styles.itemMessageSuccess,
            ]}
          >
            <Text
              style={[
                styles.itemMessageText,
                message.type === "error"
                  ? styles.itemMessageErrorText
                  : styles.itemMessageSuccessText,
              ]}
            >
              {message.text}
            </Text>
            <TouchableOpacity onPress={() => void dismissItemMessage()} hitSlop={8}>
              <Ionicons name="close" size={18} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const renderContent = () => {
    if (isAuthLoading || isLoading) {
      return (
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.stateDescription}>Đang tải giỏ hàng...</Text>
        </View>
      );
    }

    if (!user) {
      return (
        <View style={styles.centerState}>
          <View style={styles.stateIcon}>
            <Ionicons name="lock-closed-outline" size={34} color={COLORS.primary} />
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
                params: { returnUrl: "/(tabs)/cart" },
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
            <Ionicons name="cloud-offline-outline" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.stateTitle}>Không thể tải giỏ hàng</Text>
          <Text style={styles.stateDescription}>{loadError}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={() => void fetchCart()}>
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
          cartData.items.length === 0 ? styles.emptyList : undefined,
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
              <Ionicons name="cart-outline" size={38} color={COLORS.primary} />
            </View>
            <Text style={styles.stateTitle}>Giỏ hàng đang trống</Text>
            <Text style={styles.stateDescription}>
              Những sản phẩm bạn muốn mua sẽ xuất hiện tại đây.
            </Text>
            <TouchableOpacity style={styles.primaryButton} onPress={() => router.push("/(tabs)")}>
              <Text style={styles.primaryButtonText}>Khám phá sản phẩm</Text>
            </TouchableOpacity>
          </View>
        }
      />
    );
  };

  const showFooter =
    Boolean(user) && !isAuthLoading && !isLoading && cartData.items.length > 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.mobileWrapper}>
        <MainHeader title="Giỏ hàng của bạn" />
        {renderContent()}

        {showFooter ? (
          <View style={styles.footer}>
            <View style={styles.totalBlock}>
              <Text style={styles.totalLabel}>
                Tổng cộng ({cartData.totalQuantity} sản phẩm)
              </Text>
              <Text style={styles.totalPrice}>{formatCurrency(cartData.totalPrice)}</Text>
            </View>
            <TouchableOpacity style={styles.continueButton} onPress={() => router.push("/(tabs)")}>
              <Text style={styles.continueButtonText}>Mua thêm</Text>
            </TouchableOpacity>
          </View>
        ) : null}
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
    backgroundColor: "#F8F9FA",
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 0px 20px rgba(0,0,0,0.08)" } as any)
      : {}),
  },
  list: { padding: 16, gap: 12, paddingBottom: 24 },
  emptyList: { flexGrow: 1 },
  cartItemWrapper: { width: "100%" },
  cartItem: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 116,
    padding: 12,
    borderRadius: 14,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: "#BAC2C1",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  unavailableItem: { backgroundColor: "#F8F9FA" },
  image: {
    width: 82,
    height: 82,
    borderRadius: 10,
    backgroundColor: "#F8F9FA",
  },
  imagePlaceholder: { alignItems: "center", justifyContent: "center" },
  faded: { opacity: 0.5 },
  info: { flex: 1, minWidth: 0, marginLeft: 12 },
  metaText: { marginBottom: 4, color: COLORS.textLight, fontSize: 11 },
  productName: {
    marginBottom: 7,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 19,
  },
  unavailableText: { color: "#547B7D" },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  price: { flexShrink: 1, color: COLORS.error, fontSize: 15, fontWeight: "800" },
  quantity: { color: COLORS.textLight, fontSize: 12, fontWeight: "600" },
  subtotal: { marginTop: 5, color: COLORS.textLight, fontSize: 11 },
  warningText: { marginTop: 5, color: COLORS.error, fontSize: 11, fontWeight: "600" },
  deleteBtn: {
    alignSelf: "flex-start",
    marginLeft: 8,
    padding: 6,
    borderRadius: 8,
    backgroundColor: "rgba(122, 16, 18, 0.08)",
  },
  confirmBox: {
    marginTop: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(122, 16, 18, 0.22)",
    borderRadius: 10,
    backgroundColor: "rgba(122, 16, 18, 0.08)",
  },
  confirmText: { color: COLORS.text, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 10 },
  keepButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },
  keepButtonText: { color: COLORS.text, fontWeight: "700" },
  removeButton: {
    flex: 1,
    minHeight: 42,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 8,
    backgroundColor: COLORS.error,
  },
  removeButtonText: { color: COLORS.white, fontWeight: "800" },
  itemMessage: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 8,
    padding: 10,
    borderWidth: 1,
    borderRadius: 10,
  },
  itemMessageError: { backgroundColor: "rgba(122, 16, 18, 0.08)", borderColor: "rgba(122, 16, 18, 0.22)" },
  itemMessageSuccess: { backgroundColor: "rgba(47, 118, 93, 0.10)", borderColor: "rgba(47, 118, 93, 0.24)" },
  itemMessageText: { flex: 1, fontSize: 13, lineHeight: 18 },
  itemMessageErrorText: { color: "#7A1012" },
  itemMessageSuccessText: { color: "#2F765D" },
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
    backgroundColor: "rgba(84, 123, 125, 0.08)",
  },
  stateTitle: { color: COLORS.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
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
  primaryButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "700" },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#BAC2C1",
    backgroundColor: COLORS.white,
  },
  totalBlock: { flex: 1 },
  totalLabel: { color: COLORS.textLight, fontSize: 12 },
  totalPrice: { marginTop: 2, color: COLORS.error, fontSize: 18, fontWeight: "800" },
  continueButton: {
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  continueButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "700" },
});
