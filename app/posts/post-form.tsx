import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
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
import apiClient from "../../src/services/apis/axiosClient";

const locationApi = {
  getProvinces: async () => {
    const response = await fetch("https://34tinhthanh.com/api/provinces");
    if (!response.ok) throw new Error(`Province API ${response.status}`);
    return response.json();
  },
  getWards: async (provinceCode: string | number) => {
    const response = await fetch(
      `https://34tinhthanh.com/api/wards?province_code=${provinceCode}`,
    );
    if (!response.ok) throw new Error(`Ward API ${response.status}`);
    return response.json();
  },
};

const postApi = {
  getActiveCategories: () =>
    apiClient
      .get("/categories/active", {
        params: { PageSize: 100, PageNumber: 1 },
      })
      .then((response) => response.data),
  getAllProductTypes: () =>
    apiClient
      .get("/product-types/get-all", {
        params: { PageSize: 100, PageNumber: 1 },
      })
      .then((response) => response.data),
  getAllBrands: () =>
    apiClient
      .get("/brands", { params: { PageSize: 100, PageNumber: 1 } })
      .then((response) => response.data),
  getPostById: (postId: string) =>
    apiClient
      .get(`/posts/get-by-id/${postId}`)
      .then((response) => response.data),
  getAttributesByProductType: (productTypeId: string) =>
    apiClient
      .get(`/product-types/${productTypeId}/attributes`)
      .then((response) => response.data),
  createSellPost: (formData: FormData) =>
    apiClient.post("/posts/create/sell", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000,
    }),
  updateSellPost: (postId: string, formData: FormData) =>
    apiClient
      .patch(`/posts/update/sell/${postId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000,
      })
      .then((response) => response.data),
  createBuyPost: (formData: FormData) =>
    apiClient
      .post("/posts/create/buy", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      })
      .then((response) => response.data),
  updateBuyPost: (postId: string, formData: FormData) =>
    apiClient
      .put(`/posts/update/buy/${postId}`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 30000,
      })
      .then((response) => response.data),
};

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
  { label: "Không hỏng (0%)", value: "None" },
  { label: "Thẩm mỹ - Trầy xước nhẹ (~20%)", value: "Cosmetic_Damage" },
  { label: "Hư nhẹ - Dễ thay thế (~40%)", value: "Minor_Damage" },
  { label: "Hư trung bình (~60%)", value: "Moderate_Damage" },
  { label: "Hư nặng (~80%)", value: "Severe_Damage" },
  { label: "Tổn thất toàn bộ (100%)", value: "Total_Loss" },
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

const MAX_IMAGES = 5;

export default function PostFormScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || "personal";

  const { editId, postType: urlPostType } = useLocalSearchParams();
  const isEditMode = !!editId;

  const rawUrlPostType = Array.isArray(urlPostType)
    ? urlPostType[0]
    : urlPostType;
  const normalizedUrlPostType =
    typeof rawUrlPostType === "string"
      ? rawUrlPostType.trim().toLowerCase()
      : "";
  const fallbackPostType: "Buy" | "Sell" =
    normalizedUrlPostType === "buy"
      ? "Buy"
      : normalizedUrlPostType === "sell"
        ? "Sell"
        : userRole === "business"
          ? "Buy"
          : "Sell";
  const [editPostType, setEditPostType] = useState<"Buy" | "Sell" | null>(null);

  const effectivePostType = isEditMode
    ? (editPostType ?? fallbackPostType)
    : fallbackPostType;
  const isBuyPost = effectivePostType === "Buy";

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingOldData, setIsFetchingOldData] = useState(isEditMode);

  const [images, setImages] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [allProductTypes, setAllProductTypes] = useState<any[]>([]);
  const [filteredProductTypes, setFilteredProductTypes] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);

  const [eavAttributes, setEavAttributes] = useState<any[]>([]);
  const [isLoadingSchema, setIsLoadingSchema] = useState(false);
  const [oldEavData, setOldEavData] = useState<any[]>([]);

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
  const [deliveryMethod, setDeliveryMethod] = useState("");
  const [priorityLevel, setPriorityLevel] = useState("");

  const [city, setCity] = useState("");
  const [cityCode, setCityCode] = useState<string | null>(null);
  const [ward, setWard] = useState("");
  const [streetAddress, setStreetAddress] = useState("");

  const [provincesList, setProvincesList] = useState<
    { label: string; value: string }[]
  >([]);
  const [wardsList, setWardsList] = useState<
    { label: string; value: string }[]
  >([]);

  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [showWardDropdown, setShowWardDropdown] = useState(false);
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [provinceLoadError, setProvinceLoadError] = useState(false);
  const [wardLoadError, setWardLoadError] = useState(false);

  useEffect(() => {
    locationApi
      .getProvinces()
      .then((data) => {
        setProvincesList(
          Array.isArray(data)
            ? data.map((p: any) => ({ label: p.name, value: p.province_code }))
            : [],
        );
      })
      .catch(() => setProvinceLoadError(true));
  }, []);

  useEffect(() => {
    if (cityCode) {
      setIsFetchingLocation(true);
      locationApi
        .getWards(cityCode)
        .then((data) => {
          const wards = Array.isArray(data) ? data : [];
          const uniqueWards = Array.from(
            new Set(wards.map((w: any) => w.ward_name)),
          ).map((name) => ({ label: name as string, value: name as string }));
          setWardsList(uniqueWards);
        })
        .catch(() => setWardLoadError(true))
        .finally(() => setIsFetchingLocation(false));
    } else {
      setWardsList([]);
    }
  }, [cityCode]);

  const [showSelectModal, setShowSelectModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalOptions, setModalOptions] = useState<
    { label: string; value: string }[]
  >([]);
  const currentSelectSetterRef = useRef<((val: string) => void) | null>(null);

  const openSelect = (
    title: string,
    options: { label: string; value: string }[],
    setter: (val: string) => void,
  ) => {
    setModalTitle(title);
    setModalOptions(options);
    currentSelectSetterRef.current = setter;
    setShowSelectModal(true);
  };
  const handleSelectOption = (value: string) => {
    if (currentSelectSetterRef.current) currentSelectSetterRef.current(value);
    setShowSelectModal(false);
  };
  const getLabel = (
    value: string,
    options: { label: string; value: string }[],
  ) => {
    const found = options.find((o) => o.value === value);
    return found ? found.label : value;
  };

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [catRes, ptRes, brandRes] = await Promise.all([
          postApi.getActiveCategories(),
          postApi.getAllProductTypes(),
          postApi.getAllBrands(),
        ]);
        setCategories(
          (catRes?.items || catRes?.data?.items || catRes?.data || []).map(
            (c: any) => ({ label: c.categoryName, value: c.categoryId }),
          ),
        );
        if (ptRes?.data?.items)
          setAllProductTypes(
            ptRes.data.items.map((pt: any) => ({
              label: pt.productTypeName,
              value: pt.productTypeId,
              categoryId: pt.categoryId,
            })),
          );
        const brandList = brandRes?.data?.items || brandRes?.data || [];
        if (Array.isArray(brandList))
          setBrands(
            brandList.map((b: any) => ({
              label: b.brandName || b.name,
              value: b.brandId || b.id,
            })),
          );
      } catch (error) {
        console.error("Lỗi:", error);
      }
    };
    fetchMasterData();
  }, []);

  useEffect(() => {
    if (!isEditMode) return;
    const loadOldData = async () => {
      setIsFetchingOldData(true);
      try {
        const res = await postApi.getPostById(editId as string);
        const data = res?.data || res;
        const p = data.product || data.requirement || {};

        setProductName(data.productName || p.productName || "");
        setDescription(data.description || "");
        setBasePrice(
          data.basePrice?.toString() ||
            data.expectedPrice?.toString() ||
            p.expectedPrice?.toString() ||
            "",
        );
        setQuantity(data.quantity?.toString() || "1");
        setCity(data.city || "");
        setWard(data.ward || "");
        setStreetAddress(data.streetAddress || "");

        if (data.city) {
          const matchProv = provincesList.find(
            (prov) => prov.label.toLowerCase() === data.city.toLowerCase(),
          );
          if (matchProv) setCityCode(matchProv.value);
        }

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

        if (data.medias && data.medias.length > 0)
          setImages(data.medias.map((m: any) => m.url || m.mediaUrl));
        if (p.attributeValues && Array.isArray(p.attributeValues))
          setOldEavData(p.attributeValues);
      } catch (error) {
        console.error(error);
      } finally {
        setIsFetchingOldData(false);
      }
    };
    if (provincesList.length > 0) loadOldData();
  }, [editId, provincesList]);

  useEffect(() => {
    if (selectedCategory)
      setFilteredProductTypes(
        allProductTypes.filter((pt) => pt.categoryId === selectedCategory),
      );
    else setFilteredProductTypes([]);
  }, [selectedCategory, allProductTypes]);

  useEffect(() => {
    const fetchDynamicSchema = async () => {
      if (!selectedProductType) {
        setEavAttributes([]);
        return;
      }
      try {
        setIsLoadingSchema(true);
        const res =
          await postApi.getAttributesByProductType(selectedProductType);
        const schemaData = res?.data || [];
        const initializedEav = schemaData.map((attr: any) => {
          const oldVal = oldEavData.find(
            (old) => old.attributeId === attr.attributeId,
          );
          return {
            ...attr,
            selectedOptionId: oldVal ? oldVal.optionId || "" : "",
            valueBoolean: oldVal?.valueBoolean ?? null,
            valueText: oldVal ? oldVal.valueText || "" : "",
            valueNumber: oldVal ? oldVal.valueNumber?.toString() || "" : "",
          };
        });
        initializedEav.sort(
          (a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0),
        );
        setEavAttributes(initializedEav);
      } catch (error) {
        console.error(error);
      } finally {
        setIsLoadingSchema(false);
      }
    };
    fetchDynamicSchema();
  }, [selectedProductType, oldEavData]);

  const displayDimensions =
    length && width && height ? `${length} x ${width} x ${height} cm` : "";

  const pickImages = async () => {
    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      alert(`Tối đa ${MAX_IMAGES} ảnh.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remainingSlots,
      quality: 0.8,
    });
    if (!result.canceled)
      setImages((prev) => [
        ...prev,
        ...result.assets.map((a) => a.uri).slice(0, remainingSlots),
      ]);
  };
  const removeImage = (indexToRemove: number) =>
    setImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));

  const updateEavValue = (index: number, field: string, value: any) => {
    setEavAttributes((prev) => {
      const newArr = [...prev];
      newArr[index] = { ...newArr[index], [field]: value };
      return newArr;
    });
  };

  const handlePublish = async () => {
    if (!productName || !basePrice || images.length === 0) {
      alert("Vui lòng điền đủ thông tin!");
      return;
    }
    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append("Quantity", quantity);
      if (description) formData.append("Description", description);
      if (city) formData.append("City", city);
      if (ward) formData.append("Ward", ward);
      if (streetAddress) formData.append("StreetAddress", streetAddress);
      if (deliveryMethod) formData.append("DeliveryMethod", deliveryMethod);
      if (priorityLevel) formData.append("PriorityLevel", priorityLevel);

      const prefix = isBuyPost ? "Requirement" : "Product";
      if (isBuyPost) {
        formData.append("ExpectedPrice", basePrice);
        formData.append(`${prefix}.ExpectedPrice`, basePrice);
      } else {
        formData.append("BasePrice", basePrice);
      }
      formData.append(`${prefix}.ProductName`, productName);
      if (selectedCategory)
        formData.append(`${prefix}.CategoryId`, selectedCategory);
      if (selectedProductType)
        formData.append(`${prefix}.ProductTypeId`, selectedProductType);
      if (brandId) formData.append(`${prefix}.BrandId`, brandId);
      if (spaceUsage) formData.append(`${prefix}.SpaceUsage`, spaceUsage);
      if (functionalityStatus)
        formData.append(`${prefix}.FunctionalityStatus`, functionalityStatus);
      if (usageDuration)
        formData.append(`${prefix}.UsageDuration`, usageDuration);
      if (damageLevel) formData.append(`${prefix}.DamageLevel`, damageLevel);

      if (!isBuyPost) {
        if (modelNumber) formData.append(`${prefix}.ModelNumber`, modelNumber);
        if (originalPrice)
          formData.append(`${prefix}.OriginalPrice`, originalPrice);
        if (detailDescription)
          formData.append(`${prefix}.DetailDescription`, detailDescription);
        if (weight) formData.append(`${prefix}.Weight`, weight);
        if (length) formData.append(`${prefix}.Length`, length);
        if (width) formData.append(`${prefix}.Width`, width);
        if (height) formData.append(`${prefix}.Height`, height);
      }

      eavAttributes.forEach((attr) => {
        const item: any = { attributeId: attr.attributeId };
        if (attr.selectedOptionId) item.optionId = attr.selectedOptionId;
        else if (attr.valueBoolean !== null)
          item.valueBoolean = attr.valueBoolean;
        else if (attr.valueNumber) item.valueNumber = Number(attr.valueNumber);
        else if (attr.valueText) item.valueText = attr.valueText;
        else return;
        formData.append(`${prefix}.AttributeValues`, JSON.stringify(item));
      });

      await Promise.all(images.map(async (imageUri, index) => {
        if (imageUri.startsWith("http")) return;

        if (Platform.OS === "web") {
            const response = await fetch(imageUri);
            const blob = await response.blob();
            // Lấy định dạng từ MIME type của blob (ví dụ: image/png -> png)
            const ext = blob.type.split('/')[1] || 'jpg';
            formData.append("Medias", blob, `image_${index}.${ext}`);
        } else {
            // Đối với Mobile, giữ nguyên logic cũ vì nó đang hoạt động ổn định trên file hệ thống
            let filename = imageUri.split("/").pop()?.split("?")[0] || `image_${index}.jpg`;
            if (!filename.includes(".")) filename = `${filename}.jpg`;
            formData.append("Medias", { 
                uri: imageUri.replace("file://", ""), 
                name: filename, 
                type: 'image/jpeg' 
            } as any);
        }
      }));

      if (isEditMode)
        isBuyPost
          ? await postApi.updateBuyPost(editId as string, formData)
          : await postApi.updateSellPost(editId as string, formData);
      else
        isBuyPost
          ? await postApi.createBuyPost(formData)
          : await postApi.createSellPost(formData);

      alert("Thành công!");
      router.back();
    } catch (error: any) {
      alert(error.response?.data?.message || "Có lỗi xảy ra");
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
        <View
          style={{ flex: 1, justifyContent: "center", alignItems: "center" }}
        >
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={{ marginTop: 12, color: COLORS.textLight }}>
            Đang tải thông tin bài viết...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditMode
              ? "Sửa tin đăng"
              : isBuyPost
                ? "Đăng tin thu mua"
                : "Đăng tin mới"}
          </Text>
          <TouchableOpacity onPress={handlePublish} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={styles.publishButtonText}>
                {isEditMode ? "Cập nhật" : "Đăng"}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.cardSection}>
            <Text style={styles.label}>
              {isBuyPost ? "Hình ảnh minh họa yêu cầu" : "Hình ảnh sản phẩm"}{" "}
              <Text style={styles.required}>* (1-{MAX_IMAGES} ảnh)</Text>
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.imageScroll}
            >
              <TouchableOpacity style={styles.addImageBox} onPress={pickImages}>
                <Ionicons
                  name="camera-outline"
                  size={32}
                  color={COLORS.primary}
                />
                <Text style={styles.addImageText}>Thêm ảnh</Text>
              </TouchableOpacity>
              {images.map((uri, index) => (
                <View key={index} style={styles.imagePreviewWrapper}>
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => removeImage(index)}
                  >
                    <Ionicons
                      name="close-circle"
                      size={22}
                      color={COLORS.error}
                    />
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
                style={[
                  styles.input,
                  Platform.OS === "web"
                    ? ({ outlineStyle: "none" } as any)
                    : undefined,
                ]}
                placeholder={
                  isBuyPost
                    ? "VD: Cần mua tủ lạnh cũ..."
                    : "Nhập tiêu đề sản phẩm..."
                }
                placeholderTextColor="#94A3B8"
                value={productName}
                onChangeText={setProductName}
              />
            </View>

            <Text style={styles.label}>Mô tả bài đăng (Ngắn gọn)</Text>
            <View
              style={[
                styles.inputContainer,
                { height: 80, alignItems: "flex-start", paddingTop: 12 },
              ]}
            >
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === "web"
                    ? ({ outlineStyle: "none" } as any)
                    : undefined,
                ]}
                multiline
                placeholder={
                  isBuyPost
                    ? "VD: Cần mua gấp số lượng lớn..."
                    : "VD: Cần pass gấp tủ lạnh vì chuyển trọ..."
                }
                placeholderTextColor="#94A3B8"
                value={description}
                onChangeText={setDescription}
              />
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  Phân loại <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() =>
                    openSelect(
                      "Chọn Phân loại",
                      categories,
                      setSelectedCategory,
                    )
                  }
                >
                  <Text
                    style={
                      selectedCategory
                        ? styles.inputText
                        : styles.placeholderText
                    }
                    numberOfLines={1}
                  >
                    {selectedCategory
                      ? getLabel(selectedCategory, categories)
                      : "Chọn..."}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  Loại sản phẩm <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() =>
                    openSelect(
                      "Chọn Loại Sản Phẩm",
                      filteredProductTypes,
                      setSelectedProductType,
                    )
                  }
                >
                  <Text
                    style={
                      selectedProductType
                        ? styles.inputText
                        : styles.placeholderText
                    }
                    numberOfLines={1}
                  >
                    {selectedProductType
                      ? getLabel(selectedProductType, filteredProductTypes)
                      : "Chọn..."}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  Thương hiệu <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() =>
                    openSelect("Chọn Thương hiệu", brands, setBrandId)
                  }
                >
                  <Text
                    style={brandId ? styles.inputText : styles.placeholderText}
                    numberOfLines={1}
                  >
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
                      style={[
                        styles.input,
                        Platform.OS === "web"
                          ? ({ outlineStyle: "none" } as any)
                          : undefined,
                      ]}
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
                <Text style={styles.label}>
                  Mô tả chi tiết sản phẩm <Text style={styles.required}>*</Text>
                </Text>
                <View
                  style={[
                    styles.inputContainer,
                    { height: 100, alignItems: "flex-start", paddingTop: 12 },
                  ]}
                >
                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web"
                        ? ({ outlineStyle: "none" } as any)
                        : undefined,
                    ]}
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
              {isLoadingSchema ? (
                <ActivityIndicator
                  color={COLORS.primary}
                  style={{ padding: 20 }}
                />
              ) : null}

              {eavAttributes.map((attr, index) => {
                if (attr.inputMode === null || attr.inputMode === undefined)
                  return null;

                const mode = attr.inputMode;
                const isOptionAllowed =
                  mode === 1 ||
                  mode === "OptionOnly" ||
                  mode === 3 ||
                  mode === "OptionOrCustom";
                const isCustomAllowed =
                  mode === 2 ||
                  mode === "CustomOnly" ||
                  mode === 3 ||
                  mode === "OptionOrCustom";
                const optionList =
                  attr.options?.map((o: any) => ({
                    label: o.optionValue,
                    value: o.optionId,
                  })) || [];

                // FIX UNIT: Nếu unit là chuỗi "string" thì coi như không có unit
                const rawUnit = attr.unit;
                const displayUnit =
                  rawUnit &&
                  typeof rawUnit === "string" &&
                  rawUnit.toLowerCase() !== "string"
                    ? ` (${rawUnit})`
                    : "";

                return (
                  <View key={attr.attributeId} style={styles.rawBlock}>
                    <Text style={styles.rawLabel}>
                      {attr.attributeName}
                      {displayUnit}
                      {attr.isRequired ? (
                        <Text style={styles.required}> *</Text>
                      ) : null}
                    </Text>

                    {isOptionAllowed && (
                      <TouchableOpacity
                        style={styles.rawDropdownContainer}
                        onPress={() =>
                          openSelect(
                            `Chọn ${attr.attributeName}`,
                            optionList,
                            (val) =>
                              updateEavValue(index, "selectedOptionId", val),
                          )
                        }
                      >
                        <Text
                          style={
                            attr.selectedOptionId
                              ? styles.inputText
                              : styles.placeholderText
                          }
                          numberOfLines={1}
                        >
                          {attr.selectedOptionId
                            ? getLabel(attr.selectedOptionId, optionList)
                            : `Chọn...`}
                        </Text>
                        <Ionicons
                          name="chevron-down"
                          size={20}
                          color="#94A3B8"
                        />
                      </TouchableOpacity>
                    )}

                    {isCustomAllowed && (
                      <View style={{ gap: 12 }}>
                        <View style={{ flexDirection: "row", gap: 12 }}>
                          <TouchableOpacity
                            style={[
                              styles.boolBtn,
                              attr.valueBoolean === true
                                ? styles.boolBtnActive
                                : undefined,
                            ]}
                            onPress={() =>
                              updateEavValue(index, "valueBoolean", true)
                            }
                          >
                            <Ionicons
                              name="checkmark-circle-outline"
                              size={18}
                              color={
                                attr.valueBoolean === true
                                  ? COLORS.white
                                  : "#64748B"
                              }
                            />
                            <Text
                              style={[
                                styles.boolBtnText,
                                attr.valueBoolean === true
                                  ? { color: COLORS.white }
                                  : undefined,
                              ]}
                            >
                              Có / Bật
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.boolBtn,
                              attr.valueBoolean === false
                                ? styles.boolBtnActiveRed
                                : undefined,
                            ]}
                            onPress={() =>
                              updateEavValue(index, "valueBoolean", false)
                            }
                          >
                            <Ionicons
                              name="close-circle-outline"
                              size={18}
                              color={
                                attr.valueBoolean === false
                                  ? COLORS.white
                                  : "#64748B"
                              }
                            />
                            <Text
                              style={[
                                styles.boolBtnText,
                                attr.valueBoolean === false
                                  ? { color: COLORS.white }
                                  : undefined,
                              ]}
                            >
                              Không / Tắt
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.rawInputContainer}>
                          <TextInput
                            style={[
                              styles.rawInput,
                              Platform.OS === "web"
                                ? ({ outlineStyle: "none" } as any)
                                : undefined,
                            ]}
                            placeholder="Nhập chữ tự do..."
                            placeholderTextColor="#94A3B8"
                            value={attr.valueText}
                            onChangeText={(text) =>
                              updateEavValue(index, "valueText", text)
                            }
                          />
                        </View>
                        <View style={styles.rawInputContainer}>
                          <TextInput
                            style={[
                              styles.rawInput,
                              Platform.OS === "web"
                                ? ({ outlineStyle: "none" } as any)
                                : undefined,
                            ]}
                            placeholder={`Nhập số...`}
                            placeholderTextColor="#94A3B8"
                            keyboardType="numeric"
                            value={attr.valueNumber}
                            onChangeText={(text) =>
                              updateEavValue(index, "valueNumber", text)
                            }
                          />
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
                  <TouchableOpacity
                    style={styles.inputContainer}
                    onPress={() => setShowDimensionsModal(true)}
                  >
                    <Text
                      style={
                        displayDimensions
                          ? styles.inputText
                          : styles.placeholderText
                      }
                      numberOfLines={1}
                    >
                      {displayDimensions || "VD: 120 x 60 x 80 cm"}
                    </Text>
                    {displayDimensions ? (
                      <TouchableOpacity
                        onPress={() => {
                          setLength("");
                          setWidth("");
                          setHeight("");
                        }}
                        style={styles.clearIcon}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color="#94A3B8"
                        />
                      </TouchableOpacity>
                    ) : (
                      <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                    )}
                  </TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Cân nặng (kg)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[
                        styles.input,
                        Platform.OS === "web"
                          ? ({ outlineStyle: "none" } as any)
                          : undefined,
                      ]}
                      keyboardType="numeric"
                      placeholder="VD: 15"
                      placeholderTextColor="#94A3B8"
                      value={weight}
                      onChangeText={setWeight}
                    />
                  </View>
                </View>
              </View>
            )}

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Không gian dùng</Text>
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() =>
                    openSelect(
                      "Chọn Không Gian Dùng",
                      SPACE_USAGE_OPTIONS,
                      setSpaceUsage,
                    )
                  }
                >
                  <Text
                    style={
                      spaceUsage ? styles.inputText : styles.placeholderText
                    }
                    numberOfLines={1}
                  >
                    {spaceUsage
                      ? getLabel(spaceUsage, SPACE_USAGE_OPTIONS)
                      : "Chọn..."}
                  </Text>
                  {spaceUsage ? (
                    <TouchableOpacity
                      onPress={() => setSpaceUsage("")}
                      style={styles.clearIcon}
                    >
                      <Ionicons name="close-circle" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : (
                    <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                  )}
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Mức độ hư hại</Text>
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() =>
                    openSelect(
                      "Mức Độ Hư Hại",
                      DAMAGE_LEVEL_OPTIONS,
                      setDamageLevel,
                    )
                  }
                >
                  <Text
                    style={
                      damageLevel ? styles.inputText : styles.placeholderText
                    }
                    numberOfLines={1}
                  >
                    {damageLevel
                      ? getLabel(damageLevel, DAMAGE_LEVEL_OPTIONS)
                      : "Chọn..."}
                  </Text>
                  {damageLevel ? (
                    <TouchableOpacity
                      onPress={() => setDamageLevel("")}
                      style={styles.clearIcon}
                    >
                      <Ionicons name="close-circle" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : (
                    <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  Tình trạng HĐ <Text style={styles.required}>*</Text>
                </Text>
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() =>
                    openSelect(
                      "Tình Trạng Hoạt Động",
                      FUNC_STATUS_OPTIONS,
                      setFunctionalityStatus,
                    )
                  }
                >
                  <Text
                    style={
                      functionalityStatus
                        ? styles.inputText
                        : styles.placeholderText
                    }
                    numberOfLines={1}
                  >
                    {functionalityStatus
                      ? getLabel(functionalityStatus, FUNC_STATUS_OPTIONS)
                      : "Chọn..."}
                  </Text>
                  {functionalityStatus ? (
                    <TouchableOpacity
                      onPress={() => setFunctionalityStatus("")}
                      style={styles.clearIcon}
                    >
                      <Ionicons name="close-circle" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : (
                    <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                  )}
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  Thời gian SD (Năm)<Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web"
                        ? ({ outlineStyle: "none" } as any)
                        : undefined,
                    ]}
                    keyboardType="numeric"
                    placeholder="VD: 2"
                    placeholderTextColor="#94A3B8"
                    value={usageDuration}
                    onChangeText={setUsageDuration}
                  />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.cardSection}>
            <SectionTitle title="GIAO DỊCH & MỨC GIÁ" />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  {isBuyPost ? "Giá thu mua dự kiến" : "Giá mong muốn"}{" "}
                  <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web"
                        ? ({ outlineStyle: "none" } as any)
                        : undefined,
                    ]}
                    keyboardType="numeric"
                    placeholder="VNĐ"
                    placeholderTextColor="#94A3B8"
                    value={basePrice}
                    onChangeText={setBasePrice}
                  />
                </View>
              </View>

              {!isBuyPost && (
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Giá lúc mua</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={[
                        styles.input,
                        Platform.OS === "web"
                          ? ({ outlineStyle: "none" } as any)
                          : undefined,
                      ]}
                      keyboardType="numeric"
                      placeholder="VNĐ"
                      placeholderTextColor="#94A3B8"
                      value={originalPrice}
                      onChangeText={setOriginalPrice}
                    />
                  </View>
                </View>
              )}
            </View>

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>
                  Số lượng <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web"
                        ? ({ outlineStyle: "none" } as any)
                        : undefined,
                    ]}
                    keyboardType="numeric"
                    placeholder="Nhập SL..."
                    placeholderTextColor="#94A3B8"
                    value={quantity}
                    onChangeText={setQuantity}
                  />
                </View>
              </View>
            </View>
          </View>

          {/* ================= THÔNG TIN GIAO HÀNG & ĐỊA CHỈ (AUTOCOMPLETE TRỰC TIẾP) ================= */}
          <View style={styles.cardSection}>
            <SectionTitle title="VẬN CHUYỂN & VỊ TRÍ" />

            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Vận chuyển</Text>
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() =>
                    openSelect(
                      "Phương Thức Vận Chuyển",
                      DELIVERY_OPTIONS,
                      setDeliveryMethod,
                    )
                  }
                >
                  <Text
                    style={
                      deliveryMethod ? styles.inputText : styles.placeholderText
                    }
                    numberOfLines={1}
                  >
                    {deliveryMethod
                      ? getLabel(deliveryMethod, DELIVERY_OPTIONS)
                      : "Chọn..."}
                  </Text>
                  {deliveryMethod ? (
                    <TouchableOpacity
                      onPress={() => setDeliveryMethod("")}
                      style={styles.clearIcon}
                    >
                      <Ionicons name="close-circle" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : (
                    <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                  )}
                </TouchableOpacity>
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Ưu tiên</Text>
                <TouchableOpacity
                  style={styles.inputContainer}
                  onPress={() =>
                    openSelect(
                      "Mức Độ Ưu Tiên",
                      PRIORITY_OPTIONS,
                      setPriorityLevel,
                    )
                  }
                >
                  <Text
                    style={
                      priorityLevel ? styles.inputText : styles.placeholderText
                    }
                    numberOfLines={1}
                  >
                    {priorityLevel
                      ? getLabel(priorityLevel, PRIORITY_OPTIONS)
                      : "Chọn..."}
                  </Text>
                  {priorityLevel ? (
                    <TouchableOpacity
                      onPress={() => setPriorityLevel("")}
                      style={styles.clearIcon}
                    >
                      <Ionicons name="close-circle" size={20} color="#94A3B8" />
                    </TouchableOpacity>
                  ) : (
                    <Ionicons name="chevron-down" size={20} color="#94A3B8" />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            {/* AUTOCOMPLETE TỈNH THÀNH */}
            <View style={{ zIndex: 10 }}>
              <Text style={styles.label}>
                Tỉnh / Thành phố <Text style={styles.required}>*</Text>
              </Text>
              <View
                style={[
                  styles.autocompleteContainer,
                  showCityDropdown
                    ? styles.autocompleteContainerOpen
                    : undefined,
                ]}
              >
                <TextInput
                  style={[
                    styles.input,
                    Platform.OS === "web" && ({ outlineStyle: "none" } as any),
                  ]}
                  placeholder="Nhập hoặc Chọn Tỉnh/Thành..."
                  placeholderTextColor="#94A3B8"
                  value={city}
                  onChangeText={(t) => {
                    setCity(t);
                    setShowCityDropdown(true);
                    setCityCode(null);
                    setWard("");
                  }}
                  onFocus={() => setShowCityDropdown(true)}
                />
                {city ? (
                  <TouchableOpacity
                    onPress={() => {
                      setCity("");
                      setCityCode(null);
                      setWard("");
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
                              setWard("");
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
                        {provinceLoadError
                          ? "Không tải được gợi ý Tỉnh/Thành. Bạn vẫn có thể nhập thủ công."
                          : "Không tìm thấy Tỉnh/Thành"}
                      </Text>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>

            {/* AUTOCOMPLETE QUẬN PHƯỜNG */}
            <View style={{ zIndex: 9 }}>
              <Text style={styles.label}>
                Quận / Phường <Text style={styles.required}>*</Text>
              </Text>
              <View
                style={[
                  styles.autocompleteContainer,
                  !city ? { backgroundColor: "#F1F5F9" } : undefined,
                  showWardDropdown
                    ? styles.autocompleteContainerOpen
                    : undefined,
                ]}
              >
                {isFetchingLocation ? (
                  <ActivityIndicator
                    size="small"
                    color={COLORS.primary}
                    style={{ flex: 1, alignItems: "flex-start" }}
                  />
                ) : (
                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web" &&
                        ({ outlineStyle: "none" } as any),
                    ]}
                    placeholder="Nhập hoặc Chọn Phường/Xã..."
                    placeholderTextColor="#94A3B8"
                    value={ward}
                    editable={!!city}
                    onChangeText={(t) => {
                      setWard(t);
                      setShowWardDropdown(true);
                    }}
                    onFocus={() => {
                      if (city) setShowWardDropdown(true);
                      else alert("Vui lòng chọn Tỉnh / Thành phố trước");
                    }}
                  />
                )}
                {ward ? (
                  <TouchableOpacity
                    onPress={() => {
                      setWard("");
                      setShowWardDropdown(false);
                    }}
                    style={styles.clearIcon}
                  >
                    <Ionicons name="close-circle" size={20} color="#94A3B8" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => {
                      if (city) setShowWardDropdown(!showWardDropdown);
                    }}
                    style={styles.clearIcon}
                  >
                    <Ionicons
                      name={showWardDropdown ? "chevron-up" : "chevron-down"}
                      size={20}
                      color="#94A3B8"
                    />
                  </TouchableOpacity>
                )}
              </View>
              {showWardDropdown && (
                <View style={styles.dropdownList}>
                  <ScrollView
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                    style={{ maxHeight: 200 }}
                  >
                    {wardsList.filter((w) =>
                      w.label.toLowerCase().includes(ward.toLowerCase()),
                    ).length > 0 ? (
                      wardsList
                        .filter((w) =>
                          w.label.toLowerCase().includes(ward.toLowerCase()),
                        )
                        .map((item, idx) => (
                          <TouchableOpacity
                            key={idx}
                            style={styles.dropdownItem}
                            onPress={() => {
                              setWard(item.label);
                              setShowWardDropdown(false);
                            }}
                          >
                            <Text style={styles.dropdownItemText}>
                              {item.label}
                            </Text>
                            {ward === item.label && (
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
                        {wardLoadError
                          ? "Không tải được gợi ý Phường/Xã. Bạn vẫn có thể nhập thủ công."
                          : city
                            ? "Không tìm thấy Phường/Xã"
                            : "Vui lòng chọn Tỉnh/Thành trước"}
                      </Text>
                    )}
                  </ScrollView>
                </View>
              )}
            </View>

            <Text style={styles.label}>
              Số nhà, Tên đường <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === "web"
                    ? ({ outlineStyle: "none" } as any)
                    : undefined,
                ]}
                placeholder="VD: 123 Đường Lê Lợi"
                placeholderTextColor="#94A3B8"
                value={streetAddress}
                onChangeText={setStreetAddress}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* MODAL KÍCH THƯỚC */}
      <Modal
        visible={showDimensionsModal}
        animationType="slide"
        transparent={true}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{ flex: 1 }}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { maxHeight: "90%" }]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Chi tiết Kích thước</Text>
                <TouchableOpacity
                  onPress={() => setShowDimensionsModal(false)}
                  style={{ padding: 4 }}
                >
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={{ marginTop: 8 }}
              >
                <Text style={styles.label}>Chiều dài (cm)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web"
                        ? ({ outlineStyle: "none" } as any)
                        : undefined,
                    ]}
                    keyboardType="numeric"
                    placeholder="VD: 120"
                    placeholderTextColor="#94A3B8"
                    value={length}
                    onChangeText={setLength}
                  />
                </View>
                <Text style={styles.label}>Chiều rộng (cm)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web"
                        ? ({ outlineStyle: "none" } as any)
                        : undefined,
                    ]}
                    keyboardType="numeric"
                    placeholder="VD: 60"
                    placeholderTextColor="#94A3B8"
                    value={width}
                    onChangeText={setWidth}
                  />
                </View>
                <Text style={styles.label}>Chiều cao (cm)</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={[
                      styles.input,
                      Platform.OS === "web"
                        ? ({ outlineStyle: "none" } as any)
                        : undefined,
                    ]}
                    keyboardType="numeric"
                    placeholder="VD: 80"
                    placeholderTextColor="#94A3B8"
                    value={height}
                    onChangeText={setHeight}
                  />
                </View>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={() => setShowDimensionsModal(false)}
                >
                  <Text style={styles.primaryButtonText}>Đóng</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* MODAL DROPDOWN DÙNG CHUNG */}
      <Modal visible={showSelectModal} animationType="fade" transparent={true}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <TouchableOpacity
                onPress={() => setShowSelectModal(false)}
                style={{ padding: 4 }}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={modalOptions}
              keyExtractor={(item) => item.value}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.modalOptionBtn}
                  onPress={() => handleSelectOption(item.value)}
                >
                  <Text style={styles.modalOptionText}>{item.label}</Text>
                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={COLORS.textLight}
                  />
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text
                  style={{
                    textAlign: "center",
                    color: "#94A3B8",
                    marginTop: 20,
                  }}
                >
                  Không có dữ liệu
                </Text>
              }
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F1F5F9" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "bold", color: COLORS.text },
  publishButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.primary,
  },
  scrollContainer: { padding: 16, paddingBottom: 40 },
  cardSection: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitleContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  sectionTitleBar: {
    width: 4,
    height: 16,
    backgroundColor: COLORS.primary,
    borderRadius: 2,
    marginRight: 8,
  },
  sectionTitleText: {
    fontSize: 15,
    fontWeight: "bold",
    color: "#334155",
    textTransform: "uppercase",
  },
  imageSection: { marginTop: 8 },
  imageScroll: { gap: 12, paddingVertical: 8 },
  addImageBox: {
    width: 90,
    height: 90,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderStyle: "dashed",
    backgroundColor: "#F0F9FF",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  addImageText: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: "600",
    marginTop: 4,
  },
  imagePreviewWrapper: { position: "relative", marginRight: 12 },
  imagePreview: { width: 90, height: 90, borderRadius: 12 },
  removeImageBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    backgroundColor: COLORS.white,
    borderRadius: 12,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  required: { color: COLORS.error, fontWeight: "normal" },

  inputContainer: {
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

  // STYLES AUTOCOMPLETE
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
  row: { flexDirection: "row", gap: 12 },

  rawBlock: {
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  rawLabel: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#334155",
    marginBottom: 8,
  },
  rawInputContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 44,
    backgroundColor: "#F8FAFC",
    marginBottom: 12,
  },
  rawInput: { flex: 1, fontSize: 14, color: "#334155", height: "100%" },
  rawDropdownContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 8,
    paddingHorizontal: 10,
    height: 44,
    backgroundColor: "#FFF",
    marginBottom: 12,
  },
  boolBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  boolBtnActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  boolBtnActiveRed: {
    backgroundColor: COLORS.error,
    borderColor: COLORS.error,
  },
  boolBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#64748B",
    marginLeft: 6,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  modalOptionBtn: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F8FAFC",
  },
  modalOptionText: { fontSize: 16, color: COLORS.text },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    marginBottom: Platform.OS === "ios" ? 16 : 0,
  },
  primaryButtonText: { color: COLORS.white, fontSize: 15, fontWeight: "bold" },
});
