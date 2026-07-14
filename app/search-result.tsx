import React, { useState } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, ScrollView, 
  TouchableOpacity, Image, TextInput, Platform 
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../src/constants/theme';
import { sellingPosts } from '../src/mocks/homeData';
import MainHeader from '../src/components/shared/MainHeader'; // IMPORT COMPONENT VÀO

export default function SearchResultScreen() {
  const router = useRouter();
  const { query, category } = useLocalSearchParams(); 

  const [isGridView, setIsGridView] = useState(true);
  const [selectedSort, setSelectedSort] = useState('Mới nhất');

  const sortOptions = ['Phổ biến', 'Mới nhất', 'Giá tăng', 'Giá giảm'];

  // Đóng gói thanh Search thành 1 biến giao diện
  const renderSearchBar = () => (
    <TouchableOpacity style={styles.searchBarContainer} onPress={() => router.back()}>
      <Ionicons name="search" size={18} color={COLORS.textLight} style={{ marginRight: 6 }} />
      <TextInput
        style={[styles.searchBarInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
        placeholder="Tìm kiếm sản phẩm..."
        placeholderTextColor={COLORS.textLight}
        value={query as string}
        editable={false} 
      />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      
      {/* SỬ DỤNG MAIN HEADER CHUẨN MỰC CHỈ VỚI 1 DÒNG */}
      <MainHeader showBack={true} centerContent={renderSearchBar()} />

      <View style={styles.sortBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortTabsWrapper}>
          {sortOptions.map((opt) => (
            <TouchableOpacity 
              key={opt} 
              style={[styles.sortTab, selectedSort === opt && styles.sortTabActive]}
              onPress={() => setSelectedSort(opt)}
            >
              <Text style={[styles.sortTabText, selectedSort === opt && styles.sortTabTextActive]}>
                {opt}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        
        <View style={styles.sortRightActions}>
          <View style={styles.sortDivider} />
          <TouchableOpacity onPress={() => setIsGridView(!isGridView)} style={{ paddingHorizontal: 8 }}>
            <Ionicons name={isGridView ? "list" : "grid-outline"} size={20} color={COLORS.textLight} />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => console.log('Mở filter')} style={{ paddingHorizontal: 8 }}>
            <Ionicons name="filter" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false}>
        <Text style={styles.resultSummaryText}>
          Kết quả cho "<Text style={{ fontWeight: 'bold', color: COLORS.text }}>{query || 'Tất cả sản phẩm'}</Text>"
        </Text>

        <View style={isGridView ? styles.gridContainer : styles.listContainer}>
          {sellingPosts.map((post) => (
            <TouchableOpacity 
              key={post.id} 
              style={isGridView ? styles.gridCard : styles.listCard}
            >
              <View style={isGridView ? styles.gridImageWrapper : styles.listImageWrapper}>
                <Image source={{ uri: post.image }} style={styles.productImage} />
                <View style={styles.conditionBadge}>
                  <Text style={styles.conditionText}>{post.condition}</Text>
                </View>
              </View>

              <View style={isGridView ? styles.gridInfoWrapper : styles.listInfoWrapper}>
                <Text style={styles.productName} numberOfLines={2}>{post.name}</Text>
                <Text style={styles.productPrice}>{post.price}</Text>
                
                <View style={styles.locationContainer}>
                  <Ionicons name="location-outline" size={13} color={COLORS.textLight} />
                  <Text style={styles.locationText} numberOfLines={1}>{post.location}</Text>
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </View>
        <View style={{ height: 40 }} />
      </ScrollView>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  
  // Style riêng cho thanh Search nhét vào Header
  searchBarContainer: { 
    flexDirection: 'row', alignItems: 'center', 
    backgroundColor: '#F5F6F8', borderRadius: 8, height: 36, 
    paddingHorizontal: 10, width: '100%' // Căng tràn 100% trong khung centerContent
  },
  searchBarInput: { flex: 1, fontSize: 14, color: COLORS.text, height: '100%' },

  sortBar: { 
    flexDirection: 'row', height: 44, borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
    backgroundColor: COLORS.white, alignItems: 'center'
  },
  sortTabsWrapper: { paddingHorizontal: 16, alignItems: 'center' },
  sortTab: { paddingHorizontal: 12, height: '100%', justifyContent: 'center' },
  sortTabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  sortTabText: { fontSize: 13, color: COLORS.textLight, fontWeight: '500' },
  sortTabTextActive: { color: COLORS.primary, fontWeight: '700' },
  
  sortRightActions: { flexDirection: 'row', alignItems: 'center', paddingRight: 8 },
  sortDivider: { width: 1, height: 20, backgroundColor: COLORS.border, marginHorizontal: 4 },

  resultsContainer: { flex: 1, backgroundColor: '#F8F9FA' },
  resultSummaryText: { paddingHorizontal: 16, paddingVertical: 12, fontSize: 13, color: COLORS.textLight },

  gridContainer: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between' },
  gridCard: { backgroundColor: COLORS.white, width: '48%', borderRadius: 12, overflow: 'hidden', marginBottom: 16, borderWidth: 1, borderColor: '#EEF0F2' },
  gridImageWrapper: { width: '100%', aspectRatio: 1, backgroundColor: '#FAFAFA', position: 'relative' },
  gridInfoWrapper: { padding: 10 },

  listContainer: { paddingHorizontal: 16 },
  listCard: { flexDirection: 'row', backgroundColor: COLORS.white, borderRadius: 12, overflow: 'hidden', marginBottom: 12, padding: 12, borderWidth: 1, borderColor: '#EEF0F2' },
  listImageWrapper: { width: 90, height: 90, borderRadius: 8, overflow: 'hidden', position: 'relative' },
  listInfoWrapper: { flex: 1, marginLeft: 12, justifyContent: 'space-between' },

  productImage: { width: '100%', height: '100%' },
  conditionBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: COLORS.text, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  conditionText: { color: COLORS.white, fontSize: 9, fontWeight: 'bold' },
  productName: { fontSize: 13, color: COLORS.text, fontWeight: '600', lineHeight: 18, marginBottom: 6, height: 36 },
  productPrice: { fontSize: 14, fontWeight: 'bold', color: COLORS.error, marginBottom: 4 },
  locationContainer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  locationText: { fontSize: 11, color: COLORS.textLight, flex: 1 },
});