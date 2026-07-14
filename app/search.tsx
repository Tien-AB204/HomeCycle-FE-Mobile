// app/search.tsx
import React, { useState, useRef } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, 
  Platform, ScrollView, Keyboard 
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../src/constants/theme';

const FILTER_CATEGORIES = ['Tất cả', 'Điện máy', 'Nội thất', 'Sinh hoạt'];
const FILTER_CONDITIONS = ['Hoạt động tốt', 'Hư nhẹ', 'Hư nặng', 'Không hoạt động', 'Thanh lý đồng nát'];
const FILTER_SPACES = ['Phòng khách', 'Phòng ngủ', 'Nhà bếp', 'Phòng ăn', 'Phòng làm việc', 'Phòng tắm'];

type ViewState = 'FILTER' | 'HISTORY';

export default function SearchScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  const [query, setQuery] = useState('');
  const [viewState, setViewState] = useState<ViewState>('FILTER'); 
  const [history, setHistory] = useState(['Máy lạnh cũ', 'Tủ lạnh Samsung', 'Sofa phòng khách']); 
  
  const [selectedCat, setSelectedCat] = useState('Tất cả');
  const [selectedCondition, setSelectedCondition] = useState('');
  
  const handleInputFocus = () => {
    setViewState('HISTORY');
  };

  const handleBack = () => {
    Keyboard.dismiss();
    if (viewState === 'HISTORY') {
      setViewState('FILTER');
    } else {
      router.back();
    }
  };

  const executeSearch = (searchQuery: string) => {
    Keyboard.dismiss();
    
    if (searchQuery.trim() !== '' && !history.includes(searchQuery)) {
      setHistory([searchQuery, ...history]);
    }
    
    // ĐIỀU HƯỚNG SANG TRANG KẾT QUẢ RIÊNG BIỆT
    router.push({
      pathname: '/search-result',
      params: { query: searchQuery, category: selectedCat, condition: selectedCondition }
    });
  };

  const removeHistoryItem = (item: string) => {
    setHistory(history.filter(h => h !== item));
  };

  const renderFilterView = () => (
    <ScrollView style={styles.bodyContainer} showsVerticalScrollIndicator={false}>
      <Text style={styles.filterSectionTitle}>Phân loại chính</Text>
      <View style={styles.chipContainer}>
        {FILTER_CATEGORIES.map(cat => (
          <TouchableOpacity 
            key={cat} 
            style={[styles.chip, selectedCat === cat && styles.chipActive]}
            onPress={() => setSelectedCat(cat)}
          >
            <Text style={[styles.chipText, selectedCat === cat && styles.chipTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.filterSectionTitle}>Khoảng giá (VNĐ)</Text>
      <View style={styles.priceRow}>
        <TextInput style={styles.priceInput} placeholder="TỐI THIỂU" keyboardType="numeric" placeholderTextColor={COLORS.border} />
        <View style={styles.priceDivider} />
        <TextInput style={styles.priceInput} placeholder="TỐI ĐA" keyboardType="numeric" placeholderTextColor={COLORS.border} />
      </View>

      <Text style={styles.filterSectionTitle}>Tình trạng sản phẩm</Text>
      <View style={styles.chipContainer}>
        {FILTER_CONDITIONS.map(cond => (
          <TouchableOpacity 
            key={cond} 
            style={[styles.chip, selectedCondition === cond && styles.chipActive]}
            onPress={() => setSelectedCondition(selectedCondition === cond ? '' : cond)}
          >
            <Text style={[styles.chipText, selectedCondition === cond && styles.chipTextActive]}>{cond}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.filterSectionTitle}>Không gian sử dụng</Text>
      <View style={styles.chipContainer}>
        {FILTER_SPACES.map(space => (
          <TouchableOpacity key={space} style={styles.chip}>
            <Text style={styles.chipText}>{space}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={{ height: 100 }} /> 
    </ScrollView>
  );

  const renderHistoryView = () => (
    <View style={styles.bodyContainer}>
      <Text style={styles.historyTitle}>Lịch sử tìm kiếm</Text>
      {history.length > 0 ? (
        history.map((item, index) => (
          <TouchableOpacity key={index} style={styles.historyItem} onPress={() => executeSearch(item)}>
            <Ionicons name="time-outline" size={20} color={COLORS.textLight} />
            <Text style={styles.historyText}>{item}</Text>
            <TouchableOpacity onPress={() => removeHistoryItem(item)} style={{ padding: 4 }}>
              <Ionicons name="close" size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))
      ) : (
        <Text style={{ textAlign: 'center', color: COLORS.textLight, marginTop: 20 }}>Chưa có lịch sử tìm kiếm</Text>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color={COLORS.text} />
        </TouchableOpacity>
        
        <View style={styles.searchBox}>
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
            placeholder="Bạn đang tìm gì..."
            placeholderTextColor={COLORS.border}
            value={query}
            onChangeText={setQuery}
            onFocus={handleInputFocus}
            onSubmitEditing={() => executeSearch(query)} 
            returnKeyType="search"
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery('')} style={{ paddingHorizontal: 8 }}>
              <Ionicons name="close-circle" size={18} color={COLORS.border} />
            </TouchableOpacity>
          )}
          
          <TouchableOpacity style={styles.searchButtonRight} onPress={() => executeSearch(query)}>
            <Ionicons name="search" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </View>

      {viewState === 'FILTER' && renderFilterView()}
      {viewState === 'HISTORY' && renderHistoryView()}

      {viewState === 'FILTER' && (
        <View style={styles.footerAction}>
          <TouchableOpacity style={styles.resetBtn}>
            <Text style={styles.resetText}>Thiết lập lại</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.applyBtn} onPress={() => executeSearch(query)}>
            <Text style={styles.applyText}>Áp dụng lọc & Tìm kiếm</Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white },
  backBtn: { padding: 4, marginRight: 12 },
  searchBox: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 8, height: 46, overflow: 'hidden' },
  searchInput: { flex: 1, height: '100%', paddingLeft: 12, fontSize: 14, color: COLORS.text },
  searchButtonRight: { backgroundColor: COLORS.primary, height: '100%', paddingHorizontal: 16, justifyContent: 'center', alignItems: 'center' },
  bodyContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 16, backgroundColor: COLORS.white },
  historyTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },
  historyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  historyText: { flex: 1, fontSize: 14, color: COLORS.text, marginLeft: 12 },
  filterSectionTitle: { fontSize: 14, fontWeight: 'bold', color: COLORS.text, marginTop: 24, marginBottom: 12 },
  chipContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { paddingHorizontal: 16, paddingVertical: 8, backgroundColor: COLORS.background, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: '#E9F0F0', borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textLight, fontWeight: '500' },
  chipTextActive: { color: COLORS.primary, fontWeight: '700' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  priceInput: { flex: 1, height: 44, backgroundColor: COLORS.background, borderRadius: 8, textAlign: 'center', fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  priceDivider: { width: 12, height: 2, backgroundColor: COLORS.border },
  footerAction: { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', padding: 16, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: '#F0F0F0', gap: 12 },
  resetBtn: { flex: 1, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  resetText: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  applyBtn: { flex: 2, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 8, backgroundColor: COLORS.primary },
  applyText: { fontSize: 15, fontWeight: 'bold', color: COLORS.white },
});