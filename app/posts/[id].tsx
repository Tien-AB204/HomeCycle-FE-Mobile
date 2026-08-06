import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { 
  View, Text, ActivityIndicator, StyleSheet, ScrollView, 
  TouchableOpacity, SafeAreaView, Image, Dimensions, Alert,  
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { postApi } from "../../src/services/apis/postApi";
import { COLORS } from "../../src/constants/theme";

const { width } = Dimensions.get("window");

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [post, setPost] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchDetail = async () => {
      try {
        if (!id) return;
        const res = await postApi.getPostById(id as string);
        setPost(res?.data || res);
      } catch (error) {
        console.error("Lỗi lấy chi tiết bài viết:", error);
      } finally {
        setIsLoading(false);
      }
    };
    fetchDetail();
  }, [id]);

  const handleDelete = () => {
    Alert.alert(
      "Xác nhận xóa",
      "Bạn có chắc chắn muốn xóa tin đăng này không?",
      [
        { text: "Hủy", style: "cancel" },
        { 
          text: "Xóa", 
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              await postApi.deletePost(id as string);
              Alert.alert("Thành công", "Đã xóa bài đăng.");
              router.back(); // Quay lại trang danh sách sau khi xóa
            } catch (error) {
              console.error("Lỗi xóa bài:", error);
              Alert.alert("Lỗi", "Không thể xóa bài đăng lúc này.");
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  // ================= FORMATTERS & TRANSLATORS =================
  const formatPrice = (price: number) => {
    if (!price) return "0 đ";
    return price.toLocaleString("vi-VN") + " đ";
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleDateString("vi-VN", { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const translateFuncStatus = (status: string) => {
    switch (status) {
      case "FullyFunctional": return "Hoạt động hoàn hảo";
      case "PartiallyFunctional": return "Hoạt động một phần";
      case "NonFunctional": return "Không hoạt động";
      default: return "Không rõ";
    }
  };

  const translateDamage = (level: string) => {
    switch (level) {
      case "None": return "Như mới";
      case "Cosmetic_Damage": return "Trầy xước ngoại hình";
      case "Minor_Damage": return "Hư hỏng nhẹ";
      case "Moderate_Damage": return "Hư hỏng vừa";
      case "Severe_Damage": return "Hư hỏng nặng";
      case "Total_Loss": return "Mất chức năng";
      default: return "Không rõ";
    }
  };

  const translateSpace = (space: string) => {
    const spaces: Record<string, string> = {
      Living_room: "Phòng khách", Kitchen: "Nhà bếp", Bedroom: "Phòng ngủ",
      Bathroom: "Phòng tắm", Laundry_room: "Phòng giặt", Balcony: "Ban công",
      Garage: "Garage", Restroom: "Nhà vệ sinh"
    };
    return spaces[space] || space || "Không rõ";
  };

  // ================= UI RENDERERS =================
  if (isLoading) {
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

  const p = post.product || {}; // Rút gọn alias cho product object
  const address = [post.streetAddress, post.ward, post.city].filter(Boolean).join(", ");

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.headerIcon}>
          <Ionicons name="arrow-back" size={24} color={COLORS.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Chi tiết tin đăng</Text>
        <TouchableOpacity style={styles.headerIcon}>
          <Ionicons name="share-social-outline" size={24} color={COLORS.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ backgroundColor: "#F1F5F9" }}>
        
        {/* IMAGE SLIDER */}
        <View style={styles.imageContainer}>
          {post.medias && post.medias.length > 0 ? (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {post.medias.map((img: any) => (
                <Image key={img.mediaId} source={{ uri: img.url }} style={styles.mainImage} resizeMode="cover" />
              ))}
            </ScrollView>
          ) : (
            <View style={[styles.mainImage, { justifyContent: "center", alignItems: "center", backgroundColor: "#E2E8F0" }]}>
              <Ionicons name="image-outline" size={48} color="#94A3B8" />
              <Text style={{ color: "#94A3B8", marginTop: 8 }}>Không có hình ảnh</Text>
            </View>
          )}
          {post.medias && post.medias.length > 1 && (
            <View style={styles.imageBadge}>
              <Text style={styles.imageBadgeText}>1 / {post.medias.length}</Text>
            </View>
          )}
        </View>

        {/* BASIC INFO SECTION */}
        <View style={styles.section}>
          <Text style={styles.productName}>{post.productName}</Text>
          
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatPrice(post.basePrice)}</Text>
            {p.originalPrice ? (
              <Text style={styles.originalPrice}>{formatPrice(p.originalPrice)}</Text>
            ) : null}
          </View>

          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Text style={styles.tagText}>{post.postType === "Sell" ? "Tin Bán" : "Tin Mua"}</Text>
            </View>
            <View style={[styles.tag, { backgroundColor: post.status === "Active" ? "#D1FAE5" : "#FEF3C7" }]}>
              <Text style={[styles.tagText, { color: post.status === "Active" ? "#10B981" : "#F59E0B" }]}>
                {post.status}
              </Text>
            </View>
          </View>
        </View>

        {/* SPECIFICATIONS SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông số kỹ thuật</Text>
          
          <View style={styles.specGrid}>
            <View style={styles.specItem}>
              <Ionicons name="build-outline" size={18} color={COLORS.textLight} />
              <View style={styles.specContent}>
                <Text style={styles.specLabel}>Tình trạng</Text>
                <Text style={styles.specValue}>{translateFuncStatus(p.functionalityStatus)}</Text>
              </View>
            </View>

            <View style={styles.specItem}>
              <Ionicons name="bandage-outline" size={18} color={COLORS.textLight} />
              <View style={styles.specContent}>
                <Text style={styles.specLabel}>Hư hại</Text>
                <Text style={styles.specValue}>{translateDamage(p.damageLevel)}</Text>
              </View>
            </View>

            <View style={styles.specItem}>
              <Ionicons name="time-outline" size={18} color={COLORS.textLight} />
              <View style={styles.specContent}>
                <Text style={styles.specLabel}>Thời gian SD</Text>
                <Text style={styles.specValue}>{p.usageDuration} năm</Text>
              </View>
            </View>

            <View style={styles.specItem}>
              <Ionicons name="home-outline" size={18} color={COLORS.textLight} />
              <View style={styles.specContent}>
                <Text style={styles.specLabel}>Không gian</Text>
                <Text style={styles.specValue}>{translateSpace(p.spaceUsage)}</Text>
              </View>
            </View>

            {(p.length || p.width || p.height) && (
              <View style={styles.specItem}>
                <Ionicons name="expand-outline" size={18} color={COLORS.textLight} />
                <View style={styles.specContent}>
                  <Text style={styles.specLabel}>Kích thước (DxRxC)</Text>
                  <Text style={styles.specValue}>{p.length || 0} x {p.width || 0} x {p.height || 0} cm</Text>
                </View>
              </View>
            )}

            {p.weight ? (
              <View style={styles.specItem}>
                <Ionicons name="barbell-outline" size={18} color={COLORS.textLight} />
                <View style={styles.specContent}>
                  <Text style={styles.specLabel}>Khối lượng</Text>
                  <Text style={styles.specValue}>{p.weight} kg</Text>
                </View>
              </View>
            ) : null}

            {p.modelNumber ? (
              <View style={[styles.specItem, { width: '100%' }]}>
                <Ionicons name="barcode-outline" size={18} color={COLORS.textLight} />
                <View style={styles.specContent}>
                  <Text style={styles.specLabel}>Mã Model</Text>
                  <Text style={styles.specValue}>{p.modelNumber}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </View>

        {/* TRANSACTION SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Thông tin giao dịch</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Số lượng:</Text>
            <Text style={styles.infoValue}>{post.remainingQuantity} / {post.quantity} (Còn lại / Tổng)</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Vận chuyển:</Text>
            <Text style={styles.infoValue}>{post.deliveryMethod}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Địa chỉ:</Text>
            <Text style={styles.infoValue}>{address || "Chưa cập nhật"}</Text>
          </View>
        </View>

        {/* DESCRIPTION SECTION */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Mô tả</Text>
          <Text style={styles.description}>{post.description}</Text>
          
          {p.detailDescription && (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Chi tiết bổ sung</Text>
              <Text style={styles.detailDescription}>{p.detailDescription}</Text>
            </>
          )}
        </View>

        {/* DATES SECTION */}
        <View style={[styles.section, { marginBottom: 30 }]}>
          <Text style={styles.dateText}>Ngày đăng: {formatDate(post.createdAt)}</Text>
          <Text style={styles.dateText}>Cập nhật lần cuối: {formatDate(post.updatedAt)}</Text>
          <Text style={styles.dateText}>Ngày hết hạn: {formatDate(post.expiryDate)}</Text>
        </View>

      </ScrollView>

      {/* FIXED BOTTOM ACTION BAR */}
      <View style={styles.bottomBar}>

        {/* NÚT XÓA BÀI ĐĂNG */}
        <TouchableOpacity style={styles.dangerBtn} onPress={handleDelete}>
          <Ionicons name="trash-outline" size={20} color={COLORS.error} />
          <Text style={styles.dangerBtnText}>Xóa tin</Text>
        </TouchableOpacity>

        {/* NÚT SỬA BÀI ĐĂNG */}
        <TouchableOpacity 
          style={styles.primaryBtn}
          onPress={() => {
            router.push({
              pathname: "/posts/post-form",
              params: { editId: post.postId, postType: post.postType }
            });
          }}
        >
          <Ionicons name="pencil" size={20} color={COLORS.white} />
          <Text style={styles.primaryBtnText}>Sửa tin đăng</Text>
        </TouchableOpacity>

      </View>
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
  specItem: { width: '50%', flexDirection: "row", padding: 8, alignItems: "flex-start", gap: 8 },
  specContent: { flex: 1 },
  specLabel: { fontSize: 12, color: COLORS.textLight, marginBottom: 2 },
  specValue: { fontSize: 14, color: COLORS.text, fontWeight: "500" },

  infoRow: { flexDirection: "row", marginBottom: 8 },
  infoLabel: { width: 100, fontSize: 14, color: COLORS.textLight },
  infoValue: { flex: 1, fontSize: 14, color: COLORS.text, fontWeight: "500" },

  description: { fontSize: 14, color: COLORS.text, lineHeight: 22 },
  detailDescription: { fontSize: 14, color: "#475569", lineHeight: 22, fontStyle: "italic" },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 16 },

  dateText: { fontSize: 12, color: COLORS.textLight, marginBottom: 4 },

  bottomBar: { flexDirection: "row", padding: 12, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, gap: 12 },
  dangerBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.error, backgroundColor: "#FEF2F2" },
  dangerBtnText: { color: COLORS.error, fontWeight: "bold", fontSize: 15 },
  primaryBtn: { flex: 2, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 12, borderRadius: 8, backgroundColor: COLORS.primary },
  primaryBtnText: { color: COLORS.white, fontWeight: "bold", fontSize: 15 },
});