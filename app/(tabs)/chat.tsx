import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
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
import { postApi } from "../../src/services/apis/postApi";

export default function ChatListScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === "web" && screenWidth > 480 ? 480 : screenWidth;

  const { user } = useAuth();

  // === STATES CHÍNH ===
  const [activeTab, setActiveTab] = useState<"chat" | "received" | "sent">("received");
  const [searchQuery, setSearchQuery] = useState("");
  const [offersList, setOffersList] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // === STATES CHO MODAL COUNTER (ĐỀ XUẤT GIÁ MỚI) ===
  const [showCounterModal, setShowCounterModal] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [counterPrice, setCounterPrice] = useState("");
  const [counterQuantity, setCounterQuantity] = useState("");
  const [counterMessage, setCounterMessage] = useState("");

  // === HÀM FETCH DỮ LIỆU ===
  const fetchOffers = useCallback(async () => {
    if (!user || activeTab === "chat") return;
    setIsLoading(true);
    setOffersList([]);
    try {
      const res = activeTab === "received" 
        ? await postApi.getReceivedOffers({ PageSize: 50, PageNumber: 1 })
        : await postApi.getSentOffers({ PageSize: 50, PageNumber: 1 });
        
      // Lấy items an toàn
      const items = res?.items || res?.data?.items || [];
      
      // FIX LỖI Ở ĐÂY: API trả về chuỗi "Pending" chứ không phải số 0
      const pendingOffers = items
        .filter((o: any) => o.offerStatus === "Pending" || o.offerStatus === 0)
        .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

      setOffersList(pendingOffers);
    } catch (error) {
      console.error(`Lỗi lấy danh sách Offer (${activeTab}):`, error);
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, user]);

  useFocusEffect(
    useCallback(() => {
      fetchOffers();
    }, [fetchOffers])
  );

  // === HÀNH ĐỘNG: ĐỒNG Ý OFFER ===
  const handleAcceptOffer = async (offerId: string) => {
    const executeAccept = async () => {
      try {
        setIsProcessingAction(true);
        await postApi.acceptOffer(offerId);
        
        if (Platform.OS === "web") window.alert("Đã chấp nhận thương lượng! Phòng chat đã được mở.");
        else Alert.alert("Thành công", "Đã chấp nhận thương lượng! Phòng chat đã được mở.");
        
        // Tải lại danh sách
        fetchOffers();
      } catch (error: any) {
        const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || "Lỗi khi đồng ý.";
        if (Platform.OS === "web") window.alert("Lỗi: " + errorMsg);
        else Alert.alert("Lỗi", errorMsg);
      } finally {
        setIsProcessingAction(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Bạn đồng ý mở phiên thương lượng với mức giá này?")) executeAccept();
    } else {
      Alert.alert("Xác nhận", "Bạn đồng ý mở phiên thương lượng với mức giá này?", [
        { text: "Hủy", style: "cancel" },
        { text: "Đồng ý", onPress: executeAccept },
      ]);
    }
  };

  // === HÀNH ĐỘNG: TỪ CHỐI OFFER ===
  const handleRejectOffer = async (offerId: string) => {
    const executeReject = async () => {
      try {
        setIsProcessingAction(true);
        await postApi.rejectOffer(offerId);
        fetchOffers(); // Refresh lại danh sách sẽ làm biến mất offer này
      } catch (error: any) {
        const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || "Lỗi khi từ chối.";
        if (Platform.OS === "web") window.alert("Lỗi: " + errorMsg);
        else Alert.alert("Lỗi", errorMsg);
      } finally {
        setIsProcessingAction(false);
      }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Từ chối đề nghị này?")) executeReject();
    } else {
      Alert.alert("Xác nhận", "Từ chối đề nghị này?", [
        { text: "Hủy", style: "cancel" },
        { text: "Từ chối", style: "destructive", onPress: executeReject },
      ]);
    }
  };

  // === HÀNH ĐỘNG: MỞ MODAL ĐỀ XUẤT GIÁ MỚI ===
  const handleOpenCounterModal = (offer: any) => {
    setSelectedOffer(offer);
    setCounterPrice(offer.offerPrice?.toString() || "");
    setCounterQuantity(offer.offerQuantity?.toString() || "1");
    setCounterMessage("Chào bạn, tôi muốn đề xuất mức giá mới này.");
    setShowCounterModal(true);
  };

  // === SUBMIT: ĐỀ XUẤT GIÁ MỚI ===
  const handleSubmitCounter = async () => {
    if (!selectedOffer) return;
    const price = parseInt(counterPrice);
    const qty = parseInt(counterQuantity);

    if (isNaN(price) || price <= 0 || isNaN(qty) || qty <= 0) {
      if (Platform.OS === "web") window.alert("Vui lòng nhập giá và số lượng hợp lệ.");
      else Alert.alert("Lỗi", "Vui lòng nhập giá và số lượng hợp lệ.");
      return;
    }

    try {
      setIsProcessingAction(true);
      await postApi.counterInitialOffer(selectedOffer.offerId, {
        offerPrice: price,
        offerQuantity: qty,
        messageContent: counterMessage,
      });

      if (Platform.OS === "web") window.alert("Đã gửi đề xuất giá mới thành công!");
      else Alert.alert("Thành công", "Đã gửi đề xuất giá mới thành công!");

      setShowCounterModal(false);
      fetchOffers();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || "Lỗi khi gửi đề xuất.";
      if (Platform.OS === "web") window.alert("Lỗi: " + errorMsg);
      else Alert.alert("Lỗi", errorMsg);
    } finally {
      setIsProcessingAction(false);
    }
  };

  // === RENDER THẺ OFFER ===
  const renderOfferItem = ({ item }: { item: any }) => {
    const currentUserId = user?.userId || user?.id;
    const isMySentOffer = item.senderId === currentUserId;
    const partnerName = isMySentOffer ? item.receiverName : item.senderName;
    const avatarLetter = partnerName ? partnerName.charAt(0).toUpperCase() : (isMySentOffer ? "NB" : "KH");

    const timeString = item.createdAt
      ? new Date(item.createdAt).toLocaleString("vi-VN", {
          hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric",
        })
      : "";

    return (
      <View style={styles.offerCard}>
        <View style={styles.offerHeader}>
          <View style={styles.avatarPlaceholderSmall}>
            <Text style={styles.avatarTextSmall}>{avatarLetter}</Text>
          </View>
          <View style={{ flex: 1 }}>
            {isMySentOffer ? (
              <Text style={styles.offerName}>
                Bạn <Text style={{ fontWeight: 'normal', color: COLORS.textLight }}>đã gửi thương lượng cho {partnerName || "Người bán"}</Text>
              </Text>
            ) : (
              <Text style={styles.offerName}>
                {partnerName || "Khách hàng"} <Text style={{ fontWeight: 'normal', color: COLORS.textLight }}>đã gửi đề nghị</Text>
              </Text>
            )}
            <Text style={styles.offerTime}>{timeString}</Text>
          </View>
        </View>
        
        <View style={styles.offerDetails}>
          <Text style={styles.offerProduct} numberOfLines={1}>
            {item.productName || item.postTitle || (isMySentOffer ? "Đề nghị mua sản phẩm này" : "Đề nghị mua sản phẩm của bạn")}
          </Text>
          <Text style={styles.offerPrice}>Giá thương lượng: {item.offerPrice?.toLocaleString('vi-VN')} đ</Text>
          <Text style={styles.offerPrice}>Số lượng: {item.offerQuantity}</Text>
        </View>

        {!isMySentOffer ? (
          // === UI 3 NÚT CHO NGƯỜI BÁN (RECEIVED OFFERS) ===
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
          // === UI CHO NGƯỜI MUA (SENT OFFERS) ===
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
            <Ionicons name="search" size={20} color={COLORS.textLight} style={styles.searchIcon} />
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
          <TouchableOpacity style={[styles.tabBtn, activeTab === "chat" && styles.tabBtnActive]} onPress={() => setActiveTab("chat")}>
            <Text style={[styles.tabText, activeTab === "chat" && styles.tabTextActive]}>Đoạn chat</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === "received" && styles.tabBtnActive]} onPress={() => setActiveTab("received")}>
            <Text style={[styles.tabText, activeTab === "received" && styles.tabTextActive]}>Yêu cầu mới</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.tabBtn, activeTab === "sent" && styles.tabBtnActive]} onPress={() => setActiveTab("sent")}>
            <Text style={[styles.tabText, activeTab === "sent" && styles.tabTextActive]}>Đã gửi</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.contentArea}>
          {isLoading ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
              <ActivityIndicator size="large" color={COLORS.primary} />
            </View>
          ) : activeTab === "chat" ? (
            <View style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}>
              <Ionicons name="chatbubbles-outline" size={60} color="#CBD5E1" />
              <Text style={{ marginTop: 16, color: COLORS.textLight, textAlign: "center" }}>
                Chưa có cuộc trò chuyện nào đang diễn ra.
              </Text>
            </View>
          ) : (
            <FlatList
              data={offersList}
              keyExtractor={(item) => item.offerId}
              renderItem={renderOfferItem}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
              ListEmptyComponent={
                <Text style={{ textAlign: "center", color: COLORS.textLight, marginTop: 40 }}>
                  {activeTab === "received" ? "Bạn chưa nhận được yêu cầu thương lượng nào." : "Bạn chưa gửi yêu cầu thương lượng nào."}
                </Text>
              }
            />
          )}
        </View>

        {/* ============================================================== */}
        {/* MODAL ĐỀ XUẤT GIÁ MỚI (COUNTER OFFER)                          */}
        {/* ============================================================== */}
        <Modal visible={showCounterModal} transparent={true} animationType="slide">
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Đề xuất giá mới</Text>
                <TouchableOpacity onPress={() => setShowCounterModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Giá đề xuất (VNĐ) <Text style={{ color: COLORS.error }}>*</Text></Text>
                  <TextInput
                    style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
                    keyboardType="numeric"
                    value={counterPrice}
                    onChangeText={setCounterPrice}
                    placeholder="VD: 1500000"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Số lượng <Text style={{ color: COLORS.error }}>*</Text></Text>
                  <TextInput
                    style={[styles.input, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
                    keyboardType="numeric"
                    value={counterQuantity}
                    onChangeText={setCounterQuantity}
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Lời nhắn cho khách hàng</Text>
                  <TextInput
                    style={[styles.input, { height: 80, paddingTop: 12 }, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
                    multiline
                    value={counterMessage}
                    onChangeText={setCounterMessage}
                    placeholder="Nhập lời nhắn..."
                  />
                </View>

                <TouchableOpacity
                  style={[styles.primaryBtn, { marginTop: 12 }, isProcessingAction && { opacity: 0.7 }]}
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
    flex: 1, backgroundColor: COLORS.background,
    ...(Platform.OS === "web" ? ({ boxShadow: "0px 0px 20px rgba(0,0,0,0.1)" } as any) : {}),
  },

  searchContainer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white },
  searchBox: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC",
    borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: COLORS.border,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text, height: '100%' },

  tabContainer: {
    flexDirection: "row", marginHorizontal: 16, marginBottom: 8,
    backgroundColor: "#F1F5F9", borderRadius: 8, padding: 4,
  },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: "center", borderRadius: 6 },
  tabBtnActive: { backgroundColor: COLORS.white, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 2, elevation: 2 },
  tabText: { fontSize: 13, fontWeight: "600", color: COLORS.textLight },
  tabTextActive: { color: COLORS.primary },

  contentArea: { flex: 1, backgroundColor: COLORS.white },

  offerCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  offerHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  avatarPlaceholderSmall: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#334155", justifyContent: "center", alignItems: "center", marginRight: 10 },
  avatarTextSmall: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },
  offerName: { fontSize: 15, fontWeight: "bold", color: COLORS.text },
  offerTime: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  offerDetails: { backgroundColor: "#F8FAFC", padding: 12, borderRadius: 8, marginBottom: 16 },
  offerProduct: { fontSize: 15, fontWeight: "600", color: COLORS.text, marginBottom: 4 },
  offerPrice: { fontSize: 14, color: COLORS.primary, fontWeight: "bold" },
  
  rejectBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: "#F1F5F9", alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0" },
  rejectBtnText: { color: COLORS.text, fontWeight: "600", fontSize: 14 },
  acceptBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: COLORS.primary, alignItems: "center" },
  acceptBtnText: { color: COLORS.white, fontWeight: "600", fontSize: 14 },
  
  counterBtnOutline: { paddingVertical: 10, borderRadius: 8, backgroundColor: COLORS.white, alignItems: "center", borderWidth: 1, borderColor: COLORS.primary },
  counterBtnText: { color: COLORS.primary, fontWeight: "bold", fontSize: 14 },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: Platform.OS === "ios" ? 40 : 24 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 20 },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  modalBody: { gap: 16 },
  inputGroup: { gap: 8 },
  inputLabel: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  input: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, height: 50, fontSize: 15, backgroundColor: "#F8FAFC", color: COLORS.text },
  
  primaryBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 14, borderRadius: 8, backgroundColor: COLORS.primary },
  primaryBtnText: { color: COLORS.white, fontWeight: "bold", fontSize: 15 },
});