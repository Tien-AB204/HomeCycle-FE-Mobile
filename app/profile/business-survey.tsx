import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import AddressPickerField, {
  AddressSelection,
} from "../../src/components/shared/AddressPickerField";
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import apiClient from "../../src/services/apis/axiosClient";

const DAMAGE_OPTIONS = [
  { value: 0, label: "Không hư hại" },
  { value: 1, label: "Hư hại thẩm mỹ" },
  { value: 2, label: "Hư hại nhẹ" },
  { value: 3, label: "Hư hại trung bình" },
  { value: 4, label: "Hư hại nặng" },
  { value: 5, label: "Tổn thất toàn bộ" },
];

const FUNCTIONALITY_OPTIONS = [
  { value: 0, label: "Hoạt động hoàn hảo" },
  { value: 1, label: "Hoạt động một phần" },
  { value: 2, label: "Không hoạt động / cần sửa" },
];

const PROCUREMENT_OPTIONS = [
  { value: 0, label: "Mua lẻ / ít" },
  { value: 1, label: "Thu mua số lượng lớn" },
];

const surveyApi = {
  getOnboardingStatus: () =>
    apiClient
      .get("/business-profiles/onboarding-status")
      .then((response) => response.data),

  getDetail: () =>
    apiClient
      .get("/business-profiles/survey-detail")
      .then((response) => response.data),

  save: (payload: {
    targetCities: string[];
    acceptableDamageLevels: number[];
    acceptableFunctionalityStatuses: number[];
    procurementScales: number[];
    productTypeIds: string[];
  }) =>
    apiClient
      .post("/business-profiles/survey", payload)
      .then((response) => response.data),

  getProductTypes: () =>
    apiClient
      .get("/product-types/get-all", {
        params: { PageNumber: 1, PageSize: 100 },
      })
      .then((response) => response.data),
};

type ProductTypeItem = {
  productTypeId: string;
  productTypeName: string;
  isActive?: boolean;
};

type SurveyDetail = {
  targetCities: string[];
  acceptableDamageLevels: number[];
  acceptableFunctionalityStatuses: number[];
  procurementScales: number[];
  productTypeIds: string[];
};

type InlineMessage = {
  type: "error" | "success" | "info";
  text: string;
} | null;

type FieldErrors = Partial<
  Record<"products" | "cities" | "damage" | "functionality" | "scale", string>
>;

const unwrap = (value: any) => value?.data ?? value;

const asArray = <T,>(value: unknown): T[] => (Array.isArray(value) ? (value as T[]) : []);

const getErrorMessage = (error: any, fallback: string) =>
  String(
    error?.response?.data?.message ||
      error?.response?.data?.error?.message ||
      error?.response?.data?.error?.Message ||
      fallback,
  );

const normalizeStatus = (value: unknown) =>
  String(value ?? "")
    .replace(/[\s_-]/g, "")
    .toLowerCase();

const isSurveyPendingStatus = (value: unknown) =>
  normalizeStatus(value) === "surveypending";

const toggleNumber = (list: number[], value: number) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

const toggleString = (list: string[], value: string) =>
  list.includes(value) ? list.filter((item) => item !== value) : [...list, value];

const mapLabel = (
  value: number,
  options: { value: number; label: string }[],
) => options.find((option) => option.value === value)?.label || `Giá trị ${value}`;

export default function BusinessSurveyScreen() {
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [message, setMessage] = useState<InlineMessage>(null);
  const [errors, setErrors] = useState<FieldErrors>({});

  const [productTypes, setProductTypes] = useState<ProductTypeItem[]>([]);
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedDamage, setSelectedDamage] = useState<number[]>([]);
  const [selectedFunctionality, setSelectedFunctionality] = useState<number[]>([]);
  const [selectedScales, setSelectedScales] = useState<number[]>([]);

  const [cityPickerValue, setCityPickerValue] = useState("");
  const [citySelection, setCitySelection] = useState<AddressSelection | null>(null);

  const hydrateDetail = useCallback((detail: any) => {
    setSelectedProductIds(asArray<string>(detail?.productTypeIds));
    setSelectedCities(asArray<string>(detail?.targetCities));
    setSelectedDamage(asArray<number>(detail?.acceptableDamageLevels).map(Number));
    setSelectedFunctionality(
      asArray<number>(detail?.acceptableFunctionalityStatuses).map(Number),
    );
    setSelectedScales(asArray<number>(detail?.procurementScales).map(Number));
  }, []);

  const loadPage = useCallback(async () => {
    try {
      setIsLoading(true);
      setMessage(null);

      const [statusResponse, productTypesResponse] = await Promise.all([
        surveyApi.getOnboardingStatus(),
        surveyApi.getProductTypes(),
      ]);

      const statusData = unwrap(statusResponse);
      const setupMode = isSurveyPendingStatus(statusData?.status ?? statusData);
      setIsSetupMode(setupMode);

      const productData = unwrap(productTypesResponse);
      const productItems =
        productData?.items || productData?.data?.items || productData?.data || [];
      setProductTypes(
        asArray<any>(productItems)
          .map((item) => ({
            productTypeId: String(item?.productTypeId || ""),
            productTypeName: String(item?.productTypeName || "Loại sản phẩm"),
            isActive: item?.isActive,
          }))
          .filter((item) => item.productTypeId && item.isActive !== false),
      );

      if (setupMode) {
        setSelectedProductIds([]);
        setSelectedCities([]);
        setSelectedDamage([]);
        setSelectedFunctionality([]);
        setSelectedScales([]);
      } else {
        const detailResponse = await surveyApi.getDetail();
        hydrateDetail(unwrap(detailResponse));
      }
    } catch (error) {
      setMessage({
        type: "error",
        text: getErrorMessage(error, "Không thể tải khảo sát thu mua."),
      });
    } finally {
      setIsLoading(false);
    }
  }, [hydrateDetail]);

  useFocusEffect(
    useCallback(() => {
      void loadPage();
    }, [loadPage]),
  );

  const selectedProductNames = useMemo(() => {
    const map = new Map(productTypes.map((item) => [item.productTypeId, item.productTypeName]));
    return selectedProductIds.map((id) => map.get(id) || id);
  }, [productTypes, selectedProductIds]);

  const clearError = (field: keyof FieldErrors) => {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage(null);
  };

  const addCityFromPicker = () => {
    const city = String(citySelection?.provinceName || "").trim();
    if (!city) {
      setErrors((current) => ({
        ...current,
        cities: "Vui lòng chọn một tỉnh/thành bằng bộ chọn địa chỉ.",
      }));
      return;
    }

    setSelectedCities((current) =>
      current.some((item) => item.toLocaleLowerCase("vi-VN") === city.toLocaleLowerCase("vi-VN"))
        ? current
        : [...current, city],
    );
    setCityPickerValue("");
    setCitySelection(null);
    clearError("cities");
  };

  const validate = () => {
    const next: FieldErrors = {};
    if (selectedProductIds.length === 0) next.products = "Chọn ít nhất 1 loại sản phẩm.";
    if (selectedCities.length === 0) next.cities = "Chọn ít nhất 1 tỉnh/thành.";
    if (selectedDamage.length === 0) next.damage = "Chọn ít nhất 1 mức độ hư hại.";
    if (selectedFunctionality.length === 0) {
      next.functionality = "Chọn ít nhất 1 tình trạng hoạt động.";
    }
    if (selectedScales.length === 0) next.scale = "Chọn ít nhất 1 quy mô thu mua.";

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submitSurvey = async () => {
    if (!validate()) return;

    try {
      setIsSaving(true);
      setMessage(null);
      await surveyApi.save({
        targetCities: selectedCities,
        acceptableDamageLevels: selectedDamage,
        acceptableFunctionalityStatuses: selectedFunctionality,
        procurementScales: selectedScales,
        productTypeIds: selectedProductIds,
      });

      setMessage({
        type: "success",
        text: "Đã lưu khảo sát thu mua.",
      });
      setIsSetupMode(false);

      const detailResponse = await surveyApi.getDetail();
      hydrateDetail(unwrap(detailResponse));
    } catch (error) {
      setMessage({
        type: "error",
        text: getErrorMessage(error, "Không thể lưu khảo sát thu mua."),
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Khảo sát thu mua" showBack />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải khảo sát...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title={isSetupMode ? "Thiết lập thu mua" : "Khảo sát thu mua"} showBack />
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.introCard}>
          <Ionicons
            name={isSetupMode ? "options-outline" : "document-text-outline"}
            size={25}
            color={COLORS.primary}
          />
          <View style={styles.flex}>
            <Text style={styles.introTitle}>
              {isSetupMode ? "Thiết lập tiêu chí thu mua" : "Tiêu chí thu mua đã lưu"}
            </Text>
            <Text style={styles.introText}>
              {isSetupMode
                ? "Chọn các tiêu chí để HomeCycle ghi nhận nhu cầu thu mua của doanh nghiệp."
                : "Thông tin dưới đây được tải trực tiếp từ hồ sơ khảo sát của doanh nghiệp."}
            </Text>
          </View>
        </View>

        {message ? (
          <View
            style={[
              styles.messageBox,
              message.type === "error"
                ? styles.messageError
                : message.type === "success"
                  ? styles.messageSuccess
                  : styles.messageInfo,
            ]}
          >
            <Text
              style={[
                styles.messageText,
                message.type === "error"
                  ? styles.messageErrorText
                  : message.type === "success"
                    ? styles.messageSuccessText
                    : styles.messageInfoText,
              ]}
            >
              {message.text}
            </Text>
            {message.type === "error" ? (
              <TouchableOpacity style={styles.retryButton} onPress={() => void loadPage()}>
                <Text style={styles.retryText}>Thử lại</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}

        <SurveySection title="LOẠI SẢN PHẨM QUAN TÂM" error={errors.products}>
          {isSetupMode ? (
            <View style={styles.chipWrap}>
              {productTypes.map((item) => {
                const selected = selectedProductIds.includes(item.productTypeId);
                return (
                  <TouchableOpacity
                    key={item.productTypeId}
                    style={[styles.chip, selected ? styles.chipSelected : undefined]}
                    onPress={() => {
                      setSelectedProductIds((current) =>
                        toggleString(current, item.productTypeId),
                      );
                      clearError("products");
                    }}
                  >
                    {selected ? (
                      <Ionicons name="checkmark" size={15} color={COLORS.primary} />
                    ) : null}
                    <Text style={[styles.chipText, selected ? styles.chipTextSelected : undefined]}>
                      {item.productTypeName}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <ReadOnlyChips values={selectedProductNames} emptyText="Chưa có loại sản phẩm." />
          )}
        </SurveySection>

        <SurveySection title="TỈNH / THÀNH QUAN TÂM" error={errors.cities}>
          {isSetupMode ? (
            <>
              <AddressPickerField
                value={cityPickerValue}
                onChange={(value, selection) => {
                  setCityPickerValue(value);
                  setCitySelection(selection);
                  clearError("cities");
                }}
                placeholder="Chọn một tỉnh/thành cần thu mua"
                hasError={Boolean(errors.cities)}
              />
              <TouchableOpacity style={styles.addCityButton} onPress={addCityFromPicker}>
                <Ionicons name="add-circle-outline" size={18} color={COLORS.primary} />
                <Text style={styles.addCityText}>Thêm tỉnh/thành</Text>
              </TouchableOpacity>
              <View style={styles.chipWrap}>
                {selectedCities.map((city) => (
                  <TouchableOpacity
                    key={city}
                    style={[styles.chip, styles.chipSelected]}
                    onPress={() => {
                      setSelectedCities((current) => current.filter((item) => item !== city));
                    }}
                  >
                    <Text style={[styles.chipText, styles.chipTextSelected]}>{city}</Text>
                    <Ionicons name="close" size={15} color={COLORS.primary} />
                  </TouchableOpacity>
                ))}
              </View>
            </>
          ) : (
            <ReadOnlyChips values={selectedCities} emptyText="Chưa có tỉnh/thành." />
          )}
        </SurveySection>

        <SurveySection title="QUY MÔ THU MUA" error={errors.scale}>
          {isSetupMode ? (
            <OptionGrid
              options={PROCUREMENT_OPTIONS}
              selected={selectedScales}
              onToggle={(value) => {
                setSelectedScales((current) => toggleNumber(current, value));
                clearError("scale");
              }}
            />
          ) : (
            <ReadOnlyChips
              values={selectedScales.map((value) => mapLabel(value, PROCUREMENT_OPTIONS))}
              emptyText="Chưa có quy mô thu mua."
            />
          )}
        </SurveySection>

        <SurveySection title="TÌNH TRẠNG HOẠT ĐỘNG CHẤP NHẬN" error={errors.functionality}>
          {isSetupMode ? (
            <OptionGrid
              options={FUNCTIONALITY_OPTIONS}
              selected={selectedFunctionality}
              onToggle={(value) => {
                setSelectedFunctionality((current) => toggleNumber(current, value));
                clearError("functionality");
              }}
            />
          ) : (
            <ReadOnlyChips
              values={selectedFunctionality.map((value) =>
                mapLabel(value, FUNCTIONALITY_OPTIONS),
              )}
              emptyText="Chưa có tình trạng hoạt động."
            />
          )}
        </SurveySection>

        <SurveySection title="MỨC ĐỘ HƯ HẠI CHẤP NHẬN" error={errors.damage}>
          {isSetupMode ? (
            <OptionGrid
              options={DAMAGE_OPTIONS}
              selected={selectedDamage}
              onToggle={(value) => {
                setSelectedDamage((current) => toggleNumber(current, value));
                clearError("damage");
              }}
            />
          ) : (
            <ReadOnlyChips
              values={selectedDamage.map((value) => mapLabel(value, DAMAGE_OPTIONS))}
              emptyText="Chưa có mức độ hư hại."
            />
          )}
        </SurveySection>

        {isSetupMode ? (
          <TouchableOpacity
            style={[styles.saveButton, isSaving ? styles.disabledButton : undefined]}
            disabled={isSaving}
            onPress={() => void submitSurvey()}
          >
            {isSaving ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="save-outline" size={19} color={COLORS.white} />
                <Text style={styles.saveText}>LƯU KHẢO SÁT THU MUA</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={18} color={COLORS.primary} />
            <Text style={styles.backButtonText}>Quay lại hồ sơ doanh nghiệp</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SurveySection({
  title,
  error,
  children,
}: {
  title: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.sectionCard}>
      <View style={styles.sectionHeader}>
        <View style={styles.sectionBar} />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

function OptionGrid({
  options,
  selected,
  onToggle,
}: {
  options: { value: number; label: string }[];
  selected: number[];
  onToggle: (value: number) => void;
}) {
  return (
    <View style={styles.optionGrid}>
      {options.map((option) => {
        const active = selected.includes(option.value);
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.optionBox, active ? styles.optionBoxActive : undefined]}
            onPress={() => onToggle(option.value)}
          >
            <Ionicons
              name={active ? "checkmark-circle" : "ellipse-outline"}
              size={20}
              color={active ? COLORS.primary : COLORS.textLight}
            />
            <Text style={[styles.optionText, active ? styles.optionTextActive : undefined]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ReadOnlyChips({ values, emptyText }: { values: string[]; emptyText: string }) {
  if (values.length === 0) {
    return <Text style={styles.emptyText}>{emptyText}</Text>;
  }

  return (
    <View style={styles.chipWrap}>
      {values.map((value, index) => (
        <View key={`${value}-${index}`} style={[styles.chip, styles.chipSelected]}>
          <Ionicons name="checkmark-circle" size={15} color={COLORS.primary} />
          <Text style={[styles.chipText, styles.chipTextSelected]}>{value}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8FAFC" },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  loadingText: { marginTop: 10, color: COLORS.textLight },
  scrollContent: { padding: 16, paddingBottom: 40 },
  introCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#F0F9FF",
    borderWidth: 1,
    borderColor: "#BAE6FD",
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  introTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  introText: { color: COLORS.textLight, fontSize: 12, lineHeight: 18, marginTop: 4 },
  sectionCard: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
    marginBottom: 14,
  },
  sectionHeader: { flexDirection: "row", alignItems: "center", marginBottom: 13 },
  sectionBar: { width: 4, height: 18, borderRadius: 2, backgroundColor: COLORS.primary, marginRight: 8 },
  sectionTitle: { color: "#334155", fontSize: 14, fontWeight: "800", flex: 1 },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    minHeight: 38,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.white,
  },
  chipSelected: { borderColor: "#7DD3FC", backgroundColor: "#E0F2FE" },
  chipText: { color: COLORS.text, fontSize: 12, fontWeight: "600" },
  chipTextSelected: { color: "#0369A1" },
  addCityButton: {
    minHeight: 42,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 9,
    marginTop: 9,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  addCityText: { color: COLORS.primary, fontSize: 12, fontWeight: "800" },
  optionGrid: { gap: 8 },
  optionBox: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  optionBoxActive: { borderColor: COLORS.primary, backgroundColor: "#F0F9FF" },
  optionText: { flex: 1, color: COLORS.text, fontSize: 13 },
  optionTextActive: { color: "#0369A1", fontWeight: "700" },
  fieldError: { color: COLORS.error, fontSize: 12, marginTop: 10, lineHeight: 17 },
  emptyText: { color: COLORS.textLight, fontSize: 12, fontStyle: "italic" },
  messageBox: { borderWidth: 1, borderRadius: 10, padding: 11, marginBottom: 14 },
  messageText: { fontSize: 12, lineHeight: 18 },
  messageError: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  messageErrorText: { color: "#B91C1C" },
  messageSuccess: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  messageSuccessText: { color: "#047857" },
  messageInfo: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  messageInfoText: { color: "#1D4ED8" },
  retryButton: { marginTop: 8, alignSelf: "flex-start" },
  retryText: { color: COLORS.primary, fontWeight: "800", fontSize: 12 },
  saveButton: {
    minHeight: 52,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  saveText: { color: COLORS.white, fontWeight: "900", fontSize: 13 },
  disabledButton: { opacity: 0.55 },
  backButton: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 11,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },
  backButtonText: { color: COLORS.primary, fontWeight: "800", fontSize: 13 },
});