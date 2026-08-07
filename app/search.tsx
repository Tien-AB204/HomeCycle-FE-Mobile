import React, { useState, useRef, useEffect } from 'react';
import { 
  View, Text, StyleSheet, SafeAreaView, TextInput, TouchableOpacity, 
  ScrollView, Platform, Keyboard, Image
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { COLORS } from '../src/constants/theme';
import apiClient from '../src/services/apis/axiosClient';

// ================= DICTIONARIES =================
const FILTER_CONDITIONS = ['Hoạt động tốt', 'Hư nhẹ', 'Hư nặng', 'Không hoạt động', 'Thanh lý đồng nát'];
const FILTER_SPACES = ['Phòng khách', 'Phòng ngủ', 'Nhà bếp', 'Phòng ăn', 'Phòng làm việc', 'Phòng tắm'];
const POST_TYPES = ['Bán', 'Mua'];
const DELIVERY_METHODS = ['Không xác định', 'Người mua tự lấy', 'Người bán giao', 'Giao hàng qua App'];
const PRIORITY_LEVELS = ['Thấp', 'Trung bình', 'Cao'];

const CONDITION_MAP: Record<string, string> = {
  'Hoạt động tốt': 'FullyFunctional',
  'Hư nhẹ': 'MinorDefect',
  'Hư nặng': 'SevereDefect',
  'Không hoạt động': 'NonFunctional',
  'Thanh lý đồng nát': 'Scrap'
};

const DELIVERY_MAP: Record<string, string> = {
  'Không xác định': 'Unknown',
  'Người mua tự lấy': 'SelfPickup',
  'Người bán giao': 'SellerDelivery',
  'Giao hàng qua App': 'PlatformDelivery'
};

const PRIORITY_MAP: Record<string, string> = {
  'Thấp': 'Low',
  'Trung bình': 'Medium',
  'Cao': 'High'
};

// ================= TYPE DEFINITIONS =================
type ViewState = 'BUILDER' | 'HISTORY' | 'RESULTS';

export default function SearchScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  // VIEW STATES
  const [viewState, setViewState] = useState<ViewState>('BUILDER');
  const [isGridView, setIsGridView] = useState(true);

  // SEARCH STATES
  const [query, setQuery] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  
  // Các state tương ứng với API
  const [postType, setPostType] = useState(''); 
  const [filterCategories, setFilterCategories] = useState<any[]>([]); // Danh mục thật từ API
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedCondition, setSelectedCondition] = useState('');
  const [selectedSpace, setSelectedSpace] = useState('');
  const [deliveryMethod, setDeliveryMethod] = useState('');
  const [priorityLevel, setPriorityLevel] = useState('');
  
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minUsage, setMinUsage] = useState('');
  const [maxUsage, setMaxUsage] = useState('');
  const [minDamage, setMinDamage] = useState('');
  const [maxDamage, setMaxDamage] = useState('');
  const [postedWithinDays, setPostedWithinDays] = useState('');
  
  const [city, setCity] = useState('');
  const [ward, setWard] = useState('');
  const [onlyAvailable, setOnlyAvailable] = useState(true);

  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // === LẤY DANH MỤC THẬT TỪ API KHI MỞ TRANG ===
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await apiClient.get('/categories/get-all');
        const cats = response.data?.data?.items || response.data?.items || [];
        setFilterCategories(cats);
      } catch (error) {
        console.error("Lỗi tải danh mục cho bộ lọc:", error);
      }
    };
    fetchCategories();
  }, []);

  // ================= LOGIC =================
  const handleInputFocus = () => setViewState('HISTORY');

  const handleBack = () => {
    Keyboard.dismiss();
    if (viewState === 'HISTORY' || viewState === 'RESULTS') {
      setViewState('BUILDER');
    } else {
      router.canGoBack() ? router.back() : router.replace('/(tabs)');
    }
  };

  const selectHistoryItem = (item: string) => {
    setQuery(item);
    Keyboard.dismiss();
    setViewState('BUILDER');
  };

  const executeSearch = async () => {
    Keyboard.dismiss();
    
    if (query.trim() !== '' && !history.includes(query)) {
      setHistory([query, ...history]);
    }

    setViewState('RESULTS');
    setIsLoading(true);

    try {
      const payload: any = {
        pageNumber: 1, 
        pageSize: 20,
        onlyAvailable: onlyAvailable, 
        sortBy: "Newest",
        attributeFilters: [] 
      };

      if (query.trim()) payload.keyword = query.trim();

      if (postType) payload.postType = postType === 'Bán' ? 'Sell' : 'Buy';
      if (selectedCat) payload.categoryId = selectedCat;
      if (selectedSpace) payload.spaceUsage = selectedSpace;
      
      if (selectedCondition) payload.functionalityStatus = CONDITION_MAP[selectedCondition];
      if (deliveryMethod) payload.deliveryMethod = DELIVERY_MAP[deliveryMethod];
      if (priorityLevel) payload.priorityLevel = PRIORITY_MAP[priorityLevel];

      if (minPrice) payload.minPrice = Number(minPrice);
      if (maxPrice) payload.maxPrice = Number(maxPrice);
      if (minUsage) payload.minUsageDuration = Number(minUsage);
      if (maxUsage) payload.maxUsageDuration = Number(maxUsage);
      if (minDamage) payload.minDamageLevel = Number(minDamage);
      if (maxDamage) payload.maxDamageLevel = Number(maxDamage);
      if (postedWithinDays) payload.postedWithinDays = Number(postedWithinDays);

      if (city.trim()) payload.city = city.trim();
      if (ward.trim()) payload.ward = ward.trim();

      console.log("🚀 PAYLOAD GỬI LÊN SERVER:", JSON.stringify(payload, null, 2));

      const response = await apiClient.post('/posts/search', payload);
      const fetchedData = response.data?.data?.items || response.data?.items || response.data || [];
      setSearchResults(fetchedData);

    } catch (error: any) {
      console.error("❌ Lỗi khi tìm kiếm:", error);
      if (error.response?.data) {
         const backendError = error.response.data;
         alert(`Lỗi từ máy chủ:\n${backendError.message || JSON.stringify(backendError)}`);
      } else {
         alert("Không thể kết nối đến máy chủ. Vui lòng thử lại!");
      }
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const resetFilters = () => {
    setSelectedCat(null); setQuery(''); setSelectedCondition(''); setSelectedSpace('');
    setDeliveryMethod(''); setPriorityLevel(''); setCity(''); setWard('');
    setMinPrice(''); setMaxPrice(''); setMinUsage(''); setMaxUsage(''); 
    setMinDamage(''); setMaxDamage(''); setPostedWithinDays(''); setOnlyAvailable(true);
    setPostType('');
  };

  // === FORMATTERS CHO DỮ LIỆU THẬT ===
  const formatPrice = (price: number) => {
    if (!price && price !== 0) return "Liên hệ";
    return price.toLocaleString("vi-VN") + " đ";
  };

  const getCoverImage = (post: any) => {
    if (post.medias && post.medias.length > 0) {
      return { uri: post.medias[0].url || post.medias[0].mediaUrl };
    }
    return { uri: "https://placehold.co/400x400/E2E8F0/94A3B8.png?text=No+Image" };
  };

  const getFullAddress = (post: any) => {
    return [post.streetAddress, post.ward, post.city].filter(Boolean).join(", ");
  };
  
  // ================= UI RENDERERS =================
  const renderFilterBuilder = () => (
    <View style={styles.flex1}>
      <ScrollView style={styles.bodyContainer} showsVerticalScrollIndicator={false}>
        
        {/* Phân loại & Loại bài */}
        <Text style={styles.filterSectionTitle}>1. Thông tin cơ bản</Text>
        <Text style={styles.subLabel}>Loại bài đăng</Text>
        <View style={styles.chipContainer}>
          {POST_TYPES.map((type) => (
            <TouchableOpacity key={type} style={[styles.chip, postType === type && styles.chipActive]} onPress={() => setPostType(postType === type ? '' : type)}>
              <Text style={[styles.chipText, postType === type && styles.chipTextActive]}>{type}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <Text style={styles.subLabel}>Danh mục sản phẩm</Text>
        <View style={styles.chipContainer}>
          {filterCategories.map((cat) => (
            <TouchableOpacity 
              key={cat.categoryId} 
              style={[styles.chip, selectedCat === cat.categoryId && styles.chipActive]} 
              onPress={() => setSelectedCat(cat.categoryId === selectedCat ? null : cat.categoryId)}
            >
              <Text style={[styles.chipText, selectedCat === cat.categoryId && styles.chipTextActive]}>
                {cat.categoryName}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tình trạng & Giá cả */}
        <Text style={styles.filterSectionTitle}>2. Tình trạng & Giá cả</Text>
        <Text style={styles.subLabel}>Khoảng giá (VNĐ)</Text>
        <View style={styles.inputRow}>
          <TextInput style={styles.numberInput} placeholder="Tối thiểu" keyboardType="numeric" value={minPrice} onChangeText={setMinPrice} />
          <View style={styles.divider} />
          <TextInput style={styles.numberInput} placeholder="Tối đa" keyboardType="numeric" value={maxPrice} onChangeText={setMaxPrice} />
        </View>

        <Text style={styles.subLabel}>Thời gian sử dụng (Tháng)</Text>
        <View style={styles.inputRow}>
          <TextInput style={styles.numberInput} placeholder="Từ (Tháng)" keyboardType="numeric" value={minUsage} onChangeText={setMinUsage} />
          <View style={styles.divider} />
          <TextInput style={styles.numberInput} placeholder="Đến (Tháng)" keyboardType="numeric" value={maxUsage} onChangeText={setMaxUsage} />
        </View>

        <Text style={styles.subLabel}>Mức độ hư hại (%)</Text>
        <View style={styles.inputRow}>
          <TextInput style={styles.numberInput} placeholder="Từ 0%" keyboardType="numeric" value={minDamage} onChangeText={setMinDamage} />
          <View style={styles.divider} />
          <TextInput style={styles.numberInput} placeholder="Đến 100%" keyboardType="numeric" value={maxDamage} onChangeText={setMaxDamage} />
        </View>

        <Text style={styles.subLabel}>Trạng thái hoạt động</Text>
        <View style={styles.chipContainer}>
          {FILTER_CONDITIONS.map((cond) => (
            <TouchableOpacity key={cond} style={[styles.chip, selectedCondition === cond && styles.chipActive]} onPress={() => setSelectedCondition(selectedCondition === cond ? "" : cond)}>
              <Text style={[styles.chipText, selectedCondition === cond && styles.chipTextActive]}>{cond}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logistic & Vị trí */}
        <Text style={styles.filterSectionTitle}>3. Vận chuyển & Vị trí</Text>
        <View style={styles.inputRow}>
          <TextInput style={[styles.numberInput, { flex: 1, textAlign: 'left', paddingHorizontal: 12 }]} placeholder="Tỉnh / Thành phố" value={city} onChangeText={setCity} />
          <TextInput style={[styles.numberInput, { flex: 1, textAlign: 'left', paddingHorizontal: 12 }]} placeholder="Quận / Phường" value={ward} onChangeText={setWard} />
        </View>

        <Text style={styles.subLabel}>Phương thức giao hàng</Text>
        <View style={styles.chipContainer}>
          {DELIVERY_METHODS.map((method) => (
            <TouchableOpacity key={method} style={[styles.chip, deliveryMethod === method && styles.chipActive]} onPress={() => setDeliveryMethod(deliveryMethod === method ? "" : method)}>
              <Text style={[styles.chipText, deliveryMethod === method && styles.chipTextActive]}>{method}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Bổ sung khác */}
        <Text style={styles.filterSectionTitle}>4. Tùy chọn khác</Text>
        <Text style={styles.subLabel}>Không gian sử dụng</Text>
        <View style={styles.chipContainer}>
          {FILTER_SPACES.map((space) => (
            <TouchableOpacity key={space} style={[styles.chip, selectedSpace === space && styles.chipActive]} onPress={() => setSelectedSpace(selectedSpace === space ? "" : space)}>
              <Text style={[styles.chipText, selectedSpace === space && styles.chipTextActive]}>{space}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <Text style={styles.subLabel}>Chỉ hiện hàng chưa bán</Text>
          <TouchableOpacity style={[styles.chip, onlyAvailable && styles.chipActive]} onPress={() => setOnlyAvailable(!onlyAvailable)}>
            <Text style={[styles.chipText, onlyAvailable && styles.chipTextActive]}>{onlyAvailable ? 'Bật' : 'Tắt'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 16 }}>
          <Text style={[styles.subLabel, { marginTop: 0, marginRight: 12 }]}>Đăng trong vòng (Ngày):</Text>
          <TextInput style={[styles.numberInput, { width: 100 }]} placeholder="Ví dụ: 7" keyboardType="numeric" value={postedWithinDays} onChangeText={setPostedWithinDays} />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footerAction}>
        <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
          <Text style={styles.resetText}>Thiết lập lại</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.applyBtn} onPress={executeSearch}>
          <Text style={styles.applyText}>Áp dụng tìm kiếm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHistoryView = () => (
    <View style={styles.bodyContainer}>
      <Text style={styles.historyTitle}>Lịch sử tìm kiếm</Text>
      {history.map((item, index) => (
        <TouchableOpacity key={index} style={styles.historyItem} onPress={() => selectHistoryItem(item)}>
          <Ionicons name="time-outline" size={20} color={COLORS.textLight} />
          <Text style={styles.historyText}>{item}</Text>
          <TouchableOpacity onPress={() => setHistory(history.filter((h) => h !== item))} style={{ padding: 4 }}>
            <Ionicons name="close" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderResultsView = () => (
    <View style={styles.flex1}>
      <View style={styles.sortBar}>
        <Text style={styles.resultSummaryText}>Hiển thị {searchResults.length} kết quả</Text>
        <View style={styles.sortRightActions}>
          <TouchableOpacity onPress={() => setViewState('BUILDER')} style={styles.filterTriggerBtn}>
            <Ionicons name="filter" size={16} color={COLORS.primary} />
            <Text style={{ fontSize: 13, color: COLORS.primary, fontWeight: '600', marginLeft: 4 }}>Lọc lại</Text>
          </TouchableOpacity>
          <View style={styles.sortDivider} />
          <TouchableOpacity onPress={() => setIsGridView(!isGridView)} style={{ paddingHorizontal: 8 }}>
            <Ionicons name={isGridView ? "list" : "grid-outline"} size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.resultsContainer} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <View style={{ marginTop: 40, alignItems: 'center' }}>
            <Text style={{ color: COLORS.textLight }}>Đang tìm kiếm...</Text>
          </View>
        ) : searchResults.length === 0 ? (
          <View style={styles.emptyState}>
             <Ionicons name="search-outline" size={64} color={COLORS.border} />
             <Text style={styles.emptyText}>Không tìm thấy sản phẩm nào phù hợp</Text>
          </View>
        ) : (
          <View style={isGridView ? styles.gridContainer : styles.listContainer}>
            {searchResults.map((post) => (
              <TouchableOpacity key={post.postId} style={isGridView ? styles.gridCard : styles.listCard}>
                <View style={isGridView ? styles.gridImageWrapper : styles.listImageWrapper}>
                  <Image source={getCoverImage(post)} style={styles.productImage} />
                  <View style={styles.conditionBadge}>
                    <Text style={styles.conditionText}>{post.status || 'Mới'}</Text>
                  </View>
                </View>
                <View style={isGridView ? styles.gridInfoWrapper : styles.listInfoWrapper}>
                  <Text style={styles.productName} numberOfLines={2}>{post.productName || 'Sản phẩm'}</Text>
                  <Text style={styles.productPrice}>{formatPrice(post.basePrice)}</Text>
                  <View style={styles.locationContainer}>
                    <Ionicons name="location-outline" size={13} color={COLORS.textLight} />
                    <Text style={styles.locationText} numberOfLines={1}>{getFullAddress(post) || 'Chưa cập nhật'}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={26} color={COLORS.text} />
        </TouchableOpacity>

        <View style={[styles.searchBox, viewState === 'RESULTS' && { backgroundColor: '#F5F6F8', borderColor: 'transparent' }]}>
          <Ionicons name="search" size={18} color={COLORS.textLight} style={{ marginLeft: 12 }} />
          <TextInput
            ref={inputRef}
            style={[styles.searchInput, Platform.OS === "web" && ({ outlineStyle: "none" } as any)]}
            placeholder="Tìm theo tên, mô tả..."
            placeholderTextColor={COLORS.textLight}
            value={query}
            onChangeText={setQuery}
            onFocus={handleInputFocus}
            onSubmitEditing={() => { setViewState('BUILDER'); }}
            returnKeyType="done"
          />
          {query.length > 0 && viewState !== 'RESULTS' && (
            <TouchableOpacity onPress={() => setQuery("")} style={{ paddingHorizontal: 12 }}>
              <Ionicons name="close-circle" size={18} color={COLORS.border} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {viewState === 'HISTORY' && renderHistoryView()}
      {viewState === 'BUILDER' && renderFilterBuilder()}
      {viewState === 'RESULTS' && renderResultsView()}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: COLORS.white, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' },
  backBtn: { padding: 4, marginRight: 12 },
  searchBox: { flex: 1, flexDirection: "row", alignItems: "center", borderWidth: 1.5, borderColor: COLORS.primary, borderRadius: 8, height: 42, overflow: "hidden" },
  searchInput: { flex: 1, height: "100%", paddingLeft: 8, fontSize: 14, color: COLORS.text },
  
  bodyContainer: { flex: 1, paddingHorizontal: 20, paddingTop: 16, backgroundColor: COLORS.white },
  historyTitle: { fontSize: 16, fontWeight: "bold", color: COLORS.text, marginBottom: 16 },
  historyItem: { flexDirection: "row", alignItems: "center", paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#F0F0F0" },
  historyText: { flex: 1, fontSize: 14, color: COLORS.text, marginLeft: 12 },
  
  filterSectionTitle: { fontSize: 15, fontWeight: "800", color: COLORS.text, marginTop: 24, marginBottom: 8 },
  subLabel: { fontSize: 13, fontWeight: "600", color: COLORS.textLight, marginTop: 12, marginBottom: 8 },
  chipContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, backgroundColor: COLORS.background, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border },
  chipActive: { backgroundColor: "#E9F0F0", borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textLight, fontWeight: "500" },
  chipTextActive: { color: COLORS.primary, fontWeight: "700" },
  
  inputRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  numberInput: { flex: 1, height: 44, backgroundColor: COLORS.background, borderRadius: 8, textAlign: "center", fontSize: 14, color: COLORS.text, borderWidth: 1, borderColor: COLORS.border },
  divider: { width: 12, height: 2, backgroundColor: COLORS.border },
  
  footerAction: { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", padding: 16, backgroundColor: COLORS.white, borderTopWidth: 1, borderTopColor: "#F0F0F0", gap: 12, elevation: 10 },
  resetBtn: { flex: 1, height: 48, justifyContent: "center", alignItems: "center", borderRadius: 8, borderWidth: 1, borderColor: COLORS.border },
  resetText: { fontSize: 15, fontWeight: "bold", color: COLORS.text },
  applyBtn: { flex: 2, height: 48, justifyContent: "center", alignItems: "center", borderRadius: 8, backgroundColor: COLORS.primary },
  applyText: { fontSize: 15, fontWeight: "bold", color: COLORS.white },

  resultsContainer: { flex: 1, backgroundColor: "#F8F9FA", paddingTop: 16 },
  sortBar: { flexDirection: "row", height: 44, borderBottomWidth: 1, borderBottomColor: "#F0F0F0", backgroundColor: COLORS.white, alignItems: "center", justifyContent: 'space-between', paddingHorizontal: 16 },
  resultSummaryText: { fontSize: 13, color: COLORS.textLight, fontWeight: '500' },
  sortRightActions: { flexDirection: "row", alignItems: "center" },
  filterTriggerBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E9F0F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  sortDivider: { width: 1, height: 20, backgroundColor: COLORS.border, marginHorizontal: 12 },
  
  emptyState: { flex: 1, justifyContent: "center", alignItems: "center", marginTop: 40 },
  emptyText: { marginTop: 12, color: COLORS.textLight, fontSize: 14 },

  gridContainer: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, justifyContent: "space-between" },
  gridCard: { backgroundColor: COLORS.white, width: "48%", borderRadius: 12, overflow: "hidden", marginBottom: 16, borderWidth: 1, borderColor: "#EEF0F2" },
  gridImageWrapper: { width: "100%", aspectRatio: 1, backgroundColor: "#FAFAFA", position: "relative" },
  gridInfoWrapper: { padding: 10 },
  listContainer: { paddingHorizontal: 16 },
  listCard: { flexDirection: "row", backgroundColor: COLORS.white, borderRadius: 12, overflow: "hidden", marginBottom: 12, padding: 12, borderWidth: 1, borderColor: "#EEF0F2" },
  listImageWrapper: { width: 90, height: 90, borderRadius: 8, overflow: "hidden", position: "relative" },
  listInfoWrapper: { flex: 1, marginLeft: 12, justifyContent: "space-between" },
  productImage: { width: "100%", height: "100%" },
  conditionBadge: { position: "absolute", top: 6, left: 6, backgroundColor: COLORS.text, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 4 },
  conditionText: { color: COLORS.white, fontSize: 9, fontWeight: "bold" },
  productName: { fontSize: 13, color: COLORS.text, fontWeight: "600", lineHeight: 18, marginBottom: 6, height: 36 },
  productPrice: { fontSize: 14, fontWeight: "bold", color: COLORS.error, marginBottom: 4 },
  locationContainer: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 11, color: COLORS.textLight, flex: 1 },
});