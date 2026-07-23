import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, Image, 
  TextInput, KeyboardAvoidingView, Platform, FlatList, useWindowDimensions 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { COLORS } from '../../src/constants/theme';

// Dữ liệu tin nhắn giả lập
const MOCK_MESSAGES = [
  { id: '1', type: 'text', text: 'Chào bạn, mình quan tâm đến chiếc xe đạp bạn đang đăng bán. Xe còn mới không ạ?', sender: 'them', time: '14:20' },
  { id: '2', type: 'text', text: 'Chào bạn, xe vẫn còn rất mới nhé. Mình chỉ mới đi được khoảng 2 tháng thôi.', sender: 'me', time: '14:22' },
  { id: '3', type: 'offer', price: '1.500.000đ', status: 'pending', sender: 'them', time: '14:25' },
  { id: '4', type: 'text', text: 'Nếu bạn đồng ý với mức giá này, mình có thể qua xem xe vào chiều nay được không?', sender: 'them', time: '14:26' },
];

export default function ChatDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === 'web' && screenWidth > 480 ? 480 : screenWidth;
  
  const [inputText, setInputText] = useState('');

  // HEADER CUSTOM CHO PHÒNG CHAT (Bỏ qua MainHeader để có giao diện riêng của phòng chat)
  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
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

  // THẺ THÔNG TIN SẢN PHẨM (Ghim trên cùng)
  const renderProductBanner = () => (
    <View style={styles.productBanner}>
      <Image source={{ uri: 'https://placehold.co/100x100/png' }} style={styles.productImg} />
      <View style={styles.productInfo}>
        <Text style={styles.productName} numberOfLines={1}>Thu mua tủ lạnh hư hỏng, xác điều hòa</Text>
        <Text style={styles.productPrice}>Giá mong muốn: 1.800.000đ</Text>
      </View>
      <TouchableOpacity style={styles.viewDetailBtn}>
        <Text style={styles.viewDetailText}>Xem</Text>
      </TouchableOpacity>
    </View>
  );

  const renderMessage = ({ item }: { item: any }) => {
    const isMe = item.sender === 'me';

    // UI THẺ ĐỀ XUẤT GIÁ (OFFER/COUNTER)
    if (item.type === 'offer') {
      return (
        <View style={styles.offerContainer}>
          <View style={styles.offerCard}>
            <View style={styles.offerHeader}>
              <Ionicons name="pricetag" size={18} color={COLORS.primary} style={{ marginRight: 6 }} />
              <Text style={styles.offerTitle}>Đề xuất mức giá mới</Text>
            </View>
            <View style={styles.offerPriceBox}>
              <Text style={styles.offerSubtitle}>GIÁ ĐỀ NGHỊ</Text>
              <Text style={styles.offerPriceValue}>{item.price}</Text>
            </View>
            <View style={styles.offerActionRow}>
              <TouchableOpacity style={styles.rejectBtn}>
                <Text style={styles.rejectBtnText}>Từ chối</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.acceptBtn}>
                <Text style={styles.acceptBtnText}>Đồng ý</Text>
              </TouchableOpacity>
            </View>
          </View>
          <Text style={[styles.timeText, { alignSelf: 'flex-start', marginLeft: 16 }]}>{item.time}</Text>
        </View>
      );
    }

    // UI TIN NHẮN TEXT BÌNH THƯỜNG
    return (
      <View style={[styles.messageRow, isMe ? styles.messageRowMe : styles.messageRowThem]}>
        <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
          <Text style={[styles.messageText, isMe ? styles.messageTextMe : styles.messageTextThem]}>
            {item.text}
          </Text>
        </View>
        <Text style={styles.timeText}>{item.time} {isMe && <Ionicons name="checkmark-done" size={14} />}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
        style={[styles.mobileWrapper, { width }]}
      >
        {renderHeader()}
        {renderProductBanner()}

        <FlatList
          data={MOCK_MESSAGES}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.chatList}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={<Text style={styles.dateSeparator}>Hôm nay</Text>}
        />

        <View style={styles.inputContainer}>
          <TouchableOpacity style={styles.attachBtn}>
            <Ionicons name="add-circle-outline" size={28} color={COLORS.textLight} />
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
          <TouchableOpacity style={styles.sendBtn}>
            <Ionicons name="send" size={18} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.border, alignItems: 'center' },
  mobileWrapper: { flex: 1, backgroundColor: COLORS.background, ...(Platform.OS === 'web' ? { boxShadow: '0px 0px 20px rgba(0,0,0,0.1)' } as any : {}) },
  
  // HEADER
  header: { flexDirection: 'row', alignItems: 'center', height: 60, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingHorizontal: 12 },
  backBtn: { padding: 4, marginRight: 8 },
  headerTitleContainer: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  headerName: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  headerStatus: { fontSize: 12, color: COLORS.primary, fontWeight: '500' },
  headerIcon: { padding: 8 },

  // PRODUCT BANNER
  productBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.white, padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', elevation: 2 },
  productImg: { width: 40, height: 40, borderRadius: 6, marginRight: 10 },
  productInfo: { flex: 1 },
  productName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  productPrice: { fontSize: 13, color: COLORS.textLight, fontWeight: '600', marginTop: 2 },
  viewDetailBtn: { paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#E9F0F0', borderRadius: 12 },
  viewDetailText: { fontSize: 12, fontWeight: '600', color: COLORS.primary },

  // CHAT LIST
  chatList: { padding: 16, paddingBottom: 24 },
  dateSeparator: { alignSelf: 'center', backgroundColor: '#E2E8F0', color: COLORS.textLight, fontSize: 11, fontWeight: '600', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
  
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

  // OFFER CARD UI
  offerContainer: { width: '85%', alignSelf: 'flex-start', marginBottom: 16 },
  offerCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  offerHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  offerTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  offerPriceBox: { backgroundColor: '#F8FAFC', padding: 12, borderRadius: 8, marginBottom: 16 },
  offerSubtitle: { fontSize: 11, color: COLORS.textLight, fontWeight: '600', marginBottom: 4 },
  offerPriceValue: { fontSize: 22, fontWeight: '800', color: COLORS.primary },
  offerActionRow: { flexDirection: 'row', gap: 12 },
  
  rejectBtn: { flex: 1, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: COLORS.error, backgroundColor: COLORS.white },
  rejectBtnText: { color: COLORS.error, fontSize: 14, fontWeight: '700' },
  acceptBtn: { flex: 1, height: 40, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: COLORS.primary },
  acceptBtnText: { color: COLORS.white, fontSize: 14, fontWeight: '700' },

  // INPUT
  inputContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: COLORS.border },
  attachBtn: { marginRight: 8 },
  textInput: { flex: 1, backgroundColor: COLORS.background, minHeight: 40, maxHeight: 100, borderRadius: 20, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, fontSize: 15, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: COLORS.text, justifyContent: 'center', alignItems: 'center', marginLeft: 8 },
});