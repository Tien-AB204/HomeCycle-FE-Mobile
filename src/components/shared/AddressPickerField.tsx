import { Ionicons } from "@expo/vector-icons";
import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { COLORS } from "../../constants/theme";
import { capitalizeWordInitials } from "../../utils/textFormat";

interface ProvinceOption {
  label: string;
  value: string;
}

interface WardOption {
  label: string;
  value: string;
}

export interface AddressSelection {
  provinceCode: string;
  provinceName: string;
  wardName: string;
  streetAddress: string;
  formattedAddress: string;
}

export interface AddressPickerFieldHandle {
  open: () => void;
}

interface AddressPickerFieldProps {
  value: string;

  onChange: (
    value: string,
    selection: AddressSelection,
  ) => void;

  placeholder?: string;
  disabled?: boolean;
  hasError?: boolean;
}

const getFetchErrorMessage = (
  status?: number,
) => {
  if (status && status >= 500) {
    return "Lỗi server. Không thể tải dữ liệu địa chỉ.";
  }

  return "Không thể tải dữ liệu địa chỉ. Vui lòng thử lại.";
};

const normalize = (value: string) => {
  return value
    .trim()
    .toLocaleLowerCase("vi-VN");
};

const AddressPickerField = forwardRef<
  AddressPickerFieldHandle,
  AddressPickerFieldProps
>(function AddressPickerField(
  {
    value,
    onChange,
    placeholder = "Chọn địa chỉ",
    disabled = false,
    hasError = false,
  },
  ref,
) {
  const wardInputRef =
    useRef<TextInput | null>(null);

  const streetInputRef =
    useRef<TextInput | null>(null);

  const provinceLoadAttemptedRef =
    useRef(false);

  const [visible, setVisible] =
    useState(false);

  const [provinces, setProvinces] =
    useState<ProvinceOption[]>([]);

  const [wards, setWards] =
    useState<WardOption[]>([]);

  const [provinceQuery, setProvinceQuery] =
    useState("");

  const [
    selectedProvinceCode,
    setSelectedProvinceCode,
  ] = useState("");

  const [wardQuery, setWardQuery] =
    useState("");

  const [selectedWard, setSelectedWard] =
    useState("");

  const [streetAddress, setStreetAddress] =
    useState("");

  const [
    showProvinceOptions,
    setShowProvinceOptions,
  ] = useState(false);

  const [
    showWardOptions,
    setShowWardOptions,
  ] = useState(false);

  const [
    isLoadingProvinces,
    setIsLoadingProvinces,
  ] = useState(false);

  const [
    isLoadingWards,
    setIsLoadingWards,
  ] = useState(false);

  const [loadError, setLoadError] =
    useState("");

  const [formError, setFormError] =
    useState("");

  const [
    provinceLoadRequest,
    setProvinceLoadRequest,
  ] = useState(0);

  const open = () => {
    if (disabled) {
      return;
    }

    setVisible(true);
    setFormError("");
  };

  useImperativeHandle(
    ref,
    () => ({
      open,
    }),
    [disabled],
  );

  useEffect(() => {
    if (
      !visible ||
      provinces.length > 0 ||
      isLoadingProvinces ||
      provinceLoadAttemptedRef.current
    ) {
      return;
    }

    const loadProvinces = async () => {
      try {
        provinceLoadAttemptedRef.current =
          true;

        setIsLoadingProvinces(true);
        setLoadError("");

        const response = await fetch(
          "https://34tinhthanh.com/api/provinces",
        );

        if (!response.ok) {
          throw Object.assign(
            new Error("Province API error"),
            {
              status: response.status,
            },
          );
        }

        const data = await response.json();

        const nextProvinces = Array.isArray(
          data,
        )
          ? data
              .filter(
                (item) =>
                  item?.name &&
                  item?.province_code,
              )
              .map((item) => ({
                label: String(item.name),
                value: String(
                  item.province_code,
                ),
              }))
          : [];

        setProvinces(nextProvinces);
      } catch (error: any) {
        setLoadError(
          getFetchErrorMessage(
            error?.status,
          ),
        );
      } finally {
        setIsLoadingProvinces(false);
      }
    };

    void loadProvinces();
  }, [
    visible,
    provinces.length,
    isLoadingProvinces,
    provinceLoadRequest,
  ]);

  const filteredProvinces = useMemo(() => {
    const query = normalize(provinceQuery);

    if (!query) {
      return provinces;
    }

    return provinces.filter((item) =>
      normalize(item.label).includes(query),
    );
  }, [provinceQuery, provinces]);

  const filteredWards = useMemo(() => {
    const query = normalize(wardQuery);

    if (!query) {
      return wards;
    }

    return wards.filter((item) =>
      normalize(item.label).includes(query),
    );
  }, [wardQuery, wards]);

  const selectProvince = async (
    province: ProvinceOption,
  ) => {
    setProvinceQuery(province.label);
    setSelectedProvinceCode(province.value);

    setWardQuery("");
    setSelectedWard("");
    setWards([]);

    setShowProvinceOptions(false);
    setShowWardOptions(true);
    setFormError("");

    try {
      setIsLoadingWards(true);
      setLoadError("");

      const response = await fetch(
        `https://34tinhthanh.com/api/wards?province_code=${encodeURIComponent(
          province.value,
        )}`,
      );

      if (!response.ok) {
        throw Object.assign(
          new Error("Ward API error"),
          {
            status: response.status,
          },
        );
      }

      const data = await response.json();

      const wardNames = Array.isArray(data)
        ? data
            .map(
              (item) => item?.ward_name,
            )
            .filter(
              (
                name,
              ): name is string =>
                Boolean(name),
            )
        : [];

      const uniqueWardNames = Array.from(
        new Set(wardNames),
      );

      setWards(
        uniqueWardNames.map((name) => ({
          label: name,
          value: name,
        })),
      );

      requestAnimationFrame(() => {
        wardInputRef.current?.focus();
      });
    } catch (error: any) {
      setLoadError(
        getFetchErrorMessage(
          error?.status,
        ),
      );
    } finally {
      setIsLoadingWards(false);
    }
  };

  const selectWard = (
    ward: WardOption,
  ) => {
    setWardQuery(ward.label);
    setSelectedWard(ward.value);

    setShowWardOptions(false);
    setFormError("");

    requestAnimationFrame(() => {
      streetInputRef.current?.focus();
    });
  };

  const submitProvince = () => {
    const exactMatch = provinces.find(
      (item) =>
        normalize(item.label) ===
        normalize(provinceQuery),
    );

    const candidate =
      exactMatch ??
      (filteredProvinces.length === 1
        ? filteredProvinces[0]
        : undefined);

    if (candidate) {
      void selectProvince(candidate);
      return;
    }

    setFormError(
      "Vui lòng chọn một Tỉnh/Thành từ danh sách gợi ý.",
    );
  };

  const submitWard = () => {
    const exactMatch = wards.find(
      (item) =>
        normalize(item.label) ===
        normalize(wardQuery),
    );

    const candidate =
      exactMatch ??
      (filteredWards.length === 1
        ? filteredWards[0]
        : undefined);

    if (candidate) {
      selectWard(candidate);
      return;
    }

    setFormError(
      "Vui lòng chọn một Phường/Xã từ danh sách gợi ý.",
    );
  };

  const saveAddress = () => {
    if (
      !selectedProvinceCode ||
      !provinceQuery.trim()
    ) {
      setFormError(
        "Vui lòng chọn Tỉnh/Thành từ danh sách gợi ý.",
      );
      return;
    }

    if (
      !selectedWard ||
      !wardQuery.trim()
    ) {
      setFormError(
        "Vui lòng chọn Phường/Xã từ danh sách gợi ý.",
      );
      return;
    }

    if (!streetAddress.trim()) {
      setFormError(
        "Vui lòng nhập số nhà hoặc tên đường.",
      );

      streetInputRef.current?.focus();
      return;
    }

    const normalizedStreetAddress = capitalizeWordInitials(streetAddress).trim();
    const formattedAddress = [
      normalizedStreetAddress,
      wardQuery.trim(),
      provinceQuery.trim(),
    ].join(", ");

    onChange(formattedAddress, {
      provinceCode: selectedProvinceCode,
      provinceName: provinceQuery.trim(),
      wardName: wardQuery.trim(),
      streetAddress: normalizedStreetAddress,
      formattedAddress,
    });

    setVisible(false);
    setFormError("");
  };

  const retryLoad = () => {
    const selectedProvince =
      provinces.find(
        (item) =>
          item.value ===
          selectedProvinceCode,
      );

    if (selectedProvince) {
      void selectProvince(
        selectedProvince,
      );
      return;
    }

    provinceLoadAttemptedRef.current =
      false;

    setLoadError("");

    setProvinceLoadRequest(
      (current) => current + 1,
    );
  };

  return (
    <>
      <TouchableOpacity
        style={[
          styles.trigger,
          hasError
            ? styles.triggerError
            : undefined,
          disabled
            ? styles.triggerDisabled
            : undefined,
        ]}
        onPress={open}
        disabled={disabled}
        accessibilityRole="button"
      >
        <Text
          style={
            value
              ? styles.triggerValue
              : styles.triggerPlaceholder
          }
          numberOfLines={2}
        >
          {value || placeholder}
        </Text>

        <Ionicons
          name="location-outline"
          size={21}
          color={COLORS.primary}
        />
      </TouchableOpacity>

      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() =>
          setVisible(false)
        }
      >
        <View style={styles.backdrop}>
          <View style={styles.modalCard}>
            <View
              style={styles.modalHeader}
            >
              <Text
                style={styles.modalTitle}
              >
                Nhập địa chỉ
              </Text>

              <TouchableOpacity
                style={
                  styles.closeIconButton
                }
                onPress={() =>
                  setVisible(false)
                }
              >
                <Ionicons
                  name="close"
                  size={24}
                  color={COLORS.text}
                />
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>
              Tỉnh / Thành phố *
            </Text>

            <View
              style={styles.inputShell}
            >
              <TextInput
                style={styles.input}
                value={provinceQuery}
                placeholder="Gõ hoặc chọn Tỉnh/Thành..."
                placeholderTextColor={
                  COLORS.textLight
                }
                onFocus={() =>
                  setShowProvinceOptions(
                    true,
                  )
                }
                onChangeText={(text) => {
                  setProvinceQuery(text);
                  setSelectedProvinceCode(
                    "",
                  );
                  setWardQuery("");
                  setSelectedWard("");
                  setWards([]);
                  setShowProvinceOptions(
                    true,
                  );
                  setFormError("");
                }}
                returnKeyType="next"
                onSubmitEditing={
                  submitProvince
                }
                autoCapitalize="words"
              />

              {isLoadingProvinces ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.primary}
                />
              ) : (
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={COLORS.textLight}
                />
              )}
            </View>

            {showProvinceOptions ? (
              <FlatList
                data={filteredProvinces}
                keyExtractor={(item) =>
                  item.value
                }
                style={styles.optionsList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={() =>
                      void selectProvince(
                        item,
                      )
                    }
                  >
                    <Text
                      style={
                        styles.optionText
                      }
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  !isLoadingProvinces ? (
                    <Text
                      style={
                        styles.emptyText
                      }
                    >
                      Không tìm thấy
                      Tỉnh/Thành.
                    </Text>
                  ) : null
                }
              />
            ) : null}

            <Text style={styles.label}>
              Phường / Xã *
            </Text>

            <View
              style={[
                styles.inputShell,
                !selectedProvinceCode
                  ? styles.disabledShell
                  : undefined,
              ]}
            >
              <TextInput
                ref={wardInputRef}
                style={styles.input}
                value={wardQuery}
                placeholder="Gõ hoặc chọn Phường/Xã..."
                placeholderTextColor={
                  COLORS.textLight
                }
                editable={
                  Boolean(
                    selectedProvinceCode,
                  ) && !isLoadingWards
                }
                onFocus={() =>
                  setShowWardOptions(true)
                }
                onChangeText={(text) => {
                  setWardQuery(text);
                  setSelectedWard("");
                  setShowWardOptions(true);
                  setFormError("");
                }}
                returnKeyType="next"
                onSubmitEditing={submitWard}
                autoCapitalize="words"
              />

              {isLoadingWards ? (
                <ActivityIndicator
                  size="small"
                  color={COLORS.primary}
                />
              ) : (
                <Ionicons
                  name="chevron-down"
                  size={20}
                  color={COLORS.textLight}
                />
              )}
            </View>

            {showWardOptions &&
            selectedProvinceCode ? (
              <FlatList
                data={filteredWards}
                keyExtractor={(item) =>
                  item.value
                }
                style={styles.optionsList}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={() =>
                      selectWard(item)
                    }
                  >
                    <Text
                      style={
                        styles.optionText
                      }
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  !isLoadingWards ? (
                    <Text
                      style={
                        styles.emptyText
                      }
                    >
                      Không tìm thấy
                      Phường/Xã.
                    </Text>
                  ) : null
                }
              />
            ) : null}

            <Text style={styles.label}>
              Số nhà, tên đường *
            </Text>

            <View
              style={styles.inputShell}
            >
              <TextInput
                ref={streetInputRef}
                style={styles.input}
                value={streetAddress}
                placeholder="VD: 123 Nguyễn Văn Linh"
                placeholderTextColor={
                  COLORS.textLight
                }
                onChangeText={(text) => {
                  setStreetAddress(capitalizeWordInitials(text));
                  setFormError("");
                }}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={
                  saveAddress
                }
              />
            </View>

            {loadError ? (
              <View style={styles.retryRow}>
                <Text
                  accessibilityRole="alert"
                  style={
                    styles.retryErrorText
                  }
                >
                  {loadError}
                </Text>

                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={retryLoad}
                >
                  <Text
                    style={
                      styles.retryButtonText
                    }
                  >
                    Thử lại
                  </Text>
                </TouchableOpacity>
              </View>
            ) : null}

            {formError ? (
              <Text
                accessibilityRole="alert"
                style={styles.errorText}
              >
                {formError}
              </Text>
            ) : null}

            <TouchableOpacity
              style={styles.saveButton}
              onPress={saveAddress}
            >
              <Text
                style={styles.saveButtonText}
              >
                Xác nhận địa chỉ
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
});

export default AddressPickerField;

const styles = StyleSheet.create({
  trigger: {
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 8,
    backgroundColor: COLORS.white,
  },

  triggerError: {
    borderColor: COLORS.error,
  },

  triggerDisabled: {
    opacity: 0.6,
  },

  triggerValue: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,
    lineHeight: 19,
  },

  triggerPlaceholder: {
    flex: 1,
    color: COLORS.textLight,
    fontSize: 14,
  },

  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor:
      "rgba(15, 23, 42, 0.5)",
  },

  modalCard: {
    maxHeight: "92%",
    padding: 20,
    paddingBottom: 28,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: COLORS.white,
  },

  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },

  modalTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "700",
  },

  closeIconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },

  label: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
    marginBottom: 7,
  },

  inputShell: {
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    backgroundColor: COLORS.white,
  },

  disabledShell: {
    backgroundColor: "#F1F5F9",
  },

  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 14,

    ...(Platform.OS === "web"
      ? ({
          outlineStyle: "none",
        } as any)
      : {}),
  },

  optionsList: {
    maxHeight: 150,
    marginTop: -4,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    backgroundColor: COLORS.white,
  },

  optionItem: {
    minHeight: 44,
    justifyContent: "center",
    paddingHorizontal: 14,
    borderBottomWidth:
      StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
  },

  optionText: {
    color: COLORS.text,
    fontSize: 14,
  },

  emptyText: {
    padding: 14,
    color: COLORS.textLight,
    fontSize: 13,
  },

  errorText: {
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 8,
  },

  retryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 8,
  },

  retryErrorText: {
    flex: 1,
    color: COLORS.error,
    fontSize: 12,
    lineHeight: 17,
  },

  retryButton: {
    minHeight: 34,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
  },

  retryButtonText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "700",
  },

  saveButton: {
    minHeight: 50,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
  },

  saveButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: "700",
  },
});