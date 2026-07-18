import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, TouchableOpacity, 
  ScrollView, Image, Platform, useWindowDimensions
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import MainHeader from '../../src/components/shared/MainHeader';
import { COLORS } from '../../src/constants/theme';

export default function PostsScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === 'web' && width > 480;

  // ================= DEV MODE STATE =================
  const [devRole, setDevRole] = useState<'personal' | 'business'>('personal');
  
  // State quản lý Tab đang active của từng Role
  const [activePersonalTab, setActivePersonalTab] = useState<'active' | 'hidden'>('active');
  const [activeBusinessTab, setActiveBusinessTab] = useState<'buying' | 'requests'>('buying');

  // ================= MOCK DATA: CÁ NHÂN (TIN BÁN) =================
  const mockSellingPosts = [
    { id: 1, title: 'Tủ lạnh Samsung Inverter 236L', price: '3.500.000 đ', image: 'https://images.unsplash.com/photo-1584568694244-14fbdf83bd30?q=80&w=200&auto=format&fit=crop', status: 'Hoạt động tốt', views: 124, likes: 12 },
    { id: 2, title: 'Sofa góc bọc da cao cấp xám nhạt', price: '2.100.000 đ', image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=200&auto=format&fit=crop', status: 'Hư nhẹ', views: 89, likes: 5 },
  ];

  // ================= MOCK DATA: DOANH NGHIỆP (TIN MUA) =================
  const mockBuyingPosts = [
    { id: 1, title: 'Thu mua tủ lạnh hư hỏng, xác điều hòa', priceRange: '500k - 2tr / cái', quantity: 'Không giới hạn', category: 'Điện máy', expires: '30 ngày nữa' },
    { id: 2, title: 'Thu mua bàn ghế văn phòng thanh lý', priceRange: 'Thương lượng', quantity: '50 - 100 cái', category: 'Nội thất', expires: 'Đã đóng' },
  ];

  // Component: Thẻ Tin Đăng Bán (Cá nhân)
  const renderSellingCard = (post: any) => (
    <View key={post.id} style={styles.card}>
      <Image source={{ uri: post.image }} style={styles.cardImage} />
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>{post.title}</Text>
        <Text style={styles.cardPrice}>{post.price}</Text>
        <View style={styles.tagRow}>
          <View style={styles.tag}><Text style={styles.tagText}>{post.status}</Text></View>
        </View>
        <View style={styles.cardActions}>
          <View style={styles.statsRow}>
            <Ionicons name="eye-outline" size={14} color={COLORS.textLight} />
            <Text style={styles.statsText}>{post.views}</Text>
            <Text style={styles.statsDivider}>|</Text>
            <Ionicons name="heart-outline" size={14} color={COLORS.textLight} />
            <Text style={styles.statsText}>{post.likes}</Text>
          </View>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.iconBtn}><Ionicons name="pencil-outline" size={18} color={COLORS.primary} /></TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}><Ionicons name="eye-off-outline" size={18} color={COLORS.error} /></TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  // Component: Thẻ Tin Thu Mua (Doanh nghiệp)
  const renderBuyingCard = (post: any) => (
    <View key={post.id} style={styles.card}>
      <View style={styles.buyingIconBox}>
        <Ionicons name="megaphone-outline" size={28} color={COLORS.primary} />
      </View>
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>{post.title}</Text>
        <Text style={styles.cardPrice}>{post.priceRange}</Text>
        <View style={styles.tagRow}>
          <View style={[styles.tag, { backgroundColor: '#E0F2FE' }]}>
            <Text style={[styles.tagText, { color: '#0369A1' }]}>SL: {post.quantity}</Text>
          </View>
          <View style={[styles.tag, { backgroundColor: '#F3F4F6' }]}>
            <Text style={styles.tagText}>{post.category}</Text>
          </View>
        </View>
        <View style={styles.cardActions}>
          <Text style={[styles.statsText, post.expires === 'Đã đóng' && { color: COLORS.error, fontWeight: 'bold' }]}>
            Thời hạn: {post.expires}
          </Text>
          <View style={styles.actionButtons}>
            <TouchableOpacity style={styles.iconBtn}><Ionicons name="pencil-outline" size={18} color={COLORS.primary} /></TouchableOpacity>
            <TouchableOpacity style={styles.iconBtn}><Ionicons name="lock-closed-outline" size={18} color={COLORS.error} /></TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={[styles.mobileWrapper, isWeb && { width: 480, alignSelf: 'center' }]}>
        <MainHeader title="Quản lý tin đăng" />
        
        {/* DEV MODE TOGGLE */}
        <TouchableOpacity 
          style={styles.devToggleBtn}
          onPress={() => setDevRole(devRole === 'personal' ? 'business' : 'personal')}
        >
          <Ionicons name="swap-horizontal" size={20} color="#D97706" />
          <Text style={styles.devToggleText}>
            DEV MODE: Tin đăng [{devRole === 'personal' ? 'Cá nhân (Bán)' : 'Doanh nghiệp (Mua)'}]
          </Text>
        </TouchableOpacity>

        {/* CUSTOM TABS */}
        <View style={styles.tabContainer}>
          {devRole === 'personal' ? (
            <>
              <TouchableOpacity style={[styles.tabBtn, activePersonalTab === 'active' && styles.tabBtnActive]} onPress={() => setActivePersonalTab('active')}>
                <Text style={[styles.tabText, activePersonalTab === 'active' && styles.tabTextActive]}>Đang hiển thị (2)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabBtn, activePersonalTab === 'hidden' && styles.tabBtnActive]} onPress={() => setActivePersonalTab('hidden')}>
                <Text style={[styles.tabText, activePersonalTab === 'hidden' && styles.tabTextActive]}>Đã ẩn / Đã bán (0)</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={[styles.tabBtn, activeBusinessTab === 'buying' && styles.tabBtnActive]} onPress={() => setActiveBusinessTab('buying')}>
                <Text style={[styles.tabText, activeBusinessTab === 'buying' && styles.tabTextActive]}>Tin Thu Mua (2)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.tabBtn, activeBusinessTab === 'requests' && styles.tabBtnActive]} onPress={() => setActiveBusinessTab('requests')}>
                <Text style={[styles.tabText, activeBusinessTab === 'requests' && styles.tabTextActive]}>Yêu cầu chào hàng (5)</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
          {/* RENDER LIST DỰA THEO ROLE & TAB */}
          {devRole === 'personal' ? (
             activePersonalTab === 'active' 
              ? mockSellingPosts.map(renderSellingCard) 
              : <Text style={styles.emptyText}>Bạn chưa có tin đăng nào bị ẩn.</Text>
          ) : (
             activeBusinessTab === 'buying'
              ? mockBuyingPosts.map(renderBuyingCard)
              : <Text style={styles.emptyText}>Chưa có ai gửi yêu cầu bán cho bạn.</Text>
          )}
          <View style={{ height: 80 }} /> {/* Padding đáy cho FAB */}
        </ScrollView>

        {/* NÚT TẠO TIN MỚI (FAB - Floating Action Button) */}
        <TouchableOpacity 
            style={styles.fabButton}
            onPress={() => router.push('/create-post')}
        >
          <Ionicons name="add" size={32} color={COLORS.white} />
        </TouchableOpacity>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.border },
  mobileWrapper: { flex: 1, backgroundColor: '#F8F9FA' },
  
  devToggleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3C7', paddingVertical: 12, margin: 16, borderRadius: 12, borderWidth: 1, borderColor: '#F59E0B', borderStyle: 'dashed', gap: 8 },
  devToggleText: { color: '#D97706', fontSize: 13, fontWeight: '700' },

  // Tabs
  tabContainer: { flexDirection: 'row', backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  tabBtn: { flex: 1, paddingVertical: 14, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabBtnActive: { borderBottomColor: COLORS.primary },
  tabText: { fontSize: 14, fontWeight: '600', color: COLORS.textLight },
  tabTextActive: { color: COLORS.primary },

  // List
  scrollContent: { padding: 16 },
  emptyText: { textAlign: 'center', marginTop: 40, color: COLORS.textLight, fontSize: 14 },

  // Card
  card: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 16, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: COLORS.border },
  cardImage: { width: 90, height: 90, borderRadius: 10, backgroundColor: COLORS.border },
  buyingIconBox: { width: 90, height: 90, borderRadius: 10, backgroundColor: '#F0F9FF', justifyContent: 'center', alignItems: 'center' },
  cardContent: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },
  cardTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  cardPrice: { fontSize: 15, fontWeight: 'bold', color: COLORS.error, marginBottom: 6 },
  
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: { backgroundColor: '#F1F5F9', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  tagText: { fontSize: 11, color: '#475569', fontWeight: '500' },

  cardActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  statsRow: { flexDirection: 'row', alignItems: 'center' },
  statsText: { fontSize: 12, color: COLORS.textLight, marginLeft: 4 },
  statsDivider: { fontSize: 10, color: COLORS.border, marginHorizontal: 6 },
  actionButtons: { flexDirection: 'row', gap: 12 },
  iconBtn: { padding: 4 },

  // FAB
  fabButton: { position: 'absolute', bottom: 20, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', shadowColor: COLORS.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 6 },
});