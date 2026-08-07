import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  KeyboardAvoidingView,
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
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { postApi } from "../../src/services/apis/postApi";

// ================= CONSTANTS =================
const SPACE_USAGE_OPTIONS = [
  { label: "Phòng khách", value: "Living_room" },
  { label: "Nhà bếp", value: "Kitchen" },
  { label: "Phòng ngủ", value: "Bedroom" },
  { label: "Phòng tắm", value: "Bathroom" },
  { label: "Phòng giặt", value: "Laundry_room" },
  { label: "Ban công", value: "Balcony" },
  { label: "Garage", value: "Garage" },
  { label: "Nhà vệ sinh", value: "Restroom" },
];
const DAMAGE_LEVEL_OPTIONS = [
  { label: "Không hư hại (Như mới)", value: "None" },
  { label: "Trầy xước ngoại hình", value: "Cosmetic_Damage" },
  { label: "Hư hỏng nhẹ", value: "Minor_Damage" },
  { label: "Hư hỏng vừa", value: "Moderate_Damage" },
  { label: "Hư hỏng nặng", value: "Severe_Damage" },
  { label: "Mất hoàn toàn chức năng", value: "Total_Loss" },
];
const FUNC_STATUS_OPTIONS = [
  { label: "Hoạt động hoàn hảo", value: "FullyFunctional" },
  { label: "Hoạt động một phần", value: "PartiallyFunctional" },
  { label: "Không hoạt động", value: "NonFunctional" },
];
const DELIVERY_OPTIONS = [
  { label: "Chưa xác định", value: "Unknown" },
  { label: "Giao hàng (GHN)", value: "GhnDelivery" },
  { label: "Người bán tự giao", value: "SellerDelivers" },
  { label: "Người mua đến lấy", value: "BuyerPickUp" },
];
const PRIORITY_OPTIONS = [
  { label: "Ưu tiên Thấp", value: "Low" },
  { label: "Bình thường", value: "Medium" },
  { label: "Bán gấp", value: "High" },
  { label: "Khẩn cấp", value: "Urgent" },
];

export default function PostFormScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || "personal";

  const { editId, postType: urlPostType } = useLocalSearchParams();
  const isEditMode = !!editId;

  // Xác định xem đây là luồng Đăng tin mua hay bán
  const isBuyPost = urlPostType === "Buy" || (!urlPostType && userRole === "business");

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingOldData, setIsFetchingOldData] = useState(false);

  const [images, setImages] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [allProductTypes, setAllProductTypes] = useState<any[]>([]);
  const [filteredProductTypes, setFilteredProductTypes] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);

  const [eavAttributes, setEavAttributes] = useState<any[]>([]);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [oldEavData, setOldEavData] = useState<any[]>([]);

  // === FORM STATES ===
  const [productName, setProductName] = useState("");
  const [description, setDescription] = useState("");
  const [detailDescription, setDetailDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedProductType, setSelectedProductType] = useState<string>("");
  const [brandId, setBrandId] = useState("");
  const [modelNumber, setModelNumber] = useState("");

  const [length, setLength] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [showDimensionsModal, setShowDimensionsModal] = useState(false);

  const [weight, setWeight] = useState("");
  const [functionalityStatus, setFunctionalityStatus] = useState("");
  const [usageDuration, setUsageDuration] = useState("");
  const [damageLevel, setDamageLevel] = useState("");
  const [spaceUsage, setSpaceUsage] = useState("");

  const [basePrice, setBasePrice] = useState("");
  const [originalPrice, setOriginalPrice] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [expiryDays, setExpiryDays] = useState("30");
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [priorityLevel, setPriorityLevel] = useState("");

  // ====== ĐỊA CHỈ ======
  const [city, setCity] = useState("");
  const [ward, setWard] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [showAddressModal, setShowAddressModal] = useState(false);

  const [provinces, setProvinces] = useState<{ label: string; value: string }[]>([]);
  const [wardsList, setWardsList] = useState<{ label: string; value: string }[]>([]);
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showWardDropdown, setShowWardDropdown] = useState(false);

  // Fetch Danh sách Tỉnh/Thành
  useEffect(() => {
    fetch("https://34tinhthanh.com/api/provinces")
      .then((res) => res.json())
      .then((data) => {
        setProvinces(data.map((p: any) => ({ label: p.name, value: p.province_code })));
      })
      .catch((err) => console.error("Lỗi tải Tỉnh/Thành:", err));
  }, []);

  // Fetch Phường/Xã
  useEffect(() => {
    if (city && provinces.length > 0) {
      const selectedProv = provinces.find((p) => p.label.toLowerCase().includes(city.toLowerCase()));
      if (selectedProv) {
        fetch(`https://34tinhthanh.com/api/wards?province_code=${selectedProv.value}`)
          .then((res) => res.json())
          .then((data) => {
            const uniqueWards = Array.from(new Set(data.map((w: any) => w.ward_name)))
              .map((name) => ({ label: name as string, value: name as string }));
            setWardsList(uniqueWards);
          })
          .catch((err) => console.error("Lỗi tải Phường/Xã:", err));
      }
    } else {
      setWardsList([]);
    }
  }, [city, provinces]);

  // ================= MODAL CHỌN DROPDOWN =================
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalOptions, setModalOptions] = useState<{ label: string; value: string }[]>([]);
  const currentSelectSetterRef = useRef<((val: string) => void) | null>(null);

  const openSelect = (title: string, options: { label: string; value: string }[], setter: (val: string) => void) => {
    setModalTitle(title);
    setModalOptions(options);
    currentSelectSetterRef.current = setter;
    setShowSelectModal(true);
  };
  const handleSelectOption = (value: string) => {
    if (currentSelectSetterRef.current) currentSelectSetterRef.current(value);
    setShowSelectModal(false);
  };
  const getLabel = (value: string, options: { label: string; value: string }[]) => {
    const found = options.find((o) => o.value === value);
    return found ? found.label : value;
  };

  // 1. TẢI MASTER DATA
  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [catRes, ptRes, brandRes] = await Promise.all([
          postApi.getActiveCategories(), // <=== ĐÃ ĐỔI THÀNH API ACTIVE
          postApi.getAllProductTypes(),
          postApi.getAllBrands(),
        ]);
        
        // Xử lý linh hoạt format trả về của API Active Categories
        const catList = catRes?.items || catRes?.data?.items || catRes?.data || (Array.isArray(catRes) ? catRes : []);
        setCategories(
          catList.map((c: any) => ({
            label: c.categoryName,
            value: c.categoryId,
          }))
        );

        if (ptRes?.data?.items) setAllProductTypes(ptRes.data.items.map((pt: any) => ({ label: pt.productTypeName, value: pt.productTypeId, categoryId: pt.categoryId })));
        
        const brandList = brandRes?.data?.items || brandRes?.data || [];
        if (Array.isArray(brandList)) setBrands(brandList.map((b: any) => ({ label: b.brandName || b.name, value: b.brandId || b.id })));
      } catch (error) {
        console.error("Lỗi lấy Master Data:", error);
      }
    };
    fetchMasterData();
  }, []);

  // 2. TẢI DỮ LIỆU CŨ VÀO FORM (KHI EDIT)
  useEffect(() => {
    if (!isEditMode) return;
    const loadOldData = async () => {
      setIsFetchingOldData(true);
      try {
        const res = await postApi.getPostById(editId as string);
        const data = res?.data || res;
        
        // Hỗ trợ cả 2 object Product (bán) hoặc Requirement (mua)
        const p = data.product || data.requirement || {};

        setProductName(data.productName || p.productName || "");
        setDescription(data.description || "");
        
        // Lấy giá tùy theo loại bài đăng
        setBasePrice(data.basePrice?.toString() || data.expectedPrice?.toString() || p.expectedPrice?.toString() || "");
        
        setQuantity(data.quantity?.toString() || "1");
        setCity(data.city || "");
        setWard(data.ward || "");
        setStreetAddress(data.streetAddress || "");
        setDeliveryMethod(data.deliveryMethod || "");
        setPriorityLevel(data.priorityLevel || "");

        setSelectedCategory(p.categoryId || "");
        setSelectedProductType(p.productTypeId || "");
        setBrandId(p.brandId || "");
        setModelNumber(p.modelNumber || "");
        setOriginalPrice(p.originalPrice?.toString() || "");
        setDetailDescription(p.detailDescription || "");
        setWeight(p.weight?.toString() || "");
        setUsageDuration(p.usageDuration?.toString() || "");
        setSpaceUsage(p.spaceUsage || "");
        setFunctionalityStatus(p.functionalityStatus || "");
        setDamageLevel(p.damageLevel || "");
        setLength(p.length?.toString() || "");
        setWidth(p.width?.toString() || "");
        setHeight(p.height?.toString() || "");

        if (data.medias && data.medias.length > 0) {
          setImages(data.medias.map((m: any) => m.url || m.mediaUrl));
        }

        if (p.attributeValues && Array.isArray(p.attributeValues)) {
          setOldEavData(p.attributeValues);
        }
      } catch (error) {
        console.error("Lỗi tải dữ liệu cũ:", error);
      } finally {
        setIsFetchingOldData(false);
      }
    };
    loadOldData();
  }, [editId]);

  // 3. LỌC PRODUCT TYPE
  useEffect(() => {
    if (selectedCategory) {
      setFilteredProductTypes(allProductTypes.filter((pt) => pt.categoryId === selectedCategory));
    } else {
      setFilteredProductTypes([]);
    }
  }, [selectedCategory, allProductTypes]);

  // 4. TẢI DYNAMIC SCHEMA EAV
  useEffect(() => {
    const fetchDynamicSchema = async () => {
      if (!selectedProductType) {
        setEavAttributes([]);
        return;
      }
      try {
        setIsLoadingSchema(true);
        const res = await postApi.getAttributesByProductType(selectedProductType);
        const schemaData = res?.data || [];

        const initializedEav = schemaData.map((attr: any) => {
          const oldVal = oldEavData.find((old) => old.attributeId === attr.attributeId);
          let initBool = null;
          if (oldVal && oldVal.valueBoolean !== null && oldVal.valueBoolean !== undefined) {
            initBool = oldVal.valueBoolean === "true" || oldVal.valueBoolean === true;
          }
          return {
            ...attr,
            selectedOptionId: oldVal ? oldVal.optionId || "" : "",
            valueBoolean: initBool,
            valueText: oldVal ? oldVal.valueText || "" : "",
            valueNumber: oldVal ? oldVal.valueNumber?.toString() || "" : "",
          };
        });

        initializedEav.sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));
        setEavAttributes(initializedEav);
      } catch (error) {
        console.error("Lỗi lấy Schema EAV:", error);
      } finally {
        setIsLoadingSchema(false);
      }
    };
    fetchDynamicSchema();
  }, [selectedProductType, oldEavData]);

  const displayDimensions = length && width && height ? `${length} x ${width} x ${height} cm` : "";
  const displayAddress = [streetAddress, ward, city].filter(Boolean).join(", ");

  const pickImages = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: 10 - images.length,
      quality: 0.8,
    });
    if (!result.canceled) setImages((prev) => [...prev, ...result.assets.map((a) => a.uri)]);
  };
  const removeImage = (indexToRemove: number) => setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));

  const updateEavValue = (index: number, field: string, value: any) => {
    setEavAttributes((prev) => {
      const newArr = [...prev];
      newArr[index] = { ...newArr[index], [field]: value };
      return newArr;
    });
  };

  // ================= SUBMIT =================
  const handlePublish = async () => {
    if (!productName || !basePrice || images.length === 0) {
      alert("Vui lòng điền tên sản phẩm, giá và chọn ít nhất 1 ảnh!");
      return;
    }

    try {
      setIsLoading(true);
      const formData = new FormData();

      // CÁC TRƯỜNG CHUNG Ở ROOT
      formData.append("Quantity", quantity);
      if (description) formData.append("Description", description);

      // CHỈ TÍNH TOÁN VÀ GỬI EXPIRY DATE NẾU LÀ TIN BÁN (Vì API tin mua không có ExpiryDate)
      if (!isBuyPost) {
        const days = parseInt(expiryDays) || 30;
        const expiryDateObj = new Date();
        expiryDateObj.setDate(expiryDateObj.getDate() + days);
        formData.append("ExpiryDate", expiryDateObj.toISOString());
      }
      
      if (city) formData.append("City", city);
      if (ward) formData.append("Ward", ward);
      if (streetAddress) formData.append("StreetAddress", streetAddress);
      if (deliveryMethod) formData.append("DeliveryMethod", deliveryMethod);
      if (priorityLevel) formData.append("PriorityLevel", priorityLevel);

      // TIỀN TỐ TÙY THUỘC VÀO LOẠI BÀI ĐĂNG (Product vs Requirement)
      const prefix = isBuyPost ? "Requirement" : "Product";

      if (isBuyPost) {
        formData.append("ExpectedPrice", basePrice); // Cả ở root
        formData.append(`${prefix}.ExpectedPrice`, basePrice); // Cả trong Requirement theo Swagger
      } else {
        formData.append("BasePrice", basePrice);
      }

      formData.append(`${prefix}.ProductName`, productName);
      if (selectedCategory) formData.append(`${prefix}.CategoryId`, selectedCategory);
      if (selectedProductType) formData.append(`${prefix}.ProductTypeId`, selectedProductType);
      if (brandId) formData.append(`${prefix}.BrandId`, brandId);

      if (spaceUsage) formData.append(`${prefix}.SpaceUsage`, spaceUsage);
      if (functionalityStatus) formData.append(`${prefix}.FunctionalityStatus`, functionalityStatus);
      if (usageDuration) formData.append(`${prefix}.UsageDuration`, usageDuration);
      if (damageLevel) formData.append(`${prefix}.DamageLevel`, damageLevel);

      // CÁC TRƯỜNG CHỈ CÓ Ở BÀI BÁN (Product)
      if (!isBuyPost) {
        if (modelNumber) formData.append(`${prefix}.ModelNumber`, modelNumber);
        if (originalPrice) formData.append(`${prefix}.OriginalPrice`, originalPrice);
        if (detailDescription) formData.append(`${prefix}.DetailDescription`, detailDescription);
        if (weight) formData.append(`${prefix}.Weight`, weight);
        if (length) formData.append(`${prefix}.Length`, length);
        if (width) formData.append(`${prefix}.Width`, width);
        if (height) formData.append(`${prefix}.Height`, height);
      }

      // ================= ĐÓNG GÓI PAYLOAD EAV =================
      eavAttributes.forEach((attr) => {
        const hasOption = !!attr.selectedOptionId;
        const hasText = !!attr.valueText;
        const hasNumber = !!attr.valueNumber;
        const hasBool = attr.valueBoolean !== null && attr.valueBoolean !== undefined;

        if (!hasOption && !hasText && !hasNumber && !hasBool && !attr.isRequired) return;

        const item: any = { attributeId: attr.attributeId };
        if (hasOption) item.optionId = attr.selectedOptionId;
        else if (hasBool) item.valueBoolean = attr.valueBoolean;
        else if (hasNumber) item.valueNumber = Number(attr.valueNumber);
        else if (hasText) item.valueText = attr.valueText;

        formData.append(`${prefix}.AttributeValues`, JSON.stringify(item));
      });

      // ================= ĐÓNG GÓI ẢNH =================
      await Promise.all(
        images.map(async (imageUri, index) => {
          if (imageUri.startsWith("http")) return;

          let filename = imageUri.split("/").pop()?.split("?")[0] || `image_${index}.jpg`;
          if (!filename.includes(".")) filename = `${filename}.jpg`;

          const match = /\.(\w+)$/.exec(filename.toLowerCase());
          let type = match ? `image/${match[1]}` : `image/jpeg`;
          if (type === "image/jpg") type = "image/jpeg";

          if (Platform.OS === "web") {
            const response = await fetch(imageUri);
            const blob = await response.blob();
            formData.append("Medias", blob, filename);
          } else {
            formData.append("Medias", {
              uri: Platform.OS === "ios" ? imageUri.replace("file://", "") : imageUri,
              name: filename,
              type: type,
            } as any);
          }
        }),
      );

      // ================= GỌI API =================
      if (isEditMode) {
        if (isBuyPost) await postApi.updateBuyPost(editId as string, formData);
        else await postApi.updateSellPost(editId as string, formData);
        alert("Cập nhật tin đăng thành công!");
      } else {
        if (isBuyPost) await postApi.createBuyPost(formData);
        else await postApi.createSellPost(formData);
        alert("Đã gửi yêu cầu tạo tin thành công!");
      }
      router.back();
    } catch (error: any) {
      console.error("Lỗi form:", error);
      alert(error.response?.data?.message || "Có lỗi xảy ra, vui lòng thử lại!");
    } finally {
      setIsLoading(false);
    }
  };

  const SectionTitle = ({ title }: { title: string }) => (
    <View style={styles.sectionTitleContainer}>
      <View style={styles.sectionTitleBar} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );

  if (isFetchingOldData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 12, color: COLORS.textLight }}>Đang tải thông tin bài viết...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditMode ? "Sửa tin đăng" : (isBuyPost ? "Đăng tin thu mua" : "Đăng tin mới")}
          </Text>
          <TouchableOpacity onPress={handlePublish} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={styles.publishButtonText}>{isEditMode ? "Cập nhật" : "Đăng"}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          <View style={styles.cardSection}>
            <Text style={styles.label}>
              {isBuyPost ? "Hình ảnh minh họa yêu cầu" : "Hình ảnh sản phẩm"}{" "}
              <Text style={styles.required}>* (2-10 ảnh)</Text>
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageScroll}>
              <TouchableOpacity style={styles.addImageBox} onPress={pickImages}>
                <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
                <Text style={styles.addImageText}>Thêm ảnh</Text>
              </TouchableOpacity>
              {images.map((uri, index) => (
                <View key={index} style={styles.imagePreviewWrapper}>
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => removeImage(index)}>
                    <Ionicons name="close-circle" size={22} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          </View>

          <View style={styles.cardSection}>
            <SectionTitle title="THÔNG TIN CƠ BẢN" />
            <Text style={styles.label}>
              Tên sản phẩm <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]}
                placeholder={isBuyPost ? "VD: Cần mua tủ lạnh cũ..." : "Nhập tiêu đề sản phẩm..."}
                placeholderTextColor="#94A3B8"
                value={productName}
                onChangeText={setProductName}
              />
            </View>

            <Text style={styles.label}>Mô tả bài đăng (Ngắn gọn)</Text>
            <View style={[styles.inputContainer, { height: 80, alignItems: "flex-start", paddingTop: 12 }]}>
              <TextInput
                style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]}
                multiline
                placeholder={isBuyPost ? "VD: Cần mua gấp số lượng lớn..." : "VD: Cần pass gấp tủ lạnh vì chuyển trọ..."}
                placeholderTextColor="#94A3B8"
                value={description}
                onChangeText={setDescription}
              />
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Phân loại <Text style={styles.required}>*</Text></Text>
                <TouchableOpacity style={styles.inputContainer} onPress={() => openSelect("Chọn Phân loại", categories, setSelectedCategory)}>
                  <Text style={selectedCategory ? styles.inputText : styles.placeholderText} numberOfLines={1}>
                    {selectedCategory ? getLabel(selectedCategory, categories) : "Chọn..."}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Loại sản phẩm <Text style={styles.required}>*</Text></Text>
                <TouchableOpacity style={styles.inputContainer} onPress={() => openSelect("Chọn Loại Sản Phẩm", filteredProductTypes, setSelectedProductType)}>
                  <Text style={selectedProductType ? styles.inputText : styles.placeholderText} numberOfLines={1}>
                    {selectedProductType ? getLabel(selectedProductType, filteredProductTypes) : "Chọn..."}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Thương hiệu <Text style={styles.required}>*</Text></Text>
                <TouchableOpacity style={styles.inputContainer} onPress={() => openSelect("Chọn Thương hiệu", brands, setBrandId)}>
                  <Text style={brandId ? styles.inputText : styles.placeholderText} numberOfLines={1}>
                    {brandId ? getLabel(brandId, brands) : "Chọn..."}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
              
              {!isBuyPost && (
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Mã Model</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]}
                      placeholder="VD: RT38K5982BS"
                      placeholderTextColor="#94A3B8"
                      value={modelNumber}
                      onChangeText={setModelNumber}
                    />
                  </View>
                </View>
              )}
            </View>

            {!isBuyPost && (
              <>
                <Text style={styles.label}>Mô tả chi tiết sản phẩm <Text style={styles.required}>*</Text></Text>
                <View style={[styles.inputContainer, { height: 100, alignItems: "flex-start", paddingTop: 12 }]}>
                  <TextInput
                    style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]}
                    multiline
                    placeholder="Mô tả tình trạng, đặc điểm nổi bật của máy..."
                    placeholderTextColor="#94A3B8"
                    value={detailDescription}
                    onChangeText={setDetailDescription}
                  />
                </View>
              </>
            )}
          </View>

          {selectedProductType && (
            <View style={styles.cardSection}>
              <SectionTitle title="THÔNG SỐ KỸ THUẬT" />
              {isLoadingSchema ? <ActivityIndicator color={COLORS.primary} style={{ padding: 20 }} /> : null}

              {eavAttributes.map((attr, index) => {
                if (attr.inputMode === null) return null;
                const isOptionAllowed = String(attr.inputMode).includes("Option");
                const isCustomAllowed = String(attr.inputMode).includes("Custom") || String(attr.inputMode).includes("OptionOrCustom");
                const optionList = attr.options?.map((o: any) => ({ label: o.optionValue, value: o.optionId })) || [];

                return (
                  <View key={attr.attributeId} style={styles.rawBlock}>
                    <Text style={styles.rawLabel}>
                      {attr.attributeName} {attr.unit ? ` (${attr.unit})` : ""}
                      {attr.isRequired ? <Text style={styles.required}> *</Text> : null}
                    </Text>

                    {isOptionAllowed && (
                      <TouchableOpacity style={styles.rawDropdownContainer} onPress={() => openSelect(`Chọn ${attr.attributeName}`, optionList, (val) => updateEavValue(index, "selectedOptionId", val))}>
                        <Text style={attr.selectedOptionId ? styles.inputText : styles.placeholderText} numberOfLines={1}>
                          {attr.selectedOptionId ? getLabel(attr.selectedOptionId, optionList) : `Chọn...`}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                      </TouchableOpacity>
                    )}

                    {isCustomAllowed && (
                      <View style={{ gap: 12 }}>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          <TouchableOpacity style={[styles.boolBtn, attr.valueBoolean === true && styles.boolBtnActive]} onPress={() => updateEavValue(index, "valueBoolean", true)}>
                            <Ionicons name="checkmark-circle-outline" size={18} color={attr.valueBoolean === true ? COLORS.white : "#64748B"} />
                            <Text style={[styles.boolBtnText, attr.valueBoolean === true && { color: COLORS.white }]}>Có / Bật</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.boolBtn, attr.valueBoolean === false && styles.boolBtnActiveRed]} onPress={() => updateEavValue(index, "valueBoolean", false)}>
                            <Ionicons name="close-circle-outline" size={18} color={attr.valueBoolean === false ? COLORS.white : "#64748B"} />
                            <Text style={[styles.boolBtnText, attr.valueBoolean === false && { color: COLORS.white }]}>Không / Tắt</Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.rawInputContainer}>
                          <TextInput style={[styles.rawInput, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} placeholder="Nhập chữ tự do..." placeholderTextColor="#94A3B8" value={attr.valueText} onChangeText={(text) => updateEavValue(index, "valueText", text)} />
                        </View>
                        <View style={styles.rawInputContainer}>
                          <TextInput style={[styles.rawInput, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} placeholder={`Nhập số... ${attr.unit ? `(${attr.unit})` : ""}`} placeholderTextColor="#94A3B8" keyboardType="numeric" value={attr.valueNumber} onChangeText={(text) => updateEavValue(index, "valueNumber", text)} />
                          {attr.unit && <Text style={{ color: "#94A3B8", fontSize: 13, marginLeft: 8 }}>{attr.unit}</Text>}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.cardSection}>
            <SectionTitle title="TÌNH TRẠNG CHUNG" />
            
            {!isBuyPost && (
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Kích thước (DxRxC)</Text>
                  <TouchableOpacity style={styles.inputContainer} onPress={() => setShowDimensionsModal(true)}>
                    <Text style={displayDimensions ? styles.inputText : styles.placeholderText} numberOfLines={1}>{displayDimensions || "VD: 120 x 60 x 80 cm"}</Text>
                    {displayDimensions ? <TouchableOpacity onPress={() => { setLength(""); setWidth(""); setHeight(""); }} style={styles.clearIcon}><Ionicons name="close-circle" size={20} color="#94A3B8" /></TouchableOpacity> : <Ionicons name="chevron-down" size={20} color="#94A3B8" />}
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Cân nặng (kg)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} keyboardType="numeric" placeholder="VD: 15" placeholderTextColor="#94A3B8" value={weight} onChangeText={setWeight} />
                  </View>
                </View>
              </View>
            )}

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Không gian dùng</Text>
                <TouchableOpacity style={styles.inputContainer} onPress={() => openSelect("Chọn Không Gian Dùng", SPACE_USAGE_OPTIONS, setSpaceUsage)}>
                  <Text style={spaceUsage ? styles.inputText : styles.placeholderText} numberOfLines={1}>{spaceUsage ? getLabel(spaceUsage, SPACE_USAGE_OPTIONS) : "Chọn..."}</Text>
                  {spaceUsage ? <TouchableOpacity onPress={() => setSpaceUsage("")} style={styles.clearIcon}><Ionicons name="close-circle" size={20} color="#94A3B8" /></TouchableOpacity> : <Ionicons name="chevron-down" size={20} color="#94A3B8" />}
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Mức độ hư hại</Text>
                <TouchableOpacity style={styles.inputContainer} onPress={() => openSelect("Mức Độ Hư Hại", DAMAGE_LEVEL_OPTIONS, setDamageLevel)}>
                  <Text style={damageLevel ? styles.inputText : styles.placeholderText} numberOfLines={1}>{damageLevel ? getLabel(damageLevel, DAMAGE_LEVEL_OPTIONS) : "Chọn..."}</Text>
                  {damageLevel ? <TouchableOpacity onPress={() => setDamageLevel("")} style={styles.clearIcon}><Ionicons name="close-circle" size={20} color="#94A3B8" /></TouchableOpacity> : <Ionicons name="chevron-down" size={20} color="#94A3B8" />}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Tình trạng HĐ <Text style={styles.required}>*</Text></Text>
                <TouchableOpacity style={styles.inputContainer} onPress={() => openSelect("Tình Trạng Hoạt Động", FUNC_STATUS_OPTIONS, setFunctionalityStatus)}>
                  <Text style={functionalityStatus ? styles.inputText : styles.placeholderText} numberOfLines={1}>{functionalityStatus ? getLabel(functionalityStatus, FUNC_STATUS_OPTIONS) : "Chọn..."}</Text>
                  {functionalityStatus ? <TouchableOpacity onPress={() => setFunctionalityStatus("")} style={styles.clearIcon}><Ionicons name="close-circle" size={20} color="#94A3B8" /></TouchableOpacity> : <Ionicons name="chevron-down" size={20} color="#94A3B8" />}
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Thời gian SD (Năm)<Text style={styles.required}>*</Text></Text>
                <View style={styles.inputContainer}>
                  <TextInput style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} keyboardType="numeric" placeholder="VD: 2" placeholderTextColor="#94A3B8" value={usageDuration} onChangeText={setUsageDuration} />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.cardSection}>
            <SectionTitle title="GIAO DỊCH & MỨC GIÁ" />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>{isBuyPost ? "Giá thu mua dự kiến" : "Giá mong muốn"} <Text style={styles.required}>*</Text></Text>
                <View style={styles.inputContainer}>
                  <TextInput style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} keyboardType="numeric" placeholder="VNĐ" placeholderTextColor="#94A3B8" value={basePrice} onChangeText={setBasePrice} />
                </View>
              </View>

              {!isBuyPost && (
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Giá lúc mua</Text>
                  <View style={styles.inputContainer}>
                    <TextInput style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} keyboardType="numeric" placeholder="VNĐ" placeholderTextColor="#94A3B8" value={originalPrice} onChangeText={setOriginalPrice} />
                  </View>
                </View>
              )}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Số lượng <Text style={styles.required}>*</Text></Text>
                <View style={styles.inputContainer}>
                  <TextInput style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} keyboardType="numeric" placeholder="Nhập SL..." placeholderTextColor="#94A3B8" value={quantity} onChangeText={setQuantity} />
                </View>
              </View>
              
              {!isBuyPost && (
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Thời hạn tin (Ngày)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} keyboardType="numeric" placeholder="VD: 30" placeholderTextColor="#94A3B8" value={expiryDays} onChangeText={setExpiryDays} />
                  </View>
                </View>
              )}
            </View>

            <Text style={styles.label}>Địa chỉ giao dịch <Text style={styles.required}>*</Text></Text>
            <TouchableOpacity style={styles.inputContainer} onPress={() => setShowAddressModal(true)}>
              <Text style={displayAddress ? styles.inputText : styles.placeholderText} numberOfLines={1}>{displayAddress || "Tỉnh/Thành, Phường/Xã, Số nhà..."}</Text>
              {displayAddress ? (
                <TouchableOpacity onPress={() => { setCity(""); setWard(""); setStreetAddress(""); }} style={styles.clearIcon}>
                  <Ionicons name="close-circle" size={20} color="#94A3B8" />
                </TouchableOpacity>
              ) : (
                <Ionicons name="location-outline" size={20} color="#94A3B8" />
              )}
            </TouchableOpacity>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Vận chuyển</Text>
                <TouchableOpacity style={styles.inputContainer} onPress={() => openSelect("Phương Thức Vận Chuyển", DELIVERY_OPTIONS, setDeliveryMethod)}>
                  <Text style={deliveryMethod ? styles.inputText : styles.placeholderText} numberOfLines={1}>{deliveryMethod ? getLabel(deliveryMethod, DELIVERY_OPTIONS) : "Chọn..."}</Text>
                  {deliveryMethod ? <TouchableOpacity onPress={() => setDeliveryMethod("")} style={styles.clearIcon}><Ionicons name="close-circle" size={20} color="#94A3B8" /></TouchableOpacity> : <Ionicons name="chevron-down" size={20} color="#94A3B8" />}
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Ưu tiên</Text>
                <View style={styles.inputContainer}>
                  <TextInput style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} placeholder="Nhập / Chọn..." placeholderTextColor="#94A3B8" value={priorityLevel} onChangeText={setPriorityLevel} />
                  {priorityLevel && <TouchableOpacity onPress={() => setPriorityLevel("")} style={styles.clearIcon}><Ionicons name="close-circle" size={20} color="#94A3B8" /></TouchableOpacity>}
                  <TouchableOpacity style={{ paddingLeft: 8, marginLeft: 4, borderLeftWidth: 1, borderLeftColor: "#E2E8F0" }} onPress={() => openSelect("Mức Độ Ưu Tiên", PRIORITY_OPTIONS, setPriorityLevel)}>
                    <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* 1. MODAL ĐỊA CHỈ */}
      <Modal visible={showAddressModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: "90%" }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Chi tiết địa chỉ</Text>
                <TouchableOpacity onPress={() => setShowAddressModal(false)} style={{ padding: 4 }}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }} keyboardShouldPersistTaps="handled">
                <Text style={styles.label}>Tỉnh / Thành phố <Text style={styles.required}>*</Text></Text>
                <View style={[styles.inputContainer, showCityDropdown && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 }]}>
                  <TextInput style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} placeholder="Nhập hoặc Chọn Tỉnh/Thành..." placeholderTextColor="#94A3B8" value={city} onChangeText={(t) => { setCity(t); setShowCityDropdown(true); setWard(""); }} onFocus={() => setShowCityDropdown(true)} />
                  {city ? <TouchableOpacity onPress={() => { setCity(""); setWard(""); setShowCityDropdown(false); }} style={styles.clearIcon}><Ionicons name="close-circle" size={20} color="#94A3B8" /></TouchableOpacity> : <TouchableOpacity onPress={() => setShowCityDropdown(!showCityDropdown)} style={styles.clearIcon}><Ionicons name={showCityDropdown ? "chevron-up" : "chevron-down"} size={20} color="#94A3B8" /></TouchableOpacity>}
                </View>
                {showCityDropdown && (
                  <View style={styles.dropdownList}>
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
                      {provinces.filter((p) => p.label.toLowerCase().includes(city.toLowerCase())).length > 0 ? (
                        provinces.filter((p) => p.label.toLowerCase().includes(city.toLowerCase())).map((p) => (
                            <TouchableOpacity key={p.value} style={styles.dropdownItem} onPress={() => { setCity(p.label); setShowCityDropdown(false); }}>
                              <Text style={styles.dropdownItemText}>{p.label}</Text>
                            </TouchableOpacity>
                          ))
                      ) : (<Text style={styles.noDataText}>Không tìm thấy Tỉnh/Thành</Text>)}
                    </ScrollView>
                  </View>
                )}

                <Text style={styles.label}>Phường / Xã <Text style={styles.required}>*</Text></Text>
                <View style={[styles.inputContainer, showWardDropdown && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 }]}>
                  <TextInput style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} placeholder="Nhập hoặc Chọn Phường/Xã..." placeholderTextColor="#94A3B8" value={ward} onChangeText={(t) => { setWard(t); setShowWardDropdown(true); }} onFocus={() => setShowWardDropdown(true)} />
                  {ward ? <TouchableOpacity onPress={() => { setWard(""); setShowWardDropdown(false); }} style={styles.clearIcon}><Ionicons name="close-circle" size={20} color="#94A3B8" /></TouchableOpacity> : <TouchableOpacity onPress={() => setShowWardDropdown(!showWardDropdown)} style={styles.clearIcon}><Ionicons name={showWardDropdown ? "chevron-up" : "chevron-down"} size={20} color="#94A3B8" /></TouchableOpacity>}
                </View>
                {showWardDropdown && (
                  <View style={styles.dropdownList}>
                    <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={{ maxHeight: 150 }}>
                      {wardsList.filter((w) => w.label.toLowerCase().includes(ward.toLowerCase())).length > 0 ? (
                        wardsList.filter((w) => w.label.toLowerCase().includes(ward.toLowerCase())).map((w, idx) => (
                            <TouchableOpacity key={idx} style={styles.dropdownItem} onPress={() => { setWard(w.label); setShowWardDropdown(false); }}>
                              <Text style={styles.dropdownItemText}>{w.label}</Text>
                            </TouchableOpacity>
                          ))
                      ) : (<Text style={styles.noDataText}>{city ? "Không tìm thấy Phường/Xã" : "Vui lòng chọn Tỉnh/Thành trước"}</Text>)}
                    </ScrollView>
                  </View>
                )}

                <Text style={styles.label}>Số nhà, Tên đường <Text style={styles.required}>*</Text></Text>
                <View style={styles.inputContainer}>
                  <TextInput style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} placeholder="VD: 123 Đường Lê Lợi" placeholderTextColor="#94A3B8" value={streetAddress} onChangeText={setStreetAddress} />
                </View>

                <TouchableOpacity style={styles.primaryButton} onPress={() => setShowAddressModal(false)}>
                  <Text style={styles.primaryButtonText}>Lưu Địa Chỉ</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 2. MODAL KÍCH THƯỚC (NẾU DÙNG CHO TIN BÁN) */}
      <Modal visible={showDimensionsModal} animationType="slide" transparent={true}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: "90%" }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Chi tiết Kích thước</Text>
                <TouchableOpacity onPress={() => setShowDimensionsModal(false)} style={{ padding: 4 }}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
              </View>
              <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 8 }}>
                <Text style={styles.label}>Chiều dài (cm)</Text>
                <View style={styles.inputContainer}><TextInput style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} keyboardType="numeric" placeholder="VD: 120" placeholderTextColor="#94A3B8" value={length} onChangeText={setLength} /></View>
                <Text style={styles.label}>Chiều rộng (cm)</Text>
                <View style={styles.inputContainer}><TextInput style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} keyboardType="numeric" placeholder="VD: 60" placeholderTextColor="#94A3B8" value={width} onChangeText={setWidth} /></View>
                <Text style={styles.label}>Chiều cao (cm)</Text>
                <View style={styles.inputContainer}><TextInput style={[styles.input, Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : null]} keyboardType="numeric" placeholder="VD: 80" placeholderTextColor="#94A3B8" value={height} onChangeText={setHeight} /></View>
                <TouchableOpacity style={styles.primaryButton} onPress={() => setShowDimensionsModal(false)}><Text style={styles.primaryButtonText}>Đóng</Text></TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 3. MODAL DROPDOWN DÙNG CHUNG */}
      <Modal visible={showSelectModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <TouchableOpacity onPress={() => setShowSelectModal(false)} style={{ padding: 4 }}><Ionicons name="close" size={24} color={COLORS.text} /></TouchableOpacity>
            </View>
            <FlatList
              data={modalOptions}
              keyExtractor={(item) => item.value}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.modalOptionBtn} onPress={() => handleSelectOption(item.value)}>
                  <Text style={styles.modalOptionText}>{item.label}</Text>
                  <Ionicons name="chevron-forward" size={20} color={COLORS.textLight} />
                </TouchableOpacity>
              )}
              ListEmptyComponent={<Text style={{ textAlign: "center", color: "#94A3B8", marginTop: 20 }}>Không có dữ liệu</Text>}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F1F5F9" },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "bold", color: COLORS.text },
  publishButtonText: { fontSize: 16, fontWeight: "bold", color: COLORS.primary },
  scrollContainer: { padding: 16, paddingBottom: 40 },
  cardSection: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  sectionTitleContainer: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  sectionTitleBar: { width: 4, height: 16, backgroundColor: COLORS.primary, borderRadius: 2, marginRight: 8 },
  sectionTitleText: { fontSize: 15, fontWeight: "bold", color: "#334155", textTransform: "uppercase" },
  imageSection: { marginTop: 8 },
  imageScroll: { gap: 12, paddingVertical: 8 },
  addImageBox: { width: 90, height: 90, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary, borderStyle: "dashed", backgroundColor: "#F0F9FF", justifyContent: "center", alignItems: "center", marginRight: 12 },
  addImageText: { fontSize: 12, color: COLORS.primary, fontWeight: "600", marginTop: 4 },
  imagePreviewWrapper: { position: "relative", marginRight: 12 },
  imagePreview: { width: 90, height: 90, borderRadius: 12 },
  removeImageBtn: { position: "absolute", top: -6, right: -6, backgroundColor: COLORS.white, borderRadius: 12 },
  label: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginBottom: 8 },
  required: { color: COLORS.error, fontWeight: "normal" },
  inputContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, height: 46, backgroundColor: "#F8FAFC", marginBottom: 16, overflow: "hidden" },
  input: { flex: 1, fontSize: 14, color: COLORS.text, height: "100%", minWidth: 0 },
  inputText: { flex: 1, fontSize: 14, color: COLORS.text },
  placeholderText: { flex: 1, fontSize: 14, color: "#94A3B8" },
  clearIcon: { padding: 4, marginRight: -4 },
  row: { flexDirection: "row", gap: 12 },
  dropdownList: { backgroundColor: "#FFF", borderWidth: 1, borderColor: COLORS.border, borderTopWidth: 0, borderBottomLeftRadius: 8, borderBottomRightRadius: 8, marginBottom: 16, overflow: "hidden", maxHeight: 150 },
  dropdownItem: { padding: 12, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  dropdownItemText: { fontSize: 14, color: COLORS.text },
  noDataText: { padding: 12, textAlign: "center", color: "#94A3B8", fontSize: 13 },
  rawBlock: { marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  rawLabel: { fontSize: 14, fontWeight: "bold", color: "#334155", marginBottom: 8 },
  rawInputContainer: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 8, paddingHorizontal: 10, height: 44, backgroundColor: "#F8FAFC", marginBottom: 12 },
  rawInput: { flex: 1, fontSize: 14, color: "#334155", height: "100%" },
  rawDropdownContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#CBD5E1", borderRadius: 8, paddingHorizontal: 10, height: 44, backgroundColor: "#FFF", marginBottom: 12 },
  boolBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" },
  boolBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  boolBtnActiveRed: { backgroundColor: COLORS.error, borderColor: COLORS.error },
  boolBtnText: { fontSize: 14, fontWeight: "600", color: "#64748B", marginLeft: 6 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "70%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#F1F5F9" },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  modalOptionBtn: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#F8FAFC" },
  modalOptionText: { fontSize: 16, color: COLORS.text },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: 12, height: 48, justifyContent: "center", alignItems: "center", marginTop: 8, marginBottom: Platform.OS === "ios" ? 16 : 0 },
  primaryButtonText: { color: COLORS.white, fontSize: 15, fontWeight: "bold" },
});