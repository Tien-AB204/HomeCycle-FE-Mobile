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
import { postApi } from "../../src/services/apis/postApi";
// IMPORT MỚI
import { offerApi } from "../../src/services/apis/offerApi"; 

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
  const [isLoadingOfferData, setIsLoadingOfferData] = useState(false);

  const fetchPostData = async () => {
    if (!id) return;
    try {
      setIsLoading(true);
      const resPost = await postApi.getPostById(id as string);
      setPost(resPost?.data || resPost);

      if (user && resPost?.data?.ownerId !== currentUserId) {
        const resOffers = await offerApi.getSentOffers({ PageSize: 50, PageNumber: 1 }); // ĐỔI SANG offerApi
        const items = resOffers?.data?.items || [];
        const pendingOffer = items.find((o: any) => o.postId === id && o.offerStatus === 0);
        if (pendingOffer) setExistingOfferId(pendingOffer.offerId);
        else setExistingOfferId(null);
      }
    } catch (error) {
      console.error("Lỗi lấy dữ liệu:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPostData();
    }, [id, user]),
  );

  const isMyPost = currentUserId && post?.ownerId && currentUserId === post.ownerId;

  const handleClosePost = () => {
    const targetPostId = post?.postId;
    if (!targetPostId) return alert("Không tìm thấy ID bài đăng.");

    const executeClose = async () => {
      try {
        setIsLoading(true);
        await postApi.closePost(targetPostId); // Vẫn dùng postApi (Đúng)
        if (Platform.OS === "web") window.alert("Đã đóng bài đăng thành công.");
        else Alert.alert("Thành công", "Đã đóng bài đăng.");
        fetchPostData();
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || "Không thể đóng bài đăng lúc này.";
        if (Platform.OS === "web") window.alert("Lỗi: " + errorMsg);
        else Alert.alert("Lỗi", errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Bạn có chắc chắn muốn đóng tin đăng này không? Tin sẽ kết thúc giao dịch và không hiển thị trên trang chủ nữa.")) executeClose();
    } else {
      Alert.alert("Đóng bài đăng", "Bạn có chắc chắn muốn đóng tin đăng này không?", [
        { text: "Hủy", style: "cancel" },
        { text: "Đóng bài", style: "destructive", onPress: executeClose },
      ]);
    }
  };

  const handleReactivatePost = () => {
    const targetPostId = post?.postId;
    if (!targetPostId) return alert("Không tìm thấy ID bài đăng.");

    const executeReactivate = async () => {
      try {
        setIsLoading(true);
        await postApi.reactivatePost(targetPostId); // Vẫn dùng postApi (Đúng)
        if (Platform.OS === "web") window.alert("Đã mở lại bài đăng thành công.");
        else Alert.alert("Thành công", "Đã mở lại bài đăng.");
        fetchPostData();
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || "Không thể mở lại bài đăng lúc này.";
        if (Platform.OS === "web") window.alert("Lỗi: " + errorMsg);
        else Alert.alert("Lỗi", errorMsg);
      } finally {
        setIsLoading(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Bạn có chắc chắn muốn mở lại tin đăng này?")) executeReactivate();
    } else {
      Alert.alert("Mở lại bài đăng", "Bạn có chắc chắn muốn mở lại tin đăng này?", [
        { text: "Hủy", style: "cancel" },
        { text: "Mở lại", onPress: executeReactivate },
      ]);
    }
  };

  const handleOpenOffer = async () => {
    if (!user) return router.push(`/(auth)/login?returnUrl=/posts/${id}`);

    if (existingOfferId) {
      setIsLoadingOfferData(true);
      setShowOfferModal(true);
      try {
        const res = await offerApi.getOfferById(existingOfferId); // ĐỔI SANG offerApi
        const data = res?.data || res;
        setOfferQuantity(data.offerQuantity?.toString() || "1");
        setOfferPrice(data.offerPrice?.toString() || "");
      } catch (error) {
        Alert.alert("Lỗi", "Không thể tải dữ liệu thương lượng cũ.");
        setShowOfferModal(false);
      } finally {
        setIsLoadingOfferData(false);
      }
    } else {
      setOfferQuantity("1");
      setOfferPrice("");
      setShowOfferModal(true);
    }
  };

  const validateOfferForm = () => {
    const qty = parseInt(offerQuantity);
    const price = parseInt(offerPrice);
    if (isNaN(qty) || qty <= 0) return Alert.alert("Lỗi", "Số lượng không hợp lệ!"), null;
    if (qty > post.remainingQuantity) return Alert.alert("Lỗi", `Số lượng tối đa là ${post.remainingQuantity}!`), null;
    if (isNaN(price) || price <= 0) return Alert.alert("Lỗi", "Vui lòng nhập giá hợp lệ!"), null;
    return { qty, price };
  };

  const handleCreateOffer = async () => {
    const valid = validateOfferForm();
    if (!valid) return;
    try {
      setIsSubmittingOffer(true);
      await offerApi.createOffer({ postId: id as string, offerPrice: valid.price, offerQuantity: valid.qty }); // ĐỔI SANG offerApi
      if (Platform.OS === "web") window.alert("Đã gửi đề nghị thương lượng!");
      else Alert.alert("Thành công", "Đã gửi đề nghị thương lượng!");
      setShowOfferModal(false);
      fetchPostData();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || "Lỗi.";
      if (Platform.OS === "web") window.alert("Lỗi: " + errorMsg);
      else Alert.alert("Lỗi", errorMsg);
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
      await offerApi.updateOffer(existingOfferId, { offerPrice: valid.price, offerQuantity: valid.qty }); // ĐỔI SANG offerApi
      if (Platform.OS === "web") window.alert("Đã cập nhật thương lượng!");
      else Alert.alert("Thành công", "Đã cập nhật thương lượng!");
      setShowOfferModal(false);
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || "Lỗi.";
      if (Platform.OS === "web") window.alert("Lỗi: " + errorMsg);
      else Alert.alert("Lỗi", errorMsg);
    } finally {
      setIsSubmittingOffer(false);
    }
  };

  const handleCancelOffer = () => {
    if (!existingOfferId) return;
    const executeCancel = async () => {
      try {
        setIsSubmittingOffer(true);
        await offerApi.cancelOffer(existingOfferId); // ĐỔI SANG offerApi
        if (Platform.OS === "web") window.alert("Đã hủy thương lượng thành công.");
        else Alert.alert("Thành công", "Đã hủy thương lượng.");
        setShowOfferModal(false);
        setExistingOfferId(null);
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || "Lỗi.";
        if (Platform.OS === "web") window.alert("Lỗi: " + errorMsg);
        else Alert.alert("Lỗi", errorMsg);
      } finally {
        setIsSubmittingOffer(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Bạn có chắc chắn muốn hủy đề nghị này không?")) executeCancel();
    } else {
      Alert.alert("Xác nhận", "Bạn có chắc chắn muốn hủy đề nghị này không?", [
        { text: "Không", style: "cancel" },
        { text: "Hủy đề nghị", style: "destructive", onPress: executeCancel },
      ]);
    }
  };

  const handleAddToCart = () => {
    if (!user) return router.push(`/(auth)/login?returnUrl=/posts/${id}`);
    Alert.alert("Giỏ hàng", "Đã thêm sản phẩm vào giỏ hàng thành công!");
  };

  const formatPrice = (price: number) => price ? price.toLocaleString("vi-VN") + " đ" : "0 đ";
  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

  const translateFuncStatus = (s: string) => s === "FullyFunctional" ? "Hoạt động hoàn hảo" : s === "PartiallyFunctional" ? "Hoạt động một phần" : s === "NonFunctional" ? "Không hoạt động" : "Không rõ";
  const translateDamage = (l: string) => l === "None" ? "Như mới" : l === "Cosmetic_Damage" ? "Trầy xước ngoại hình" : l === "Minor_Damage" ? "Hư hỏng nhẹ" : l === "Moderate_Damage" ? "Hư hỏng vừa" : l === "Severe_Damage" ? "Hư hỏng nặng" : l === "Total_Loss" ? "Mất chức năng" : "Không rõ";
  const translateSpace = (s: string) => ({ Living_room: "Phòng khách", Kitchen: "Nhà bếp", Bedroom: "Phòng ngủ", Bathroom: "Phòng tắm", Laundry_room: "Phòng giặt", Balcony: "Ban công", Garage: "Garage", Restroom: "Nhà vệ sinh" }[s] || s || "Không rõ");
  const getEavValue = (attr: any) => attr.optionValue || attr.valueText || attr.valueNumber || (attr.valueBoolean !== null && attr.valueBoolean !== undefined ? (attr.valueBoolean ? "Có" : "Không") : "N/A");

  // ... (Phần render UI giữ nguyên, không cần thay đổi)
  if (isLoading && !post) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={{ marginTop: 12, color: COLORS.textLight }}>Đang tải chi tiết...</Text>
      </SafeAreaView>
    );
  }

  if (!post) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Text style={{ color: COLORS.error, fontSize: 16 }}>Không tìm thấy bài đăng!</Text>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={{ color: COLORS.white }}>Quay lại</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const p = post.product || {};
  const address = [post.streetAddress, post.ward, post.city].filter(Boolean).join(", ");

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}><Ionicons name="arrow-back" size={24} color={COLORS.text} /></TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết tin đăng</Text>
        <TouchableOpacity style={styles.headerIcon}><Ionicons name="share-social-outline" size={24} color={COLORS.text} /></TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: "#F1F5F9" }}>
        <View style={styles.imageContainer}>
          {post.medias && post.medias.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {post.medias.map((img: any) => (
                <Image key={img.mediaId} source={{ uri: img.url || img.mediaUrl }} style={styles.mainImage} resizeMode="cover" />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.mainImage, { justifyContent: "center", alignItems: "center", backgroundColor: "#E2E8F0" }]}>
              <Ionicons name="image-outline" size={48} color="#94A3B8" />
              <Text style={{ color: "#94A3B8", marginTop: 8 }}>Không có hình ảnh</Text>
            </View>
          )}
          {post.medias && post.medias.length > 1 && (
            <View style={styles.imageBadge}><Text style={styles.imageBadgeText}>1 / {post.medias.length}</Text></View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.productName}>{post.productName}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(post.basePrice)}</Text>
            {p.originalPrice ? <Text style={styles.originalPrice}>{formatPrice(p.originalPrice)}</Text> : null}
          </View>
          <View style={styles.tagRow}>
            <View style={styles.tag}><Text style={styles.tagText}>{post.postType === "Sell" ? "Tin Bán" : "Tin Mua"}</Text></View>
            <View style={[styles.tag, { backgroundColor: post.status === "Active" ? "#D1FAE5" : post.status === "Closed" ? "#E2E8F0" : "#FEF3C7" }]}>
              <Text style={[styles.tagText, { color: post.status === "Active" ? "#10B981" : post.status === "Closed" ? "#475569" : "#F59E0B" }]}>{post.status}</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông số kỹ thuật</Text>
          <View style={styles.specGrid}>
            {p.categoryName && (<View style={styles.specItem}><Ionicons name="grid-outline" size={18} color={COLORS.textLight} /><View style={styles.specContent}><Text style={styles.specLabel}>Danh mục</Text><Text style={styles.specValue}>{p.categoryName}</Text></View></View>)}
            {p.productTypeName && (<View style={styles.specItem}><Ionicons name="layers-outline" size={18} color={COLORS.textLight} /><View style={styles.specContent}><Text style={styles.specLabel}>Loại sản phẩm</Text><Text style={styles.specValue}>{p.productTypeName}</Text></View></View>)}
            {p.brandName && (<View style={styles.specItem}><Ionicons name="shield-checkmark-outline" size={18} color={COLORS.textLight} /><View style={styles.specContent}><Text style={styles.specLabel}>Thương hiệu</Text><Text style={styles.specValue}>{p.brandName}</Text></View></View>)}
            {p.modelNumber && (<View style={[styles.specItem, { width: "100%" }]}><Ionicons name="barcode-outline" size={18} color={COLORS.textLight} /><View style={styles.specContent}><Text style={styles.specLabel}>Mã Model</Text><Text style={styles.specValue}>{p.modelNumber}</Text></View></View>)}
            {p.functionalityStatus && (<View style={styles.specItem}><Ionicons name="build-outline" size={18} color={COLORS.textLight} /><View style={styles.specContent}><Text style={styles.specLabel}>Tình trạng</Text><Text style={styles.specValue}>{translateFuncStatus(p.functionalityStatus)}</Text></View></View>)}
            {p.damageLevel && (<View style={styles.specItem}><Ionicons name="bandage-outline" size={18} color={COLORS.textLight} /><View style={styles.specContent}><Text style={styles.specLabel}>Hư hại</Text><Text style={styles.specValue}>{translateDamage(p.damageLevel)}</Text></View></View>)}
            {p.usageDuration && (<View style={styles.specItem}><Ionicons name="time-outline" size={18} color={COLORS.textLight} /><View style={styles.specContent}><Text style={styles.specLabel}>Thời gian SD</Text><Text style={styles.specValue}>{p.usageDuration} tháng</Text></View></View>)}
            {p.spaceUsage && (<View style={styles.specItem}><Ionicons name="home-outline" size={18} color={COLORS.textLight} /><View style={styles.specContent}><Text style={styles.specLabel}>Không gian</Text><Text style={styles.specValue}>{translateSpace(p.spaceUsage)}</Text></View></View>)}
            {(p.length || p.width || p.height) && (<View style={styles.specItem}><Ionicons name="expand-outline" size={18} color={COLORS.textLight} /><View style={styles.specContent}><Text style={styles.specLabel}>Kích thước (DxRxC)</Text><Text style={styles.specValue}>{p.length || 0} x {p.width || 0} x {p.height || 0} cm</Text></View></View>)}
            {p.weight && (<View style={styles.specItem}><Ionicons name="barbell-outline" size={18} color={COLORS.textLight} /><View style={styles.specContent}><Text style={styles.specLabel}>Khối lượng</Text><Text style={styles.specValue}>{p.weight} kg</Text></View></View>)}
            
            {p.attributeValues && p.attributeValues.map((attr: any, index: number) => {
              const unitText = (attr.unit && attr.unit !== "string") ? ` ${attr.unit}` : "";
              return (
                <View key={attr.attributeId || index} style={[styles.specItem, { width: "100%" }]}>
                  <Ionicons name="pricetag-outline" size={18} color={COLORS.textLight} />
                  <View style={styles.specContent}>
                    <Text style={styles.specLabel}>{attr.attributeName}</Text>
                    <Text style={styles.specValue}>{getEavValue(attr)}{unitText}</Text>
                  </View>
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin giao dịch</Text>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Số lượng:</Text><Text style={styles.infoValue}>{post.remainingQuantity} / {post.quantity} (Còn lại / Tổng)</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Vận chuyển:</Text><Text style={styles.infoValue}>{post.deliveryMethod}</Text></View>
          <View style={styles.infoRow}><Text style={styles.infoLabel}>Địa chỉ:</Text><Text style={styles.infoValue}>{address || "Chưa cập nhật"}</Text></View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mô tả chung</Text>
          <Text style={styles.description}>{post.description}</Text>
          {p.detailDescription && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Mô tả tình trạng chi tiết</Text>
              <Text style={styles.detailDescription}>{p.detailDescription}</Text>
            </>
          )}
        </View>

        <View style={[styles.section, { marginBottom: 30 }]}>
          <Text style={styles.dateText}>Mã Tin: {post.postId}</Text>
          <Text style={styles.dateText}>Ngày đăng: {formatDate(post.createdAt)}</Text>
          <Text style={styles.dateText}>Cập nhật lần cuối: {formatDate(post.updatedAt)}</Text>
          <Text style={styles.dateText}>Ngày hết hạn: {formatDate(post.expiryDate)}</Text>
        </View>
      </ScrollView>

      {!isViewOnly && post.status !== "Deleted" && (
        <View style={styles.bottomBar}>
          {isMyPost ? (
            <>
              {post.status === "Active" ? (
                <TouchableOpacity style={styles.dangerBtn} onPress={handleClosePost}>
                  <Ionicons name="close-circle-outline" size={20} color={COLORS.error} />
                  <Text style={styles.dangerBtnText}>Đóng tin</Text>
                </TouchableOpacity>
              ) : post.status === "Closed" ? (
                <TouchableOpacity style={styles.reactivateBtn} onPress={handleReactivatePost}>
                  <Ionicons name="refresh-circle-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.reactivateBtnText}>Mở lại tin</Text>
                </TouchableOpacity>
              ) : null}

              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() => router.push({ pathname: "/posts/post-form", params: { editId: post.postId, postType: post.postType }})}
              >
                <Ionicons name="pencil" size={20} color={COLORS.white} />
                <Text style={styles.primaryBtnText}>Sửa tin đăng</Text>
              </TouchableOpacity>
            </>
          ) : (
            post.status === "Active" ? (
              <View style={{ flexDirection: "row", gap: 12, flex: 1 }}>
                <TouchableOpacity style={styles.cartBtn} onPress={handleAddToCart}>
                  <Ionicons name="cart-outline" size={20} color={COLORS.primary} />
                  <Text style={styles.cartBtnText}>Thêm giỏ hàng</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.negotiateBtn, existingOfferId ? { backgroundColor: "#0F172A" } : {}]} onPress={handleOpenOffer}>
                  <Ionicons name="chatbubbles" size={20} color={COLORS.white} />
                  <Text style={styles.negotiateBtnText}>Thương lượng</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={{ flex: 1, paddingVertical: 14, alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 8 }}>
                <Text style={{ color: COLORS.textLight, fontWeight: 'bold' }}>Tin đăng này hiện đã đóng</Text>
              </View>
            )
          )}
        </View>
      )}

      {/* MODAL THƯƠNG LƯỢNG */}
      <Modal visible={showOfferModal} transparent={true} animationType="slide">
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {isLoadingOfferData ? (
              <View style={{ padding: 40, alignItems: "center" }}><ActivityIndicator size="large" color={COLORS.primary} /><Text style={{ marginTop: 12, color: COLORS.textLight }}>Đang tải đề nghị cũ...</Text></View>
            ) : (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{existingOfferId ? "Chỉnh sửa Đề nghị" : "Thương lượng giá"}</Text>
                  <TouchableOpacity onPress={() => setShowOfferModal(false)}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
                </View>
                <View style={styles.modalBody}>
                  {existingOfferId && (
                    <View style={{ backgroundColor: "#EFF6FF", padding: 12, borderRadius: 8, marginBottom: 8 }}>
                      <Text style={{ color: "#1E3A8A", fontSize: 13 }}>Bạn đã gửi 1 đề nghị cho bài đăng này. Bạn có thể cập nhật giá, số lượng hoặc hủy bỏ đề nghị.</Text>
                    </View>
                  )}
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Số lượng (Tối đa: {post.remainingQuantity}) <Text style={{ color: COLORS.error }}>*</Text></Text>
                    <TextInput style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]} keyboardType="numeric" value={offerQuantity} onChangeText={setOfferQuantity} placeholder="Nhập số lượng..." />
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Giá mong muốn của người bán</Text>
                    <View style={styles.readOnlyInput}><Text style={styles.readOnlyText}>{formatPrice(post.basePrice)}</Text></View>
                  </View>
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>Giá thương lượng (VNĐ) <Text style={{ color: COLORS.error }}>*</Text></Text>
                    <TextInput style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]} keyboardType="numeric" value={offerPrice} onChangeText={setOfferPrice} placeholder="VD: 1500000" />
                  </View>
                  <View style={{ marginTop: 16 }}>
                    {existingOfferId ? (
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <TouchableOpacity style={[styles.dangerBtn, { flex: 1 }, isSubmittingOffer && { opacity: 0.7 }]} onPress={handleCancelOffer} disabled={isSubmittingOffer}>
                          <Text style={styles.dangerBtnText}>Hủy Đề Nghị</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }, isSubmittingOffer && { opacity: 0.7 }]} onPress={handleUpdateOffer} disabled={isSubmittingOffer}>
                          {isSubmittingOffer ? <ActivityIndicator color={COLORS.white}/> : <Text style={styles.primaryBtnText}>Cập Nhật</Text>}
                        </TouchableOpacity>
                      </View>
                    ) : (
                      <TouchableOpacity style={[styles.primaryBtn, isSubmittingOffer && { opacity: 0.7 }]} onPress={handleCreateOffer} disabled={isSubmittingOffer}>
                        {isSubmittingOffer ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="paper-plane-outline" size={20} color={COLORS.white} /><Text style={styles.primaryBtnText}>Gửi đề nghị</Text></>}
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
  container: { flex: 1, backgroundColor: COLORS.white },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: COLORS.white },
  backBtn: { marginTop: 20, paddingHorizontal: 20, paddingVertical: 10, backgroundColor: COLORS.primary, borderRadius: 8 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white },
  headerTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  headerIcon: { padding: 8 },
  imageContainer: { position: "relative", backgroundColor: COLORS.white },
  mainImage: { width: width, height: 300 },
  imageBadge: { position: "absolute", bottom: 16, right: 16, backgroundColor: "rgba(0,0,0,0.6)", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 16 },
  imageBadgeText: { color: COLORS.white, fontSize: 12, fontWeight: "bold" },
  section: { backgroundColor: COLORS.white, padding: 16, marginBottom: 8 },
  productName: { fontSize: 18, fontWeight: "bold", color: COLORS.text, lineHeight: 26, marginBottom: 8 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  price: { fontSize: 22, fontWeight: "bold", color: COLORS.error },
  originalPrice: { fontSize: 14, color: COLORS.textLight, textDecorationLine: "line-through" },
  tagRow: { flexDirection: "row", gap: 8 },
  tag: { backgroundColor: "#F1F5F9", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 12, color: "#475569", fontWeight: "600" },
  sectionTitle: { fontSize: 16, fontWeight: "bold", color: COLORS.text, marginBottom: 12 },
  specGrid: { flexDirection: "row", flexWrap: "wrap", marginHorizontal: -8 },
  specItem: { width: "50%", flexDirection: "row", padding: 8, alignItems: "flex-start", gap: 8 },
  specContent: { flex: 1 },
  specLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 2 },
  specValue: { fontSize: 14, color: COLORS.text, fontWeight: "500" },
  infoRow: { flexDirection: "row", marginBottom: 8 },
  infoLabel: { width: 100, fontSize: 14, color: COLORS.textLight },
  infoValue: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: "500" },
  description: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  detailDescription: { fontSize: 14, color: "#475569", lineHeight: 22, fontStyle: "italic" },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },
  dateText: { fontSize: 11, color: COLORS.textLight, marginBottom: 4 },
  bottomBar: { flexDirection: "row", padding: 12, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 12 },
  dangerBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.error, backgroundColor: "#FEF2F2" },
  dangerBtnText: { color: COLORS.error, fontWeight: "bold", fontSize: 15 },
  reactivateBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: "#EFF6FF" },
  reactivateBtnText: { color: COLORS.primary, fontWeight: "bold", fontSize: 15 },
  primaryBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 8, backgroundColor: COLORS.primary },
  primaryBtnText: { color: COLORS.white, fontWeight: "bold", fontSize: 15 },
  cartBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary, backgroundColor: COLORS.white },
  cartBtnText: { color: COLORS.primary, fontWeight: "bold", fontSize: 14 },
  negotiateBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 8, backgroundColor: COLORS.primary },
  negotiateBtnText: { color: COLORS.white, fontWeight: "bold", fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  modalBody: { gap: 16 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 15, backgroundColor: "#F8FAFC", color: COLORS.text },
  readOnlyInput: { borderWidth: 1, borderColor: "transparent", borderRadius: 12, paddingHorizontal: 16, height: 50, justifyContent: "center", backgroundColor: "#F1F5F9" },
  readOnlyText: { fontSize: 15, color: COLORS.textLight, fontWeight: "bold" },
});