import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState, useRef } from "react";
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
import * as signalR from "@microsoft/signalr";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { postApi } from "../../src/services/apis/postApi";
import { offerApi } from "../../src/services/apis/offerApi";
import { negotiationApi } from "../../src/services/apis/negotiationApi";
import { agreementApi } from "../../src/services/apis/agreementApi";
import { messageApi } from "../../src/services/apis/messageApi";
import Header from "../../src/components/shared/Header";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  const negotiationInfoRef = useRef<any>(null); 

  const [messages, setMessages] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [agreementPreview, setAgreementPreview] = useState<any>(null);
  const [inputText, setInputText] = useState("");

  const [isActionMenuVisible, setActionMenuVisible] = useState(false);
  const [isCounterModalVisible, setCounterModalVisible] = useState(false);
  const [counterPriceInput, setCounterPriceInput] = useState("");
  const [counterQuantityInput, setCounterQuantityInput] = useState("1");

  // =================================================================
  // 1. TẢI DỮ LIỆU TĨNH VÀ CHECK AGREEMENT TỪ PREVIEW
  // =================================================================
  const fetchBaseInfo = useCallback(async () => {
    if (!negotiationId || !currentUserId) return;
    try {
      const res = await negotiationApi.getNegotiationById(negotiationId as string);
      const info = res?.data || res;
      
      let productDetails = { 
        postId: "", name: "Sản phẩm thương lượng", image: "", basePrice: 0, city: "", productTypeName: "",
        partnerName: info?.otherPartyName, partnerAvatar: info?.otherPartyAvatarUrl,
        myAvatar: user?.avatarUrl || user?.avatar
      };

      if (info?.offerId) {
        try {
          const offerRes = await offerApi.getOfferById(info.offerId); 
          const offerData = offerRes?.data || offerRes;
          if (offerData) {
            const isMeSender = offerData.sender?.userId?.toLowerCase() === currentUserId.toLowerCase();
            const meData = isMeSender ? offerData.sender : offerData.receiver;
            const themData = isMeSender ? offerData.receiver : offerData.sender;

            if (meData?.avatarUrl) productDetails.myAvatar = meData.avatarUrl;
            if (themData) {
              productDetails.partnerName = themData.displayName || themData.username || productDetails.partnerName;
              productDetails.partnerAvatar = themData.avatarUrl || themData.avatar || productDetails.partnerAvatar;
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
      const combinedInfo = { ...info, ...productDetails };
      
      // KIỂM TRA ĐƠN XÁC NHẬN
      if (info?.negotiationStatus === "Agreed" || info?.negotiationStatus === "Accepted") {
        try {
          const previewRes = await agreementApi.getPreview(negotiationId as string);
          const previewData = previewRes?.data || previewRes;
          setAgreementPreview(previewData);
          combinedInfo.agreementPreview = previewData;

          // Nếu có đơn xác nhận -> Lấy thông tin đơn về để tẹo nữa render thành 1 cái tin nhắn
          if (previewData?.hasAgreement && previewData?.agreementId) {
            const agreementRes = await agreementApi.getAgreementById(previewData.agreementId);
            combinedInfo.agreementData = agreementRes?.data || agreementRes;
          }
        } catch (error) { console.log("Lỗi khi fetch Agreement Preview:", error); }
      }

      negotiationInfoRef.current = combinedInfo; 
      setNegotiationInfo(combinedInfo);

    } catch (error) { console.error("Lỗi fetch Base Info:", error); }
  }, [negotiationId, currentUserId, user]);


  // =================================================================
  // 2. TẢI TIN NHẮN & INJECT THẺ ĐƠN XÁC NHẬN VÀO LUỒNG CHAT
  // =================================================================
  const fetchMessagesOnly = useCallback(async () => {
    if (!negotiationId || !currentUserId) return;
    
    const info = negotiationInfoRef.current;
    if (!info) return;

    try {
      let rawMessages: any[] = [];
      const msgRes = await messageApi.getMessages({ negotiationId: negotiationId as string, PageNumber: 1, PageSize: 50 });
      const msgData = msgRes?.data || msgRes;
      if (Array.isArray(msgData)) {
        rawMessages = msgData;
      } else if (msgData?.items && Array.isArray(msgData.items)) {
        rawMessages = msgData.items;
      }

      // INJECT THẺ ĐƠN XÁC NHẬN VÀO RAW MESSAGES ĐỂ SORT THEO ĐÚNG THỜI GIAN
      if (info.agreementData) {
        rawMessages.push({
          messageId: `agreement-card-${info.agreementData.agreementId}`,
          senderId: info.agreementData.sellerId, // Người gửi thẻ này là Seller
          messageType: "AgreementCard",
          createdAt: info.agreementData.createdAt,
          agreementData: info.agreementData
        });
      }

      const sortedMessages = [...rawMessages].sort((a: any, b: any) => {
        const timeA = new Date(a.createdAt).getTime();
        const timeB = new Date(b.createdAt).getTime();
        if (timeA === timeB) { 
          const isInitialOffer = (msg: any) => msg.messageType === "Offer" || msg.messageType === 2 || (msg.messageContent && msg.messageContent.includes("Đề nghị thương lượng ban đầu"));
          const aIsInitial = isInitialOffer(a);
          const bIsInitial = isInitialOffer(b);
          if (aIsInitial && !bIsInitial) return -1; 
          if (!aIsInitial && bIsInitial) return 1;  
          return String(a.messageType || "").localeCompare(String(b.messageType || ""));
        }
        return timeA - timeB;
      });
      
      const formattedMessages: any[] = [];

      sortedMessages.forEach((m: any, index: number) => {
        const isMe = m.senderId === currentUserId;

        // 2.1 - Nếu là THẺ ĐƠN XÁC NHẬN (Inject)
        if (m.messageType === "AgreementCard") {
          formattedMessages.push({
            id: m.messageId,
            type: "agreement_card",
            agreementId: m.agreementData.agreementId,
            agreementData: m.agreementData,
            sender: isMe ? "me" : "them",
            avatar: isMe ? info.myAvatar : info.partnerAvatar,
            senderName: isMe ? "Bạn" : info.partnerName,
            time: new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            isRead: true
          });
          return;
        }

        // 2.2 - Nếu BE trả về messageType === "Agreement" (Thông báo tạo đơn)
        if (m.messageType === "Agreement" || m.messageType === 4) { // Assuming 4 is the enum val
          formattedMessages.push({
            id: m.messageId,
            type: "system_agreed",
            text: m.messageContent || "Đã tạo thỏa thuận mua bán, vui lòng kiểm tra và xác nhận.",
            avatar: isMe ? info.myAvatar : info.partnerAvatar,
            accepterName: isMe ? "Bạn" : info.partnerName
          });
          return;
        }

        // 2.3 - Các tin nhắn Offer và Text bình thường
        const isOfferType = m.messageType === 2 || m.messageType === 3 || m.messageType === "Offer" || m.messageType === "CounterOffer" || m.offerPrice > 0;
        
        const msgObj = {
          id: m.messageId || index.toString(),
          type: isOfferType ? "offer" : "text",
          text: m.messageContent || "", 
          price: m.offerPrice || 0,
          quantity: m.offerQuantity || 1,
          status: m.offerStatus ? m.offerStatus.toLowerCase() : "pending", 
          isRead: m.isRead === true,
          sender: isMe ? "me" : "them",
          avatar: isMe ? info.myAvatar : info.partnerAvatar,
          senderName: isMe ? "Bạn" : info.partnerName,
          time: m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "Vừa xong",
        };

        formattedMessages.push(msgObj);

        // Giữ lại bong bóng "Đã chấp nhận thương lượng" ngay sau Offer được duyệt
        if (isOfferType && msgObj.status === "accepted") {
          const isMeAccepted = !isMe; 
          const accepterName = isMeAccepted ? "Bạn" : info.partnerName;
          const avatarUrl = isMeAccepted ? info.myAvatar : info.partnerAvatar;

          formattedMessages.push({
            id: `system-agreed-${msgObj.id}`,
            type: "system_agreed",
            text: isMeAccepted ? "Bạn đã chấp nhận thương lượng" : `${accepterName} đã chấp nhận thương lượng`,
            avatar: avatarUrl,
            accepterName: accepterName
          });
        }
      });

      setMessages(formattedMessages);
    } catch (error) { console.error("Lỗi fetch Messages:", error); }
  }, [negotiationId, currentUserId]);


  // =================================================================
  // 3. KHỞI TẠO INIT VÀ KẾT NỐI SIGNALR (REAL-TIME XỊN)
  // =================================================================
  const initialLoad = useCallback(async () => {
    setIsLoading(true);
    await fetchBaseInfo();
    await fetchMessagesOnly();
    try {
      await messageApi.markAsRead(negotiationId as string);
    } catch (e) {}
    setIsLoading(false);
  }, [fetchBaseInfo, fetchMessagesOnly, negotiationId]);

  useFocusEffect(useCallback(() => { 
    if (currentUserId) initialLoad(); 
  }, [initialLoad, currentUserId]));

  useEffect(() => {
    let connection: signalR.HubConnection | null = null;
    const setupSignalR = async () => {
      const token = await AsyncStorage.getItem("accessToken");
      if (!negotiationId || !token) return;

      connection = new signalR.HubConnectionBuilder()
        .withUrl("https://homecycle-backend.onrender.com/hubs/chat", {
          accessTokenFactory: () => token
        })
        .withAutomaticReconnect()
        .build();

      connection.on("MessageCreated", async () => {
        // Có tin nhắn mới, ta reload toàn bộ để lấy cả Agreement mới (nếu có)
        await fetchBaseInfo();
        await fetchMessagesOnly(); 
        try { await messageApi.markAsRead(negotiationId as string); } catch (e) {}
      });

      connection.on("MessagesRead", () => {
        fetchMessagesOnly(); 
      });

      connection.onreconnected(async () => {
        try {
          await connection?.invoke("JoinNegotiation", negotiationId);
          fetchMessagesOnly();
        } catch (e) {}
      });

      try {
        await connection.start();
        await connection.invoke("JoinNegotiation", negotiationId);
      } catch (err) {}
    };

    setupSignalR();

    return () => {
      if (connection) { connection.stop(); }
    };
  }, [negotiationId, fetchMessagesOnly, fetchBaseInfo]);


  // =================================================================
  // 4. CÁC HÀM XỬ LÝ SỰ KIỆN
  // =================================================================
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

  const reloadAll = async () => {
    await fetchBaseInfo();
    await fetchMessagesOnly();
  };

  const handleAccept = async (proposalMessageId: string) => {
    try {
      setIsProcessing(true);
      await negotiationApi.acceptProposal(negotiationId as string, proposalMessageId); 
      await reloadAll(); 
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Lỗi.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Lỗi", msg);
    } finally { setIsProcessing(false); }
  };

  const handleReject = async (proposalMessageId: string) => {
    try {
      setIsProcessing(true);
      await negotiationApi.rejectProposal(negotiationId as string, proposalMessageId); 
      await reloadAll();
    } catch (error: any) { 
      const msg = error.response?.data?.error?.message || "Lỗi.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Lỗi", msg);
    } finally { setIsProcessing(false); }
  };

  const submitCounterOffer = async () => {
    const numPrice = parseInt(counterPriceInput.replace(/\D/g, ""));
    const numQty = parseInt(counterQuantityInput) || 1;
    if (isNaN(numPrice) || numPrice <= 0) { 
      Platform.OS === "web" ? window.alert("Vui lòng nhập mức giá hợp lệ.") : Alert.alert("Lỗi", "Vui lòng nhập mức giá hợp lệ.");
      return; 
    }

    try {
      setIsProcessing(true);
      await negotiationApi.counterNegotiation(negotiationId as string, { offerPrice: numPrice, offerQuantity: numQty });
      setCounterModalVisible(false);
      await reloadAll();
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Lỗi.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Lỗi", msg);
    } finally { setIsProcessing(false); }
  };

  const handleCancelNegotiation = () => {
    const executeCancel = async () => {
      try {
        setIsProcessing(true);
        await negotiationApi.cancelNegotiation(negotiationId as string);
        if (Platform.OS !== "web") Alert.alert("Thành công", "Đã hủy phiên thương lượng.");
        await reloadAll();
      } catch (error: any) { 
        const msg = error.response?.data?.error?.message || "Không thể hủy giao dịch.";
        Platform.OS === "web" ? window.alert(msg) : Alert.alert("Lỗi", msg);
      } finally { setIsProcessing(false); }
    };

    if (Platform.OS === "web") {
      if (window.confirm("Bạn có chắc chắn muốn hủy phiên thương lượng này không?")) executeCancel();
    } else {
      Alert.alert("Hủy giao dịch", "Bạn có chắc chắn muốn hủy phiên thương lượng này không?", [
        { text: "Không", style: "cancel" },
        { text: "Hủy giao dịch", style: "destructive", onPress: executeCancel }
      ]);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !negotiationId) return;
    const content = inputText.trim();
    setInputText(""); 

    try {
      const clientMsgId = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });

      await messageApi.sendMessage(negotiationId as string, {
        messageContent: content,
        clientMessageId: clientMsgId
      });
      await fetchMessagesOnly(); 
    } catch (error: any) {
      const msg = error.response?.data?.error?.message || "Không thể gửi tin nhắn lúc này.";
      Platform.OS === "web" ? window.alert(msg) : Alert.alert("Lỗi", msg);
    }
  };

  const formatCurrency = (value: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(value || 0);

  const renderHeader = () => {
    const partnerName = negotiationInfo?.partnerName || "Đối tác giao dịch";
    const avatarUri = getRobustAvatar(negotiationInfo?.partnerAvatar, partnerName);
    const CenterComponent = (
      <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
        <Image source={{ uri: avatarUri }} style={styles.headerAvatar} />
        <View style={{ flex: 1, justifyContent: "center" }}>
          <Text style={styles.headerName} numberOfLines={1}>{partnerName}</Text>
          <Text style={styles.headerStatus}>Trạng thái: {negotiationInfo?.negotiationStatus || "Open"}</Text>
        </View>
      </View>
    );
    const RightComponent = ( <TouchableOpacity style={styles.headerIcon} onPress={reloadAll}><Ionicons name="reload" size={20} color={COLORS.primary} /></TouchableOpacity> );
    return <Header showBack={true} centerContent={CenterComponent} rightContent={RightComponent} />;
  };

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender === "me";

    // LOẠI 1: CENTER SYSTEM MESSAGE
    if (item.type === "system_agreed") {
      const avatarUri = getRobustAvatar(item.avatar, item.accepterName);
      return (
        <View style={styles.systemAgreedContainer}>
          <Image source={{ uri: avatarUri }} style={styles.systemAgreedAvatar} />
          <Text style={styles.systemAgreedText}>{item.text}</Text>
        </View>
      );
    }

    const avatarComponent = (
      <Image source={{ uri: getRobustAvatar(item.avatar, item.senderName) }} style={styles.chatAvatar} />
    );

    const renderContent = () => {
      // LOẠI 2: THẺ ĐƠN XÁC NHẬN GIAO DỊCH CHAT RA TỪ SIDES CỦA SELLER
      if (item.type === "agreement_card") {
        return (
          <View style={[styles.offerCard, { width: "100%" }]}>
            <View style={styles.offerHeader}>
              <Ionicons name="document-text" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.offerTitle}>Đơn xác nhận giao dịch</Text>
            </View>
            <View style={styles.offerPriceBox}>
              <Text style={styles.offerPriceValue}>{formatCurrency(item.agreementData?.finalPrice)}</Text>
              <Text style={{ color: COLORS.textLight, marginTop: 4, fontSize: 13 }}>Số lượng: {item.agreementData?.quantity}</Text>
            </View>
            <TouchableOpacity 
              style={styles.viewAgreementBtnFill}
              onPress={() => router.push(`/agreements/preview?agreementId=${item.agreementId}&negotiationId=${negotiationId}`)}
            >
              <Text style={styles.viewAgreementBtnFillText}>Xem chi tiết</Text>
            </TouchableOpacity>
          </View>
        );
      }

      // LOẠI 3: THẺ OFFER BÌNH THƯỜNG
      if (item.type === "offer") {
        const isLatestOffer = currentActiveOffer?.id === item.id;
        const negStatus = negotiationInfo?.negotiationStatus;
        const defaultTitle = isMe ? "Bạn đề xuất" : "Đối tác đề xuất";
        const offerTitle = item.text && item.text.trim() !== "" ? item.text : defaultTitle;

        return (
          <View style={[styles.offerCard, (!isLatestOffer || item.status === "superseded") && { opacity: 0.6 }]}>
            <View style={styles.offerHeader}>
              <Ionicons name="pricetag" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.offerTitle}>{offerTitle}</Text>
            </View>
            <View style={styles.offerPriceBox}>
              <Text style={styles.offerPriceValue}>{formatCurrency(item.price)}</Text>
              <Text style={{ color: COLORS.textLight, marginTop: 4, fontSize: 13 }}>Số lượng: {item.quantity}</Text>
            </View>

            {isLatestOffer && negStatus === "Open" && item.status === "pending" && (
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
            
            {/* SAU KHI ACCEPTED -> NẾU CHƯA CÓ ĐƠN THÌ HIỆN NÚT "TẠO ĐƠN", NẾU CÓ RỒI THÌ ĐÃ CÓ MESSAGE CARD HIỆN BÊN DƯỚI RỒI NÊN ẨN ĐI */}
            {item.status === "accepted" && (negStatus === "Accepted" || negStatus === "Agreed") && !agreementPreview?.hasAgreement && agreementPreview?.canCreate && ( 
              <View style={styles.agreedBlock}>
                <TouchableOpacity 
                  style={styles.inlineCreateFormBtn}
                  onPress={() => router.push(`/agreements/form?negotiationId=${negotiationId}`)}
                >
                  <Ionicons name="create-outline" size={18} color={COLORS.white} style={{ marginRight: 6 }} />
                  <Text style={styles.inlineCreateFormBtnText}>Tạo Đơn Xác Nhận</Text>
                </TouchableOpacity>
              </View>
            )}

            {item.status === "rejected" && ( 
              <View style={styles.statusBadgeError}>
                <Ionicons name="close-circle" size={16} color={COLORS.white} />
                <Text style={styles.statusBadgeText}>Đã từ chối đề xuất này</Text>
              </View> 
            )}

            {isLatestOffer && negStatus === "Cancelled" && ( 
              <View style={styles.statusBadgeError}>
                <Ionicons name="close-circle" size={16} color={COLORS.white} />
                <Text style={styles.statusBadgeText}>Phiên thương lượng đã hủy</Text>
              </View> 
            )}
            
            {(!isLatestOffer || item.status === "superseded") && item.status !== "rejected" && ( <Text style={styles.outdatedOfferText}>(Đề xuất cũ)</Text> )}
          </View>
        );
      }

      // LOẠI 4: TEXT BÌNH THƯỜNG
      return (
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}>{item.text}</Text>
        </View>
      );
    };

    return (
      <View style={[styles.messageWrapper, isMe ? styles.messageWrapperMe : styles.messageWrapperThem]}>
        {!isMe && avatarComponent}
        <View style={[styles.messageContentBlock, (item.type === "offer" || item.type === "agreement_card") ? { width: "75%" } : { maxWidth: "78%" }]}>
          {renderContent()}
          <View style={[styles.timeRow, isMe ? { justifyContent: "flex-end" } : { justifyContent: "flex-start" }]}>
            <Text style={styles.timeText}>{item.time}</Text>
            {isMe && (
              <Ionicons
                name={item.isRead ? "checkmark-done" : "checkmark"}
                size={14}
                color={item.isRead ? COLORS.primary : COLORS.textLight}
                style={styles.readIcon}
              />
            )}
          </View>
        </View>
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
          <TouchableOpacity style={styles.attachBtn} onPress={() => setActionMenuVisible(true)}>
            <Ionicons name="add-circle-outline" size={28} color={COLORS.primary} />
          </TouchableOpacity>
          <TextInput
            style={styles.textInput}
            placeholder="Nhập tin nhắn..."
            placeholderTextColor={COLORS.textLight}
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={handleSendMessage}
            blurOnSubmit={false}
            {...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {})}
          />
          <TouchableOpacity style={styles.sendBtn} onPress={handleSendMessage}>
            <Ionicons name="send" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={isActionMenuVisible} transparent animationType="fade">
        <TouchableOpacity style={styles.menuOverlay} activeOpacity={1} onPress={() => setActionMenuVisible(false)}>
          <View style={styles.menuSheetContent}>
            {negotiationInfo?.negotiationStatus === "Open" && (
              <>
                <TouchableOpacity style={styles.menuItem} onPress={() => { setActionMenuVisible(false); openCounterModal(); }}>
                  <Ionicons name="pricetag-outline" size={22} color={COLORS.primary} />
                  <Text style={styles.menuItemText}>Đề xuất giá mới</Text>
                </TouchableOpacity>
                <View style={styles.menuDivider} />
              </>
            )}

            <TouchableOpacity style={styles.menuItem} onPress={() => { setActionMenuVisible(false); handleCancelNegotiation(); }}>
              <Ionicons name="close-circle-outline" size={22} color={COLORS.error} />
              <Text style={[styles.menuItemText, { color: COLORS.error }]}>Hủy giao dịch</Text>
            </TouchableOpacity>

            {agreementPreview?.canCreate && !agreementPreview?.hasAgreement && (
              <>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={() => { setActionMenuVisible(false); router.push(`/agreements/form?negotiationId=${negotiationId}`); }}>
                  <Ionicons name="document-text-outline" size={22} color={COLORS.primary} />
                  <Text style={styles.menuItemText}>Tạo đơn xác nhận</Text>
                </TouchableOpacity>
              </>
            )}

            {agreementPreview?.hasAgreement && (
              <>
                <View style={styles.menuDivider} />
                <TouchableOpacity style={styles.menuItem} onPress={() => { setActionMenuVisible(false); router.push(`/agreements/preview?agreementId=${agreementPreview.agreementId}&negotiationId=${negotiationId}`); }}>
                  <Ionicons name="eye-outline" size={22} color={COLORS.primary} />
                  <Text style={styles.menuItemText}>Xem chi tiết đơn xác nhận</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      <Modal visible={isCounterModalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Đề xuất mức giá mới</Text>
              <TouchableOpacity onPress={() => setCounterModalVisible(false)}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
            </View>
            <View style={styles.inputGroup}>
              <TextInput style={styles.priceInput} placeholder={currentActiveOffer ? currentActiveOffer.price.toLocaleString("vi-VN") : "Ví dụ: 1.500.000"} placeholderTextColor="#94A3B8" keyboardType="number-pad" value={counterPriceInput} onChangeText={handlePriceChange} selectTextOnFocus={true} autoFocus />
              <Text style={styles.currencyLabel}>VNĐ</Text>
            </View>
            <View style={[styles.inputGroup, { marginBottom: 24 }]}>
              <TextInput style={[styles.priceInput, { fontSize: 16 }]} placeholder={currentActiveOffer ? currentActiveOffer.quantity.toString() : "1"} placeholderTextColor="#94A3B8" keyboardType="number-pad" value={counterQuantityInput} onChangeText={setCounterQuantityInput} selectTextOnFocus={true} />
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
  headerStatus: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  headerIcon: { padding: 8 },
  productBanner: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, padding: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9", elevation: 2, },
  productImg: { width: 40, height: 40, borderRadius: 6, marginRight: 10 },
  productInfo: { flex: 1 },
  productName: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  productPrice: { fontSize: 13, color: COLORS.textLight, fontWeight: "600", marginTop: 4, },
  chatList: { paddingHorizontal: 12, paddingVertical: 16, paddingBottom: 24 }, 
  dateSeparator: { alignSelf: "center", backgroundColor: "#E9F0F0", color: COLORS.textLight, fontSize: 11, fontWeight: "600", paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: "hidden", marginBottom: 16, },
  
  systemAgreedContainer: { flexDirection: "row", alignItems: "center", alignSelf: "center", backgroundColor: "#E9F0F0", paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, marginBottom: 16 },
  systemAgreedAvatar: { width: 22, height: 22, borderRadius: 11, marginRight: 8 },
  systemAgreedText: { color: COLORS.primary, fontSize: 13, fontWeight: "600" },

  messageWrapper: { flexDirection: "row", marginBottom: 16, alignItems: "flex-start", width: "100%" },
  messageWrapperMe: { justifyContent: "flex-end" },
  messageWrapperThem: { justifyContent: "flex-start" },
  chatAvatar: { width: 28, height: 28, borderRadius: 14, marginRight: 8, marginTop: 2 }, 
  messageContentBlock: {}, 

  bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  bubbleMe: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: "#EAEAEA", borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  messageTextMe: { color: COLORS.white },
  messageTextThem: { color: COLORS.text },
  
  timeRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  timeText: { fontSize: 11, color: COLORS.textLight },
  readIcon: { marginLeft: 4, marginTop: 1 },
  
  offerCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, width: "100%" },
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
  statusBadgeError: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: COLORS.error, paddingVertical: 8, borderRadius: 8, gap: 6, },
  statusBadgeText: { color: COLORS.white, fontWeight: "700", fontSize: 13 },
  
  agreedBlock: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: "#E2E8F0" },
  inlineCreateFormBtn: { flexDirection: "row", backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 16, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  inlineCreateFormBtnText: { color: COLORS.white, fontSize: 14, fontWeight: "bold" },
  
  viewAgreementBtnFill: { backgroundColor: COLORS.primary, paddingVertical: 10, borderRadius: 8, alignItems: "center", marginTop: 8 },
  viewAgreementBtnFillText: { color: COLORS.white, fontSize: 14, fontWeight: "bold" },

  inputContainer: { flexDirection: "row", alignItems: "center", paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border, },
  attachBtn: { marginRight: 8, padding: 4 },
  textInput: {
    flex: 1,
    backgroundColor: COLORS.background,
    height: 40,
    borderRadius: 20,
    paddingHorizontal: 16,
    fontSize: 15,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
    textAlignVertical: "center",
    ...(Platform.OS === "web" ? { 
      outlineStyle: "none", 
      lineHeight: "40px", 
      paddingTop: 0,
      paddingBottom: 0
    } as any : {
      paddingVertical: 0
    }),
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.primary, justifyContent: "center", alignItems: "center", marginLeft: 8, },
  
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end", },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 300, },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, },
  modalTitle: { fontSize: 18, fontWeight: "700", color: COLORS.text },
  modalDesc: { fontSize: 14, color: COLORS.textLight, marginBottom: 24 },
  inputGroup: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, height: 56, marginBottom: 16, backgroundColor: COLORS.background, },
  priceInput: { flex: 1, fontSize: 20, fontWeight: "700", color: COLORS.primary, ...(Platform.OS === "web" ? { outlineStyle: "none" } as any : {}), } as any,
  currencyLabel: { fontSize: 16, fontWeight: "700", color: COLORS.textLight, marginLeft: 8, },
  submitOfferBtn: { height: 50, backgroundColor: COLORS.primary, borderRadius: 12, justifyContent: "center", alignItems: "center", },
  submitOfferText: { color: COLORS.white, fontSize: 16, fontWeight: "700" },
  productSubText: { fontSize: 12, color: COLORS.textLight, marginTop: 2, },
  menuOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.3)", justifyContent: "flex-end", },
  menuSheetContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: Platform.OS === "ios" ? 40 : 20, },
  menuItem: { flexDirection: "row", alignItems: "center", paddingVertical: 16, },
  menuItemText: { fontSize: 16, fontWeight: "600", color: COLORS.text, marginLeft: 12, },
  menuDivider: { height: 1, backgroundColor: COLORS.border, },
});