import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
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

const postApi = {
  getPostById: (postId: string) =>
    apiClient
      .get(`/posts/get-by-id/${postId}`)
      .then((response) => response.data),

  closePost: (postId: string) =>
    apiClient
      .patch(`/posts/${postId}/close`)
      .then((response) => response.data),

  reactivatePost: (postId: string) =>
    apiClient
      .patch(`/posts/${postId}/reactivate`)
      .then((response) => response.data),
};

const offerApi = {
  createOffer: (data: {
    postId: string;
    offerPrice: number;
    offerQuantity: number;
  }) =>
    apiClient
      .post("/offers", data)
      .then((response) => response.data),

  updateOffer: (
    offerId: string,
    data: {
      offerPrice: number;
      offerQuantity: number;
    },
  ) =>
    apiClient
      .put(`/offers/${offerId}`, data)
      .then((response) => response.data),

  getOfferById: (offerId: string) =>
    apiClient
      .get(`/offers/${offerId}`)
      .then((response) => response.data),

  cancelOffer: (offerId: string) =>
    apiClient
      .post(`/offers/${offerId}/cancel`)
      .then((response) => response.data),

  getSentOffers: (params?: {
    PageNumber?: number;
    PageSize?: number;
  }) =>
    apiClient
      .get("/offers/sent", { params })
      .then((response) => response.data),
};

const cartApi = {
  addToCart: (postId: string, quantity: number) =>
    apiClient
      .post(`/cart/${postId}`, { quantity })
      .then((response) => response.data),
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

  const [existingOfferId, setExistingOfferId] = useState<string | null>(
    null,
  );

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerQuantity, setOfferQuantity] = useState("1");
  const [offerPrice, setOfferPrice] = useState("");
  const [isSubmittingOffer, setIsSubmittingOffer] = useState(false);
  const [isLoadingOfferData, setIsLoadingOfferData] = useState(false);

  const [showCartModal, setShowCartModal] = useState(false);
  const [cartQuantity, setCartQuantity] = useState("1");
  const [isAddingToCart, setIsAddingToCart] = useState(false);

  const fetchPostData = async () => {
    if (!id) return;

    try {
      setIsLoading(true);

      const resPost = await postApi.getPostById(id as string);
      const postData = resPost?.data || resPost;

      setPost(postData);

      if (user && postData?.ownerId !== currentUserId) {
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

        if (pendingOffer) {
          setExistingOfferId(pendingOffer.offerId);
        } else {
          setExistingOfferId(null);
        }
      }
    } catch (error) {
      console.error("Lỗi lấy dữ liệu:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void fetchPostData();
    }, [id, user]),
  );

  const isMyPost =
    currentUserId &&
    post?.ownerId &&
    currentUserId === post.ownerId;

  const handleClosePost = () => {
    const targetPostId = post?.postId;

    if (!targetPostId) {
      alert("Không tìm thấy ID bài đăng.");
      return;
    }

    const executeClose = async () => {
      try {
        setIsLoading(true);
        await postApi.closePost(targetPostId);

        if (Platform.OS === "web") {
          window.alert("Đã đóng bài đăng thành công.");
        } else {
          Alert.alert("Thành công", "Đã đóng bài đăng.");
        }

        await fetchPostData();
      } catch (error: any) {
        const errorMsg =
          error.response?.data?.message ||
          "Không thể đóng bài đăng lúc này.";

        if (Platform.OS === "web") {
          window.alert(`Lỗi: ${errorMsg}`);
        } else {
          Alert.alert("Lỗi", errorMsg);
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Bạn có chắc chắn muốn đóng tin đăng này không? Tin sẽ kết thúc giao dịch và không hiển thị trên trang chủ nữa.",
      );

      if (confirmed) {
        void executeClose();
      }

      return;
    }

    Alert.alert(
      "Đóng bài đăng",
      "Bạn có chắc chắn muốn đóng tin đăng này không?",
      [
        {
          text: "Hủy",
          style: "cancel",
        },
        {
          text: "Đóng bài",
          style: "destructive",
          onPress: () => void executeClose(),
        },
      ],
    );
  };

  const handleReactivatePost = () => {
    const targetPostId = post?.postId;

    if (!targetPostId) {
      alert("Không tìm thấy ID bài đăng.");
      return;
    }

    const executeReactivate = async () => {
      try {
        setIsLoading(true);
        await postApi.reactivatePost(targetPostId);

        if (Platform.OS === "web") {
          window.alert("Đã mở lại bài đăng thành công.");
        } else {
          Alert.alert("Thành công", "Đã mở lại bài đăng.");
        }

        await fetchPostData();
      } catch (error: any) {
        const errorMsg =
          error.response?.data?.message ||
          "Không thể mở lại bài đăng lúc này.";

        if (Platform.OS === "web") {
          window.alert(`Lỗi: ${errorMsg}`);
        } else {
          Alert.alert("Lỗi", errorMsg);
        }
      } finally {
        setIsLoading(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Bạn có chắc chắn muốn mở lại tin đăng này?",
      );

      if (confirmed) {
        void executeReactivate();
      }

      return;
    }

    Alert.alert(
      "Mở lại bài đăng",
      "Bạn có chắc chắn muốn mở lại tin đăng này?",
      [
        {
          text: "Hủy",
          style: "cancel",
        },
        {
          text: "Mở lại",
          onPress: () => void executeReactivate(),
        },
      ],
    );
  };

  const handleOpenOffer = async () => {
    if (!user) {
      router.push(`/(auth)/login?returnUrl=/posts/${id}`);
      return;
    }

    if (existingOfferId) {
      setIsLoadingOfferData(true);
      setShowOfferModal(true);

      try {
        const response = await offerApi.getOfferById(existingOfferId);
        const data = response?.data || response;

        setOfferQuantity(data.offerQuantity?.toString() || "1");
        setOfferPrice(data.offerPrice?.toString() || "");
      } catch {
        Alert.alert(
          "Lỗi",
          "Không thể tải dữ liệu thương lượng cũ.",
        );

        setShowOfferModal(false);
      } finally {
        setIsLoadingOfferData(false);
      }

      return;
    }

    setOfferQuantity("1");
    setOfferPrice("");
    setShowOfferModal(true);
  };

  const validateOfferForm = () => {
    const quantity = parseInt(offerQuantity, 10);
    const price = parseInt(offerPrice, 10);

    if (Number.isNaN(quantity) || quantity <= 0) {
      Alert.alert("Lỗi", "Số lượng không hợp lệ!");
      return null;
    }

    if (quantity > post.remainingQuantity) {
      Alert.alert(
        "Lỗi",
        `Số lượng tối đa là ${post.remainingQuantity}!`,
      );

      return null;
    }

    if (Number.isNaN(price) || price <= 0) {
      Alert.alert("Lỗi", "Vui lòng nhập giá hợp lệ!");
      return null;
    }

    return {
      quantity,
      price,
    };
  };

  const handleCreateOffer = async () => {
    const valid = validateOfferForm();

    if (!valid) return;

    try {
      setIsSubmittingOffer(true);

      await offerApi.createOffer({
        postId: id as string,
        offerPrice: valid.price,
        offerQuantity: valid.quantity,
      });

      if (Platform.OS === "web") {
        window.alert("Đã gửi đề nghị thương lượng!");
      } else {
        Alert.alert(
          "Thành công",
          "Đã gửi đề nghị thương lượng!",
        );
      }

      setShowOfferModal(false);
      await fetchPostData();
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        "Không thể gửi đề nghị.";

      if (Platform.OS === "web") {
        window.alert(`Lỗi: ${errorMsg}`);
      } else {
        Alert.alert("Lỗi", errorMsg);
      }
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  const handleUpdateOffer = async () => {
    if (!existingOfferId) return;

    const valid = validateOfferForm();

    if (!valid) return;

    try {
      setIsSubmittingOffer(true);

      await offerApi.updateOffer(existingOfferId, {
        offerPrice: valid.price,
        offerQuantity: valid.quantity,
      });

      if (Platform.OS === "web") {
        window.alert("Đã cập nhật thương lượng!");
      } else {
        Alert.alert(
          "Thành công",
          "Đã cập nhật thương lượng!",
        );
      }

      setShowOfferModal(false);
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        "Không thể cập nhật đề nghị.";

      if (Platform.OS === "web") {
        window.alert(`Lỗi: ${errorMsg}`);
      } else {
        Alert.alert("Lỗi", errorMsg);
      }
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  const handleCancelOffer = () => {
    if (!existingOfferId) return;

    const executeCancel = async () => {
      try {
        setIsSubmittingOffer(true);

        await offerApi.cancelOffer(existingOfferId);

        if (Platform.OS === "web") {
          window.alert("Đã hủy thương lượng thành công.");
        } else {
          Alert.alert(
            "Thành công",
            "Đã hủy thương lượng.",
          );
        }

        setShowOfferModal(false);
        setExistingOfferId(null);
      } catch (error: any) {
        const errorMsg =
          error.response?.data?.message ||
          "Không thể hủy đề nghị.";

        if (Platform.OS === "web") {
          window.alert(`Lỗi: ${errorMsg}`);
        } else {
          Alert.alert("Lỗi", errorMsg);
        }
      } finally {
        setIsSubmittingOffer(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Bạn có chắc chắn muốn hủy đề nghị này không?",
      );

      if (confirmed) {
        void executeCancel();
      }

      return;
    }

    Alert.alert(
      "Xác nhận",
      "Bạn có chắc chắn muốn hủy đề nghị này không?",
      [
        {
          text: "Không",
          style: "cancel",
        },
        {
          text: "Hủy đề nghị",
          style: "destructive",
          onPress: () => void executeCancel(),
        },
      ],
    );
  };

  const handleOpenCartModal = () => {
  const targetPostId =
    post?.postId || (Array.isArray(id) ? id[0] : id);

  if (!user) {
    router.push({
      pathname: "/(auth)/login",
      params: {
        returnUrl: `/posts/${targetPostId || ""}`,
      },
    });

    return;
  }

  if (!targetPostId) {
    const message =
      "Không tìm thấy bài đăng cần thêm vào giỏ hàng.";

    if (Platform.OS === "web") {
      window.alert(message);
    } else {
      Alert.alert("Lỗi", message);
    }

    return;
  }

  if (
    currentUserId &&
    post?.ownerId &&
    String(currentUserId) === String(post.ownerId)
  ) {
    const message =
      "Bạn không thể thêm bài đăng của chính mình vào giỏ hàng.";

    if (Platform.OS === "web") {
      window.alert(message);
    } else {
      Alert.alert("Không thể thêm", message);
    }

    return;
  }

  if (post?.status !== "Active") {
    const message = "Bài đăng này hiện không còn hoạt động.";

    if (Platform.OS === "web") {
      window.alert(message);
    } else {
      Alert.alert("Không thể thêm", message);
    }

    return;
  }

  if (Number(post?.remainingQuantity || 0) <= 0) {
    const message = "Sản phẩm này hiện đã hết số lượng.";

    if (Platform.OS === "web") {
      window.alert(message);
    } else {
      Alert.alert("Không thể thêm", message);
    }

    return;
  }

  setCartQuantity("1");
  setShowCartModal(true);
};

  const handleAddToCart = async () => {
    const targetPostId =
      post?.postId || (Array.isArray(id) ? id[0] : id);

    const quantity = Number(cartQuantity);

    if (!targetPostId) return;

    if (!Number.isInteger(quantity) || quantity <= 0) {
      const message = "Số lượng phải là số nguyên lớn hơn 0.";

      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Số lượng không hợp lệ", message);
      }

      return;
    }

    if (quantity > Number(post?.remainingQuantity || 0)) {
      const message =
        `Số lượng tối đa là ${post?.remainingQuantity || 0}.`;

      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Số lượng không hợp lệ", message);
      }

      return;
    }

    try {
      setIsAddingToCart(true);

      const response = await cartApi.addToCart(
        targetPostId,
        quantity,
      );

      if (response?.isSuccess === false) {
        throw new Error(
          response?.error?.message ||
            "Không thể thêm sản phẩm vào giỏ hàng.",
        );
      }

      setShowCartModal(false);

      const successMessage =
        `Đã thêm ${quantity} sản phẩm vào giỏ hàng.`;

      if (Platform.OS === "web") {
        const openCart = window.confirm(
          `${successMessage}\n\nBạn có muốn mở giỏ hàng không?`,
        );

        if (openCart) {
          router.push("/(tabs)/cart");
        }
      } else {
        Alert.alert(
          "Đã thêm vào giỏ hàng",
          successMessage,
          [
            {
              text: "Tiếp tục xem",
              style: "cancel",
            },
            {
              text: "Xem giỏ hàng",
              onPress: () => router.push("/(tabs)/cart"),
            },
          ],
        );
      }
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.response?.data?.message ||
        error?.message ||
        "Không thể thêm sản phẩm vào giỏ hàng.";

      if (Platform.OS === "web") {
        window.alert(message);
      } else {
        Alert.alert("Lỗi", message);
      }
    } finally {
      setIsAddingToCart(false);
    }
  };

  const formatPrice = (price: number) =>
    price
      ? `${price.toLocaleString("vi-VN")} đ`
      : "0 đ";

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";

    const date = new Date(dateString);

    return date.toLocaleDateString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const translateFuncStatus = (status: string) => {
    if (status === "FullyFunctional") {
      return "Hoạt động hoàn hảo";
    }

    if (status === "PartiallyFunctional") {
      return "Hoạt động một phần";
    }

    if (status === "NonFunctional") {
      return "Không hoạt động";
    }

    return "Không rõ";
  };

  const translateDamage = (level: string) => {
    if (level === "None") {
      return "Như mới";
    }

    if (level === "Cosmetic_Damage") {
      return "Trầy xước ngoại hình";
    }

    if (level === "Minor_Damage") {
      return "Hư hỏng nhẹ";
    }

    if (level === "Moderate_Damage") {
      return "Hư hỏng vừa";
    }

    if (level === "Severe_Damage") {
      return "Hư hỏng nặng";
    }

    if (level === "Total_Loss") {
      return "Mất chức năng";
    }

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
    (attribute.valueBoolean !== null &&
    attribute.valueBoolean !== undefined
      ? attribute.valueBoolean
        ? "Có"
        : "Không"
      : "N/A");

  if (isLoading && !post) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={COLORS.primary}
        />

        <Text
          style={{
            marginTop: 12,
            color: COLORS.textLight,
          }}
        >
          Đang tải chi tiết...
        </Text>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text
          style={{
            color: COLORS.error,
            fontSize: 16,
          }}
        >
          Không tìm thấy bài đăng!
        </Text>

        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
        >
          <Text style={{ color: COLORS.white }}>
            Quay lại
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const product = post.product || {};

  const address = [
    post.streetAddress,
    post.ward,
    post.city,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.headerIcon}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color={COLORS.text}
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Chi tiết tin đăng
        </Text>

        <TouchableOpacity style={styles.headerIcon}>
          <Ionicons
            name="share-social-outline"
            size={24}
            color={COLORS.text}
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        style={{ backgroundColor: "#F1F5F9" }}
      >
        <View style={styles.imageContainer}>
          {post.medias && post.medias.length > 0 ? (
            <ScrollView
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
            >
              {post.medias.map((image: any) => (
                <Image
                  key={image.mediaId}
                  source={{
                    uri: image.url || image.mediaUrl,
                  }}
                  style={styles.mainImage}
                  resizeMode="cover"
                />
              ))}
            </ScrollView>
          ) : (
            <View
              style={[
                styles.mainImage,
                styles.imagePlaceholder,
              ]}
            >
              <Ionicons
                name="image-outline"
                size={48}
                color="#94A3B8"
              />

              <Text style={styles.imagePlaceholderText}>
                Không có hình ảnh
              </Text>
            </View>
          )}

          {post.medias && post.medias.length > 1 && (
            <View style={styles.imageBadge}>
              <Text style={styles.imageBadgeText}>
                1 / {post.medias.length}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.productName}>
            {product.productName ||
              post.productName ||
              "Sản phẩm chưa cập nhật tên"}
          </Text>

          <View style={styles.priceRow}>
            <Text style={styles.price}>
              {formatPrice(post.basePrice)}
            </Text>

            {product.originalPrice ? (
              <Text style={styles.originalPrice}>
                {formatPrice(product.originalPrice)}
              </Text>
            ) : null}
          </View>

          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>
                {post.postType === "Sell"
                  ? "Tin Bán"
                  : "Tin Mua"}
              </Text>
            </View>

            <View
              style={[
                styles.tag,
                {
                  backgroundColor:
                    post.status === "Active"
                      ? "#D1FAE5"
                      : post.status === "Closed"
                        ? "#E2E8F0"
                        : "#FEF3C7",
                },
              ]}
            >
              <Text
                style={[
                  styles.tagText,
                  {
                    color:
                      post.status === "Active"
                        ? "#10B981"
                        : post.status === "Closed"
                          ? "#475569"
                          : "#F59E0B",
                  },
                ]}
              >
                {post.status}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Thông số kỹ thuật
          </Text>

          <View style={styles.specGrid}>
            {product.categoryName && (
              <View style={styles.specItem}>
                <Ionicons
                  name="grid-outline"
                  size={18}
                  color={COLORS.textLight}
                />

                <View style={styles.specContent}>
                  <Text style={styles.specLabel}>
                    Danh mục
                  </Text>

                  <Text style={styles.specValue}>
                    {product.categoryName}
                  </Text>
                </View>
              </View>
            )}

            {product.productTypeName && (
              <View style={styles.specItem}>
                <Ionicons
                  name="layers-outline"
                  size={18}
                  color={COLORS.textLight}
                />

                <View style={styles.specContent}>
                  <Text style={styles.specLabel}>
                    Loại sản phẩm
                  </Text>

                  <Text style={styles.specValue}>
                    {product.productTypeName}
                  </Text>
                </View>
              </View>
            )}

            {product.brandName && (
              <View style={styles.specItem}>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color={COLORS.textLight}
                />

                <View style={styles.specContent}>
                  <Text style={styles.specLabel}>
                    Thương hiệu
                  </Text>

                  <Text style={styles.specValue}>
                    {product.brandName}
                  </Text>
                </View>
              </View>
            )}

            {product.modelNumber && (
              <View
                style={[
                  styles.specItem,
                  { width: "100%" },
                ]}
              >
                <Ionicons
                  name="barcode-outline"
                  size={18}
                  color={COLORS.textLight}
                />

                <View style={styles.specContent}>
                  <Text style={styles.specLabel}>
                    Mã Model
                  </Text>

                  <Text style={styles.specValue}>
                    {product.modelNumber}
                  </Text>
                </View>
              </View>
            )}

            {product.functionalityStatus && (
              <View style={styles.specItem}>
                <Ionicons
                  name="build-outline"
                  size={18}
                  color={COLORS.textLight}
                />

                <View style={styles.specContent}>
                  <Text style={styles.specLabel}>
                    Tình trạng
                  </Text>

                  <Text style={styles.specValue}>
                    {translateFuncStatus(
                      product.functionalityStatus,
                    )}
                  </Text>
                </View>
              </View>
            )}

            {product.damageLevel && (
              <View style={styles.specItem}>
                <Ionicons
                  name="bandage-outline"
                  size={18}
                  color={COLORS.textLight}
                />

                <View style={styles.specContent}>
                  <Text style={styles.specLabel}>
                    Hư hại
                  </Text>

                  <Text style={styles.specValue}>
                    {translateDamage(product.damageLevel)}
                  </Text>
                </View>
              </View>
            )}

            {product.usageDuration && (
              <View style={styles.specItem}>
                <Ionicons
                  name="time-outline"
                  size={18}
                  color={COLORS.textLight}
                />

                <View style={styles.specContent}>
                  <Text style={styles.specLabel}>
                    Thời gian SD
                  </Text>

                  <Text style={styles.specValue}>
                    {product.usageDuration} năm
                  </Text>
                </View>
              </View>
            )}

            {product.spaceUsage && (
              <View style={styles.specItem}>
                <Ionicons
                  name="home-outline"
                  size={18}
                  color={COLORS.textLight}
                />

                <View style={styles.specContent}>
                  <Text style={styles.specLabel}>
                    Không gian
                  </Text>

                  <Text style={styles.specValue}>
                    {translateSpace(product.spaceUsage)}
                  </Text>
                </View>
              </View>
            )}

            {(product.length ||
              product.width ||
              product.height) && (
              <View style={styles.specItem}>
                <Ionicons
                  name="expand-outline"
                  size={18}
                  color={COLORS.textLight}
                />

                <View style={styles.specContent}>
                  <Text style={styles.specLabel}>
                    Kích thước (DxRxC)
                  </Text>

                  <Text style={styles.specValue}>
                    {product.length || 0} x{" "}
                    {product.width || 0} x{" "}
                    {product.height || 0} cm
                  </Text>
                </View>
              </View>
            )}

            {product.weight && (
              <View style={styles.specItem}>
                <Ionicons
                  name="barbell-outline"
                  size={18}
                  color={COLORS.textLight}
                />

                <View style={styles.specContent}>
                  <Text style={styles.specLabel}>
                    Khối lượng
                  </Text>

                  <Text style={styles.specValue}>
                    {product.weight} kg
                  </Text>
                </View>
              </View>
            )}

            {product.attributeValues &&
              product.attributeValues.map(
                (attribute: any, index: number) => {
                  const unitText =
                    attribute.unit &&
                    attribute.unit !== "string"
                      ? ` ${attribute.unit}`
                      : "";

                  return (
                    <View
                      key={attribute.attributeId || index}
                      style={[
                        styles.specItem,
                        { width: "100%" },
                      ]}
                    >
                      <Ionicons
                        name="pricetag-outline"
                        size={18}
                        color={COLORS.textLight}
                      />

                      <View style={styles.specContent}>
                        <Text style={styles.specLabel}>
                          {attribute.attributeName}
                        </Text>

                        <Text style={styles.specValue}>
                          {getEavValue(attribute)}
                          {unitText}
                        </Text>
                      </View>
                    </View>
                  );
                },
              )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Thông tin giao dịch
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              Số lượng:
            </Text>

            <Text style={styles.infoValue}>
              {post.remainingQuantity} / {post.quantity}{" "}
              (Còn lại / Tổng)
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              Vận chuyển:
            </Text>

            <Text style={styles.infoValue}>
              {post.deliveryMethod}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              Địa chỉ:
            </Text>

            <Text style={styles.infoValue}>
              {address || "Chưa cập nhật"}
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Mô tả chung
          </Text>

          <Text style={styles.description}>
            {post.description}
          </Text>

          {product.detailDescription && (
            <>
              <View style={styles.divider} />

              <Text style={styles.sectionTitle}>
                Mô tả tình trạng chi tiết
              </Text>

              <Text style={styles.detailDescription}>
                {product.detailDescription}
              </Text>
            </>
          )}
        </View>

        <View
          style={[
            styles.section,
            { marginBottom: 30 },
          ]}
        >
          <Text style={styles.dateText}>
            Mã Tin: {post.postId}
          </Text>

          <Text style={styles.dateText}>
            Ngày đăng: {formatDate(post.createdAt)}
          </Text>

          <Text style={styles.dateText}>
            Cập nhật lần cuối: {formatDate(post.updatedAt)}
          </Text>

          <Text style={styles.dateText}>
            Ngày hết hạn: {formatDate(post.expiryDate)}
          </Text>
        </View>
      </ScrollView>

      {!isViewOnly && post.status !== "Deleted" && (
        <View style={styles.bottomBar}>
          {isMyPost ? (
            <>
              {post.status === "Active" ? (
                <TouchableOpacity
                  style={styles.dangerBtn}
                  onPress={handleClosePost}
                >
                  <Ionicons
                    name="close-circle-outline"
                    size={20}
                    color={COLORS.error}
                  />

                  <Text style={styles.dangerBtnText}>
                    Đóng tin
                  </Text>
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

                  <Text style={styles.reactivateBtnText}>
                    Mở lại tin
                  </Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() =>
                  router.push({
                    pathname: "/posts/post-form",
                    params: {
                      editId: post.postId,
                      postType: post.postType,
                    },
                  })
                }
              >
                <Ionicons
                  name="pencil"
                  size={20}
                  color={COLORS.white}
                />

                <Text style={styles.primaryBtnText}>
                  Sửa tin đăng
                </Text>
              </TouchableOpacity>
            </>
          ) : post.status === "Active" ? (
            <View style={styles.customerActions}>
              <TouchableOpacity
                style={[
                  styles.cartBtn,
                  isAddingToCart && styles.disabledButton,
                ]}
                onPress={handleOpenCartModal}
                disabled={isAddingToCart}
              >
                {isAddingToCart ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.primary}
                  />
                ) : (
                  <Ionicons
                    name="cart-outline"
                    size={20}
                    color={COLORS.primary}
                  />
                )}

                <Text style={styles.cartBtnText}>
                  {isAddingToCart
                    ? "Đang thêm..."
                    : "Thêm giỏ hàng"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.negotiateBtn,
                  existingOfferId && {
                    backgroundColor: "#0F172A",
                  },
                ]}
                onPress={handleOpenOffer}
              >
                <Ionicons
                  name={
                    existingOfferId
                      ? "create-outline"
                      : "chatbubbles"
                  }
                  size={20}
                  color={COLORS.white}
                />

                <Text style={styles.negotiateBtnText}>
                  {existingOfferId
                    ? "Sửa đề nghị"
                    : "Thương lượng"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.closedPostContainer}>
              <Text style={styles.closedPostText}>
                Tin đăng này hiện đã đóng
              </Text>
            </View>
          )}
        </View>
      )}

      <Modal
        visible={showCartModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isAddingToCart) {
            setShowCartModal(false);
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : "height"
          }
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Thêm vào giỏ hàng
              </Text>

              <TouchableOpacity
                onPress={() => setShowCartModal(false)}
                disabled={isAddingToCart}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={COLORS.text}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <View>
                <Text
                  style={styles.cartModalProductName}
                  numberOfLines={2}
                >
                  {product.productName ||
                    post.productName ||
                    "Sản phẩm"}
                </Text>

                <Text style={styles.cartModalPrice}>
                  {formatPrice(post.basePrice)} / sản phẩm
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>
                  Số lượng (Tối đa:{" "}
                  {post.remainingQuantity}){" "}
                  <Text style={{ color: COLORS.error }}>
                    *
                  </Text>
                </Text>

                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === "web" &&
                      ({
                        outlineStyle: "none",
                      } as any),
                  ]}
                  keyboardType="number-pad"
                  value={cartQuantity}
                  onChangeText={(value) =>
                    setCartQuantity(
                      value.replace(/[^0-9]/g, ""),
                    )
                  }
                  placeholder="Nhập số lượng..."
                  editable={!isAddingToCart}
                  selectTextOnFocus
                />
              </View>

              <View style={styles.cartModalTotalRow}>
                <Text style={styles.cartModalTotalLabel}>
                  Tạm tính
                </Text>

                <Text style={styles.cartModalTotalValue}>
                  {formatPrice(
                    Number(post.basePrice || 0) *
                      Number(cartQuantity || 0),
                  )}
                </Text>
              </View>

              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { flex: 0 },
                  isAddingToCart &&
                    styles.disabledButton,
                ]}
                onPress={() => void handleAddToCart()}
                disabled={isAddingToCart}
              >
                {isAddingToCart ? (
                  <ActivityIndicator
                    color={COLORS.white}
                  />
                ) : (
                  <>
                    <Ionicons
                      name="cart-outline"
                      size={20}
                      color={COLORS.white}
                    />

                    <Text style={styles.primaryBtnText}>
                      Thêm vào giỏ hàng
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={showOfferModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          if (!isSubmittingOffer) {
            setShowOfferModal(false);
          }
        }}
      >
        <KeyboardAvoidingView
          behavior={
            Platform.OS === "ios"
              ? "padding"
              : "height"
          }
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            {isLoadingOfferData ? (
              <View style={styles.offerLoadingContainer}>
                <ActivityIndicator
                  size="large"
                  color={COLORS.primary}
                />

                <Text style={styles.offerLoadingText}>
                  Đang tải đề nghị cũ...
                </Text>
              </View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>
                    {existingOfferId
                      ? "Chỉnh sửa đề nghị"
                      : "Thương lượng giá"}
                  </Text>

                  <TouchableOpacity
                    onPress={() =>
                      setShowOfferModal(false)
                    }
                    disabled={isSubmittingOffer}
                  >
                    <Ionicons
                      name="close"
                      size={24}
                      color={COLORS.text}
                    />
                  </TouchableOpacity>
                </View>

                <View style={styles.modalBody}>
                  {existingOfferId && (
                    <View style={styles.offerNotice}>
                      <Text style={styles.offerNoticeText}>
                        Bạn đã gửi một đề nghị cho bài đăng
                        này. Bạn có thể cập nhật giá, số
                        lượng hoặc hủy bỏ đề nghị.
                      </Text>
                    </View>
                  )}

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Số lượng (Tối đa:{" "}
                      {post.remainingQuantity}){" "}
                      <Text
                        style={{
                          color: COLORS.error,
                        }}
                      >
                        *
                      </Text>
                    </Text>

                    <TextInput
                      style={[
                        styles.input,
                        Platform.OS === "web" &&
                          ({
                            outlineStyle: "none",
                          } as any),
                      ]}
                      keyboardType="number-pad"
                      value={offerQuantity}
                      onChangeText={(value) =>
                        setOfferQuantity(
                          value.replace(/[^0-9]/g, ""),
                        )
                      }
                      placeholder="Nhập số lượng..."
                      editable={!isSubmittingOffer}
                    />
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Giá mong muốn của người bán
                    </Text>

                    <View style={styles.readOnlyInput}>
                      <Text style={styles.readOnlyText}>
                        {formatPrice(post.basePrice)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>
                      Giá thương lượng (VNĐ){" "}
                      <Text
                        style={{
                          color: COLORS.error,
                        }}
                      >
                        *
                      </Text>
                    </Text>

                    <TextInput
                      style={[
                        styles.input,
                        Platform.OS === "web" &&
                          ({
                            outlineStyle: "none",
                          } as any),
                      ]}
                      keyboardType="number-pad"
                      value={offerPrice}
                      onChangeText={(value) =>
                        setOfferPrice(
                          value.replace(/[^0-9]/g, ""),
                        )
                      }
                      placeholder="Ví dụ: 1500000"
                      editable={!isSubmittingOffer}
                    />
                  </View>

                  <View style={styles.offerActions}>
                    {existingOfferId ? (
                      <View style={styles.offerEditActions}>
                        <TouchableOpacity
                          style={[
                            styles.dangerBtn,
                            isSubmittingOffer &&
                              styles.disabledButton,
                          ]}
                          onPress={handleCancelOffer}
                          disabled={isSubmittingOffer}
                        >
                          <Text style={styles.dangerBtnText}>
                            Hủy đề nghị
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.primaryBtn,
                            isSubmittingOffer &&
                              styles.disabledButton,
                          ]}
                          onPress={() =>
                            void handleUpdateOffer()
                          }
                          disabled={isSubmittingOffer}
                        >
                          {isSubmittingOffer ? (
                            <ActivityIndicator
                              color={COLORS.white}
                            />
                          ) : (
                            <Text
                              style={
                                styles.primaryBtnText
                              }
                            >
                              Cập nhật
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.primaryBtn,
                          isSubmittingOffer &&
                            styles.disabledButton,
                        ]}
                        onPress={() =>
                          void handleCreateOffer()
                        }
                        disabled={isSubmittingOffer}
                      >
                        {isSubmittingOffer ? (
                          <ActivityIndicator
                            color={COLORS.white}
                          />
                        ) : (
                          <>
                            <Ionicons
                              name="paper-plane-outline"
                              size={20}
                              color={COLORS.white}
                            />

                            <Text style={styles.primaryBtnText}>
                              Gửi đề nghị
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.white,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: COLORS.white,
  },

  backBtn: {
    marginTop: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },

  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
  },

  headerIcon: {
    padding: 8,
  },

  imageContainer: {
    position: "relative",
    backgroundColor: COLORS.white,
  },

  mainImage: {
    width,
    height: 300,
  },

  imagePlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#E2E8F0",
  },

  imagePlaceholderText: {
    color: "#94A3B8",
    marginTop: 8,
  },

  imageBadge: {
    position: "absolute",
    bottom: 16,
    right: 16,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
  },

  imageBadgeText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "bold",
  },

  section: {
    backgroundColor: COLORS.white,
    padding: 16,
    marginBottom: 8,
  },

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

  price: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.error,
  },

  originalPrice: {
    fontSize: 14,
    color: COLORS.textLight,
    textDecorationLine: "line-through",
  },

  tagRow: {
    flexDirection: "row",
    gap: 8,
  },

  tag: {
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },

  tagText: {
    fontSize: 12,
    color: "#475569",
    fontWeight: "600",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 12,
  },

  specGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginHorizontal: -8,
  },

  specItem: {
    width: "50%",
    flexDirection: "row",
    padding: 8,
    alignItems: "flex-start",
    gap: 8,
  },

  specContent: {
    flex: 1,
  },

  specLabel: {
    fontSize: 12,
    color: COLORS.textLight,
    marginBottom: 2,
  },

  specValue: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "500",
  },

  infoRow: {
    flexDirection: "row",
    marginBottom: 8,
  },

  infoLabel: {
    width: 100,
    fontSize: 14,
    color: COLORS.textLight,
  },

  infoValue: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "500",
  },

  description: {
    fontSize: 14,
    color: COLORS.text,
    lineHeight: 22,
  },

  detailDescription: {
    fontSize: 14,
    color: "#475569",
    lineHeight: 22,
    fontStyle: "italic",
  },

  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },

  dateText: {
    fontSize: 11,
    color: COLORS.textLight,
    marginBottom: 4,
  },

  bottomBar: {
    flexDirection: "row",
    padding: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },

  customerActions: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },

  closedPostContainer: {
    flex: 1,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
  },

  closedPostText: {
    color: COLORS.textLight,
    fontWeight: "bold",
  },

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
    backgroundColor: "#FEF2F2",
  },

  dangerBtnText: {
    color: COLORS.error,
    fontWeight: "bold",
    fontSize: 15,
  },

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
    backgroundColor: "#EFF6FF",
  },

  reactivateBtnText: {
    color: COLORS.primary,
    fontWeight: "bold",
    fontSize: 15,
  },

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

  primaryBtnText: {
    color: COLORS.white,
    fontWeight: "bold",
    fontSize: 15,
  },

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

  cartBtnText: {
    color: COLORS.primary,
    fontWeight: "bold",
    fontSize: 14,
  },

  disabledButton: {
    opacity: 0.65,
  },

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
  },

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

  modalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
  },

  modalBody: {
    gap: 16,
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

  cartModalTotalLabel: {
    color: COLORS.textLight,
    fontSize: 14,
  },

  cartModalTotalValue: {
    color: COLORS.error,
    fontSize: 18,
    fontWeight: "800",
  },

  inputGroup: {
    gap: 8,
  },

  inputLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
  },

  input: {
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    fontSize: 15,
    backgroundColor: "#F8FAFC",
    color: COLORS.text,
  },

  readOnlyInput: {
    borderWidth: 1,
    borderColor: "transparent",
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 50,
    justifyContent: "center",
    backgroundColor: "#F1F5F9",
  },

  readOnlyText: {
    fontSize: 15,
    color: COLORS.textLight,
    fontWeight: "bold",
  },

  offerLoadingContainer: {
    padding: 40,
    alignItems: "center",
  },

  offerLoadingText: {
    marginTop: 12,
    color: COLORS.textLight,
  },

  offerNotice: {
    backgroundColor: "#EFF6FF",
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
  },

  offerNoticeText: {
    color: "#1E3A8A",
    fontSize: 13,
    lineHeight: 19,
  },

  offerActions: {
    marginTop: 16,
  },

  offerEditActions: {
    flexDirection: "row",
    gap: 12,
  },
});