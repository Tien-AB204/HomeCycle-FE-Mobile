import apiClient from "./axiosClient";

/**
 * Gợi ý nhà cung cấp cho tin thu mua (Backend nhánh Supplier Matching):
 * - POST /ai/supplier-matches/draft              → theo giá trị form Buy hiện tại (KHÔNG tạo tin)
 * - POST /ai/supplier-matches/buy-post/{buyPostId} → theo tin thu mua đã tồn tại (chủ tin)
 * Chỉ tài khoản Doanh nghiệp. Backend là nguồn có thẩm quyền về gói, giới hạn,
 * hạn mức AI và việc bộ lọc nâng cao có thực sự được áp dụng hay không.
 */

export type SupplierMatchAttributeValue = {
  attributeId: string;
  optionId?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueText?: string;
};

export type SupplierMatchAdvancedFilters = {
  requireFullQuantity: boolean;
  strictBudget: boolean;
  strictBrand: boolean;
  sameCityOnly: boolean;
  minimumSellerRating: number | null;
};

export type SupplierMatchDraftRequest = {
  categoryId: string | null;
  productTypeId: string | null;
  brandId: string | null;
  modelNumber: string | null;
  functionalityStatus: string | null;
  damageLevel: string | null;
  usageDuration: number | null;
  priceFrom: number | null;
  priceTo: number | null;
  quantity: number;
  city: string | null;
  attributeValues: SupplierMatchAttributeValue[];
  advancedFilters?: SupplierMatchAdvancedFilters;
};

export type SupplierMatchTier = "FREE" | "VIP";
export type SupplierRankingSource = "BACKEND_ONLY" | "AI_RERANKED";
export type SupplierAiStatus =
  | "AVAILABLE"
  | "NOT_REQUIRED"
  | "DAILY_LIMIT_REACHED"
  | "FALLBACK"
  | "NOT_ELIGIBLE";
export type SupplierMatchLevel = "HIGH" | "MEDIUM" | "LOW";
export type MatchState = "Matched" | "NotMatched" | "NotSpecified" | "Unknown";

export type SupplierMatchSummary = {
  category: MatchState;
  productType: MatchState;
  brand: MatchState;
  functionality: MatchState;
  usageDuration: MatchState;
  damageLevel: MatchState;
  price: MatchState;
  city: MatchState;
  // Khóa là AttributeId (GUID) — chỉ hiển thị sau khi đổi sang tên thuộc tính.
  attributes: Record<string, MatchState>;
  matchedCriteriaCount: number;
  evaluatedCriteriaCount: number;
};

export type SupplierMatchMedia = {
  mediaId?: string;
  url?: string | null;
  mediaUrl?: string | null;
};

// Bài bán trong kết quả gợi ý (PostResponse của Backend).
export type SupplierMatchSellPost = {
  postId: string;
  ownerId?: string;
  ownerName?: string | null;
  avatarUrl?: string | null;
  averageRating?: number | null;
  totalReviews?: number;
  productId?: string;
  productName?: string | null;
  productTypeName?: string | null;
  categoryName?: string | null;
  brandName?: string | null;
  description?: string | null;
  quantity?: number | null;
  remainingQuantity?: number | null;
  postType?: string | null;
  basePrice?: number | null;
  status?: string | null;
  city?: string | null;
  ward?: string | null;
  expiryDate?: string | null;
  isExpired?: boolean;
  medias?: SupplierMatchMedia[];
};

export type SupplierMatchItem = {
  sellPost: SupplierMatchSellPost;
  matchSummary: SupplierMatchSummary;
  matchingScore: number;
  matchingLevel: SupplierMatchLevel;
  rankingSource: SupplierRankingSource;
  reasonCodes: string[];
  shortExplanation: string;
  canFulfillQuantity: boolean;
};

export type SupplierMatchResponse = {
  buyPostId: string | null;
  tier: SupplierMatchTier;
  rankingSource: SupplierRankingSource;
  aiStatus: SupplierAiStatus;
  advancedFiltersApplied: boolean;
  resultLimit: number;
  remainingAiRefreshes: number;
  resetsAt: string | null;
  fromCache: boolean;
  candidateCount: number;
  generatedAt: string | null;
  matches: SupplierMatchItem[];
};

const MATCH_STATES: MatchState[] = ["Matched", "NotMatched", "NotSpecified", "Unknown"];

const asMatchState = (value: unknown): MatchState => {
  const text = String(value ?? "").trim();
  const found = MATCH_STATES.find((state) => state.toLowerCase() === text.toLowerCase());
  return found ?? "Unknown";
};

const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asText = (value: unknown): string | null => {
  const text = String(value ?? "").trim();
  return text ? text : null;
};

const pick = (raw: Record<string, unknown>, camel: string): unknown =>
  raw[camel] ?? raw[camel.charAt(0).toUpperCase() + camel.slice(1)];

const normalizeSummary = (value: unknown): SupplierMatchSummary => {
  const raw = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const attributesRaw = pick(raw, "attributes");
  const attributes: Record<string, MatchState> = {};
  if (attributesRaw && typeof attributesRaw === "object") {
    for (const [key, state] of Object.entries(attributesRaw as Record<string, unknown>)) {
      attributes[key.toLowerCase()] = asMatchState(state);
    }
  }
  return {
    category: asMatchState(pick(raw, "category")),
    productType: asMatchState(pick(raw, "productType")),
    brand: asMatchState(pick(raw, "brand")),
    functionality: asMatchState(pick(raw, "functionality")),
    usageDuration: asMatchState(pick(raw, "usageDuration")),
    damageLevel: asMatchState(pick(raw, "damageLevel")),
    price: asMatchState(pick(raw, "price")),
    city: asMatchState(pick(raw, "city")),
    attributes,
    matchedCriteriaCount: asNumber(pick(raw, "matchedCriteriaCount")),
    evaluatedCriteriaCount: asNumber(pick(raw, "evaluatedCriteriaCount")),
  };
};

const normalizeItem = (value: unknown): SupplierMatchItem | null => {
  const raw = (value && typeof value === "object" ? value : null) as Record<string, unknown> | null;
  if (!raw) return null;
  const sellPost = (pick(raw, "sellPost") ?? {}) as SupplierMatchSellPost;
  if (!sellPost || !sellPost.postId) return null;
  const level = String(pick(raw, "matchingLevel") ?? "LOW").toUpperCase();
  const source = String(pick(raw, "rankingSource") ?? "BACKEND_ONLY").toUpperCase();
  const reasonCodes = pick(raw, "reasonCodes");
  return {
    sellPost,
    matchSummary: normalizeSummary(pick(raw, "matchSummary")),
    matchingScore: asNumber(pick(raw, "matchingScore")),
    matchingLevel: level === "HIGH" || level === "MEDIUM" ? level : "LOW",
    rankingSource: source === "AI_RERANKED" ? "AI_RERANKED" : "BACKEND_ONLY",
    reasonCodes: Array.isArray(reasonCodes) ? reasonCodes.map((code) => String(code)) : [],
    shortExplanation: String(pick(raw, "shortExplanation") ?? "").trim(),
    canFulfillQuantity: pick(raw, "canFulfillQuantity") === true,
  };
};

// Chuẩn hóa phản hồi: không tính lại điểm/hạn mức, chỉ ép kiểu an toàn.
export const normalizeSupplierMatchResponse = (value: unknown): SupplierMatchResponse => {
  const payload = (value as any)?.data ?? value;
  const raw = (payload && typeof payload === "object" ? payload : {}) as Record<string, unknown>;
  const tier = String(pick(raw, "tier") ?? "FREE").toUpperCase();
  const rankingSource = String(pick(raw, "rankingSource") ?? "BACKEND_ONLY").toUpperCase();
  const aiStatusText = String(pick(raw, "aiStatus") ?? "NOT_REQUIRED").toUpperCase();
  const knownStatuses: SupplierAiStatus[] = [
    "AVAILABLE",
    "NOT_REQUIRED",
    "DAILY_LIMIT_REACHED",
    "FALLBACK",
    "NOT_ELIGIBLE",
  ];
  const matchesRaw = pick(raw, "matches");
  const matches = Array.isArray(matchesRaw)
    ? matchesRaw.map(normalizeItem).filter((item): item is SupplierMatchItem => item !== null)
    : [];
  return {
    buyPostId: asText(pick(raw, "buyPostId")),
    tier: tier === "VIP" ? "VIP" : "FREE",
    rankingSource: rankingSource === "AI_RERANKED" ? "AI_RERANKED" : "BACKEND_ONLY",
    aiStatus: knownStatuses.includes(aiStatusText as SupplierAiStatus)
      ? (aiStatusText as SupplierAiStatus)
      : "NOT_ELIGIBLE",
    advancedFiltersApplied: pick(raw, "advancedFiltersApplied") === true,
    resultLimit: Math.max(1, asNumber(pick(raw, "resultLimit"), matches.length || 1)),
    remainingAiRefreshes: Math.max(0, asNumber(pick(raw, "remainingAiRefreshes"))),
    resetsAt: asText(pick(raw, "resetsAt")),
    fromCache: pick(raw, "fromCache") === true,
    candidateCount: asNumber(pick(raw, "candidateCount"), matches.length),
    generatedAt: asText(pick(raw, "generatedAt")),
    matches,
  };
};

export const supplierMatchApi = {
  matchDraft: async (request: SupplierMatchDraftRequest): Promise<SupplierMatchResponse> =>
    normalizeSupplierMatchResponse(
      (await apiClient.post("/ai/supplier-matches/draft", request, { timeout: 60000 })).data,
    ),
  // Không có bộ lọc: gửi {} (Backend cho phép body rỗng).
  matchBuyPost: async (
    buyPostId: string,
    advancedFilters: SupplierMatchAdvancedFilters | null,
  ): Promise<SupplierMatchResponse> =>
    normalizeSupplierMatchResponse(
      (
        await apiClient.post(
          `/ai/supplier-matches/buy-post/${encodeURIComponent(buyPostId)}`,
          advancedFilters ?? {},
          { timeout: 60000 },
        )
      ).data,
    ),
};

/** Lỗi 400 của draft: { code, message, errors: { PropertyName: string[] } } */
export type SupplierMatchValidationErrors = Record<string, string[]>;

export const readSupplierMatchValidationErrors = (error: unknown): SupplierMatchValidationErrors => {
  const errors = (error as any)?.response?.data?.errors;
  const result: SupplierMatchValidationErrors = {};
  if (!errors || typeof errors !== "object") return result;
  for (const [key, messages] of Object.entries(errors as Record<string, unknown>)) {
    const list = Array.isArray(messages) ? messages : [messages];
    const texts = list.map((message) => String(message ?? "").trim()).filter(Boolean);
    if (texts.length) result[key] = texts;
  }
  return result;
};
