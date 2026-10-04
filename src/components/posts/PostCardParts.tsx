import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View } from "react-native";

import { COLORS } from "../../constants/theme";
import { getAvatarSource } from "../../utils/avatar";
import PriorityBadge from "../shared/PriorityBadge";

// Các phần dùng chung của thẻ tin đăng (Trang chủ, Tìm kiếm) để hai nơi luôn giống nhau.

export const getPostOwnerName = (post: any) =>
  String(post?.ownerName || post?.ownerUsername || "").trim();

const isOwnerVerified = (post: any) =>
  post?.verifyStatus === 2 || String(post?.verifyStatus ?? "").toLowerCase() === "verified";

// Tin thu mua không có ảnh: dải đầu thẻ làm điểm nhìn thay ảnh, gom danh mục +
// thương hiệu + ưu tiên vào một chỗ thay vì nhiều tầng nhãn.
export function BuyPostCardHeader({ post }: { post: any }) {
  return (
    <View style={styles.buyHeader}>
      <View style={styles.buyHeaderText}>
        <View style={styles.buyHeaderTopRow}>
          <View style={styles.buyHeaderLabelRow}>
            <Ionicons name="pricetags" size={12} color={COLORS.primary} />
            <Text style={styles.buyHeaderLabel} numberOfLines={1}>
              THU MUA
            </Text>
          </View>
          <PriorityBadge post={post} />
        </View>
        <Text style={styles.buyHeaderMeta} numberOfLines={1}>
          {[post?.categoryName, post?.brandName].filter(Boolean).join(" · ") || "Đồ cũ"}
        </Text>
      </View>
    </View>
  );
}

// Avatar + tên người đăng; API nào không trả người đăng thì ẩn dòng này.
export function PostOwnerRow({ post }: { post: any }) {
  const ownerName = getPostOwnerName(post);
  if (!ownerName) return null;

  return (
    <View style={styles.ownerRow}>
      <Image source={getAvatarSource(post?.avatarUrl)} style={styles.ownerAvatar} />
      <Text style={styles.ownerName} numberOfLines={1}>
        {ownerName}
      </Text>
      {isOwnerVerified(post) ? (
        <Ionicons name="checkmark-circle" size={12} color={COLORS.primary} />
      ) : null}
    </View>
  );
}

export function BuyPriceLabel() {
  return <Text style={styles.buyPriceLabel}>Giá thu mua</Text>;
}

const styles = StyleSheet.create({
  buyHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: "rgba(84, 123, 125, 0.08)",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(84, 123, 125, 0.16)",
  },
  buyHeaderText: { flex: 1, minWidth: 0 },
  buyHeaderTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
    minHeight: 18,
  },
  buyHeaderLabelRow: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  buyHeaderLabel: {
    flexShrink: 1,
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  buyHeaderMeta: { marginTop: 3, color: "#172830", fontSize: 11, fontWeight: "600" },
  buyPriceLabel: { marginBottom: 1, color: "#547B7D", fontSize: 10, fontWeight: "600" },
  ownerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginBottom: 6,
  },
  ownerAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#E8EEEE",
  },
  ownerName: { flexShrink: 1, fontSize: 11, color: "#547B7D", fontWeight: "500" },
});
