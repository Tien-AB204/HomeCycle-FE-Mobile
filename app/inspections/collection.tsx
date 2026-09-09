import { Ionicons } from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  ActivityIndicator,
  Modal,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import CalendarDateField from "../../src/components/shared/CalendarDateField";
import Header from "../../src/components/shared/Header";
import {
  ModalBackdrop,
  ModalSurface,
} from "../../src/components/shared/ModalBackdrop";
import { COLORS } from "../../src/constants/theme";
import apiClient from "../../src/services/apis/axiosClient";
import inspectionFormApi, {
  COLLECTION_DELIVERY_METHOD,
  type CollectionDeliveryMethod,
  type CollectionGhnInfoInput,
  type GhnContactInput,
  type GhnItemInput,
  type InspectionFormSummary,
  type ScheduleInspectionCollectionRequest,
} from "../../src/services/apis/inspectionFormApi";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";

type Notice = {
  type: "error" | "info" | "success";
  text: string;
} | null;

type GhnProvince = {
  provinceId: number;
  provinceName: string;
};

type GhnDistrict = {
  districtId: number;
  provinceId: number;
  districtName: string;
};

type GhnWard = {
  wardCode: string;
  districtId: number;
  wardName: string;
};

type PartyForm = {
  fullName: string;
  phone: string;
  province: GhnProvince | null;
  district: GhnDistrict | null;
  ward: GhnWard | null;
  addressDetail: string;
};

type HeavyItemForm = {
  name: string;
  code: string;
  quantity: string;
  weightGram: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
};

type ChoiceOption = {
  key: string;
  label: string;
};

const EMPTY_PARTY: PartyForm = {
  fullName: "",
  phone: "",
  province: null,
  district: null,
  ward: null,
  addressDetail: "",
};

const EMPTY_HEAVY_ITEM: HeavyItemForm = {
  name: "",
  code: "",
  quantity: "1",
  weightGram: "",
  lengthCm: "",
  widthCm: "",
  heightCm: "",
};

const unwrap = <T,>(value: any): T =>
  (value?.data?.data ?? value?.data ?? value) as T;

const supportApi = {
  getOrder: async (orderId: string) =>
    unwrap<any>(
      await apiClient.get(`/orders/${orderId}`),
    ),

  getAgreement: async (agreementId: string) =>
    unwrap<any>(
      await apiClient.get(`/agreements/${agreementId}`),
    ),

  getProvinces: async (): Promise<GhnProvince[]> => {
    const response = await apiClient.get("/GHN/provinces");
    return unwrap<GhnProvince[]>(response) ?? [];
  },

  getDistricts: async (
    provinceId: number,
  ): Promise<GhnDistrict[]> => {
    const response = await apiClient.get(
      `/GHN/provinces/${provinceId}/districts`,
    );

    return unwrap<GhnDistrict[]>(response) ?? [];
  },

  getWards: async (
    districtId: number,
  ): Promise<GhnWard[]> => {
    const response = await apiClient.get(
      `/GHN/districts/${districtId}/wards`,
    );

    return unwrap<GhnWard[]>(response) ?? [];
  },
};

const normalizeText = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/[\s_-]/g, "")
    .toLowerCase();

const normalizeDeliveryMethod = (
  value: unknown,
): CollectionDeliveryMethod => {
  switch (normalizeText(value)) {
    case "1":
    case "ghndelivery":
      return COLLECTION_DELIVERY_METHOD.GHN;

    case "3":
    case "buyerpickup":
      return COLLECTION_DELIVERY_METHOD.BUYER_PICKUP;

    case "2":
    case "sellerdelivers":
    default:
      return COLLECTION_DELIVERY_METHOD.SELLER_DELIVERS;
  }
};

const methodLabel = (
  method: CollectionDeliveryMethod,
) => {
  switch (method) {
    case COLLECTION_DELIVERY_METHOD.GHN:
      return "Giao hàng GHN";

    case COLLECTION_DELIVERY_METHOD.BUYER_PICKUP:
      return "Người mua tự lấy";

    case COLLECTION_DELIVERY_METHOD.SELLER_DELIVERS:
      return "Người bán tự giao";

    default:
      return "Giao nhận";
  }
};

const pad2 = (value: number) =>
  String(value).padStart(2, "0");

const formatDateInput = (date: Date) =>
  [
    date.getFullYear(),
    pad2(date.getMonth() + 1),
    pad2(date.getDate()),
  ].join("-");

const defaultCollectionParts = () => {
  const next = new Date();
  next.setDate(next.getDate() + 1);
  next.setHours(9, 0, 0, 0);

  return {
    date: formatDateInput(next),
    time: "09:00",
  };
};

const parseCollectionParts = (
  value: unknown,
) => {
  if (!value) {
    return defaultCollectionParts();
  }

  const parsed = new Date(String(value));

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getTime() <= Date.now()
  ) {
    return defaultCollectionParts();
  }

  return {
    date: formatDateInput(parsed),
    time: `${pad2(parsed.getHours())}:${pad2(
      parsed.getMinutes(),
    )}`,
  };
};

const toPartyForm = (
  value: any,
): PartyForm => {
  const address = value?.address ?? {};

  return {
    fullName: String(value?.fullName ?? ""),
    phone: String(value?.phone ?? ""),

    province:
      Number(address?.provinceId) > 0
        ? {
            provinceId: Number(address.provinceId),
            provinceName: String(
              address?.provinceName ?? "",
            ),
          }
        : null,

    district:
      Number(address?.districtId) > 0
        ? {
            districtId: Number(address.districtId),
            provinceId: Number(
              address?.provinceId ?? 0,
            ),
            districtName: String(
              address?.districtName ?? "",
            ),
          }
        : null,

    ward: address?.wardCode
      ? {
          wardCode: String(address.wardCode),
          districtId: Number(
            address?.districtId ?? 0,
          ),
          wardName: String(
            address?.wardName ?? "",
          ),
        }
      : null,

    addressDetail: String(
      address?.addressDetail ?? "",
    ),
  };
};

const composePartyAddress = (
  party: PartyForm,
) =>
  [
    party.addressDetail.trim(),
    party.ward?.wardName,
    party.district?.districtName,
    party.province?.provinceName,
  ]
    .filter(Boolean)
    .join(", ");

const toPositiveInteger = (
  value: string,
) => {
  const parsed = Number(value.trim());

  return Number.isInteger(parsed) && parsed > 0
    ? parsed
    : 0;
};

const getErrorCode = (
  error: any,
) =>
  String(
    error?.response?.data?.code ??
      error?.response?.data?.error?.code ??
      "",
  );

function NoticeBox({
  notice,
}: {
  notice: Notice;
}) {
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
        color={
          notice.type === "error"
            ? COLORS.error
            : COLORS.primary
        }
      />

      <Text
        style={[
          styles.noticeText,
          notice.type === "error"
            ? styles.noticeTextError
            : undefined,
        ]}
      >
        {notice.text}
      </Text>
    </View>
  );
}

function ChoiceField({
  label,
  placeholder,
  valueLabel,
  options,
  onSelect,
  disabled = false,
}: {
  label: string;
  placeholder: string;
  valueLabel?: string;
  options: ChoiceOption[];
  onSelect: (option: ChoiceOption) => void;
  disabled?: boolean;
}) {
  const [visible, setVisible] =
    useState(false);

  const [keyword, setKeyword] =
    useState("");

  const close = () => {
    setVisible(false);
    setKeyword("");
  };

  const filtered = useMemo(() => {
    const query = keyword
      .trim()
      .toLocaleLowerCase("vi-VN");

    if (!query) return options;

    return options.filter((option) =>
      option.label
        .toLocaleLowerCase("vi-VN")
        .includes(query),
    );
  }, [keyword, options]);

  return (
    <View style={styles.fieldGroup}>
      <Text style={styles.label}>
        {label}
      </Text>

      <TouchableOpacity
        style={[
          styles.select,
          disabled
            ? styles.disabledInput
            : undefined,
        ]}
        disabled={disabled}
        onPress={() => setVisible(true)}
      >
        <Text
          style={
            valueLabel
              ? styles.selectValue
              : styles.placeholder
          }
          numberOfLines={1}
        >
          {valueLabel || placeholder}
        </Text>

        <Ionicons
          name="chevron-down"
          size={19}
          color={COLORS.textLight}
        />
      </TouchableOpacity>

      <Modal
        transparent
        visible={visible}
        animationType="fade"
        onRequestClose={close}
      >
        <ModalBackdrop
          style={styles.modalBackdrop}
          onPress={close}
        >
          <ModalSurface
            style={styles.modalSurface}
          >
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {label}
              </Text>

              <TouchableOpacity
                onPress={close}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={COLORS.text}
                />
              </TouchableOpacity>
            </View>

            <TextInput
              value={keyword}
              onChangeText={setKeyword}
              placeholder="Tìm kiếm..."
              placeholderTextColor={
                COLORS.textLight
              }
              style={styles.searchInput}
            />

            <ScrollView
              style={styles.optionList}
              keyboardShouldPersistTaps="handled"
            >
              {filtered.length > 0 ? (
                filtered.map((option) => (
                  <TouchableOpacity
                    key={option.key}
                    style={styles.optionRow}
                    onPress={() => {
                      onSelect(option);
                      close();
                    }}
                  >
                    <Text
                      style={styles.optionText}
                    >
                      {option.label}
                    </Text>

                    {valueLabel ===
                    option.label ? (
                      <Ionicons
                        name="checkmark-circle"
                        size={20}
                        color={COLORS.primary}
                      />
                    ) : null}
                  </TouchableOpacity>
                ))
              ) : (
                <Text
                  style={styles.emptyText}
                >
                  Không có dữ liệu phù hợp.
                </Text>
              )}
            </ScrollView>
          </ModalSurface>
        </ModalBackdrop>
      </Modal>
    </View>
  );
}

function PartyFields({
  title,
  value,
  provinces,
  districts,
  wards,
  onChange,
  onProvince,
  onDistrict,
  onWard,
}: {
  title: string;
  value: PartyForm;
  provinces: GhnProvince[];
  districts: GhnDistrict[];
  wards: GhnWard[];
  onChange: (
    patch: Partial<PartyForm>,
  ) => void;
  onProvince: (
    province: GhnProvince,
  ) => void;
  onDistrict: (
    district: GhnDistrict,
  ) => void;
  onWard: (ward: GhnWard) => void;
}) {
  return (
    <View style={styles.subCard}>
      <Text style={styles.subCardTitle}>
        {title}
      </Text>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          Họ và tên *
        </Text>

        <TextInput
          value={value.fullName}
          onChangeText={(fullName) =>
            onChange({ fullName })
          }
          placeholder="Nhập họ và tên"
          placeholderTextColor={
            COLORS.textLight
          }
          style={styles.input}
        />
      </View>

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          Số điện thoại *
        </Text>

        <TextInput
          value={value.phone}
          onChangeText={(phone) =>
            onChange({
              phone: phone.replace(
                /[^0-9+]/g,
                "",
              ),
            })
          }
          placeholder="Nhập số điện thoại"
          placeholderTextColor={
            COLORS.textLight
          }
          keyboardType="phone-pad"
          style={styles.input}
        />
      </View>

      <ChoiceField
        label="Tỉnh / Thành phố *"
        placeholder="Chọn tỉnh/thành phố"
        valueLabel={
          value.province?.provinceName
        }
        options={provinces.map(
          (province) => ({
            key: String(
              province.provinceId,
            ),
            label:
              province.provinceName,
          }),
        )}
        onSelect={(option) => {
          const province =
            provinces.find(
              (item) =>
                String(
                  item.provinceId,
                ) === option.key,
            );

          if (province) {
            onProvince(province);
          }
        }}
      />

      <ChoiceField
        label="Quận / Huyện *"
        placeholder={
          value.province
            ? "Chọn quận/huyện"
            : "Chọn tỉnh/thành phố trước"
        }
        valueLabel={
          value.district?.districtName
        }
        options={districts.map(
          (district) => ({
            key: String(
              district.districtId,
            ),
            label:
              district.districtName,
          }),
        )}
        disabled={!value.province}
        onSelect={(option) => {
          const district =
            districts.find(
              (item) =>
                String(
                  item.districtId,
                ) === option.key,
            );

          if (district) {
            onDistrict(district);
          }
        }}
      />

      <ChoiceField
        label="Phường / Xã *"
        placeholder={
          value.district
            ? "Chọn phường/xã"
            : "Chọn quận/huyện trước"
        }
        valueLabel={value.ward?.wardName}
        options={wards.map((ward) => ({
          key: ward.wardCode,
          label: ward.wardName,
        }))}
        disabled={!value.district}
        onSelect={(option) => {
          const ward = wards.find(
            (item) =>
              item.wardCode ===
              option.key,
          );

          if (ward) {
            onWard(ward);
          }
        }}
      />

      <View style={styles.fieldGroup}>
        <Text style={styles.label}>
          Số nhà, tên đường *
        </Text>

        <TextInput
          value={value.addressDetail}
          onChangeText={(
            addressDetail,
          ) =>
            onChange({
              addressDetail,
            })
          }
          placeholder="Ví dụ: 123 Nguyễn Văn Linh"
          placeholderTextColor={
            COLORS.textLight
          }
          style={styles.input}
        />
      </View>
    </View>
  );
}

export default function InspectionCollectionScreen() {
  const router = useRouter();

  const params =
    useLocalSearchParams();

  const appointmentId = Array.isArray(
    params.appointmentId,
  )
    ? params.appointmentId[0]
    : params.appointmentId;

  const defaults = useMemo(
    defaultCollectionParts,
    [],
  );

  const [isLoading, setIsLoading] =
    useState(true);

  const [isSubmitting, setIsSubmitting] =
    useState(false);

  const [notice, setNotice] =
    useState<Notice>(null);

  const [
    inspectionForm,
    setInspectionForm,
  ] =
    useState<InspectionFormSummary | null>(
      null,
    );

  const [orderData, setOrderData] =
    useState<any>(null);

  const [collectionDate, setCollectionDate] =
    useState(defaults.date);

  const [collectionTime, setCollectionTime] =
    useState(defaults.time);

  const [deliveryMethod, setDeliveryMethod] =
    useState<CollectionDeliveryMethod>(
      COLLECTION_DELIVERY_METHOD
        .SELLER_DELIVERS,
    );

  const [
    pickupAddress,
    setPickupAddress,
  ] = useState("");

  const [
    deliveryAddress,
    setDeliveryAddress,
  ] = useState("");

  const [shippingFee, setShippingFee] =
    useState("0");

  const [sender, setSender] =
    useState<PartyForm>(EMPTY_PARTY);

  const [receiver, setReceiver] =
    useState<PartyForm>(EMPTY_PARTY);

  const [serviceTypeId, setServiceTypeId] =
    useState<2 | 5>(2);

  const [requiredNote, setRequiredNote] =
    useState<
      | "CHOTHUHANG"
      | "CHOXEMHANGKHONGTHU"
      | "KHONGCHOXEMHANG"
    >("CHOXEMHANGKHONGTHU");

  const [heavyItem, setHeavyItem] =
    useState<HeavyItemForm>(
      EMPTY_HEAVY_ITEM,
    );

  const [provinces, setProvinces] =
    useState<GhnProvince[]>([]);

  const [
    senderDistricts,
    setSenderDistricts,
  ] = useState<GhnDistrict[]>([]);

  const [
    receiverDistricts,
    setReceiverDistricts,
  ] = useState<GhnDistrict[]>([]);

  const [senderWards, setSenderWards] =
    useState<GhnWard[]>([]);

  const [receiverWards, setReceiverWards] =
    useState<GhnWard[]>([]);

  const isGhn =
    deliveryMethod ===
    COLLECTION_DELIVERY_METHOD.GHN;

  const canSchedule =
    inspectionForm?.actions
      ?.canScheduleCollection === true;

  const hydrateLocationOptions =
    useCallback(
      async (
        senderValue: PartyForm,
        receiverValue: PartyForm,
      ) => {
        try {
          const [
            nextSenderDistricts,
            nextReceiverDistricts,
          ] = await Promise.all([
            senderValue.province
              ? supportApi.getDistricts(
                  senderValue.province
                    .provinceId,
                )
              : Promise.resolve([]),

            receiverValue.province
              ? supportApi.getDistricts(
                  receiverValue.province
                    .provinceId,
                )
              : Promise.resolve([]),
          ]);

          setSenderDistricts(
            nextSenderDistricts,
          );

          setReceiverDistricts(
            nextReceiverDistricts,
          );

          const [
            nextSenderWards,
            nextReceiverWards,
          ] = await Promise.all([
            senderValue.district
              ? supportApi.getWards(
                  senderValue.district
                    .districtId,
                )
              : Promise.resolve([]),

            receiverValue.district
              ? supportApi.getWards(
                  receiverValue.district
                    .districtId,
                )
              : Promise.resolve([]),
          ]);

          setSenderWards(nextSenderWards);
          setReceiverWards(
            nextReceiverWards,
          );
        } catch {
          // Dữ liệu hiện tại vẫn được giữ lại.
          // Danh sách địa chỉ có thể tải lại
          // khi người dùng chọn tỉnh/huyện mới.
        }
      },
      [],
    );

  const loadScreen = useCallback(
    async () => {
      if (!appointmentId) {
        setNotice({
          type: "error",
          text: "Không tìm thấy lịch kiểm định.",
        });

        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        setNotice(null);

        const [
          form,
          provinceData,
        ] = await Promise.all([
          inspectionFormApi.getByAppointment(
            String(appointmentId),
          ),

          supportApi
            .getProvinces()
            .catch(() => []),
        ]);

        setInspectionForm(form);
        setProvinces(provinceData);

        const order =
          await supportApi.getOrder(
            form.orderId,
          );

        setOrderData(order);

        const agreementId =
          order?.agreementId;

        if (!agreementId) {
          throw new Error(
            "Không tìm thấy thỏa thuận của đơn hàng.",
          );
        }

        const agreement =
          await supportApi.getAgreement(
            String(agreementId),
          );

        const details =
          agreement?.agreementDetails ?? {};

        const nextMethod =
          normalizeDeliveryMethod(
            details?.deliveryMethod ??
              order?.deliveryMethod,
          );

        setDeliveryMethod(nextMethod);

        setPickupAddress(
          String(
            details?.pickupAddress ?? "",
          ),
        );

        setDeliveryAddress(
          String(
            details?.deliveryAddress ?? "",
          ),
        );

        setShippingFee(
          String(
            details?.estimatedShippingFee ??
              order?.shippingFee ??
              0,
          ),
        );

        const dateParts =
          parseCollectionParts(
            details?.collectionDate,
          );

        setCollectionDate(
          dateParts.date,
        );

        setCollectionTime(
          dateParts.time,
        );

        const ghnInfo =
          details?.ghnInfo;

        if (ghnInfo) {
          const senderValue =
            toPartyForm(
              ghnInfo?.sender,
            );

          const receiverValue =
            toPartyForm(
              ghnInfo?.receiver,
            );

          setSender(senderValue);
          setReceiver(receiverValue);

          setServiceTypeId(
            Number(
              ghnInfo?.serviceTypeId,
            ) === 5
              ? 5
              : 2,
          );

          const note = String(
            ghnInfo?.requiredNote ?? "",
          ).toUpperCase();

          if (
            note === "CHOTHUHANG" ||
            note ===
              "CHOXEMHANGKHONGTHU" ||
            note ===
              "KHONGCHOXEMHANG"
          ) {
            setRequiredNote(note);
          }

          const firstItem =
            Array.isArray(
              ghnInfo?.items,
            )
              ? ghnInfo.items[0]
              : null;

          if (firstItem) {
            setHeavyItem({
              name: String(
                firstItem?.name ?? "",
              ),

              code: String(
                firstItem?.code ?? "",
              ),

              quantity: String(
                firstItem?.quantity ?? 1,
              ),

              weightGram: String(
                firstItem?.weightGram ??
                  "",
              ),

              lengthCm: String(
                firstItem?.lengthCm ??
                  "",
              ),

              widthCm: String(
                firstItem?.widthCm ??
                  "",
              ),

              heightCm: String(
                firstItem?.heightCm ??
                  "",
              ),
            });
          }

          void hydrateLocationOptions(
            senderValue,
            receiverValue,
          );
        }

        if (
          form.actions
            ?.canScheduleCollection !==
          true
        ) {
          setNotice({
            type: "info",
            text: "Hiện chưa thể đặt lịch giao nhận cho kết quả kiểm định này.",
          });
        }
      } catch (error) {
        setNotice({
          type: "error",
          text: getApiErrorMessage(
            error,
            "Không thể tải thông tin để đặt lịch giao nhận.",
          ),
        });
      } finally {
        setIsLoading(false);
      }
    },
    [
      appointmentId,
      hydrateLocationOptions,
    ],
  );

  useEffect(() => {
    void loadScreen();
  }, [loadScreen]);

  const selectSenderProvince =
    async (
      province: GhnProvince,
    ) => {
      setSender((current) => ({
        ...current,
        province,
        district: null,
        ward: null,
      }));

      setSenderDistricts([]);
      setSenderWards([]);

      try {
        setSenderDistricts(
          await supportApi.getDistricts(
            province.provinceId,
          ),
        );
      } catch (error) {
        setNotice({
          type: "error",
          text: getApiErrorMessage(
            error,
            "Không thể tải quận/huyện nơi gửi.",
          ),
        });
      }
    };

  const selectSenderDistrict =
    async (
      district: GhnDistrict,
    ) => {
      setSender((current) => ({
        ...current,
        district,
        ward: null,
      }));

      setSenderWards([]);

      try {
        setSenderWards(
          await supportApi.getWards(
            district.districtId,
          ),
        );
      } catch (error) {
        setNotice({
          type: "error",
          text: getApiErrorMessage(
            error,
            "Không thể tải phường/xã nơi gửi.",
          ),
        });
      }
    };

  const selectReceiverProvince =
    async (
      province: GhnProvince,
    ) => {
      setReceiver((current) => ({
        ...current,
        province,
        district: null,
        ward: null,
      }));

      setReceiverDistricts([]);
      setReceiverWards([]);

      try {
        setReceiverDistricts(
          await supportApi.getDistricts(
            province.provinceId,
          ),
        );
      } catch (error) {
        setNotice({
          type: "error",
          text: getApiErrorMessage(
            error,
            "Không thể tải quận/huyện nơi nhận.",
          ),
        });
      }
    };

  const selectReceiverDistrict =
    async (
      district: GhnDistrict,
    ) => {
      setReceiver((current) => ({
        ...current,
        district,
        ward: null,
      }));

      setReceiverWards([]);

      try {
        setReceiverWards(
          await supportApi.getWards(
            district.districtId,
          ),
        );
      } catch (error) {
        setNotice({
          type: "error",
          text: getApiErrorMessage(
            error,
            "Không thể tải phường/xã nơi nhận.",
          ),
        });
      }
    };

  const buildGhnContact = (
    party: PartyForm,
  ): GhnContactInput | null => {
    if (
      !party.fullName.trim() ||
      !party.phone.trim() ||
      !party.province ||
      !party.district ||
      !party.ward ||
      !party.addressDetail.trim()
    ) {
      return null;
    }

    return {
      fullName:
        party.fullName.trim(),

      phone: party.phone.trim(),

      address: {
        provinceId:
          party.province.provinceId,

        provinceName:
          party.province.provinceName,

        districtId:
          party.district.districtId,

        districtName:
          party.district.districtName,

        wardCode:
          party.ward.wardCode,

        wardName:
          party.ward.wardName,

        addressDetail:
          party.addressDetail.trim(),
      },
    };
  };

  const buildGhnInfo =
    (): CollectionGhnInfoInput | null => {
      const senderPayload =
        buildGhnContact(sender);

      const receiverPayload =
        buildGhnContact(receiver);

      if (
        !senderPayload ||
        !receiverPayload
      ) {
        return null;
      }

      if (serviceTypeId === 5) {
        const item: GhnItemInput = {
          name:
            heavyItem.name.trim(),

          code:
            heavyItem.code.trim() ||
            null,

          quantity:
            toPositiveInteger(
              heavyItem.quantity,
            ),

          weightGram:
            toPositiveInteger(
              heavyItem.weightGram,
            ),

          lengthCm:
            toPositiveInteger(
              heavyItem.lengthCm,
            ),

          widthCm:
            toPositiveInteger(
              heavyItem.widthCm,
            ),

          heightCm:
            toPositiveInteger(
              heavyItem.heightCm,
            ),
        };

        if (
          !item.name ||
          item.quantity <= 0 ||
          item.weightGram <= 0 ||
          item.lengthCm <= 0 ||
          item.widthCm <= 0 ||
          item.heightCm <= 0
        ) {
          return null;
        }

        return {
          sender: senderPayload,
          receiver: receiverPayload,
          serviceTypeId: 5,
          requiredNote,
          items: [item],
        };
      }

      return {
        sender: senderPayload,
        receiver: receiverPayload,
        serviceTypeId: 2,
        requiredNote,
        items: [],
      };
    };

  const handleSubmit = async () => {
    if (
      !inspectionForm ||
      !appointmentId ||
      isSubmitting
    ) {
      return;
    }

    setNotice(null);

    if (!canSchedule) {
      setNotice({
        type: "error",
        text: "Hiện chưa thể đặt lịch giao nhận cho kết quả kiểm định này.",
      });
      return;
    }

    if (
      !collectionDate ||
      !/^\d{2}:\d{2}$/.test(
        collectionTime,
      )
    ) {
      setNotice({
        type: "error",
        text: "Vui lòng chọn ngày và nhập giờ giao nhận theo dạng HH:mm.",
      });
      return;
    }

    const targetDate =
      new Date(
        `${collectionDate}T${collectionTime}:00`,
      );

    if (
      Number.isNaN(
        targetDate.getTime(),
      ) ||
      targetDate.getTime() <=
        Date.now()
    ) {
      setNotice({
        type: "error",
        text: "Thời gian giao nhận phải ở tương lai.",
      });
      return;
    }

    let payload:
      ScheduleInspectionCollectionRequest;

    if (isGhn) {
      const ghnInfo =
        buildGhnInfo();

      if (!ghnInfo) {
        setNotice({
          type: "error",
          text: "Vui lòng nhập đầy đủ thông tin người gửi, người nhận và kiện hàng GHN.",
        });
        return;
      }

      payload = {
        expectedRevision:
          inspectionForm.revision,

        collectionDate:
          targetDate.toISOString(),

        pickupAddress:
          composePartyAddress(sender),

        deliveryAddress:
          composePartyAddress(
            receiver,
          ),

        deliveryMethod:
          COLLECTION_DELIVERY_METHOD.GHN,

        // Phí GHN do hệ thống tính.
        estimatedShippingFee: null,

        // Contract này không chứa
        // paymentTypeId / quote / quoteStatus.
        ghnInfo,
      };
    } else {
      if (
        !pickupAddress.trim() ||
        !deliveryAddress.trim()
      ) {
        setNotice({
          type: "error",
          text: "Vui lòng nhập đầy đủ điểm lấy và điểm giao.",
        });
        return;
      }

      const parsedFee =
        Number(
          shippingFee.trim() || "0",
        );

      if (
        !Number.isFinite(
          parsedFee,
        ) ||
        parsedFee < 0
      ) {
        setNotice({
          type: "error",
          text: "Phí giao nhận không được nhỏ hơn 0.",
        });
        return;
      }

      payload = {
        expectedRevision:
          inspectionForm.revision,

        collectionDate:
          targetDate.toISOString(),

        pickupAddress:
          pickupAddress.trim(),

        deliveryAddress:
          deliveryAddress.trim(),

        deliveryMethod,

        estimatedShippingFee:
          parsedFee,

        ghnInfo: null,
      };
    }

    try {
      setIsSubmitting(true);

      const result =
        await inspectionFormApi
          .scheduleCollection(
            inspectionForm
              .inspectionFormId,

            payload,
          );

      setNotice({
        type: "success",
        text: "Đã tạo lịch giao nhận thành công.",
      });

      /*
       * Không chuyển sang thanh toán.
       * Mở Order Detail mới để màn hình
       * tự tải lại tổng tiền, phần còn lại
       * và phí giao nhận từ dữ liệu mới nhất.
       */
      router.replace(
        (
          `/orders/${result.orderId}`
        ) as any,
      );
    } catch (error: any) {
      const code =
        getErrorCode(error);

      if (
        code ===
        "Inspection.RevisionMismatch"
      ) {
        try {
          const latest =
            await inspectionFormApi
              .getByAppointment(
                String(
                  appointmentId,
                ),
              );

          setInspectionForm(latest);
        } catch {
          // Không retry request cũ.
        }

        setNotice({
          type: "info",
          text: "Kết quả kiểm định vừa được cập nhật. Vui lòng kiểm tra lại thông tin và xác nhận tạo lịch một lần nữa.",
        });

        return;
      }

      setNotice({
        type: "error",
        text: getApiErrorMessage(
          error,
          "Không thể tạo lịch giao nhận lúc này.",
        ),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const methodOptions = [
    {
      value:
        COLLECTION_DELIVERY_METHOD
          .SELLER_DELIVERS,
      label: "Người bán tự giao",
      icon: "bicycle-outline",
    },
    {
      value:
        COLLECTION_DELIVERY_METHOD
          .BUYER_PICKUP,
      label: "Người mua tự lấy",
      icon: "person-outline",
    },
    {
      value:
        COLLECTION_DELIVERY_METHOD
          .GHN,
      label: "Giao hàng GHN",
      icon: "cube-outline",
    },
  ] as const;

  if (isLoading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <Header
          title="Đặt lịch giao nhận"
          showBack
        />

        <View style={styles.centered}>
          <ActivityIndicator
            size="large"
            color={COLORS.primary}
          />

          <Text
            style={styles.loadingText}
          >
            Đang tải thông tin...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <Header
        title="Đặt lịch giao nhận"
        showBack
      />

      <ScrollView
        contentContainerStyle={
          styles.content
        }
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={
          false
        }
      >
        <NoticeBox notice={notice} />

        <View style={styles.summaryCard}>
          <Ionicons
            name="receipt-outline"
            size={24}
            color={COLORS.primary}
          />

          <View style={styles.flex}>
            <Text style={styles.summaryTitle}>
              Giao nhận sau kiểm định
            </Text>

            <Text style={styles.summaryMeta}>
              {orderData?.orderCode
                ? `Mã đơn: ${orderData.orderCode}`
                : "Đơn hàng đang xử lý"}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Thời gian giao nhận
          </Text>

          <Text style={styles.label}>
            Ngày *
          </Text>

          <CalendarDateField
            value={collectionDate}
            onChange={setCollectionDate}
            placeholder="Chọn ngày giao nhận"
            defaultViewDate={
              collectionDate
            }
          />

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>
              Giờ *
            </Text>

            <TextInput
              value={collectionTime}
              onChangeText={(text) =>
                setCollectionTime(
                  text
                    .replace(
                      /[^0-9:]/g,
                      "",
                    )
                    .slice(0, 5),
                )
              }
              placeholder="09:00"
              placeholderTextColor={
                COLORS.textLight
              }
              keyboardType="numbers-and-punctuation"
              style={styles.input}
            />

            <Text style={styles.helperText}>
              Nhập theo dạng HH:mm.
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Phương thức giao nhận
          </Text>

          <View style={styles.methodList}>
            {methodOptions.map(
              (option) => {
                const active =
                  deliveryMethod ===
                  option.value;

                return (
                  <TouchableOpacity
                    key={option.value}
                    style={[
                      styles.methodOption,
                      active
                        ? styles.methodOptionActive
                        : undefined,
                    ]}
                    onPress={() =>
                      setDeliveryMethod(
                        option.value,
                      )
                    }
                  >
                    <Ionicons
                      name={option.icon}
                      size={21}
                      color={
                        active
                          ? COLORS.primary
                          : COLORS.textLight
                      }
                    />

                    <Text
                      style={[
                        styles.methodText,
                        active
                          ? styles.methodTextActive
                          : undefined,
                      ]}
                    >
                      {option.label}
                    </Text>

                    <Ionicons
                      name={
                        active
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={20}
                      color={
                        active
                          ? COLORS.primary
                          : COLORS.textLight
                      }
                    />
                  </TouchableOpacity>
                );
              },
            )}
          </View>
        </View>

        {isGhn ? (
          <>
            <View
              style={[
                styles.notice,
                styles.noticeInfo,
              ]}
            >
              <Ionicons
                name="information-circle-outline"
                size={21}
                color={COLORS.primary}
              />

              <Text
                style={styles.noticeText}
              >
                Phí vận chuyển GHN được hệ thống tính tự động. Người mua/người nhận sẽ thanh toán phí vận chuyển cho GHN.
              </Text>
            </View>

            <View style={styles.card}>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Thông tin GHN
              </Text>

              <View
                style={
                  styles.serviceTypeRow
                }
              >
                {[2, 5].map(
                  (value) => (
                    <TouchableOpacity
                      key={value}
                      style={[
                        styles.serviceTypeButton,
                        serviceTypeId ===
                        value
                          ? styles.serviceTypeButtonActive
                          : undefined,
                      ]}
                      onPress={() =>
                        setServiceTypeId(
                          value as 2 | 5,
                        )
                      }
                    >
                      <Text
                        style={[
                          styles.serviceTypeText,
                          serviceTypeId ===
                          value
                            ? styles.serviceTypeTextActive
                            : undefined,
                        ]}
                      >
                        {value === 2
                          ? "Hàng nhẹ"
                          : "Hàng nặng"}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>

              <Text
                style={
                  styles.helperText
                }
              >
                {serviceTypeId === 2
                  ? "Khối lượng và kích thước hàng nhẹ được hệ thống lấy từ thông tin sản phẩm."
                  : "Vui lòng nhập thông tin kiện hàng nặng bên dưới."}
              </Text>
            </View>

            <PartyFields
              title="Người gửi"
              value={sender}
              provinces={provinces}
              districts={
                senderDistricts
              }
              wards={senderWards}
              onChange={(patch) =>
                setSender(
                  (current) => ({
                    ...current,
                    ...patch,
                  }),
                )
              }
              onProvince={
                selectSenderProvince
              }
              onDistrict={
                selectSenderDistrict
              }
              onWard={(ward) =>
                setSender(
                  (current) => ({
                    ...current,
                    ward,
                  }),
                )
              }
            />

            <PartyFields
              title="Người nhận"
              value={receiver}
              provinces={provinces}
              districts={
                receiverDistricts
              }
              wards={receiverWards}
              onChange={(patch) =>
                setReceiver(
                  (current) => ({
                    ...current,
                    ...patch,
                  }),
                )
              }
              onProvince={
                selectReceiverProvince
              }
              onDistrict={
                selectReceiverDistrict
              }
              onWard={(ward) =>
                setReceiver(
                  (current) => ({
                    ...current,
                    ward,
                  }),
                )
              }
            />

            <View style={styles.card}>
              <Text
                style={
                  styles.sectionTitle
                }
              >
                Yêu cầu giao hàng
              </Text>

              {[
                {
                  value:
                    "CHOTHUHANG",
                  label:
                    "Cho thử hàng",
                },
                {
                  value:
                    "CHOXEMHANGKHONGTHU",
                  label:
                    "Cho xem hàng, không thử",
                },
                {
                  value:
                    "KHONGCHOXEMHANG",
                  label:
                    "Không cho xem hàng",
                },
              ].map((option) => {
                const active =
                  requiredNote ===
                  option.value;

                return (
                  <TouchableOpacity
                    key={option.value}
                    style={
                      styles.noteOption
                    }
                    onPress={() =>
                      setRequiredNote(
                        option.value as
                          | "CHOTHUHANG"
                          | "CHOXEMHANGKHONGTHU"
                          | "KHONGCHOXEMHANG",
                      )
                    }
                  >
                    <Ionicons
                      name={
                        active
                          ? "radio-button-on"
                          : "radio-button-off"
                      }
                      size={20}
                      color={
                        active
                          ? COLORS.primary
                          : COLORS.textLight
                      }
                    />

                    <Text
                      style={
                        styles.noteText
                      }
                    >
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {serviceTypeId === 5 ? (
              <View
                style={styles.card}
              >
                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Kiện hàng nặng
                </Text>

                <View
                  style={
                    styles.fieldGroup
                  }
                >
                  <Text
                    style={styles.label}
                  >
                    Tên kiện hàng *
                  </Text>

                  <TextInput
                    value={
                      heavyItem.name
                    }
                    onChangeText={(
                      name,
                    ) =>
                      setHeavyItem(
                        (current) => ({
                          ...current,
                          name,
                        }),
                      )
                    }
                    placeholder="Tên sản phẩm"
                    placeholderTextColor={
                      COLORS.textLight
                    }
                    style={styles.input}
                  />
                </View>

                <View
                  style={
                    styles.fieldGroup
                  }
                >
                  <Text
                    style={styles.label}
                  >
                    Mã kiện
                  </Text>

                  <TextInput
                    value={
                      heavyItem.code
                    }
                    onChangeText={(
                      code,
                    ) =>
                      setHeavyItem(
                        (current) => ({
                          ...current,
                          code,
                        }),
                      )
                    }
                    placeholder="Không bắt buộc"
                    placeholderTextColor={
                      COLORS.textLight
                    }
                    style={styles.input}
                  />
                </View>

                {[
                  [
                    "quantity",
                    "Số lượng *",
                  ],
                  [
                    "weightGram",
                    "Khối lượng (gram) *",
                  ],
                  [
                    "lengthCm",
                    "Chiều dài (cm) *",
                  ],
                  [
                    "widthCm",
                    "Chiều rộng (cm) *",
                  ],
                  [
                    "heightCm",
                    "Chiều cao (cm) *",
                  ],
                ].map(
                  ([key, label]) => (
                    <View
                      key={key}
                      style={
                        styles.fieldGroup
                      }
                    >
                      <Text
                        style={
                          styles.label
                        }
                      >
                        {label}
                      </Text>

                      <TextInput
                        value={
                          heavyItem[
                            key as keyof HeavyItemForm
                          ]
                        }
                        onChangeText={(
                          text,
                        ) =>
                          setHeavyItem(
                            (
                              current,
                            ) => ({
                              ...current,
                              [key]:
                                text.replace(
                                  /[^0-9]/g,
                                  "",
                                ),
                            }),
                          )
                        }
                        placeholder="0"
                        placeholderTextColor={
                          COLORS.textLight
                        }
                        keyboardType="number-pad"
                        style={
                          styles.input
                        }
                      />
                    </View>
                  ),
                )}
              </View>
            ) : null}
          </>
        ) : (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Thông tin giao nhận
            </Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Điểm lấy *
              </Text>

              <TextInput
                value={pickupAddress}
                onChangeText={
                  setPickupAddress
                }
                placeholder="Nhập điểm lấy hàng"
                placeholderTextColor={
                  COLORS.textLight
                }
                multiline
                style={[
                  styles.input,
                  styles.multilineInput,
                ]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Điểm giao *
              </Text>

              <TextInput
                value={deliveryAddress}
                onChangeText={
                  setDeliveryAddress
                }
                placeholder="Nhập điểm giao hàng"
                placeholderTextColor={
                  COLORS.textLight
                }
                multiline
                style={[
                  styles.input,
                  styles.multilineInput,
                ]}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.label}>
                Phí giao nhận đã thỏa thuận
              </Text>

              <TextInput
                value={shippingFee}
                onChangeText={(text) =>
                  setShippingFee(
                    text.replace(
                      /[^0-9]/g,
                      "",
                    ),
                  )
                }
                placeholder="0"
                placeholderTextColor={
                  COLORS.textLight
                }
                keyboardType="number-pad"
                style={styles.input}
              />

              <Text style={styles.helperText}>
                Có thể nhập 0 nếu hai bên không tính phí giao nhận.
              </Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>
              Phương thức
            </Text>

            <Text style={styles.reviewValue}>
              {methodLabel(
                deliveryMethod,
              )}
            </Text>
          </View>

          <View style={styles.reviewRow}>
            <Text style={styles.reviewLabel}>
              Phiên bản kiểm định
            </Text>

            <Text style={styles.reviewValue}>
              {inspectionForm?.revision ??
                "-"}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!canSchedule ||
              isSubmitting)
              ? styles.submitButtonDisabled
              : undefined,
          ]}
          disabled={
            !canSchedule ||
            isSubmitting
          }
          onPress={() =>
            void handleSubmit()
          }
        >
          {isSubmitting ? (
            <ActivityIndicator
              color={COLORS.white}
            />
          ) : (
            <>
              <Ionicons
                name="calendar-outline"
                size={20}
                color={COLORS.white}
              />

              <Text
                style={
                  styles.submitText
                }
              >
                Tạo lịch giao nhận
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor:
      COLORS.background,
  },

  flex: {
    flex: 1,
  },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 24,
  },

  loadingText: {
    color: COLORS.textLight,
    fontSize: 14,
  },

  content: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },

  summaryCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BAC2C1",
    backgroundColor: COLORS.white,
  },

  summaryTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },

  summaryMeta: {
    marginTop: 4,
    color: COLORS.textLight,
    fontSize: 13,
  },

  card: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BAC2C1",
    backgroundColor: COLORS.white,
  },

  subCard: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#BAC2C1",
    backgroundColor: COLORS.white,
  },

  sectionTitle: {
    marginBottom: 14,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "700",
  },

  subCardTitle: {
    marginBottom: 14,
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: "700",
  },

  fieldGroup: {
    marginBottom: 14,
  },

  label: {
    marginBottom: 7,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
  },

  input: {
    minHeight: 48,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#BAC2C1",
    borderRadius: 9,
    backgroundColor: COLORS.white,
    color: COLORS.text,
    fontSize: 14,
  },

  multilineInput: {
    minHeight: 80,
    paddingTop: 12,
    textAlignVertical: "top",
  },

  disabledInput: {
    opacity: 0.55,
  },

  helperText: {
    marginTop: 7,
    color: COLORS.textLight,
    fontSize: 12,
    lineHeight: 17,
  },

  select: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#BAC2C1",
    borderRadius: 9,
    backgroundColor: COLORS.white,
  },

  selectValue: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },

  placeholder: {
    flex: 1,
    color: COLORS.textLight,
    fontSize: 14,
  },

  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 13,
    borderRadius: 11,
    borderWidth: 1,
  },

  noticeError: {
    borderColor:
      "rgba(122, 16, 18, 0.25)",
    backgroundColor:
      "rgba(122, 16, 18, 0.06)",
  },

  noticeInfo: {
    borderColor:
      "rgba(43, 86, 89, 0.25)",
    backgroundColor:
      "rgba(43, 86, 89, 0.06)",
  },

  noticeSuccess: {
    borderColor:
      "rgba(47, 118, 93, 0.25)",
    backgroundColor:
      "rgba(47, 118, 93, 0.06)",
  },

  noticeText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
  },

  noticeTextError: {
    color: COLORS.error,
  },

  methodList: {
    gap: 10,
  },

  methodOption: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 13,
    borderWidth: 1,
    borderColor: "#BAC2C1",
    borderRadius: 10,
  },

  methodOptionActive: {
    borderColor: COLORS.primary,
    backgroundColor:
      "rgba(43, 86, 89, 0.06)",
  },

  methodText: {
    flex: 1,
    color: COLORS.textLight,
    fontSize: 14,
    fontWeight: "600",
  },

  methodTextActive: {
    color: COLORS.primary,
  },

  serviceTypeRow: {
    flexDirection: "row",
    gap: 10,
  },

  serviceTypeButton: {
    flex: 1,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#BAC2C1",
    borderRadius: 9,
  },

  serviceTypeButtonActive: {
    borderColor: COLORS.primary,
    backgroundColor:
      "rgba(43, 86, 89, 0.06)",
  },

  serviceTypeText: {
    color: COLORS.textLight,
    fontSize: 13,
    fontWeight: "600",
  },

  serviceTypeTextActive: {
    color: COLORS.primary,
  },

  noteOption: {
    minHeight: 42,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  noteText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },

  reviewRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },

  reviewLabel: {
    color: COLORS.textLight,
    fontSize: 13,
  },

  reviewValue: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "600",
    textAlign: "right",
  },

  submitButton: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    borderRadius: 11,
    backgroundColor: COLORS.primary,
  },

  submitButtonDisabled: {
    opacity: 0.55,
  },

  submitText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },

  modalBackdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor:
      "rgba(23, 40, 48, 0.48)",
  },

  modalSurface: {
    maxHeight: "78%",
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.white,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },

  modalTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },

  searchInput: {
    minHeight: 44,
    paddingHorizontal: 13,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#BAC2C1",
    borderRadius: 9,
    color: COLORS.text,
  },

  optionList: {
    maxHeight: 380,
  },

  optionRow: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor:
      "rgba(186, 194, 193, 0.55)",
  },

  optionText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
  },

  emptyText: {
    paddingVertical: 24,
    color: COLORS.textLight,
    textAlign: "center",
  },
});