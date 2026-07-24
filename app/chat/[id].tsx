import React, { useState, useMemo } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image, 
  TextInput, KeyboardAvoidingView, Platform, FlatList, useWindowDimensions,
  Modal, Keyboard 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS } from '../../src/constants/theme';

// DỮ LIỆU KHỞI TẠO (Mô phỏng Database)
const INITIAL_MESSAGES = [
  { id: '1', type: 'text', text: 'Chào bạn, mình quan tâm tủ lạnh bạn đang đăng bán.', sender: 'them', time: '14:20' },
  { id: '2', type: 'offer', price: 1800000, status: 'rejected', sender: 'me', time: '14:22' },
  { id: '3', type: 'offer', price: 1500000, status: 'pending', sender: 'them', time: '14:25' },
];

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === 'web' && screenWidth > 480 ? 480 : screenWidth;
  
  // STATES
  const [messages, setMessages] = useState<any[]>(INITIAL_MESSAGES);
  const [inputText, setInputText] = useState('');
  
  // States cho Modal Trả giá (Counter)
  const [isCounterModalVisible, setCounterModalVisible] = useState(false);
  const [counterPriceInput, setCounterPriceInput] = useState('');

  // Lấy ra mức giá Offer mới nhất để ghim lên đầu màn hình
  const currentActiveOffer = useMemo(() => {
    const offers = messages.filter(m => m.type === 'offer');
    return offers.length > 0 ? offers[offers.length - 1] : null;
  }, [messages]);

  // CÁC HÀM XỬ LÝ LOGIC NGHIỆP VỤ (Mô phỏng gọi API)
  const handleSendText = () => {
    if (!inputText.trim()) return;
    const newMessage = { id: Date.now().toString(), type: 'text', text: inputText, sender: 'me', time: 'Vừa xong' };
    setMessages(prev => [...prev, newMessage]);
    setInputText('');
    Keyboard.dismiss();
  };

  const handleAccept = (msgId: string) => {
    // 1. Cập nhật thẻ giá thành 'accepted'
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'accepted' } : m));
    // 2. Tự động thêm tin nhắn hệ thống báo thành công
    setMessages(prev => [...prev, { id: Date.now().toString(), type: 'text', text: '🎉 Giao dịch đã được chốt với giá ' + formatCurrency(currentActiveOffer?.price) + '. Vui lòng tiến hành xác nhận đơn!', sender: 'system', time: 'Vừa xong' }]);
    // MỞ RỘNG: Chuyển hướng sang màn hình Form Xác nhận Đơn hàng (TransactionProposal) tại đây
  };

  const handleReject = (msgId: string) => {
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'rejected' } : m));
    setMessages(prev => [...prev, { id: Date.now().toString(), type: 'text', text: '❌ Đối tác đã từ chối mức giá này.', sender: 'system', time: 'Vừa xong' }]);
  };

  const submitCounterOffer = () => {
    if (!counterPriceInput) return;
    const numPrice = parseInt(counterPriceInput.replace(/\D/g, ''));
    if (isNaN(numPrice) || numPrice <= 0) return;

    // 1. Chuyển thẻ cũ thành 'rejected' (vì đã trả giá mới)
    if (currentActiveOffer && currentActiveOffer.status === 'pending') {
       setMessages(prev => prev.map(m => m.id === currentActiveOffer.id ? { ...m, status: 'rejected' } : m));
    }

    // 2. Tạo thẻ Offer mới với ActionType = 'COUNTER'
    const newOffer = { id: Date.now().toString(), type: 'offer', price: numPrice, status: 'pending', sender: 'me', time: 'Vừa xong' };
    setMessages(prev => [...prev, newOffer]);
    
    setCounterModalVisible(false);
    setCounterPriceInput('');
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  // UI GIAO DIỆN
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        onPress={() => { router.canGoBack() ? router.back() : router.replace('/(tabs)'); }} 
        style={styles.backBtn}
      >
        <Ionicons name="chevron-back" size={26} color={COLORS.text} />
      </TouchableOpacity>
      <View style={styles.headerTitleContainer}>
        <Image source={{ uri: 'https://ui-avatars.com/api/?name=ABC&background=547B7D&color=fff' }} style={styles.headerAvatar} />
        <View>
          <Text style={styles.headerName}>Cơ điện lạnh ABC</Text>
          <Text style={styles.headerStatus}>Đang hoạt động</Text>
        </View>
      </View>
      <TouchableOpacity style={styles.headerIcon}>
        <Ionicons name="ellipsis-vertical" size={24} color={COLORS.text} />
      </TouchableOpacity>
    </View>
  );

  const renderProductBanner = () => (
    <View style={styles.productBanner}>
      <Image source={{ uri: 'https://placehold.co/100x100/png' }} style={styles.productImg} />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>Thu mua tủ lạnh hư hỏng, xác điều hòa</Text>
        <Text style={styles.productPrice}>
          Đang thương lượng: <Text style={{ color: COLORS.error }}>{currentActiveOffer ? formatCurrency(currentActiveOffer.price) : 'Chưa có'}</Text>
        </Text>
      </View>
    </View>
  );

  const renderMessage = ({ item, index }: { item: any; index: number }) => {
    const isMe = item.sender === 'me';
    const isSystem = item.sender === 'system';

    if (isSystem) {
      return <Text style={styles.systemText}>{item.text}</Text>;
    }

    if (item.type === 'offer') {
      const isLatestOffer = currentActiveOffer?.id === item.id;
      
      return (
        <View style={[styles.offerContainer, isMe ? { alignSelf: 'flex-end' } : { alignSelf: 'flex-start' }]}>
          <View style={[styles.offerCard, !isLatestOffer && { opacity: 0.6 }]}>
            <View style={styles.offerHeader}>
              <Ionicons name="pricetag" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.offerTitle}>{isMe ? 'Bạn đề xuất' : 'Đối tác đề xuất'}</Text>
            </View>
            <View style={styles.offerPriceBox}>
              <Text style={styles.offerPriceValue}>{formatCurrency(item.price)}</Text>
            </View>

            {/* HIỂN THỊ NÚT BẤM THEO TRẠNG THÁI */}
            {item.status === 'pending' && isLatestOffer && (
              isMe ? (
                <Text style={styles.pendingText}>Đang chờ đối tác phản hồi...</Text>
              ) : (
                <View style={styles.actionBlock}>
                  <View style={styles.offerActionRow}>
                    <TouchableOpacity style={styles.rejectBtn} onPress={() => handleReject(item.id)}>
                      <Text style={styles.rejectBtnText}>Từ chối</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.acceptBtn} onPress={() => handleAccept(item.id)}>
                      <Text style={styles.acceptBtnText}>Đồng ý</Text>
                    </TouchableOpacity>
                  </View>
                  <TouchableOpacity style={styles.counterBtn} onPress={() => setCounterModalVisible(true)}>
                    <Text style={styles.counterBtnText}>Đề xuất giá khác</Text>
                  </TouchableOpacity>
                </View>
              )
            )}

            {item.status === 'accepted' && (
              <View style={styles.statusBadgeSuccess}>
                <Ionicons name="checkmark-circle" size={16} color={COLORS.white} />
                <Text style={styles.statusBadgeText}>Đã chốt giá</Text>
              </View>
            )}
            
            {item.status === 'rejected' && (
              <View style={styles.statusBadgeError}>
                <Ionicons name="close-circle" size={16} color={COLORS.white} />
                <Text style={styles.statusBadgeText}>Đã từ chối</Text>
              </View>
            )}

          </View>
          <Text style={[styles.timeText, isMe ? { alignSelf: 'flex-end', marginRight: 8 } : { alignSelf: 'flex-start', marginLeft: 8 }]}>{item.time}</Text>
        </View>
      );
    }

    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowThem]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}>{item.text}</Text>
        </View>
        <Text style={[styles.timeText, isMe ? { alignSelf: 'flex-end', marginRight: 4 } : { alignSelf: 'flex-start', marginLeft: 4 }]}>{item.time}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[styles.mobileWrapper, { width }]}>
        {renderHeader()}
        {renderProductBanner()}

        <FlatList
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<Text style={styles.dateSeparator}>Hôm nay</Text>}
        />

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
            {...(Platform.OS === 'web' && { outlineStyle: 'none' } as any)}
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
              <TouchableOpacity onPress={() => setCounterModalVisible(false)}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
            </View>
            <Text style={styles.modalDesc}>Mức giá hiện tại: {currentActiveOffer ? formatCurrency(currentActiveOffer.price) : 'Chưa có'}</Text>
            
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

            <TouchableOpacity style={styles.submitOfferBtn} onPress={submitCounterOffer}>
              <Text style={styles.submitOfferText}>Gửi Đề Xuất</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.border, alignItems: 'center' },
  mobileWrapper: { flex: 1, backgroundColor: COLORS.background, ...(Platform.OS === 'web' ? { boxShadow: '0px 0px 20px rgba(0,0,0,0.1)' } as any : {}) },
  
  header: { flexDirection: 'row', alignItems: 'center', height: 60, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingHorizontal: 12 },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitleContainer: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  headerName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  headerStatus: { fontSize: 12, color: COLORS.primary, fontWeight: '500' },
  headerIcon: { padding: 8 },

  productBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', elevation: 2 },
  productImg: { width: 40, height: 40, borderRadius: 6, marginRight: 10 },
  productInfo: { flex: 1 },
  productName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  productPrice: { fontSize: 13, color: COLORS.textLight, fontWeight: '600', marginTop: 4 },

  chatList: { padding: 16, paddingBottom: 24 },
  dateSeparator: { alignSelf: 'center', backgroundColor: '#E2E8F0', color: COLORS.textLight, fontSize: 11, fontWeight: '600', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  systemText: { alignSelf: 'center', backgroundColor: '#E9F0F0', color: COLORS.primary, fontSize: 12, fontWeight: '500', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, overflow: 'hidden', marginBottom: 16, textAlign: 'center', maxWidth: '90%' },
  
  messageRow: { marginBottom: 16, maxWidth: '80%' },
  messageRowMe: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  messageRowThem: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 16, paddingVertical: 12, borderRadius: 20 },
  bubbleMe: { backgroundColor: COLORS.primary, borderBottomRightRadius: 4 },
  bubbleThem: { backgroundColor: '#EAEAEA', borderBottomLeftRadius: 4 },
  messageText: { fontSize: 15, lineHeight: 22 },
  messageTextMe: { color: COLORS.white },
  messageTextThem: { color: COLORS.text },
  timeText: { fontSize: 11, color: COLORS.textLight, marginTop: 4 },

  offerContainer: { width: '85%', marginBottom: 16 },
  offerCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  offerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  offerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  offerPriceBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 16, alignItems: 'center' },
  offerPriceValue: { fontSize: 24, fontWeight: '800', color: COLORS.primary },
  
  actionBlock: { marginTop: 4 },
  offerActionRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  rejectBtn: { flex: 1, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: COLORS.error, backgroundColor: COLORS.white },
  rejectBtnText: { color: COLORS.error, fontSize: 14, fontWeight: '700' },
  acceptBtn: { flex: 1, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: COLORS.primary },
  acceptBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },
  counterBtn: { height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: '#E9F0F0' },
  counterBtnText: { color: COLORS.primary, fontSize: 14, fontWeight: '700' },
  
  pendingText: { fontSize: 13, color: COLORS.textLight, fontStyle: 'italic', textAlign: 'center' },
  statusBadgeSuccess: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#388E3C', paddingVertical: 8, borderRadius: 8, gap: 6 },
  statusBadgeError: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.error, paddingVertical: 8, borderRadius: 8, gap: 6 },
  statusBadgeText: { color: COLORS.white, fontWeight: '700', fontSize: 13 },

  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border },
  attachBtn: { marginRight: 8, padding: 4 },
  textInput: { flex: 1, backgroundColor: COLORS.background, minHeight: 40, maxHeight: 100, borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.text, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },

  // MODAL COUNTER
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 300 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalDesc: { fontSize: 14, color: COLORS.textLight, marginBottom: 24 },
  inputGroup: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, height: 56, marginBottom: 24, backgroundColor: COLORS.background },
  priceInput: { flex: 1, fontSize: 20, fontWeight: '700', color: COLORS.primary },
  currencyLabel: { fontSize: 16, fontWeight: '700', color: COLORS.textLight, marginLeft: 8 },
  submitOfferBtn: { height: 50, backgroundColor: COLORS.primary, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  submitOfferText: { color: COLORS.white, fontSize: 16, fontWeight: '700' }
});