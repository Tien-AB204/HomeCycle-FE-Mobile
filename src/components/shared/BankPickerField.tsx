import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";

import { COLORS } from "../../constants/theme";
import { NETWORK_ERROR_MESSAGE } from "../../utils/errorMessage";
import { ModalBackdrop, ModalSurface } from "./ModalBackdrop";

export type BankOption = {
  id: number;
  name: string;
  code: string;
  bin: string;
  shortName: string;
  logo: string;
};

type Props = {
  bankBin?: string;
  bankName?: string;
  onChange: (bank: BankOption) => void;
  onClear?: () => void;
  disabled?: boolean;
  hasError?: boolean;
  placeholder?: string;
  style?: StyleProp<ViewStyle>;
};

export default function BankPickerField({
  bankBin = "",
  bankName = "",
  onChange,
  onClear,
  disabled = false,
  hasError = false,
  placeholder = "Chọn ngân hàng",
  style,
}: Props) {
  const [banks, setBanks] = useState<BankOption[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    let mounted = true;

    const fetchBanks = async () => {
      try {
        setIsLoading(true);
        setLoadError("");

        const response = await fetch("https://api.vietqr.io/v2/banks");
        if (!response.ok) throw new Error();

        const payload = await response.json();
        if (payload?.code !== "00" || !Array.isArray(payload?.data)) {
          throw new Error();
        }

        if (mounted) {
          setBanks(payload.data);
        }
      } catch {
        if (mounted) {
          setLoadError(NETWORK_ERROR_MESSAGE);
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchBanks();

    return () => {
      mounted = false;
    };
  }, []);

  const selectedBank = useMemo(() => {
    const normalizedBin = String(bankBin || "").trim().toLowerCase();
    const normalizedName = String(bankName || "").trim().toLowerCase();

    return banks.find((bank) => {
      return (
        String(bank.bin).toLowerCase() === normalizedBin ||
        bank.code.toLowerCase() === normalizedBin ||
        bank.shortName.toLowerCase() === normalizedName ||
        bank.name.toLowerCase() === normalizedName
      );
    });
  }, [bankBin, bankName, banks]);

  useEffect(() => {
    if (!selectedBank) return;

    const selectedBin = String(selectedBank.bin);
    if (String(bankBin) === selectedBin) return;

    onChange(selectedBank);
  }, [bankBin, onChange, selectedBank]);

  const filteredBanks = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();
    if (!keyword) return banks;

    return banks.filter((bank) =>
      [bank.shortName, bank.name, bank.code, bank.bin]
        .map((value) => String(value).toLowerCase())
        .some((value) => value.includes(keyword)),
    );
  }, [banks, searchQuery]);

  const displayName =
    selectedBank?.shortName ||
    selectedBank?.name ||
    bankName ||
    "";

  const displayCode = selectedBank?.code || "";

  const openPicker = () => {
    if (disabled) return;
    setSearchQuery("");
    setIsOpen(true);
  };

  const clearBank = () => {
    if (disabled || !onClear) return;
    setSearchQuery("");
    onClear();
  };

  return (
    <>
      <View
        style={[
          styles.trigger,
          hasError ? styles.triggerError : undefined,
          disabled ? styles.disabled : undefined,
          style,
        ]}
      >
        <TouchableOpacity
          style={styles.selection}
          onPress={openPicker}
          disabled={disabled}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel="Chọn ngân hàng"
        >
          {displayName ? (
            <View style={styles.selectedRow}>
              {selectedBank?.logo ? (
                <Image
                  source={{ uri: selectedBank.logo }}
                  style={styles.logo}
                  resizeMode="contain"
                />
              ) : null}

              <Text style={styles.selectedText} numberOfLines={1}>
                {displayName}
                {displayCode ? ` (${displayCode})` : ""}
              </Text>
            </View>
          ) : (
            <Text style={styles.placeholder} numberOfLines={1}>
              {placeholder}
            </Text>
          )}
        </TouchableOpacity>

        <View style={styles.actions}>
          {displayName && onClear ? (
            <TouchableOpacity
              style={styles.actionButton}
              onPress={clearBank}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityLabel="Xóa ngân hàng đã chọn"
              hitSlop={8}
            >
              <Ionicons
                name="close-circle"
                size={21}
                color={hasError ? COLORS.error : COLORS.textLight}
              />
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            style={styles.actionButton}
            onPress={openPicker}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Mở danh sách ngân hàng"
            hitSlop={8}
          >
            <Ionicons
              name="chevron-down"
              size={20}
              color={hasError ? COLORS.error : COLORS.textLight}
            />
          </TouchableOpacity>
        </View>
      </View>

      <Modal
        visible={isOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setIsOpen(false)}
      >
        <ModalBackdrop style={styles.overlay} onPress={() => setIsOpen(false)}>
          <ModalSurface style={styles.sheet}>
            <View style={styles.header}>
              <Text style={styles.title}>Chọn ngân hàng</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setIsOpen(false)}
              >
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.searchBox}>
              <Ionicons name="search" size={20} color={COLORS.textLight} />
              <TextInput
                style={styles.searchInput}
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Tìm tên hoặc mã ngân hàng..."
                placeholderTextColor={COLORS.textLight}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

            {isLoading ? (
              <View style={styles.centered}>
                <ActivityIndicator color={COLORS.primary} />
                <Text style={styles.helperText}>
                  Đang tải danh sách ngân hàng...
                </Text>
              </View>
            ) : loadError ? (
              <View style={styles.centered}>
                <Text style={styles.errorText}>{loadError}</Text>
              </View>
            ) : (
              <FlatList
                data={filteredBanks}
                keyExtractor={(item) => String(item.id || item.bin)}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.bankRow}
                    onPress={() => {
                      onChange(item);
                      setSearchQuery("");
                      setIsOpen(false);
                    }}
                  >
                    <Image
                      source={{ uri: item.logo }}
                      style={styles.bankLogo}
                      resizeMode="contain"
                    />
                    <View style={styles.bankInfo}>
                      <Text style={styles.bankShortName}>
                        {item.shortName}
                      </Text>
                      <Text style={styles.bankName} numberOfLines={1}>
                        {item.name}
                      </Text>
                    </View>
                    <Text style={styles.bankCode}>{item.code}</Text>
                  </TouchableOpacity>
                )}
                ListEmptyComponent={
                  <View style={styles.centered}>
                    <Text style={styles.helperText}>
                      Không tìm thấy ngân hàng phù hợp.
                    </Text>
                  </View>
                }
              />
            )}
          </ModalSurface>
        </ModalBackdrop>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: "100%",
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.white,
  },
  triggerError: {
    borderColor: COLORS.error,
  },
  disabled: {
    opacity: 0.6,
  },
  selection: {
    flex: 1,
    minWidth: 0,
    minHeight: 52,
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 14,
    paddingRight: 6,
  },
  selectedRow: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
  },
  logo: {
    width: 28,
    height: 28,
    marginRight: 10,
  },
  selectedText: {
    flex: 1,
    minWidth: 0,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "600",
  },
  placeholder: {
    flex: 1,
    minWidth: 0,
    color: COLORS.textLight,
    fontSize: 15,
  },
  actions: {
    flexShrink: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingRight: 6,
  },
  actionButton: {
    width: 34,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0, 0, 0, 0.35)",
  },
  sheet: {
    maxHeight: "78%",
    minHeight: "55%",
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: COLORS.white,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "700",
  },
  closeButton: {
    padding: 4,
  },
  searchBox: {
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
    backgroundColor: COLORS.background,
  },
  searchInput: {
    flex: 1,
    color: COLORS.text,
    fontSize: 15,
    paddingVertical: 0,
  },
  centered: {
    paddingVertical: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  helperText: {
    marginTop: 8,
    color: COLORS.textLight,
    fontSize: 13,
    textAlign: "center",
  },
  errorText: {
    color: COLORS.error,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
  },
  bankRow: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.border,
    paddingVertical: 10,
  },
  bankLogo: {
    width: 38,
    height: 38,
    marginRight: 12,
  },
  bankInfo: {
    flex: 1,
  },
  bankShortName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },
  bankName: {
    marginTop: 2,
    color: COLORS.textLight,
    fontSize: 12,
  },
  bankCode: {
    marginLeft: 10,
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: "600",
  },
});
