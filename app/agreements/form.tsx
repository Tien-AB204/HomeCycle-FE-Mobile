import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import AddressPickerField from "../../src/components/shared/AddressPickerField";
import CalendarDateField from "../../src/components/shared/CalendarDateField";
import ClockTimeField from "../../src/components/shared/ClockTimeField";
import Header from "../../src/components/shared/Header";
import { ModalBackdrop, ModalSurface } from "../../src/components/shared/ModalBackdrop";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import { capitalizeWordInitials } from "../../src/utils/textFormat";
import { useAutoDismissFeedback } from "../../src/utils/useAutoDismissFeedback";
import { useGuardedRouter } from "../../src/utils/tapGuard";
import { devLog } from "../../src/utils/devLog";

type DeliveryMethod = "SELLER_DELIVERY" | "BUYER_PICKUP" | "GHN";
type RequiredNote = "CHOTHUHANG" | "CHOXEMHANGKHONGTHU" | "KHONGCHOXEMHANG";
type NoticeType = "error" | "success" | "info";
type GhnProvince = { provinceId: number; provinceName: string; code?: string; status?: number };
type GhnDistrict = { districtId: number; provinceId: number; districtName: string; code?: string; type?: number; supportType?: number; status?: number };
type GhnWard = { wardCode: string; districtId: number; wardName: string; supportType?: number; status?: number };
type GhnAddressPayload = { provinceId: number; provinceName: string; districtId: number; districtName: string; wardCode: string; wardName: string; addressDetail: string };
type GhnContactPayload = { fullName: string; phone: string; address: GhnAddressPayload };
type ParcelPayload = { weightGram: number; lengthCm: number; widthCm: number; heightCm: number };
type GhnItemPayload = ParcelPayload & { name: string; code?: string | null; quantity: number };
type GhnItemForm = { name: string; quantity: string; weightGram: string; lengthCm: string; widthCm: string; heightCm: string };
type GhnPreviewRequest = ParcelPayload & {
  agreementType: "No_Inspection";
  deliveryMethod: "GhnDelivery";
  sender: GhnContactPayload;
  receiver: GhnContactPayload;
  serviceTypeId: 2 | 5;
  parcelCount: number;
  requiredNote: RequiredNote;
  content: string;
  items: GhnItemPayload[];
};
type GhnShippingInfo = Partial<ParcelPayload> & {
  previewToken: string;
  sender: GhnContactPayload;
  receiver: GhnContactPayload;
  serviceTypeId: 2 | 5;
  parcelCount: number;
  requiredNote: RequiredNote;
  content?: string | null;
  lightParcel?: ParcelPayload | null;
  items: GhnItemPayload[];
  quote?: null;
  quoteStatus?: null;
  paymentTypeId?: null;
};
type GhnPreviewResponse = ParcelPayload & {
  negotiationId: string;
  totalFee: number;
  expectedDeliveryAt: string | null;
  serviceTypeId: 2 | 5;
  parcelCount: number;
  items: GhnItemPayload[];
  shippingInfo: GhnShippingInfo;
  previewToken: string;
  expiresAt: string;
};
type GhnParcelInfo = {
  sender?: GhnContactPayload | null;
  receiver?: GhnContactPayload | null;
  serviceTypeId: 2 | 5;
  lightParcel?: ParcelPayload | null;
  items: GhnItemPayload[];
  hasProductDimensions: boolean;
  requiresPackagingDimensions: boolean;
  productWeightGram?: number | null;
  productLengthCm?: number | null;
  productWidthCm?: number | null;
  productHeightCm?: number | null;
  commercialQuantity?: number;
  estimatedTotalWeightGram?: number | null;
  estimatedOverLimit?: boolean;
};

// Thông tin người bán (ảnh chụp giao dịch) — bổ sung vào agreementDetails; KHÔNG thay thế ghnInfo.
type SellerInfoPayload = { fullName: string | null; phone: string | null; streetAddress: string | null; ward: string | null; city: string | null };
type SellerInfoForm = { fullName: string; phone: string; streetAddress: string; ward: string; city: string };
const EMPTY_SELLER_INFO: SellerInfoForm = { fullName: "", phone: "", streetAddress: "", ward: "", city: "" };
// Chuỗi rỗng không phải null: gửi null khi người dùng không cung cấp.
const toNullable = (value: string) => { const text = String(value ?? "").trim(); return text ? text : null; };
type AgreementDetailsPayload = { sellerInfo?: SellerInfoPayload | null; revision: number; notes?: string | null; inspectionDate?: string | null; inspectionAddress?: string | null; collectionDate?: string | null; pickupAddress?: string | null; deliveryAddress?: string | null; deliveryMethod?: "Unknown" | "GhnDelivery" | "SellerDelivers" | "BuyerPickUp"; ghnInfo?: GhnShippingInfo | null; codValue?: number | null; estimatedShippingFee?: number | null };
type CreateAgreementPayload = { negotiationId: string; agreementType: "Inspection" | "No_Inspection"; paymentType: "Deposit" | "Full_Payment"; agreementDetails: AgreementDetailsPayload };
type UpdateAgreementPayload = Omit<CreateAgreementPayload, "negotiationId">;
type GhnPartyFormValue = { fullName: string; phone: string; province: GhnProvince | null; district: GhnDistrict | null; ward: GhnWard | null; addressDetail: string };
type NoticeState = { type: NoticeType; message: string };

const EMPTY_ITEM: GhnItemForm = { name: "", quantity: "1", weightGram: "", lengthCm: "", widthCm: "", heightCm: "" };
const toItemForm = (item: GhnItemPayload): GhnItemForm => ({
  name: item.name || "", quantity: String(item.quantity || 1),
  weightGram: String(item.weightGram || ""), lengthCm: String(item.lengthCm || ""),
  widthCm: String(item.widthCm || ""), heightCm: String(item.heightCm || ""),
});
const getGhnErrorCode = (error: any): string =>
  String(error?.response?.data?.code ?? error?.response?.data?.error?.code ?? error?.code ?? "");
const GHN_ERROR_MESSAGES: Record<string, string> = {
  "Ghn.InvalidPreview": "Thông tin tính phí đã hết hạn hoặc thay đổi. Vui lòng tính lại phí giao hàng trước khi lưu.",
  "Ghn.QuoteChanged": "Phí giao hàng đã thay đổi. Vui lòng tính lại phí và kiểm tra trước khi lưu.",
  "Ghn.ServiceUnavailable": "GHN hiện chưa hỗ trợ kiện hàng trên tuyến giao nhận này. Vui lòng kiểm tra địa chỉ hoặc chọn phương thức giao nhận khác.",
  "Ghn.ParcelInformationRequired": "Vui lòng nhập đủ khối lượng và kích thước đóng gói thực tế của kiện hàng.",
  "Ghn.MultiParcelDimensionsUnverified": "GHN hiện chưa hỗ trợ xác nhận đơn có nhiều kiện trên HomeCycle. Vui lòng chọn Người bán giao hoặc Người mua tự lấy.",
};
const formatGhnDate = (value?: string | null) => {
  const date = value ? new Date(value) : null;
  return date && Number.isFinite(date.getTime()) ? date.toLocaleString("vi-VN") : "Chưa có dự kiến";
};
const MAX_WEIGHT_GRAM = 50000;
const EMPTY_PARTY: GhnPartyFormValue = { fullName: "", phone: "", province: null, district: null, ward: null, addressDetail: "" };
const FINAL_TERMS_REQUIRED_MESSAGE = "Phiên thương lượng chưa có giá và số lượng đã chốt. Vui lòng hoàn tất thương lượng trước khi tạo hợp đồng.";
const EDIT_UNAVAILABLE_MESSAGE = "Hợp đồng không còn ở trạng thái cho phép chỉnh sửa.";
const isPendingAgreementStatus = (status: unknown) =>
  typeof status === "string" &&
  status.trim().replace(/[\s_-]/g, "").toLowerCase() === "pending";
// Lịch hẹn (kiểm định / thu gom) là DateTime: người dùng chọn cả NGÀY và GIỜ theo
// giờ địa phương; ISO gửi đi là đúng khoảnh khắc đó (toISOString → UTC).
const pad2 = (value: number) => String(value).padStart(2, "0");
const isValidClockTime = (value: string) => /^([01]\d|2[0-3]):[0-5]\d$/.test(value.trim());
// Ghép ngày (YYYY-MM-DD) + giờ (HH:mm) thành Date theo múi giờ máy (không dùng chuỗi
// ISO thiếu múi giờ để tránh hiểu nhầm thành UTC); null nếu ngày/giờ không hợp lệ.
const combineLocalDateTime = (date: string, time: string): Date | null => {
  const dateMatch = date.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch || !isValidClockTime(time)) return null;
  const [, yearText, monthText, dayText] = dateMatch;
  const [hourText, minuteText] = time.trim().split(":");
  const combined = new Date(
    Number(yearText),
    Number(monthText) - 1,
    Number(dayText),
    Number(hourText),
    Number(minuteText),
    0,
    0,
  );
  const valid =
    combined.getFullYear() === Number(yearText) &&
    combined.getMonth() === Number(monthText) - 1 &&
    combined.getDate() === Number(dayText);
  return valid ? combined : null;
};
// Tách ISO từ máy chủ thành ngày + giờ địa phương để hydrate (giữ nguyên khoảnh khắc).
const splitLocalDateTime = (value: unknown): { date: string; time: string } => {
  const text = String(value ?? "").trim();
  if (!text) return { date: "", time: "" };
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return { date: "", time: "" };
  return {
    date: `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}`,
    time: `${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`,
  };
};
const isFutureScheduleDateTime = (date: string, time: string) => {
  const combined = combineLocalDateTime(date, time);
  return combined !== null && combined.getTime() > Date.now();
};

const agreementApi = {
  createAgreement: async (data: CreateAgreementPayload) => (await apiClient.post("/agreements", data)).data,
  getAgreementById: async (id: string) => (await apiClient.get(`/agreements/${id}`)).data,
  // Chỉ người bán của thương lượng được gọi; fullAddress chỉ có ở phản hồi.
  getSellerInfo: async (negotiationId: string) => (await apiClient.get(`/agreements/negotiations/${negotiationId}/seller-info`)).data,
  updateAgreement: async (id: string, data: UpdateAgreementPayload) => {
    try {
      const response = await apiClient.get(`/agreements/${id}`);
      const agreement = response.data?.data || response.data;
      if (!isPendingAgreementStatus(agreement?.agreementStatus)) {
        throw new Error(EDIT_UNAVAILABLE_MESSAGE);
      }
    } catch (error) {
      if (error instanceof Error && error.message === EDIT_UNAVAILABLE_MESSAGE) {
        throw error;
      }
      throw new Error("Không thể xác minh trạng thái hợp đồng để cập nhật. Vui lòng thử lại.");
    }

    return (await apiClient.put(`/agreements/${id}`, data)).data;
  },
  previewShippingFee: async (negotiationId: string, data: GhnPreviewRequest) => (await apiClient.post(`/agreements/negotiations/${negotiationId}/ghn-preview`, data)).data,
  getGhnParcelInfo: async (negotiationId: string) => (await apiClient.get(`/agreements/negotiations/${negotiationId}/ghn-parcel-info`)).data,
};

const negotiationApi = { getNegotiationById: async (id: string) => (await apiClient.get(`/negotiations/${id}`)).data };
const postApi = { getPostById: async (id: string) => (await apiClient.get(`/posts/get-by-id/${id}`)).data };
const ghnApi = {
  getProvinces: async (): Promise<GhnProvince[]> => { const r = await apiClient.get("/GHN/provinces"); return r.data?.data ?? r.data ?? []; },
  getDistricts: async (id: number): Promise<GhnDistrict[]> => { const r = await apiClient.get(`/GHN/provinces/${id}/districts`); return r.data?.data ?? r.data ?? []; },
  getWards: async (id: number): Promise<GhnWard[]> => { const r = await apiClient.get(`/GHN/districts/${id}/wards`); return r.data?.data ?? r.data ?? []; },
};

const getErrorMessage = (error: any, fallback: string) =>
  getApiErrorMessage(error, fallback);
const toPositiveInt = (value: string) => { const number = Number(value.trim()); return Number.isInteger(number) && number > 0 ? number : 0; };
const composeAddress = (value: GhnPartyFormValue) => [capitalizeWordInitials(value.addressDetail).trim(), value.ward?.wardName, value.district?.districtName, value.province?.provinceName].filter(Boolean).join(", ");
const toPartyPayload = (value: GhnPartyFormValue): GhnContactPayload => ({ fullName: capitalizeWordInitials(value.fullName).trim(), phone: value.phone.trim(), address: { provinceId: value.province!.provinceId, provinceName: value.province!.provinceName, districtId: value.district!.districtId, districtName: value.district!.districtName, wardCode: value.ward!.wardCode, wardName: value.ward!.wardName, addressDetail: capitalizeWordInitials(value.addressDetail).trim() } });

function InlineNotice({ notice }: { notice: NoticeState | null }) {
  if (!notice) return null;
  const icon = notice.type === "error" ? "alert-circle-outline" : notice.type === "success" ? "checkmark-circle-outline" : "information-circle-outline";
  return <View style={[styles.notice, notice.type === "error" ? styles.noticeError : notice.type === "success" ? styles.noticeSuccess : styles.noticeInfo]}><Ionicons name={icon} size={20} color={notice.type === "error" ? "#7A1012" : COLORS.primary} /><Text style={[styles.noticeText, notice.type === "error" ? styles.noticeTextError : undefined]}>{notice.message}</Text></View>;
}

function SelectField<T>({ label, placeholder, valueLabel, options, getKey, getLabel, onSelect, onClear, disabled = false, loading = false, hideSearch = false, required = false }: { label: string; placeholder: string; valueLabel?: string; options: T[]; getKey: (item: T) => string; getLabel: (item: T) => string; onSelect: (item: T) => void; onClear?: () => void; disabled?: boolean; loading?: boolean; hideSearch?: boolean; required?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [keyword, setKeyword] = useState("");
  const filteredOptions = useMemo(() => { const q = keyword.trim().toLocaleLowerCase("vi"); return q ? options.filter((item) => getLabel(item).toLocaleLowerCase("vi").includes(q)) : options; }, [getLabel, keyword, options]);

  const closeModal = () => setVisible(false);

  return (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}{required ? <Text style={{ color: COLORS.error }}> *</Text> : null}</Text>
      <TouchableOpacity
        style={[styles.selectInput, disabled ? styles.inputDisabled : undefined]}
        onPress={() => !disabled && setVisible(true)}
        disabled={disabled}
      >
        <Text style={valueLabel ? styles.selectValue : styles.selectPlaceholder} numberOfLines={1}>
          {valueLabel || placeholder}
        </Text>
        {loading ? <ActivityIndicator size="small" color={COLORS.primary} /> : <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />}
      </TouchableOpacity>
      <Modal visible={visible} transparent animationType="fade" onRequestClose={closeModal}>
        <ModalBackdrop style={styles.modalBackdrop} onPress={closeModal}>
          <ModalSurface style={styles.optionModal}>
            <View style={styles.optionHeader}>
              <Text style={styles.optionTitle}>{label}</Text>
              <TouchableOpacity onPress={closeModal}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>
            {!hideSearch ? (
              <View style={styles.searchBox}>
                <Ionicons name="search" size={19} color={COLORS.textLight} />
                <TextInput value={keyword} onChangeText={setKeyword} placeholder="Tìm kiếm..." placeholderTextColor="#547B7D" style={styles.searchInput} />
              </View>
            ) : null}
            {onClear && valueLabel ? (
              <TouchableOpacity
                style={styles.optionRow}
                onPress={() => {
                  onClear();
                  setKeyword("");
                  closeModal();
                }}
              >
                <Text style={styles.optionText}>
                  Bỏ chọn
                </Text>

                <Ionicons
                  name="close-circle-outline"
                  size={20}
                  color={COLORS.primary}
                />
              </TouchableOpacity>
            ) : null}

            <FlatList
              data={filteredOptions}
              keyExtractor={getKey}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.emptyOption}>Không có dữ liệu phù hợp.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    onSelect(item);
                    setKeyword("");
                    closeModal();
                  }}
                >
                  <Text style={styles.optionText}>{getLabel(item)}</Text>
                  {valueLabel === getLabel(item) ? <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} /> : null}
                </TouchableOpacity>
              )}
            />
          </ModalSurface>
        </ModalBackdrop>
      </Modal>
    </View>
  );
}

function NumericInput({ label, value, onChangeText, placeholder, hint, error, required = false }: { label: string; value: string; onChangeText: (value: string) => void; placeholder?: string; hint?: string; error?: string | null; required?: boolean }) {
  return <View style={styles.numericItem}><Text style={styles.inputLabel}>{label}{required ? <Text style={{ color: COLORS.error }}> *</Text> : null}</Text>{hint ? <Text style={styles.numericHint}>{hint}</Text> : null}<TextInput value={value} onChangeText={(text) => onChangeText(text.replace(/[^0-9]/g, ""))} placeholder={placeholder || "0"} placeholderTextColor="#547B7D" keyboardType="number-pad" inputMode="numeric" style={[styles.input, error ? styles.inputError : undefined]} />{error ? <Text style={styles.numericError}>{error}</Text> : null}</View>;
}

function GhnPartyFields({ title, value, isExpanded, onToggle, provinces, districts, wards, loadingDistricts, loadingWards, onChange, onSelectProvince, onSelectDistrict, onSelectWard }: { title: string; value: GhnPartyFormValue; isExpanded: boolean; onToggle: () => void; provinces: GhnProvince[]; districts: GhnDistrict[]; wards: GhnWard[]; loadingDistricts: boolean; loadingWards: boolean; onChange: (patch: Partial<GhnPartyFormValue>) => void; onSelectProvince: (province: GhnProvince) => void; onSelectDistrict: (district: GhnDistrict) => void; onSelectWard: (ward: GhnWard) => void }) {
  const summaryText = value.fullName && value.addressDetail && value.province ? `${value.fullName} - ${composeAddress(value)}` : "Chưa có thông tin";
  return <View style={styles.ghnSubCard}><TouchableOpacity style={styles.accordionHeader} onPress={onToggle}><Text style={styles.ghnSubTitleAcc}>{title}</Text><Ionicons name={isExpanded ? "chevron-up" : "chevron-down"} size={22} color={COLORS.textLight} /></TouchableOpacity>{!isExpanded ? <Text style={styles.accordionSummary} numberOfLines={2}>{summaryText}</Text> : <View style={styles.accordionContent}>
    <View style={styles.inputContainer}><Text style={styles.inputLabel}>Họ và tên <Text style={{ color: COLORS.error }}>*</Text></Text><TextInput value={value.fullName} onChangeText={(fullName) => onChange({ fullName: capitalizeWordInitials(fullName) })} placeholder="Nhập họ và tên" placeholderTextColor="#547B7D" autoCapitalize="words" autoCorrect={false} style={styles.input} /></View>
    <View style={styles.inputContainer}><Text style={styles.inputLabel}>Số điện thoại <Text style={{ color: COLORS.error }}>*</Text></Text><TextInput value={value.phone} onChangeText={(phone) => onChange({ phone: phone.replace(/[^0-9+]/g, "") })} placeholder="Nhập số điện thoại" placeholderTextColor="#547B7D" keyboardType="phone-pad" style={styles.input} /></View>
    <SelectField label="Tỉnh/Thành phố" required placeholder="Chọn tỉnh/thành phố" valueLabel={value.province?.provinceName} options={provinces} getKey={(item) => String(item.provinceId)} getLabel={(item) => item.provinceName} onSelect={onSelectProvince} onClear={() => onChange({ province: null, district: null, ward: null })} />
    <SelectField label="Quận/Huyện" required placeholder={value.province ? "Chọn quận/huyện" : "Chọn tỉnh/thành phố trước"} valueLabel={value.district?.districtName} options={districts} getKey={(item) => String(item.districtId)} getLabel={(item) => item.districtName} onSelect={onSelectDistrict} onClear={() => onChange({ district: null, ward: null })} disabled={!value.province} loading={loadingDistricts} />
    <SelectField label="Phường/Xã" required placeholder={value.district ? "Chọn phường/xã" : "Chọn quận/huyện trước"} valueLabel={value.ward?.wardName} options={wards} getKey={(item) => item.wardCode} getLabel={(item) => item.wardName} onSelect={onSelectWard} onClear={() => onChange({ ward: null })} disabled={!value.district} loading={loadingWards} />
    <View style={styles.inputContainer}><Text style={styles.inputLabel}>Số nhà, tên đường <Text style={{ color: COLORS.error }}>*</Text></Text><TextInput value={value.addressDetail} onChangeText={(addressDetail) => onChange({ addressDetail: capitalizeWordInitials(addressDetail) })} placeholder="Ví dụ: 123 Nguyễn Văn Linh" placeholderTextColor="#547B7D" autoCapitalize="words" style={styles.input} /></View>
  </View>}</View>;
}

// Ô địa chỉ hợp đồng: chính ô nhập là đường tự nhập; giá trị gợi ý (seller-info,
// hợp đồng đã lưu) được đổ sẵn vào ô và người dùng sửa trực tiếp nếu muốn.
function AgreementAddressField({ value, onChange, onClear, disabled, placeholder }: {
  value: string;
  onChange: (value: string, selection?: import("../../src/components/shared/AddressPickerField").AddressSelection | null) => void;
  onClear: () => void;
  disabled: boolean;
  placeholder: string;
}) {
  return <AddressPickerField value={value} onChange={onChange} onClear={onClear} disabled={disabled} placeholder={placeholder} />;
}

export default function AgreementFormScreen() {
  const router = useGuardedRouter(); const { user } = useAuth(); const params = useLocalSearchParams();
  const negotiationId = Array.isArray(params.negotiationId) ? params.negotiationId[0] : params.negotiationId;
  const editAgreementId = Array.isArray(params.editAgreementId) ? params.editAgreementId[0] : params.editAgreementId;
  const isEditing = Boolean(editAgreementId);
  const [sellerInfo, setSellerInfo] = useState<SellerInfoForm>(EMPTY_SELLER_INFO);
  const sellerInfoLoadedRef = useRef(false);
  // Tạo hợp đồng chỉ do người bán; khi sửa, vai trò lấy từ chính hợp đồng.
  const [actorSide, setActorSide] = useState<"seller" | "buyer">("seller");
  const actorId = String(user?.userId || user?.id || "");
  const [isProcessing, setIsProcessing] = useState(false); const [isLoadingData, setIsLoadingData] = useState(isEditing); const [isCalculatingFee, setIsCalculatingFee] = useState(false); const [isLoadingGhnInfo, setIsLoadingGhnInfo] = useState(false); const hasFetchedGhnRef = useRef(false);
  const [editAccess, setEditAccess] = useState<"checking" | "allowed" | "blocked">(isEditing ? "checking" : "allowed");
  const [notice, setNotice] = useState<NoticeState | null>(null); const [isInspection, setIsInspection] = useState(true); const [paymentType, setPaymentType] = useState<"DEPOSIT" | "FULL">("DEPOSIT"); const [revision, setRevision] = useState(1); const [defaultPostDeliveryMethod, setDefaultPostDeliveryMethod] = useState<DeliveryMethod>("SELLER_DELIVERY"); const [originalPostDeliveryMethod, setOriginalPostDeliveryMethod] = useState<DeliveryMethod | null>(null); const [showGhnPostCompatibilityWarning, setShowGhnPostCompatibilityWarning] = useState(false);
  useAutoDismissFeedback(notice, () => setNotice(null));
  const [showLowPriceConfirm, setShowLowPriceConfirm] = useState(false);
  const [summary, setSummary] = useState({ productName: "Đang tải thông tin...", productCode: "", price: 0, quantity: 1 }); const [hasAuthoritativeTerms, setHasAuthoritativeTerms] = useState(false); const [isLoadingSummary, setIsLoadingSummary] = useState(true); const [notes, setNotes] = useState(""); const [inspectionDate, setInspectionDate] = useState(""); const [inspectionTime, setInspectionTime] = useState(""); const [inspectionAddress, setInspectionAddress] = useState(""); const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("SELLER_DELIVERY"); const [collectionDate, setCollectionDate] = useState(""); const [collectionTime, setCollectionTime] = useState(""); const [pickupAddress, setPickupAddress] = useState(""); const [deliveryAddress, setDeliveryAddress] = useState("");
  const [provinces, setProvinces] = useState<GhnProvince[]>([]); const [senderDistricts, setSenderDistricts] = useState<GhnDistrict[]>([]); const [receiverDistricts, setReceiverDistricts] = useState<GhnDistrict[]>([]); const [senderWards, setSenderWards] = useState<GhnWard[]>([]); const [receiverWards, setReceiverWards] = useState<GhnWard[]>([]); const [loadingSenderDistricts, setLoadingSenderDistricts] = useState(false); const [loadingReceiverDistricts, setLoadingReceiverDistricts] = useState(false); const [loadingSenderWards, setLoadingSenderWards] = useState(false); const [loadingReceiverWards, setLoadingReceiverWards] = useState(false);
  const [sender, setSender] = useState<GhnPartyFormValue>(EMPTY_PARTY);
  const [receiver, setReceiver] = useState<GhnPartyFormValue>(EMPTY_PARTY);
  const [senderExpanded, setSenderExpanded] = useState(false);
  const [receiverExpanded, setReceiverExpanded] = useState(false);
  const [requiredNote, setRequiredNote] = useState<RequiredNote | "">("");
  // Backend hiện chỉ xác nhận một kiện vật lý. Số lượng Agreement vẫn chỉ là
  // số lượng thương mại và không tham gia phép tính kiện GHN.
  const [item, setItem] = useState<GhnItemForm>({ ...EMPTY_ITEM });
  const [hasUnsupportedMultiParcel, setHasUnsupportedMultiParcel] = useState(false);
  const [shippingContent, setShippingContent] = useState("");
  const [packagingHint, setPackagingHint] = useState("");
  const [ghnPreview, setGhnPreview] = useState<GhnPreviewResponse | null>(null);
  const acceptedPreviewRef = useRef<GhnPreviewResponse | null>(null);
  const previewGenerationRef = useRef(0);
  const submitInFlightRef = useRef(false);
  const editAccessRequestRef = useRef(0);
  const senderEditedRef = useRef(false);
  const receiverEditedRef = useRef(false);
  const totalWeightGram = toPositiveInt(item.weightGram);
  const serviceTypeId: 2 | 5 = totalWeightGram >= 20000 ? 5 : 2;

  const invalidateQuote = useCallback(() => {
    previewGenerationRef.current += 1;
    acceptedPreviewRef.current = null;
    setGhnPreview(null);
    setIsCalculatingFee(false);
  }, []);
  useEffect(() => {
    if (!ghnPreview) return;
    const remaining = Date.parse(ghnPreview.expiresAt) - Date.now();
    const timeout = setTimeout(() => {
      if (acceptedPreviewRef.current !== ghnPreview) return;
      invalidateQuote();
      setNotice({ type: "info", message: "Phí giao hàng đã hết thời gian hiệu lực. Vui lòng tính lại trước khi lưu." });
    }, Math.max(0, Math.min(remaining, 2147483647)));
    return () => clearTimeout(timeout);
  }, [ghnPreview, invalidateQuote]);
  const updateItem = (patch: Partial<GhnItemForm>) => {
    invalidateQuote();
    setItem(current => ({ ...current, ...patch }));
  };
  const requireCurrentPreview = () => {
    const preview = acceptedPreviewRef.current;
    if (!preview || Date.parse(preview.expiresAt) <= Date.now()) {
      invalidateQuote();
      throw Object.assign(new Error(GHN_ERROR_MESSAGES["Ghn.InvalidPreview"]), { code: "Ghn.InvalidPreview" });
    }
    return preview;
  };
  const updateSender = (patch: Partial<GhnPartyFormValue>) => { senderEditedRef.current = true; setSender((current) => ({ ...current, ...patch })); invalidateQuote(); };
  const updateReceiver = (patch: Partial<GhnPartyFormValue>) => { receiverEditedRef.current = true; setReceiver((current) => ({ ...current, ...patch })); invalidateQuote(); };
  const fetchProvinces = useCallback(async () => { try { const data = await ghnApi.getProvinces(); setProvinces([...data].sort((a, b) => a.provinceName.localeCompare(b.provinceName, "vi"))); } catch (error) { setNotice({ type: "error", message: getErrorMessage(error, "Không thể tải danh sách tỉnh/thành phố GHN.") }); } }, []);
  const fetchSummary = useCallback(async () => { if (!negotiationId) return; try { setIsLoadingSummary(true); if (!isEditing) setHasAuthoritativeTerms(false); const negRes = await negotiationApi.getNegotiationById(negotiationId as string); const neg = negRes?.data || negRes; const price = Number(neg?.finalPrice ?? neg?.FinalPrice); const quantity = Number(neg?.finalQuantity ?? neg?.FinalQuantity); if (!isEditing && (!Number.isFinite(price) || price <= 0 || !Number.isInteger(quantity) || quantity <= 0)) { setNotice({ type: "error", message: FINAL_TERMS_REQUIRED_MESSAGE }); return; } const postId = neg?.postId ?? neg?.PostId; let productName = "Sản phẩm thương lượng"; let productCode = postId || ""; if (postId) { const postRes = await postApi.getPostById(postId); const postData = postRes?.data || postRes; productName = postData?.product?.productName || postData?.productName || productName; productCode = postData?.product?.productId || postData?.productId || postId; let method: DeliveryMethod = "SELLER_DELIVERY"; const raw = postData?.product?.deliveryMethod ?? postData?.deliveryMethod; const normalizedMethod = String(raw ?? "").trim().toLowerCase(); if (raw === 1 || normalizedMethod === "1" || normalizedMethod === "ghndelivery") method = "GHN"; else if (raw === 3 || normalizedMethod === "3" || normalizedMethod === "buyerpickup") method = "BUYER_PICKUP"; setDefaultPostDeliveryMethod(method); setOriginalPostDeliveryMethod(method); } setSummary((current) => ({ productName, productCode, price: isEditing ? current.price : price, quantity: isEditing ? current.quantity : quantity })); if (!isEditing) setHasAuthoritativeTerms(true); } catch (error) { setNotice({ type: "error", message: getErrorMessage(error, "Không thể tải thông tin giao dịch.") }); } finally { setIsLoadingSummary(false); } }, [isEditing, negotiationId]);
  const hydrateGhnParty = (party: any): GhnPartyFormValue => ({ fullName: capitalizeWordInitials(party?.fullName || ""), phone: party?.phone || "", province: party?.address?.provinceId ? { provinceId: Number(party.address.provinceId), provinceName: party.address.provinceName || "" } : null, district: party?.address?.districtId ? { districtId: Number(party.address.districtId), provinceId: Number(party.address.provinceId || 0), districtName: party.address.districtName || "" } : null, ward: party?.address?.wardCode ? { wardCode: String(party.address.wardCode), districtId: Number(party.address.districtId || 0), wardName: party.address.wardName || "" } : null, addressDetail: capitalizeWordInitials(party?.address?.addressDetail || "") });
  const loadEditLocationOptions = useCallback(async (senderValue: GhnPartyFormValue, receiverValue: GhnPartyFormValue) => { try { const [a, b] = await Promise.all([senderValue.province ? ghnApi.getDistricts(senderValue.province.provinceId) : Promise.resolve([]), receiverValue.province ? ghnApi.getDistricts(receiverValue.province.provinceId) : Promise.resolve([])]); setSenderDistricts(a); setReceiverDistricts(b); const [c, d] = await Promise.all([senderValue.district ? ghnApi.getWards(senderValue.district.districtId) : Promise.resolve([]), receiverValue.district ? ghnApi.getWards(receiverValue.district.districtId) : Promise.resolve([])]); setSenderWards(c); setReceiverWards(d); } catch (error) { setNotice({ type: "error", message: getErrorMessage(error, "Không thể tải lại dữ liệu địa chỉ GHN.") }); } }, []);
  const fetchExistingAgreement = useCallback(async () => {
    if (!isEditing || !editAgreementId) return;

    const request = ++editAccessRequestRef.current;
    const generation = previewGenerationRef.current;
    try {
      setIsLoadingData(true);
      setEditAccess("checking");

      const res = await agreementApi.getAgreementById(editAgreementId as string);
      const data = res?.data || res;
      if (
        !data ||
        generation !== previewGenerationRef.current ||
        request !== editAccessRequestRef.current
      ) {
        return;
      }

      if (!isPendingAgreementStatus(data.agreementStatus)) {
        setEditAccess("blocked");
        setNotice({ type: "error", message: EDIT_UNAVAILABLE_MESSAGE });
        return;
      }

      const price = Number(
        data.finalPrice ?? data.FinalPrice ?? data.initialPrice ?? data.InitialPrice,
      );
      const quantity = Number(data.quantity ?? data.Quantity);
      if (!Number.isFinite(price) || price <= 0 || !Number.isInteger(quantity) || quantity <= 0) {
        throw new Error("Không tìm thấy giá và số lượng hợp đồng hợp lệ.");
      }

      invalidateQuote();
      setSummary((current) => ({ ...current, price, quantity }));
      const buyerId = String(data.buyerId ?? data.BuyerId ?? "").toLowerCase();
      setActorSide(actorId && buyerId && buyerId === actorId.toLowerCase() ? "buyer" : "seller");
      setHasAuthoritativeTerms(true);

      const inspection = data.agreementType === "Inspection" || data.agreementType === 0;
      setIsInspection(inspection);
      setPaymentType(data.paymentType === "Deposit" || data.paymentType === 1 ? "DEPOSIT" : "FULL");

      const details = data.agreementDetails || {};
      const currentRevision = Number(details.revision ?? data.revision ?? 1);
      setRevision(Number.isFinite(currentRevision) && currentRevision >= 1 ? currentRevision : 1);
      setNotes(details.notes || "");
      // Giữ nguyên giờ đã lưu (chuyển sang giờ địa phương), không cắt về 00:00.
      const inspectionParts = splitLocalDateTime(details.inspectionDate);
      setInspectionDate(inspectionParts.date);
      setInspectionTime(inspectionParts.time);
      setInspectionAddress(details.inspectionAddress || "");
      const collectionParts = splitLocalDateTime(details.collectionDate);
      setCollectionDate(collectionParts.date);
      setCollectionTime(collectionParts.time);
      setPickupAddress(details.pickupAddress || "");
      setDeliveryAddress(details.deliveryAddress || "");
      // Ưu tiên sellerInfo đã lưu trong hợp đồng (ảnh chụp lịch sử), không ghi đè bằng hồ sơ hiện tại.
      const savedSellerInfo = details.sellerInfo ?? details.SellerInfo;
      if (savedSellerInfo && typeof savedSellerInfo === "object") {
        setSellerInfo({
          fullName: String(savedSellerInfo.fullName ?? ""),
          phone: String(savedSellerInfo.phone ?? ""),
          streetAddress: String(savedSellerInfo.streetAddress ?? ""),
          ward: String(savedSellerInfo.ward ?? ""),
          city: String(savedSellerInfo.city ?? ""),
        });
        sellerInfoLoadedRef.current = true;
      }
      if (details.deliveryMethod === "SellerDelivers" || details.deliveryMethod === 2) setDeliveryMethod("SELLER_DELIVERY");
      else if (details.deliveryMethod === "BuyerPickUp" || details.deliveryMethod === 3) setDeliveryMethod("BUYER_PICKUP");
      else if (details.deliveryMethod === "GhnDelivery" || details.deliveryMethod === 1) setDeliveryMethod("GHN");

      const info = details.ghnInfo;
      if (info) {
        hasFetchedGhnRef.current = true;
        const s = hydrateGhnParty(info.sender);
        const r = hydrateGhnParty(info.receiver);
        setSender(s);
        setReceiver(r);
        setRequiredNote(info.requiredNote || "");
        setShippingContent(info.content || "");
        const savedItems = Array.isArray(info.items) ? info.items : [];
        const isMultiParcel = Number(info.parcelCount || savedItems.length || 1) > 1 || savedItems.length > 1;
        setHasUnsupportedMultiParcel(isMultiParcel);
        if (!isMultiParcel) {
          const parcel = savedItems[0] ?? info.lightParcel ?? info;
          setItem(toItemForm({
            name: savedItems[0]?.name || "Kiện hàng HomeCycle",
            code: savedItems[0]?.code ?? null,
            quantity: 1,
            weightGram: Number(parcel?.weightGram || 0),
            lengthCm: Number(parcel?.lengthCm || 0),
            widthCm: Number(parcel?.widthCm || 0),
            heightCm: Number(parcel?.heightCm || 0),
          }));
        }
        setPackagingHint(isMultiParcel
          ? GHN_ERROR_MESSAGES["Ghn.MultiParcelDimensionsUnverified"]
          : "Vui lòng kiểm tra lại thông tin kiện đã đóng gói và tính phí trước khi lưu thay đổi.");
        await loadEditLocationOptions(s, r);
      }

      if (request === editAccessRequestRef.current) {
        setEditAccess("allowed");
      }
    } catch {
      if (request === editAccessRequestRef.current) {
        setEditAccess("blocked");
        setNotice({
          type: "error",
          message: "Không thể xác minh trạng thái hợp đồng để chỉnh sửa. Vui lòng thử lại.",
        });
      }
    } finally {
      if (request === editAccessRequestRef.current) {
        setIsLoadingData(false);
      }
    }
  }, [actorId, editAgreementId, invalidateQuote, isEditing, loadEditLocationOptions]);
  const prefillSellerInfo = useCallback(async () => {
    if (!negotiationId || sellerInfoLoadedRef.current) return;
    try {
      const response = await agreementApi.getSellerInfo(negotiationId as string);
      const data = response?.data ?? response;
      if (!data || sellerInfoLoadedRef.current) return;
      sellerInfoLoadedRef.current = true;
      setSellerInfo({
        fullName: String(data.fullName ?? ""),
        phone: String(data.phone ?? ""),
        streetAddress: String(data.streetAddress ?? ""),
        ward: String(data.ward ?? ""),
        city: String(data.city ?? ""),
      });
      const fullAddress = String(data.fullAddress ?? "").trim();
      // fullAddress chỉ là gợi ý ban đầu cho địa chỉ lấy hàng; người dùng vẫn sửa được.
      setPickupAddress((current) => (current.trim() ? current : fullAddress));
    } catch (error) {
      // 403/404/lỗi tạm thời: người dùng vẫn tự nhập được; không chặn màn hình.
      devLog("[agreement] Không lấy được thông tin người bán:", error);
    }
  }, [negotiationId]);

  useFocusEffect(useCallback(() => {
    void fetchProvinces();
    void fetchSummary();
    if (isEditing) {
      void fetchExistingAgreement().then(() => {
        // Chỉ dùng nguồn khác khi hợp đồng chưa có sellerInfo và người sửa là người bán.
        if (!sellerInfoLoadedRef.current && actorSide === "seller") void prefillSellerInfo();
      });
    } else {
      void prefillSellerInfo();
    }
  }, [actorSide, fetchExistingAgreement, fetchProvinces, fetchSummary, isEditing, prefillSellerInfo]));

  const selectSenderProvince = async (province: GhnProvince) => { updateSender({ province, district: null, ward: null }); setSenderDistricts([]); setSenderWards([]); try { setLoadingSenderDistricts(true); setSenderDistricts(await ghnApi.getDistricts(province.provinceId)); } catch (error) { setNotice({ type: "error", message: getErrorMessage(error, "Không thể tải quận/huyện nơi gửi.") }); } finally { setLoadingSenderDistricts(false); } };
  const selectReceiverProvince = async (province: GhnProvince) => { updateReceiver({ province, district: null, ward: null }); setReceiverDistricts([]); setReceiverWards([]); try { setLoadingReceiverDistricts(true); setReceiverDistricts(await ghnApi.getDistricts(province.provinceId)); } catch (error) { setNotice({ type: "error", message: getErrorMessage(error, "Không thể tải quận/huyện nơi nhận.") }); } finally { setLoadingReceiverDistricts(false); } };
  const selectSenderDistrict = async (district: GhnDistrict) => { updateSender({ district, ward: null }); setSenderWards([]); try { setLoadingSenderWards(true); setSenderWards(await ghnApi.getWards(district.districtId)); } catch (error) { setNotice({ type: "error", message: getErrorMessage(error, "Không thể tải phường/xã nơi gửi.") }); } finally { setLoadingSenderWards(false); } };
  const selectReceiverDistrict = async (district: GhnDistrict) => { updateReceiver({ district, ward: null }); setReceiverWards([]); try { setLoadingReceiverWards(true); setReceiverWards(await ghnApi.getWards(district.districtId)); } catch (error) { setNotice({ type: "error", message: getErrorMessage(error, "Không thể tải phường/xã nơi nhận.") }); } finally { setLoadingReceiverWards(false); } };
  const handleDeliveryMethodChange = async (method: DeliveryMethod) => {
    const switchedToGhn = method === "GHN" && deliveryMethod !== "GHN";
    if (method !== deliveryMethod) invalidateQuote();
    setDeliveryMethod(method);
    setNotice(null);
    setShowGhnPostCompatibilityWarning(
      switchedToGhn && originalPostDeliveryMethod !== null && originalPostDeliveryMethod !== "GHN",
    );
    if (method !== "GHN") return;
    setPaymentType("FULL");
    if (hasFetchedGhnRef.current || !negotiationId) return;
    const generation = previewGenerationRef.current;
    try {
      setIsLoadingGhnInfo(true);
      const response = await agreementApi.getGhnParcelInfo(negotiationId);
      if (generation !== previewGenerationRef.current) return;
      const data: GhnParcelInfo = response?.data ?? response;
      if (!data) throw new Error();
      hasFetchedGhnRef.current = true;
      const senderSuggestion = data.sender ? hydrateGhnParty(data.sender) : null;
      const receiverSuggestion = data.receiver ? hydrateGhnParty(data.receiver) : null;
      if (senderSuggestion && !senderEditedRef.current) setSender(senderSuggestion);
      if (receiverSuggestion && !receiverEditedRef.current) setReceiver(receiverSuggestion);
      if (senderSuggestion || receiverSuggestion) {
        void loadEditLocationOptions(
          senderSuggestion && !senderEditedRef.current ? senderSuggestion : sender,
          receiverSuggestion && !receiverEditedRef.current ? receiverSuggestion : receiver,
        );
      }
      const suggestedItems = Array.isArray(data.items) ? data.items : [];
      const isMultiParcel = suggestedItems.length > 1;
      setHasUnsupportedMultiParcel(isMultiParcel);
      const productSuggestion: ParcelPayload | null =
        [
          data.productWeightGram,
          data.productLengthCm,
          data.productWidthCm,
          data.productHeightCm,
        ].some((value) => Number(value) > 0)
          ? {
              weightGram: Number(data.productWeightGram ?? 0),
              lengthCm: Number(data.productLengthCm ?? 0),
              widthCm: Number(data.productWidthCm ?? 0),
              heightCm: Number(data.productHeightCm ?? 0),
            }
          : null;

      const parcel = isMultiParcel
        ? null
        : suggestedItems[0] ?? data.lightParcel ?? productSuggestion;
      setItem({
        ...EMPTY_ITEM,
        weightGram: String(parcel?.weightGram || ""),
        lengthCm: String(parcel?.lengthCm || ""),
        widthCm: String(parcel?.widthCm || ""),
        heightCm: String(parcel?.heightCm || ""),
      });
      setPackagingHint(isMultiParcel
        ? GHN_ERROR_MESSAGES["Ghn.MultiParcelDimensionsUnverified"]
        : data.requiresPackagingDimensions
          ? "Thông số từ bài đăng là gợi ý ban đầu. Vui lòng kiểm tra và điều chỉnh theo kiện thực tế sau đóng gói trước khi tính phí."
          : "Thông số từ bài đăng chỉ là gợi ý. Vui lòng kiểm tra kiện thực tế sau đóng gói.");
      setNotice({
        type: isMultiParcel ? "error" : "info",
        message: isMultiParcel
          ? GHN_ERROR_MESSAGES["Ghn.MultiParcelDimensionsUnverified"]
          : "Đã lấy gợi ý kiện hàng. Vui lòng kiểm tra và nhập thông tin đóng gói thực tế.",
      });
    } catch {
      if (generation === previewGenerationRef.current)
        setNotice({ type: "error", message: "Không thể lấy gợi ý kiện hàng. Bạn có thể nhập thông tin đóng gói hoặc chọn lại GHN để thử lại." });
    } finally {
      setIsLoadingGhnInfo(false);
    }
  };
  const buildPreviewItems = (): GhnItemPayload[] => [{
    name: summary.productName.trim() || "Kiện hàng HomeCycle", quantity: 1,
    weightGram: toPositiveInt(item.weightGram), lengthCm: toPositiveInt(item.lengthCm),
    widthCm: toPositiveInt(item.widthCm), heightCm: toPositiveInt(item.heightCm),
  }];
  // Kiện đã đóng gói: rộng không được lớn hơn dài (bằng nhau hợp lệ); kiểm tra ngay khi đổi Dài/Rộng.
  const parcelWidthError =
    item.lengthCm.trim() && item.widthCm.trim() && Number(item.widthCm) > Number(item.lengthCm)
      ? "Chiều rộng không được lớn hơn chiều dài."
      : null;

  const validateGhnForm = () => {
    if (!sender.fullName.trim() || !sender.phone.trim() || !sender.province || !sender.district || !sender.ward || !sender.addressDetail.trim())
      return "Vui lòng nhập đầy đủ thông tin và địa chỉ người gửi.";
    if (!receiver.fullName.trim() || !receiver.phone.trim() || !receiver.province || !receiver.district || !receiver.ward || !receiver.addressDetail.trim())
      return "Vui lòng nhập đầy đủ thông tin và địa chỉ người nhận.";
    if (hasUnsupportedMultiParcel) return GHN_ERROR_MESSAGES["Ghn.MultiParcelDimensionsUnverified"];
    if (!toPositiveInt(item.weightGram)) return "Vui lòng nhập khối lượng kiện đã đóng gói lớn hơn 0.";
    if (totalWeightGram > MAX_WEIGHT_GRAM)
      return "GHN chỉ hỗ trợ kiện hàng có tổng khối lượng tối đa 50 kg. Vui lòng giảm khối lượng hoặc chọn phương thức giao hàng khác.";
    if ([item.lengthCm, item.widthCm, item.heightCm].some(value => !toPositiveInt(value) || toPositiveInt(value) > 200))
      return "Kích thước kiện đã đóng gói phải là số nguyên từ 1 đến 200 cm.";
    if (parcelWidthError) return parcelWidthError;
    if (!requiredNote) return "Vui lòng chọn yêu cầu khi giao hàng.";
    if (shippingContent.trim().length > 2000) return "Nội dung hàng gửi không được vượt quá 2.000 ký tự.";
    return null;
  };

  const handleCalculateFee = async () => {
    if (isInspection || deliveryMethod !== "GHN" || isCalculatingFee || submitInFlightRef.current) return;
    const validationMessage = validateGhnForm();
    if (validationMessage || !negotiationId) {
      setNotice({ type: "error", message: validationMessage || "Không tìm thấy phiên thương lượng để tính phí giao hàng." });
      return;
    }
    invalidateQuote();
    const generation = previewGenerationRef.current;
    try {
      setIsCalculatingFee(true);
      setNotice(null);
      const payload: GhnPreviewRequest = {
        agreementType: "No_Inspection", deliveryMethod: "GhnDelivery",
        sender: toPartyPayload(sender), receiver: toPartyPayload(receiver),
        serviceTypeId, parcelCount: 1,
        weightGram: totalWeightGram, lengthCm: toPositiveInt(item.lengthCm),
        widthCm: toPositiveInt(item.widthCm), heightCm: toPositiveInt(item.heightCm),
        requiredNote: requiredNote as RequiredNote,
        content: shippingContent.trim(), items: buildPreviewItems(),
      };
      const response = await agreementApi.previewShippingFee(negotiationId, payload);
      if (generation !== previewGenerationRef.current) return;
      const preview: GhnPreviewResponse = response?.data ?? response;
      const info = preview?.shippingInfo;
      if (!info?.previewToken || info.previewToken !== preview.previewToken ||
        preview.negotiationId !== negotiationId ||
        !Number.isFinite(preview.totalFee) || preview.totalFee < 0 ||
        !Number.isFinite(Date.parse(preview.expiresAt)) || Date.parse(preview.expiresAt) <= Date.now() ||
        info.quote != null || info.quoteStatus != null || info.paymentTypeId != null) {
        throw new Error("Không thể xác nhận thông tin tính phí giao hàng.");
      }
      acceptedPreviewRef.current = preview;
      setGhnPreview(preview);
      setNotice({ type: "success", message: "Đã tính phí giao hàng. Vui lòng kiểm tra phí và thời gian dự kiến trước khi lưu." });
    } catch (error) {
      if (generation !== previewGenerationRef.current) return;
      invalidateQuote();
      setNotice({ type: "error", message: GHN_ERROR_MESSAGES[getGhnErrorCode(error)] ||
        "Không thể tính phí giao hàng lúc này. Vui lòng kiểm tra thông tin đóng gói và thử lại." });
    } finally {
      if (generation === previewGenerationRef.current) setIsCalculatingFee(false);
    }
  };
  const buildAgreementDetails = (): AgreementDetailsPayload => { const methodMap: Record<DeliveryMethod, AgreementDetailsPayload["deliveryMethod"]> = { SELLER_DELIVERY: "SellerDelivers", BUYER_PICKUP: "BuyerPickUp", GHN: "GhnDelivery" }; const details: AgreementDetailsPayload = { revision: Math.max(1, revision), notes: notes.trim() || null }; if (isInspection) { details.inspectionDate = combineLocalDateTime(inspectionDate, inspectionTime)?.toISOString() ?? null; details.inspectionAddress = inspectionAddress.trim() || null; return details; } details.collectionDate = combineLocalDateTime(collectionDate, collectionTime)?.toISOString() ?? null; details.deliveryMethod = methodMap[deliveryMethod]; if (deliveryMethod !== "GHN") { details.pickupAddress = pickupAddress.trim() || null; details.deliveryAddress = deliveryAddress.trim() || null; details.ghnInfo = null; details.codValue = 0; details.estimatedShippingFee = null; details.sellerInfo = { fullName: toNullable(sellerInfo.fullName), phone: toNullable(sellerInfo.phone), streetAddress: toNullable(sellerInfo.streetAddress || pickupAddress), ward: toNullable(sellerInfo.ward), city: toNullable(sellerInfo.city) }; return details; } const preview = requireCurrentPreview(); details.pickupAddress = composeAddress(sender); details.deliveryAddress = composeAddress(receiver); details.codValue = 0; details.estimatedShippingFee = preview.totalFee; details.ghnInfo = preview.shippingInfo; /* GHN: sellerInfo là ảnh chụp người gửi; ghnInfo giữ nguyên dữ liệu tích hợp GHN. */ details.sellerInfo = { fullName: toNullable(sender.fullName), phone: toNullable(sender.phone), streetAddress: toNullable(sender.addressDetail), ward: toNullable(sender.ward?.wardName ?? ""), city: toNullable(sender.province?.provinceName ?? "") }; return details; };
  const handleSubmit = async (confirmedLowPrice = false) => { if (submitInFlightRef.current) return; setNotice(null); if (!isEditing && !hasAuthoritativeTerms) { setNotice({ type: "error", message: FINAL_TERMS_REQUIRED_MESSAGE }); return; } if (isInspection) { if (!inspectionDate || !inspectionTime.trim() || !inspectionAddress.trim()) { setNotice({ type: "error", message: "Vui lòng nhập ngày, giờ và địa điểm kiểm định." }); return; } if (!isValidClockTime(inspectionTime)) { setNotice({ type: "error", message: "Vui lòng chọn giờ kiểm định." }); return; } if (!isFutureScheduleDateTime(inspectionDate, inspectionTime)) { setNotice({ type: "error", message: "Thời gian kiểm định phải ở tương lai." }); return; } } else { if (!collectionDate || !collectionTime.trim()) { setNotice({ type: "error", message: "Vui lòng chọn ngày và giờ thu gom dự kiến." }); return; } if (!isValidClockTime(collectionTime)) { setNotice({ type: "error", message: "Vui lòng chọn giờ thu gom dự kiến." }); return; } if (!isFutureScheduleDateTime(collectionDate, collectionTime)) { setNotice({ type: "error", message: "Thời gian thu gom phải ở tương lai." }); return; } if (deliveryMethod === "GHN") { const validationMessage = validateGhnForm(); if (validationMessage) { setNotice({ type: "error", message: validationMessage }); return; } if (!acceptedPreviewRef.current || Date.parse(acceptedPreviewRef.current.expiresAt) <= Date.now()) { setNotice({ type: "error", message: "Thông tin giao hàng đã thay đổi hoặc chưa có phí hợp lệ. Vui lòng tính lại phí GHN." }); return; } } else if (!pickupAddress.trim() || !deliveryAddress.trim()) { setNotice({ type: "error", message: "Vui lòng nhập đầy đủ địa chỉ lấy và nhận hàng." }); return; } } if (summary.price < 10_000 && !confirmedLowPrice) { setShowLowPriceConfirm(true); return; } try { submitInFlightRef.current = true; setIsProcessing(true); if (isEditing && editAgreementId) { try { const checkRes = await agreementApi.getAgreementById(editAgreementId as string); const latest = checkRes?.data || checkRes; const latestRevision = Number(latest?.agreementDetails?.revision ?? latest?.revision); if (!Number.isInteger(latestRevision) || latestRevision < 1) { setNotice({ type: "error", message: "Không xác định được phiên bản hợp đồng mới nhất. Vui lòng tải lại và thử lại để tránh ghi đè thay đổi." }); return; } if (latestRevision !== revision) { setNotice({ type: "error", message: "Dữ liệu hợp đồng đã thay đổi. Vui lòng tải lại bản mới nhất để tránh ghi đè." }); return; } } catch { setNotice({ type: "error", message: "Không thể kiểm tra phiên bản hợp đồng mới nhất. Vui lòng thử lại để tránh ghi đè thay đổi của đối tác." }); return; } } const commonPayload = { agreementType: isInspection ? ("Inspection" as const) : ("No_Inspection" as const), paymentType: isInspection ? ("Deposit" as const) : paymentType === "DEPOSIT" ? ("Deposit" as const) : ("Full_Payment" as const), agreementDetails: buildAgreementDetails() }; if (isEditing) { if (!editAgreementId) throw new Error("Không tìm thấy mã hợp đồng cần cập nhật."); await agreementApi.updateAgreement(editAgreementId as string, commonPayload);  router.replace({ pathname: "/agreements/preview", params: { agreementId: editAgreementId, negotiationId, successMsg: "Cập nhật hợp đồng thành công. Đang chờ đối tác xem và xác nhận." } }); } else { await agreementApi.createAgreement({ negotiationId: negotiationId as string, ...commonPayload }); setNotice({ type: "success", message: "Đã tạo hợp đồng và xác nhận phía người bán." }); if (negotiationId) router.replace(`/chat/${negotiationId}`); else router.back(); } } catch (error) {
      const code = getGhnErrorCode(error);
      if (!isInspection && deliveryMethod === "GHN") {
        invalidateQuote();
        setNotice({ type: "error", message: GHN_ERROR_MESSAGES[code] || getErrorMessage(error, "Không thể lưu hợp đồng lúc này. Vui lòng kiểm tra lại thông tin giao hàng.") });
      } else setNotice({ type: "error", message: getErrorMessage(error, "Không thể thực hiện lúc này.") });
    } finally { submitInFlightRef.current = false; setIsProcessing(false); } };
  const formatPrice = (price: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(price);

  if (isLoadingData) return <SafeAreaView style={styles.safeArea}><Header title={isEditing ? "Chỉnh sửa hợp đồng" : "Thiết lập hợp đồng"} showBack /><View style={styles.loadingContainer}><ActivityIndicator size="large" color={COLORS.primary} /></View></SafeAreaView>;
  if (isEditing && editAccess !== "allowed") return <SafeAreaView style={styles.safeArea}><Header title="Chỉnh sửa hợp đồng" showBack /><View style={[styles.loadingContainer, { padding: 24 }]}><Ionicons name="lock-closed-outline" size={40} color={COLORS.textLight} /><Text style={[styles.sectionTitle, { marginTop: 16, textAlign: "center" }]}>Không thể chỉnh sửa hợp đồng</Text><Text style={[styles.noticeText, { textAlign: "center", marginLeft: 0 }]}>{notice?.message || EDIT_UNAVAILABLE_MESSAGE}</Text><TouchableOpacity style={[styles.submitBtn, { alignSelf: "stretch", marginTop: 24 }]} onPress={() => void fetchExistingAgreement()} disabled={isProcessing}><Text style={styles.submitBtnText}>Thử lại</Text></TouchableOpacity></View></SafeAreaView>;
  return <SafeAreaView style={styles.safeArea}><Header title={isEditing ? "Chỉnh sửa hợp đồng" : "Thiết lập hợp đồng"} showBack /><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex}><ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
    <View style={styles.section}><Text style={styles.sectionTitle}>Tóm tắt giao dịch</Text><View style={styles.summaryCard}>{isLoadingSummary ? <ActivityIndicator color={COLORS.primary} /> : hasAuthoritativeTerms ? <><Text style={styles.summaryProductName} numberOfLines={2}>{summary.productName}</Text><Text style={styles.summaryQty}>Giá đơn vị đã chốt: {formatPrice(summary.price)}</Text><Text style={styles.summaryQty}>Số lượng: {summary.quantity}</Text><Text style={styles.summaryPrice}>Tổng tiền hàng: {formatPrice(summary.price * summary.quantity)}</Text></> : <Text style={styles.numericError}>{isEditing ? "Không tìm thấy giá và số lượng hợp đồng hợp lệ." : FINAL_TERMS_REQUIRED_MESSAGE}</Text>}</View></View>
    <View style={styles.section}><Text style={styles.sectionTitle}>Loại giao dịch</Text><View style={styles.radioGroup}><TouchableOpacity style={styles.radioBtn} disabled={isEditing} onPress={() => { if (!isInspection) invalidateQuote(); setIsInspection(true); setPaymentType("DEPOSIT"); setNotice(null); if (!isEditing) { setPickupAddress(""); setDeliveryAddress(""); setDeliveryMethod("SELLER_DELIVERY"); } }}><Ionicons name={isInspection ? "radio-button-on" : "radio-button-off"} size={24} color={isInspection ? COLORS.primary : COLORS.textLight} /><Text style={[styles.radioText, isEditing && !isInspection ? styles.disabledText : undefined]}>Có kiểm định trước</Text></TouchableOpacity><TouchableOpacity style={styles.radioBtnLast} disabled={isEditing} onPress={() => { if (isInspection) invalidateQuote(); setIsInspection(false); setNotice(null); if (!isEditing && defaultPostDeliveryMethod) void handleDeliveryMethodChange(defaultPostDeliveryMethod); }}><Ionicons name={!isInspection ? "radio-button-on" : "radio-button-off"} size={24} color={!isInspection ? COLORS.primary : COLORS.textLight} /><Text style={[styles.radioText, isEditing && isInspection ? styles.disabledText : undefined]}>Không kiểm định (Thu gom)</Text></TouchableOpacity></View>{isEditing ? <Text style={styles.lockedHint}>Không thể thay đổi loại giao dịch sau khi hợp đồng đã được tạo.</Text> : null}</View>
    {isInspection ? <View style={styles.section}><Text style={styles.sectionTitle}>Thông tin kiểm định</Text><View style={styles.inputContainer}><Text style={styles.inputLabel}>Ngày kiểm định <Text style={{ color: COLORS.error }}>*</Text></Text><CalendarDateField value={inspectionDate} onChange={(value) => { setInspectionDate(value); if (!value) setInspectionTime(""); }} placeholder="Chọn ngày..." defaultViewDate={inspectionDate || new Date().toISOString().slice(0, 10)} clearable disabled={isProcessing} /></View><View style={styles.inputContainer}><Text style={styles.inputLabel}>Giờ kiểm định <Text style={{ color: COLORS.error }}>*</Text></Text><ClockTimeField value={inspectionTime} onChange={setInspectionTime} placeholder="Chọn giờ kiểm định" accessibilityLabel="Giờ kiểm định" disabled={isProcessing} /></View><View style={styles.addressFieldBlock}><Text style={styles.inputLabel}>Địa điểm kiểm định <Text style={{ color: COLORS.error }}>*</Text></Text><AgreementAddressField value={inspectionAddress} onChange={(value) => setInspectionAddress(value)} onClear={() => setInspectionAddress("")} placeholder="Nhập địa điểm kiểm định..." disabled={isProcessing} /></View><View style={styles.inputContainer}><Text style={styles.inputLabel}>Ghi chú thêm</Text><TextInput placeholder="Các yêu cầu khác..." placeholderTextColor="#547B7D" value={notes} onChangeText={setNotes} style={[styles.input, styles.multilineInput]} multiline /></View><View style={styles.infoBox}><Ionicons name="information-circle-outline" size={20} color={COLORS.primary} /><Text style={styles.infoText}>Hình thức thanh toán: Đặt cọc (mặc định khi có kiểm định)</Text></View></View> : <View style={styles.section}><Text style={styles.sectionTitle}>Thông tin giao nhận</Text><Text style={styles.subLabel}>Phương thức vận chuyển</Text><View style={[styles.radioGroup, styles.deliveryGroup]}>
      {[["SELLER_DELIVERY", "Bên bán tự giao"], ["BUYER_PICKUP", "Bên mua đến lấy"], ["GHN", "Dịch vụ giao hàng (GHN)"]].map(([method, label], index) => <TouchableOpacity key={method} style={index === 2 ? styles.radioBtnLast : styles.radioBtn} onPress={() => void handleDeliveryMethodChange(method as DeliveryMethod)}><Ionicons name={deliveryMethod === method ? "radio-button-on" : "radio-button-off"} size={24} color={deliveryMethod === method ? COLORS.primary : COLORS.textLight} /><Text style={styles.radioText}>{label}</Text></TouchableOpacity>)}
    </View><View style={styles.inputContainer}><Text style={styles.inputLabel}>Ngày thu gom dự kiến <Text style={{ color: COLORS.error }}>*</Text></Text><CalendarDateField value={collectionDate} onChange={(value) => { setCollectionDate(value); if (!value) setCollectionTime(""); }} placeholder="Chọn ngày..." defaultViewDate={collectionDate || new Date().toISOString().slice(0, 10)} clearable disabled={isProcessing} /></View><View style={styles.inputContainer}><Text style={styles.inputLabel}>Giờ thu gom dự kiến <Text style={{ color: COLORS.error }}>*</Text></Text><ClockTimeField value={collectionTime} onChange={setCollectionTime} placeholder="Chọn giờ thu gom" accessibilityLabel="Giờ thu gom dự kiến" disabled={isProcessing} /></View>{showGhnPostCompatibilityWarning ? <View style={styles.infoBox}><Ionicons name="warning-outline" size={20} color={COLORS.primary} /><Text style={styles.infoText}>Bài đăng ban đầu không sử dụng GHN. Khối lượng và kích thước hiện tại có thể chưa phù hợp với quy định giao hàng nhanh. Vui lòng kiểm tra và điều chỉnh thông tin kiện hàng trước khi tính phí.</Text></View> : null}
    {deliveryMethod === "GHN" ? <View style={styles.configCard}><View style={styles.ghnHeader}><Ionicons name="cube-outline" size={22} color={COLORS.primary} /><Text style={styles.ghnTitle}>Thông tin giao hàng nhanh (GHN)</Text></View>{isLoadingGhnInfo ? <View style={styles.ghnLoadingBox}><ActivityIndicator size="small" color={COLORS.primary} /><Text style={styles.ghnLoadingText}>Đang tự động lấy thông tin kiện hàng...</Text></View> : <><GhnPartyFields title="Thông tin người gửi" value={sender} isExpanded={senderExpanded} onToggle={() => setSenderExpanded(!senderExpanded)} provinces={provinces} districts={senderDistricts} wards={senderWards} loadingDistricts={loadingSenderDistricts} loadingWards={loadingSenderWards} onChange={updateSender} onSelectProvince={selectSenderProvince} onSelectDistrict={selectSenderDistrict} onSelectWard={(ward) => updateSender({ ward })} /><GhnPartyFields title="Thông tin người nhận" value={receiver} isExpanded={receiverExpanded} onToggle={() => setReceiverExpanded(!receiverExpanded)} provinces={provinces} districts={receiverDistricts} wards={receiverWards} loadingDistricts={loadingReceiverDistricts} loadingWards={loadingReceiverWards} onChange={updateReceiver} onSelectProvince={selectReceiverProvince} onSelectDistrict={selectReceiverDistrict} onSelectWard={(ward) => updateReceiver({ ward })} />
        <Text style={styles.quoteHint}>{packagingHint || "Nhập thông tin đóng gói thực tế trước khi tính phí."}</Text>

        <Text style={styles.ghnSubTitle}>Kiện GHN đã đóng gói</Text>
        <View style={styles.ghnSubCard}>
          <Text style={styles.inputLabel} numberOfLines={2}>{summary.productName}</Text>
          <View style={styles.productQtyRow}>
            <Text style={styles.subLabelInline}>Số lượng thương mại</Text>
            <Text style={styles.productQtyValue}>{summary.quantity}</Text>
          </View>
          <Text style={styles.numericHint}>HomeCycle hiện hỗ trợ một kiện GHN. Số lượng thương mại không phải số kiện.</Text>
          <Text style={styles.quoteHint}>Loại hàng: {serviceTypeId === 2 ? "Hàng nhẹ" : "Hàng nặng"}</Text>
          <Text style={totalWeightGram > MAX_WEIGHT_GRAM ? styles.numericError : styles.quoteHint}>
            Khối lượng kiện: {totalWeightGram.toLocaleString("vi-VN")} g (tối đa 50.000 g){totalWeightGram > MAX_WEIGHT_GRAM ? " — vượt giới hạn giao hàng nhanh." : ""}
          </Text>
          <NumericInput label="Khối lượng kiện đã đóng gói (g)" required value={item.weightGram} onChangeText={weightGram => updateItem({ weightGram })} />
          <Text style={styles.numericHint}>Kích thước kiện đã đóng gói (cm)</Text>
          <View style={styles.numericGrid}>
            <NumericInput label="Dài (cm)" required value={item.lengthCm} onChangeText={lengthCm => updateItem({ lengthCm })} />
            <NumericInput label="Rộng (cm)" required value={item.widthCm} onChangeText={widthCm => updateItem({ widthCm })} error={parcelWidthError} />
            <NumericInput label="Cao (cm)" required value={item.heightCm} onChangeText={heightCm => updateItem({ heightCm })} />
          </View>
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.inputLabel}>Nội dung hàng gửi</Text>
          <TextInput style={styles.input} value={shippingContent} placeholder="Mô tả hàng gửi" placeholderTextColor="#547B7D" maxLength={2000} onChangeText={value => { invalidateQuote(); setShippingContent(value); }} />
        </View>
        <View style={styles.topSpacing}><SelectField label="Yêu cầu khi giao hàng" required placeholder="Chọn yêu cầu" hideSearch valueLabel={requiredNote === "CHOTHUHANG" ? "Cho thử hàng" : requiredNote === "CHOXEMHANGKHONGTHU" ? "Cho xem hàng, không thử" : requiredNote === "KHONGCHOXEMHANG" ? "Không cho xem hàng" : ""} options={[{ value: "CHOTHUHANG" as const, label: "Cho thử hàng" }, { value: "CHOXEMHANGKHONGTHU" as const, label: "Cho xem hàng, không thử" }, { value: "KHONGCHOXEMHANG" as const, label: "Không cho xem hàng" }]} getKey={(item) => item.value} getLabel={(item) => item.label} onSelect={(item) => { setRequiredNote(item.value); invalidateQuote(); }} onClear={() => { setRequiredNote(""); invalidateQuote(); }} /></View><TouchableOpacity style={[styles.calculateBtn, isCalculatingFee ? styles.buttonDisabled : undefined]} onPress={() => void handleCalculateFee()} disabled={isCalculatingFee}>{isCalculatingFee ? <ActivityIndicator color={COLORS.white} /> : <><Ionicons name="calculator-outline" size={20} color={COLORS.white} /><Text style={styles.calculateBtnText}>Tính phí giao hàng</Text></>}</TouchableOpacity>{ghnPreview ? <View style={styles.quoteCard}>
          <Text style={styles.quoteLabel}>Phí vận chuyển dự kiến</Text>
          <Text style={styles.quoteValue}>{formatPrice(ghnPreview.totalFee)}</Text>
          <Text style={styles.quoteHint}>Dự kiến giao: {formatGhnDate(ghnPreview.expectedDeliveryAt)}</Text>
          <Text style={styles.quoteHint}>Thông số đã tính phí: {ghnPreview.parcelCount} kiện · {ghnPreview.weightGram} g · {ghnPreview.lengthCm} × {ghnPreview.widthCm} × {ghnPreview.heightCm} cm</Text>
          <Text style={styles.quoteHint}>Phí có hiệu lực đến {formatGhnDate(ghnPreview.expiresAt)}. Vui lòng tính lại nếu thay đổi thông tin giao hàng.</Text>
        </View> : null}</>}</View> : <><Text style={styles.subLabel}>Thông tin người bán</Text><View style={styles.inputContainer}><Text style={styles.inputLabel}>Họ và tên người bán</Text><TextInput value={sellerInfo.fullName} onChangeText={(fullName) => setSellerInfo((current) => ({ ...current, fullName: capitalizeWordInitials(fullName) }))} placeholder="Nhập họ và tên" placeholderTextColor="#547B7D" autoCapitalize="words" autoCorrect={false} style={styles.input} editable={!isProcessing} /></View><View style={styles.inputContainer}><Text style={styles.inputLabel}>Số điện thoại người bán</Text><TextInput value={sellerInfo.phone} onChangeText={(phone) => setSellerInfo((current) => ({ ...current, phone: phone.replace(/[^0-9+]/g, "") }))} placeholder="Nhập số điện thoại" placeholderTextColor="#547B7D" keyboardType="phone-pad" style={styles.input} editable={!isProcessing} /></View><View style={styles.addressFieldBlock}><Text style={styles.inputLabel}>Địa chỉ lấy hàng (Người bán) <Text style={{ color: COLORS.error }}>*</Text></Text><AgreementAddressField value={pickupAddress} onChange={(value, selection) => { setPickupAddress(value); setSellerInfo((current) => selection ? { ...current, streetAddress: selection.streetAddress || value, ward: selection.wardName || "", city: selection.provinceName || "" } : { ...current, streetAddress: value, ward: "", city: "" }); }} onClear={() => { setPickupAddress(""); setSellerInfo((current) => ({ ...current, streetAddress: "", ward: "", city: "" })); }} placeholder="Nhập địa chỉ lấy hàng..." disabled={isProcessing} /></View><View style={styles.addressFieldBlock}><Text style={styles.inputLabel}>Địa chỉ nhận hàng (Người mua) <Text style={{ color: COLORS.error }}>*</Text></Text><AgreementAddressField value={deliveryAddress} onChange={(value) => setDeliveryAddress(value)} onClear={() => setDeliveryAddress("")} placeholder="Nhập địa chỉ nhận hàng..." disabled={isProcessing} /></View></>}
    <View style={styles.inputContainer}><Text style={styles.inputLabel}>Ghi chú thêm</Text><TextInput placeholder="Ghi chú cho shipper hoặc đối tác..." placeholderTextColor="#547B7D" value={notes} onChangeText={setNotes} style={[styles.input, styles.multilineInput]} multiline /></View><Text style={styles.subLabel}>Hình thức thanh toán</Text><View style={styles.radioGroupRow}><TouchableOpacity style={styles.radioBtnRow} onPress={() => deliveryMethod !== "GHN" && setPaymentType("DEPOSIT")} disabled={deliveryMethod === "GHN"}><Ionicons name={paymentType === "DEPOSIT" ? "radio-button-on" : "radio-button-off"} size={24} color={deliveryMethod === "GHN" ? COLORS.border : paymentType === "DEPOSIT" ? COLORS.primary : COLORS.textLight} /><Text style={[styles.radioText, deliveryMethod === "GHN" ? styles.disabledText : undefined]}>Đặt cọc</Text></TouchableOpacity><TouchableOpacity style={styles.radioBtnRow} onPress={() => setPaymentType("FULL")}><Ionicons name={paymentType === "FULL" ? "radio-button-on" : "radio-button-off"} size={24} color={paymentType === "FULL" ? COLORS.primary : COLORS.textLight} /><Text style={styles.radioText}>Toàn phần</Text></TouchableOpacity></View></View>}
    <InlineNotice notice={notice} /><TouchableOpacity style={[styles.submitBtn, isProcessing ? styles.buttonDisabled : undefined]} onPress={() => void handleSubmit()} disabled={isProcessing}>{isProcessing ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.submitBtnText}>{isEditing ? "Cập nhật hợp đồng" : "Tạo hợp đồng"}</Text>}</TouchableOpacity>
  </ScrollView></KeyboardAvoidingView>
    <Modal
      visible={showLowPriceConfirm}
      transparent
      animationType="fade"
      onRequestClose={() => setShowLowPriceConfirm(false)}
    >
      <ModalBackdrop
        style={styles.confirmBackdrop}
        onPress={() => setShowLowPriceConfirm(false)}
      >
        <ModalSurface style={styles.confirmCard}>
          <Text style={styles.confirmMessage}>
            Đơn giá hiện dưới 10.000đ. Nếu số tiền thanh toán thực tế thấp hơn mức tối thiểu PayOS hỗ trợ, giao dịch có thể không thực hiện được qua PayOS.
          </Text>
          <View style={styles.confirmActions}>
            <TouchableOpacity
              style={styles.confirmSecondaryButton}
              onPress={() => setShowLowPriceConfirm(false)}
            >
              <Text style={styles.confirmSecondaryText}>Quay lại</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.confirmPrimaryButton}
              onPress={() => {
                setShowLowPriceConfirm(false);
                void handleSubmit(true);
              }}
            >
              <Text style={styles.confirmPrimaryText}>Vẫn tiếp tục</Text>
            </TouchableOpacity>
          </View>
        </ModalSurface>
      </ModalBackdrop>
    </Modal>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  flex:{flex:1},safeArea:{flex:1,backgroundColor:COLORS.background},loadingContainer:{flex:1,justifyContent:"center",alignItems:"center"},scrollContent:{padding:16,paddingBottom:40},section:{marginBottom:24},sectionTitle:{fontSize:16,fontWeight:"bold",color:COLORS.text,marginBottom:12},summaryCard:{backgroundColor:COLORS.white,padding:16,borderRadius:12,borderWidth:1,borderColor:COLORS.border},summaryProductName:{fontSize:15,fontWeight:"600",color:COLORS.text,marginBottom:8},summaryPrice:{fontSize:15,fontWeight:"bold",color:COLORS.primary,marginBottom:4},summaryQty:{fontSize:14,color:COLORS.textLight},radioGroup:{backgroundColor:COLORS.white,borderRadius:12,borderWidth:1,borderColor:COLORS.border,overflow:"hidden"},deliveryGroup:{marginBottom:16},radioBtn:{flexDirection:"row",alignItems:"center",padding:16,borderBottomWidth:1,borderBottomColor:COLORS.border},radioBtnLast:{flexDirection:"row",alignItems:"center",padding:16},radioGroupRow:{flexDirection:"row",gap:12,marginBottom:16},radioBtnRow:{flex:1,flexDirection:"row",alignItems:"center",backgroundColor:COLORS.white,padding:14,borderRadius:12,borderWidth:1,borderColor:COLORS.border},radioBtnRowConfig:{flex:1,flexDirection:"row",alignItems:"center",backgroundColor:COLORS.white,padding:14,borderRadius:12,borderWidth:1,borderColor:"rgba(154, 100, 24, 0.24)"},radioText:{marginLeft:10,fontSize:14,color:COLORS.text,flexShrink:1},disabledText:{color:COLORS.textLight},lockedHint:{fontSize:12,color:COLORS.textLight,marginTop:8},inputContainer:{marginBottom:16},addressFieldBlock:{marginBottom:4},inputLabel:{fontSize:14,fontWeight:"600",color:COLORS.text,marginBottom:8},input:{backgroundColor:COLORS.white,borderRadius:12,borderWidth:1,borderColor:COLORS.border,padding:14,fontSize:15,color:COLORS.text,...(Platform.OS==="web"?({outlineStyle:"none"} as any):{})},multilineInput:{minHeight:92,textAlignVertical:"top"},inputDisabled:{opacity:.55},selectInput:{minHeight:52,backgroundColor:COLORS.white,borderRadius:12,borderWidth:1,borderColor:COLORS.border,paddingHorizontal:14,flexDirection:"row",alignItems:"center",justifyContent:"space-between"},selectValue:{flex:1,fontSize:15,color:COLORS.text,marginRight:8},selectPlaceholder:{flex:1,fontSize:15,color:"#547B7D",marginRight:8},modalBackdrop:{flex:1,justifyContent:"center",backgroundColor:"rgba(23, 40, 48, 0.45)",padding:20},optionModal:{maxHeight:"72%",backgroundColor:COLORS.white,borderRadius:16,padding:16},optionHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:14},optionTitle:{fontSize:17,fontWeight:"700",color:COLORS.text},searchBox:{flexDirection:"row",alignItems:"center",borderWidth:1,borderColor:COLORS.border,borderRadius:10,paddingHorizontal:12,marginBottom:10},searchInput:{flex:1,paddingVertical:12,paddingHorizontal:8,color:COLORS.text,...(Platform.OS==="web"?({outlineStyle:"none"} as any):{})},optionRow:{minHeight:48,flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderBottomColor:COLORS.border,paddingVertical:11},optionText:{flex:1,fontSize:15,color:COLORS.text,marginRight:8},emptyOption:{paddingVertical:24,textAlign:"center",color:COLORS.textLight},infoBox:{flexDirection:"row",backgroundColor:"rgba(84, 123, 125, 0.10)",padding:12,borderRadius:8,alignItems:"center",marginTop:8},infoText:{color:"#2B5659",fontSize:13,marginLeft:8,flex:1},subLabel:{fontSize:14,fontWeight:"600",color:COLORS.text,marginTop:8,marginBottom:12},configCard:{backgroundColor:"rgba(154, 100, 24, 0.10)",borderWidth:1,borderColor:"rgba(154, 100, 24, 0.24)",borderRadius:16,padding:16,marginBottom:18},ghnHeader:{flexDirection:"row",alignItems:"center",marginBottom:16},ghnTitle:{fontSize:17,fontWeight:"700",color:COLORS.text,marginLeft:8},ghnLoadingBox:{padding:24,alignItems:"center",justifyContent:"center"},ghnLoadingText:{marginTop:12,color:COLORS.textLight,fontSize:14},ghnSubCard:{backgroundColor:COLORS.white,borderRadius:12,borderWidth:1,borderColor:"rgba(154, 100, 24, 0.24)",padding:14,marginBottom:16},accordionHeader:{flexDirection:"row",justifyContent:"space-between",alignItems:"center"},ghnSubTitleAcc:{fontSize:15,fontWeight:"700",color:COLORS.text},accordionSummary:{fontSize:14,color:COLORS.textLight,marginTop:6,lineHeight:20},accordionContent:{marginTop:16,paddingTop:16,borderTopWidth:1,borderTopColor:"rgba(154, 100, 24, 0.24)"},ghnSubTitle:{fontSize:15,fontWeight:"700",color:COLORS.text,marginBottom:14},numericGrid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between"},numericItem:{width:"48.5%",marginBottom:4,justifyContent:"flex-end"},numericHint:{fontSize:12,color:COLORS.textLight,marginTop:-4,marginBottom:8},numericError:{fontSize:12,color:"#7A1012",marginTop:6},inputError:{borderColor:"#7A1012"},productQtyRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between",marginTop:8,marginBottom:14},subLabelInline:{fontSize:13,color:COLORS.textLight},productQtyValue:{fontSize:15,fontWeight:"700",color:COLORS.text},topSpacing:{marginTop:4},calculateBtn:{minHeight:50,borderRadius:12,backgroundColor:COLORS.primary,flexDirection:"row",justifyContent:"center",alignItems:"center",gap:8,marginTop:4},calculateBtnText:{color:COLORS.white,fontSize:15,fontWeight:"700"},quoteCard:{backgroundColor:"rgba(47, 118, 93, 0.10)",borderWidth:1,borderColor:"rgba(47, 118, 93, 0.24)",borderRadius:12,padding:14,marginTop:14},quoteLabel:{color:"#2F765D",fontSize:13,fontWeight:"600"},quoteValue:{color:"#2F765D",fontSize:22,fontWeight:"800",marginVertical:4},quoteHint:{color:"#2F765D",fontSize:12,lineHeight:17},notice:{flexDirection:"row",alignItems:"flex-start",borderRadius:10,borderWidth:1,padding:12,marginBottom:12},noticeError:{backgroundColor:"rgba(122, 16, 18, 0.08)",borderColor:"rgba(122, 16, 18, 0.22)"},noticeSuccess:{backgroundColor:"rgba(47, 118, 93, 0.10)",borderColor:"rgba(47, 118, 93, 0.24)"},noticeInfo:{backgroundColor:"rgba(84, 123, 125, 0.10)",borderColor:"rgba(84, 123, 125, 0.24)"},noticeText:{flex:1,marginLeft:8,color:COLORS.text,lineHeight:19},noticeTextError:{color:"#7A1012"},submitBtn:{backgroundColor:COLORS.primary,padding:16,borderRadius:12,alignItems:"center",marginTop:8},submitBtnText:{color:COLORS.white,fontSize:16,fontWeight:"bold"},buttonDisabled:{opacity:.65},confirmBackdrop:{flex:1,justifyContent:"center",backgroundColor:"rgba(23, 40, 48, 0.45)",padding:20},confirmCard:{backgroundColor:COLORS.white,borderRadius:16,padding:20},confirmMessage:{color:COLORS.text,fontSize:15,lineHeight:22},confirmActions:{flexDirection:"row",gap:10,marginTop:20},confirmSecondaryButton:{flex:1,minHeight:46,alignItems:"center",justifyContent:"center",borderWidth:1,borderColor:COLORS.primary,borderRadius:10,paddingHorizontal:10},confirmSecondaryText:{color:COLORS.primary,fontSize:14,fontWeight:"700",textAlign:"center"},confirmPrimaryButton:{flex:1,minHeight:46,alignItems:"center",justifyContent:"center",backgroundColor:COLORS.primary,borderRadius:10,paddingHorizontal:10},confirmPrimaryText:{color:COLORS.white,fontSize:14,fontWeight:"700",textAlign:"center"}
});
