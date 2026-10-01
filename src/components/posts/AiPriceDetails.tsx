import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { Linking, Modal, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS } from "../../constants/theme";
import { ModalBackdrop, ModalSurface } from "../shared/ModalBackdrop";

export type AiPriceEvidence = {
  completedTradeSamples?: number;
  internalListingSamples?: number;
  externalListingSamples?: number;
  equivalentCompletedTradeSamples?: number;
  equivalentInternalListingSamples?: number;
  equivalentExternalListingSamples?: number;
  newMarketPriceSamples?: number;
};

export type AiPriceSource = {
  sourceType?: string;
  sourceName?: string;
  sourceUrl?: string;
  trustLevel?: string | null;
  usedInCalculation?: boolean;
};

// Cách tính BE trả về (không có thì phần này tự ẩn). method: USED_MARKET = từ giá máy cũ cùng model;
// BLENDED = kết hợp giá máy cũ và giá mới đã khấu hao; NEW_PRICE_DEPRECIATION = từ giá mới trừ khấu hao.
export type AiPriceBreakdown = {
  method?: string;
  basePrice?: number;
  baseLabel?: string;
  adjustments?: { label?: string; percent?: number; amount?: number }[];
  finalPrice?: number;
  newPriceReference?: number | null;
};

type Props = {
  explanation?: string;
  evidence?: AiPriceEvidence;
  sources?: AiPriceSource[];
  breakdown?: AiPriceBreakdown | null;
};

const formatVnd = (value: number) => `${Math.round(value).toLocaleString("vi-VN")} đ`;

const SOURCE_TYPE_LABELS: Record<string, string> = {
  EXTERNAL_USED_LISTING: "Tin rao đồ cũ",
  EXTERNAL_EQUIVALENT_LISTING: "Model tương đương",
  NEW_MARKET_REFERENCE: "Giá bán mới",
};

const toCount = (value: unknown) => {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? count : 0;
};

const isNewPriceSource = (source: AiPriceSource) =>
  String(source.sourceType || "").toUpperCase() === "NEW_MARKET_REFERENCE";

// BE mới trả usedInCalculation cho từng nguồn; BE cũ thì không.
const hasUsageFlags = (sources?: AiPriceSource[]) =>
  (sources || []).some((source) => typeof source?.usedInCalculation === "boolean");

const countWebListingsUsed = (sources?: AiPriceSource[]) =>
  (sources || []).filter((source) => source?.usedInCalculation === true && !isNewPriceSource(source)).length;

const countInternalSamples = (evidence?: AiPriceEvidence) =>
  toCount(evidence?.completedTradeSamples) +
  toCount(evidence?.internalListingSamples) +
  toCount(evidence?.equivalentCompletedTradeSamples) +
  toCount(evidence?.equivalentInternalListingSamples);

const countWebListingsFound = (evidence?: AiPriceEvidence) =>
  toCount(evidence?.externalListingSamples) + toCount(evidence?.equivalentExternalListingSamples);

// Số mẫu giá máy cũ thực sự dùng để tính (không đếm tin bị loại hoặc chỉ để tham khảo).
export const countAiPriceSamples = (evidence?: AiPriceEvidence, sources?: AiPriceSource[]) =>
  countInternalSamples(evidence) +
  (hasUsageFlags(sources) ? countWebListingsUsed(sources) : countWebListingsFound(evidence));

const formatPercent = (value: number) =>
  `${Math.abs(value).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;

const isOpenableUrl = (url?: string) => /^https?:\/\//i.test(String(url || "").trim());

// Trên form chỉ hiện nút "Xem cách tính"; cách tính, giải thích và nguồn nằm trong modal.
export default function AiPriceDetails({ explanation, evidence, sources, breakdown }: Props) {
  const insets = useSafeAreaInsets();
  const [isOpen, setIsOpen] = useState(false);
  const close = () => setIsOpen(false);

  const basePrice = Number(breakdown?.basePrice);
  const hasBreakdown = Number.isFinite(basePrice) && basePrice > 0;
  const adjustments = (breakdown?.adjustments || []).filter((item) => item?.label);
  const finalPrice = Number(breakdown?.finalPrice);
  const newPriceReference = Number(breakdown?.newPriceReference);

  const withUsageFlags = hasUsageFlags(sources);
  const webFound = countWebListingsFound(evidence);
  const sampleGroups = [
    { label: "Giao dịch trên HomeCycle", value: toCount(evidence?.completedTradeSamples) + toCount(evidence?.equivalentCompletedTradeSamples) },
    { label: "Tin đang bán trên HomeCycle", value: toCount(evidence?.internalListingSamples) + toCount(evidence?.equivalentInternalListingSamples) },
    { label: "Tin rao trên mạng", value: webFound },
  ]
    .filter((group) => group.value > 0)
    .map((group) => ({
      label: group.label,
      text: group.label === "Tin rao trên mạng" && withUsageFlags
        ? `${countWebListingsUsed(sources)} dùng để tính / ${webFound} tìm thấy`
        : String(group.value),
    }));
  const visibleSources = (sources || []).filter((source) => source?.sourceName || isOpenableUrl(source?.sourceUrl));
  // BE mới: tách nguồn dùng để tính (hiện đủ) và nguồn chỉ tham khảo (tối đa 5). BE cũ: một danh sách.
  const usedSources = withUsageFlags ? visibleSources.filter((source) => source.usedInCalculation === true) : [];
  const otherSources = withUsageFlags
    ? visibleSources.filter((source) => source.usedInCalculation !== true).slice(0, 5)
    : visibleSources.slice(0, 5);

  const renderSource = (source: AiPriceSource, index: number) => {
    const canOpen = isOpenableUrl(source.sourceUrl);
    const typeLabel = source.trustLevel || SOURCE_TYPE_LABELS[String(source.sourceType || "").toUpperCase()];
    const name = source.sourceName || "Nguồn tham khảo";
    return (
      <TouchableOpacity
        key={`${source.sourceUrl || name}-${index}`}
        disabled={!canOpen}
        onPress={() => void Linking.openURL(String(source.sourceUrl).trim()).catch(() => undefined)}
        style={styles.sourceRow}
      >
        <Text style={[styles.item, canOpen && styles.link]} numberOfLines={1}>
          • {name}{typeLabel ? ` · ${typeLabel}` : ""}
        </Text>
        {canOpen ? <Ionicons name="open-outline" size={12} color={COLORS.primary} /> : null}
      </TouchableOpacity>
    );
  };

  const hasDetails = hasBreakdown || Boolean(explanation?.trim()) || sampleGroups.length > 0 || visibleSources.length > 0;
  if (!hasDetails) return null;

  return (
    <>
      <TouchableOpacity style={styles.toggle} onPress={() => setIsOpen(true)} accessibilityRole="button">
        <Text style={styles.toggleText}>Xem cách tính</Text>
        <Ionicons name="chevron-forward" size={14} color={COLORS.primary} />
      </TouchableOpacity>

      <Modal visible={isOpen} animationType="slide" transparent onRequestClose={close}>
        <ModalBackdrop style={styles.overlay} onPress={close}>
          <ModalSurface style={[styles.sheet, { marginTop: insets.top + 24 }]}>
            <View style={styles.header}>
              <Text style={styles.title}>Cách tính giá gợi ý</Text>
              <TouchableOpacity onPress={close} accessibilityLabel="Đóng">
                <Ionicons name="close" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator>
              {hasBreakdown ? (
                <View style={styles.block}>
                  <View style={styles.line}>
                    <Text style={styles.lineLabel}>
                      {breakdown?.baseLabel ||
                        (breakdown?.method === "NEW_PRICE_DEPRECIATION" ? "Giá bán mới" : "Giá máy cũ cùng model")}
                    </Text>
                    <Text style={styles.lineValue}>{formatVnd(basePrice)}</Text>
                  </View>
                  {adjustments.map((item, index) => {
                    const percent = Number(item.percent);
                    const amount = Number(item.amount);
                    const value = Number.isFinite(percent) && percent !== 0
                      ? `${percent > 0 ? "+" : "−"}${formatPercent(percent)}`
                      : Number.isFinite(amount) && amount !== 0
                        ? `${amount > 0 ? "+" : "−"}${formatVnd(Math.abs(amount))}`
                        : "0%";
                    return (
                      <View key={`${item.label}-${index}`} style={styles.line}>
                        <Text style={styles.lineLabel}>{item.label}</Text>
                        <Text style={styles.lineAdjust}>{value}</Text>
                      </View>
                    );
                  })}
                  {Number.isFinite(finalPrice) && finalPrice > 0 ? (
                    <View style={[styles.line, styles.totalLine]}>
                      <Text style={styles.totalLabel}>Giá gợi ý</Text>
                      <Text style={styles.totalValue}>{formatVnd(finalPrice)}</Text>
                    </View>
                  ) : null}
                  {Number.isFinite(newPriceReference) && newPriceReference > 0 && breakdown?.method !== "NEW_PRICE_DEPRECIATION" ? (
                    <Text style={styles.note}>Giá bán mới tham khảo: {formatVnd(newPriceReference)}</Text>
                  ) : null}
                </View>
              ) : null}

              {explanation?.trim() ? <Text style={styles.explanation}>{explanation.trim()}</Text> : null}

              {sampleGroups.length > 0 ? (
                <View style={styles.block}>
                  <Text style={styles.heading}>Dữ liệu tham khảo</Text>
                  {sampleGroups.map((group) => (
                    <Text key={group.label} style={styles.item}>• {group.label}: {group.text}</Text>
                  ))}
                </View>
              ) : null}

              {usedSources.length > 0 ? (
                <View style={styles.block}>
                  <Text style={styles.heading}>Nguồn dùng để tính</Text>
                  {usedSources.map(renderSource)}
                </View>
              ) : null}

              {otherSources.length > 0 ? (
                <View style={styles.block}>
                  <Text style={styles.heading}>{withUsageFlags ? "Nguồn tham khảo, không dùng để tính" : "Nguồn"}</Text>
                  {otherSources.map(renderSource)}
                </View>
              ) : null}
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: Platform.OS === "android" ? 16 : Math.max(insets.bottom, 16) }]}>
              <TouchableOpacity style={styles.closeButton} onPress={close}>
                <Text style={styles.closeButtonText}>Đóng</Text>
              </TouchableOpacity>
            </View>
          </ModalSurface>
        </ModalBackdrop>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  toggle: { flexDirection: "row", alignItems: "center", gap: 2, alignSelf: "flex-start", marginTop: 8, paddingVertical: 2 },
  toggleText: { color: COLORS.primary, fontSize: 12, fontWeight: "700" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "80%", overflow: "hidden" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  title: { fontSize: 18, fontWeight: "bold", color: COLORS.text },
  body: { padding: 20, gap: 16 },
  block: { gap: 6 },
  line: { flexDirection: "row", justifyContent: "space-between", gap: 12 },
  lineLabel: { flex: 1, color: COLORS.text, fontSize: 14, lineHeight: 20 },
  lineValue: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  lineAdjust: { color: COLORS.textLight, fontSize: 14, fontWeight: "700" },
  totalLine: { marginTop: 4, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.border },
  totalLabel: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: "700" },
  totalValue: { color: COLORS.primary, fontSize: 15, fontWeight: "800" },
  note: { color: COLORS.textLight, fontSize: 12, marginTop: 2 },
  explanation: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  heading: { color: COLORS.textLight, fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  item: { color: COLORS.text, fontSize: 14, lineHeight: 20 },
  link: { color: COLORS.primary, flexShrink: 1 },
  sourceRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  footer: { paddingHorizontal: 20, paddingTop: 12, borderTopWidth: 1, borderTopColor: COLORS.border },
  closeButton: { minHeight: 46, borderRadius: 12, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  closeButtonText: { color: COLORS.white, fontSize: 15, fontWeight: "700" },
});
