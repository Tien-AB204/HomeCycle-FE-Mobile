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
import AddressPickerField from "../../src/components/shared/AddressPickerField";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

const postApi = {
  getActiveCategories: () =>
    apiClient
      .get("/categories/active", { params: { PageSize: 100, PageNumber: 1 } })
      .then((response) => response.data),
  getAllProductTypes: () =>
    apiClient
      .get("/product-types/get-all", { params: { PageSize: 100, PageNumber: 1 } })
      .then((response) => response.data),
  getAllBrands: () =>
    apiClient
      .get("/brands", { params: { PageSize: 100, PageNumber: 1 } })
      .then((response) => response.data),
  getPostById: (postId: string) =>
    apiClient.get(`/posts/get-by-id/${postId}`).then((response) => response.data),
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
    apiClient.patch(`/posts/update/sell/${postId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000,
    }),
  createBuyPost: (formData: FormData) =>
    apiClient.post("/posts/create/buy", formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000,
    }),
  updateBuyPost: (postId: string, formData: FormData) =>
    apiClient.patch(`/posts/update/buy/${postId}`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 30000,
    }),
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
type InlineMessage = { type: "error" | "info"; text: string } | null;

export default function PostFormScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || "personal";
  const { editId, postType: urlPostType } = useLocalSearchParams();
  const isEditMode = Boolean(editId);
  const rawUrlPostType = Array.isArray(urlPostType) ? urlPostType[0] : urlPostType;
  const normalizedUrlPostType =
    typeof rawUrlPostType === "string" ? rawUrlPostType.trim().toLowerCase() : "";
  const fallbackPostType: "Buy" | "Sell" =
    normalizedUrlPostType === "buy"
      ? "Buy"
      : normalizedUrlPostType === "sell"
        ? "Sell"
        : userRole === "business"
          ? "Buy"
          : "Sell";
  const [editPostType, setEditPostType] = useState<"Buy" | "Sell" | null>(null);
  const effectivePostType = isEditMode ? editPostType ?? fallbackPostType : fallbackPostType;
  const isBuyPost = effectivePostType === "Buy";

  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingOldData, setIsFetchingOldData] = useState(isEditMode);
  const [formMessage, setFormMessage] = useState<InlineMessage>(null);
  const [imageError, setImageError] = useState("");
  const [addressError, setAddressError] = useState("");
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
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedProductType, setSelectedProductType] = useState("");
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
  const [ward, setWard] = useState("");
  const [streetAddress, setStreetAddress] = useState("");
  const [showSelectModal, setShowSelectModal] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [modalOptions, setModalOptions] = useState<{ label: string; value: string }[]>([]);
  const currentSelectSetterRef = useRef<((value: string) => void) | null>(null);

  const openSelect = (
    title: string,
    options: { label: string; value: string }[],
    setter: (value: string) => void,
  ) => {
    setModalTitle(title);
    setModalOptions(options);
    currentSelectSetterRef.current = setter;
    setShowSelectModal(true);
  };
  const handleSelectOption = (value: string) => {
    currentSelectSetterRef.current?.(value);
    setShowSelectModal(false);
  };
  const getLabel = (value: string, options: { label: string; value: string }[]) =>
    options.find((option) => option.value === value)?.label || value;

  useEffect(() => {
    const fetchMasterData = async () => {
      try {
        const [catRes, ptRes, brandRes] = await Promise.all([
          postApi.getActiveCategories(),
          postApi.getAllProductTypes(),
          postApi.getAllBrands(),
        ]);
        const categoryItems = catRes?.items || catRes?.data?.items || catRes?.data || [];
        setCategories(
          Array.isArray(categoryItems)
            ? categoryItems.map((item: any) => ({
                label: item.categoryName,
                value: item.categoryId,
              }))
            : [],
        );
        const productTypeItems = ptRes?.data?.items || ptRes?.items || ptRes?.data || [];
        setAllProductTypes(
          Array.isArray(productTypeItems)
            ? productTypeItems
                .filter((item: any) => item?.isActive !== false)
                .map((item: any) => ({
                  label: item.productTypeName,
                  value: item.productTypeId,
                  categoryId: item.categoryId,
                }))
            : [],
        );
        const brandItems = brandRes?.data?.items || brandRes?.data || [];
        setBrands(
          Array.isArray(brandItems)
            ? brandItems.map((item: any) => ({
                label: item.brandName || item.name,
                value: item.brandId || item.id,
              }))
            : [],
        );
      } catch (error) {
        setFormMessage({
          type: "error",
          text: getApiErrorMessage(error, "Không thể tải dữ liệu để tạo bài đăng."),
        });
      }
    };
    void fetchMasterData();
  }, []);

  useEffect(() => {
    if (!isEditMode) return;
    const loadOldData = async () => {
      try {
        setIsFetchingOldData(true);
        const response = await postApi.getPostById(editId as string);
        const data = response?.data || response;
        const product = data.product || data.requirement || {};
        const rawPostType = String(data.postType || "").toLowerCase();
        if (rawPostType === "buy") setEditPostType("Buy");
        if (rawPostType === "sell") setEditPostType("Sell");
        setProductName(data.productName || product.productName || "");
        setDescription(data.description || "");
        setBasePrice(
          data.basePrice?.toString() ||
            data.expectedPrice?.toString() ||
            product.expectedPrice?.toString() ||
            "",
        );
        setQuantity(data.quantity?.toString() || "1");
        setCity(data.city || "");
        setWard(data.ward || "");
        setStreetAddress(data.streetAddress || "");
        setDeliveryMethod(data.deliveryMethod || "");
        setPriorityLevel(data.priorityLevel || "");
        setSelectedCategory(product.categoryId || "");
        setSelectedProductType(product.productTypeId || "");
        setBrandId(product.brandId || "");
        setModelNumber(product.modelNumber || "");
        setOriginalPrice(product.originalPrice?.toString() || "");
        setDetailDescription(product.detailDescription || "");
        setWeight(product.weight?.toString() || "");
        setUsageDuration(product.usageDuration?.toString() || "");
        setSpaceUsage(product.spaceUsage || "");
        setFunctionalityStatus(product.functionalityStatus || "");
        setDamageLevel(product.damageLevel || "");
        setLength(product.length?.toString() || "");
        setWidth(product.width?.toString() || "");
        setHeight(product.height?.toString() || "");
        if (Array.isArray(data.medias)) {
          setImages(data.medias.map((media: any) => media.url || media.mediaUrl));
        }
        if (Array.isArray(product.attributeValues)) {
          setOldEavData(product.attributeValues);
        }
      } catch (error) {
        setFormMessage({
          type: "error",
          text: getApiErrorMessage(error, "Không thể tải bài đăng cần chỉnh sửa."),
        });
      } finally {
        setIsFetchingOldData(false);
      }
    };
    void loadOldData();
  }, [editId, isEditMode]);

  useEffect(() => {
    if (!selectedCategory) {
      setFilteredProductTypes([]);
      return;
    }
    setFilteredProductTypes(
      allProductTypes.filter((item) => item.categoryId === selectedCategory),
    );
  }, [allProductTypes, selectedCategory]);

  useEffect(() => {
    const fetchSchema = async () => {
      if (!selectedProductType) {
        setEavAttributes([]);
        return;
      }
      try {
        setIsLoadingSchema(true);
        const response = await postApi.getAttributesByProductType(selectedProductType);
        const schema = response?.data || [];
        const next = (Array.isArray(schema) ? schema : [])
          .map((attribute: any) => {
            const oldValue = oldEavData.find(
              (item) => item.attributeId === attribute.attributeId,
            );
            return {
              ...attribute,
              selectedOptionId: oldValue?.optionId || "",
              valueBoolean: oldValue?.valueBoolean ?? null,
              valueText: oldValue?.valueText || "",
              valueNumber: oldValue?.valueNumber?.toString() || "",
            };
          })
          .sort((a: any, b: any) => (a.displayOrder || 0) - (b.displayOrder || 0));
        setEavAttributes(next);
      } catch (error) {
        setFormMessage({
          type: "error",
          text: getApiErrorMessage(error, "Không thể tải thông số loại sản phẩm."),
        });
      } finally {
        setIsLoadingSchema(false);
      }
    };
    void fetchSchema();
  }, [oldEavData, selectedProductType]);

  const displayDimensions =
    length && width && height ? `${length} x ${width} x ${height} cm` : "";
  const postAddress = [streetAddress, ward, city].filter(Boolean).join(", ");

  const pickImages = async () => {
    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      setImageError(`Tối đa ${MAX_IMAGES} ảnh.`);
      return;
    }
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remainingSlots,
        quality: 0.8,
      });
      if (!result.canceled) {
        setImages((current) => [
          ...current,
          ...result.assets.map((asset) => asset.uri).slice(0, remainingSlots),
        ]);
        setImageError("");
      }
    } catch (error) {
      setImageError(getApiErrorMessage(error, "Không thể chọn ảnh sản phẩm."));
    }
  };

  const updateEavValue = (index: number, field: string, value: any) => {
    setEavAttributes((current) => {
      const next = [...current];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handlePublish = async () => {
    setFormMessage(null);
    setAddressError("");
    if (!productName.trim() || !basePrice.trim() || images.length === 0) {
      if (images.length === 0) setImageError("Vui lòng chọn ít nhất 1 ảnh.");
      setFormMessage({
        type: "error",
        text: "Vui lòng nhập tên sản phẩm, giá và ít nhất 1 ảnh trước khi đăng.",
      });
      return;
    }
    if (!city.trim() || !ward.trim() || !streetAddress.trim()) {
      setAddressError("Vui lòng chọn đầy đủ địa chỉ bài đăng.");
      return;
    }

    try {
      setIsLoading(true);
      const formData = new FormData();
      formData.append("Quantity", quantity);
      if (description) formData.append("Description", description);
      formData.append("City", city);
      formData.append("Ward", ward);
      formData.append("StreetAddress", streetAddress);
      if (deliveryMethod) formData.append("DeliveryMethod", deliveryMethod);
      if (priorityLevel) formData.append("PriorityLevel", priorityLevel);
      const prefix = isBuyPost ? "Requirement" : "Product";
      if (isBuyPost) {
        formData.append("ExpectedPrice", basePrice);
        formData.append(`${prefix}.ExpectedPrice`, basePrice);
      } else {
        formData.append("BasePrice", basePrice);
      }
      formData.append(`${prefix}.ProductName`, productName.trim());
      if (selectedCategory) formData.append(`${prefix}.CategoryId`, selectedCategory);
      if (selectedProductType)
        formData.append(`${prefix}.ProductTypeId`, selectedProductType);
      if (brandId) formData.append(`${prefix}.BrandId`, brandId);
      if (spaceUsage) formData.append(`${prefix}.SpaceUsage`, spaceUsage);
      if (functionalityStatus)
        formData.append(`${prefix}.FunctionalityStatus`, functionalityStatus);
      if (usageDuration) formData.append(`${prefix}.UsageDuration`, usageDuration);
      if (damageLevel) formData.append(`${prefix}.DamageLevel`, damageLevel);
      if (!isBuyPost) {
        if (modelNumber) formData.append(`${prefix}.ModelNumber`, modelNumber);
        if (originalPrice) formData.append(`${prefix}.OriginalPrice`, originalPrice);
        if (detailDescription)
          formData.append(`${prefix}.DetailDescription`, detailDescription);
        if (weight) formData.append(`${prefix}.Weight`, weight);
        if (length) formData.append(`${prefix}.Length`, length);
        if (width) formData.append(`${prefix}.Width`, width);
        if (height) formData.append(`${prefix}.Height`, height);
      }
      eavAttributes.forEach((attribute) => {
        const item: any = { attributeId: attribute.attributeId };
        if (attribute.selectedOptionId) item.optionId = attribute.selectedOptionId;
        else if (attribute.valueBoolean !== null)
          item.valueBoolean = attribute.valueBoolean;
        else if (attribute.valueNumber)
          item.valueNumber = Number(attribute.valueNumber);
        else if (attribute.valueText) item.valueText = attribute.valueText;
        else return;
        formData.append(`${prefix}.AttributeValues`, JSON.stringify(item));
      });
      await Promise.all(
        images.map(async (imageUri, index) => {
          if (imageUri.startsWith("http")) return;
          if (Platform.OS === "web") {
            const response = await fetch(imageUri);
            const blob = await response.blob();
            const extension = blob.type.split("/")[1] || "jpg";
            formData.append("Medias", blob, `image_${index}.${extension}`);
          } else {
            let filename =
              imageUri.split("/").pop()?.split("?")[0] || `image_${index}.jpg`;
            if (!filename.includes(".")) filename = `${filename}.jpg`;
            formData.append("Medias", {
              uri: imageUri.replace("file://", ""),
              name: filename,
              type: "image/jpeg",
            } as any);
          }
        }),
      );
      if (isEditMode) {
        if (isBuyPost) await postApi.updateBuyPost(editId as string, formData);
        else await postApi.updateSellPost(editId as string, formData);
      } else if (isBuyPost) {
        await postApi.createBuyPost(formData);
      } else {
        await postApi.createSellPost(formData);
      }
      router.back();
    } catch (error) {
      setFormMessage({
        type: "error",
        text: getApiErrorMessage(error, "Không thể lưu bài đăng lúc này."),
      });
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

  const SelectBox = ({
    label,
    required = false,
    value,
    placeholder = "Chọn...",
    options,
    onChange,
  }: {
    label: string;
    required?: boolean;
    value: string;
    placeholder?: string;
    options: { label: string; value: string }[];
    onChange: (value: string) => void;
  }) => (
    <View style={styles.flex}>
      <Text style={styles.label}>
        {label} {required ? <Text style={styles.required}>*</Text> : null}
      </Text>
      <TouchableOpacity
        style={styles.inputContainer}
        onPress={() => openSelect(`Chọn ${label}`, options, onChange)}
      >
        <Text style={value ? styles.inputText : styles.placeholderText} numberOfLines={1}>
          {value ? getLabel(value, options) : placeholder}
        </Text>
        <Ionicons name="chevron-down" size={20} color="#547B7D" />
      </TouchableOpacity>
    </View>
  );

  if (isFetchingOldData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingScreen}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải thông tin bài viết...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditMode ? "Sửa tin đăng" : isBuyPost ? "Đăng tin thu mua" : "Đăng tin mới"}
          </Text>
          <TouchableOpacity onPress={() => void handlePublish()} disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={styles.publishButtonText}>{isEditMode ? "Cập nhật" : "Đăng"}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {formMessage ? (
            <View
              style={[
                styles.inlineMessage,
                formMessage.type === "error"
                  ? styles.inlineMessageError
                  : styles.inlineMessageInfo,
              ]}
            >
              <Ionicons
                name={
                  formMessage.type === "error"
                    ? "alert-circle-outline"
                    : "information-circle-outline"
                }
                size={18}
                color={formMessage.type === "error" ? "#7A1012" : "#2B5659"}
              />
              <Text
                style={[
                  styles.inlineMessageText,
                  formMessage.type === "error"
                    ? styles.inlineErrorText
                    : styles.inlineInfoText,
                ]}
              >
                {formMessage.text}
              </Text>
            </View>
          ) : null}

          <View style={styles.cardSection}>
            <Text style={styles.label}>
              {isBuyPost ? "Hình ảnh minh họa yêu cầu" : "Hình ảnh sản phẩm"}{" "}
              <Text style={styles.required}>* (1-{MAX_IMAGES} ảnh)</Text>
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <TouchableOpacity style={styles.addImageBox} onPress={() => void pickImages()}>
                <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
                <Text style={styles.addImageText}>Thêm ảnh</Text>
              </TouchableOpacity>
              {images.map((uri, index) => (
                <View key={`${uri}-${index}`} style={styles.imagePreviewWrapper}>
                  <Image source={{ uri }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => {
                      setImages((current) => current.filter((_, itemIndex) => itemIndex !== index));
                      setImageError("");
                    }}
                  >
                    <Ionicons name="close-circle" size={22} color={COLORS.error} />
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
            {imageError ? <Text style={styles.fieldError}>{imageError}</Text> : null}
          </View>

          <View style={styles.cardSection}>
            <SectionTitle title="THÔNG TIN CƠ BẢN" />
            <Text style={styles.label}>
              Tên sản phẩm <Text style={styles.required}>*</Text>
            </Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder={isBuyPost ? "VD: Cần mua tủ lạnh cũ..." : "Nhập tiêu đề sản phẩm..."}
                placeholderTextColor="#547B7D"
                value={productName}
                onChangeText={(value) => {
                  setProductName(value);
                  setFormMessage(null);
                }}
              />
            </View>
            <Text style={styles.label}>Mô tả bài đăng (Ngắn gọn)</Text>
            <View style={[styles.inputContainer, styles.shortDescription]}>
              <TextInput
                style={styles.input}
                multiline
                placeholder={isBuyPost ? "VD: Cần mua gấp số lượng lớn..." : "VD: Cần pass gấp tủ lạnh vì chuyển trọ..."}
                placeholderTextColor="#547B7D"
                value={description}
                onChangeText={setDescription}
              />
            </View>
            <View style={styles.row}>
              <SelectBox
                label="Phân loại"
                required
                value={selectedCategory}
                options={categories}
                onChange={(value) => {
                  setSelectedCategory(value);
                  setSelectedProductType("");
                }}
              />
              <SelectBox
                label="Loại sản phẩm"
                required
                value={selectedProductType}
                options={filteredProductTypes}
                onChange={setSelectedProductType}
              />
            </View>
            <View style={styles.row}>
              <SelectBox label="Thương hiệu" required value={brandId} options={brands} onChange={setBrandId} />
              {!isBuyPost ? (
                <View style={styles.flex}>
                  <Text style={styles.label}>Mã Model</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="VD: RT38K5982BS"
                      placeholderTextColor="#547B7D"
                      value={modelNumber}
                      onChangeText={setModelNumber}
                    />
                  </View>
                </View>
              ) : null}
            </View>
            {!isBuyPost ? (
              <>
                <Text style={styles.label}>Mô tả chi tiết sản phẩm</Text>
                <View style={[styles.inputContainer, styles.detailDescription]}>
                  <TextInput
                    style={styles.input}
                    multiline
                    placeholder="Mô tả tình trạng, đặc điểm nổi bật của máy..."
                    placeholderTextColor="#547B7D"
                    value={detailDescription}
                    onChangeText={setDetailDescription}
                  />
                </View>
              </>
            ) : null}
          </View>

          {selectedProductType ? (
            <View style={styles.cardSection}>
              <SectionTitle title="THÔNG SỐ KỸ THUẬT" />
              {isLoadingSchema ? (
                <ActivityIndicator color={COLORS.primary} style={styles.schemaLoader} />
              ) : null}
              {eavAttributes.map((attribute, index) => {
                if (attribute.inputMode === null || attribute.inputMode === undefined) return null;
                const mode = attribute.inputMode;
                const isOptionAllowed =
                  mode === 1 || mode === "OptionOnly" || mode === 3 || mode === "OptionOrCustom";
                const isCustomAllowed =
                  mode === 2 || mode === "CustomOnly" || mode === 3 || mode === "OptionOrCustom";
                const optionList =
                  attribute.options?.map((option: any) => ({
                    label: option.optionValue,
                    value: option.optionId,
                  })) || [];
                const displayUnit =
                  typeof attribute.unit === "string" &&
                  attribute.unit &&
                  attribute.unit.toLowerCase() !== "string"
                    ? ` (${attribute.unit})`
                    : "";
                return (
                  <View key={attribute.attributeId} style={styles.rawBlock}>
                    <Text style={styles.rawLabel}>
                      {attribute.attributeName}
                      {displayUnit}
                      {attribute.isRequired ? <Text style={styles.required}> *</Text> : null}
                    </Text>
                    {isOptionAllowed ? (
                      <TouchableOpacity
                        style={styles.rawDropdownContainer}
                        onPress={() =>
                          openSelect(`Chọn ${attribute.attributeName}`, optionList, (value) =>
                            updateEavValue(index, "selectedOptionId", value),
                          )
                        }
                      >
                        <Text
                          style={attribute.selectedOptionId ? styles.inputText : styles.placeholderText}
                          numberOfLines={1}
                        >
                          {attribute.selectedOptionId
                            ? getLabel(attribute.selectedOptionId, optionList)
                            : "Chọn..."}
                        </Text>
                        <Ionicons name="chevron-down" size={20} color="#547B7D" />
                      </TouchableOpacity>
                    ) : null}
                    {isCustomAllowed ? (
                      <View style={styles.customAttributeGroup}>
                        <View style={styles.row}>
                          <TouchableOpacity
                            style={[
                              styles.boolBtn,
                              attribute.valueBoolean === true ? styles.boolBtnActive : undefined,
                            ]}
                            onPress={() => updateEavValue(index, "valueBoolean", true)}
                          >
                            <Text
                              style={[
                                styles.boolBtnText,
                                attribute.valueBoolean === true ? styles.boolBtnTextActive : undefined,
                              ]}
                            >
                              Có / Bật
                            </Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.boolBtn,
                              attribute.valueBoolean === false ? styles.boolBtnActiveRed : undefined,
                            ]}
                            onPress={() => updateEavValue(index, "valueBoolean", false)}
                          >
                            <Text
                              style={[
                                styles.boolBtnText,
                                attribute.valueBoolean === false ? styles.boolBtnTextActive : undefined,
                              ]}
                            >
                              Không / Tắt
                            </Text>
                          </TouchableOpacity>
                        </View>
                        <View style={styles.rawInputContainer}>
                          <TextInput
                            style={styles.rawInput}
                            placeholder="Nhập chữ tự do..."
                            placeholderTextColor="#547B7D"
                            value={attribute.valueText}
                            onChangeText={(text) => updateEavValue(index, "valueText", text)}
                          />
                        </View>
                        <View style={styles.rawInputContainer}>
                          <TextInput
                            style={styles.rawInput}
                            placeholder="Nhập số..."
                            placeholderTextColor="#547B7D"
                            keyboardType="numeric"
                            value={attribute.valueNumber}
                            onChangeText={(text) => updateEavValue(index, "valueNumber", text)}
                          />
                        </View>
                      </View>
                    ) : null}
                  </View>
                );
              })}
            </View>
          ) : null}

          <View style={styles.cardSection}>
            <SectionTitle title="TÌNH TRẠNG CHUNG" />
            {!isBuyPost ? (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.label}>Kích thước (DxRxC)</Text>
                  <TouchableOpacity style={styles.inputContainer} onPress={() => setShowDimensionsModal(true)}>
                    <Text style={displayDimensions ? styles.inputText : styles.placeholderText} numberOfLines={1}>
                      {displayDimensions || "VD: 120 x 60 x 80 cm"}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#547B7D" />
                  </TouchableOpacity>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.label}>Cân nặng (kg)</Text>
                  <View style={styles.inputContainer}>
                    <TextInput style={styles.input} keyboardType="numeric" placeholder="VD: 15" placeholderTextColor="#547B7D" value={weight} onChangeText={setWeight} />
                  </View>
                </View>
              </View>
            ) : null}
            <View style={styles.row}>
              <SelectBox label="Không gian dùng" value={spaceUsage} options={SPACE_USAGE_OPTIONS} onChange={setSpaceUsage} />
              <SelectBox label="Mức độ hư hại" value={damageLevel} options={DAMAGE_LEVEL_OPTIONS} onChange={setDamageLevel} />
            </View>
            <View style={styles.row}>
              <SelectBox label="Tình trạng HĐ" required value={functionalityStatus} options={FUNC_STATUS_OPTIONS} onChange={setFunctionalityStatus} />
              <View style={styles.flex}>
                <Text style={styles.label}>Thời gian SD (Năm)</Text>
                <View style={styles.inputContainer}>
                  <TextInput style={styles.input} keyboardType="numeric" placeholder="VD: 2" placeholderTextColor="#547B7D" value={usageDuration} onChangeText={setUsageDuration} />
                </View>
              </View>
            </View>
          </View>

          <View style={styles.cardSection}>
            <SectionTitle title="GIAO DỊCH & MỨC GIÁ" />
            <View style={styles.row}>
              <View style={styles.flex}>
                <Text style={styles.label}>
                  {isBuyPost ? "Giá thu mua dự kiến" : "Giá mong muốn"}{" "}
                  <Text style={styles.required}>*</Text>
                </Text>
                <View style={styles.inputContainer}>
                  <TextInput style={styles.input} keyboardType="numeric" placeholder="VNĐ" placeholderTextColor="#547B7D" value={basePrice} onChangeText={(value) => { setBasePrice(value); setFormMessage(null); }} />
                </View>
              </View>
              {!isBuyPost ? (
                <View style={styles.flex}>
                  <Text style={styles.label}>Giá lúc mua</Text>
                  <View style={styles.inputContainer}>
                    <TextInput style={styles.input} keyboardType="numeric" placeholder="VNĐ" placeholderTextColor="#547B7D" value={originalPrice} onChangeText={setOriginalPrice} />
                  </View>
                </View>
              ) : null}
            </View>
            <Text style={styles.label}>Số lượng *</Text>
            <View style={styles.inputContainer}>
              <TextInput style={styles.input} keyboardType="numeric" placeholder="Nhập SL..." placeholderTextColor="#547B7D" value={quantity} onChangeText={setQuantity} />
            </View>
          </View>

          <View style={styles.cardSection}>
            <SectionTitle title="VẬN CHUYỂN & VỊ TRÍ" />
            <View style={styles.row}>
              <SelectBox label="Vận chuyển" value={deliveryMethod} options={DELIVERY_OPTIONS} onChange={setDeliveryMethod} />
              <SelectBox label="Ưu tiên" value={priorityLevel} options={PRIORITY_OPTIONS} onChange={setPriorityLevel} />
            </View>
            <Text style={styles.label}>
              Địa chỉ bài đăng <Text style={styles.required}>*</Text>
            </Text>
            <AddressPickerField
              value={postAddress}
              onChange={(_value, selection) => {
                setCity(selection.provinceName);
                setWard(selection.wardName);
                setStreetAddress(selection.streetAddress);
                setAddressError("");
              }}
              placeholder="Chọn Tỉnh/Thành, Phường/Xã và số nhà/tên đường"
              disabled={isLoading}
              hasError={Boolean(addressError)}
            />
            {addressError ? <Text style={styles.fieldError}>{addressError}</Text> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showDimensionsModal} animationType="slide" transparent onRequestClose={() => setShowDimensionsModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, styles.dimensionModal]}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Chi tiết Kích thước</Text>
                <TouchableOpacity onPress={() => setShowDimensionsModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              {[
                ["Chiều dài (cm)", length, setLength, "VD: 120"],
                ["Chiều rộng (cm)", width, setWidth, "VD: 60"],
                ["Chiều cao (cm)", height, setHeight, "VD: 80"],
              ].map(([label, value, setter, placeholder]) => (
                <View key={label as string}>
                  <Text style={styles.label}>{label as string}</Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder={placeholder as string}
                      placeholderTextColor="#547B7D"
                      value={value as string}
                      onChangeText={setter as (value: string) => void}
                    />
                  </View>
                </View>
              ))}
              <TouchableOpacity style={styles.primaryButton} onPress={() => setShowDimensionsModal(false)}>
                <Text style={styles.primaryButtonText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={showSelectModal} animationType="fade" transparent onRequestClose={() => setShowSelectModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{modalTitle}</Text>
              <TouchableOpacity onPress={() => setShowSelectModal(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
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
              ListEmptyComponent={<Text style={styles.modalEmptyText}>Không có dữ liệu</Text>}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  loadingScreen: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 12, color: COLORS.textLight },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border, backgroundColor: COLORS.white },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: "bold", color: COLORS.text },
  publishButtonText: { fontSize: 16, fontWeight: "bold", color: COLORS.primary },
  scrollContainer: { padding: 16, paddingBottom: 40 },
  inlineMessage: { flexDirection: "row", alignItems: "flex-start", gap: 8, borderWidth: 1, borderRadius: 10, padding: 12, marginBottom: 16 },
  inlineMessageError: { backgroundColor: "rgba(122, 16, 18, 0.08)", borderColor: "rgba(122, 16, 18, 0.22)" },
  inlineMessageInfo: { backgroundColor: "rgba(84, 123, 125, 0.10)", borderColor: "rgba(84, 123, 125, 0.24)" },
  inlineMessageText: { flex: 1, fontSize: 12, lineHeight: 18 },
  inlineErrorText: { color: "#7A1012" },
  inlineInfoText: { color: "#2B5659" },
  fieldError: { color: "#7A1012", fontSize: 12, lineHeight: 17, marginTop: 4 },
  cardSection: { backgroundColor: COLORS.white, borderRadius: 12, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  sectionTitleContainer: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  sectionTitleBar: { width: 4, height: 16, backgroundColor: COLORS.primary, borderRadius: 2, marginRight: 8 },
  sectionTitleText: { fontSize: 15, fontWeight: "bold", color: "#172830", textTransform: "uppercase" },
  addImageBox: { width: 90, height: 90, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary, borderStyle: "dashed", backgroundColor: "rgba(84, 123, 125, 0.10)", justifyContent: "center", alignItems: "center", marginRight: 12 },
  addImageText: { fontSize: 12, color: COLORS.primary, fontWeight: "600", marginTop: 4 },
  imagePreviewWrapper: { position: "relative", marginRight: 12 },
  imagePreview: { width: 90, height: 90, borderRadius: 12 },
  removeImageBtn: { position: "absolute", top: -6, right: -6, backgroundColor: COLORS.white, borderRadius: 12 },
  label: { fontSize: 13, fontWeight: "600", color: COLORS.text, marginBottom: 8 },
  required: { color: COLORS.error, fontWeight: "normal" },
  inputContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, minHeight: 46, backgroundColor: "#F8F9FA", marginBottom: 16, overflow: "hidden" },
  shortDescription: { minHeight: 80, alignItems: "flex-start", paddingTop: 12 },
  detailDescription: { minHeight: 100, alignItems: "flex-start", paddingTop: 12 },
  input: { flex: 1, fontSize: 14, color: COLORS.text, minHeight: 44, minWidth: 0, ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) },
  inputText: { flex: 1, fontSize: 14, color: COLORS.text },
  placeholderText: { flex: 1, fontSize: 14, color: "#547B7D" },
  row: { flexDirection: "row", gap: 12 },
  schemaLoader: { padding: 20 },
  rawBlock: { marginBottom: 20, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#BAC2C1" },
  rawLabel: { fontSize: 14, fontWeight: "bold", color: "#172830", marginBottom: 8 },
  rawInputContainer: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#BAC2C1", borderRadius: 8, paddingHorizontal: 10, height: 44, backgroundColor: "#F8F9FA", marginBottom: 12 },
  rawInput: { flex: 1, fontSize: 14, color: "#172830", height: "100%", ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}) },
  rawDropdownContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: "#BAC2C1", borderRadius: 8, paddingHorizontal: 10, height: 44, backgroundColor: COLORS.white, marginBottom: 12 },
  customAttributeGroup: { gap: 12 },
  boolBtn: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: "#BAC2C1", backgroundColor: "#F8F9FA" },
  boolBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  boolBtnActiveRed: { backgroundColor: COLORS.error, borderColor: COLORS.error },
  boolBtnText: { fontSize: 14, fontWeight: "600", color: "#547B7D" },
  boolBtnTextActive: { color: COLORS.white },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalContent: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, maxHeight: "70%" },
  dimensionModal: { maxHeight: "90%" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#BAC2C1" },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  modalOptionBtn: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#F8F9FA" },
  modalOptionText: { fontSize: 16, color: COLORS.text },
  modalEmptyText: { textAlign: "center", color: "#547B7D", marginTop: 20 },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: 12, height: 48, justifyContent: "center", alignItems: "center", marginTop: 8, marginBottom: Platform.OS === "ios" ? 16 : 0 },
  primaryButtonText: { color: COLORS.white, fontSize: 15, fontWeight: "bold" },
});