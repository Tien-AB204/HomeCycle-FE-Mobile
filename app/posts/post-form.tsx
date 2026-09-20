import { Ionicons } from "@expo/vector-icons";
import { usePreventRemove } from "@react-navigation/native";
import * as ImagePicker from "expo-image-picker";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import AddressPickerField from "../../src/components/shared/AddressPickerField";
import { ModalBackdrop, ModalSurface } from "../../src/components/shared/ModalBackdrop";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import { validateNewLocalFiles } from "../../src/services/fileUploadPolicy";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import { useAutoDismissFeedback } from "../../src/utils/useAutoDismissFeedback";
import { useGuardedRouter } from "../../src/utils/tapGuard";
import { useSubscription } from "../../src/contexts/SubscriptionContext";
import SupplierSuggestionPanel from "../../src/components/posts/SupplierSuggestionPanel";
import {
  SupplierMatchAdvancedFilters,
  SupplierMatchDraftRequest,
  SupplierMatchValidationErrors,
  supplierMatchApi,
} from "../../src/services/apis/supplierMatchApi";

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
      .get("/brands/active", { params: { PageSize: 100, PageNumber: 1 } })
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
  createBuyPost: (data: Record<string, unknown>) =>
    apiClient.post("/posts/create/buy", data, {
      timeout: 30000,
    }),
  updateBuyPost: (
    postId: string,
    data: Record<string, unknown>,
  ) =>
    apiClient.patch(`/posts/update/buy/${postId}`, data, {
      timeout: 30000,
    }),
  getAiPriceQuota: () =>
    apiClient.get("/ai/price-suggestions/quota").then((response) => response.data),
  getAiPriceSuggestion: (data: AiPriceSuggestionRequest) =>
    apiClient.post("/ai/price-suggestions/draft", data, { timeout: 60000 }).then((response) => response.data),
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
// Số lượng: số nguyên. Tin thu mua giới hạn 1–99.999 theo Backend; tin bán tối thiểu 1.
const BUY_QUANTITY_MAX = 99999;
const validateQuantityInput = (raw: string, isBuy: boolean): string => {
  const text = raw.trim();
  if (!text) return "Vui lòng nhập số lượng.";
  if (!/^\d+$/.test(text)) return "Số lượng phải là số nguyên, không có dấu thập phân.";
  const value = Number(text);
  if (!Number.isInteger(value) || value <= 0) return "Số lượng phải là số nguyên lớn hơn 0.";
  if (isBuy && value > BUY_QUANTITY_MAX) return "Số lượng thu mua tối đa là 99.999.";
  return "";
};

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

type EavValueField =
  | "selectedOptionId"
  | "valueBoolean"
  | "valueText"
  | "valueNumber";

type AttributeDataType =
  | "Text"
  | "Number"
  | "Boolean";

type AttributeInputMode =
  | "OptionOnly"
  | "CustomOnly"
  | "OptionOrCustom";

type AiPriceAttributeValue = {
  attributeId: string;
  optionId?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueText?: string;
};

type AiPriceSuggestionRequest = {
  product: {
    productTypeId: string;
    brandId: string;
    productName: string;
    modelNumber: string;
    functionalityStatus: string;
    damageLevel: string;
    usageDuration?: number;
    attributeValues: AiPriceAttributeValue[];
  };
};

type AiPriceSuggestionResult = {
  status?: string;
  suggestedPrice?: number | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  confidence?: string;
  explanation?: string;
  remainingToday?: number;
  resetsAt?: string;
};

type AiPriceQuota = {
  dailyLimit?: number;
  remainingToday?: number;
  resetsAt?: string;
};

const EAV_CLEAR_OPTION = "__homecycle_eav_clear__";
const SELECT_CLEAR_OPTION = "__homecycle_select_clear__";

const normalizeAttributeDataType = (
  value: unknown,
): AttributeDataType | null => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "1" || normalized === "text") {
    return "Text";
  }

  if (normalized === "2" || normalized === "number") {
    return "Number";
  }

  if (normalized === "3" || normalized === "boolean") {
    return "Boolean";
  }

  return null;
};

// Thu thập giá trị thuộc tính động hiện có trên form (dùng chung cho gợi ý giá
// và gợi ý nhà cung cấp). Mỗi thuộc tính chỉ mang đúng một giá trị/tùy chọn.
const collectDraftAttributeValues = (eavAttributes: any[]) => {
  const attributeValues: AiPriceAttributeValue[] = [];
  let missingRequiredAttribute = false;
  for (const attribute of eavAttributes) {
    const attributeId = String(attribute?.attributeId || "");
    let value: AiPriceAttributeValue | null = null;
    if (attributeId && attribute?.selectedOptionId) {
      value = { attributeId, optionId: String(attribute.selectedOptionId) };
    } else {
      const dataType = normalizeAttributeDataType(attribute?.dataType);
      if (dataType === "Boolean" && typeof attribute?.valueBoolean === "boolean") {
        value = { attributeId, valueBoolean: attribute.valueBoolean };
      } else if (dataType === "Number" && String(attribute?.valueNumber ?? "").trim()) {
        const valueNumber = Number(attribute.valueNumber);
        if (Number.isFinite(valueNumber)) value = { attributeId, valueNumber };
      } else if (dataType === "Text" && String(attribute?.valueText ?? "").trim()) {
        value = { attributeId, valueText: String(attribute.valueText).trim() };
      }
    }
    if (attribute?.isRequired && !value) missingRequiredAttribute = true;
    if (value) attributeValues.push(value);
  }
  return { attributeValues, missingRequiredAttribute };
};

const normalizeAttributeInputMode = (
  value: unknown,
): AttributeInputMode | null => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  if (normalized === "1" || normalized === "optiononly") {
    return "OptionOnly";
  }

  if (normalized === "2" || normalized === "customonly") {
    return "CustomOnly";
  }

  if (
    normalized === "3" ||
    normalized === "optionorcustom"
  ) {
    return "OptionOrCustom";
  }

  return null;
};

export default function PostFormScreen() {
  const router = useGuardedRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || "personal";
  const { editId, postType: urlPostType, buyPostId } = useLocalSearchParams();
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
  const procurementBuyPostId = !isEditMode && !isBuyPost && userRole === "personal"
    ? (Array.isArray(buyPostId) ? buyPostId[0] : buyPostId) : undefined;
  const publishLock = useRef(false);
  // Tên tệp / MIME thật từ ImagePicker theo URI; state ảnh vẫn là danh sách URI.
  const imageMetaRef = useRef<Record<string, { fileName?: string | null; mimeType?: string | null }>>({});
  const createdSellId = useRef<string | null>(null);
  const uncertainSellCreate = useRef(false);
  const [sellCreateNeedsRecovery, setSellCreateNeedsRecovery] = useState(false);
  const [sellContinuationPending, setSellContinuationPending] = useState(false);
  const formMounted = useRef(false);
  const sellNavigationLock = useRef(false);

  const [isLoading, setIsLoading] = useState(false);
  usePreventRemove(!isEditMode && !isBuyPost && isLoading, () => {});
  useEffect(() => {
    formMounted.current = true;
    return () => { formMounted.current = false; };
  }, []);
  useFocusEffect(useCallback(() => {
    sellNavigationLock.current = false;
  }, []));
  const [isFetchingOldData, setIsFetchingOldData] = useState(isEditMode);
  const [formMessage, setFormMessage] = useState<InlineMessage>(null);
  useAutoDismissFeedback(formMessage, () => setFormMessage(null));
  const [imageError, setImageError] = useState("");
  const [addressError, setAddressError] = useState("");
  const [weightError, setWeightError] = useState("");
  const [quantityError, setQuantityError] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [allProductTypes, setAllProductTypes] = useState<any[]>([]);
  const [filteredProductTypes, setFilteredProductTypes] = useState<any[]>([]);
  const [brands, setBrands] = useState<any[]>([]);
  const [legacyEditBrandOption, setLegacyEditBrandOption] = useState<{
    label: string;
    value: string;
  } | null>(null);
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
  const [priceFrom, setPriceFrom] = useState("");
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
  const [aiPriceQuota, setAiPriceQuota] = useState<AiPriceQuota | null>(null);
  const [aiPriceResult, setAiPriceResult] = useState<(AiPriceSuggestionResult & { contextKey: string }) | null>(null);
  const [isAiPriceLoading, setIsAiPriceLoading] = useState(false);
  const [aiPriceMessage, setAiPriceMessage] = useState<InlineMessage>(null);
  useAutoDismissFeedback(aiPriceMessage, () => setAiPriceMessage(null));
  const aiPriceRequestRef = useRef(false);

  const canUseAiPriceSuggestion = !isEditMode && !isBuyPost && user?.role?.toLowerCase() === "personal";
  // Hạn mức AI đổi khi gói đăng ký đổi (kích hoạt/hủy/hết hạn) → tải lại từ API có thẩm quyền.
  const { entitlementVersion: subscriptionEntitlementVersion } = useSubscription();
  const aiPricingContext = useMemo(() => {
    const { attributeValues, missingRequiredAttribute } = collectDraftAttributeValues(eavAttributes);

    const validUsageDuration = usageDuration.trim() === "" ||
      (Number.isFinite(Number(usageDuration)) && Number(usageDuration) >= 0);
    const product = {
      productTypeId: selectedProductType.trim(),
      brandId: brandId.trim(),
      productName: productName.trim(),
      modelNumber: modelNumber.trim(),
      functionalityStatus,
      damageLevel,
      ...(usageDuration.trim() ? { usageDuration: Number(usageDuration) } : {}),
      attributeValues,
    };
    const missingCore = !product.productTypeId || !product.brandId || !product.productName ||
      !product.modelNumber || !product.functionalityStatus || !product.damageLevel;
    const issue = missingCore
      ? "Hoàn tất thông tin sản phẩm để nhận gợi ý giá."
      : isLoadingSchema
        ? "Đang tải thông số sản phẩm."
        : missingRequiredAttribute
          ? "Hoàn tất các thông số bắt buộc để nhận gợi ý giá."
          : !validUsageDuration
            ? "Thời gian sử dụng chưa hợp lệ."
            : attributeValues.length > 30
              ? "Sản phẩm có quá nhiều thông số để gợi ý giá."
              : "";
    return {
      request: { product } as AiPriceSuggestionRequest,
      key: JSON.stringify(product),
      issue,
    };
  }, [brandId, damageLevel, eavAttributes, functionalityStatus, isLoadingSchema, modelNumber, productName, selectedProductType, usageDuration]);
  const isAiPriceStale = Boolean(aiPriceResult && aiPriceResult.contextKey !== aiPricingContext.key);

  // Gợi ý nhà cung cấp (Doanh nghiệp, tạo tin thu mua): dùng giá trị form hiện tại,
  // KHÔNG tạo tin. Sẵn sàng khi có loại/danh mục, số lượng và giá hợp lệ, thuộc tính
  // bắt buộc đã điền theo metadata hiện tại của loại sản phẩm.
  const canUseSupplierSuggestion = !isEditMode && isBuyPost && userRole === "business";
  const supplierDraftContext = useMemo(() => {
    const { attributeValues, missingRequiredAttribute } = collectDraftAttributeValues(eavAttributes);
    const parsedPriceFrom = priceFrom.trim() ? Number(priceFrom) : null;
    const parsedPriceTo = basePrice.trim() ? Number(basePrice) : null;
    const priceInvalid =
      (parsedPriceFrom !== null && (!Number.isFinite(parsedPriceFrom) || parsedPriceFrom < 0)) ||
      (parsedPriceTo !== null && (!Number.isFinite(parsedPriceTo) || parsedPriceTo < 0)) ||
      (parsedPriceFrom !== null && parsedPriceTo !== null && parsedPriceFrom > parsedPriceTo);
    const quantityIssue = validateQuantityInput(quantity, true);
    const validUsageDuration =
      usageDuration.trim() === "" || (Number.isFinite(Number(usageDuration)) && Number(usageDuration) >= 0);
    const productTypeId = selectedProductType.trim() || null;
    const request: SupplierMatchDraftRequest = {
      categoryId: selectedCategory.trim() || null,
      productTypeId,
      brandId: brandId.trim() || null,
      modelNumber: modelNumber.trim() || null,
      functionalityStatus: functionalityStatus || null,
      damageLevel: damageLevel || null,
      usageDuration: usageDuration.trim() ? Number(usageDuration) : null,
      priceFrom: parsedPriceFrom,
      priceTo: parsedPriceTo,
      quantity: quantityIssue ? 0 : Number(quantity),
      city: city.trim() || null,
      // Backend chỉ chấp nhận thuộc tính động khi đã có loại sản phẩm.
      attributeValues: productTypeId ? attributeValues : [],
    };
    const hint = !request.productTypeId && !request.categoryId
      ? "Chọn loại sản phẩm hoặc danh mục để gợi ý nhà cung cấp."
      : quantityIssue
        ? quantityIssue
        : priceInvalid
          ? "Khoảng giá thu mua chưa hợp lệ."
          : isLoadingSchema
            ? "Đang tải thông số sản phẩm."
            : missingRequiredAttribute
              ? "Hoàn tất các thông số bắt buộc để gợi ý nhà cung cấp."
              : !validUsageDuration
                ? "Thời gian sử dụng chưa hợp lệ."
                : attributeValues.length > 30
                  ? "Sản phẩm có quá nhiều thông số để gợi ý."
                  : null;
    return { request, key: JSON.stringify(request), readiness: { ready: !hint, hint } };
  }, [basePrice, brandId, city, damageLevel, eavAttributes, functionalityStatus, isLoadingSchema, modelNumber, priceFrom, quantity, selectedCategory, selectedProductType, usageDuration]);

  const requestSupplierDraftMatches = useCallback(
    (filters: SupplierMatchAdvancedFilters | null) =>
      supplierMatchApi.matchDraft(
        filters ? { ...supplierDraftContext.request, advancedFilters: filters } : supplierDraftContext.request,
      ),
    [supplierDraftContext.request],
  );
  const handleSupplierValidationErrors = useCallback((errors: SupplierMatchValidationErrors) => {
    const quantityMessages = Object.entries(errors).find(([key]) => key.toLowerCase() === "quantity")?.[1];
    if (quantityMessages?.length) setQuantityError(quantityMessages[0]);
  }, []);
  const supplierAttributeNames = useMemo(() => {
    const names: Record<string, string> = {};
    for (const attribute of eavAttributes) {
      const id = String(attribute?.attributeId || "").toLowerCase();
      if (id) names[id] = String(attribute?.attributeName || "Thông số");
    }
    return names;
  }, [eavAttributes]);

  const brandOptions = useMemo(() => {
    if (
      !legacyEditBrandOption ||
      String(brandId).trim() !== String(legacyEditBrandOption.value).trim() ||
      brands.some(
        (option: any) =>
          String(option?.value || "").trim() ===
          String(legacyEditBrandOption.value).trim(),
      )
    ) {
      return brands;
    }

    return [legacyEditBrandOption, ...brands];
  }, [brandId, brands, legacyEditBrandOption]);

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
        const brandItems = brandRes?.items || brandRes?.data?.items || brandRes?.data || brandRes || [];
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
    if (!canUseAiPriceSuggestion) return;
    let active = true;
    void postApi.getAiPriceQuota()
      .then((response) => {
        if (!active) return;
        const quota = response?.data || response;
        setAiPriceQuota({
          dailyLimit: Number(quota?.dailyLimit),
          remainingToday: Number(quota?.remainingToday),
          resetsAt: quota?.resetsAt ? String(quota.resetsAt) : undefined,
        });
      })
      .catch(() => {
        // The POST remains authoritative; a failed quota display must not
        // prevent a manual, eligible request.
      });
    return () => { active = false; };
  }, [canUseAiPriceSuggestion, subscriptionEntitlementVersion]);

  useEffect(() => {
    if (!aiPriceMessage) return;
    const timeout = setTimeout(
      () => setAiPriceMessage(null),
      aiPriceMessage.type === "info" ? 5000 : 10000,
    );
    return () => clearTimeout(timeout);
  }, [aiPriceMessage]);

  useEffect(() => {
    // Feedback describes a prior draft; results retain their own stale marker.
    setAiPriceMessage(null);
  }, [aiPricingContext.key]);

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
        setPriceFrom(
          data.priceFrom?.toString() ||
            data.minExpectedPrice?.toString() ||
            "",
        );
        setBasePrice(
          data.priceTo?.toString() ||
            data.basePrice?.toString() ||
            data.expectedPrice?.toString() ||
            product.expectedPrice?.toString() ||
            "",
        );
        setQuantity(data.quantity != null ? String(data.quantity) : "1");
        setQuantityError("");
        setCity(data.city || "");
        setWard(data.ward || "");
        setStreetAddress(data.streetAddress || "");
        setDeliveryMethod(data.deliveryMethod || "");
        setPriorityLevel(data.priorityLevel || "");
        setSelectedCategory(product.categoryId || "");
        setSelectedProductType(product.productTypeId || "");

        const currentBrandId = String(product.brandId || "").trim();
        const currentBrandName = String(
          product.brandName ||
            product.brand?.brandName ||
            product.brand?.name ||
            data.brandName ||
            data.brand?.brandName ||
            data.brand?.name ||
            "",
        ).trim();

        setBrandId(currentBrandId);
        setLegacyEditBrandOption(
          currentBrandId
            ? {
                value: currentBrandId,
                label: currentBrandName
                  ? `${currentBrandName} (hiện tại)`
                  : "Thương hiệu hiện tại",
              }
            : null,
        );
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
            const inputMode =
              normalizeAttributeInputMode(
                attribute.inputMode,
              );

            const dataType =
              normalizeAttributeDataType(
                attribute.dataType,
              );

            const optionAllowed =
              inputMode === "OptionOnly" ||
              inputMode === "OptionOrCustom";

            const customAllowed =
              inputMode === "CustomOnly" ||
              inputMode === "OptionOrCustom";

            const validOptionIds = new Set(
              (Array.isArray(attribute.options)
                ? attribute.options
                : []
              ).map((option: any) =>
                String(option.optionId || ""),
              ),
            );

            const oldOptionId = String(
              oldValue?.optionId || "",
            );

            const selectedOptionId =
              optionAllowed &&
              oldOptionId &&
              validOptionIds.has(oldOptionId)
                ? oldOptionId
                : "";

            const hasOption =
              Boolean(selectedOptionId);

            return {
              ...attribute,
              selectedOptionId,
              valueBoolean:
                customAllowed &&
                !hasOption &&
                dataType === "Boolean"
                  ? oldValue?.valueBoolean ?? null
                  : null,
              valueText:
                customAllowed &&
                !hasOption &&
                dataType === "Text"
                  ? oldValue?.valueText || ""
                  : "",
              valueNumber:
                customAllowed &&
                !hasOption &&
                dataType === "Number" &&
                oldValue?.valueNumber !== null &&
                oldValue?.valueNumber !== undefined
                  ? String(oldValue.valueNumber)
                  : "",
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
  // Kiểm tra ngay khi đổi Dài hoặc Rộng: rộng không được lớn hơn dài (bằng nhau hợp lệ).
  const widthDimensionError =
    length.trim() && width.trim() &&
    Number.isFinite(Number(length)) && Number.isFinite(Number(width)) &&
    Number(width) > Number(length)
      ? "Chiều rộng không được lớn hơn chiều dài."
      : "";
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
        const validation = await validateNewLocalFiles(
          "PostMedia",
          result.assets.map((asset) => ({
            fileName: asset.fileName,
            uri: asset.uri,
            fileSize: asset.fileSize,
          })),
        );

        if (!validation.valid) {
          setImageError(validation.message);
          return;
        }

        result.assets.slice(0, remainingSlots).forEach((asset) => {
          imageMetaRef.current[asset.uri] = { fileName: asset.fileName, mimeType: asset.mimeType };
        });
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

  const updateEavValue = (
    index: number,
    field: EavValueField,
    value: string | boolean | null,
  ) => {
    setEavAttributes((current) =>
      current.map((attribute, itemIndex) => {
        if (itemIndex !== index) {
          return attribute;
        }

        return {
          ...attribute,
          selectedOptionId: "",
          valueBoolean: null,
          valueText: "",
          valueNumber: "",
          [field]: value,
        };
      }),
    );
  };

  const requestAiPriceSuggestion = async () => {
    if (aiPriceRequestRef.current || aiPricingContext.issue) return;
    if (Number(aiPriceQuota?.remainingToday) <= 0) return;

    try {
      aiPriceRequestRef.current = true;
      setIsAiPriceLoading(true);
      setAiPriceMessage(null);
      const response = await postApi.getAiPriceSuggestion(aiPricingContext.request);
      const result = response?.data || response;
      const status = String(result?.status || "").trim().toUpperCase();
      const remainingToday = Number(result?.remainingToday);
      const resetsAt = result?.resetsAt ? String(result.resetsAt) : aiPriceQuota?.resetsAt;
      if (Number.isFinite(remainingToday)) {
        setAiPriceQuota((current) => ({
          ...current,
          remainingToday,
          resetsAt,
        }));
      }
      setAiPriceResult({
        ...result,
        status,
        contextKey: aiPricingContext.key,
      });
      if (status === "DAILY_LIMIT_REACHED") {
        setAiPriceQuota((current) => ({ ...current, remainingToday: 0, resetsAt }));
      }
    } catch (error: any) {
      const status = Number(error?.response?.status || 0);
      if (status === 429) {
        setAiPriceQuota((current) => ({
          ...current,
          remainingToday: 0,
          resetsAt: error?.response?.data?.resetsAt || current?.resetsAt,
        }));
        setAiPriceMessage({ type: "info", text: "Bạn đã dùng hết lượt gợi ý giá hôm nay." });
      } else if (status === 400) {
        setAiPriceMessage({ type: "error", text: "Thông tin sản phẩm chưa đủ hoặc chưa hợp lệ để gợi ý giá." });
      } else if (status === 403) {
        setAiPriceMessage({ type: "error", text: "Tính năng gợi ý giá hiện chỉ áp dụng cho tài khoản cá nhân." });
      } else {
        setAiPriceMessage({
          type: "error",
          text: getApiErrorMessage(error, "Không thể gợi ý giá lúc này. Vui lòng thử lại sau."),
        });
      }
    } finally {
      aiPriceRequestRef.current = false;
      setIsAiPriceLoading(false);
    }
  };

  const applyAiSuggestedPrice = () => {
    const suggestedPrice = Number(aiPriceResult?.suggestedPrice);
    if (!isAiPriceStale && Number.isFinite(suggestedPrice) && suggestedPrice > 0) {
      setBasePrice(String(Math.round(suggestedPrice)));
      setFormMessage(null);
    }
  };

  const aiResultStatus = String(aiPriceResult?.status || "").toUpperCase();
  const aiHasUsablePrice = [
    "SUGGESTED",
    "FALLBACK_DB_ONLY",
    "FALLBACK_INTERNAL_LISTINGS",
    "FALLBACK_MARKET_LISTINGS",
    "FALLBACK_EQUIVALENT_MODEL",
  ].includes(aiResultStatus) && Number(aiPriceResult?.suggestedPrice) > 0;
  const aiConfidenceLabel: Record<string, string> = {
    HIGH: "Độ tin cậy cao",
    MEDIUM: "Độ tin cậy khá",
    LOW: "Chỉ mang tính tham khảo",
    NONE: "Chưa đủ dữ liệu",
  };

  const continueAfterSellCreate = useCallback(() => {
    if (!formMounted.current || sellNavigationLock.current) return;
    sellNavigationLock.current = true;
    try {
      if (procurementBuyPostId && createdSellId.current) {
        router.dismissTo({
          pathname: "/posts/[id]",
          params: { id: procurementBuyPostId, sellerRequestSellPostId: createdSellId.current, resumeSellerRequest: "false" },
        });
      } else {
        router.back();
      }
    } catch {
      sellNavigationLock.current = false;
      setFormMessage({ type: "error", text: "Tin bán đã được tạo. Vui lòng bấm Tiếp tục để quay lại." });
    }
  }, [procurementBuyPostId, router]);

  useEffect(() => {
    if (!sellContinuationPending || isLoading) return;
    // Release the write navigation guard before returning to the Buy Post.
    setSellContinuationPending(false);
    continueAfterSellCreate();
  }, [sellContinuationPending, isLoading, continueAfterSellCreate]);

  useEffect(() => {
    if ((isBuyPost || deliveryMethod !== "GhnDelivery") && weightError) {
      setWeightError("");
    }
  }, [deliveryMethod, isBuyPost, weightError]);

  const handlePublish = async () => {
    // Kết quả tạo tin chưa rõ: không gửi lại chỉ vì bấm nút; người dùng phải
    // kiểm tra danh sách tin bán hoặc xác nhận "tin chưa được tạo" trước.
    if (publishLock.current || uncertainSellCreate.current) return;
    if (createdSellId.current) {
      continueAfterSellCreate();
      return;
    }
    setFormMessage(null);
    setAddressError("");
    setImageError("");
    setWeightError("");

    const normalizedWeight = weight.trim().replace(",", ".");
    const quantityValidation = validateQuantityInput(quantity, isBuyPost);
    if (quantityValidation) {
      // Không tự ép giá trị: giữ lỗi tại ô nhập cho tới khi người dùng sửa.
      setQuantityError(quantityValidation);
      setFormMessage({ type: "error", text: quantityValidation });
      return;
    }
    const parsedQuantity = Number(quantity.trim());

    if (widthDimensionError) {
      setFormMessage({ type: "error", text: widthDimensionError });
      return;
    }

    if (!isBuyPost && deliveryMethod === "GhnDelivery") {
      const parsedWeightKg = Number(normalizedWeight);
      const parsedLengthCm = Number(length);
      const parsedWidthCm = Number(width);
      const parsedHeightCm = Number(height);

      if (!Number.isFinite(parsedWeightKg) || parsedWeightKg <= 0) {
        setWeightError(
          "Vui lòng nhập khối lượng sản phẩm lớn hơn 0 kg để giao hàng GHN.",
        );
        return;
      }

      if (parsedWeightKg > 50) {
        setWeightError(
          "GHN chỉ hỗ trợ khối lượng sản phẩm tối đa 50 kg.",
        );
        return;
      }

      if (
        [parsedLengthCm, parsedWidthCm, parsedHeightCm].some(
          (dimension) => !Number.isFinite(dimension) || dimension <= 0,
        )
      ) {
        setFormMessage({
          type: "error",
          text: "Vui lòng nhập đầy đủ chiều dài, chiều rộng và chiều cao lớn hơn 0 cm để giao hàng GHN.",
        });
        return;
      }

      if (
        [parsedLengthCm, parsedWidthCm, parsedHeightCm].some(
          (dimension) => dimension > 200,
        )
      ) {
        setFormMessage({
          type: "error",
          text: "Mỗi chiều kích thước sản phẩm dùng cho GHN không được vượt quá 200 cm.",
        });
        return;
      }
    }

    if (!productName.trim()) {
      setFormMessage({
        type: "error",
        text: "Vui lòng nhập tên sản phẩm.",
      });
      return;
    }

    if (isBuyPost && !description.trim()) {
      setFormMessage({
        type: "error",
        text: "Vui lòng nhập mô tả cho tin thu mua.",
      });
      return;
    }

    if (!isBuyPost && !selectedCategory.trim()) {
      setFormMessage({
        type: "error",
        text: "Vui lòng chọn phân loại sản phẩm.",
      });
      return;
    }

    if (!isBuyPost && !selectedProductType.trim()) {
      setFormMessage({
        type: "error",
        text: "Vui lòng chọn loại sản phẩm.",
      });
      return;
    }

    if (
      !isBuyPost &&
      (!basePrice.trim() || images.length === 0)
    ) {
      if (images.length === 0) {
        setImageError(
          "Vui lòng chọn ít nhất 1 ảnh.",
        );
      }

      setFormMessage({
        type: "error",
        text: "Vui lòng nhập giá và ít nhất 1 ảnh trước khi đăng.",
      });
      return;
    }

    if (!isBuyPost && images.length > 0) {
      const localImages = images.filter((uri) => !uri.startsWith("http"));

      if (localImages.length > 0) {
        const filesValidation = await validateNewLocalFiles(
          "PostMedia",
          localImages.map((uri) => ({ uri })),
        );

        if (!filesValidation.valid) {
          setImageError(filesValidation.message);
          setFormMessage({ type: "error", text: filesValidation.message });
          return;
        }
      }
    }

    const attributeValues: Array<
      Record<string, unknown>
    > = [];

    for (const attribute of eavAttributes) {
      const attributeName =
        String(attribute.attributeName || "Thông số");

      const inputMode =
        normalizeAttributeInputMode(
          attribute.inputMode,
        );

      const dataType =
        normalizeAttributeDataType(
          attribute.dataType,
        );

      if (!inputMode) {
        const hasConfiguredInputMode =
          attribute.inputMode !== null &&
          attribute.inputMode !== undefined;

        if (
          hasConfiguredInputMode ||
          (!isBuyPost && attribute.isRequired)
        ) {
          setFormMessage({
            type: "error",
            text:
              `Cấu hình nhập của thông số "${attributeName}" ` +
              "không hợp lệ.",
          });
          return;
        }

        // Attribute optional chưa được cấu hình InputMode:
        // bỏ qua thay vì chặn toàn bộ bài đăng.
        continue;
      }

      const optionAllowed =
        inputMode === "OptionOnly" ||
        inputMode === "OptionOrCustom";

      const customAllowed =
        inputMode === "CustomOnly" ||
        inputMode === "OptionOrCustom";

      const selectedOptionId =
        String(
          attribute.selectedOptionId || "",
        ).trim();

      let item:
        | Record<string, unknown>
        | null = null;

      if (
        optionAllowed &&
        selectedOptionId
      ) {
        item = {
          attributeId: attribute.attributeId,
          optionId: selectedOptionId,
        };
      } else if (customAllowed) {
        if (!dataType) {
          const hasConfiguredDataType =
            attribute.dataType !== null &&
            attribute.dataType !== undefined;

          if (
            hasConfiguredDataType ||
            (!isBuyPost && attribute.isRequired)
          ) {
            setFormMessage({
              type: "error",
              text:
                `Kiểu dữ liệu của thông số "${attributeName}" ` +
                "không hợp lệ.",
            });
            return;
          }

          // Attribute optional chưa được cấu hình DataType:
          // không tạo EAV value và không block submit.
          continue;
        }

        if (dataType === "Text") {
          const valueText =
            String(
              attribute.valueText ?? "",
            ).trim();

          if (valueText) {
            item = {
              attributeId:
                attribute.attributeId,
              valueText,
            };
          }
        }

        if (dataType === "Number") {
          const rawNumber =
            String(
              attribute.valueNumber ?? "",
            ).trim();

          if (rawNumber) {
            const valueNumber =
              Number(rawNumber);

            if (
              !Number.isFinite(valueNumber)
            ) {
              setFormMessage({
                type: "error",
                text:
                  `Thông số "${attributeName}" ` +
                  "phải là một số hợp lệ.",
              });
              return;
            }

            item = {
              attributeId:
                attribute.attributeId,
              valueNumber,
            };
          }
        }

        if (
          dataType === "Boolean" &&
          attribute.valueBoolean !== null &&
          attribute.valueBoolean !== undefined
        ) {
          item = {
            attributeId:
              attribute.attributeId,
            valueBoolean:
              attribute.valueBoolean,
          };
        }
      }

      if (
        !item &&
        !isBuyPost &&
        attribute.isRequired
      ) {
        setFormMessage({
          type: "error",
          text:
            `Vui lòng nhập thông số bắt buộc ` +
            `"${attributeName}".`,
        });
        return;
      }

      if (item) {
        attributeValues.push(item);
      }
    }

    let sellCreateStarted = false;
    try {
      publishLock.current = true;
      setIsLoading(true);

      if (isBuyPost) {
        const parsedPriceFrom =
          priceFrom.trim()
            ? Number(priceFrom)
            : null;

        const parsedPriceTo =
          basePrice.trim()
            ? Number(basePrice)
            : null;

        if (
          (
            parsedPriceFrom !== null &&
            (
              !Number.isFinite(parsedPriceFrom) ||
              parsedPriceFrom < 0
            )
          ) ||
          (
            parsedPriceTo !== null &&
            (
              !Number.isFinite(parsedPriceTo) ||
              parsedPriceTo < 0
            )
          )
        ) {
          setFormMessage({
            type: "error",
            text: "Mức giá thu mua không hợp lệ.",
          });
          return;
        }

        if (
          parsedPriceFrom !== null &&
          parsedPriceTo !== null &&
          parsedPriceFrom > parsedPriceTo
        ) {
          setFormMessage({
            type: "error",
            text: "Giá từ không được lớn hơn giá đến.",
          });
          return;
        }

        const buyPayload: Record<string, unknown> = {
          title: productName.trim(),
          description: description.trim(),
          categoryId:
            selectedCategory || null,
          productTypeId:
            selectedProductType || null,
          brandId: brandId || null,
          functionalityStatus:
            functionalityStatus || null,
          usageDuration:
            usageDuration.trim()
              ? Number(usageDuration)
              : null,
          damageLevel:
            damageLevel || null,
          attributeValues,
          streetAddress:
            streetAddress.trim() || null,
          ward: ward.trim() || null,
          city: city.trim() || null,
          priorityLevel:
            priorityLevel || null,
          priceFrom: parsedPriceFrom,
          priceTo: parsedPriceTo,
          quantity: parsedQuantity,
        };

        if (isEditMode) {
          await postApi.updateBuyPost(
            editId as string,
            buyPayload,
          );
        } else {
          await postApi.createBuyPost(
            buyPayload,
          );
        }

        router.back();
        return;
      }

      const formData = new FormData();

      formData.append(
        "Quantity",
        String(parsedQuantity),
      );

      if (description) {
        formData.append(
          "Description",
          description,
        );
      }

      if (isEditMode || city.trim()) {
        formData.append(
          "City",
          city.trim(),
        );
      }

      if (isEditMode || ward.trim()) {
        formData.append(
          "Ward",
          ward.trim(),
        );
      }

      if (
        isEditMode ||
        streetAddress.trim()
      ) {
        formData.append(
          "StreetAddress",
          streetAddress.trim(),
        );
      }

      if (deliveryMethod) {
        formData.append(
          "DeliveryMethod",
          deliveryMethod,
        );
      }

      if (priorityLevel) {
        formData.append(
          "PriorityLevel",
          priorityLevel,
        );
      }

      formData.append(
        "BasePrice",
        basePrice,
      );

      const prefix = "Product";

      formData.append(
        `${prefix}.ProductName`,
        productName.trim(),
      );

      if (selectedCategory) {
        formData.append(
          `${prefix}.CategoryId`,
          selectedCategory,
        );
      }

      if (selectedProductType) {
        formData.append(
          `${prefix}.ProductTypeId`,
          selectedProductType,
        );
      }

      if (brandId) {
        formData.append(
          `${prefix}.BrandId`,
          brandId,
        );
      }

      if (spaceUsage) {
        formData.append(
          `${prefix}.SpaceUsage`,
          spaceUsage,
        );
      }

      if (functionalityStatus) {
        formData.append(
          `${prefix}.FunctionalityStatus`,
          functionalityStatus,
        );
      }

      if (usageDuration) {
        formData.append(
          `${prefix}.UsageDuration`,
          usageDuration,
        );
      }

      if (damageLevel) {
        formData.append(
          `${prefix}.DamageLevel`,
          damageLevel,
        );
      }

      if (modelNumber) {
        formData.append(
          `${prefix}.ModelNumber`,
          modelNumber,
        );
      }

      if (originalPrice) {
        formData.append(
          `${prefix}.OriginalPrice`,
          originalPrice,
        );
      }

      if (detailDescription) {
        formData.append(
          `${prefix}.DetailDescription`,
          detailDescription,
        );
      }

      if (weight) {
        formData.append(
          `${prefix}.Weight`,
          normalizedWeight,
        );
      }

      if (length) {
        formData.append(
          `${prefix}.Length`,
          length,
        );
      }

      if (width) {
        formData.append(
          `${prefix}.Width`,
          width,
        );
      }

      if (height) {
        formData.append(
          `${prefix}.Height`,
          height,
        );
      }

      attributeValues.forEach((item) => {
        formData.append(
          `${prefix}.AttributeValues`,
          JSON.stringify(item),
        );
      });

      await Promise.all(
        images.map(
          async (imageUri, index) => {
            if (imageUri.startsWith("http")) {
              return;
            }

            if (Platform.OS === "web") {
              const response =
                await fetch(imageUri);

              const blob =
                await response.blob();

              const extension =
                blob.type.split("/")[1] ||
                "jpg";

              formData.append(
                "Medias",
                blob,
                `image_${index}.${extension}`,
              );

              return;
            }

            // Native: giữ nguyên URI của ImagePicker (đã chạy thật trên Android).
            // Tên tệp và MIME phản ánh đúng tệp người dùng chọn (ImagePicker);
            // không suy từ danh sách định dạng cho phép của Backend (Backend
            // vẫn là nơi kiểm tra cuối theo File Upload Policy).
            const meta = imageMetaRef.current[imageUri];
            let filename =
              String(meta?.fileName ?? "").trim() ||
              imageUri
                .split("/")
                .pop()
                ?.split("?")[0] ||
              `image_${index}`;
            let mimeType = String(meta?.mimeType ?? "").trim().toLowerCase();
            const extension = filename.includes(".")
              ? filename.split(".").pop()!.toLowerCase()
              : "";

            if (!mimeType && extension) {
              // Chỉ khi ImagePicker không cung cấp MIME: suy từ phần mở rộng thật của tệp.
              mimeType = `image/${extension === "jpg" ? "jpeg" : extension}`;
            }
            if (!extension && mimeType.startsWith("image/")) {
              filename = `${filename}.${mimeType.slice("image/".length) === "jpeg" ? "jpg" : mimeType.slice("image/".length)}`;
            }

            formData.append(
              "Medias",
              {
                uri: imageUri,
                name: filename,
                ...(mimeType ? { type: mimeType } : {}),
              } as any,
            );
          },
        ),
      );

      if (!formMounted.current) return;
      if (isEditMode) {
        await postApi.updateSellPost(
          editId as string,
          formData,
        );
      } else {
        sellCreateStarted = true;
        const response = await postApi.createSellPost(
          formData,
        );

        const postId = response.data?.postId;
        if (typeof postId !== "string" || !postId.trim()) {
          uncertainSellCreate.current = true;
          if (!formMounted.current) return;
          setSellCreateNeedsRecovery(true);
          setFormMessage({
            type: "error",
            text: "Chưa xác nhận được tin vừa tạo. Hãy kiểm tra tin bán của bạn trước khi đăng thêm.",
          });
          return;
        }
        createdSellId.current = postId;
        if (formMounted.current) setSellContinuationPending(true);
        return;
      }

      router.back();
    } catch (error) {
      if (!formMounted.current) return;

      // Lỗi trước khi gọi createSellPost (kiểm tra cục bộ, dựng FormData, đọc tệp)
      // chắc chắn chưa gửi → thử lại bình thường. Sau khi đã gọi createSellPost:
      // chỉ phản hồi HTTP 4xx (trừ 408) là thất bại rõ ràng; 5xx/408/hết thời gian
      // chờ/không có phản hồi có thẩm quyền (kể cả lỗi mạng) → KHÔNG RÕ KẾT QUẢ,
      // không được coi là "yêu cầu chưa rời máy".
      const status = (error as { response?: { status?: number } })?.response?.status;
      const definiteClientFailure =
        typeof status === "number" && status >= 400 && status < 500 && status !== 408;
      if (sellCreateStarted && !createdSellId.current && !definiteClientFailure) {
        uncertainSellCreate.current = true;
        setSellCreateNeedsRecovery(true);
        setFormMessage({
          type: "error",
          text: "Chưa xác nhận được kết quả đăng tin. Tin bán có thể đã được tạo. Hãy kiểm tra danh sách tin bán của bạn; chỉ đăng lại khi chắc chắn tin chưa được tạo.",
        });
        return;
      }
      setFormMessage({
        type: "error",
        text: getApiErrorMessage(
          error,
          "Không thể lưu bài đăng lúc này.",
        ),
      });
    } finally {
      publishLock.current = false;
      if (formMounted.current) setIsLoading(false);
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
    clearable = false,
    value,
    placeholder = "Chọn...",
    options,
    onChange,
  }: {
    label: string;
    required?: boolean;
    clearable?: boolean;
    value: string;
    placeholder?: string;
    options: { label: string; value: string }[];
    onChange: (value: string) => void;
  }) => {
    const selectOptions =
      clearable && value
        ? [
            {
              label: "Bỏ chọn",
              value: SELECT_CLEAR_OPTION,
            },
            ...options,
          ]
        : options;

    const handleChange = (nextValue: string) => {
      onChange(
        nextValue === SELECT_CLEAR_OPTION
          ? ""
          : nextValue,
      );
      setFormMessage(null);
    };

    return (
      <View style={styles.flex}>
        <Text style={styles.label}>
          {label}{" "}
          {required ? (
            <Text style={styles.required}>*</Text>
          ) : null}
        </Text>

        <TouchableOpacity
          style={styles.inputContainer}
          onPress={() =>
            openSelect(
              `Chọn ${label}`,
              selectOptions,
              handleChange,
            )
          }
        >
          <Text
            style={
              value
                ? styles.inputText
                : styles.placeholderText
            }
            numberOfLines={1}
          >
            {value
              ? getLabel(value, options)
              : placeholder}
          </Text>

          <Ionicons
            name="chevron-down"
            size={20}
            color="#547B7D"
          />
        </TouchableOpacity>
      </View>
    );
  };

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
          <TouchableOpacity onPress={() => { if (!publishLock.current) router.back(); }} disabled={isLoading} style={styles.backButton}>
            <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {isEditMode ? "Sửa tin đăng" : isBuyPost ? "Đăng tin thu mua" : "Đăng tin mới"}
          </Text>
          <TouchableOpacity onPress={() => void handlePublish()} disabled={isLoading || sellCreateNeedsRecovery}>
            {isLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : (
              <Text style={styles.publishButtonText}>{createdSellId.current ? "Tiếp tục" : isEditMode ? "Cập nhật" : "Đăng"}</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {sellCreateNeedsRecovery ? (
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => {
                if (publishLock.current || sellNavigationLock.current) return;
                sellNavigationLock.current = true;
                if (procurementBuyPostId) {
                  router.dismissTo({
                    pathname: "/posts/[id]",
                    params: { id: procurementBuyPostId, sellerRequestSellPostId: "", resumeSellerRequest: "true" },
                  });
                } else {
                  router.replace("/(tabs)/posts");
                }
              }}
            >
              <Text style={styles.primaryButtonText}>Kiểm tra tin bán của tôi</Text>
            </TouchableOpacity>
          ) : null}
          {sellCreateNeedsRecovery ? (
            <TouchableOpacity
              style={styles.recoveryAcknowledgeButton}
              accessibilityRole="button"
              onPress={() => {
                // Chỉ mở khóa nút Đăng; KHÔNG gửi lại. Người dùng phải bấm Đăng thêm một lần.
                if (publishLock.current) return;
                uncertainSellCreate.current = false;
                setSellCreateNeedsRecovery(false);
                setFormMessage({
                  type: "info",
                  text: "Đã ghi nhận. Bạn có thể bấm Đăng để gửi lại tin bán.",
                });
              }}
            >
              <Text style={styles.recoveryAcknowledgeText}>Tôi đã kiểm tra, tin chưa được tạo</Text>
            </TouchableOpacity>
          ) : null}
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

          {!isBuyPost ? (
            <>
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

            </>
          ) : null}

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
            <Text style={styles.label}>
              Mô tả bài đăng (Ngắn gọn)
              {isBuyPost ? (
                <Text style={styles.required}> *</Text>
              ) : null}
            </Text>
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
                required={!isBuyPost}
                clearable
                value={selectedCategory}
                options={categories}
                onChange={(value) => {
                  if (value !== selectedCategory) {
                    setOldEavData([]);
                    setEavAttributes([]);
                  }

                  setSelectedCategory(value);
                  setSelectedProductType("");
                }}
              />
              <SelectBox
                label="Loại sản phẩm"
                required={!isBuyPost}
                clearable
                value={selectedProductType}
                options={filteredProductTypes}
                onChange={(value) => {
                  if (value !== selectedProductType) {
                    setOldEavData([]);
                    setEavAttributes([]);
                  }

                  setSelectedProductType(value);
                }}
              />
            </View>
            <View style={styles.row}>
              <SelectBox
                label="Thương hiệu"
                clearable
                value={brandId}
                options={brandOptions}
                onChange={setBrandId}
              />
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
                const inputMode =
                  normalizeAttributeInputMode(
                    attribute.inputMode,
                  );

                const dataType =
                  normalizeAttributeDataType(
                    attribute.dataType,
                  );

                const isOptionAllowed =
                  inputMode === "OptionOnly" ||
                  inputMode === "OptionOrCustom";

                const isCustomAllowed =
                  inputMode === "CustomOnly" ||
                  inputMode === "OptionOrCustom";

                const optionList =
                  attribute.options?.map((option: any) => ({
                    label: option.optionValue,
                    value: option.optionId,
                  })) || [];

                const selectableOptionList = [
                  {
                    label: "Bỏ chọn",
                    value: EAV_CLEAR_OPTION,
                  },
                  ...optionList,
                ];
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
                      {!isBuyPost && attribute.isRequired ? (
                        <Text style={styles.required}> *</Text>
                      ) : null}
                    </Text>
                    {isOptionAllowed ? (
                      <TouchableOpacity
                        style={styles.rawDropdownContainer}
                        onPress={() =>
                          openSelect(
                            `Chọn ${attribute.attributeName}`,
                            selectableOptionList,
                            (value) =>
                              updateEavValue(
                                index,
                                "selectedOptionId",
                                value === EAV_CLEAR_OPTION
                                  ? ""
                                  : value,
                              ),
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
                    {isCustomAllowed &&
                    dataType === "Boolean" ? (
                      <View style={styles.customAttributeGroup}>
                        <View style={styles.row}>
                          <TouchableOpacity
                            style={[
                              styles.boolBtn,
                              attribute.valueBoolean === true
                                ? styles.boolBtnActive
                                : undefined,
                            ]}
                            onPress={() =>
                              updateEavValue(
                                index,
                                "valueBoolean",
                                true,
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.boolBtnText,
                                attribute.valueBoolean === true
                                  ? styles.boolBtnTextActive
                                  : undefined,
                              ]}
                            >
                              Có / Bật
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={[
                              styles.boolBtn,
                              attribute.valueBoolean === false
                                ? styles.boolBtnActiveRed
                                : undefined,
                            ]}
                            onPress={() =>
                              updateEavValue(
                                index,
                                "valueBoolean",
                                false,
                              )
                            }
                          >
                            <Text
                              style={[
                                styles.boolBtnText,
                                attribute.valueBoolean === false
                                  ? styles.boolBtnTextActive
                                  : undefined,
                              ]}
                            >
                              Không / Tắt
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            style={styles.boolBtn}
                            onPress={() =>
                              updateEavValue(
                                index,
                                "valueBoolean",
                                null,
                              )
                            }
                          >
                            <Text style={styles.boolBtnText}>
                              Bỏ chọn
                            </Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}

                    {isCustomAllowed &&
                    dataType === "Text" ? (
                      <View style={styles.rawInputContainer}>
                        <TextInput
                          style={styles.rawInput}
                          placeholder="Nhập nội dung..."
                          placeholderTextColor="#547B7D"
                          value={attribute.valueText}
                          onChangeText={(text) =>
                            updateEavValue(
                              index,
                              "valueText",
                              text,
                            )
                          }
                        />
                      </View>
                    ) : null}

                    {isCustomAllowed &&
                    dataType === "Number" ? (
                      <View style={styles.rawInputContainer}>
                        <TextInput
                          style={styles.rawInput}
                          placeholder="Nhập số..."
                          placeholderTextColor="#547B7D"
                          keyboardType="numeric"
                          value={attribute.valueNumber}
                          onChangeText={(text) =>
                            updateEavValue(
                              index,
                              "valueNumber",
                              text,
                            )
                          }
                        />
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
                  <Text style={styles.label}>Kích thước (DxRxC){deliveryMethod === "GhnDelivery" ? <Text style={{ color: COLORS.error }}> *</Text> : null}</Text>
                  <TouchableOpacity style={styles.inputContainer} onPress={() => setShowDimensionsModal(true)}>
                    <Text style={displayDimensions ? styles.inputText : styles.placeholderText} numberOfLines={1}>
                      {displayDimensions || "VD: 120 x 60 x 80 cm"}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#547B7D" />
                  </TouchableOpacity>
                </View>
                <View style={styles.flex}>
                  <Text style={styles.label}>Cân nặng (kg){deliveryMethod === "GhnDelivery" ? <Text style={{ color: COLORS.error }}> *</Text> : null}</Text>
                  <View
                    style={[
                      styles.inputContainer,
                      weightError ? styles.inputContainerError : undefined,
                    ]}
                  >
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="VD: 15"
                      placeholderTextColor="#547B7D"
                      value={weight}
                      onChangeText={(value) => {
                        setWeight(value);

                        if (!weightError) return;

                        const parsed = Number(value.trim().replace(",", "."));
                        setWeightError(
                          !Number.isFinite(parsed) || parsed <= 0
                            ? "Vui lòng nhập khối lượng sản phẩm lớn hơn 0 kg để giao hàng GHN."
                            : parsed > 50
                              ? "GHN chỉ hỗ trợ khối lượng sản phẩm tối đa 50 kg."
                              : "",
                        );
                      }}
                    />
                  </View>
                  {weightError ? (
                    <Text style={[styles.fieldError, styles.fieldErrorCompact]}>
                      {weightError}
                    </Text>
                  ) : null}
                </View>
              </View>
            ) : null}
            <View style={styles.row}>
              {!isBuyPost ? (
                <SelectBox
                  label="Không gian dùng"
                  clearable
                  value={spaceUsage}
                  options={SPACE_USAGE_OPTIONS}
                  onChange={setSpaceUsage}
                />
              ) : null}
              <SelectBox
                label="Mức độ hư hại"
                clearable
                value={damageLevel}
                options={DAMAGE_LEVEL_OPTIONS}
                onChange={setDamageLevel}
              />
            </View>
            <View style={styles.row}>
              <SelectBox
                label="Tình trạng HĐ"
                clearable
                value={functionalityStatus}
                options={FUNC_STATUS_OPTIONS}
                onChange={setFunctionalityStatus}
              />
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

            {isBuyPost ? (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.label}>
                    Giá từ (VNĐ)
                  </Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="Giá tối thiểu"
                      placeholderTextColor="#547B7D"
                      value={priceFrom}
                      onChangeText={(value) => {
                        setPriceFrom(
                          value.replace(/[^0-9]/g, ""),
                        );
                        setFormMessage(null);
                      }}
                    />
                  </View>
                </View>

                <View style={styles.flex}>
                  <Text style={styles.label}>
                    Giá đến (VNĐ)
                  </Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="Giá tối đa"
                      placeholderTextColor="#547B7D"
                      value={basePrice}
                      onChangeText={(value) => {
                        setBasePrice(
                          value.replace(/[^0-9]/g, ""),
                        );
                        setFormMessage(null);
                      }}
                    />
                  </View>
                </View>
              </View>
            ) : (
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text style={styles.label}>
                    Giá mong muốn{" "}
                    <Text style={styles.required}>*</Text>
                  </Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="VNĐ"
                      placeholderTextColor="#547B7D"
                      value={basePrice}
                      onChangeText={(value) => {
                        setBasePrice(value);
                        setFormMessage(null);
                      }}
                    />
                  </View>
                </View>

                <View style={styles.flex}>
                  <Text style={styles.label}>
                    Giá lúc mua
                  </Text>
                  <View style={styles.inputContainer}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder="VNĐ"
                      placeholderTextColor="#547B7D"
                      value={originalPrice}
                      onChangeText={setOriginalPrice}
                    />
                  </View>
                </View>
              </View>
            )}

            {canUseAiPriceSuggestion ? (
              <View style={styles.aiPriceArea}>
                <TouchableOpacity
                  style={[
                    styles.aiPriceButton,
                    (isAiPriceLoading || Boolean(aiPricingContext.issue) || Number(aiPriceQuota?.remainingToday) <= 0) && styles.aiPriceButtonDisabled,
                  ]}
                  disabled={isAiPriceLoading || Boolean(aiPricingContext.issue) || Number(aiPriceQuota?.remainingToday) <= 0}
                  onPress={() => void requestAiPriceSuggestion()}
                >
                  {isAiPriceLoading ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="sparkles-outline" size={18} color={COLORS.white} />}
                  <Text style={styles.aiPriceButtonText}>{isAiPriceLoading ? "Đang phân tích dữ liệu giá..." : "Gợi ý giá với AI"}</Text>
                </TouchableOpacity>
                {aiPriceQuota && Number.isFinite(aiPriceQuota.remainingToday) ? (
                  <Text style={styles.aiPriceQuota}>
                    {Number(aiPriceQuota.remainingToday) > 0
                      ? `Còn ${aiPriceQuota.remainingToday}${Number.isFinite(Number(aiPriceQuota.dailyLimit)) && Number(aiPriceQuota.dailyLimit) > 0 ? `/${aiPriceQuota.dailyLimit}` : ""} lượt gợi ý hôm nay`
                      : `Đã hết lượt gợi ý hôm nay${aiPriceQuota.resetsAt ? ` · Làm mới ${new Date(aiPriceQuota.resetsAt).toLocaleString("vi-VN")}` : ""}`}
                  </Text>
                ) : null}
                {aiPricingContext.issue && !isAiPriceLoading ? <Text style={styles.aiPriceHint}>{aiPricingContext.issue}</Text> : null}
                {aiPriceMessage ? <Text style={aiPriceMessage.type === "error" ? styles.fieldError : styles.aiPriceHint}>{aiPriceMessage.text}</Text> : null}
                {aiPriceResult ? (
                  <View style={styles.aiPriceResult}>
                    {isAiPriceStale ? (
                      <Text style={styles.aiPriceHint}>Thông tin sản phẩm đã thay đổi. Hãy yêu cầu gợi ý mới.</Text>
                    ) : aiResultStatus === "DAILY_LIMIT_REACHED" ? (
                      <Text style={styles.fieldError}>Bạn đã dùng hết lượt gợi ý giá hôm nay.</Text>
                    ) : aiResultStatus === "NO_RELIABLE_DATA" ? (
                      <Text style={styles.aiPriceExplanation}>{aiPriceResult.explanation || "Chưa có đủ dữ liệu tham khảo đáng tin cậy. Bạn vẫn có thể nhập giá thủ công."}</Text>
                    ) : aiHasUsablePrice ? (
                      <>
                        <Text style={styles.aiPriceLabel}>Giá tham khảo</Text>
                        <Text style={styles.aiPriceValue}>{Number(aiPriceResult.suggestedPrice).toLocaleString("vi-VN")} đ</Text>
                        {Number(aiPriceResult.minPrice) > 0 && Number(aiPriceResult.maxPrice) > 0 && Number(aiPriceResult.minPrice) !== Number(aiPriceResult.maxPrice) ? (
                          <Text style={styles.aiPriceRange}>Khoảng {Number(aiPriceResult.minPrice).toLocaleString("vi-VN")} – {Number(aiPriceResult.maxPrice).toLocaleString("vi-VN")} đ</Text>
                        ) : null}
                        {aiResultStatus === "FALLBACK_EQUIVALENT_MODEL" ? <Text style={styles.aiPriceHint}>Tham khảo từ model tương đương</Text> : null}
                        <Text style={styles.aiPriceExplanation}>{aiPriceResult.explanation}</Text>
                        <Text style={styles.aiPriceConfidence}>{aiConfidenceLabel[String(aiPriceResult.confidence || "").toUpperCase()] || "Chưa đủ dữ liệu"}</Text>
                        <TouchableOpacity style={styles.aiApplyButton} onPress={applyAiSuggestedPrice}>
                          <Text style={styles.aiApplyButtonText}>Áp dụng giá này</Text>
                        </TouchableOpacity>
                      </>
                    ) : (
                      <Text style={styles.aiPriceExplanation}>{aiPriceResult.explanation || "Chưa thể tạo giá tham khảo. Bạn vẫn có thể nhập giá thủ công."}</Text>
                    )}
                  </View>
                ) : null}
              </View>
            ) : null}

            <Text style={styles.label}>Số lượng <Text style={{ color: COLORS.error }}>*</Text></Text>
            {isEditMode ? (
              <Text style={styles.quantityHelper}>
                Nhập tổng số lượng mới của tin, không phải số lượng cộng thêm.
              </Text>
            ) : null}
            <View
              style={[
                styles.inputContainer,
                quantityError ? styles.inputContainerError : undefined,
              ]}
            >
              <TextInput
                style={styles.input}
                keyboardType="number-pad"
                inputMode="numeric"
                placeholder={isBuyPost ? "1 – 99.999" : "Nhập SL..."}
                placeholderTextColor="#547B7D"
                value={quantity}
                onChangeText={(value) => {
                  setQuantity(value);
                  // Kiểm tra ngay khi gõ; lỗi giữ nguyên cho tới khi giá trị hợp lệ.
                  setQuantityError(value.trim() ? validateQuantityInput(value, isBuyPost) : "");
                }}
              />
            </View>
            {quantityError ? <Text style={styles.fieldError}>{quantityError}</Text> : null}
          </View>

          <View style={styles.cardSection}>
            <SectionTitle title="VẬN CHUYỂN & VỊ TRÍ" />
            <View style={styles.row}>
              {!isBuyPost ? (
                <SelectBox
                  label="Vận chuyển"
                  value={deliveryMethod}
                  options={DELIVERY_OPTIONS}
                  onChange={setDeliveryMethod}
                />
              ) : null}
              <SelectBox
                label="Ưu tiên"
                clearable={isBuyPost || !isEditMode}
                value={priorityLevel}
                options={PRIORITY_OPTIONS}
                onChange={setPriorityLevel}
              />
            </View>
            <Text style={styles.label}>
              Địa chỉ bài đăng
            </Text>
            <AddressPickerField
              value={postAddress}
              initialSelection={{
                provinceName: city,
                wardName: ward,
                streetAddress,
              }}
              onChange={(_value, selection) => {
                setCity(selection.provinceName);
                setWard(selection.wardName);
                setStreetAddress(selection.streetAddress);
                setAddressError("");
              }}
              onClear={
                isBuyPost || !isEditMode
                  ? () => {
                      setCity("");
                      setWard("");
                      setStreetAddress("");
                      setAddressError("");
                    }
                  : undefined
              }
              placeholder="Chọn Tỉnh/Thành, Phường/Xã và số nhà/tên đường"
              disabled={isLoading}
              hasError={Boolean(addressError)}
            />
            {addressError ? <Text style={styles.fieldError}>{addressError}</Text> : null}
          </View>

          {canUseSupplierSuggestion ? (
            <View style={styles.cardSection}>
              <SupplierSuggestionPanel
                mode="draft"
                readiness={supplierDraftContext.readiness}
                contextKey={supplierDraftContext.key}
                attributeNames={supplierAttributeNames}
                onRequest={requestSupplierDraftMatches}
                onValidationErrors={handleSupplierValidationErrors}
                disabled={isLoading}
              />
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={showDimensionsModal} animationType="slide" transparent onRequestClose={() => setShowDimensionsModal(false)}>
        <ModalBackdrop style={styles.modalOverlay} onPress={() => setShowDimensionsModal(false)}>
          <KeyboardAvoidingView
            style={[styles.dimensionKeyboardContainer, { paddingTop: insets.top }]}
            pointerEvents="box-none"
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ModalSurface style={[styles.modalContent, styles.dimensionModal]}>
              <View style={[styles.modalHeader, styles.dimensionHeader]}>
                <Text style={styles.modalTitle}>Chi tiết Kích thước</Text>
                <TouchableOpacity onPress={() => setShowDimensionsModal(false)}>
                  <Ionicons name="close" size={24} color={COLORS.text} />
                </TouchableOpacity>
              </View>
              <ScrollView
                style={styles.dimensionScroll}
                contentContainerStyle={styles.dimensionBody}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator
              >
              {[
                ["Chiều dài (cm)", length, setLength, "VD: 120"],
                ["Chiều rộng (cm)", width, setWidth, "VD: 60"],
                ["Chiều cao (cm)", height, setHeight, "VD: 80"],
              ].map(([label, value, setter, placeholder]) => {
                const isWidthField = setter === setWidth;
                const fieldError = isWidthField ? widthDimensionError : "";
                return (
                <View key={label as string}>
                  <Text style={styles.label}>{label as string}</Text>
                  <View style={[styles.inputContainer, fieldError ? styles.inputContainerError : undefined]}>
                    <TextInput
                      style={styles.input}
                      keyboardType="numeric"
                      placeholder={placeholder as string}
                      placeholderTextColor="#547B7D"
                      value={value as string}
                      onChangeText={setter as (value: string) => void}
                    />
                  </View>
                  {fieldError ? <Text style={[styles.fieldError, styles.dimensionFieldError]}>{fieldError}</Text> : null}
                </View>
                );
              })}
              </ScrollView>
              <View style={[styles.dimensionFooter, { paddingBottom: Platform.OS === "android" ? 20 : Math.max(insets.bottom, 20) }]}>
                <TouchableOpacity style={[styles.primaryButton, styles.dimensionCloseButton]} onPress={() => setShowDimensionsModal(false)}>
                  <Text style={styles.primaryButtonText}>Đóng</Text>
                </TouchableOpacity>
              </View>
            </ModalSurface>
          </KeyboardAvoidingView>
        </ModalBackdrop>
      </Modal>

      <Modal visible={showSelectModal} animationType="fade" transparent onRequestClose={() => setShowSelectModal(false)}>
        <ModalBackdrop style={styles.modalOverlay} onPress={() => setShowSelectModal(false)}>
          <ModalSurface style={styles.modalContent}>
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
          </ModalSurface>
        </ModalBackdrop>
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
  quantityHelper: { fontSize: 12, color: COLORS.textLight, marginTop: -4, marginBottom: 8 },
  required: { color: COLORS.error, fontWeight: "normal" },
  inputContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 12, minHeight: 46, backgroundColor: "#F8F9FA", marginBottom: 16, overflow: "hidden" },
  inputContainerError: { borderColor: COLORS.error },
  fieldErrorCompact: { marginTop: -12, marginBottom: 12 },
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
  dimensionModal: { maxHeight: "90%", width: "100%", padding: 0, overflow: "hidden" },
  dimensionKeyboardContainer: { flex: 1, width: "100%", justifyContent: "flex-end" },
  dimensionHeader: { flexShrink: 0, paddingTop: 20, paddingHorizontal: 20 },
  dimensionScroll: { flexShrink: 1, minHeight: 0 },
  dimensionBody: { paddingHorizontal: 20, paddingBottom: 4 },
  dimensionFieldError: { marginTop: -10, marginBottom: 16 },
  dimensionFooter: { flexShrink: 0, paddingTop: 12, paddingHorizontal: 20, backgroundColor: COLORS.white },
  dimensionCloseButton: { flexShrink: 0, marginTop: 0, marginBottom: 0 },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: "#BAC2C1" },
  modalTitle: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  modalOptionBtn: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: "#F8F9FA" },
  modalOptionText: { fontSize: 16, color: COLORS.text },
  modalEmptyText: { textAlign: "center", color: "#547B7D", marginTop: 20 },
  recoveryAcknowledgeButton: { borderWidth: 1, borderColor: COLORS.primary, borderRadius: 12, height: 44, justifyContent: "center", alignItems: "center", marginTop: 10, marginBottom: 16 },
  recoveryAcknowledgeText: { color: COLORS.primary, fontWeight: "700", fontSize: 14 },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: 12, height: 48, justifyContent: "center", alignItems: "center", marginTop: 8, marginBottom: Platform.OS === "ios" ? 16 : 0 },
  primaryButtonText: { color: COLORS.white, fontSize: 15, fontWeight: "bold" },
  aiPriceArea: { marginTop: -4, marginBottom: 16 },
  aiPriceButton: { minHeight: 44, borderRadius: 10, backgroundColor: COLORS.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 12 },
  aiPriceButtonDisabled: { opacity: 0.55 },
  aiPriceButtonText: { color: COLORS.white, fontSize: 13, fontWeight: "700" },
  aiPriceQuota: { marginTop: 7, color: COLORS.textLight, fontSize: 12 },
  aiPriceHint: { marginTop: 7, color: COLORS.textLight, fontSize: 12, lineHeight: 17 },
  aiPriceResult: { marginTop: 10, borderRadius: 10, borderWidth: 1, borderColor: "rgba(84, 123, 125, 0.24)", backgroundColor: "rgba(84, 123, 125, 0.08)", padding: 12 },
  aiPriceLabel: { color: COLORS.textLight, fontSize: 12 },
  aiPriceValue: { color: COLORS.primary, fontWeight: "800", fontSize: 20, marginTop: 2 },
  aiPriceRange: { color: COLORS.text, fontSize: 12, marginTop: 3 },
  aiPriceExplanation: { color: COLORS.text, fontSize: 12, lineHeight: 18, marginTop: 7 },
  aiPriceConfidence: { color: COLORS.primary, fontSize: 12, fontWeight: "700", marginTop: 7 },
  aiApplyButton: { alignSelf: "flex-start", borderWidth: 1, borderColor: COLORS.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginTop: 10 },
  aiApplyButtonText: { color: COLORS.primary, fontWeight: "700", fontSize: 13 },
});
