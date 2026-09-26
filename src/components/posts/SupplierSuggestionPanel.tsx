import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../../constants/theme";
import { useOptionalSubscription } from "../../contexts/SubscriptionContext";
import {
  MatchState,
  SupplierMatchAdvancedFilters,
  SupplierMatchItem,
  SupplierMatchResponse,
  SupplierMatchValidationErrors,
  readSupplierMatchValidationErrors,
} from "../../services/apis/supplierMatchApi";
import { devLog } from "../../utils/devLog";
import { isSafeUserMessage, readSafeApiMessage, SERVER_ERROR_MESSAGE, NETWORK_ERROR_MESSAGE } from "../../utils/errorMessage";
import { useGuardedRouter } from "../../utils/tapGuard";
import { useAutoDismissFeedback } from "../../utils/useAutoDismissFeedback";
import { localizeSystemText } from "../../utils/localizeSystemText";

/**
 * Gợi ý nhà cung cấp phù hợp — MỘT panel dùng chung cho gói dùng thử và gói VIP.
 * Quyền, giới hạn kết quả, hạn mức AI và việc áp dụng bộ lọc nâng cao đều đọc từ
 * phản hồi Backend (tier / resultLimit / remainingAiRefreshes / resetsAt /
 * advancedFiltersApplied). Không tự tăng/giảm hạn mức, không tính lại điểm.
 */

export type SupplierSuggestionReadiness = {
  ready: boolean;
  // Lý do chưa thể gợi ý (thiếu dữ liệu form); hiển thị dưới nút.
  hint: string | null;
};

export type SupplierSuggestionRequestOutcome =
  | { kind: "validation"; message: string; errors: SupplierMatchValidationErrors }
  | { kind: "forbidden"; message?: string }
  | { kind: "unavailable"; message?: string }
  | { kind: "retryable"; message: string };

type Props = {
  mode: "draft" | "buy-post";
  readiness: SupplierSuggestionReadiness;
  // Thay đổi khi nhu cầu (form) đổi: kết quả cũ vẫn hiển thị nhưng được đánh dấu cần gợi ý lại.
  contextKey?: string;
  // AttributeId → tên thuộc tính (từ metadata form hoặc chi tiết tin). Không hiển thị GUID.
  attributeNames?: Record<string, string>;
  onRequest: (filters: SupplierMatchAdvancedFilters | null) => Promise<SupplierMatchResponse>;
  // Lỗi 400 draft: form ánh xạ về ô nhập liên quan nếu có.
  onValidationErrors?: (errors: SupplierMatchValidationErrors) => void;
  // 404: tin thu mua không còn khả dụng — màn hình cha làm mới nếu phù hợp.
  onPostUnavailable?: () => void;
  disabled?: boolean;
};

const DEFAULT_FILTERS: SupplierMatchAdvancedFilters = {
  requireFullQuantity: false,
  strictBudget: false,
  strictBrand: false,
  sameCityOnly: false,
  minimumSellerRating: null,
};

const REASON_LABELS: Record<string, string> = {
  EXACT_MODEL: "Đúng model",
  MODEL_VARIANT: "Model cùng biến thể",
  RELATED_MODEL: "Model liên quan",
  WITHIN_BUDGET: "Trong ngân sách",
  FULL_QUANTITY_AVAILABLE: "Đủ số lượng",
  PARTIAL_QUANTITY_AVAILABLE: "Chỉ đáp ứng một phần số lượng",
  REPUTABLE_SUPPLIER: "Người bán uy tín",
};

const MATCH_STATE_LABELS: Record<MatchState, string> = {
  Matched: "Phù hợp",
  NotMatched: "Chưa phù hợp",
  Unknown: "Chưa có thông tin",
  NotSpecified: "Người mua không yêu cầu",
};

const CRITERIA: { key: keyof Omit<SupplierMatchItem["matchSummary"], "attributes" | "matchedCriteriaCount" | "evaluatedCriteriaCount">; label: string }[] = [
  { key: "category", label: "Danh mục" },
  { key: "productType", label: "Loại sản phẩm" },
  { key: "brand", label: "Thương hiệu" },
  { key: "functionality", label: "Tình trạng hoạt động" },
  { key: "usageDuration", label: "Thời gian sử dụng" },
  { key: "damageLevel", label: "Mức hư hại" },
  { key: "price", label: "Giá" },
  { key: "city", label: "Thành phố" },
];

// Ngưỡng hiển thị (điểm 0–10 do Backend trả về, không tính lại).
export const describeMatchScore = (score: number): string => {
  if (score >= 8) return "Phù hợp cao";
  if (score >= 6) return "Phù hợp trung bình";
  if (score >= 4) return "Phù hợp cơ bản";
  return "Phù hợp thấp";
};

const formatScore = (score: number) => {
  const rounded = Math.round(score * 10) / 10;
  return `${rounded.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}/10`;
};

const formatPrice = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? `${value.toLocaleString("vi-VN")} ₫` : "Giá thương lượng";

const formatResetTime = (iso: string | null) => {
  if (!iso) return null;
  const time = new Date(iso);
  if (Number.isNaN(time.getTime())) return null;
  return time.toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });
};

// FALLBACK: Backend vẫn trả kết quả cơ bản; KHÔNG nói với người dùng về sự cố AI —
// hiển thị như kết quả hệ thống bình thường (không cảnh báo, không lộ nhà cung cấp AI).
export const describeAiStatus = (response: SupplierMatchResponse): string | null => {
  const { rankingSource, aiStatus } = response;
  if (rankingSource === "AI_RERANKED" && aiStatus === "AVAILABLE") return null;
  switch (aiStatus) {
    case "NOT_REQUIRED":
    case "FALLBACK":
      return "Kết quả phù hợp từ hệ thống";
    case "DAILY_LIMIT_REACHED": {
      const reset = formatResetTime(response.resetsAt);
      return `Đã hết lượt AI hôm nay, vẫn hiển thị kết quả cơ bản${reset ? ` · Làm mới lúc ${reset}` : ""}`;
    }
    case "NOT_ELIGIBLE":
      return "Kết quả cơ bản";
    default:
      return "Kết quả phù hợp từ hệ thống";
  }
};

export const describeQuota = (response: SupplierMatchResponse): string =>
  response.tier === "FREE"
    ? `Dùng thử miễn phí · Còn ${response.remainingAiRefreshes} lượt hôm nay`
    : `Còn ${response.remainingAiRefreshes} lượt gợi ý thông minh hôm nay`;

// Phân loại lỗi HTTP thành trạng thái panel; không lộ mã HTTP / mã lỗi nội bộ.
// Thông điệp BE (nguyên văn) luôn được ưu tiên; chữ FE chỉ là dự phòng.
export const classifySupplierMatchError = (error: unknown, mode: Props["mode"]): SupplierSuggestionRequestOutcome => {
  const status = Number((error as any)?.response?.status || 0);
  const data =
    (error as any)?.response?.data ??
    ((error as any)?.isSuccess === false ? error : undefined);
  const backendMessage = readSafeApiMessage(data) ?? undefined;
  if (status === 400) {
    const errors = readSupplierMatchValidationErrors(error);
    // Lỗi theo trường đã hiển thị riêng ở phần chi tiết; không lặp lại ở dòng chính.
    const summaryMessage = Object.keys(errors).length
      ? readSafeApiMessage({ ...data, errors: undefined })
      : backendMessage;
    return {
      kind: "validation",
      message: summaryMessage ?? "Thông tin nhu cầu mua chưa đủ hoặc chưa hợp lệ để tìm nhà cung cấp.",
      errors,
    };
  }
  if (status === 403) return { kind: "forbidden", message: backendMessage };
  if (status === 404) return { kind: "unavailable", message: backendMessage };
  if (status === 401) return { kind: "retryable", message: backendMessage ?? "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại." };
  if (status >= 500) return { kind: "retryable", message: backendMessage ?? SERVER_ERROR_MESSAGE };
  if (status === 0) return { kind: "retryable", message: backendMessage ?? NETWORK_ERROR_MESSAGE };
  if (mode === "buy-post" && status === 409) {
    return { kind: "retryable", message: backendMessage ?? "Tin thu mua hiện không thể gợi ý nhà cung cấp." };
  }
  return { kind: "retryable", message: backendMessage ?? "Không thể gợi ý nhà cung cấp lúc này. Vui lòng thử lại." };
};

const FIELD_LABELS: { test: RegExp; label: string }[] = [
  { test: /^quantity$/i, label: "Số lượng" },
  { test: /^price(from|to)?$/i, label: "Khoảng giá" },
  { test: /^(producttypeid|categoryid)$/i, label: "Loại sản phẩm" },
  { test: /^brandid$/i, label: "Thương hiệu" },
  { test: /^modelnumber$/i, label: "Mã model" },
  { test: /^city$/i, label: "Thành phố" },
  { test: /^attributevalues/i, label: "Thông số sản phẩm" },
  { test: /^advancedfilters/i, label: "Bộ lọc nâng cao" },
];

const describeFieldErrors = (errors: SupplierMatchValidationErrors): string[] => {
  const lines: string[] = [];
  for (const [key, messages] of Object.entries(errors)) {
    const label = FIELD_LABELS.find((item) => item.test.test(key))?.label;
    for (const message of messages) {
      if (!isSafeUserMessage(message)) continue;
      const text = message.trim();
      lines.push(label ? `${label}: ${text}` : text);
    }
  }
  return Array.from(new Set(lines)).slice(0, 6);
};

type PanelState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; response: SupplierMatchResponse; contextKey: string; filtersSent: boolean }
  // persistent: lỗi kiểm tra dữ liệu (giữ tới khi người dùng sửa và gợi ý lại);
  // các lỗi chung khác tự ẩn sau ~10 giây theo quy ước phản hồi toàn ứng dụng.
  | { status: "error"; message: string; retryable: boolean; persistent: boolean; details?: string[] };

export default function SupplierSuggestionPanel({
  mode,
  readiness,
  contextKey = "",
  attributeNames,
  onRequest,
  onValidationErrors,
  onPostUnavailable,
  disabled = false,
}: Props) {
  const router = useGuardedRouter();
  const [state, setState] = useState<PanelState>({ status: "idle" });
  // Gói đăng ký đổi (VIP → Free hoặc ngược lại): kết quả/khóa bộ lọc cũ không còn
  // đại diện cho quyền hiện tại → về trạng thái ban đầu; lần gọi sau tuân theo Backend.
  const subscription = useOptionalSubscription();
  const entitlementVersion = subscription?.entitlementVersion ?? 0;
  const seenEntitlementVersionRef = useRef(entitlementVersion);
  useEffect(() => {
    if (seenEntitlementVersionRef.current === entitlementVersion) return;
    seenEntitlementVersionRef.current = entitlementVersion;
    setState({ status: "idle" });
    setExpandedPostId(null);
  }, [entitlementVersion]);
  const [filters, setFilters] = useState<SupplierMatchAdvancedFilters>(DEFAULT_FILTERS);
  const [ratingText, setRatingText] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: "info" | "error"; text: string } | null>(null);
  useAutoDismissFeedback(notice, () => setNotice(null));
  const generalError = useMemo(
    () => (state.status === "error" && !state.persistent ? { type: "error" as const } : null),
    [state],
  );
  useAutoDismissFeedback(generalError, () => setState((current) => (current.status === "error" && !current.persistent ? { status: "idle" } : current)));
  const inFlightRef = useRef(false);

  const lastResponse = state.status === "ready" ? state.response : null;
  const isLoading = state.status === "loading";
  const isStale = state.status === "ready" && state.contextKey !== contextKey;

  // Backend là nguồn có thẩm quyền: gói FREE của Backend không bật bộ lọc nâng cao;
  // trước request dùng effective benefits; sau response, chính response của lần
  // matching đó quyết định trạng thái bộ lọc/result set.
  const advancedLocked = lastResponse
    ? lastResponse.tier === "FREE" || (state.status === "ready" && state.filtersSent && !lastResponse.advancedFiltersApplied)
    : subscription?.benefits?.supplierMatching?.advancedFiltersEnabled === false;

  const hasActiveFilters =
    filters.requireFullQuantity ||
    filters.strictBudget ||
    filters.strictBrand ||
    filters.sameCityOnly ||
    filters.minimumSellerRating !== null;

  const ratingError = useMemo(() => {
    const text = ratingText.trim();
    if (!text) return "";
    const value = Number(text.replace(",", "."));
    if (!Number.isFinite(value) || value < 0 || value > 5) return "Điểm người bán tối thiểu phải từ 0 đến 5.";
    return "";
  }, [ratingText]);

  const request = useCallback(async () => {
    if (inFlightRef.current || disabled) return;
    if (!readiness.ready) {
      if (readiness.hint) setNotice({ type: "error", text: readiness.hint });
      return;
    }
    if (ratingError) {
      setNotice({ type: "error", text: ratingError });
      return;
    }
    const sendFilters = !advancedLocked && hasActiveFilters;
    const payload: SupplierMatchAdvancedFilters | null = sendFilters ? { ...filters } : null;
    inFlightRef.current = true;
    setState({ status: "loading" });
    setNotice(null);
    const requestContextKey = contextKey;
    try {
      const response = await onRequest(payload);
      setState({ status: "ready", response, contextKey: requestContextKey, filtersSent: Boolean(payload) });
      setExpandedPostId(null);
      if (payload && !response.advancedFiltersApplied) {
        setNotice({ type: "info", text: "Gói hiện tại chưa hỗ trợ bộ lọc nâng cao. Kết quả bên dưới chưa áp dụng bộ lọc." });
      }
    } catch (error) {
      const outcome = classifySupplierMatchError(error, mode);
      if (outcome.kind === "validation") {
        onValidationErrors?.(outcome.errors);
        setState({ status: "error", message: outcome.message, retryable: false, persistent: true, details: describeFieldErrors(outcome.errors) });
      } else if (outcome.kind === "forbidden") {
        setState({
          status: "error",
          retryable: false,
          persistent: false,
          message:
            outcome.message ??
            (mode === "buy-post"
              ? "Bạn không có quyền xem gợi ý nhà cung cấp cho tin thu mua này."
              : "Tính năng gợi ý nhà cung cấp chỉ dành cho tài khoản Doanh nghiệp."),
        });
      } else if (outcome.kind === "unavailable") {
        setState({
          status: "error",
          retryable: false,
          persistent: false,
          message:
            outcome.message ??
            (mode === "buy-post"
              ? "Tin thu mua này hiện không còn khả dụng để gợi ý nhà cung cấp."
              : "Không tìm thấy dữ liệu để gợi ý nhà cung cấp."),
        });
        onPostUnavailable?.();
      } else if (outcome.kind === "retryable") {
        devLog("[supplier-match] request failed:", error);
        setState({ status: "error", message: outcome.message, retryable: true, persistent: false });
      }
    } finally {
      inFlightRef.current = false;
    }
  }, [advancedLocked, contextKey, disabled, filters, hasActiveFilters, mode, onPostUnavailable, onRequest, onValidationErrors, ratingError, readiness]);

  const openSellPost = useCallback(
    (postId: string) => {
      router.push(`/posts/${postId}`);
    },
    [router],
  );

  const updateRating = (text: string) => {
    const cleaned = text.replace(/[^0-9.,]/g, "");
    setRatingText(cleaned);
    const value = Number(cleaned.replace(",", "."));
    setFilters((current) => ({
      ...current,
      minimumSellerRating: cleaned.trim() && Number.isFinite(value) ? value : null,
    }));
  };

  const buttonDisabled = disabled || isLoading || !readiness.ready;
  const buttonLabel = isLoading
    ? "Đang tìm nhà cung cấp..."
    : lastResponse
      ? isStale
        ? "Gợi ý lại theo nhu cầu mới"
        : "Gợi ý lại"
      : "Gợi ý nhà cung cấp phù hợp";

  const visibleMatches = lastResponse ? lastResponse.matches.slice(0, lastResponse.resultLimit) : [];
  const aiStatusMessage = lastResponse ? describeAiStatus(lastResponse) : null;

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Ionicons name="people-outline" size={18} color={COLORS.primary} />
        <Text style={styles.title}>Gợi ý nhà cung cấp phù hợp</Text>
      </View>
      <Text style={styles.subtitle}>
        {mode === "draft"
          ? "Tìm các bài bán đang phù hợp với nhu cầu bạn đang nhập. Việc gợi ý không tạo tin thu mua."
          : "Tìm các bài bán đang phù hợp với tin thu mua này."}
      </Text>

      <TouchableOpacity
        style={[styles.filterToggle, advancedLocked && styles.filterToggleLocked]}
        onPress={() => setShowFilters((current) => !current)}
        accessibilityRole="button"
      >
        <Ionicons name={advancedLocked ? "lock-closed-outline" : "options-outline"} size={16} color={COLORS.primary} />
        <Text style={styles.filterToggleText}>Bộ lọc nâng cao</Text>
        {hasActiveFilters && !advancedLocked ? <View style={styles.filterDot} /> : null}
        <Ionicons name={showFilters ? "chevron-up" : "chevron-down"} size={16} color={COLORS.textLight} style={{ marginLeft: "auto" }} />
      </TouchableOpacity>
      {showFilters ? (
        <View style={styles.filterBox}>
          {advancedLocked ? (
            <Text style={styles.filterLockedText}>Bộ lọc nâng cao chưa khả dụng với gói hiện tại. Kết quả vẫn được gợi ý theo tiêu chí cơ bản.</Text>
          ) : null}
          {(
            [
              ["requireFullQuantity", "Đủ toàn bộ số lượng"],
              ["strictBudget", "Trong đúng ngân sách"],
              ["strictBrand", "Đúng thương hiệu"],
              ["sameCityOnly", "Cùng thành phố"],
            ] as [keyof SupplierMatchAdvancedFilters, string][]
          ).map(([key, label]) => (
            <View key={key} style={styles.switchRow}>
              <Text style={[styles.switchLabel, advancedLocked && styles.mutedText]}>{label}</Text>
              <Switch
                value={Boolean(filters[key])}
                disabled={advancedLocked || isLoading}
                onValueChange={(value) => setFilters((current) => ({ ...current, [key]: value }))}
                trackColor={{ true: COLORS.primary, false: COLORS.border }}
                thumbColor={COLORS.white}
              />
            </View>
          ))}
          <View style={styles.ratingRow}>
            <Text style={[styles.switchLabel, advancedLocked && styles.mutedText]}>Điểm người bán tối thiểu (0–5)</Text>
            <View style={styles.ratingInputWrap}>
              <TextInput
                style={[styles.ratingInput, advancedLocked && styles.mutedText]}
                value={ratingText}
                onChangeText={updateRating}
                editable={!advancedLocked && !isLoading}
                keyboardType="decimal-pad"
                inputMode="decimal"
                placeholder="VD: 4"
                placeholderTextColor="#547B7D"
                maxLength={4}
              />
              {ratingText && !advancedLocked ? (
                <TouchableOpacity onPress={() => updateRating("")} accessibilityRole="button" accessibilityLabel="Xóa điểm tối thiểu" hitSlop={8}>
                  <Ionicons name="close-circle" size={18} color={COLORS.textLight} />
                </TouchableOpacity>
              ) : null}
            </View>
          </View>
          {ratingError ? <Text style={styles.fieldError}>{ratingError}</Text> : null}
        </View>
      ) : null}

      <TouchableOpacity
        style={[styles.primaryButton, buttonDisabled && styles.primaryButtonDisabled]}
        disabled={buttonDisabled}
        onPress={() => void request()}
        accessibilityRole="button"
        accessibilityState={{ disabled: buttonDisabled, busy: isLoading }}
      >
        {isLoading ? <ActivityIndicator color={COLORS.white} /> : <Ionicons name="sparkles-outline" size={18} color={COLORS.white} />}
        <Text style={styles.primaryButtonText}>{buttonLabel}</Text>
      </TouchableOpacity>
      {!readiness.ready && readiness.hint && !isLoading ? <Text style={styles.hint}>{readiness.hint}</Text> : null}
      {notice ? <Text style={notice.type === "error" ? styles.fieldError : styles.hint}>{notice.text}</Text> : null}

      {isLoading ? (
        <View style={styles.skeletonList}>
          {[0, 1, 2].map((index) => (
            <View key={index} style={styles.skeletonCard}>
              <View style={styles.skeletonThumb} />
              <View style={{ flex: 1, gap: 8 }}>
                <View style={[styles.skeletonLine, { width: "80%" }]} />
                <View style={[styles.skeletonLine, { width: "50%" }]} />
                <View style={[styles.skeletonLine, { width: "65%" }]} />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {state.status === "error" ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{state.message}</Text>
          {state.details?.map((line) => (
            <Text key={line} style={styles.errorDetail}>• {line}</Text>
          ))}
          {state.retryable ? (
            <TouchableOpacity style={styles.retryButton} onPress={() => void request()} accessibilityRole="button">
              <Text style={styles.retryButtonText}>Thử lại</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}

      {lastResponse ? (
        <View style={styles.resultArea}>
          <View style={styles.statusRow}>
            {aiStatusMessage ? <Text style={styles.statusText}>{aiStatusMessage}</Text> : null}
            <Text style={styles.quotaText}>{describeQuota(lastResponse)}</Text>
            {lastResponse.fromCache ? <Text style={styles.cacheText}>Kết quả được cập nhật gần đây</Text> : null}
            {lastResponse.advancedFiltersApplied ? <Text style={styles.cacheText}>Đã áp dụng bộ lọc nâng cao</Text> : null}
          </View>
          {isStale ? <Text style={styles.staleText}>Nhu cầu đã thay đổi so với lúc gợi ý. Nhấn “Gợi ý lại theo nhu cầu mới” để cập nhật.</Text> : null}

          {visibleMatches.length === 0 ? (
            <View style={styles.emptyBox}>
              <Ionicons name="search-outline" size={22} color={COLORS.textLight} />
              <Text style={styles.emptyTitle}>Chưa tìm thấy bài bán phù hợp với nhu cầu này.</Text>
              <Text style={styles.emptyHint}>Bạn có thể mở rộng khoảng giá, bỏ yêu cầu model hoặc thử lại khi có nguồn cung mới.</Text>
            </View>
          ) : (
            <>
              <Text style={styles.resultCount}>
                Hiển thị {visibleMatches.length} gợi ý{lastResponse.candidateCount > visibleMatches.length ? ` trong ${lastResponse.candidateCount} bài bán phù hợp` : ""} · tối đa {lastResponse.resultLimit}
              </Text>
              {visibleMatches.map((item) => (
                <SupplierMatchCard
                  key={item.sellPost.postId}
                  item={item}
                  attributeNames={attributeNames}
                  expanded={expandedPostId === item.sellPost.postId}
                  onToggle={() => setExpandedPostId((current) => (current === item.sellPost.postId ? null : item.sellPost.postId))}
                  onOpen={() => openSellPost(item.sellPost.postId)}
                />
              ))}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

function SupplierMatchCard({
  item,
  attributeNames,
  expanded,
  onToggle,
  onOpen,
}: {
  item: SupplierMatchItem;
  attributeNames?: Record<string, string>;
  expanded: boolean;
  onToggle: () => void;
  onOpen: () => void;
}) {
  const { sellPost, matchSummary } = item;
  const media = sellPost.medias?.[0];
  const imageUri = media?.url || media?.mediaUrl || null;
  const reasons = Array.from(new Set(item.reasonCodes.map((code) => REASON_LABELS[code]).filter(Boolean)));
  const remaining = sellPost.remainingQuantity ?? sellPost.quantity;
  const rating = typeof sellPost.averageRating === "number" && Number.isFinite(sellPost.averageRating)
    ? `${(Math.round(sellPost.averageRating * 10) / 10).toLocaleString("vi-VN")}★`
    : "Chưa có đánh giá";
  const attributeRows = Object.entries(matchSummary.attributes).map(([attributeId, state]) => ({
    key: attributeId,
    label: attributeNames?.[attributeId] ?? attributeNames?.[attributeId.toLowerCase()] ?? "Thông số khác",
    state,
  }));

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.thumb} />
        ) : (
          <View style={[styles.thumb, styles.thumbPlaceholder]}>
            <Ionicons name="image-outline" size={20} color={COLORS.textLight} />
          </View>
        )}
        <View style={{ flex: 1 }}>
          <Text style={styles.productName} numberOfLines={2}>{sellPost.productName || "Bài bán"}</Text>
          <Text style={styles.scoreLine}>
            <Text style={styles.scoreValue}>{formatScore(item.matchingScore)}</Text> · {describeMatchScore(item.matchingScore)}
          </Text>
          <Text style={styles.price}>{formatPrice(sellPost.basePrice)}</Text>
          <Text style={styles.metaLine}>
            {typeof remaining === "number" ? `Còn ${remaining} sản phẩm` : "Số lượng: chưa rõ"}
            {item.canFulfillQuantity ? " · Đủ số lượng cần mua" : ""}
          </Text>
          <Text style={styles.metaLine} numberOfLines={1}>
            Người bán: {sellPost.ownerName || "Ẩn danh"} · {rating}
          </Text>
        </View>
      </View>
      {reasons.length ? (
        <View style={styles.reasonRow}>
          {reasons.map((reason) => (
            <View key={reason} style={styles.reasonChip}>
              <Text style={styles.reasonChipText}>{reason}</Text>
            </View>
          ))}
        </View>
      ) : null}
      {item.shortExplanation ? (
          <Text style={styles.explanation}>
            {localizeSystemText(
              item.shortExplanation,
              "Hệ thống đã tìm thấy bài bán phù hợp với các tiêu chí đã chọn.",
            )}
          </Text>
        ) : null}
      <View style={styles.cardActions}>
        <TouchableOpacity onPress={onToggle} style={styles.secondaryButton} accessibilityRole="button">
          <Text style={styles.secondaryButtonText}>{expanded ? "Ẩn tiêu chí" : "Xem tiêu chí"}</Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={14} color={COLORS.primary} />
        </TouchableOpacity>
        <TouchableOpacity onPress={onOpen} style={styles.openButton} accessibilityRole="button">
          <Text style={styles.openButtonText}>Xem bài bán</Text>
          <Ionicons name="arrow-forward" size={14} color={COLORS.white} />
        </TouchableOpacity>
      </View>
      {expanded ? (
        <View style={styles.criteriaBox}>
          <Text style={styles.criteriaSummary}>
            Khớp {matchSummary.matchedCriteriaCount}/{matchSummary.evaluatedCriteriaCount} tiêu chí đã đánh giá
          </Text>
          {CRITERIA.map(({ key, label }) => (
            <CriterionRow key={key} label={label} state={matchSummary[key]} />
          ))}
          {attributeRows.map((row) => (
            <CriterionRow key={row.key} label={row.label} state={row.state} />
          ))}
        </View>
      ) : null}
    </View>
  );
}

function CriterionRow({ label, state }: { label: string; state: MatchState }) {
  const color =
    state === "Matched" ? COLORS.success : state === "NotMatched" ? COLORS.error : COLORS.textLight;
  const icon: React.ComponentProps<typeof Ionicons>["name"] =
    state === "Matched" ? "checkmark-circle" : state === "NotMatched" ? "close-circle" : "remove-circle-outline";
  return (
    <View style={styles.criterionRow}>
      <Ionicons name={icon} size={14} color={color} />
      <Text style={styles.criterionLabel}>{label}</Text>
      <Text style={[styles.criterionState, { color }]}>{MATCH_STATE_LABELS[state]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(84, 123, 125, 0.24)",
    backgroundColor: "rgba(84, 123, 125, 0.06)",
    padding: 12,
    gap: 8,
  },
  headerRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 15, fontWeight: "700", color: COLORS.text },
  subtitle: { fontSize: 12, lineHeight: 17, color: COLORS.textLight },
  filterToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  filterToggleLocked: { borderStyle: "dashed" },
  filterToggleText: { fontSize: 13, fontWeight: "600", color: COLORS.primary },
  filterDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  filterBox: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: 10,
    gap: 6,
  },
  filterLockedText: { fontSize: 12, lineHeight: 17, color: COLORS.textLight, marginBottom: 4 },
  switchRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 36 },
  switchLabel: { fontSize: 13, color: COLORS.text, flex: 1, paddingRight: 8 },
  mutedText: { color: COLORS.textLight },
  ratingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 40 },
  ratingInputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 8,
    minWidth: 92,
    height: 36,
  },
  ratingInput: { flex: 1, fontSize: 13, color: COLORS.text, padding: 0 },
  fieldError: { color: COLORS.error, fontSize: 12, lineHeight: 17 },
  hint: { fontSize: 12, lineHeight: 17, color: COLORS.textLight },
  primaryButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 12,
  },
  primaryButtonDisabled: { opacity: 0.55 },
  primaryButtonText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  skeletonList: { gap: 8 },
  skeletonCard: { flexDirection: "row", gap: 10, padding: 10, borderRadius: 10, backgroundColor: COLORS.white },
  skeletonThumb: { width: 64, height: 64, borderRadius: 8, backgroundColor: "rgba(23, 40, 48, 0.08)" },
  skeletonLine: { height: 10, borderRadius: 5, backgroundColor: "rgba(23, 40, 48, 0.08)" },
  errorBox: { borderRadius: 8, padding: 10, backgroundColor: "rgba(122, 16, 18, 0.06)", gap: 4 },
  errorText: { color: COLORS.error, fontSize: 13, lineHeight: 18 },
  errorDetail: { color: COLORS.error, fontSize: 12, lineHeight: 17 },
  retryButton: { alignSelf: "flex-start", marginTop: 4, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: COLORS.primary },
  retryButtonText: { color: COLORS.primary, fontWeight: "600", fontSize: 13 },
  resultArea: { gap: 8 },
  statusRow: { gap: 2 },
  statusText: { fontSize: 13, fontWeight: "600", color: COLORS.text },
  quotaText: { fontSize: 12, color: COLORS.textLight },
  cacheText: { fontSize: 12, color: COLORS.textLight },
  staleText: { fontSize: 12, lineHeight: 17, color: COLORS.primary },
  resultCount: { fontSize: 12, color: COLORS.textLight },
  emptyBox: { alignItems: "center", gap: 6, paddingVertical: 14, paddingHorizontal: 8 },
  emptyTitle: { fontSize: 13, fontWeight: "600", color: COLORS.text, textAlign: "center" },
  emptyHint: { fontSize: 12, lineHeight: 17, color: COLORS.textLight, textAlign: "center" },
  card: { backgroundColor: COLORS.white, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, padding: 10, gap: 8 },
  cardTop: { flexDirection: "row", gap: 10 },
  thumb: { width: 72, height: 72, borderRadius: 8, backgroundColor: "rgba(23, 40, 48, 0.06)" },
  thumbPlaceholder: { alignItems: "center", justifyContent: "center" },
  productName: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  scoreLine: { fontSize: 12, color: COLORS.text, marginTop: 2 },
  scoreValue: { fontWeight: "800", color: COLORS.primary },
  price: { fontSize: 14, fontWeight: "800", color: COLORS.primary, marginTop: 2 },
  metaLine: { fontSize: 12, color: COLORS.textLight, marginTop: 1 },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  reasonChip: { paddingVertical: 3, paddingHorizontal: 8, borderRadius: 999, backgroundColor: "rgba(47, 118, 93, 0.12)" },
  reasonChipText: { fontSize: 11, fontWeight: "600", color: COLORS.success },
  explanation: { fontSize: 12, lineHeight: 17, color: COLORS.text },
  cardActions: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  secondaryButton: { flexDirection: "row", alignItems: "center", gap: 4, paddingVertical: 8, paddingHorizontal: 4 },
  secondaryButtonText: { fontSize: 12, fontWeight: "600", color: COLORS.primary },
  openButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  openButtonText: { color: COLORS.white, fontWeight: "700", fontSize: 13 },
  criteriaBox: { borderTopWidth: 1, borderTopColor: COLORS.border, paddingTop: 8, gap: 4 },
  criteriaSummary: { fontSize: 12, fontWeight: "600", color: COLORS.text, marginBottom: 2 },
  criterionRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  criterionLabel: { flex: 1, fontSize: 12, color: COLORS.text },
  criterionState: { fontSize: 12, fontWeight: "600" },
});
