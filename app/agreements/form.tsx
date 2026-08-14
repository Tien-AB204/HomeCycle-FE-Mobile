import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import Header from "../../src/components/shared/Header";
// [THÊM MỚI] Import AddressPickerField (Sửa lại đường dẫn nếu file của ông nằm chỗ khác nhé)
import AddressPickerField from "../../src/components/shared/AddressPickerField";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";

type DeliveryMethod = "SELLER_DELIVERY" | "BUYER_PICKUP" | "GHN";
type RequiredNote = "CHOTHUHANG" | "CHOXEMHANGKHONGTHU" | "KHONGCHOXEMHANG";
type NoticeType = "error" | "success" | "info";

interface GhnProvince {
  provinceId: number;
  provinceName: string;
  code?: string;
  status?: number;
}

interface GhnDistrict {
  districtId: number;
  provinceId: number;
  districtName: string;
  code?: string;
  type?: number;
  supportType?: number;
  status?: number;
}

interface GhnWard {
  wardCode: string;
  districtId: number;
  wardName: string;
  supportType?: number;
  status?: number;
}

interface GhnAddressPayload {
  provinceId: number;
  provinceName: string;
  districtId: number;
  districtName: string;
  wardCode: string;
  wardName: string;
  addressDetail: string;
}

interface GhnContactPayload {
  fullName: string;
  phone: string;
  address: GhnAddressPayload;
}

interface ParcelPayload {
  weightGram: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
}

interface GhnItemPayload extends ParcelPayload {
  name: string;
  code: string;
  quantity: number;
}

interface GhnFeeBreakdown {
  serviceFee: number;
  insuranceFee: number;
  pickStationFee: number;
  couponValue: number;
  r2sFee: number;
  documentReturnFee: number;
  doubleCheckFee: number;
  codFee: number;
  pickRemoteAreasFee: number;
  deliverRemoteAreasFee: number;
  codFailedFee: number;
}

interface GhnQuotePayload {
  totalFee: number;
  breakdown: GhnFeeBreakdown;
  quotedAt: string;
  inputHash: string;
  expectedDeliveryAt: string;
}

type GhnQuoteStatus = "NotCalculated" | "Valid" | "Stale" | "Failed";

interface CalculateGhnFeeRequest {
  fromDistrictId: number;
  fromWardCode: string;
  toDistrictId: number;
  toWardCode: string;
  serviceTypeId: 2 | 5;
  weightGram: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  items?: GhnItemPayload[];
}

interface GhnInfoPayload {
  sender: GhnContactPayload;
  receiver: GhnContactPayload;
  serviceTypeId: 2 | 5;
  paymentTypeId?: 1 | 2;
  requiredNote: RequiredNote;
  lightParcel?: ParcelPayload;
  items?: GhnItemPayload[];
  quoteStatus?: GhnQuoteStatus;
  quote?: GhnQuotePayload;
}

interface AgreementDetailsPayload {
  revision: number;
  notes?: string | null;
  inspectionDate?: string | null;
  inspectionAddress?: string | null;
  collectionDate?: string | null;
  pickupAddress?: string | null;
  deliveryAddress?: string | null;
  deliveryMethod?: "Unknown" | "GhnDelivery" | "SellerDelivers" | "BuyerPickUp";
  ghnInfo?: GhnInfoPayload | null;
  codValue?: number | null;
  estimatedShippingFee?: number | null;
}

interface CreateAgreementPayload {
  negotiationId: string;
  agreementType: "Inspection" | "No_Inspection";
  paymentType: "Deposit" | "Full_Payment";
  agreementDetails: AgreementDetailsPayload;
}

type UpdateAgreementPayload = Omit<CreateAgreementPayload, "negotiationId">;

interface GhnPartyFormValue {
  fullName: string;
  phone: string;
  province: GhnProvince | null;
  district: GhnDistrict | null;
  ward: GhnWard | null;
  addressDetail: string;
}

interface NoticeState {
  type: NoticeType;
  message: string;
}

const EMPTY_BREAKDOWN: GhnFeeBreakdown = {
  serviceFee: 0,
  insuranceFee: 0,
  pickStationFee: 0,
  couponValue: 0,
  r2sFee: 0,
  documentReturnFee: 0,
  doubleCheckFee: 0,
  codFee: 0,
  pickRemoteAreasFee: 0,
  deliverRemoteAreasFee: 0,
  codFailedFee: 0,
};

const EMPTY_PARTY: GhnPartyFormValue = {
  fullName: "",
  phone: "",
  province: null,
  district: null,
  ward: null,
  addressDetail: "",
};

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

const agreementApi = {
  getPreview: async (negotiationId: string) => {
    const response = await apiClient.get(
      `/agreements/preview/${negotiationId}`,
    );
    return response.data;
  },
  createAgreement: async (data: CreateAgreementPayload) => {
    const response = await apiClient.post("/agreements", data);
    return response.data;
  },
  getAgreementById: async (agreementId: string) => {
    const response = await apiClient.get(`/agreements/${agreementId}`);
    return response.data;
  },
  updateAgreement: async (
    agreementId: string,
    data: UpdateAgreementPayload,
  ) => {
    const response = await apiClient.put(`/agreements/${agreementId}`, data);
    return response.data;
  },
  previewShippingFee: async (negotiationId: string, data: any) => {
    const response = await apiClient.post(
      `/agreements/negotiations/${negotiationId}/ghn-preview`,
      data,
    );
    return response.data;
  },
  getGhnParcelInfo: async (negotiationId: string) => {
    const response = await apiClient.get(
      `/agreements/negotiations/${negotiationId}/ghn-parcel-info`,
    );
    return response.data;
  },
};

const messageApi = {
  sendMessage: async (negotiationId: string, payload: any) => {
    const response = await apiClient.post("/Messages", payload, {
      params: { negotiationId },
    });
    return response.data;
  },
};

const negotiationApi = {
  getNegotiationById: async (negotiationId: string) => {
    const response = await apiClient.get(`/negotiations/${negotiationId}`);
    return response.data;
  },
};

const offerApi = {
  getOfferById: async (offerId: string) => {
    const response = await apiClient.get(`/offers/${offerId}`);
    return response.data;
  },
};

const postApi = {
  getPostById: async (postId: string) => {
    const response = await apiClient.get(`/posts/get-by-id/${postId}`);
    return response.data;
  },
};

const ghnApi = {
  getProvinces: async (): Promise<GhnProvince[]> => {
    const response = await apiClient.get("/GHN/provinces");
    return response.data?.data ?? response.data ?? [];
  },
  getDistricts: async (provinceId: number): Promise<GhnDistrict[]> => {
    const response = await apiClient.get(
      `/GHN/provinces/${provinceId}/districts`,
    );
    return response.data?.data ?? response.data ?? [];
  },
  getWards: async (districtId: number): Promise<GhnWard[]> => {
    const response = await apiClient.get(`/GHN/districts/${districtId}/wards`);
    return response.data?.data ?? response.data ?? [];
  },
};

function getErrorMessage(error: any, fallback: string) {
  const status = Number(error?.response?.status || 0);
  if (status >= 500) return "Lỗi máy chủ. Vui lòng thử lại sau.";

  return (
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    fallback
  );
}

function toPositiveInt(value: string) {
  const number = Number(value.trim());
  return Number.isInteger(number) && number > 0 ? number : 0;
}

function toNonNegativeInt(value: string) {
  const number = Number(value.trim());
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function composeAddress(value: GhnPartyFormValue) {
  return [
    value.addressDetail.trim(),
    value.ward?.wardName,
    value.district?.districtName,
    value.province?.provinceName,
  ]
    .filter(Boolean)
    .join(", ");
}

function toPartyPayload(value: GhnPartyFormValue): GhnContactPayload {
  return {
    fullName: value.fullName.trim(),
    phone: value.phone.trim(),
    address: {
      provinceId: value.province!.provinceId,
      provinceName: value.province!.provinceName,
      districtId: value.district!.districtId,
      districtName: value.district!.districtName,
      wardCode: value.ward!.wardCode,
      wardName: value.ward!.wardName,
      addressDetail: value.addressDetail.trim(),
    },
  };
}

function formatDateVN(dateStr: string) {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`; // DD/MM/YYYY
  }
  return dateStr;
}

function InlineNotice({ notice }: { notice: NoticeState | null }) {
  if (!notice) return null;

  const icon =
    notice.type === "error"
      ? "alert-circle-outline"
      : notice.type === "success"
        ? "checkmark-circle-outline"
        : "information-circle-outline";

  return (
    <View
      style={[
        styles.notice,
        notice.type === "error"
          ? styles.noticeError
          : notice.type === "success"
            ? styles.noticeSuccess
            : styles.noticeInfo,
      ]}
    >
      <Ionicons
        name={icon}
        size={20}
        color={notice.type === "error" ? "#B91C1C" : COLORS.primary}
      />
      <Text
        style={[
          styles.noticeText,
          notice.type === "error" ? styles.noticeTextError : undefined,
        ]}
      >
        {notice.message}
      </Text>
    </View>
  );
}

// ================= COMPONENT LỊCH CHỌN NGÀY =================
function CustomDatePicker({
  label,
  value,
  onDateChange,
  placeholder,
}: {
  label: string;
  value: string; // Format: YYYY-MM-DD
  onDateChange: (date: string) => void;
  placeholder?: string;
}) {
  const [modalVisible, setModalVisible] = useState(false);
  const [currentViewDate, setCurrentViewDate] = useState(() => {
    return value ? new Date(value) : new Date();
  });

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay(); // 0 (Sun) - 6 (Sat)
  };

  const renderCalendarDays = () => {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const firstDay = getFirstDayOfMonth(year, month);

    const daysArray = [];
    for (let i = 0; i < firstDay; i++) {
      daysArray.push(<View key={`empty-${i}`} style={styles.calDayBox} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected =
        value ===
        `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const isToday =
        new Date().toISOString().split("T")[0] ===
        `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      daysArray.push(
        <TouchableOpacity
          key={`day-${day}`}
          style={[
            styles.calDayBox,
            isSelected && styles.calDaySelected,
            !isSelected && isToday && styles.calDayToday,
          ]}
          onPress={() => {
            const formattedDate = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            onDateChange(formattedDate);
            setModalVisible(false);
          }}
        >
          <Text
            style={[
              styles.calDayText,
              isSelected && styles.calDayTextSelected,
              !isSelected && isToday && styles.calDayTextToday,
            ]}
          >
            {day}
          </Text>
        </TouchableOpacity>,
      );
    }
    return daysArray;
  };

  const nextMonth = () => {
    setCurrentViewDate(
      new Date(
        currentViewDate.getFullYear(),
        currentViewDate.getMonth() + 1,
        1,
      ),
    );
  };

  const prevMonth = () => {
    setCurrentViewDate(
      new Date(
        currentViewDate.getFullYear(),
        currentViewDate.getMonth() - 1,
        1,
      ),
    );
  };

  const weekdays = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

  return (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity
        style={styles.datePickerTrigger}
        onPress={() => setModalVisible(true)}
      >
        <Text
          style={value ? styles.datePickerText : styles.datePickerPlaceholder}
        >
          {value ? formatDateVN(value) : placeholder || "Chọn ngày"}
        </Text>
        <Ionicons name="calendar-outline" size={20} color={COLORS.textLight} />
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.calendarModal}>
            <View style={styles.calHeader}>
              <TouchableOpacity onPress={prevMonth} style={styles.calHeaderBtn}>
                <Ionicons name="chevron-back" size={24} color={COLORS.text} />
              </TouchableOpacity>
              <Text style={styles.calMonthYear}>
                Tháng {currentViewDate.getMonth() + 1},{" "}
                {currentViewDate.getFullYear()}
              </Text>
              <TouchableOpacity onPress={nextMonth} style={styles.calHeaderBtn}>
                <Ionicons
                  name="chevron-forward"
                  size={24}
                  color={COLORS.text}
                />
              </TouchableOpacity>
            </View>

            <View style={styles.calWeekdays}>
              {weekdays.map((day) => (
                <Text key={day} style={styles.calWeekdayText}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.calGrid}>{renderCalendarDays()}</View>

            <TouchableOpacity
              style={styles.calCloseBtn}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.calCloseBtnText}>Đóng</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ================= COMPONENT DROPDOWN =================
function SelectField<T>({
  label,
  placeholder,
  valueLabel,
  options,
  getKey,
  getLabel,
  onSelect,
  disabled = false,
  loading = false,
  hideSearch = false,
}: {
  label: string;
  placeholder: string;
  valueLabel?: string;
  options: T[];
  getKey: (item: T) => string;
  getLabel: (item: T) => string;
  onSelect: (item: T) => void;
  disabled?: boolean;
  loading?: boolean;
  hideSearch?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const [keyword, setKeyword] = useState("");

  const filteredOptions = useMemo(() => {
    const normalizedKeyword = keyword.trim().toLocaleLowerCase("vi");
    if (!normalizedKeyword) return options;
    return options.filter((item) =>
      getLabel(item).toLocaleLowerCase("vi").includes(normalizedKeyword),
    );
  }, [getLabel, keyword, options]);

  return (
    <View style={styles.inputContainer}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TouchableOpacity
        style={[
          styles.selectInput,
          disabled ? styles.inputDisabled : undefined,
        ]}
        onPress={() => {
          if (!disabled) setVisible(true);
        }}
        disabled={disabled}
      >
        <Text
          style={valueLabel ? styles.selectValue : styles.selectPlaceholder}
          numberOfLines={1}
        >
          {valueLabel || placeholder}
        </Text>
        {loading ? (
          <ActivityIndicator size="small" color={COLORS.primary} />
        ) : (
          <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
        )}
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.optionModal}>
            <View style={styles.optionHeader}>
              <Text style={styles.optionTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            {!hideSearch && (
              <View style={styles.searchBox}>
                <Ionicons name="search" size={19} color={COLORS.textLight} />
                <TextInput
                  value={keyword}
                  onChangeText={setKeyword}
                  placeholder="Tìm kiếm..."
                  placeholderTextColor="#94A3B8"
                  style={styles.searchInput}
                />
              </View>
            )}

            <FlatList
              data={filteredOptions}
              keyExtractor={getKey}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={
                <Text style={styles.emptyOption}>
                  Không có dữ liệu phù hợp.
                </Text>
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.optionRow}
                  onPress={() => {
                    onSelect(item);
                    setKeyword("");
                    setVisible(false);
                  }}
                >
                  <Text style={styles.optionText}>{getLabel(item)}</Text>
                  {valueLabel === getLabel(item) ? (
                    <Ionicons
                      name="checkmark-circle"
                      size={20}
                      color={COLORS.primary}
                    />
                  ) : null}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

function NumericInput({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <View style={styles.numericItem}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChangeText(text.replace(/[^0-9]/g, ""))}
        placeholder={placeholder || "0"}
        placeholderTextColor="#94A3B8"
        keyboardType="number-pad"
        inputMode="numeric"
        style={styles.input}
      />
    </View>
  );
}

// ================= COMPONENT ACCORDION NGƯỜI GỬI / NHẬN =================
function GhnPartyFields({
  title,
  value,
  isExpanded,
  onToggle,
  provinces,
  districts,
  wards,
  loadingDistricts,
  loadingWards,
  onChange,
  onSelectProvince,
  onSelectDistrict,
  onSelectWard,
}: {
  title: string;
  value: GhnPartyFormValue;
  isExpanded: boolean;
  onToggle: () => void;
  provinces: GhnProvince[];
  districts: GhnDistrict[];
  wards: GhnWard[];
  loadingDistricts: boolean;
  loadingWards: boolean;
  onChange: (patch: Partial<GhnPartyFormValue>) => void;
  onSelectProvince: (province: GhnProvince) => void;
  onSelectDistrict: (district: GhnDistrict) => void;
  onSelectWard: (ward: GhnWard) => void;
}) {
  const hasData = Boolean(
    value.fullName && value.addressDetail && value.province,
  );
  const summaryText = hasData
    ? `${value.fullName} - ${composeAddress(value)}`
    : "Chưa có thông tin";

  return (
    <View style={styles.ghnSubCard}>
      <TouchableOpacity style={styles.accordionHeader} onPress={onToggle}>
        <Text style={styles.ghnSubTitleAcc}>{title}</Text>
        <Ionicons
          name={isExpanded ? "chevron-up" : "chevron-down"}
          size={22}
          color={COLORS.textLight}
        />
      </TouchableOpacity>

      {!isExpanded ? (
        <Text style={styles.accordionSummary} numberOfLines={2}>
          {summaryText}
        </Text>
      ) : (
        <View style={styles.accordionContent}>
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Họ và tên *</Text>
            <TextInput
              value={value.fullName}
              onChangeText={(fullName) => onChange({ fullName })}
              placeholder="Nhập họ và tên"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
          </View>

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Số điện thoại *</Text>
            <TextInput
              value={value.phone}
              onChangeText={(phone) =>
                onChange({ phone: phone.replace(/[^0-9+]/g, "") })
              }
              placeholder="Nhập số điện thoại"
              placeholderTextColor="#94A3B8"
              keyboardType="phone-pad"
              style={styles.input}
            />
          </View>

          <SelectField
            label="Tỉnh/Thành phố *"
            placeholder="Chọn tỉnh/thành phố"
            valueLabel={value.province?.provinceName}
            options={provinces}
            getKey={(item) => String(item.provinceId)}
            getLabel={(item) => item.provinceName}
            onSelect={onSelectProvince}
          />

          <SelectField
            label="Quận/Huyện *"
            placeholder={
              value.province ? "Chọn quận/huyện" : "Chọn tỉnh/thành phố trước"
            }
            valueLabel={value.district?.districtName}
            options={districts}
            getKey={(item) => String(item.districtId)}
            getLabel={(item) => item.districtName}
            onSelect={onSelectDistrict}
            disabled={!value.province}
            loading={loadingDistricts}
          />

          <SelectField
            label="Phường/Xã *"
            placeholder={
              value.district ? "Chọn phường/xã" : "Chọn quận/huyện trước"
            }
            valueLabel={value.ward?.wardName}
            options={wards}
            getKey={(item) => item.wardCode}
            getLabel={(item) => item.wardName}
            onSelect={onSelectWard}
            disabled={!value.district}
            loading={loadingWards}
          />

          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Số nhà, tên đường *</Text>
            <TextInput
              value={value.addressDetail}
              onChangeText={(addressDetail) => onChange({ addressDetail })}
              placeholder="Ví dụ: 123 Nguyễn Văn Linh"
              placeholderTextColor="#94A3B8"
              style={styles.input}
            />
          </View>
        </View>
      )}
    </View>
  );
}

// ================= MAIN SCREEN =================
export default function AgreementFormScreen() {
  const router = useRouter();
  const { user } = useAuth(); // Lấy thông tin user hiện tại

  const params = useLocalSearchParams();
  const negotiationId = Array.isArray(params.negotiationId)
    ? params.negotiationId[0]
    : params.negotiationId;
  const editAgreementId = Array.isArray(params.editAgreementId)
    ? params.editAgreementId[0]
    : params.editAgreementId;
  const isEditing = Boolean(editAgreementId);

  const [isProcessing, setIsProcessing] = useState(false);
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [isCalculatingFee, setIsCalculatingFee] = useState(false);

  const [isLoadingGhnInfo, setIsLoadingGhnInfo] = useState(false);
  const hasFetchedGhnRef = useRef(false);

  const [notice, setNotice] = useState<NoticeState | null>(null);
  const [isInspection, setIsInspection] = useState(true);
  const [paymentType, setPaymentType] = useState<"DEPOSIT" | "FULL">("DEPOSIT");
  const [revision, setRevision] = useState(0);

  // [THÊM MỚI] State lưu trữ phương thức vận chuyển mặc định từ Post
  const [defaultPostDeliveryMethod, setDefaultPostDeliveryMethod] =
    useState<DeliveryMethod>("SELLER_DELIVERY");

  const [summary, setSummary] = useState({
    productName: "Đang tải thông tin...",
    productCode: "",
    price: 0,
    quantity: 1,
  });
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);

  const [notes, setNotes] = useState("");
  const [inspectionDate, setInspectionDate] = useState("");
  const [inspectionAddress, setInspectionAddress] = useState("");
  const [deliveryMethod, setDeliveryMethod] =
    useState<DeliveryMethod>("SELLER_DELIVERY");
  const [collectionDate, setCollectionDate] = useState("");
  const [pickupAddress, setPickupAddress] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");

  const [provinces, setProvinces] = useState<GhnProvince[]>([]);
  const [senderDistricts, setSenderDistricts] = useState<GhnDistrict[]>([]);
  const [receiverDistricts, setReceiverDistricts] = useState<GhnDistrict[]>([]);
  const [senderWards, setSenderWards] = useState<GhnWard[]>([]);
  const [receiverWards, setReceiverWards] = useState<GhnWard[]>([]);
  const [loadingSenderDistricts, setLoadingSenderDistricts] = useState(false);
  const [loadingReceiverDistricts, setLoadingReceiverDistricts] =
    useState(false);
  const [loadingSenderWards, setLoadingSenderWards] = useState(false);
  const [loadingReceiverWards, setLoadingReceiverWards] = useState(false);

  const [sender, setSender] = useState<GhnPartyFormValue>(EMPTY_PARTY);
  const [receiver, setReceiver] = useState<GhnPartyFormValue>(EMPTY_PARTY);
  const [senderExpanded, setSenderExpanded] = useState(false);
  const [receiverExpanded, setReceiverExpanded] = useState(false);

  const [serviceTypeId, setServiceTypeId] = useState<2 | 5>(2);
  const [requiredNote, setRequiredNote] = useState<RequiredNote | "">("");

  const [weightGram, setWeightGram] = useState("");
  const [lengthCm, setLengthCm] = useState("");
  const [widthCm, setWidthCm] = useState("");
  const [heightCm, setHeightCm] = useState("");
  const [itemQuantity, setItemQuantity] = useState("1");
  const [codValue, setCodValue] = useState("0");

  const [ghnQuote, setGhnQuote] = useState<GhnQuotePayload | null>(null);
  const [ghnQuoteStatus, setGhnQuoteStatus] =
    useState<GhnQuoteStatus>("NotCalculated");

  const invalidateQuote = useCallback(() => {
    setGhnQuote(null);
    setGhnQuoteStatus("Stale");
  }, []);

  const updateSender = (patch: Partial<GhnPartyFormValue>) => {
    setSender((current) => ({ ...current, ...patch }));
    invalidateQuote();
  };

  const updateReceiver = (patch: Partial<GhnPartyFormValue>) => {
    setReceiver((current) => ({ ...current, ...patch }));
    invalidateQuote();
  };

  const fetchProvinces = useCallback(async () => {
    try {
      const data = await ghnApi.getProvinces();
      setProvinces(
        [...data].sort((a, b) =>
          a.provinceName.localeCompare(b.provinceName, "vi"),
        ),
      );
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          error,
          "Không thể tải danh sách tỉnh/thành phố GHN.",
        ),
      });
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    if (!negotiationId) return;
    try {
      setIsLoadingSummary(true);
      const negRes = await negotiationApi.getNegotiationById(
        negotiationId as string,
      );
      const neg = negRes?.data || negRes;

      if (neg?.offerId) {
        const offerRes = await offerApi.getOfferById(neg.offerId);
        const offer = offerRes?.data || offerRes;
        let productName = "Sản phẩm thương lượng";
        let productCode = offer?.postId || "";

        if (offer?.postId) {
          const postRes = await postApi.getPostById(offer.postId);
          const postData = postRes?.data || postRes;
          productName =
            postData?.product?.productName ||
            postData?.productName ||
            productName;
          productCode =
            postData?.product?.productId || postData?.productId || offer.postId;

          // =========================================================================
          // [THÊM MỚI] LẤY PHƯƠNG THỨC VẬN CHUYỂN TỪ BÀI POST
          // =========================================================================
          let postDelMethod: DeliveryMethod = "SELLER_DELIVERY"; // Mặc định
          const rawDelMethod =
            postData?.product?.deliveryMethod ?? postData?.deliveryMethod;

          if (rawDelMethod === 1 || rawDelMethod === "GhnDelivery") {
            postDelMethod = "GHN";
          } else if (rawDelMethod === 3 || rawDelMethod === "BuyerPickUp") {
            postDelMethod = "BUYER_PICKUP";
          }

          setDefaultPostDeliveryMethod(postDelMethod);
          // =========================================================================
        }

        const nextQuantity = Number(offer.offerQuantity || 1);
        setSummary({
          productName,
          productCode,
          price: Number(offer.offerPrice || 0),
          quantity: nextQuantity,
        });
        setItemQuantity((current) =>
          current === "1" ? String(nextQuantity) : current,
        );
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error, "Không thể tải thông giải dịch."),
      });
    } finally {
      setIsLoadingSummary(false);
    }
  }, [negotiationId]);

  const hydrateGhnParty = (party: any): GhnPartyFormValue => ({
    fullName: party?.fullName || "",
    phone: party?.phone || "",
    province: party?.address?.provinceId
      ? {
          provinceId: Number(party.address.provinceId),
          provinceName: party.address.provinceName || "",
        }
      : null,
    district: party?.address?.districtId
      ? {
          districtId: Number(party.address.districtId),
          provinceId: Number(party.address.provinceId || 0),
          districtName: party.address.districtName || "",
        }
      : null,
    ward: party?.address?.wardCode
      ? {
          wardCode: String(party.address.wardCode),
          districtId: Number(party.address.districtId || 0),
          wardName: party.address.wardName || "",
        }
      : null,
    addressDetail: party?.address?.addressDetail || "",
  });

  const loadEditLocationOptions = useCallback(
    async (
      senderValue: GhnPartyFormValue,
      receiverValue: GhnPartyFormValue,
    ) => {
      try {
        const [fromDistrictList, toDistrictList] = await Promise.all([
          senderValue.province
            ? ghnApi.getDistricts(senderValue.province.provinceId)
            : Promise.resolve([]),
          receiverValue.province
            ? ghnApi.getDistricts(receiverValue.province.provinceId)
            : Promise.resolve([]),
        ]);
        setSenderDistricts(fromDistrictList);
        setReceiverDistricts(toDistrictList);

        const [fromWardList, toWardList] = await Promise.all([
          senderValue.district
            ? ghnApi.getWards(senderValue.district.districtId)
            : Promise.resolve([]),
          receiverValue.district
            ? ghnApi.getWards(receiverValue.district.districtId)
            : Promise.resolve([]),
        ]);
        setSenderWards(fromWardList);
        setReceiverWards(toWardList);
      } catch (error) {
        setNotice({
          type: "error",
          message: getErrorMessage(
            error,
            "Không thể tải lại dữ liệu địa chỉ GHN.",
          ),
        });
      }
    },
    [],
  );

  const fetchExistingAgreement = useCallback(async () => {
    if (!isEditing || !editAgreementId) return;

    try {
      setIsLoadingData(true);
      const res = await agreementApi.getAgreementById(
        editAgreementId as string,
      );
      const data = res?.data || res;
      if (!data) return;

      const inspection =
        data.agreementType === "Inspection" || data.agreementType === 0;
      setIsInspection(inspection);
      setPaymentType(
        data.paymentType === "Deposit" || data.paymentType === 1
          ? "DEPOSIT"
          : "FULL",
      );

      const details = data.agreementDetails || {};
      const currentRevision = Number(details.revision ?? data.revision ?? 0);
      setRevision(Number.isFinite(currentRevision) ? currentRevision : 0);
      setNotes(details.notes || "");
      setInspectionDate(
        details.inspectionDate ? details.inspectionDate.split("T")[0] : "",
      );
      setInspectionAddress(details.inspectionAddress || "");
      setCollectionDate(
        details.collectionDate ? details.collectionDate.split("T")[0] : "",
      );
      setPickupAddress(details.pickupAddress || "");
      setDeliveryAddress(details.deliveryAddress || "");
      setCodValue(String(details.codValue ?? 0));

      if (
        details.deliveryMethod === "SellerDelivers" ||
        details.deliveryMethod === 2
      ) {
        setDeliveryMethod("SELLER_DELIVERY");
      } else if (
        details.deliveryMethod === "BuyerPickUp" ||
        details.deliveryMethod === 3
      ) {
        setDeliveryMethod("BUYER_PICKUP");
      } else if (
        details.deliveryMethod === "GhnDelivery" ||
        details.deliveryMethod === 1
      ) {
        setDeliveryMethod("GHN");
      }

      const ghnInfo = details.ghnInfo;
      if (ghnInfo) {
        // [SỬA LỖI] Đánh dấu đã fetch dữ liệu từ BE (để không bị auto-fill đè lên khi chuyển tab GHN)
        hasFetchedGhnRef.current = true;

        const senderValue = hydrateGhnParty(ghnInfo.sender);
        const receiverValue = hydrateGhnParty(ghnInfo.receiver);
        setSender(senderValue);
        setReceiver(receiverValue);
        setServiceTypeId(Number(ghnInfo.serviceTypeId) === 5 ? 5 : 2);
        setRequiredNote(ghnInfo.requiredNote || "");

        const parcel =
          Number(ghnInfo.serviceTypeId) === 5
            ? ghnInfo.items?.[0]
            : ghnInfo.lightParcel;
        setWeightGram(String(parcel?.weightGram || ""));
        setLengthCm(String(parcel?.lengthCm || ""));
        setWidthCm(String(parcel?.widthCm || ""));
        setHeightCm(String(parcel?.heightCm || ""));

        const item = ghnInfo.items?.[0];
        if (item) {
          setItemQuantity(String(item.quantity || 1));
        }

        const loadedQuoteStatus = String(ghnInfo.quoteStatus || "");
        if (ghnInfo.quote?.totalFee && loadedQuoteStatus === "Valid") {
          setGhnQuote({
            ...ghnInfo.quote,
            totalFee: Number(ghnInfo.quote.totalFee),
            breakdown: {
              ...EMPTY_BREAKDOWN,
              ...(ghnInfo.quote.breakdown || {}),
            },
            quotedAt: ghnInfo.quote.quotedAt || new Date().toISOString(),
            inputHash: ghnInfo.quote.inputHash || "",
            expectedDeliveryAt:
              ghnInfo.quote.expectedDeliveryAt || new Date().toISOString(),
          });
          setGhnQuoteStatus("Valid");
        } else {
          setGhnQuote(null);
          setGhnQuoteStatus(
            loadedQuoteStatus === "Failed" ? "Failed" : "NotCalculated",
          );
        }

        await loadEditLocationOptions(senderValue, receiverValue);
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(
          error,
          "Không thể tải dữ liệu hợp đồng hiện tại.",
        ),
      });
    } finally {
      setIsLoadingData(false);
    }
  }, [editAgreementId, isEditing, loadEditLocationOptions]);

  useFocusEffect(
    useCallback(() => {
      fetchProvinces();
      fetchSummary();
      if (isEditing) fetchExistingAgreement();
    }, [fetchExistingAgreement, fetchProvinces, fetchSummary, isEditing]),
  );

  const selectSenderProvince = async (province: GhnProvince) => {
    updateSender({ province, district: null, ward: null });
    setSenderDistricts([]);
    setSenderWards([]);
    try {
      setLoadingSenderDistricts(true);
      setSenderDistricts(await ghnApi.getDistricts(province.provinceId));
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error, "Không thể tải quận/huyện nơi gửi."),
      });
    } finally {
      setLoadingSenderDistricts(false);
    }
  };

  const selectReceiverProvince = async (province: GhnProvince) => {
    updateReceiver({ province, district: null, ward: null });
    setReceiverDistricts([]);
    setReceiverWards([]);
    try {
      setLoadingReceiverDistricts(true);
      setReceiverDistricts(await ghnApi.getDistricts(province.provinceId));
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error, "Không thể tải quận/huyện nơi nhận."),
      });
    } finally {
      setLoadingReceiverDistricts(false);
    }
  };

  const selectSenderDistrict = async (district: GhnDistrict) => {
    updateSender({ district, ward: null });
    setSenderWards([]);
    try {
      setLoadingSenderWards(true);
      setSenderWards(await ghnApi.getWards(district.districtId));
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error, "Không thể tải phường/xã nơi gửi."),
      });
    } finally {
      setLoadingSenderWards(false);
    }
  };

  const selectReceiverDistrict = async (district: GhnDistrict) => {
    updateReceiver({ district, ward: null });
    setReceiverWards([]);
    try {
      setLoadingReceiverWards(true);
      setReceiverWards(await ghnApi.getWards(district.districtId));
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error, "Không thể tải phường/xã nơi nhận."),
      });
    } finally {
      setLoadingReceiverWards(false);
    }
  };

  const handleDeliveryMethodChange = async (method: DeliveryMethod) => {
    setDeliveryMethod(method);
    setNotice(null);
    if (method === "GHN") {
      setPaymentType("FULL");

      // [SỬA LỖI] Đã xóa điều kiện `!isEditing` để khi Edit cũng auto fill được nếu Hợp đồng này chưa có thông tin GHN
      if (!hasFetchedGhnRef.current && negotiationId) {
        try {
          setIsLoadingGhnInfo(true);
          const res = await agreementApi.getGhnParcelInfo(
            negotiationId as string,
          );
          const data = res?.data || res;

          hasFetchedGhnRef.current = true;

          if (data) {
            const parcel = data.lightParcel || data.items?.[0] || {};
            const weight = Number(parcel.weightGram || 0);

            const autoServiceType =
              weight > 30000 ? 5 : data.serviceTypeId === 5 ? 5 : 2;
            setServiceTypeId(autoServiceType);

            if (parcel.weightGram) setWeightGram(String(parcel.weightGram));
            if (parcel.lengthCm) setLengthCm(String(parcel.lengthCm));
            if (parcel.widthCm) setWidthCm(String(parcel.widthCm));
            if (parcel.heightCm) setHeightCm(String(parcel.heightCm));

            const item = data.items?.[0];
            if (item && item.quantity) {
              setItemQuantity(String(item.quantity));
            }
          }

          setNotice({
            type: "success",
            message: "Đã tự động điền thông tin kiện hàng dựa trên bài đăng.", // Sửa chính tả
          });
        } catch (error) {
          console.log("Lỗi tải thông tin GHN tự động:", error);
        } finally {
          setIsLoadingGhnInfo(false);
        }
      }
    }
  };

  const validateGhnForm = () => {
    if (
      !sender.fullName.trim() ||
      !sender.phone.trim() ||
      !sender.province ||
      !sender.district ||
      !sender.ward ||
      !sender.addressDetail.trim()
    ) {
      return "Vui lòng nhập đầy đủ thông tin và địa chỉ người gửi.";
    }

    if (
      !receiver.fullName.trim() ||
      !receiver.phone.trim() ||
      !receiver.province ||
      !receiver.district ||
      !receiver.ward ||
      !receiver.addressDetail.trim()
    ) {
      return "Vui lòng nhập đầy đủ thông tin và địa chỉ người nhận.";
    }

    if (
      !toPositiveInt(weightGram) ||
      !toPositiveInt(lengthCm) ||
      !toPositiveInt(widthCm) ||
      !toPositiveInt(heightCm)
    ) {
      return "Trọng lượng và kích thước kiện hàng phải là số nguyên lớn hơn 0.";
    }

    if (serviceTypeId === 5) {
      if (!toPositiveInt(itemQuantity)) {
        return "Vui lòng nhập số lượng sản phẩm lớn hơn 0.";
      }
    }

    if (!requiredNote) {
      return "Vui lòng chọn Yêu cầu khi giao hàng.";
    }

    return null;
  };

  const buildHeavyItem = (): GhnItemPayload => ({
    name: summary.productName || "Sản phẩm",
    code: summary.productCode || "SP01",
    quantity: toPositiveInt(itemQuantity),
    weightGram: toPositiveInt(weightGram),
    lengthCm: toPositiveInt(lengthCm),
    widthCm: toPositiveInt(widthCm),
    heightCm: toPositiveInt(heightCm),
  });

  const handleCalculateFee = async () => {
    const validationMessage = validateGhnForm();
    if (validationMessage) {
      setNotice({ type: "error", message: validationMessage });
      return;
    }

    if (!negotiationId) {
      setNotice({
        type: "error",
        message: "Không tìm thấy phiên thương lượng để tính phí GHN.",
      });
      return;
    }

    try {
      setIsCalculatingFee(true);
      setNotice(null);
      setGhnQuoteStatus("NotCalculated");

      const previewPayload = {
        sender: toPartyPayload(sender),
        receiver: toPartyPayload(receiver),
        serviceTypeId,
        requiredNote: requiredNote as RequiredNote,
        ...(serviceTypeId === 2
          ? {
              lightParcel: {
                weightGram: toPositiveInt(weightGram),
                lengthCm: toPositiveInt(lengthCm),
                widthCm: toPositiveInt(widthCm),
                heightCm: toPositiveInt(heightCm),
              },
            }
          : { items: [buildHeavyItem()] }),
      };

      const previewResponse = await agreementApi.previewShippingFee(
        negotiationId as string,
        previewPayload,
      );

      const responseData = previewResponse?.data ?? previewResponse;
      const previewData = responseData?.ghnInfo ?? responseData;
      const result = previewData?.quote ?? previewData;
      const rawQuoteStatus = String(
        previewData?.quoteStatus ?? responseData?.quoteStatus ?? "Valid",
      );
      const nextQuoteStatus: GhnQuoteStatus =
        rawQuoteStatus === "Failed"
          ? "Failed"
          : rawQuoteStatus === "Stale"
            ? "Stale"
            : rawQuoteStatus === "NotCalculated"
              ? "NotCalculated"
              : "Valid";

      const totalFee = Number(
        result?.estimatedShippingFee ??
          result?.totalFee ??
          result?.total_fee ??
          0,
      );

      if (
        nextQuoteStatus !== "Valid" ||
        !Number.isFinite(totalFee) ||
        totalFee <= 0
      ) {
        throw new Error("Hệ thống chưa trả về phí giao hàng hợp lệ.");
      }

      setGhnQuote({
        totalFee,
        breakdown: {
          ...EMPTY_BREAKDOWN,
          ...(result?.breakdown || {}),
        },
        quotedAt: result?.quotedAt || new Date().toISOString(),
        inputHash: result?.inputHash ?? previewData?.inputHash ?? "",
        expectedDeliveryAt:
          result?.expectedDeliveryAt ??
          previewData?.expectedDeliveryAt ??
          new Date().toISOString(),
      });
      setGhnQuoteStatus(nextQuoteStatus);
      setNotice({
        type: "success",
        message: "Đã tính và lưu bản xem trước phí giao hàng GHN.",
      });
    } catch (error: any) {
      setGhnQuote(null);
      setGhnQuoteStatus("Failed");

      // Bóc tách message thật từ BE trả về
      const apiMsg = error?.response?.data?.error?.message || error?.response?.data?.message || "";
      
      // Cứ lỗi API GHN là chốt cứng câu này theo đúng dặn dò của ông
      let finalMessage = "GHN đang bảo trì. Không thể xem trước thông tin vận chuyển GHN ở thời điểm hiện tại.";

      if (apiMsg) {
        // Nếu BE trả về mấy câu vô tri như "Lỗi máy chủ..." thì ĐÈ LUÔN, xài câu chốt cứng phía trên
        if (apiMsg.toLowerCase().includes("lỗi máy chủ") || apiMsg.toLowerCase().includes("server error")) {
          finalMessage = "GHN đang bảo trì. Không thể xem trước thông tin vận chuyển GHN ở thời điểm hiện tại.";
        } 
        // Ngoại lệ: Nếu là lỗi Validation 400 (do nhập sai kích thước, cân nặng...) thì phải in thẳng lỗi ra cho người ta biết đường sửa
        else if (error?.response?.status === 400) {
          finalMessage = apiMsg;
        } 
        // Các trường hợp có message tử tế từ BE thì ghép lại: "GHN đang bảo trì. [Message]"
        else {
          finalMessage = `GHN đang bảo trì. ${apiMsg}`;
        }
      }

      setNotice({
        type: "error",
        message: finalMessage,
      });
    } finally {
      setIsCalculatingFee(false);
    }
  };

  const buildAgreementDetails = (): AgreementDetailsPayload => {
    const methodEnumMap: Record<
      DeliveryMethod,
      AgreementDetailsPayload["deliveryMethod"]
    > = {
      SELLER_DELIVERY: "SellerDelivers",
      BUYER_PICKUP: "BuyerPickUp",
      GHN: "GhnDelivery",
    };

    const details: AgreementDetailsPayload = {
      revision,
      notes: notes.trim() || null,
    };

    if (isInspection) {
      details.inspectionDate = inspectionDate
        ? new Date(inspectionDate).toISOString()
        : null;
      details.inspectionAddress = inspectionAddress.trim() || null;
      return details;
    }

    details.collectionDate = collectionDate
      ? new Date(collectionDate).toISOString()
      : null;
    details.deliveryMethod = methodEnumMap[deliveryMethod] || "Unknown";

    if (deliveryMethod !== "GHN") {
      details.pickupAddress = pickupAddress.trim() || null;
      details.deliveryAddress = deliveryAddress.trim() || null;
      details.ghnInfo = null;
      details.codValue = 0;
      details.estimatedShippingFee = null;
      return details;
    }

    const parcel: ParcelPayload = {
      weightGram: toPositiveInt(weightGram),
      lengthCm: toPositiveInt(lengthCm),
      widthCm: toPositiveInt(widthCm),
      heightCm: toPositiveInt(heightCm),
    };

    details.pickupAddress = composeAddress(sender);
    details.deliveryAddress = composeAddress(receiver);
    details.codValue = toNonNegativeInt(codValue);
    details.estimatedShippingFee = ghnQuote!.totalFee;

    details.ghnInfo = {
      sender: toPartyPayload(sender),
      receiver: toPartyPayload(receiver),
      serviceTypeId,
      requiredNote: requiredNote as RequiredNote,
      ...(serviceTypeId === 2
        ? { lightParcel: parcel }
        : { items: [buildHeavyItem()] }),
    };

    return details;
  };

  const handleSubmit = async () => {
    setNotice(null);

    if (isInspection) {
      if (!inspectionDate || !inspectionAddress.trim()) {
        setNotice({
          type: "error",
          message: "Vui lòng nhập thời gian và địa điểm kiểm định.",
        });
        return;
      }
    } else {
      if (!collectionDate) {
        setNotice({
          type: "error",
          message: "Vui lòng chọn thời gian thu gom dự kiến.",
        });
        return;
      }

      if (deliveryMethod === "GHN") {
        const validationMessage = validateGhnForm();
        if (validationMessage) {
          setNotice({ type: "error", message: validationMessage });
          return;
        }
        if (!ghnQuote || ghnQuoteStatus !== "Valid") {
          setNotice({
            type: "error",
            message:
              "Thông tin giao hàng đã thay đổi hoặc chưa có phí hợp lệ. Vui lòng tính lại phí GHN.",
          });
          return;
        }
      } else if (!pickupAddress.trim() || !deliveryAddress.trim()) {
        setNotice({
          type: "error",
          message: "Vui lòng nhập đầy đủ địa chỉ lấy và nhận hàng.",
        });
        return;
      }
    }

    try {
      setIsProcessing(true);

      if (isEditing && editAgreementId) {
        try {
          const checkRes = await agreementApi.getAgreementById(
            editAgreementId as string,
          );
          const latestData = checkRes?.data || checkRes;
          const latestRevision = Number(
            latestData?.agreementDetails?.revision ?? latestData?.revision ?? 0,
          );

          if (latestRevision > revision) {
            setNotice({
              type: "error",
              message:
                "⚠️ Dữ liệu đã cũ do đối tác vừa cập nhật hợp đồng. Vui lòng tải lại bản mới nhất để tránh ghi đè!",
            });
            setIsProcessing(false);
            return;
          }
        } catch (checkErr) {
          console.log("Lỗi check revision:", checkErr);
        }
      }

      const agreementDetails = buildAgreementDetails();
      const commonPayload = {
        agreementType: isInspection
          ? ("Inspection" as const)
          : ("No_Inspection" as const),
        paymentType: isInspection
          ? ("Deposit" as const)
          : paymentType === "DEPOSIT"
            ? ("Deposit" as const)
            : ("Full_Payment" as const),
        agreementDetails,
      };

      if (isEditing) {
        if (!editAgreementId) {
          throw new Error("Không tìm thấy mã hợp đồng cần cập nhật.");
        }
        await agreementApi.updateAgreement(
          editAgreementId as string,
          commonPayload,
        );

        try {
          const clientMessageId =
            "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(
              /[xy]/g,
              (character) => {
                const random = (Math.random() * 16) | 0;
                const value = character === "x" ? random : (random & 0x3) | 0x8;
                return value.toString(16);
              },
            );
          await messageApi.sendMessage(negotiationId as string, {
            messageContent: `${user?.username || "Đối tác"} đã chỉnh sửa hợp đồng.`,
            clientMessageId,
            messageType: 4,
          });
        } catch (msgError) {
          console.log("Lỗi gửi tin nhắn hệ thống:", msgError);
        }

        setTimeout(() => {
          router.replace({
            pathname: "/agreements/preview",
            params: {
              agreementId: editAgreementId,
              negotiationId: negotiationId,
              successMsg:
                //"Đã cập nhật hợp đồng. Phía còn lại cần xem và xác nhận lại bản mới.",
                "Cập nhật hợp đồng thành công. Đang chờ đối tác xem và xác nhận.",
            },
          });
        }, 700);
      } else {
        await agreementApi.createAgreement({
          negotiationId: negotiationId as string,
          ...commonPayload,
        });
        setNotice({
          type: "success",
          message: "Đã tạo hợp đồng và xác nhận phía người bán.",
        });
        setTimeout(() => {
          if (negotiationId) router.replace(`/chat/${negotiationId}`);
          else router.back();
        }, 700);
      }
    } catch (error) {
      setNotice({
        type: "error",
        message: getErrorMessage(error, "Không thể thực hiện lúc này."),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
    }).format(price);

  if (isLoadingData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header
          title={isEditing ? "Chỉnh sửa hợp đồng" : "Thiết lập hợp đồng"}
          showBack
        />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header
        title={isEditing ? "Chỉnh sửa hợp đồng" : "Thiết lập hợp đồng"}
        showBack
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tóm tắt giao dịch</Text>
            <View style={styles.summaryCard}>
              {isLoadingSummary ? (
                <ActivityIndicator color={COLORS.primary} />
              ) : (
                <>
                  <Text style={styles.summaryProductName} numberOfLines={2}>
                    {summary.productName}
                  </Text>
                  <Text style={styles.summaryPrice}>
                    Giá chốt: {formatPrice(summary.price)}
                  </Text>
                  <Text style={styles.summaryQty}>
                    Số lượng: {summary.quantity}
                  </Text>
                </>
              )}
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Loại giao dịch</Text>
            <View style={styles.radioGroup}>
              <TouchableOpacity
                style={styles.radioBtn}
                onPress={() => {
                  setIsInspection(true);
                  setPaymentType("DEPOSIT");
                  setNotice(null);

                  // [THÊM MỚI] Xóa trắng data giao nhận khi quay về "Có kiểm định"
                  if (!isEditing) {
                    setPickupAddress("");
                    setDeliveryAddress("");
                    setDeliveryMethod("SELLER_DELIVERY");
                  }
                }}
              >
                <Ionicons
                  name={isInspection ? "radio-button-on" : "radio-button-off"}
                  size={24}
                  color={isInspection ? COLORS.primary : COLORS.textLight}
                />
                <Text style={styles.radioText}>Có kiểm định trước</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.radioBtnLast}
                onPress={() => {
                  setIsInspection(false);
                  setNotice(null);

                  // [THÊM MỚI] Auto-fill phương thức từ Post khi nhấp "Không kiểm định"
                  if (!isEditing && defaultPostDeliveryMethod) {
                    handleDeliveryMethodChange(defaultPostDeliveryMethod);
                  }
                }}
              >
                <Ionicons
                  name={!isInspection ? "radio-button-on" : "radio-button-off"}
                  size={24}
                  color={!isInspection ? COLORS.primary : COLORS.textLight}
                />
                <Text style={styles.radioText}>
                  Không kiểm định (Giao hàng ngay)
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {isInspection ? (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Thông tin kiểm định</Text>

              <CustomDatePicker
                label="Thời gian hẹn *"
                placeholder="Chọn ngày..."
                value={inspectionDate}
                onDateChange={setInspectionDate}
              />

              {/* [SỬA LẠI UI] Dùng AddressPickerField thay cho TextInput thường */}
              <View style={{ marginBottom: 16 }}>
                <Text style={styles.inputLabel}>Địa điểm kiểm định *</Text>
                <AddressPickerField
                  value={inspectionAddress}
                  onChange={(val) => setInspectionAddress(val)}
                  placeholder="Nhập địa điểm kiểm định..."
                />
              </View>

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Ghi chú thêm</Text>
                <TextInput
                  placeholder="Các yêu cầu khác..."
                  placeholderTextColor="#94A3B8"
                  value={notes}
                  onChangeText={setNotes}
                  style={[styles.input, styles.multilineInput]}
                  multiline
                />
              </View>
              <View style={styles.infoBox}>
                <Ionicons
                  name="information-circle-outline"
                  size={20}
                  color={COLORS.primary}
                />
                <Text style={styles.infoText}>
                  Hình thức thanh toán: Đặt cọc (mặc định khi có kiểm định)
                </Text>
              </View>
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Thông tin giao nhận</Text>
              <Text style={styles.subLabel}>Phương thức vận chuyển</Text>
              <View style={[styles.radioGroup, styles.deliveryGroup]}>
                <TouchableOpacity
                  style={styles.radioBtn}
                  onPress={() =>
                    void handleDeliveryMethodChange("SELLER_DELIVERY")
                  }
                >
                  <Ionicons
                    name={
                      deliveryMethod === "SELLER_DELIVERY"
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={24}
                    color={
                      deliveryMethod === "SELLER_DELIVERY"
                        ? COLORS.primary
                        : COLORS.textLight
                    }
                  />
                  <Text style={styles.radioText}>Bên bán tự giao</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioBtn}
                  onPress={() =>
                    void handleDeliveryMethodChange("BUYER_PICKUP")
                  }
                >
                  <Ionicons
                    name={
                      deliveryMethod === "BUYER_PICKUP"
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={24}
                    color={
                      deliveryMethod === "BUYER_PICKUP"
                        ? COLORS.primary
                        : COLORS.textLight
                    }
                  />
                  <Text style={styles.radioText}>Bên mua đến lấy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioBtnLast}
                  onPress={() => void handleDeliveryMethodChange("GHN")}
                >
                  <Ionicons
                    name={
                      deliveryMethod === "GHN"
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={24}
                    color={
                      deliveryMethod === "GHN"
                        ? COLORS.primary
                        : COLORS.textLight
                    }
                  />
                  <Text style={styles.radioText}>Dịch vụ giao hàng (GHN)</Text>
                </TouchableOpacity>
              </View>

              <CustomDatePicker
                label="Thời gian thu gom dự kiến *"
                placeholder="Chọn ngày..."
                value={collectionDate}
                onDateChange={setCollectionDate}
              />

              {deliveryMethod === "GHN" ? (
                <View style={styles.configCard}>
                  <View style={styles.ghnHeader}>
                    <Ionicons
                      name="cube-outline"
                      size={22}
                      color={COLORS.primary}
                    />
                    <Text style={styles.ghnTitle}>
                      Thông tin giao hàng nhanh (GHN)
                    </Text>
                  </View>

                  {isLoadingGhnInfo ? (
                    <View
                      style={{
                        padding: 24,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <ActivityIndicator size="small" color={COLORS.primary} />
                      <Text
                        style={{
                          marginTop: 12,
                          color: COLORS.textLight,
                          fontSize: 14,
                        }}
                      >
                        Đang tự động lấy thông tin kiện hàng...
                      </Text>
                    </View>
                  ) : (
                    <>
                      <GhnPartyFields
                        title="Thông tin người gửi"
                        value={sender}
                        isExpanded={senderExpanded}
                        onToggle={() => setSenderExpanded(!senderExpanded)}
                        provinces={provinces}
                        districts={senderDistricts}
                        wards={senderWards}
                        loadingDistricts={loadingSenderDistricts}
                        loadingWards={loadingSenderWards}
                        onChange={updateSender}
                        onSelectProvince={selectSenderProvince}
                        onSelectDistrict={selectSenderDistrict}
                        onSelectWard={(ward) => updateSender({ ward })}
                      />

                      <GhnPartyFields
                        title="Thông tin người nhận"
                        value={receiver}
                        isExpanded={receiverExpanded}
                        onToggle={() => setReceiverExpanded(!receiverExpanded)}
                        provinces={provinces}
                        districts={receiverDistricts}
                        wards={receiverWards}
                        loadingDistricts={loadingReceiverDistricts}
                        loadingWards={loadingReceiverWards}
                        onChange={updateReceiver}
                        onSelectProvince={selectReceiverProvince}
                        onSelectDistrict={selectReceiverDistrict}
                        onSelectWard={(ward) => updateReceiver({ ward })}
                      />

                      <Text style={styles.ghnSubTitle}>Cấu hình giao hàng</Text>
                      <Text style={styles.inputLabel}>Loại hàng *</Text>
                      <View style={styles.radioGroupRow}>
                        <TouchableOpacity
                          style={styles.radioBtnRowConfig}
                          onPress={() => {
                            setServiceTypeId(2);
                            invalidateQuote();
                          }}
                        >
                          <Ionicons
                            name={
                              serviceTypeId === 2
                                ? "radio-button-on"
                                : "radio-button-off"
                            }
                            size={23}
                            color={
                              serviceTypeId === 2
                                ? COLORS.primary
                                : COLORS.textLight
                            }
                          />
                          <Text style={styles.radioText}>Hàng nhẹ</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={styles.radioBtnRowConfig}
                          onPress={() => {
                            setServiceTypeId(5);
                            invalidateQuote();
                          }}
                        >
                          <Ionicons
                            name={
                              serviceTypeId === 5
                                ? "radio-button-on"
                                : "radio-button-off"
                            }
                            size={23}
                            color={
                              serviceTypeId === 5
                                ? COLORS.primary
                                : COLORS.textLight
                            }
                          />
                          <Text style={styles.radioText}>Hàng nặng</Text>
                        </TouchableOpacity>
                      </View>

                      <View style={styles.numericGrid}>
                        <NumericInput
                          label="Tổng trọng lượng (g) *"
                          value={weightGram}
                          onChangeText={(value) => {
                            setWeightGram(value);
                            invalidateQuote();
                          }}
                        />
                        <NumericInput
                          label="Chiều dài (cm) *"
                          value={lengthCm}
                          onChangeText={(value) => {
                            setLengthCm(value);
                            invalidateQuote();
                          }}
                        />
                        <NumericInput
                          label="Chiều rộng (cm) *"
                          value={widthCm}
                          onChangeText={(value) => {
                            setWidthCm(value);
                            invalidateQuote();
                          }}
                        />
                        <NumericInput
                          label="Chiều cao (cm) *"
                          value={heightCm}
                          onChangeText={(value) => {
                            setHeightCm(value);
                            invalidateQuote();
                          }}
                        />
                      </View>

                      {serviceTypeId === 5 ? (
                        <NumericInput
                          label="Số lượng sản phẩm *"
                          value={itemQuantity}
                          onChangeText={(value) => {
                            setItemQuantity(value);
                            invalidateQuote();
                          }}
                        />
                      ) : null}

                      <View style={styles.topSpacing}>
                        <SelectField
                          label="Yêu cầu khi giao hàng *"
                          placeholder="Chọn yêu cầu"
                          hideSearch={true}
                          valueLabel={
                            requiredNote === "CHOTHUHANG"
                              ? "Cho thử hàng"
                              : requiredNote === "CHOXEMHANGKHONGTHU"
                                ? "Cho xem hàng, không thử"
                                : requiredNote === "KHONGCHOXEMHANG"
                                  ? "Không cho xem hàng"
                                  : ""
                          }
                          options={[
                            {
                              value: "CHOTHUHANG" as const,
                              label: "Cho thử hàng",
                            },
                            {
                              value: "CHOXEMHANGKHONGTHU" as const,
                              label: "Cho xem hàng, không thử",
                            },
                            {
                              value: "KHONGCHOXEMHANG" as const,
                              label: "Không cho xem hàng",
                            },
                          ]}
                          getKey={(item) => item.value}
                          getLabel={(item) => item.label}
                          onSelect={(item) => setRequiredNote(item.value)}
                        />
                      </View>

                      <NumericInput
                        label="Tiền thu hộ COD (đ)"
                        value={codValue}
                        onChangeText={setCodValue}
                        placeholder="0"
                      />

                      <TouchableOpacity
                        style={[
                          styles.calculateBtn,
                          isCalculatingFee ? styles.buttonDisabled : undefined,
                        ]}
                        onPress={handleCalculateFee}
                        disabled={isCalculatingFee}
                      >
                        {isCalculatingFee ? (
                          <ActivityIndicator color={COLORS.white} />
                        ) : (
                          <>
                            <Ionicons
                              name="calculator-outline"
                              size={20}
                              color={COLORS.white}
                            />
                            <Text style={styles.calculateBtnText}>
                              Tính phí giao hàng
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>

                      {ghnQuote ? (
                        <View style={styles.quoteCard}>
                          <Text style={styles.quoteLabel}>
                            Phí vận chuyển dự kiến
                          </Text>
                          <Text style={styles.quoteValue}>
                            {formatPrice(ghnQuote.totalFee)}
                          </Text>
                          <Text style={styles.quoteHint}>
                            Phí được lưu vào hợp đồng và có thể thay đổi nếu
                            thông tin kiện hàng thay đổi.
                          </Text>
                        </View>
                      ) : null}
                    </>
                  )}
                </View>
              ) : (
                <>
                  {/* [SỬA LẠI UI] Thay TextInput bằng AddressPickerField và update label cho rõ ràng */}
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.inputLabel}>
                      Địa chỉ lấy hàng (Người bán) *
                    </Text>
                    <AddressPickerField
                      value={pickupAddress}
                      onChange={(val) => setPickupAddress(val)}
                      placeholder="Nhập địa chỉ lấy hàng..."
                    />
                  </View>
                  <View style={{ marginBottom: 16 }}>
                    <Text style={styles.inputLabel}>
                      Địa chỉ nhận hàng (Người mua) *
                    </Text>
                    <AddressPickerField
                      value={deliveryAddress}
                      onChange={(val) => setDeliveryAddress(val)}
                      placeholder="Nhập địa chỉ nhận hàng..."
                    />
                  </View>
                </>
              )}

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Ghi chú thêm</Text>
                <TextInput
                  placeholder="Ghi chú cho shipper hoặc đối tác..."
                  placeholderTextColor="#94A3B8"
                  value={notes}
                  onChangeText={setNotes}
                  style={[styles.input, styles.multilineInput]}
                  multiline
                />
              </View>

              <Text style={styles.subLabel}>Hình thức thanh toán</Text>
              <View style={styles.radioGroupRow}>
                <TouchableOpacity
                  style={styles.radioBtnRow}
                  onPress={() => {
                    if (deliveryMethod !== "GHN") setPaymentType("DEPOSIT");
                  }}
                  disabled={deliveryMethod === "GHN"}
                >
                  <Ionicons
                    name={
                      paymentType === "DEPOSIT"
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={24}
                    color={
                      deliveryMethod === "GHN"
                        ? COLORS.border
                        : paymentType === "DEPOSIT"
                          ? COLORS.primary
                          : COLORS.textLight
                    }
                  />
                  {/* [SỬA LẠI UI] Ghi thêm chữ 20% cạnh Đặt cọc */}
                  <Text
                    style={[
                      styles.radioText,
                      deliveryMethod === "GHN"
                        ? styles.disabledText
                        : undefined,
                    ]}
                  >
                    Đặt cọc (20%)
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.radioBtnRow}
                  onPress={() => setPaymentType("FULL")}
                >
                  <Ionicons
                    name={
                      paymentType === "FULL"
                        ? "radio-button-on"
                        : "radio-button-off"
                    }
                    size={24}
                    color={
                      paymentType === "FULL" ? COLORS.primary : COLORS.textLight
                    }
                  />
                  <Text style={styles.radioText}>Toàn phần</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <InlineNotice notice={notice} />

          <TouchableOpacity
            style={[
              styles.submitBtn,
              isProcessing ? styles.buttonDisabled : undefined,
            ]}
            onPress={handleSubmit}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.submitBtnText}>
                {isEditing ? "Cập nhật hợp đồng" : "Tạo hợp đồng"}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: COLORS.background },
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  scrollContent: { padding: 16, paddingBottom: 40 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 12,
  },
  summaryCard: {
    backgroundColor: COLORS.white,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  summaryProductName: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  summaryPrice: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 4,
  },
  summaryQty: { fontSize: 14, color: COLORS.textLight },
  radioGroup: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: "hidden",
  },
  deliveryGroup: { marginBottom: 16 },
  radioBtn: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  radioBtnLast: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  radioGroupRow: { flexDirection: "row", gap: 12, marginBottom: 16 },
  radioBtnRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  radioBtnRowConfig: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FED7AA",
  },
  radioText: {
    marginLeft: 10,
    fontSize: 14,
    color: COLORS.text,
    flexShrink: 1,
  },
  disabledText: { color: COLORS.textLight },
  inputContainer: { marginBottom: 16 },
  inputLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    fontSize: 15,
    color: COLORS.text,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  multilineInput: { minHeight: 92, textAlignVertical: "top" },
  inputDisabled: { opacity: 0.55 },
  selectInput: {
    minHeight: 52,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectValue: { flex: 1, fontSize: 15, color: COLORS.text, marginRight: 8 },
  selectPlaceholder: {
    flex: 1,
    fontSize: 15,
    color: "#94A3B8",
    marginRight: 8,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    padding: 20,
  },
  optionModal: {
    maxHeight: "72%",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
  },
  optionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },
  optionTitle: { fontSize: 17, fontWeight: "700", color: COLORS.text },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 8,
    color: COLORS.text,
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  optionRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 11,
  },
  optionText: { flex: 1, fontSize: 15, color: COLORS.text, marginRight: 8 },
  emptyOption: {
    paddingVertical: 24,
    textAlign: "center",
    color: COLORS.textLight,
  },
  infoBox: {
    flexDirection: "row",
    backgroundColor: "#E0F2FE",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  infoText: { color: "#0369A1", fontSize: 13, marginLeft: 8, flex: 1 },
  subLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.text,
    marginTop: 8,
    marginBottom: 12,
  },
  configCard: {
    backgroundColor: "#FFF7ED",
    borderWidth: 1,
    borderColor: "#FED7AA",
    borderRadius: 16,
    padding: 16,
    marginBottom: 18,
  },
  ghnHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  ghnTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.text,
    marginLeft: 8,
  },
  ghnSubCard: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FED7AA",
    padding: 14,
    marginBottom: 16,
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ghnSubTitleAcc: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
  },
  accordionSummary: {
    fontSize: 14,
    color: COLORS.textLight,
    marginTop: 6,
    lineHeight: 20,
  },
  accordionContent: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#FED7AA",
  },
  ghnSubTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.text,
    marginBottom: 14,
  },
  numericGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  numericItem: { width: "48.5%", marginBottom: 4 },
  topSpacing: { marginTop: 4 },
  calculateBtn: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  calculateBtnText: { color: COLORS.white, fontSize: 15, fontWeight: "700" },
  quoteCard: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
    borderRadius: 12,
    padding: 14,
    marginTop: 14,
  },
  quoteLabel: { color: "#047857", fontSize: 13, fontWeight: "600" },
  quoteValue: {
    color: "#065F46",
    fontSize: 22,
    fontWeight: "800",
    marginVertical: 4,
  },
  quoteHint: { color: "#047857", fontSize: 12, lineHeight: 17 },
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    marginBottom: 12,
  },
  noticeError: { backgroundColor: "#FEF2F2", borderColor: "#FECACA" },
  noticeSuccess: { backgroundColor: "#ECFDF5", borderColor: "#A7F3D0" },
  noticeInfo: { backgroundColor: "#EFF6FF", borderColor: "#BFDBFE" },
  noticeText: { flex: 1, marginLeft: 8, color: COLORS.text, lineHeight: 19 },
  noticeTextError: { color: "#B91C1C" },
  submitBtn: {
    backgroundColor: COLORS.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
  },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },
  buttonDisabled: { opacity: 0.65 },

  // Lịch Calendar
  datePickerTrigger: {
    minHeight: 52,
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  datePickerText: {
    fontSize: 15,
    color: COLORS.text,
  },
  datePickerPlaceholder: {
    fontSize: 15,
    color: "#94A3B8",
  },
  calendarModal: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 16,
    width: "100%",
    maxWidth: 360,
  },
  calHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  calHeaderBtn: {
    padding: 8,
  },
  calMonthYear: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
  },
  calWeekdays: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 8,
  },
  calWeekdayText: {
    width: "14%",
    textAlign: "center",
    fontSize: 13,
    fontWeight: "bold",
    color: COLORS.textLight,
  },
  calGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  calDayBox: {
    width: "14.28%",
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  calDaySelected: {
    backgroundColor: COLORS.primary,
    borderRadius: 20,
  },
  calDayToday: {
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 20,
  },
  calDayText: {
    fontSize: 15,
    color: COLORS.text,
  },
  calDayTextSelected: {
    color: COLORS.white,
    fontWeight: "bold",
  },
  calDayTextToday: {
    color: COLORS.primary,
    fontWeight: "bold",
  },
  calCloseBtn: {
    marginTop: 16,
    paddingVertical: 12,
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  calCloseBtnText: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.primary,
  },
});