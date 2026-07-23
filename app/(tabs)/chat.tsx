import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, FlatList, 
  TouchableOpacity, Image, TextInput, Platform, useWindowDimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../../src/constants/theme';
import MainHeader from '../../src/components/shared/MainHeader'; 

// Dữ liệu giả lập
const MOCK_CHATS = [
  { id: '1', name: 'Minh Anh', role: 'personal', avatar: 'https://ui-avatars.com/api/?name=Minh+Anh&background=2B5659&color=fff', lastMessage: 'Bạn có thể giảm giá chiếc xe đạp này không?', time: '14:20', unread: 2 },
  { id: '2', name: 'Cơ điện lạnh ABC', role: 'business', avatar: 'https://ui-avatars.com/api/?name=ABC&background=547B7D&color=fff', lastMessage: 'Chúng tôi chốt giá 1.500.000đ nhé.', time: '12:05', unread: 0 },
  { id: '3', name: 'Hoàng Yến', role: 'personal', avatar: 'https://ui-avatars.com/api/?name=Yen&background=BAC2C1&color=fff', lastMessage: 'Sản phẩm này còn bảo hành không ạ?', time: 'Hôm qua', unread: 1 },
  { id: '4', name: 'Lê Hùng', role: 'personal', avatar: 'https://ui-avatars.com/api/?name=Hung&background=2B5659&color=fff', lastMessage: 'Ok, hẹn gặp bạn lúc 5h chiều nay nhé.', time: 'Thứ 2', unread: 0 },
];

export default function ChatListScreen() {
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const width = Platform.OS === 'web' && screenWidth > 480 ? 480 : screenWidth;
  const [searchQuery, setSearchQuery] = useState('');

  const renderChatItem = ({ item }: { item: typeof MOCK_CHATS[0] }) => (
    <TouchableOpacity 
      style={styles.chatItem} 
      // Gọi sang màn hình chi tiết, tự động che đi thanh Tab
      onPress={() => router.push(`/chat/${item.id}` as any)} 
    >
      <View style={styles.avatarContainer}>
        <Image source={{ uri: item.avatar }} style={styles.avatar} />
        {item.unread > 0 && <View style={styles.onlineDot} />}
      </View>
      
      <View style={styles.chatInfo}>
        <View style={styles.nameRow}>
          <Text style={[styles.chatName, item.unread > 0 && styles.textBold]} numberOfLines={1}>
            {item.name}
          </Text>
          {item.role === 'business' && (
            <View style={styles.businessTag}>
              <Ionicons name="checkmark-circle" size={10} color={COLORS.primary} />
              <Text style={styles.businessTagText}>Doanh nghiệp</Text>
            </View>
          )}
        </View>
        <Text style={[styles.lastMessage, item.unread > 0 && styles.textBold]} numberOfLines={1}>
          {item.lastMessage}
        </Text>
      </View>
      
      <View style={styles.metaInfo}>
        <Text style={[styles.timeText, item.unread > 0 && { color: COLORS.primary, fontWeight: '700' }]}>
          {item.time}
        </Text>
        {item.unread > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadText}>{item.unread}</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mobileWrapper, { width }]}>
        <MainHeader title="Tin nhắn" showBack={true} />
        
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color={COLORS.textLight} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Tìm kiếm đoạn chat..."
              placeholderTextColor={COLORS.textLight}
              value={searchQuery}
              onChangeText={setSearchQuery}
              {...(Platform.OS === 'web' && { outlineStyle: 'none' } as any)}
            />
          </View>
        </View>

        <FlatList
          data={MOCK_CHATS}
          keyExtractor={(item) => item.id}
          renderItem={renderChatItem}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.border, alignItems: 'center' },
  mobileWrapper: { flex: 1, backgroundColor: COLORS.background, ...(Platform.OS === 'web' ? { boxShadow: '0px 0px 20px rgba(0,0,0,0.1)' } as any : {}) },
  
  searchContainer: { paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white },
  searchBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.background, borderRadius: 12, paddingHorizontal: 12, height: 44, borderWidth: 1, borderColor: COLORS.border },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.text },
  
  listContainer: { paddingBottom: 20 },
  chatItem: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  
  avatarContainer: { position: 'relative', marginRight: 12 },
  avatar: { width: 54, height: 54, borderRadius: 27, backgroundColor: COLORS.border },
  onlineDot: { position: 'absolute', top: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: COLORS.error, borderWidth: 2, borderColor: COLORS.white },
  
  chatInfo: { flex: 1, justifyContent: 'center' },
  nameRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  chatName: { fontSize: 16, fontWeight: '600', color: COLORS.text, marginRight: 8, flexShrink: 1 },
  businessTag: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E9F0F0', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  businessTagText: { fontSize: 10, color: COLORS.primary, fontWeight: '700', marginLeft: 2 },
  
  lastMessage: { fontSize: 14, color: COLORS.textLight, paddingRight: 10 },
  textBold: { fontWeight: '700', color: COLORS.text },
  
  metaInfo: { alignItems: 'flex-end', justifyContent: 'center' },
  timeText: { fontSize: 12, color: COLORS.textLight, marginBottom: 6 },
  unreadBadge: { backgroundColor: COLORS.error, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2, minWidth: 20, alignItems: 'center' },
  unreadText: { color: COLORS.white, fontSize: 11, fontWeight: '700' }
});