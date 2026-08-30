import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import {
  getApiErrorMessage,
  getApiSuccessMessage,
} from "../../src/utils/apiFeedback";
import { ModalBackdrop, ModalSurface } from "../../src/components/shared/ModalBackdrop";

type FeedbackType = "error" | "success" | "warning" | "info";
type LocalFeedback = {
  type: FeedbackType;
  message: string;
} | null;

type ConfirmOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmState = {
  options: ConfirmOptions;
  resolve: (value: boolean) => void;
} | null;

function useLocalFeedback() {
  const [feedback, setFeedback] = useState<LocalFeedback>(null);

  const clearFeedback = useCallback(() => setFeedback(null), []);
  const showError = useCallback(
    (message: string) => setFeedback({ type: "error", message }),
    [],
  );
  const showSuccess = useCallback(
    (message: string) => setFeedback({ type: "success", message }),
    [],
  );
  const showInfo = useCallback(
    (message: string) => setFeedback({ type: "info", message }),
    [],
  );

  return {
    feedback,
    clearFeedback,
    showError,
    showSuccess,
    showInfo,
  };
}

function InlineFeedback({
  feedback,
  onDismiss,
  style,
}: {
  feedback: LocalFeedback;
  onDismiss?: () => void;
  style?: any;
}) {
  if (!feedback) return null;

  const palette =
    feedback.type === "error"
      ? {
          backgroundColor: "rgba(122, 16, 18, 0.08)",
          borderColor: "rgba(122, 16, 18, 0.22)",
          color: "#7A1012",
          icon: "alert-circle-outline" as const,
        }
      : feedback.type === "success"
        ? {
            backgroundColor: "rgba(47, 118, 93, 0.10)",
            borderColor: "rgba(47, 118, 93, 0.24)",
            color: "#2F765D",
            icon: "checkmark-circle-outline" as const,
          }
        : feedback.type === "warning"
          ? {
              backgroundColor: "rgba(154, 100, 24, 0.10)",
              borderColor: "rgba(154, 100, 24, 0.24)",
              color: "#9A6418",
              icon: "warning-outline" as const,
            }
          : {
              backgroundColor: "rgba(84, 123, 125, 0.10)",
              borderColor: "rgba(84, 123, 125, 0.24)",
              color: "#2B5659",
              icon: "information-circle-outline" as const,
            };

  return (
    <View
      style={[
        styles.localFeedback,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
        style,
      ]}
    >
      <Ionicons name={palette.icon} size={18} color={palette.color} />
      <Text style={[styles.localFeedbackText, { color: palette.color }]}>
        {feedback.message}
      </Text>
      {onDismiss ? (
        <TouchableOpacity onPress={onDismiss} style={styles.feedbackDismissButton}>
          <Ionicons name="close" size={17} color={palette.color} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function useLocalConfirm() {
  const [state, setState] = useState<ConfirmState>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ options, resolve });
      }),
    [],
  );

  const finish = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  const confirmationModal = (
    <Modal
      visible={Boolean(state)}
      transparent
      animationType="fade"
      onRequestClose={() => finish(false)}
    >
      <ModalBackdrop style={styles.confirmOverlay} onPress={() => finish(false)}>
        <ModalSurface style={styles.confirmCard}>
          <Text style={styles.confirmTitle}>{state?.options.title}</Text>
          <Text style={styles.confirmMessage}>{state?.options.message}</Text>
          <View style={styles.confirmActions}>
            <TouchableOpacity
              style={styles.confirmCancelButton}
              onPress={() => finish(false)}
            >
              <Text style={styles.confirmCancelText}>
                {state?.options.cancelLabel || "Hủy"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.confirmPrimaryButton,
                state?.options.destructive
                  ? styles.confirmDestructiveButton
                  : undefined,
              ]}
              onPress={() => finish(true)}
            >
              <Text style={styles.confirmPrimaryText}>
                {state?.options.confirmLabel || "Xác nhận"}
              </Text>
            </TouchableOpacity>
          </View>
        </ModalSurface>
      </ModalBackdrop>
    </Modal>
  );

  return { confirm, confirmationModal };
}

const postApi = {
  getPostById: (postId: string) =>
    apiClient.get(`/posts/get-by-id/${postId}`).then((response) => response.data),

  closePost: (postId: string) =>
    apiClient.patch(`/posts/${postId}/close`).then((response) => response.data),

  reactivatePost: (postId: string) =>
    apiClient
      .patch(`/posts/${postId}/reactivate`)
      .then((response) => response.data),
};

/**
 * Chi tiết/hủy Offer nằm trong app/offers/[id].tsx.
 * PUT /offers/{offerId} vẫn cố ý tắt trên Mobile.
 */
const offerApi = {
  createOffer: (data: {
    postId: string;
    offerPrice: number;
    offerQuantity: number;
  }) => apiClient.post("/offers", data).then((response) => response.data),

  getSentOffers: (params?: { PageNumber?: number; PageSize?: number }) =>
    apiClient.get("/offers/sent", { params }).then((response) => response.data),
};

const cartApi = {
  addToCart: (postId: string, quantity: number) =>
    apiClient.post(`/cart/${postId}`, { quantity }).then((response) => response.data),
};

const { width } = Dimensions.get("window");

export default function PostDetailScreen() {
  const { id, viewOnly } = useLocalSearchParams();
  const isViewOnly = viewOnly === "true";
  const router = useRouter();

  const { user } = useAuth();
  const currentUserId = user?.userId || user?.id;

  const [post, setPost] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [existingOfferId, setExistingOfferId] = useState<string | null>(null);

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerQuantity, setOfferQuantity] = useState("1");
  const [offerPrice, setOfferPrice] = useState("");
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);

  const [showCartModal, setShowCartModal] = useState(false);
  const [cartQuantity, setCartQuantity] = useState("1");
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);

  const {
    feedback: pageFeedback,
    clearFeedback: clearPageFeedback,
    showError: showPageError,
    showSuccess: showPageSuccess,
  } = useLocalFeedback();

  const {
    feedback: offerFeedback,
    clearFeedback: clearOfferFeedback,
    showError: showOfferError,
  } = useLocalFeedback();

  const {
    feedback: cartFeedback,
    clearFeedback: clearCartFeedback,
    showError: showCartError,
    showSuccess: showCartSuccess,
  } = useLocalFeedback();

  const { confirm, confirmationModal } = useLocalConfirm();

  const fetchPostData = async () => {
    if (!id) return;

    try {
      setIsLoading(true);
      const resPost = await postApi.getPostById(id as string);
      const postData = resPost?.data || resPost;
      setPost(postData);

      const isForeignBusinessBuy =
        user?.role === "business" &&
        postData?.postType === "Buy" &&
        String(postData?.ownerId || "") !== String(currentUserId || "");

      if (
        user &&
        postData?.ownerId !== currentUserId &&
        !isForeignBusinessBuy
      ) {
        const resOffers = await offerApi.getSentOffers({
          PageSize: 50,
          PageNumber: 1,
        });
        const items = resOffers?.data?.items || [];
        const pendingOffer = items.find(
          (offer: any) =>
            offer.postId === id &&
            (offer.offerStatus === 0 ||
              offer.offerStatus === "Pending" ||
              offer.offerStatus === "pending"),
        );
        setExistingOfferId(pendingOffer?.offerId || null);
      } else {
        setExistingOfferId(null);
      }
    } catch (error) {
      showPageError(
        getApiErrorMessage(error, "Không thể tải thông tin bài đăng."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void fetchPostData();
    }, [id, user]),
  );

  const isMyPost = Boolean(
    currentUserId &&
      post?.ownerId &&
      String(currentUserId) === String(post.ownerId),
  );

  const isBusinessViewingForeignBuy =
    user?.role === "business" && post?.postType === "Buy" && !isMyPost;

  const handleClosePost = async () => {
    const targetPostId = post?.postId;
    if (!targetPostId) {
      showPageError("Không tìm thấy ID bài đăng.");
      return;
    }

    const confirmed = await confirm({
      title: "Đóng bài đăng",
      message:
        "Tin sẽ kết thúc giao dịch và không còn hiển thị trên trang chủ. Bạn có muốn tiếp tục?",
      confirmLabel: "Đóng bài",
      cancelLabel: "Quay lại",
      destructive: true,
    });
    if (!confirmed) return;

    try {
      setIsLoading(true);
      clearPageFeedback();
      const response = await postApi.closePost(targetPostId);
      showPageSuccess(getApiSuccessMessage(response, "Đã đóng bài đăng."));
      await fetchPostData();
    } catch (error) {
      showPageError(
        getApiErrorMessage(error, "Không thể đóng bài đăng lúc này."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleReactivatePost = async () => {
    const targetPostId = post?.postId;
    if (!targetPostId) {
      showPageError("Không tìm thấy ID bài đăng.");
      return;
    }

    const confirmed = await confirm({
      title: "Mở lại bài đăng",
      message: "Bài đăng sẽ tiếp tục hiển thị và nhận tương tác.",
      confirmLabel: "Mở lại",
      cancelLabel: "Quay lại",
    });
    if (!confirmed) return;

    try {
      setIsLoading(true);
      clearPageFeedback();
      const response = await postApi.reactivatePost(targetPostId);
      showPageSuccess(getApiSuccessMessage(response, "Đã mở lại bài đăng."));
      await fetchPostData();
    } catch (error) {
      showPageError(
        getApiErrorMessage(error, "Không thể mở lại bài đăng lúc này."),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenOffer = () => {
    if (!user) {
      router.push(`/(auth)/login?returnUrl=/posts/${id}`);
      return;
    }

    // BE cũng chặn Business gửi Offer vào Buy Post của Business khác.
    if (user.role === "business" && post?.postType === "Buy") {
      showPageError(
        "Tài khoản doanh nghiệp không thể tương tác với tin thu mua của doanh nghiệp khác.",
      );
      return;
    }

    if (existingOfferId) {
      clearPageFeedback();
      router.push({
        pathname: "/offers/[id]",
        params: { id: existingOfferId },
      });
      return;
    }

    clearOfferFeedback();
    setOfferQuantity("1");
    setOfferPrice("");
    setShowOfferModal(true);
  };

  const validateOfferForm = () => {
    const quantity = parseInt(offerQuantity, 10);
    const price = parseInt(offerPrice, 10);

    if (Number.isNaN(quantity) || quantity <= 0) {
      showOfferError("Số lượng phải là số nguyên lớn hơn 0.");
      return null;
    }

    if (quantity > Number(post?.remainingQuantity || 0)) {
      showOfferError(`Số lượng tối đa là ${post?.remainingQuantity || 0}.`);
      return null;
    }

    if (Number.isNaN(price) || price <= 0) {
      showOfferError("Giá thương lượng phải lớn hơn 0.");
      return null;
    }

    return { quantity, price };
  };

  const handleCreateOffer = async () => {
    if (user?.role === "business" && post?.postType === "Buy") {
      showOfferError(
        "Tài khoản doanh nghiệp không thể gửi đề nghị tới tin thu mua của doanh nghiệp khác.",
      );
      return;
    }

    const valid = validateOfferForm();
    if (!valid) return;

    const targetPostId =
      post?.postId || (Array.isArray(id) ? id[0] : id);
    if (!targetPostId) {
      showOfferError("Không tìm thấy bài đăng cần thương lượng.");
      return;
    }

    try {
      setIsSubmittingOffer(true);
      clearOfferFeedback();
      const response = await offerApi.createOffer({
        postId: targetPostId,
        offerPrice: valid.price,
        offerQuantity: valid.quantity,
      });
      setShowOfferModal(false);
      showPageSuccess(
        getApiSuccessMessage(response, "Đã gửi đề nghị thương lượng."),
      );
      await fetchPostData();
    } catch (error) {
      showOfferError(getApiErrorMessage(error, "Không thể gửi đề nghị."));
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  const handleOpenCartModal = () => {
    const targetPostId =
      post?.postId || (Array.isArray(id) ? id[0] : id);

    if (!user) {
      router.push({
        pathname: "/(auth)/login",
        params: { returnUrl: `/posts/${targetPostId || ""}` },
      });
      return;
    }

    if (!targetPostId) {
      showPageError("Không tìm thấy bài đăng cần thêm vào giỏ hàng.");
      return;
    }

    // CartService BE chỉ nhận PostType.Sell. Buy Post không bao giờ được add cart.
    if (post?.postType !== "Sell") {
      showPageError("Tin thu mua không thể thêm vào giỏ hàng.");
      return;
    }

    if (
      currentUserId &&
      post?.ownerId &&
      String(currentUserId) === String(post.ownerId)
    ) {
      showPageError("Bạn không thể thêm bài đăng của chính mình vào giỏ hàng.");
      return;
    }

    if (post?.status !== "Active") {
      showPageError("Bài đăng này hiện không còn hoạt động.");
      return;
    }

    if (Number(post?.remainingQuantity || 0) <= 0) {
      showPageError("Sản phẩm này hiện đã hết số lượng.");
      return;
    }

    clearCartFeedback();
    setCartAdded(false);
    setCartQuantity("1");
    setShowCartModal(true);
  };

  const handleAddToCart = async () => {
    const targetPostId =
      post?.postId || (Array.isArray(id) ? id[0] : id);
    const quantity = Number(cartQuantity);

    if (!targetPostId) {
      showCartError("Không tìm thấy bài đăng cần thêm.");
      return;
    }

    if (post?.postType !== "Sell") {
      showCartError("Tin thu mua không thể thêm vào giỏ hàng.");
      return;
    }

    if (!Number.isInteger(quantity) || quantity <= 0) {
      showCartError("Số lượng phải là số nguyên lớn hơn 0.");
      return;
    }

    if (quantity > Number(post?.remainingQuantity || 0)) {
      showCartError(`Số lượng tối đa là ${post?.remainingQuantity || 0}.`);
      return;
    }

    try {
      setIsAddingToCart(true);
      clearCartFeedback();
      const response = await cartApi.addToCart(targetPostId, quantity);

      if (response?.isSuccess === false) {
        throw new Error(
          response?.error?.message || "Không thể thêm sản phẩm vào giỏ hàng.",
        );
      }

      setCartAdded(true);
      showCartSuccess(
        getApiSuccessMessage(
          response,
          `Đã thêm ${quantity} sản phẩm vào giỏ hàng.`,
        ),
      );
    } catch (error) {
      showCartError(
        getApiErrorMessage(error, "Không thể thêm sản phẩm vào giỏ hàng."),
      );
    } finally {
      setIsAddingToCart(false);
    }
  };

  const formatPrice = (price: number) =>
    price ? `${Number(price).toLocaleString("vi-VN")} đ` : "0 đ";

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const translateFuncStatus = (status: string) => {
    if (status === "FullyFunctional") return "Hoạt động hoàn hảo";
    if (status === "PartiallyFunctional") return "Hoạt động một phần";
    if (status === "NonFunctional") return "Không hoạt động";
    return "Không rõ";
  };

  const translateDamage = (level: string) => {
    if (level === "None") return "Như mới";
    if (level === "Cosmetic_Damage") return "Trầy xước ngoại hình";
    if (level === "Minor_Damage") return "Hư hỏng nhẹ";
    if (level === "Moderate_Damage") return "Hư hỏng vừa";
    if (level === "Severe_Damage") return "Hư hỏng nặng";
    if (level === "Total_Loss") return "Mất chức năng";
    return "Không rõ";
  };

  const translateSpace = (space: string) => {
    const spaces: Record<string, string> = {
      Living_room: "Phòng khách",
      Kitchen: "Nhà bếp",
      Bedroom: "Phòng ngủ",
      Bathroom: "Phòng tắm",
      Laundry_room: "Phòng giặt",
      Balcony: "Ban công",
      Garage: "Garage",
      Restroom: "Nhà vệ sinh",
    };
    return spaces[space] || space || "Không rõ";
  };

  const getEavValue = (attribute: any) =>
    attribute.optionValue ||
    attribute.valueText ||
    attribute.valueNumber ||
    (attribute.valueBoolean !== null && attribute.valueBoolean !== undefined
      ? attribute.valueBoolean
        ? "Có"
        : "Không"
      : "N/A");

  if (isLoading && !post) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Đang tải chi tiết...</Text>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        {pageFeedback ? (
          <InlineFeedback
            feedback={pageFeedback}
            onDismiss={clearPageFeedback}
            style={styles.emptyFeedback}
          />
        ) : (
          <Text style={styles.notFoundText}>Không tìm thấy bài đăng!</Text>
        )}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (isBusinessViewingForeignBuy) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Ionicons name="business-outline" size={52} color={COLORS.textLight} />
        <Text style={styles.restrictedTitle}>Tin không khả dụng</Text>
        <Text style={styles.restrictedText}>
          Tài khoản doanh nghiệp không thể xem hoặc tương tác với tin thu mua
          của doanh nghiệp khác.
        </Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backBtnText}>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const product = post.product || {};
  const address = [post.streetAddress, post.ward, post.city]
    .filter(Boolean)
    .join(", ");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết tin đăng</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scrollView}>
        <View style={styles.imageContainer}>
          {post.medias && post.medias.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {post.medias.map((image: any) => (
                <Image
                  key={image.mediaId}
                  source={{ uri: image.url || image.mediaUrl }}
                  style={styles.mainImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.mainImage, styles.imagePlaceholder]}>
              <Ionicons name="image-outline" size={48} color="#547B7D" />
              <Text style={styles.imagePlaceholderText}>Không có hình ảnh</Text>
            </View>
          )}

          {post.medias && post.medias.length > 1 ? (
            <View style={styles.imageBadge}>
              <Text style={styles.imageBadgeText}>1 / {post.medias.length}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.productName}>
            {product.productName ||
              post.productName ||
              "Sản phẩm chưa cập nhật tên"}
          </Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(post.basePrice)}</Text>
            {product.originalPrice ? (
              <Text style={styles.originalPrice}>
                {formatPrice(product.originalPrice)}
              </Text>
            ) : null}
          </View>
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {post.postType === "Sell" ? "Tin Bán" : "Tin Mua"}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mô tả chung</Text>
          <Text style={styles.description}>{post.description || "Chưa có mô tả."}</Text>
          {product.detailDescription ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Mô tả tình trạng chi tiết</Text>
              <Text style={styles.detailDescription}>
                {product.detailDescription}
              </Text>
            </>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông số kỹ thuật</Text>
          <View style={styles.specGrid}>
            {product.categoryName ? (
              <SpecItem
                icon="grid-outline"
                label="Danh mục"
                value={product.categoryName}
              />
            ) : null}
            {product.productTypeName ? (
              <SpecItem
                icon="layers-outline"
                label="Loại sản phẩm"
                value={product.productTypeName}
              />
            ) : null}
            {product.brandName ? (
              <SpecItem
                icon="shield-checkmark-outline"
                label="Thương hiệu"
                value={product.brandName}
              />
            ) : null}
            {product.modelNumber ? (
              <SpecItem
                icon="barcode-outline"
                label="Mã Model"
                value={product.modelNumber}
                fullWidth
              />
            ) : null}
            {product.functionalityStatus ? (
              <SpecItem
                icon="build-outline"
                label="Tình trạng"
                value={translateFuncStatus(product.functionalityStatus)}
              />
            ) : null}
            {product.damageLevel ? (
              <SpecItem
                icon="bandage-outline"
                label="Hư hại"
                value={translateDamage(product.damageLevel)}
              />
            ) : null}
            {product.usageDuration ? (
              <SpecItem
                icon="time-outline"
                label="Thời gian SD"
                value={`${product.usageDuration} năm`}
              />
            ) : null}
            {product.spaceUsage ? (
              <SpecItem
                icon="home-outline"
                label="Không gian"
                value={translateSpace(product.spaceUsage)}
              />
            ) : null}
            {product.length || product.width || product.height ? (
              <SpecItem
                icon="expand-outline"
                label="Kích thước (DxRxC)"
                value={`${product.length || 0} x ${product.width || 0} x ${
                  product.height || 0
                } cm`}
              />
            ) : null}
            {product.weight ? (
              <SpecItem
                icon="barbell-outline"
                label="Khối lượng"
                value={`${product.weight} kg`}
              />
            ) : null}
            {product.attributeValues?.map((attribute: any, index: number) => {
              const unitText =
                attribute.unit && attribute.unit !== "string"
                  ? ` ${attribute.unit}`
                  : "";
              return (
                <SpecItem
                  key={attribute.attributeId || index}
                  icon="pricetag-outline"
                  label={attribute.attributeName}
                  value={`${getEavValue(attribute)}${unitText}`}
                  fullWidth
                />
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin giao dịch</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Số lượng:</Text>
            <Text style={styles.infoValue}>
              {post.remainingQuantity} / {post.quantity}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vận chuyển:</Text>
            <Text style={styles.infoValue}>
              {post.deliveryMethod || "Chưa cập nhật"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Địa chỉ:</Text>
            <Text style={styles.infoValue}>{address || "Chưa cập nhật"}</Text>
          </View>
        </View>

        <View style={[styles.section, styles.lastSection]}>
          <Text style={styles.dateText}>Ngày đăng: {formatDate(post.createdAt)}</Text>
          <Text style={styles.dateText}>
            Cập nhật lần cuối: {formatDate(post.updatedAt)}
          </Text>
          <Text style={styles.dateText}>
            Ngày hết hạn: {formatDate(post.expiryDate)}
          </Text>
        </View>
      </ScrollView>

      {pageFeedback ? (
        <Text
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
          style={[
            styles.actionMessage,
            pageFeedback.type === "error"
              ? styles.actionMessageError
              : pageFeedback.type === "success"
                ? styles.actionMessageSuccess
                : pageFeedback.type === "warning"
                  ? styles.actionMessageWarning
                  : styles.actionMessageInfo,
          ]}
        >
          {pageFeedback.message}
        </Text>
      ) : null}

      {!isViewOnly && post.status !== "Deleted" ? (
        <View style={styles.bottomBar}>
          {isMyPost ? (
            <>
              {post.status === "Active" ? (
                <TouchableOpacity style={styles.dangerBtn} onPress={handleClosePost}>
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color={COLORS.error}
                  />
                  <Text style={styles.dangerBtnText}>Đóng tin</Text>
                </TouchableOpacity>
              ) : post.status === "Closed" ? (
                <TouchableOpacity
                  style={styles.reactivateBtn}
                  onPress={handleReactivatePost}
                >
                  <Ionicons
                    name="refresh-circle-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                  <Text style={styles.reactivateBtnText}>Mở lại tin</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() =>
                  router.push({
                    pathname: "/posts/post-form",
                    params: { editId: post.postId, postType: post.postType },
                  })
                }
              >
                <Ionicons name="pencil" size={20} color={COLORS.white} />
                <Text style={styles.primaryBtnText}>Sửa tin đăng</Text>
              </TouchableOpacity>
            </>
          ) : post.status === "Active" ? (
            <View style={styles.customerActions}>
              {post.postType === "Sell" ? (
                <TouchableOpacity
                  style={[
                    styles.cartBtn,
                    isAddingToCart ? styles.disabledButton : undefined,
                  ]}
                  onPress={handleOpenCartModal}
                  disabled={isAddingToCart}
                >
                  {isAddingToCart ? (
                    <ActivityIndicator size="small" color={COLORS.primary} />
                  ) : (
                    <Ionicons name="cart-outline" size={20} color={COLORS.primary} />
                  )}
                  <Text style={styles.cartBtnText}>
                    {isAddingToCart ? "Đang thêm..." : "Thêm giỏ hàng"}
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={[
                  styles.negotiateBtn,
                  existingOfferId ? styles.sentOfferBtn : undefined,
                ]}
                onPress={handleOpenOffer}
              >
                <Ionicons
                  name={
                    existingOfferId
                      ? "document-text-outline"
                      : "chatbubbles"
                  }
                  size={20}
                  color={COLORS.white}
                />
                <Text style={styles.negotiateBtnText}>
                  {existingOfferId ? "Xem đề nghị đã gửi" : "Thương lượng"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.closedPostContainer}>
              <Text style={styles.closedPostText}>Tin đăng này hiện đã đóng</Text>
            </View>
          )}
        </View>
      ) : null}

      <Modal
        visible={showCartModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isAddingToCart) setShowCartModal(false);
        }}
      >
        <ModalBackdrop
          style={styles.modalOverlay}
          disabled={isAddingToCart}
          onPress={() => setShowCartModal(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <ModalSurface style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thêm vào giỏ hàng</Text>
              <TouchableOpacity
                onPress={() => setShowCartModal(false)}
                disabled={isAddingToCart}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {cartFeedback ? (
                <InlineFeedback
                  feedback={cartFeedback}
                  onDismiss={clearCartFeedback}
                />
              ) : null}

              <View>
                <Text style={styles.cartModalProductName} numberOfLines={2}>
                  {product.productName || post.productName || "Sản phẩm"}
                </Text>
                <Text style={styles.cartModalPrice}>
                  {formatPrice(post.basePrice)} / sản phẩm
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Số lượng (Tối đa: {post.remainingQuantity}){" "}
                  <Text style={{ color: COLORS.error }}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === "web"
                      ? ({ outlineStyle: "none" } as any)
                      : undefined,
                  ]}
                  keyboardType="number-pad"
                  value={cartQuantity}
                  onChangeText={(value) => {
                    setCartQuantity(value.replace(/[^0-9]/g, ""));
                    setCartAdded(false);
                    clearCartFeedback();
                  }}
                  placeholder="Nhập số lượng..."
                  editable={!isAddingToCart}
                  selectTextOnFocus
                />
              </View>

              <View style={styles.cartModalTotalRow}>
                <Text style={styles.cartModalTotalLabel}>Tạm tính</Text>
                <Text style={styles.cartModalTotalValue}>
                  {formatPrice(
                    Number(post.basePrice || 0) * Number(cartQuantity || 0),
                  )}
                </Text>
              </View>

              {cartAdded ? (
                <View style={styles.cartSuccessActions}>
                  <TouchableOpacity
                    style={styles.cartBtn}
                    onPress={() => setShowCartModal(false)}
                  >
                    <Text style={styles.cartBtnText}>Tiếp tục xem</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.primaryBtn}
                    onPress={() => {
                      setShowCartModal(false);
                      router.push("/(tabs)/cart");
                    }}
                  >
                    <Text style={styles.primaryBtnText}>Xem giỏ hàng</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    styles.modalSubmitBtn,
                    isAddingToCart ? styles.disabledButton : undefined,
                  ]}
                  onPress={() => void handleAddToCart()}
                  disabled={isAddingToCart}
                >
                  {isAddingToCart ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons name="cart-outline" size={20} color={COLORS.white} />
                      <Text style={styles.primaryBtnText}>Thêm vào giỏ hàng</Text>
                    </>
                  )}
                </TouchableOpacity>
              )}
            </View>
            </ModalSurface>
          </KeyboardAvoidingView>
        </ModalBackdrop>
      </Modal>

      <Modal
        visible={showOfferModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSubmittingOffer) setShowOfferModal(false);
        }}
      >
        <ModalBackdrop
          style={styles.modalOverlay}
          disabled={isSubmittingOffer}
          onPress={() => setShowOfferModal(false)}
        >
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"}>
            <ModalSurface style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Thương lượng giá</Text>
              <TouchableOpacity
                onPress={() => setShowOfferModal(false)}
                disabled={isSubmittingOffer}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              {offerFeedback ? (
                <InlineFeedback
                  feedback={offerFeedback}
                  onDismiss={clearOfferFeedback}
                />
              ) : null}

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Số lượng (Tối đa: {post.remainingQuantity}){" "}
                  <Text style={{ color: COLORS.error }}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === "web"
                      ? ({ outlineStyle: "none" } as any)
                      : undefined,
                  ]}
                  keyboardType="number-pad"
                  value={offerQuantity}
                  onChangeText={(value) => {
                    setOfferQuantity(value.replace(/[^0-9]/g, ""));
                    clearOfferFeedback();
                  }}
                  placeholder="Nhập số lượng..."
                  editable={!isSubmittingOffer}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  {post.postType === "Buy"
                    ? "Giá dự kiến của người mua"
                    : "Giá mong muốn của người bán"}
                </Text>
                <View style={styles.readOnlyInput}>
                  <Text style={styles.readOnlyText}>{formatPrice(post.basePrice)}</Text>
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Giá thương lượng (VNĐ){" "}
                  <Text style={{ color: COLORS.error }}>*</Text>
                </Text>
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === "web"
                      ? ({ outlineStyle: "none" } as any)
                      : undefined,
                  ]}
                  keyboardType="number-pad"
                  value={offerPrice}
                  onChangeText={(value) => {
                    setOfferPrice(value.replace(/[^0-9]/g, ""));
                    clearOfferFeedback();
                  }}
                  placeholder="Ví dụ: 1500000"
                  editable={!isSubmittingOffer}
                />
              </View>

              <View style={styles.offerActions}>
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    styles.modalSubmitBtn,
                    isSubmittingOffer ? styles.disabledButton : undefined,
                  ]}
                  onPress={() => void handleCreateOffer()}
                  disabled={isSubmittingOffer}
                >
                  {isSubmittingOffer ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <>
                      <Ionicons
                        name="paper-plane-outline"
                        size={20}
                        color={COLORS.white}
                      />
                      <Text style={styles.primaryBtnText}>Gửi đề nghị</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
            </ModalSurface>
          </KeyboardAvoidingView>
        </ModalBackdrop>
      </Modal>

      {confirmationModal}
    </SafeAreaView>
  );
}

function SpecItem({
  icon,
  label,
  value,
  fullWidth = false,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  label: string;
  value: string;
  fullWidth?: boolean;
}) {
  return (
    <View style={[styles.specItem, fullWidth ? styles.fullWidthSpec : undefined]}>
      <Ionicons name={icon} size={18} color={COLORS.textLight} />
      <View style={styles.specContent}>
        <Text style={styles.specLabel}>{label}</Text>
        <Text style={styles.specValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.white },
  scrollView: { backgroundColor: "#F8F9FA" },
  localFeedback: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
  },
  localFeedbackText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    fontWeight: "600",
  },
  feedbackDismissButton: { padding: 1 },
  confirmOverlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  confirmCard: {
    width: "100%",
    maxWidth: 420,
    padding: 18,
    borderRadius: 14,
    backgroundColor: COLORS.white,
  },
  confirmTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  confirmMessage: {
    marginTop: 8,
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 19,
  },
  confirmActions: { flexDirection: "row", gap: 10, marginTop: 18 },
  confirmCancelButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  confirmCancelText: { color: COLORS.text, fontWeight: "700" },
  confirmPrimaryButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 9,
    backgroundColor: COLORS.primary,
  },
  confirmDestructiveButton: { backgroundColor: COLORS.error },
  confirmPrimaryText: { color: COLORS.white, fontWeight: "800" },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white,
    paddingHorizontal: 20,
  },
  loadingText: { marginTop: 12, color: COLORS.textLight },
  notFoundText: { color: COLORS.error, fontSize: 16, textAlign: "center" },
  restrictedTitle: {
    marginTop: 14,
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
  },
  restrictedText: {
    marginTop: 8,
    maxWidth: 360,
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  emptyFeedback: { width: "100%", maxWidth: 420 },
  backBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },
  backBtnText: { color: COLORS.white, fontWeight: "600" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  headerIcon: { padding: 8 },
  headerSpacer: { width: 40, height: 40 },
  imageContainer: { position: "relative", backgroundColor: COLORS.white },
  mainImage: { width, height: 300 },
  imagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#F8F9FA",
  },
  imagePlaceholderText: { color: "#547B7D", marginTop: 8 },
  imageBadge: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },
  imageBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: "bold" },
  section: {
    backgroundColor: COLORS.white,
    padding: 16,
    marginBottom: 8,
  },
  lastSection: { marginBottom: 30 },
  productName: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
    lineHeight: 26,
    marginBottom: 8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  price: { fontSize: 22, fontWeight: "bold", color: COLORS.error },
  originalPrice: {
    fontSize: 14,
    color: COLORS.textLight,
    textDecorationLine: "line-through",
  },
  tagRow: { flexDirection: "row", gap: 8 },
  tag: {
    backgroundColor: "#F8F9FA",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  tagText: { fontSize: 12, color: "#547B7D", fontWeight: "600" },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 12,
  },
  specGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -8 },
  specItem: {
    width: "50%",
    flexDirection: "row",
    padding: 8,
    alignItems: "flex-start",
    gap: 8,
  },
  fullWidthSpec: { width: "100%" },
  specContent: { flex: 1 },
  specLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 2 },
  specValue: { fontSize: 14, color: COLORS.text, fontWeight: "500" },
  infoRow: { flexDirection: "row", marginBottom: 8 },
  infoLabel: { width: 100, fontSize: 14, color: COLORS.textLight },
  infoValue: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: "500" },
  description: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  detailDescription: {
    fontSize: 14,
    color: "#547B7D",
    lineHeight: 22,
    fontStyle: "italic",
  },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  dateText: { fontSize: 11, color: COLORS.textLight, marginBottom: 4 },
  bottomBar: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },
  actionMessage: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: COLORS.white,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 18,
    textAlign: "right",
  },
  actionMessageError: { color: COLORS.error },
  actionMessageSuccess: { color: "#2F765D" },
  actionMessageWarning: { color: "#9A6418" },
  actionMessageInfo: { color: COLORS.primary },
  customerActions: { flex: 1, flexDirection: "row", gap: 12 },
  closedPostContainer: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#F8F9FA",
    borderRadius: 8,
  },
  closedPostText: { color: COLORS.textLight, fontWeight: "bold" },
  dangerBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: "rgba(122, 16, 18, 0.08)",
  },
  dangerBtnText: { color: COLORS.error, fontWeight: "bold", fontSize: 15 },
  reactivateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: "rgba(84, 123, 125, 0.10)",
  },
  reactivateBtnText: { color: COLORS.primary, fontWeight: "bold", fontSize: 15 },
  primaryBtn: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: { color: COLORS.white, fontWeight: "bold", fontSize: 15 },
  cartBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.white,
  },
  cartBtnText: { color: COLORS.primary, fontWeight: "bold", fontSize: 14 },
  disabledButton: { opacity: 0.65 },
  negotiateBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  negotiateBtnText: {
    color: COLORS.white,
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
  },
  sentOfferBtn: { backgroundColor: "#547B7D" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === "ios" ? 40 : 24,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  modalBody: { gap: 16 },
  modalSubmitBtn: {
    alignSelf: "center",
    flex: 0,
    width: "72%",
    minWidth: 230,
    maxWidth: 320,
    minHeight: 52,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 14,
  },
  cartModalProductName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 22,
  },
  cartModalPrice: {
    marginTop: 5,
    color: COLORS.error,
    fontSize: 14,
    fontWeight: "700",
  },
  cartModalTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  cartModalTotalLabel: { color: COLORS.textLight, fontSize: 14 },
  cartModalTotalValue: { color: COLORS.error, fontSize: 18, fontWeight: "800" },
  cartSuccessActions: { flexDirection: "row", gap: 12 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 15,
    backgroundColor: "#F8F9FA",
    color: COLORS.text,
  },
  readOnlyInput: {
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    justifyContent: "center",
    backgroundColor: "#F8F9FA",
  },
  readOnlyText: { fontSize: 15, color: COLORS.textLight, fontWeight: "bold" },
  offerActions: { marginTop: 16 },
});