import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Keyboard,
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
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { postApi } from "../../src/services/apis/postApi";
import { offerApi } from "../../src/services/apis/offerApi";
import { negotiationApi } from "../../src/services/apis/negotiationApi";
import Header from "../../src/components/shared/Header";

const getRobustAvatar = (url: string | null | undefined, name: string) => {
  const isValid = url && url !== "string" && url !== "null" && url.startsWith("http");
  if (isValid) {
    if (url.includes("googleusercontent.com")) {
      return `https://wsrv.nl/?url=${encodeURIComponent(url)}`;
    }
    return url;
  }
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || "U")}&background=547B7D&color=fff`;
};

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id: negotiationId } = useLocalSearchParams(); 
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === "web" && screenWidth > 480 ? 480 : screenWidth;

  const { user } = useAuth();
  const currentUserId = user?.userId || user?.id;

  const [negotiationInfo, setNegotiationInfo] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  // === STATE CHO MENU VÀ MODAL ===
  const [isActionMenuVisible, setActionMenuVisible] = useState(false); // State mở Menu thao tác
  const [isCounterModalVisible, setCounterModalVisible] = useState(false);
  const [counterPriceInput, setCounterPriceInput] = useState("");
  const [counterQuantityInput, setCounterQuantityInput] = useState("1");

  const fetchNegotiationDetails = useCallback(async (showLoading = true) => {
    if (!negotiationId || !currentUserId) return;
    
    try {
      if (showLoading) setIsLoading(true);
      
      const res = await negotiationApi.getNegotiationById(negotiationId as string);
      const info = res?.data || res;
      
      let productDetails = { 
        postId: "", name: "Sản phẩm thương lượng", image: "", basePrice: 0, city: "", productTypeName: "",
        partnerName: info?.otherPartyName, 
        partnerAvatar: info?.otherPartyAvatarUrl
      };

      if (info?.offerId) {
        try {
          const offerRes = await offerApi.getOfferById(info.offerId); 
          const offerData = offerRes?.data || offerRes;

          if (!productDetails.partnerName && offerData) {
            const isSender = offerData.sender?.userId?.toLowerCase() === currentUserId.toLowerCase();
            const partner = isSender ? offerData.receiver : offerData.sender;
            
            if (partner) {
              productDetails.partnerName = partner.displayName || partner.username || "Đối tác giao dịch";
              productDetails.partnerAvatar = partner.avatarUrl || partner.avatar || null;
            }
          }

          if (offerData?.postId) {
            const postRes = await postApi.getPostById(offerData.postId); 
            const postData = postRes?.data || postRes;
            
            productDetails.postId = postData?.postId || "";
            productDetails.name = postData?.product?.productName || postData?.productName || "Sản phẩm";
            productDetails.basePrice = postData?.basePrice || 0;
            productDetails.city = postData?.city || "Chưa cập nhật";
            productDetails.productTypeName = postData?.product?.productTypeName || postData?.productTypeName || "";
            if (postData?.medias && postData.medias.length > 0) {
              productDetails.image = postData.medias[0].url || postData.medias[0].mediaUrl;
            }
          }
        } catch (e) { console.log("Lỗi fetch phụ:", e); }
      }

      productDetails.partnerName = productDetails.partnerName || "Đối tác giao dịch";
      setNegotiationInfo({ ...info, ...productDetails });

      const rawMessages = info?.messages || [];
      const sortedMessages = [...rawMessages].sort((a: any, b: any) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (timeA === timeB) { return (a.messageType || 0) - (b.messageType || 0); }
        return timeA - timeB;
      });
      
      const formattedMessages = sortedMessages.map((m: any, index: number) => {
        const isMe = m.senderId === currentUserId;
        return {
          id: m.messageId || index.toString(),
          type: (m.messageType === 2 || m.messageType === 3 || m.offerPrice > 0) ? "offer" : "text",
          text: m.messageContent || "", 
          price: m.offerPrice || 0,
          quantity: m.offerQuantity || 1,
          status: "pending", 
          sender: isMe ? "me" : "them",
          time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Vừa xong",
        };
      });

      setMessages(formattedMessages);
    } catch (error) { console.error("Lỗi:", error); } finally { if (showLoading) setIsLoading(false); }
  }, [negotiationId, currentUserId]);

  useFocusEffect(useCallback(() => { if (currentUserId) fetchNegotiationDetails(true); }, [fetchNegotiationDetails, currentUserId]));

  const renderProductBanner = () => (
    <TouchableOpacity style={styles.productBanner} activeOpacity={0.7} onPress={() => { if (negotiationInfo?.postId) { router.push({ pathname: "/posts/[id]", params: { id: negotiationInfo.postId, viewOnly: "true" }}); } }}>
      <Image source={{ uri: negotiationInfo?.image || "https://placehold.co/100x100/png" }} style={styles.productImg} />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>{negotiationInfo?.name}</Text>
        <Text style={styles.productSubText} numberOfLines={1}>{negotiationInfo?.productTypeName || "Khác"} • {negotiationInfo?.city || "N/A"}</Text>
        <Text style={styles.productPrice}>Giá niêm yết: <Text style={{ color: COLORS.text, fontWeight: "bold" }}>{formatCurrency(negotiationInfo?.basePrice)}</Text></Text>
      </View>
      <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
    </TouchableOpacity>
  );

  const currentActiveOffer = useMemo(() => {
    const offers = messages.filter((m) => m.type === "offer");
    return offers.length > 0 ? offers[offers.length - 1] : null;
  }, [messages]);

  const openCounterModal = () => {
    if (currentActiveOffer) {
      setCounterPriceInput(currentActiveOffer.price.toLocaleString("vi-VN"));
      setCounterQuantityInput(currentActiveOffer.quantity.toString());
    } else {
      setCounterPriceInput("");
      setCounterQuantityInput("1");
    }
    setCounterModalVisible(true);
  };

  const handlePriceChange = (text: string) => {
    const numericValue = text.replace(/\D/g, "");
    if (!numericValue) { setCounterPriceInput(""); return; }
    setCounterPriceInput(parseInt(numericValue, 10).toLocaleString("vi-VN"));
  };

  const handleAccept = async (proposalMessageId: string) => {
    try {
      setIsProcessing(true);
      await negotiationApi.acceptProposal(negotiationId as string, proposalMessageId); 
      Alert.alert("Thành công", "Đã chấp nhận thương lượng thành công!", [
        {
          text: "Tiếp tục tạo hợp đồng",
          // MOCK: Chuyển hướng sang form tạo hợp đồng
          onPress: () => router.push(`/agreements/form?negotiationId=${negotiationId}`)
        }
      ]);
      fetchNegotiationDetails(true);
    } catch (error: any) { Alert.alert("Lỗi", error.response?.data?.error?.message || error.response?.data?.message || "Lỗi."); } finally { setIsProcessing(false); }
  };

  const handleReject = async (proposalMessageId: string) => {
    try {
      setIsProcessing(true);
      await negotiationApi.rejectProposal(negotiationId as string, proposalMessageId); 
      Alert.alert("Thành công", "Đã từ chối đề nghị.");
      fetchNegotiationDetails(true);
    } catch (error: any) { Alert.alert("Lỗi", error.response?.data?.error?.message || error.response?.data?.message || "Lỗi."); } finally { setIsProcessing(false); }
  };

  const submitCounterOffer = async () => {
    const numPrice = parseInt(counterPriceInput.replace(/\D/g, ""));
    const numQty = parseInt(counterQuantityInput) || 1;
    if (isNaN(numPrice) || numPrice <= 0) { Alert.alert("Lỗi", "Vui lòng nhập mức giá hợp lệ."); return; }

    try {
      setIsProcessing(true);
      await negotiationApi.counterNegotiation(negotiationId as string, { offerPrice: numPrice, offerQuantity: numQty });
      Alert.alert("Thành công", "Đã gửi đề xuất giá mới!");
      setCounterModalVisible(false);
      fetchNegotiationDetails(true);
    } catch (error: any) { Alert.alert("Lỗi", error.response?.data?.error?.message || error.response?.data?.message || "Lỗi."); } finally { setIsProcessing(false); }
  };

  // === HÀM XỬ LÝ HỦY GIAO DỊCH ===
  const handleCancelNegotiation = () => {
    Alert.alert(
      "Hủy giao dịch",
      "Bạn có chắc chắn muốn hủy phiên thương lượng này không? Hành động này không thể hoàn tác.",
      [
        { text: "Không", style: "cancel" },
        { 
          text: "Hủy giao dịch", 
          style: "destructive", 
          onPress: async () => {
            try {
              setIsProcessing(true);
              await negotiationApi.cancelNegotiation(negotiationId as string);
              Alert.alert("Thành công", "Đã hủy phiên thương lượng.");
              fetchNegotiationDetails(true);
            } catch (error: any) {
              Alert.alert("Lỗi", error.response?.data?.error?.message || error.response?.data?.message || "Không thể hủy giao dịch.");
            } finally {
              setIsProcessing(false);
            }
          }
        }
      ]
    );
  };

  const formatCurrency = (value: number) => { return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value || 0); };

  const renderHeader = () => {
    const partnerName = negotiationInfo?.partnerName || "Đối tác giao dịch";
    const avatarUri = getRobustAvatar(negotiationInfo?.partnerAvatar, partnerName);

    const CenterComponent = (
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <Image source={{ uri: avatarUri }} style={styles.headerAvatar} />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={styles.headerName} numberOfLines={1}>{partnerName}</Text>
          {/* Vẫn giữ trạng thái để biết bị hủy hay chưa */}
          <Text style={styles.headerStatus}>Trạng thái: {negotiationInfo?.negotiationStatus || "Open"}</Text>
        </View>
      </View>
    );

    const RightComponent = (
      <TouchableOpacity style={styles.headerIcon} onPress={() => fetchNegotiationDetails(true)}><Ionicons name="reload" size={20} color={COLORS.primary} /></TouchableOpacity>
    );

    return <Header showBack={true} centerContent={CenterComponent} rightContent={RightComponent} />;
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender === "me";

    if (item.type === "offer") {
      const isLatestOffer = currentActiveOffer?.id === item.id;
      const negStatus = negotiationInfo?.negotiationStatus;
      const defaultTitle = isMe ? "Bạn đề xuất" : "Đối tác đề xuất";
      const offerTitle = item.text && item.text.trim() !== "" ? item.text : defaultTitle;

      return (
        <View style={[styles.offerContainer, isMe ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }]}>
          <View style={[styles.offerCard, !isLatestOffer && { opacity: 0.5 }]}>
            <View style={styles.offerHeader}>
              <Ionicons name="pricetag" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.offerTitle}>{offerTitle}</Text>
            </View>
            <View style={styles.offerPriceBox}>
              <Text style={styles.offerPriceValue}>{formatCurrency(item.price)}</Text>
              <Text style={{ color: COLORS.textLight, marginTop: 4, fontSize: 13 }}>Số lượng: {item.quantity}</Text>
            </View>

            {isLatestOffer && negStatus === "Open" && (
              isMe ? ( <Text style={styles.pendingText}>Đang chờ đối tác phản hồi...</Text> ) : (
                <View style={styles.actionBlock}>
                  <View style={styles.offerActionRow}>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.id)} disabled={isProcessing}><Text style={styles.rejectBtnText}>Từ chối</Text></TouchableOpacity>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item.id)} disabled={isProcessing}><Text style={styles.acceptBtnText}>Đồng ý</Text></TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.counterBtn} onPress={openCounterModal} disabled={isProcessing}><Text style={styles.counterBtnText}>Đề xuất giá khác</Text></TouchableOpacity>
                </View>
              )
            )}
            {isLatestOffer && negStatus === "Accepted" && ( <View style={styles.statusBadgeSuccess}><Ionicons name="checkmark-circle" size={16} color={COLORS.white} /><Text style={styles.statusBadgeText}>Đã chốt kèo thành công</Text></View> )}
            {isLatestOffer && (negStatus === "Rejected" || negStatus === "Cancelled") && ( <View style={styles.statusBadgeError}><Ionicons name="close-circle" size={16} color={COLORS.white} /><Text style={styles.statusBadgeText}>Thương lượng bị hủy / từ chối</Text></View> )}
            {!isLatestOffer && ( <Text style={styles.outdatedOfferText}>(Đề xuất cũ)</Text> )}
          </View>
          <Text style={[styles.timeText, isMe ? { alignSelf: "flex-end", marginRight: 8 } : { alignSelf: "flex-start", marginLeft: 8 }]}>{item.time}</Text>
        </View>
      );
    }
    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowThem]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}><Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}>{item.text}</Text></View>
        <Text style={[styles.timeText, isMe ? { alignSelf: "flex-end", marginRight: 4 } : { alignSelf: "flex-start", marginLeft: 4 }]}>{item.time}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.mobileWrapper, { width }]}>
        {renderHeader()}
        {renderProductBanner()}

        {isLoading ? ( <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}><ActivityIndicator size="large" color={COLORS.primary} /></View> ) : (
          <FlatList data={messages} keyExtractor={(item) => item.id} renderItem={renderMessage} contentContainerStyle={styles.chatList} showsVerticalScrollIndicator={false} ListHeaderComponent={<Text style={styles.dateSeparator}>Giao dịch bắt đầu</Text>} />
        )}

        <View style={styles.inputContainer}>
          {negotiationInfo?.negotiationStatus === "Open" ? (
            // ĐỔI ICON Ở ĐÂY VÀ GỌI MENU
            <TouchableOpacity style={styles.attachBtn} onPress={() => setActionMenuVisible(true)}>
              <Ionicons name="add-circle-outline" size={28} color={COLORS.primary} />
            </TouchableOpacity>
          ) : (
            <View style={[styles.attachBtn, { opacity: 0.5 }]}>
              <Ionicons name="add-circle-outline" size={28} color={COLORS.textLight} />
            </View>
          )}
          <View style={[styles.textInput, { justifyContent: 'center', backgroundColor: '#F1F5F9' }]}><Text style={{ color: COLORS.textLight, fontStyle: 'italic', fontSize: 14 }}>Tính năng nhắn tin đang phát triển...</Text></View>
          <View style={[styles.sendBtn, { backgroundColor: COLORS.border }]}><Ionicons name="send" size={18} color={COLORS.white} /></View>
        </View>
      </KeyboardAvoidingView>

      {/* === MODAL MENU THAO TÁC (NÚT DẤU CỘNG) === */}
      <Modal visible={isActionMenuVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setActionMenuVisible(false)}>
          <View style={styles.menuSheetContent}>
            
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                setActionMenuVisible(false);
                openCounterModal();
              }}
            >
              <Ionicons name="pricetag-outline" size={22} color={COLORS.primary} />
              <Text style={styles.menuItemText}>Đề xuất giá mới</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                setActionMenuVisible(false);
                handleCancelNegotiation();
              }}
            >
              <Ionicons name="close-circle-outline" size={22} color={COLORS.error} />
              <Text style={[styles.menuItemText, { color: COLORS.error }]}>Hủy giao dịch</Text>
            </TouchableOpacity>

            <View style={styles.menuDivider} />

            {/* === NÚT MOCK TẠO ĐƠN === */}
            <TouchableOpacity 
              style={styles.menuItem} 
              onPress={() => {
                setActionMenuVisible(false);
                router.push(`/agreements/form?negotiationId=${negotiationId}`);
              }}
            >
              <Ionicons name="document-text-outline" size={22} color={COLORS.primary} />
              <Text style={styles.menuItemText}>Tạo đơn xác nhận (Mock)</Text>
            </TouchableOpacity>

          </View>
        </TouchableOpacity>
      </Modal>

      {/* === MODAL ĐỀ XUẤT GIÁ === */}
      <Modal visible={isCounterModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Đề xuất mức giá mới</Text>
              <TouchableOpacity onPress={() => setCounterModalVisible(false)}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <TextInput
                style={styles.priceInput}
                placeholder={currentActiveOffer ? currentActiveOffer.price.toLocaleString("vi-VN") : "Ví dụ: 1.500.000"}
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                value={counterPriceInput}
                onChangeText={handlePriceChange}
                selectTextOnFocus={true} 
                autoFocus
              />
              <Text style={styles.currencyLabel}>VNĐ</Text>
            </View>

            <View style={[styles.inputGroup, { marginBottom: 24 }]}>
              <TextInput
                style={[styles.priceInput, { fontSize: 16 }]}
                placeholder={currentActiveOffer ? currentActiveOffer.quantity.toString() : "1"}
                placeholderTextColor="#94A3B8"
                keyboardType="number-pad"
                value={counterQuantityInput}
                onChangeText={setCounterQuantityInput}
                selectTextOnFocus={true} 
              />
              <Text style={styles.currencyLabel}>SL</Text>
            </View>

            <TouchableOpacity style={styles.submitOfferBtn} onPress={submitCounterOffer} disabled={isProcessing}>
              {isProcessing ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitOfferText}>Gửi Đề Xuất</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.border, alignItems: "center" },
  mobileWrapper: { flex: 1, backgroundColor: COLORS.background, ...(Platform.OS === "web" ? ({ boxShadow: "0px 0px 20px rgba(0,0,0,0.1)" } as any) : {}), },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10, borderWidth: 1, borderColor: "#E2E8F0" },
  headerName: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  headerStatus: { fontSize: 12, color: COLORS.textLight, marginTop: 2 }, // Khôi phục CSS trạng thái để hiển thị lúc Cancelled
  headerIcon: { padding: 8 },
  productBanner: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, padding: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", elevation: 2, },
  productImg: { width: 40, height: 40, borderRadius: 6, marginRight: 10 },
  productInfo: { flex: 1 },
  productName: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  productPrice: { fontSize: 13, color: COLORS.textLight, fontWeight: "600", marginTop: 4, },
  chatList: { padding: 16, paddingBottom: 24 },
  dateSeparator: { alignSelf: "center", backgroundColor: "#E2E8F0", color: COLORS.textLight, fontSize: 11, fontWeight: "600", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: "hidden", marginBottom: 16, },
  systemText: { alignSelf: "center", backgroundColor: "#E9F0F0", color: COLORS.primary, fontSize: 12, fontWeight: "500", paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, overflow: "hidden", marginBottom: 16, textAlign: "center", maxWidth: "90%", },
  messageRow: { marginBottom: 16, maxWidth: "80%" },
  messageRowMe: { alignSelf: "flex-end", alignItems: "flex-end" },
  messageRowThem: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  bubbleMe: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: "#EAEAEA", borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  messageTextMe: { color: COLORS.white },
  messageTextThem: { color: COLORS.text },
  timeText: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },
  offerContainer: { width: "85%", marginBottom: 16 },
  offerCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, },
  offerHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  offerTitle: { flex: 1, fontSize: 16, fontWeight: "700", color: COLORS.text }, 
  offerPriceBox: { backgroundColor: "#F8FAFC", padding: 12, borderRadius: 8, marginBottom: 12, alignItems: "center", },
  offerPriceValue: { fontSize: 24, fontWeight: "800", color: COLORS.primary },
  actionBlock: { marginTop: 4 },
  offerActionRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  rejectBtn: { flex: 1, height: 40, justifyContent: "center", alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: COLORS.error, backgroundColor: COLORS.white, },
  rejectBtnText: { color: COLORS.error, fontSize: 14, fontWeight: "700" },
  acceptBtn: { flex: 1, height: 40, justifyContent: "center", alignItems: "center", borderRadius: 8, backgroundColor: COLORS.primary, },
  acceptBtnText: { color: COLORS.white, fontSize: 14, fontWeight: "700" },
  counterBtn: { height: 40, justifyContent: "center", alignItems: "center", borderRadius: 8, backgroundColor: "#E9F0F0", },
  counterBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: "700" },
  pendingText: { fontSize: 13, color: COLORS.textLight, fontStyle: "italic", textAlign: "center", },
  outdatedOfferText: { fontSize: 12, color: COLORS.textLight, textAlign: "center", marginTop: 8 }, 
  statusBadgeSuccess: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: "#388E3C", paddingVertical: 8, borderRadius: 8, gap: 6, },
  statusBadgeError: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.error, paddingVertical: 8, borderRadius: 8, gap: 6, },
  statusBadgeText: { color: COLORS.white, fontWeight: "700", fontSize: 13 },
  inputContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, },
  attachBtn: { marginRight: 8, padding: 4 },
  textInput: { flex: 1, backgroundColor: COLORS.background, minHeight: 40, maxHeight: 100, borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border, },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.text, justifyContent: "center", alignItems: "center", marginLeft: 8, },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 300, },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, },
  modalTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  modalDesc: { fontSize: 14, color: COLORS.textLight, marginBottom: 24 },
  inputGroup: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, height: 56, marginBottom: 16, backgroundColor: COLORS.background, },
  priceInput: { flex: 1, fontSize: 20, fontWeight: "700", color: COLORS.primary, ...(Platform.OS === "web" ? { outlineStyle: "none" as any } : {}), } as any,
  currencyLabel: { fontSize: 16, fontWeight: "700", color: COLORS.textLight, marginLeft: 8, },
  submitOfferBtn: { height: 50, backgroundColor: COLORS.primary, borderRadius: 12, justifyContent: "center", alignItems: "center", },
  submitOfferText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
  productSubText: { fontSize: 12, color: COLORS.textLight, marginTop: 2, },
  
  // === STYLE MỚI CHO ACTION MENU ===
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end", },
  menuSheetContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === "ios" ? 40 : 20, },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, },
  menuItemText: { fontSize: 16, fontWeight: "600", color: COLORS.text, marginLeft: 12, },
  menuDivider: { height: 1, backgroundColor: COLORS.border, },
});