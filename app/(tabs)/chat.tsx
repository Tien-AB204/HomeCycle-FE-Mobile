import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";

const negotiationApi = {
  getNegotiations: (params?: { PageNumber?: number; PageSize?: number }) =>
    apiClient
      .get("/negotiations", { params })
      .then((response) => response.data),
};

const offerApi = {
  getSentOffers: (params?: { PageNumber?: number; PageSize?: number }) =>
    apiClient.get("/offers/sent", { params }).then((response) => response.data),
  getReceivedOffers: (params?: { PageNumber?: number; PageSize?: number }) =>
    apiClient
      .get("/offers/received", { params })
      .then((response) => response.data),
  acceptOffer: (offerId: string) =>
    apiClient
      .patch(`/offers/${offerId}/accept`)
      .then((response) => response.data),
  rejectOffer: (offerId: string) =>
    apiClient
      .post(`/offers/${offerId}/reject`)
      .then((response) => response.data),
  counterInitialOffer: (
    offerId: string,
    data: {
      offerPrice: number;
      offerQuantity: number;
      messageContent?: string;
    },
  ) =>
    apiClient
      .patch(`/offers/${offerId}/counter`, data)
      .then((response) => response.data),
};

// HÀM CHUYÊN TRỊ AVATAR: BAO LỖI CORS, CHẶN NHÀ MẠNG
const getRobustAvatar = (url: string | null | undefined, name: string) => {
  const isValid =
    url && url !== "string" && url !== "null" && url.startsWith("http");
  if (isValid) {
    if (url.includes("googleusercontent.com")) {
      return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
    }
    return url;
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&background=547B7D&color=fff`;
};

export default function ChatListScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === "web" && screenWidth > 480 ? 480 : screenWidth;

  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"chat" | "received" | "sent">(
    "chat",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [offersList, setOffersList] = useState<any[]>([]);
  const [negotiationsList, setNegotiationsList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  const [showCounterModal, setShowCounterModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterQuantity, setCounterQuantity] = useState("");
  const [counterMessage, setCounterMessage] = useState("");

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      if (activeTab === "chat") {
        const res = await negotiationApi.getNegotiations({
          PageSize: 50,
          PageNumber: 1,
        });
        const items = res?.data?.items || res?.items || [];
        setNegotiationsList(items);
      } else {
        const res =
          activeTab === "received"
            ? await offerApi.getReceivedOffers({ PageSize: 50, PageNumber: 1 })
            : await offerApi.getSentOffers({ PageSize: 50, PageNumber: 1 });

        const items = res?.items || res?.data?.items || [];
        const pendingOffers = items
          .filter(
            (o: any) => o.offerStatus === "Pending" || o.offerStatus === 0,
          )
          .sort(
            (a: any, b: any) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );

        setOffersList(pendingOffers);
      }
    } catch (error) {
      console.error(`Lỗi lấy dữ liệu (${activeTab}):`, error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, user]);

  useFocusEffect(
    useCallback(() => {
      fetchData();
    }, [fetchData]),
  );

  // ĐÃ FIX: Xử lý Alert.alert bị vô hiệu hóa sự kiện onPress trên Web
  const handleAcceptOffer = async (offerId: string) => {
    const executeAccept = async () => {
      try {
        setIsProcessingAction(true);
        await offerApi.acceptOffer(offerId);

        if (Platform.OS === "web") {
          window.alert("Đã chấp nhận thương lượng! Phòng chat đã được mở.");
        } else {
          Alert.alert(
            "Thành công",
            "Đã chấp nhận thương lượng! Phòng chat đã được mở.",
          );
        }

        fetchData();
      } catch (error: any) {
        const errorMsg =
          error.response?.data?.error?.message ||
          error.response?.data?.message ||
          "Lỗi khi đồng ý.";
        Platform.OS === "web"
          ? window.alert(errorMsg)
          : Alert.alert("Lỗi", errorMsg);
      } finally {
        setIsProcessingAction(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm(
        "Bạn đồng ý mở phiên thương lượng với mức giá này?",
      );
      if (confirmed) executeAccept();
    } else {
      Alert.alert(
        "Xác nhận",
        "Bạn đồng ý mở phiên thương lượng với mức giá này?",
        [
          { text: "Hủy", style: "cancel" },
          { text: "Đồng ý", onPress: executeAccept },
        ],
      );
    }
  };

  // ĐÃ FIX: Xử lý Alert.alert bị vô hiệu hóa sự kiện onPress trên Web
  const handleRejectOffer = async (offerId: string) => {
    const executeReject = async () => {
      try {
        setIsProcessingAction(true);
        await offerApi.rejectOffer(offerId);
        fetchData();
      } catch (error: any) {
        const errorMsg =
          error.response?.data?.error?.message ||
          error.response?.data?.message ||
          "Lỗi khi từ chối.";
        Platform.OS === "web"
          ? window.alert(errorMsg)
          : Alert.alert("Lỗi", errorMsg);
      } finally {
        setIsProcessingAction(false);
      }
    };

    if (Platform.OS === "web") {
      const confirmed = window.confirm("Từ chối đề nghị này?");
      if (confirmed) executeReject();
    } else {
      Alert.alert("Xác nhận", "Từ chối đề nghị này?", [
        { text: "Hủy", style: "cancel" },
        { text: "Từ chối", style: "destructive", onPress: executeReject },
      ]);
    }
  };

  const handleOpenCounterModal = (offer: any) => {
    setSelectedOffer(offer);
    setCounterPrice(offer.offerPrice?.toString() || "");
    setCounterQuantity(offer.offerQuantity?.toString() || "1");
    setCounterMessage("Chào bạn, tôi muốn đề xuất mức giá mới này.");
    setShowCounterModal(true);
  };

  const handleSubmitCounter = async () => {
    if (!selectedOffer) return;
    const price = parseInt(counterPrice);
    const qty = parseInt(counterQuantity);

    if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) {
      Platform.OS === "web"
        ? window.alert("Vui lòng nhập giá và số lượng hợp lệ.")
        : Alert.alert("Lỗi", "Vui lòng nhập giá và số lượng hợp lệ.");
      return;
    }

    try {
      setIsProcessingAction(true);
      await offerApi.counterInitialOffer(selectedOffer.offerId, {
        offerPrice: price,
        offerQuantity: qty,
        messageContent: counterMessage,
      });

      if (Platform.OS === "web") {
        window.alert("Đã gửi đề xuất giá mới thành công!");
      } else {
        Alert.alert("Thành công", "Đã gửi đề xuất giá mới thành công!");
      }

      setShowCounterModal(false);
      fetchData();
    } catch (error: any) {
      const errorMsg =
        error.response?.data?.error?.message ||
        error.response?.data?.message ||
        "Lỗi khi gửi đề xuất.";
      Platform.OS === "web"
        ? window.alert(errorMsg)
        : Alert.alert("Lỗi", errorMsg);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const renderNegotiationItem = ({ item }: { item: any }) => {
    const timeString =
      item.lastMessageAt || item.createdAt
        ? new Date(item.lastMessageAt || item.createdAt).toLocaleString(
            "vi-VN",
            {
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
            },
          )
        : "";
    const partnerName = item.otherPartyName || "Đối tác";
    const avatarUri = getRobustAvatar(item.otherPartyAvatarUrl, partnerName);

    return (
      <TouchableOpacity
        style={styles.offerCard}
        onPress={() => router.push(`/chat/${item.negotiationId}`)}
      >
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Image
            source={{ uri: avatarUri }}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              marginRight: 12,
              borderWidth: 1,
              borderColor: "#E2E8F0",
            }}
          />
          <View style={{ flex: 1 }}>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Text style={styles.offerName} numberOfLines={1}>
                {partnerName}
              </Text>
              <Text style={styles.offerTime}>{timeString}</Text>
            </View>
            <Text
              style={{ fontSize: 13, color: COLORS.textLight }}
              numberOfLines={1}
            >
              Mức giá:{" "}
              <Text style={{ color: COLORS.primary, fontWeight: "bold" }}>
                {item.currentOfferPrice?.toLocaleString("vi-VN")} đ
              </Text>{" "}
              (x{item.currentOfferQuantity})
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderOfferItem = ({ item }: { item: any }) => {
    const isMySentOffer = item.senderId === (user?.userId || user?.id);
    const partnerName = isMySentOffer ? item.receiverName : item.senderName;
    const partnerAvatarUrl = isMySentOffer
      ? item.receiverAvatarUrl
      : item.senderAvatarUrl;
    const avatarUri = getRobustAvatar(
      partnerAvatarUrl,
      partnerName || "Đối tác",
    );
    const timeString = item.createdAt
      ? new Date(item.createdAt).toLocaleString("vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "";

    return (
      <View style={styles.offerCard}>
        <View style={styles.offerHeader}>
          <Image
            source={{ uri: avatarUri }}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              marginRight: 10,
              borderWidth: 1,
              borderColor: "#E2E8F0",
            }}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.offerName}>
              {isMySentOffer
                ? `Bạn đã gửi cho ${partnerName}`
                : `${partnerName} đã gửi đề nghị`}
            </Text>
            <Text style={styles.offerTime}>{timeString}</Text>
          </View>
        </View>
        <View style={styles.offerDetails}>
          <Text style={styles.offerProduct} numberOfLines={1}>
            {item.productName || item.postTitle}
          </Text>
          <Text style={styles.offerPrice}>
            Giá thương lượng: {item.offerPrice?.toLocaleString("vi-VN")} đ
          </Text>
          <Text style={styles.offerPrice}>Số lượng: {item.offerQuantity}</Text>
        </View>
        {!isMySentOffer ? (
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", gap: 12 }}>
              <TouchableOpacity
                style={styles.rejectBtn}
                onPress={() => handleRejectOffer(item.offerId)}
                disabled={isProcessingAction}
              >
                <Text style={styles.rejectBtnText}>Từ chối</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={() => handleAcceptOffer(item.offerId)}
                disabled={isProcessingAction}
              >
                <Text style={styles.acceptBtnText}>Đồng ý</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity
              style={styles.counterBtnOutline}
              onPress={() => handleOpenCounterModal(item)}
              disabled={isProcessingAction}
            >
              <Text style={styles.counterBtnText}>Đề xuất giá mới</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={{ flexDirection: "row" }}>
            <TouchableOpacity
              style={[styles.rejectBtn, { flex: 1 }]}
              onPress={() => router.push(`/posts/${item.postId}` as any)}
            >
              <Text style={styles.rejectBtnText}>Xem lại bài đăng</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mobileWrapper, { width }]}>
        <MainHeader title="Tin nhắn" showBack={false} />
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons
              name="search"
              size={20}
              color={COLORS.textLight}
              style={styles.searchIcon}
            />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm đoạn chat..."
              placeholderTextColor={COLORS.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              {...(Platform.OS === "web" && ({ outlineStyle: "none" } as any))}
            />
          </View>
        </View>
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "chat" && styles.tabBtnActive]}
            onPress={() => setActiveTab("chat")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "chat" && styles.tabTextActive,
              ]}
            >
              Đoạn chat
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.tabBtn,
              activeTab === "received" && styles.tabBtnActive,
            ]}
            onPress={() => setActiveTab("received")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "received" && styles.tabTextActive,
              ]}
            >
              Yêu cầu mới
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, activeTab === "sent" && styles.tabBtnActive]}
            onPress={() => setActiveTab("sent")}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === "sent" && styles.tabTextActive,
              ]}
            >
              Đã gửi
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.contentArea}>
          {isLoading ? (
            <View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : activeTab === "chat" ? (
            <FlatList
              data={negotiationsList}
              keyExtractor={(item) => item.negotiationId}
              renderItem={renderNegotiationItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                padding: 16,
                gap: 12,
                paddingBottom: 40,
              }}
              ListEmptyComponent={
                <Text
                  style={{
                    textAlign: "center",
                    color: COLORS.textLight,
                    marginTop: 40,
                  }}
                >
                  Chưa có cuộc trò chuyện nào đang diễn ra.
                </Text>
              }
            />
          ) : (
            <FlatList
              data={offersList}
              keyExtractor={(item) => item.offerId}
              renderItem={renderOfferItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{
                padding: 16,
                gap: 12,
                paddingBottom: 40,
              }}
              ListEmptyComponent={
                <Text
                  style={{
                    textAlign: "center",
                    color: COLORS.textLight,
                    marginTop: 40,
                  }}
                >
                  Bạn chưa có yêu cầu thương lượng nào.
                </Text>
              }
            />
          )}
        </View>

        {/* MODAL ĐỀ XUẤT GIÁ MỚI */}
        <Modal
          visible={showCounterModal}
          transparent={true}
          animationType="slide"
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.modalOverlay}
          >
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Đề xuất giá mới</Text>
                <TouchableOpacity onPress={() => setShowCounterModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <View style={styles.modalBody}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Giá đề xuất (VNĐ){" "}
                    <Text style={{ color: COLORS.error }}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web" &&
                        ({ outlineStyle: "none" } as any),
                    ]}
                    keyboardType="numeric"
                    value={counterPrice}
                    onChangeText={setCounterPrice}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>
                    Số lượng <Text style={{ color: COLORS.error }}>*</Text>
                  </Text>
                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web" &&
                        ({ outlineStyle: "none" } as any),
                    ]}
                    keyboardType="numeric"
                    value={counterQuantity}
                    onChangeText={setCounterQuantity}
                  />
                </View>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Lời nhắn cho khách hàng</Text>
                  <TextInput
                    style={[
                      styles.input,
                      { height: 80, paddingTop: 12 },
                      Platform.OS === "web" &&
                        ({ outlineStyle: "none" } as any),
                    ]}
                    multiline
                    value={counterMessage}
                    onChangeText={setCounterMessage}
                    placeholder="Nhập lời nhắn..."
                  />
                </View>
                <TouchableOpacity
                  style={[
                    styles.primaryBtn,
                    { marginTop: 12 },
                    isProcessingAction && { opacity: 0.7 },
                  ]}
                  onPress={handleSubmitCounter}
                  disabled={isProcessingAction}
                >
                  {isProcessingAction ? (
                    <ActivityIndicator color={COLORS.white} />
                  ) : (
                    <Text style={styles.primaryBtnText}>Gửi đề xuất</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.border, alignItems: "center" },
  mobileWrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
    ...(Platform.OS === "web"
      ? ({ boxShadow: "0px 0px 20px rgba(0,0,0,0.1)" } as any)
      : {}),
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text, height: "100%" },
  tabContainer: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginBottom: 8,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    padding: 4,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  tabBtnActive: {
    backgroundColor: COLORS.white,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: { fontSize: 13, fontWeight: "600", color: COLORS.textLight },
  tabTextActive: { color: COLORS.primary },
  contentArea: { flex: 1, backgroundColor: COLORS.white },
  offerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 12,
  },
  offerHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  offerName: { fontSize: 15, fontWeight: "bold", color: COLORS.text },
  offerTime: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  offerDetails: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  offerProduct: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 4,
  },
  offerPrice: { fontSize: 14, color: COLORS.primary, fontWeight: "bold" },
  rejectBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  rejectBtnText: { color: COLORS.text, fontWeight: "600", fontSize: 14 },
  acceptBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: "center",
  },
  acceptBtnText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  counterBtnOutline: {
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: COLORS.white,
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  counterBtnText: { color: COLORS.primary, fontWeight: "bold", fontSize: 14 },
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
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text },
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
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: { color: COLORS.white, fontWeight: "bold", fontSize: 15 },
});
