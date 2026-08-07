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

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id: negotiationId } = useLocalSearchParams(); // Nhận negotiationId từ URL
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === "web" && screenWidth > 480 ? 480 : screenWidth;

  const { user } = useAuth();
  const currentUserId = user?.userId || user?.id;

  // STATES DỮ LIỆU THỰC TẾ TỪ API
  const [negotiationInfo, setNegotiationInfo] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);

  const [inputText, setInputText] = useState("");

  // States cho Modal Trả giá (Counter)
  const [isCounterModalVisible, setCounterModalVisible] = useState(false);
  const [counterPriceInput, setCounterPriceInput] = useState("");
  const [counterQuantityInput, setCounterQuantityInput] = useState("1");

  // === FETCH DỮ LIỆU TỪ API ===
  const fetchNegotiationDetails = useCallback(async () => {
    if (!negotiationId) return;
    try {
      setIsLoading(true);
      // 1. Gọi lấy thông tin negotiation và messages
      const [detailRes, messagesRes] = await Promise.all([
        postApi.getNegotiationById(negotiationId as string),
        postApi.getNegotiationMessages(negotiationId as string, { PageSize: 50, PageNumber: 1 }),
      ]);

      const info = detailRes?.data || detailRes;
      
      // 2. Nếu thông tin thiếu tên sản phẩm, ta dùng offerId để truy ngược lấy thông tin Offer -> Post -> Tên sản phẩm
      let productDetails = { name: "Sản phẩm thương lượng", image: "", price: 0 };
      if (info?.offerId) {
        try {
          const offerRes = await postApi.getOfferById(info.offerId);
          const offerData = offerRes?.data || offerRes;
          if (offerData?.postId) {
            const postRes = await postApi.getPostById(offerData.postId);
            const postData = postRes?.data || postRes;
            productDetails.name = postData?.productName || postData?.description || "Sản phẩm";
            productDetails.price = postData?.basePrice || postData?.expectedPrice || 0;
            if (postData?.medias && postData.medias.length > 0) {
              productDetails.image = postData.medias[0].url || postData.medias[0].mediaUrl;
            }
          }
        } catch (e) {
          console.log("Không thể fetch phụ Product info:", e);
        }
      }

      setNegotiationInfo({
        ...info,
        ...productDetails,
        buyerName: "Đối tác giao dịch", // Tạm thời gán mặc định nếu BE chưa trả về tên
      });

      const rawMessages = messagesRes?.items || messagesRes?.data?.items || messagesRes?.data || [];
      
      const formattedMessages = rawMessages.map((m: any, index: number) => {
        const isMe = m.senderId === currentUserId;
        return {
          id: m.messageId || index.toString(),
          type: m.messageType === 2 || m.offerPrice ? "offer" : "text",
          text: m.messageContent || "",
          price: m.offerPrice || 0,
          status: info?.offerStatus === "Accepted" ? "accepted" : info?.offerStatus === "Rejected" ? "rejected" : "pending",
          sender: isMe ? "me" : "them",
          time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Vừa xong",
        };
      });

      setMessages(formattedMessages);
    } catch (error) {
      console.error("Lỗi lấy thông tin phòng thương lượng:", error);
    } finally {
      setIsLoading(false);
    }
  }, [negotiationId, currentUserId]);

  // Lấy ra mức giá Offer mới nhất để ghim lên đầu màn hình
  const currentActiveOffer = useMemo(() => {
    const offers = messages.filter((m) => m.type === "offer");
    return offers.length > 0 ? offers[offers.length - 1] : null;
  }, [messages]);

  // === XỬ LÝ GỬI TIN NHẮN VĂN BẢN ===
  const handleSendText = () => {
    if (!inputText.trim()) return;
    const newMessage = {
      id: Date.now().toString(),
      type: "text",
      text: inputText,
      sender: "me",
      time: "Vừa xong",
    };
    setMessages((prev) => [...prev, newMessage]);
    setInputText("");
    Keyboard.dismiss();
  };

  // === XỬ LÝ CHẤP NHẬN ĐỀ NGHỊ (CHỐT DEAL) ===
  const handleAccept = async () => {
    try {
      setIsProcessing(true);
      await postApi.acceptNegotiation(negotiationId as string);

      if (Platform.OS === "web") window.alert("Đã chấp nhận thương lượng thành công!");
      else Alert.alert("Thành công", "Đã chấp nhận thương lượng thành công!");

      fetchNegotiationDetails(); // Reload lại data
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || "Không thể chốt deal lúc này.";
      if (Platform.OS === "web") window.alert("Lỗi: " + errorMsg);
      else Alert.alert("Lỗi", errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  // === XỬ LÝ TỪ CHỐI ĐỀ NGHỊ ===
  const handleReject = async () => {
    try {
      setIsProcessing(true);
      await postApi.rejectNegotiation(negotiationId as string);

      if (Platform.OS === "web") window.alert("Đã từ chối đề nghị.");
      else Alert.alert("Thành công", "Đã từ chối đề nghị.");

      fetchNegotiationDetails();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || "Không thể từ chối lúc này.";
      if (Platform.OS === "web") window.alert("Lỗi: " + errorMsg);
      else Alert.alert("Lỗi", errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  // === XỬ LÝ GỬI ĐỀ XUẤT GIÁ MỚI (COUNTER) ===
  const submitCounterOffer = async () => {
    if (!counterPriceInput) return;
    const numPrice = parseInt(counterPriceInput.replace(/\D/g, ""));
    const numQty = parseInt(counterQuantityInput) || 1;
    if (isNaN(numPrice) || numPrice <= 0) return;

    try {
      setIsProcessing(true);
      // Gọi đúng API counterNegotiation (Không chứa trường messageContent theo Swagger)
      await postApi.counterNegotiation(negotiationId as string, {
        offerPrice: numPrice,
        offerQuantity: numQty,
      });

      if (Platform.OS === "web") window.alert("Đã gửi đề xuất giá mới!");
      else Alert.alert("Thành công", "Đã gửi đề xuất giá mới!");

      setCounterModalVisible(false);
      setCounterPriceInput("");
      fetchNegotiationDetails();
    } catch (error: any) {
      const errorMsg = error.response?.data?.error?.message || error.response?.data?.message || "Không thể gửi đề xuất.";
      if (Platform.OS === "web") window.alert("Lỗi: " + errorMsg);
      else Alert.alert("Lỗi", errorMsg);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatCurrency = (value: number) => {
    if (!value) return "0 đ";
    return new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(value);
  };

  // UI GIAO DIỆN HEADER
  const renderHeader = () => {
    const partnerName = negotiationInfo?.buyerName || negotiationInfo?.sellerName || "Đối tác giao dịch";
    const avatarUri = negotiationInfo?.buyerAvatar || negotiationInfo?.sellerAvatar || "https://ui-avatars.com/api/?name=Partner&background=547B7D&color=fff";

    return (
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            router.canGoBack() ? router.back() : router.replace("/(tabs)/chat");
          }}
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Image source={{ uri: avatarUri }} style={styles.headerAvatar} />
          <View>
            <Text style={styles.headerName} numberOfLines={1}>{partnerName}</Text>
            <Text style={styles.headerStatus}>Trạng thái: {negotiationInfo?.negotiationStatus || "Open"}</Text>
          </View>
        </View>
        <TouchableOpacity style={styles.headerIcon} onPress={fetchNegotiationDetails}>
          <Ionicons name="reload" size={20} color={COLORS.primary} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderProductBanner = () => (
    <View style={styles.productBanner}>
      <Image
        source={{ uri: negotiationInfo?.productImage || "https://placehold.co/100x100/png" }}
        style={styles.productImg}
      />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>
          {negotiationInfo?.productName || negotiationInfo?.postTitle || "Sản phẩm thương lượng"}
        </Text>
        <Text style={styles.productPrice}>
          Mức giá thỏa thuận:{" "}
          <Text style={{ color: COLORS.error }}>
            {currentActiveOffer ? formatCurrency(currentActiveOffer.price) : "Chưa có"}
          </Text>
        </Text>
      </View>
    </View>
  );

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender === "me";
    const isSystem = item.sender === "system";

    if (isSystem) {
      return <Text style={styles.systemText}>{item.text}</Text>;
    }

    if (item.type === "offer") {
      const isLatestOffer = currentActiveOffer?.id === item.id;

      return (
        <View style={[styles.offerContainer, isMe ? { alignSelf: "flex-end" } : { alignSelf: "flex-start" }]}>
          <View style={[styles.offerCard, !isLatestOffer && { opacity: 0.6 }]}>
            <View style={styles.offerHeader}>
              <Ionicons name="pricetag" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.offerTitle}>{isMe ? "Bạn đề xuất" : "Đối tác đề xuất"}</Text>
            </View>
            <View style={styles.offerPriceBox}>
              <Text style={styles.offerPriceValue}>{formatCurrency(item.price)}</Text>
            </View>

            {/* HIỂN THỊ NÚT BẤM THEO TRẠNG THÁI */}
            {item.status === "pending" && isLatestOffer && (
              isMe ? (
                <Text style={styles.pendingText}>Đang chờ đối tác phản hồi...</Text>
              ) : (
                <View style={styles.actionBlock}>
                  <View style={styles.offerActionRow}>
                    <TouchableOpacity style={styles.rejectBtn} onPress={handleReject} disabled={isProcessing}>
                      <Text style={styles.rejectBtnText}>Từ chối</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.acceptBtn} onPress={handleAccept} disabled={isProcessing}>
                      <Text style={styles.acceptBtnText}>Đồng ý</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.counterBtn} onPress={() => setCounterModalVisible(true)} disabled={isProcessing}>
                    <Text style={styles.counterBtnText}>Đề xuất giá khác</Text>
                  </TouchableOpacity>
                </View>
              )
            )}

            {item.status === "accepted" && (
              <View style={styles.statusBadgeSuccess}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
                <Text style={styles.statusBadgeText}>Đã chốt giá</Text>
              </View>
            )}

            {item.status === "rejected" && (
              <View style={styles.statusBadgeError}>
                <Ionicons name="close-circle" size={16} color={COLORS.white} />
                <Text style={styles.statusBadgeText}>Đã từ chối</Text>
              </View>
            )}
          </View>
          <Text style={[styles.timeText, isMe ? { alignSelf: "flex-end", marginRight: 8 } : { alignSelf: "flex-start", marginLeft: 8 }]}>
            {item.time}
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowThem]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}>
            {item.text}
          </Text>
        </View>
        <Text style={[styles.timeText, isMe ? { alignSelf: "flex-end", marginRight: 4 } : { alignSelf: "flex-start", marginLeft: 4 }]}>
          {item.time}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={[styles.mobileWrapper, { width }]}>
        {renderHeader()}
        {renderProductBanner()}

        {isLoading ? (
          <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
            <ActivityIndicator size="large" color={COLORS.primary} />
          </View>
        ) : (
          <FlatList
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.chatList}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={<Text style={styles.dateSeparator}>Hôm nay</Text>}
          />
        )}

        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachBtn} onPress={() => setCounterModalVisible(true)}>
            <Ionicons name="cash-outline" size={26} color={COLORS.primary} />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor={COLORS.border}
            value={inputText}
            onChangeText={setInputText}
            multiline
            {...(Platform.OS === "web" && ({ outlineStyle: "none" } as any))}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSendText}>
            <Ionicons name="send" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      {/* MODAL TRẢ GIÁ KHÁC (COUNTER OFFER) */}
      <Modal visible={isCounterModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Đề xuất mức giá mới</Text>
              <TouchableOpacity onPress={() => setCounterModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <Text style={styles.modalDesc}>
              Mức giá hiện tại: {currentActiveOffer ? formatCurrency(currentActiveOffer.price) : "Chưa có"}
            </Text>

            <View style={styles.inputGroup}>
              <TextInput
                style={styles.priceInput}
                placeholder="Ví dụ: 1.500.000"
                keyboardType="number-pad"
                value={counterPriceInput}
                onChangeText={setCounterPriceInput}
                autoFocus
              />
              <Text style={styles.currencyLabel}>VNĐ</Text>
            </View>

            <View style={[styles.inputGroup, { marginBottom: 24 }]}>
              <TextInput
                style={[styles.priceInput, { fontSize: 16 }]}
                placeholder="Số lượng"
                keyboardType="number-pad"
                value={counterQuantityInput}
                onChangeText={setCounterQuantityInput}
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
  mobileWrapper: {
    flex: 1,
    backgroundColor: COLORS.background,
    ...(Platform.OS === "web" ? ({ boxShadow: "0px 0px 20px rgba(0,0,0,0.1)" } as any) : {}),
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    height: 60,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingHorizontal: 12,
  },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitleContainer: { flex: 1, flexDirection: "row", alignItems: "center" },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  headerName: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  headerStatus: { fontSize: 12, color: COLORS.primary, fontWeight: "500" },
  headerIcon: { padding: 8 },

  productBanner: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
    elevation: 2,
  },
  productImg: { width: 40, height: 40, borderRadius: 6, marginRight: 10 },
  productInfo: { flex: 1 },
  productName: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  productPrice: {
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: "600",
    marginTop: 4,
  },

  chatList: { padding: 16, paddingBottom: 24 },
  dateSeparator: {
    alignSelf: "center",
    backgroundColor: "#E2E8F0",
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
  },
  systemText: {
    alignSelf: "center",
    backgroundColor: "#E9F0F0",
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "500",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    textAlign: "center",
    maxWidth: "90%",
  },

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
  offerCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  offerHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  offerTitle: { fontSize: 16, fontWeight: "700", color: COLORS.text },
  offerPriceBox: {
    backgroundColor: "#F8FAFC",
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: "center",
  },
  offerPriceValue: { fontSize: 24, fontWeight: "800", color: COLORS.primary },

  actionBlock: { marginTop: 4 },
  offerActionRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  rejectBtn: {
    flex: 1,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.error,
    backgroundColor: COLORS.white,
  },
  rejectBtnText: { color: COLORS.error, fontSize: 14, fontWeight: "700" },
  acceptBtn: {
    flex: 1,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  acceptBtnText: { color: COLORS.white, fontSize: 14, fontWeight: "700" },
  counterBtn: {
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: "#E9F0F0",
  },
  counterBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: "700" },

  pendingText: {
    fontSize: 13,
    color: COLORS.textLight,
    fontStyle: "italic",
    textAlign: "center",
  },
  statusBadgeSuccess: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#388E3C",
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  statusBadgeError: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.error,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  statusBadgeText: { color: COLORS.white, fontWeight: "700", fontSize: 13 },

  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  attachBtn: { marginRight: 8, padding: 4 },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    minHeight: 40,
    maxHeight: 100,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.text,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
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
    minHeight: 300,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  modalDesc: { fontSize: 14, color: COLORS.textLight, marginBottom: 24 },
  inputGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 56,
    marginBottom: 16,
    backgroundColor: COLORS.background,
  },
  priceInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.primary,
  },
  currencyLabel: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.textLight,
    marginLeft: 8,
  },
  submitOfferBtn: {
    height: 50,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  submitOfferText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
});