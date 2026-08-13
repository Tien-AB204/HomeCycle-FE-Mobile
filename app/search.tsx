import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Image,
  Keyboard,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../src/constants/theme";
import apiClient from "../src/services/apis/axiosClient";

const locationApi = {
  getProvinces: async () => {
    try {
      const response = await fetch("https://34tinhthanh.com/api/provinces");
      if (!response.ok) {
        throw new Error(`Không thể tải Tỉnh/Thành (${response.status})`);
      }
      return response.json();
    } catch (error) {
      console.error("Lỗi tải danh sách Tỉnh/Thành:", error);
      return [];
    }
  },
};

// ================= DICTIONARIES =================
const FILTER_CONDITIONS = [
  "Hoạt động hoàn hảo",
  "Hoạt động một phần",
  "Không hoạt động",
];
const CONDITION_MAP: Record<string, string> = {
  "Hoạt động hoàn hảo": "FullyFunctional",
  "Hoạt động một phần": "PartiallyFunctional",
  "Không hoạt động": "NonFunctional",
};

const DAMAGE_LEVELS = [
  { label: "Không hỏng (0%)", value: 0 },
  { label: "Thẩm mỹ - Trầy xước nhẹ (~20%)", value: 1 },
  { label: "Hư nhẹ - Dễ thay thế (~40%)", value: 2 },
  { label: "Hư trung bình (~60%)", value: 3 },
  { label: "Hư nặng (~80%)", value: 4 },
  { label: "Tổn thất toàn bộ (100%)", value: 5 },
];

const FILTER_SPACES = [
  "Phòng khách",
  "Phòng ngủ",
  "Nhà bếp",
  "Phòng ăn",
  "Phòng làm việc",
  "Phòng tắm",
];
const POST_TYPES = ["Bán", "Mua"];
const DELIVERY_METHODS = [
  "Không xác định",
  "Người mua tự lấy",
  "Người bán giao",
  "Giao hàng nhanh (GHN)",
];
const DELIVERY_MAP: Record<string, string> = {
  "Không xác định": "Unknown",
  "Người mua tự lấy": "BuyerPickUp",
  "Người bán giao": "SellerDelivers",
  "Giao hàng nhanh (GHN)": "GhnDelivery",
};

const PRIORITY_LEVELS = ["Ưu tiên Thấp", "Bình thường", "Bán gấp", "Khẩn cấp"];
const PRIORITY_MAP: Record<string, string> = {
  "Ưu tiên Thấp": "Low",
  "Bình thường": "Medium",
  "Bán gấp": "High",
  "Khẩn cấp": "Urgent",
};

type ViewState = "BUILDER" | "HISTORY" | "RESULTS";

export default function SearchScreen() {
  const router = useRouter();
  const inputRef = useRef<TextInput>(null);

  // VIEW STATES
  const [viewState, setViewState] = useState<ViewState>("BUILDER");
  const [isGridView, setIsGridView] = useState(true);

  // SEARCH STATES
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("Relevance");

  // CATEGORY & FILTERS
  const [postType, setPostType] = useState("");
  const [filterCategories, setFilterCategories] = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [selectedCondition, setSelectedCondition] = useState("");
  const [selectedSpace, setSelectedSpace] = useState("");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [priorityLevel, setPriorityLevel] = useState("");

  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [minUsage, setMinUsage] = useState("");
  const [maxUsage, setMaxUsage] = useState("");
  const [minDamage, setMinDamage] = useState<number | null>(null);
  const [maxDamage, setMaxDamage] = useState<number | null>(null);
  const [showDamagePicker, setShowDamagePicker] = useState<
    "min" | "max" | null
  >(null);
  const [postedWithinDays, setPostedWithinDays] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(true);

  // ================= API ĐỊA CHỈ (AUTOCOMPLETE) =================
  const [city, setCity] = useState("");
  const [cityCode, setCityCode] = useState<string | null>(null);
  const [provincesList, setProvincesList] = useState<
    { label: string; value: string }[]
  >([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);

  useEffect(() => {
    locationApi.getProvinces().then((data) => {
      setProvincesList(
        data.map((p: any) => ({ label: p.name, value: p.province_code })),
      );
    });
  }, []);

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await apiClient.get("/categories/active", {
          params: { PageSize: 100, PageNumber: 1 },
        });
        const cats = response.data?.data?.items || response.data?.items || [];
        setFilterCategories(cats);
      } catch (error) {
        console.error("Lỗi tải danh mục cho bộ lọc:", error);
      }
    };
    fetchCategories();
  }, []);

  const [originalResults, setOriginalResults] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const handleInputFocus = () => setViewState("HISTORY");

  const handleBack = () => {
    Keyboard.dismiss();
    if (viewState === "HISTORY" || viewState === "RESULTS") {
      setViewState("BUILDER");
    } else {
      router.canGoBack() ? router.back() : router.replace("/(tabs)");
    }
  };

  const selectHistoryItem = (item: string) => {
    setQuery(item);
    Keyboard.dismiss();
    setViewState("BUILDER");
  };

  const getRelevanceScore = (post: any, searchKeyword: string) => {
    if (!searchKeyword) return 0;
    const q = searchKeyword.toLowerCase();
    const pName = (post.productName || "").toLowerCase();
    const pType = (post.productTypeName || "").toLowerCase();
    const pCat = (post.categoryName || "").toLowerCase();
    const pDesc = (post.description || "").toLowerCase();
    const pBrand = (post.brandName || "").toLowerCase();
    const pAddress =
      `${post.streetAddress || ""} ${post.ward || ""} ${post.city || ""}`.toLowerCase();

    if (pName.includes(q)) return 5;
    if (pType.includes(q)) return 4;
    if (pCat.includes(q)) return 3;
    if (pDesc.includes(q) || pBrand.includes(q)) return 2;
    if (pAddress.includes(q)) return 1;
    return 0;
  };

  const applyLocalSort = (data: any[], sortType: string) => {
    const uniqueData = Array.from(
      new Map(data.map((item) => [item.postId, item])).values(),
    );
    let sorted = [...uniqueData];

    if (sortType === "PriceAsc") {
      sorted.sort((a, b) => (a.basePrice || 0) - (b.basePrice || 0));
    } else if (sortType === "PriceDesc") {
      sorted.sort((a, b) => (b.basePrice || 0) - (a.basePrice || 0));
    } else if (sortType === "Newest") {
      sorted.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.createdDate || 0).getTime();
        const dateB = new Date(b.createdAt || b.createdDate || 0).getTime();
        return dateB - dateA;
      });
    } else if (sortType === "Relevance") {
      const q = query.trim();
      if (q)
        sorted.sort(
          (a, b) => getRelevanceScore(b, q) - getRelevanceScore(a, q),
        );
    }
    setSearchResults(sorted);
  };

  const executeSearch = async () => {
    Keyboard.dismiss();

    if (query.trim() !== "" && !history.includes(query)) {
      setHistory([query, ...history]);
    }
    setViewState("RESULTS");
    setIsLoading(true);

    let actualMinPrice = minPrice ? Number(minPrice) : null;
    let actualMaxPrice = maxPrice ? Number(maxPrice) : null;
    if (
      actualMinPrice !== null &&
      actualMaxPrice !== null &&
      actualMinPrice > actualMaxPrice
    ) {
      [actualMinPrice, actualMaxPrice] = [actualMaxPrice, actualMinPrice];
    }

    let actualMinUsage = minUsage ? Number(minUsage) : null;
    let actualMaxUsage = maxUsage ? Number(maxUsage) : null;
    if (
      actualMinUsage !== null &&
      actualMaxUsage !== null &&
      actualMinUsage > actualMaxUsage
    ) {
      [actualMinUsage, actualMaxUsage] = [actualMaxUsage, actualMinUsage];
    }

    let actualMinDamage = minDamage;
    let actualMaxDamage = maxDamage;
    if (
      actualMinDamage !== null &&
      actualMaxDamage !== null &&
      actualMinDamage > actualMaxDamage
    ) {
      [actualMinDamage, actualMaxDamage] = [actualMaxDamage, actualMinDamage];
    }

    try {
      const payload: any = {
        pageNumber: 1,
        pageSize: 100,
        onlyAvailable: onlyAvailable,
        attributeFilters: [],
      };

      if (query.trim()) payload.keyword = query.trim();
      if (postType) payload.postType = postType === "Bán" ? "Sell" : "Buy";
      if (selectedCat) payload.categoryId = selectedCat;

      if (selectedCondition)
        payload.functionalityStatus = CONDITION_MAP[selectedCondition];
      if (deliveryMethod) payload.deliveryMethod = DELIVERY_MAP[deliveryMethod];
      if (priorityLevel) payload.priorityLevel = PRIORITY_MAP[priorityLevel];

      if (actualMinPrice !== null) payload.minPrice = actualMinPrice;
      if (actualMaxPrice !== null) payload.maxPrice = actualMaxPrice;
      if (actualMinUsage !== null) payload.minUsageDuration = actualMinUsage;
      if (actualMaxUsage !== null) payload.maxUsageDuration = actualMaxUsage;
      if (actualMinDamage !== null) payload.minDamageLevel = actualMinDamage;
      if (actualMaxDamage !== null) payload.maxDamageLevel = actualMaxDamage;
      if (city) payload.city = city;

      const response = await apiClient.post("/posts/search", payload);
      const fetchedData =
        response.data?.data?.items ||
        response.data?.items ||
        response.data ||
        [];

      const activeData = fetchedData.filter(
        (post: any) => post.status === "Active",
      );

      setOriginalResults(activeData);
      applyLocalSort(activeData, sortBy);
    } catch (error: any) {
      console.error("❌ Lỗi khi tìm kiếm:", error);
      alert("Không thể kết nối đến máy chủ. Vui lòng thử lại!");
      setOriginalResults([]);
      setSearchResults([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSort = (type: string) => {
    setSortBy(type);
    applyLocalSort(originalResults, type);
  };

  const handlePriceSort = () => {
    const newSort = sortBy === "PriceAsc" ? "PriceDesc" : "PriceAsc";
    setSortBy(newSort);
    applyLocalSort(originalResults, newSort);
  };

  const resetFilters = () => {
    setSelectedCat(null);
    setQuery("");
    setSelectedCondition("");
    setSelectedSpace("");
    setDeliveryMethod("");
    setCity("");
    setCityCode(null);
    setPriorityLevel("");
    setMinPrice("");
    setMaxPrice("");
    setMinUsage("");
    setMaxUsage("");
    setMinDamage(null);
    setMaxDamage(null);
    setPostedWithinDays("");
    setOnlyAvailable(true);
    setPostType("");
    setSortBy("Relevance");
  };

  const formatPrice = (price: number) => {
    if (!price && price !== 0) return "Liên hệ";
    return price.toLocaleString("vi-VN") + " đ";
  };

  const getCoverImage = (post: any) => {
    if (post.medias && post.medias.length > 0)
      return { uri: post.medias[0].url || post.medias[0].mediaUrl };
    return {
      uri: "https://placehold.co/400x400/E2E8F0/94A3B8.png?text=No+Image",
    };
  };

  const getFullAddress = (post: any) => {
    return [post.streetAddress, post.ward, post.city]
      .filter(Boolean)
      .join(", ");
  };

  const getPriorityLabel = (level: string) => {
    switch (level) {
      case "Low":
        return "Ưu tiên Thấp";
      case "Medium":
        return "Bình thường";
      case "High":
        return "Bán gấp";
      case "Urgent":
        return "Khẩn cấp";
      default:
        return "";
    }
  };

  const getPriorityColor = (level: string) => {
    switch (level) {
      case "High":
        return "#F97316";
      case "Urgent":
        return "#EF4444";
      case "Low":
        return "#94A3B8";
      default:
        return "#10B981";
    }
  };

  const renderFilterBuilder = () => (
    <View style={styles.flex1}>
      <ScrollView
        style={styles.bodyContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.filterSectionTitle}>1. Thông tin cơ bản</Text>
        <Text style={styles.subLabel}>Loại bài đăng</Text>
        <View style={styles.chipContainer}>
          {POST_TYPES.map((type) => {
            const isActive = postType === type;
            return (
              <TouchableOpacity
                key={type}
                style={[styles.chip, isActive ? styles.chipActive : undefined]}
                onPress={() => setPostType(isActive ? "" : type)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isActive ? styles.chipTextActive : undefined,
                  ]}
                >
                  {type}
                </Text>
                {isActive && (
                  <Ionicons
                    name="close"
                    size={14}
                    color={COLORS.primary}
                    style={styles.chipCloseIcon}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.subLabel}>Danh mục sản phẩm</Text>
        <View style={styles.chipContainer}>
          {filterCategories.map((cat) => {
            const isActive = selectedCat === cat.categoryId;
            return (
              <TouchableOpacity
                key={cat.categoryId}
                style={[styles.chip, isActive ? styles.chipActive : undefined]}
                onPress={() => setSelectedCat(isActive ? null : cat.categoryId)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isActive ? styles.chipTextActive : undefined,
                  ]}
                >
                  {cat.categoryName}
                </Text>
                {isActive && (
                  <Ionicons
                    name="close"
                    size={14}
                    color={COLORS.primary}
                    style={styles.chipCloseIcon}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.filterSectionTitle}>2. Tình trạng & Giá cả</Text>
        <Text style={styles.subLabel}>Khoảng giá (VNĐ)</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.numberInput}
            placeholder="Giá 1"
            keyboardType="numeric"
            value={minPrice}
            onChangeText={setMinPrice}
          />
          <View style={styles.divider} />
          <TextInput
            style={styles.numberInput}
            placeholder="Giá 2"
            keyboardType="numeric"
            value={maxPrice}
            onChangeText={setMaxPrice}
          />
        </View>

        <Text style={styles.subLabel}>Thời gian sử dụng (Tháng)</Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.numberInput}
            placeholder="Số tháng"
            keyboardType="numeric"
            value={minUsage}
            onChangeText={setMinUsage}
          />
          <View style={styles.divider} />
          <TextInput
            style={styles.numberInput}
            placeholder="Số tháng"
            keyboardType="numeric"
            value={maxUsage}
            onChangeText={setMaxUsage}
          />
        </View>

        <Text style={styles.subLabel}>Mức độ hư hại</Text>
        <View style={styles.inputRow}>
          <TouchableOpacity
            style={styles.dropdownInput}
            onPress={() => setShowDamagePicker("min")}
          >
            <Text
              style={
                minDamage !== null
                  ? styles.dropdownText
                  : styles.dropdownPlaceholder
              }
              numberOfLines={1}
            >
              {minDamage !== null
                ? DAMAGE_LEVELS.find((d) => d.value === minDamage)?.label
                : "Mức độ 1"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color={COLORS.textLight}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
          <View style={styles.divider} />
          <TouchableOpacity
            style={styles.dropdownInput}
            onPress={() => setShowDamagePicker("max")}
          >
            <Text
              style={
                maxDamage !== null
                  ? styles.dropdownText
                  : styles.dropdownPlaceholder
              }
              numberOfLines={1}
            >
              {maxDamage !== null
                ? DAMAGE_LEVELS.find((d) => d.value === maxDamage)?.label
                : "Mức độ 2"}
            </Text>
            <Ionicons
              name="chevron-down"
              size={16}
              color={COLORS.textLight}
              style={{ marginLeft: 4 }}
            />
          </TouchableOpacity>
        </View>

        <Text style={styles.subLabel}>Trạng thái hoạt động</Text>
        <View style={styles.chipContainer}>
          {FILTER_CONDITIONS.map((cond) => {
            const isActive = selectedCondition === cond;
            return (
              <TouchableOpacity
                key={cond}
                style={[styles.chip, isActive ? styles.chipActive : undefined]}
                onPress={() => setSelectedCondition(isActive ? "" : cond)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isActive ? styles.chipTextActive : undefined,
                  ]}
                >
                  {cond}
                </Text>
                {isActive && (
                  <Ionicons
                    name="close"
                    size={14}
                    color={COLORS.primary}
                    style={styles.chipCloseIcon}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.filterSectionTitle}>3. Vận chuyển & Vị trí</Text>

        <View style={{ zIndex: 10 }}>
          <View
            style={[
              styles.autocompleteContainer,
              showCityDropdown ? styles.autocompleteContainerOpen : undefined,
            ]}
          >
            <TextInput
              style={[
                styles.input,
                Platform.OS === "web"
                  ? ({ outlineStyle: "none" } as any)
                  : undefined,
              ]}
              placeholder="Nhập hoặc Chọn Tỉnh/Thành phố..."
              placeholderTextColor="#94A3B8"
              value={city}
              onChangeText={(t) => {
                setCity(t);
                setShowCityDropdown(true);
                setCityCode(null);
              }}
              onFocus={() => setShowCityDropdown(true)}
            />
            {city ? (
              <TouchableOpacity
                onPress={() => {
                  setCity("");
                  setCityCode(null);
                  setShowCityDropdown(false);
                }}
                style={styles.clearIcon}
              >
                <Ionicons name="close-circle" size={20} color="#94A3B8" />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => setShowCityDropdown(!showCityDropdown)}
                style={styles.clearIcon}
              >
                <Ionicons
                  name={showCityDropdown ? "chevron-up" : "chevron-down"}
                  size={20}
                  color="#94A3B8"
                />
              </TouchableOpacity>
            )}
          </View>

          {showCityDropdown && (
            <View style={styles.dropdownList}>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 200 }}
              >
                {provincesList.filter((p) =>
                  p.label.toLowerCase().includes(city.toLowerCase()),
                ).length > 0 ? (
                  provincesList
                    .filter((p) =>
                      p.label.toLowerCase().includes(city.toLowerCase()),
                    )
                    .map((item) => (
                      <TouchableOpacity
                        key={item.value}
                        style={styles.dropdownItem}
                        onPress={() => {
                          setCity(item.label);
                          setCityCode(item.value);
                          setShowCityDropdown(false);
                        }}
                      >
                        <Text style={styles.dropdownItemText}>
                          {item.label}
                        </Text>
                        {city === item.label && (
                          <Ionicons
                            name="checkmark"
                            size={20}
                            color={COLORS.primary}
                          />
                        )}
                      </TouchableOpacity>
                    ))
                ) : (
                  <Text style={styles.noDataText}>
                    Không tìm thấy Tỉnh/Thành
                  </Text>
                )}
              </ScrollView>
            </View>
          )}
        </View>

        <Text style={styles.subLabel}>Phương thức giao hàng</Text>
        <View style={styles.chipContainer}>
          {DELIVERY_METHODS.map((method) => {
            const isActive = deliveryMethod === method;
            return (
              <TouchableOpacity
                key={method}
                style={[styles.chip, isActive ? styles.chipActive : undefined]}
                onPress={() => setDeliveryMethod(isActive ? "" : method)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isActive ? styles.chipTextActive : undefined,
                  ]}
                >
                  {method}
                </Text>
                {isActive && (
                  <Ionicons
                    name="close"
                    size={14}
                    color={COLORS.primary}
                    style={styles.chipCloseIcon}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.filterSectionTitle}>4. Tùy chọn khác</Text>

        <Text style={styles.subLabel}>Không gian sử dụng</Text>
        <View style={styles.chipContainer}>
          {FILTER_SPACES.map((space) => {
            const isActive = selectedSpace === space;
            return (
              <TouchableOpacity
                key={space}
                style={[styles.chip, isActive ? styles.chipActive : undefined]}
                onPress={() => setSelectedSpace(isActive ? "" : space)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isActive ? styles.chipTextActive : undefined,
                  ]}
                >
                  {space}
                </Text>
                {isActive && (
                  <Ionicons
                    name="close"
                    size={14}
                    color={COLORS.primary}
                    style={styles.chipCloseIcon}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.subLabel}>Mức độ cần bán (Ưu tiên)</Text>
        <View style={styles.chipContainer}>
          {PRIORITY_LEVELS.map((level) => {
            const isActive = priorityLevel === level;
            return (
              <TouchableOpacity
                key={level}
                style={[styles.chip, isActive ? styles.chipActive : undefined]}
                onPress={() => setPriorityLevel(isActive ? "" : level)}
              >
                <Text
                  style={[
                    styles.chipText,
                    isActive ? styles.chipTextActive : undefined,
                  ]}
                >
                  {level}
                </Text>
                {isActive && (
                  <Ionicons
                    name="close"
                    size={14}
                    color={COLORS.primary}
                    style={styles.chipCloseIcon}
                  />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View style={styles.footerAction}>
        <TouchableOpacity style={styles.resetBtn} onPress={resetFilters}>
          <Text style={styles.resetText}>Thiết lập lại</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.applyBtn}
          onPress={() => executeSearch()}
        >
          <Text style={styles.applyText}>Áp dụng tìm kiếm</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHistoryView = () => (
    <View style={styles.bodyContainer}>
      <Text style={styles.historyTitle}>Lịch sử tìm kiếm</Text>
      {history.map((item, index) => (
        <TouchableOpacity
          key={index}
          style={styles.historyItem}
          onPress={() => selectHistoryItem(item)}
        >
          <Ionicons name="time-outline" size={20} color={COLORS.textLight} />
          <Text style={styles.historyText}>{item}</Text>
          <TouchableOpacity
            onPress={() => setHistory(history.filter((h) => h !== item))}
            style={{ padding: 4 }}
          >
            <Ionicons name="close" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
        </TouchableOpacity>
      ))}
    </View>
  );

  const renderResultsView = () => (
    <View style={styles.flex1}>
      <View style={styles.sortBar}>
        <Text style={styles.resultSummaryText}>Lọc chi tiết</Text>
        <View style={styles.sortRightActions}>
          <TouchableOpacity
            onPress={() => setViewState("BUILDER")}
            style={styles.filterTriggerBtn}
          >
            <Ionicons name="filter" size={16} color={COLORS.primary} />
            <Text
              style={{
                fontSize: 13,
                color: COLORS.primary,
                fontWeight: "600",
                marginLeft: 4,
              }}
            >
              Bộ lọc
            </Text>
          </TouchableOpacity>
          <View style={styles.sortDivider} />
          <TouchableOpacity
            onPress={() => setIsGridView(!isGridView)}
            style={{ paddingHorizontal: 8 }}
          >
            <Ionicons
              name={isGridView ? "list" : "grid-outline"}
              size={20}
              color={COLORS.textLight}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        style={styles.resultsContainer}
        showsVerticalScrollIndicator={false}
      >
        {query.trim().length > 0 && !isLoading && (
          <View style={styles.categorySection}>
            <View style={styles.keywordHeader}>
              <Ionicons
                name="information-circle-outline"
                size={18}
                color={COLORS.textLight}
              />
              <Text style={styles.keywordHeaderText}>
                Kết quả tìm kiếm cho từ khoá '
                <Text style={{ color: COLORS.error, fontWeight: "bold" }}>
                  {query}
                </Text>
                '
              </Text>
            </View>
          </View>
        )}

        {!isLoading && searchResults.length > 0 && (
          <View style={styles.shopeeSortBar}>
            <Text style={styles.sortLabel}>Sắp xếp theo</Text>
            <TouchableOpacity
              style={
                sortBy === "Relevance" ? styles.sortBtnActive : styles.sortBtn
              }
              onPress={() => handleSort("Relevance")}
            >
              <Text
                style={
                  sortBy === "Relevance"
                    ? styles.sortBtnTextActive
                    : styles.sortBtnText
                }
              >
                Liên Quan
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={
                sortBy === "Newest" ? styles.sortBtnActive : styles.sortBtn
              }
              onPress={() => handleSort("Newest")}
            >
              <Text
                style={
                  sortBy === "Newest"
                    ? styles.sortBtnTextActive
                    : styles.sortBtnText
                }
              >
                Mới Nhất
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={
                sortBy.startsWith("Price")
                  ? styles.sortBtnActive
                  : styles.sortBtnDropdown
              }
              onPress={handlePriceSort}
            >
              <Text
                style={
                  sortBy.startsWith("Price")
                    ? styles.sortBtnTextActive
                    : styles.sortBtnText
                }
              >
                Giá{" "}
                {sortBy === "PriceAsc"
                  ? "↑"
                  : sortBy === "PriceDesc"
                    ? "↓"
                    : ""}
              </Text>
              {!sortBy.startsWith("Price") && (
                <Ionicons
                  name="chevron-down"
                  size={14}
                  color={COLORS.text}
                  style={{ marginLeft: 4 }}
                />
              )}
            </TouchableOpacity>
          </View>
        )}

        {isLoading ? (
          <View style={{ marginTop: 40, alignItems: "center" }}>
            <Text style={{ color: COLORS.textLight }}>Đang tìm kiếm...</Text>
          </View>
        ) : searchResults.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={64} color={COLORS.border} />
            <Text style={styles.emptyText}>
              Không tìm thấy sản phẩm nào phù hợp
            </Text>
          </View>
        ) : (
          <View
            style={[
              isGridView ? styles.gridContainer : styles.listContainer,
              { marginTop: 12 },
            ]}
          >
            {searchResults.map((post) => (
              <TouchableOpacity
                key={post.postId}
                style={isGridView ? styles.gridCard : styles.listCard}
                onPress={() => router.push(`/posts/${post.postId}` as any)}
                activeOpacity={0.8}
              >
                <View
                  style={
                    isGridView
                      ? styles.gridImageWrapper
                      : styles.listImageWrapper
                  }
                >
                  <Image
                    source={getCoverImage(post)}
                    style={styles.productImage}
                  />

                  <View style={styles.topBadgeRow}>
                    {post.categoryName ? (
                      <View style={styles.categoryBadge}>
                        <Text style={styles.categoryText}>
                          {post.categoryName}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                </View>
                <View
                  style={
                    isGridView ? styles.gridInfoWrapper : styles.listInfoWrapper
                  }
                >
                  {/* ĐƯA BRAND XUỐNG KHU VỰC TRẮNG NÀY ĐÂY */}
                  {post.brandName ? (
                    <View style={styles.brandBadgeWhite}>
                      <Text style={styles.brandBadgeTextWhite}>
                        {post.brandName}
                      </Text>
                    </View>
                  ) : null}

                  <Text style={styles.productName} numberOfLines={2}>
                    {post.productName || "Sản phẩm"}
                  </Text>

                  <View style={styles.priceRow}>
                    <Text style={styles.productPrice}>
                      {formatPrice(post.basePrice)}
                    </Text>
                    <Text style={styles.quantityText}>
                      SL: {post.remainingQuantity ?? post.quantity ?? 1}/
                      {post.quantity ?? 1}
                    </Text>
                  </View>

                  <View style={styles.footerRow}>
                    <View style={styles.locationContainer}>
                      <Ionicons
                        name="location-outline"
                        size={13}
                        color={COLORS.textLight}
                      />
                      <Text style={styles.locationText} numberOfLines={1}>
                        {getFullAddress(post) || "Chưa cập nhật"}
                      </Text>
                    </View>

                    {post.priorityLevel &&
                      post.priorityLevel !== "Medium" &&
                      post.priorityLevel !== "Low" && (
                        <Text
                          style={[
                            styles.priorityText,
                            { color: getPriorityColor(post.priorityLevel) },
                          ]}
                        >
                          {getPriorityLabel(post.priorityLevel)}
                        </Text>
                      )}
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

        <View
          style={[
            styles.searchBox,
            viewState === "RESULTS"
              ? { backgroundColor: "#F5F6F8", borderColor: "transparent" }
              : undefined,
          ]}
        >
          <Ionicons
            name="search"
            size={18}
            color={COLORS.textLight}
            style={{ marginLeft: 12 }}
          />
          <TextInput
            ref={inputRef}
            style={[
              styles.searchInput,
              Platform.OS === "web"
                ? ({ outlineStyle: "none" } as any)
                : undefined,
            ]}
            placeholder="Tìm theo tên, mô tả..."
            placeholderTextColor={COLORS.textLight}
            value={query}
            onChangeText={setQuery}
            onFocus={handleInputFocus}
            onSubmitEditing={() => {
              setViewState("BUILDER");
            }}
            returnKeyType="done"
          />
          {query.length > 0 && (
            <TouchableOpacity
              onPress={() => setQuery("")}
              style={{ paddingHorizontal: 12 }}
            >
              <Ionicons
                name="close-circle"
                size={18}
                color={COLORS.textLight}
              />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {viewState === "HISTORY" && renderHistoryView()}
      {viewState === "BUILDER" && renderFilterBuilder()}
      {viewState === "RESULTS" && renderResultsView()}

      {showDamagePicker !== null && (
        <Modal visible={true} transparent animationType="fade">
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => setShowDamagePicker(null)}
          >
            <View style={styles.pickerModalContent}>
              <View style={styles.modalDragIndicator} />
              <Text style={styles.actionModalTitle}>Chọn mức độ hư hại</Text>
              <TouchableOpacity
                style={styles.actionModalBtn}
                onPress={() => {
                  if (showDamagePicker === "min") setMinDamage(null);
                  else setMaxDamage(null);
                  setShowDamagePicker(null);
                }}
              >
                <Text
                  style={[styles.actionModalBtnText, { color: COLORS.error }]}
                >
                  Bỏ chọn
                </Text>
              </TouchableOpacity>
              {DAMAGE_LEVELS.map((item) => (
                <TouchableOpacity
                  key={item.value}
                  style={styles.actionModalBtn}
                  onPress={() => {
                    if (showDamagePicker === "min") setMinDamage(item.value);
                    else setMaxDamage(item.value);
                    setShowDamagePicker(null);
                  }}
                >
                  <Text style={styles.actionModalBtnText}>{item.label}</Text>
                  {((showDamagePicker === "min" && minDamage === item.value) ||
                    (showDamagePicker === "max" &&
                      maxDamage === item.value)) && (
                    <Ionicons
                      name="checkmark"
                      size={20}
                      color={COLORS.primary}
                    />
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </TouchableOpacity>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex1: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#F1F5F9" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  backBtn: { padding: 4, marginRight: 12 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    borderRadius: 8,
    height: 42,
    overflow: "hidden",
  },
  searchInput: {
    flex: 1,
    height: "100%",
    paddingLeft: 8,
    fontSize: 14,
    color: COLORS.text,
  },

  bodyContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: COLORS.white,
  },
  historyTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 16,
  },
  historyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  historyText: { flex: 1, fontSize: 14, color: COLORS.text, marginLeft: 12 },

  filterSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.text,
    marginTop: 24,
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.textLight,
    marginTop: 12,
    marginBottom: 8,
  },
  chipContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: COLORS.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  chipActive: { backgroundColor: "#E9F0F0", borderColor: COLORS.primary },
  chipText: { fontSize: 13, color: COLORS.textLight, fontWeight: "500" },
  chipTextActive: { color: COLORS.primary, fontWeight: "700" },
  chipCloseIcon: { marginLeft: 4 },

  inputRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  numberInput: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    textAlign: "center",
    fontSize: 14,
    color: COLORS.text,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  divider: { width: 12, height: 2, backgroundColor: COLORS.border },

  autocompleteContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 46,
    backgroundColor: "#F8FAFC",
    marginBottom: 16,
    overflow: "hidden",
  },
  autocompleteContainerOpen: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    marginBottom: 0,
  },
  dropdownList: {
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    marginBottom: 16,
    overflow: "hidden",
    maxHeight: 200,
  },
  dropdownItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  dropdownItemText: { fontSize: 14, color: COLORS.text, flex: 1 },
  noDataText: {
    padding: 12,
    textAlign: "center",
    color: "#94A3B8",
    fontSize: 13,
  },

  input: {
    flex: 1,
    fontSize: 14,
    color: COLORS.text,
    height: "100%",
    minWidth: 0,
  },
  inputText: { flex: 1, fontSize: 14, color: COLORS.text },
  placeholderText: { flex: 1, fontSize: 14, color: "#94A3B8" },
  clearIcon: { padding: 4, marginRight: -4 },

  dropdownInput: {
    flex: 1,
    height: 44,
    backgroundColor: COLORS.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    overflow: "hidden",
  },
  dropdownText: { fontSize: 13, color: COLORS.text, flex: 1 },
  dropdownPlaceholder: { fontSize: 13, color: COLORS.textLight, flex: 1 },

  footerAction: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    padding: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
    gap: 12,
    elevation: 10,
  },
  resetBtn: {
    flex: 1,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  resetText: { fontSize: 15, fontWeight: "bold", color: COLORS.text },
  applyBtn: {
    flex: 2,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  applyText: { fontSize: 15, fontWeight: "bold", color: COLORS.white },

  resultsContainer: { flex: 1, backgroundColor: "#F8F9FA" },
  sortBar: {
    flexDirection: "row",
    height: 44,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  resultSummaryText: {
    fontSize: 13,
    color: COLORS.textLight,
    fontWeight: "500",
  },
  sortRightActions: { flexDirection: "row", alignItems: "center" },
  filterTriggerBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#E9F0F0",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  sortDivider: {
    width: 1,
    height: 20,
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },

  categorySection: {
    backgroundColor: COLORS.white,
    padding: 16,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  keywordHeader: { flexDirection: "row", alignItems: "center", marginTop: 8 },
  keywordHeaderText: { fontSize: 14, color: COLORS.text, marginLeft: 6 },

  shopeeSortBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  sortLabel: { fontSize: 13, color: COLORS.textLight, marginRight: 12 },
  sortBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
    borderRadius: 4,
    marginRight: 8,
  },
  sortBtnActive: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.primary,
    borderRadius: 4,
    marginRight: 8,
  },
  sortBtnText: { fontSize: 13, color: COLORS.text },
  sortBtnTextActive: { fontSize: 13, color: COLORS.white, fontWeight: "bold" },
  sortBtnDropdown: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.background,
    borderRadius: 4,
  },

  emptyState: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 40,
  },
  emptyText: { marginTop: 12, color: COLORS.textLight, fontSize: 14 },

  gridContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    justifyContent: "space-between",
  },
  gridCard: {
    backgroundColor: COLORS.white,
    width: "48%",
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#EEF0F2",
  },
  gridImageWrapper: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: "#FAFAFA",
    position: "relative",
  },
  gridInfoWrapper: { padding: 10 },
  listContainer: { paddingHorizontal: 16 },
  listCard: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EEF0F2",
  },
  listImageWrapper: {
    width: 90,
    height: 90,
    borderRadius: 8,
    overflow: "hidden",
    position: "relative",
  },
  listInfoWrapper: { flex: 1, marginLeft: 12, justifyContent: "space-between" },
  productImage: { width: "100%", height: "100%" },

  topBadgeRow: {
    position: "absolute",
    top: 6,
    left: 6,
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
    right: 6,
  },
  categoryBadge: {
    backgroundColor: "rgba(51, 65, 85, 0.9)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
  },
  categoryText: { color: COLORS.white, fontSize: 9, fontWeight: "bold" },

  // STYLE CHO BRAND DƯỚI NỀN TRẮNG
  brandBadgeWhite: {
    alignSelf: "flex-start",
    backgroundColor: "#F1F5F9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    marginBottom: 4,
  },
  brandBadgeTextWhite: {
    color: "#475569",
    fontSize: 10,
    fontWeight: "bold",
  },

  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  quantityText: { fontSize: 11, color: COLORS.textLight, fontWeight: "600" },
  footerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  priorityText: { fontSize: 10, fontWeight: "bold" },

  productName: {
    fontSize: 13,
    color: COLORS.text,
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 6,
    height: 36,
  },
  productPrice: { fontSize: 14, fontWeight: "bold", color: COLORS.error },
  locationContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  locationText: { fontSize: 11, color: COLORS.textLight, flex: 1 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  pickerModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalDragIndicator: {
    width: 40,
    height: 4,
    backgroundColor: "#E2E8F0",
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 16,
  },
  actionModalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 20,
    textAlign: "center",
  },
  actionModalBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  actionModalBtnText: { fontSize: 15, color: COLORS.text, fontWeight: "500" },
});
