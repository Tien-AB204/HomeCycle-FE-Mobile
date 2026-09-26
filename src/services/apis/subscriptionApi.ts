import AsyncStorage from "@react-native-async-storage/async-storage";
import apiClient from "./axiosClient";
import { getSafeErrorMessage, readSafeApiMessage } from "../../utils/errorMessage";
import type { WithdrawalQuota } from "./withdrawalApi";

/**
 * Gói đăng ký (VIP) — hợp đồng Backend mới nhất.
 * VIP KHÔNG phải vai trò: Personal/Business giữ nguyên; VIP chỉ đến từ trạng thái
 * subscription hiện tại (Active + expiresAt còn hiệu lực). Pending không phải VIP.
 */

export type EntitlementValueType = "Integer" | "Decimal" | "Boolean";
export type SubscriptionStatus = "Pending" | "Active" | "Expired" | "Cancelled";
export type PaymentStatusValue =
  | "Pending"
  | "Completed"
  | "Failed"
  | "Refunded"
  | "PartiallyRefunded"
  | "Expired"
  | "Cancelled";

export type PackageEntitlement = {
  packageEntitlementId?: string;
  key: string;
  valueType: EntitlementValueType | string;
  numericValue: number | null;
  booleanValue: boolean | null;
  isUnlimited: boolean;
};

export type SubscriptionPackage = {
  packageId: string;
  code: string;
  name: string;
  description: string | null;
  price: number;
  duration: number;
  targetRole: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
  entitlements: PackageEntitlement[];
};

export type PlanTier = "FREE" | "VIP";
export type PlanRole = "Personal" | "Business";

export type SupplierMatchingBenefits = {
  resultLimit: number | null;
  aiRerankingEnabled: boolean | null;
  advancedFiltersEnabled: boolean | null;
  detailedReasonsEnabled: boolean | null;
  newSupplierNotificationsEnabled: boolean | null;
};

export type PlanDefinition = {
  tier: PlanTier;
  planName: string;
  description: string | null;
  role: PlanRole;
  aiFeature: string | null;
  aiDailyLimit: number | null;
  supplierMatching: SupplierMatchingBenefits | null;
};

export type PlanAiUsage = {
  feature: string | null;
  dailyLimit: number | null;
  usedToday: number | null;
  remainingToday: number | null;
  resetsAt: string | null;
};

export type PlanBenefits = {
  tier: PlanTier;
  planName: string;
  description: string | null;
  role: PlanRole;
  subscriptionId: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  ai: PlanAiUsage | null;
  supplierMatching: SupplierMatchingBenefits | null;
};

export type UserSubscription = {
  subscriptionId: string;
  userId: string;
  packageId: string;
  status: SubscriptionStatus;
  // Ảnh chụp lúc mua — hiển thị ưu tiên các trường này, không nối lại gói gốc.
  packageNameSnapshot: string | null;
  durationDaysSnapshot: number | null;
  checkoutAmount: number | null;
  pricePaid: number | null;
  // Hạn phiên thanh toán (PayOS) — KHÔNG phải hạn VIP.
  checkoutExpiresAt: string | null;
  activatedAt: string | null;
  // Hạn VIP do Backend tính — KHÔNG tự cộng activatedAt + duration.
  expiresAt: string | null;
  createdAt: string | null;
  withdrawalQuota: WithdrawalQuota | null;
  aiDailyLimit: number | null;
  aiRemainingToday: number | null;
  aiResetsAt: string | null;
  entitlements: PackageEntitlement[];
};

export type SubscriptionPayOSCheckout = {
  subscriptionId: string;
  subscriptionStatus: SubscriptionStatus;
  packageNameSnapshot: string | null;
  durationDaysSnapshot: number | null;
  checkoutAmount: number | null;
  expiresAt: string | null;
  entitlements: PackageEntitlement[];
  paymentId: string;
  checkoutUrl: string;
  checkoutExpiresAt: string | null;
};

export type SubscriptionPaymentStatus = {
  subscriptionId: string;
  paymentId: string;
  paymentStatus: PaymentStatusValue | string;
  subscriptionStatus: SubscriptionStatus;
  packageNameSnapshot: string | null;
  durationDaysSnapshot: number | null;
  checkoutAmount: number | null;
  checkoutExpiresAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  entitlements: PackageEntitlement[];
};

const unwrap = (value: any) => (value && typeof value === "object" && "data" in value && !("packageId" in value) && !("subscriptionId" in value) ? value.data : value);

const asNumberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asTextOrNull = (value: unknown): string | null => {
  const text = String(value ?? "").trim();
  return text ? text : null;
};

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as UnknownRecord : null;

const readField = (record: UnknownRecord, camelCase: string, pascalCase: string): unknown =>
  record[camelCase] ?? record[pascalCase];

const unwrapRecord = (value: unknown): UnknownRecord | null => {
  const record = asRecord(value);
  if (!record) return null;
  return asRecord(record.data ?? record.Data) ?? record;
};

const asBooleanOrNull = (value: unknown): boolean | null => {
  if (typeof value === "boolean") return value;
  if (value === 1 || String(value).trim().toLowerCase() === "true") return true;
  if (value === 0 || String(value).trim().toLowerCase() === "false") return false;
  return null;
};

const normalizePlanTier = (value: unknown, numericOneTier: PlanTier): PlanTier | null => {
  const text = String(value ?? "").trim().toUpperCase();
  if (text === "FREE" || text === "0") return "FREE";
  if (text === "VIP" || text === "2") return "VIP";
  // Hỗ trợ cả enum 0/1 và 1/2: endpoint Free luôn là FREE; benefits VIP
  // có subscriptionId, còn benefits FREE không có subscriptionId.
  if (text === "1") return numericOneTier;
  return null;
};

const normalizePlanRole = (value: unknown): PlanRole | null => {
  const text = String(value ?? "").trim().toLowerCase();
  if (text === "personal" || text === "1") return "Personal";
  if (text === "business" || text === "2") return "Business";
  return null;
};

const normalizeSupplierMatchingBenefits = (value: unknown): SupplierMatchingBenefits | null => {
  const raw = asRecord(value);
  if (!raw) return null;
  return {
    resultLimit: asNumberOrNull(readField(raw, "resultLimit", "ResultLimit")),
    aiRerankingEnabled: asBooleanOrNull(readField(raw, "aiRerankingEnabled", "AiRerankingEnabled")),
    advancedFiltersEnabled: asBooleanOrNull(readField(raw, "advancedFiltersEnabled", "AdvancedFiltersEnabled")),
    detailedReasonsEnabled: asBooleanOrNull(readField(raw, "detailedReasonsEnabled", "DetailedReasonsEnabled")),
    newSupplierNotificationsEnabled: asBooleanOrNull(
      readField(raw, "newSupplierNotificationsEnabled", "NewSupplierNotificationsEnabled"),
    ),
  };
};

const normalizePlanAiUsage = (value: unknown): PlanAiUsage | null => {
  const raw = asRecord(value);
  if (!raw) return null;
  return {
    feature: asTextOrNull(readField(raw, "feature", "Feature")),
    dailyLimit: asNumberOrNull(readField(raw, "dailyLimit", "DailyLimit")),
    usedToday: asNumberOrNull(readField(raw, "usedToday", "UsedToday")),
    remainingToday: asNumberOrNull(readField(raw, "remainingToday", "RemainingToday")),
    resetsAt: asTextOrNull(readField(raw, "resetsAt", "ResetsAt")),
  };
};

export const normalizePlanDefinition = (value: unknown): PlanDefinition | null => {
  const raw = unwrapRecord(value);
  if (!raw) return null;
  const tier = normalizePlanTier(readField(raw, "tier", "Tier"), "FREE");
  const role = normalizePlanRole(readField(raw, "role", "Role"));
  if (!tier || !role) return null;
  return {
    tier,
    planName: asTextOrNull(readField(raw, "planName", "PlanName")) ?? "",
    description: asTextOrNull(readField(raw, "description", "Description")),
    role,
    aiFeature: asTextOrNull(readField(raw, "aiFeature", "AiFeature")),
    aiDailyLimit: asNumberOrNull(readField(raw, "aiDailyLimit", "AiDailyLimit")),
    supplierMatching: normalizeSupplierMatchingBenefits(readField(raw, "supplierMatching", "SupplierMatching")),
  };
};

export const normalizePlanBenefits = (value: unknown): PlanBenefits | null => {
  const raw = unwrapRecord(value);
  if (!raw) return null;
  const subscriptionId = asTextOrNull(readField(raw, "subscriptionId", "SubscriptionId"));
  const tier = normalizePlanTier(readField(raw, "tier", "Tier"), subscriptionId ? "VIP" : "FREE");
  const role = normalizePlanRole(readField(raw, "role", "Role"));
  if (!tier || !role) return null;
  return {
    tier,
    planName: asTextOrNull(readField(raw, "planName", "PlanName")) ?? "",
    description: asTextOrNull(readField(raw, "description", "Description")),
    role,
    subscriptionId,
    activatedAt: asTextOrNull(readField(raw, "activatedAt", "ActivatedAt")),
    expiresAt: asTextOrNull(readField(raw, "expiresAt", "ExpiresAt")),
    ai: normalizePlanAiUsage(readField(raw, "ai", "Ai")),
    supplierMatching: normalizeSupplierMatchingBenefits(readField(raw, "supplierMatching", "SupplierMatching")),
  };
};

const STATUS_BY_NUMBER: Record<string, SubscriptionStatus> = {
  "1": "Pending",
  "2": "Active",
  "3": "Expired",
  "4": "Cancelled",
};

export const normalizeSubscriptionStatus = (value: unknown): SubscriptionStatus => {
  const text = String(value ?? "").trim();
  if (STATUS_BY_NUMBER[text]) return STATUS_BY_NUMBER[text];
  const lower = text.toLowerCase();
  if (lower === "active") return "Active";
  if (lower === "expired") return "Expired";
  if (lower === "cancelled" || lower === "canceled") return "Cancelled";
  return "Pending";
};

const PAYMENT_STATUS_BY_NUMBER: Record<string, PaymentStatusValue> = {
  "0": "Pending",
  "1": "Completed",
  "2": "Failed",
  "3": "Refunded",
  "4": "PartiallyRefunded",
  "5": "Expired",
  "6": "Cancelled",
};

export const normalizePaymentStatus = (value: unknown): PaymentStatusValue | string => {
  const text = String(value ?? "").trim();
  if (PAYMENT_STATUS_BY_NUMBER[text]) return PAYMENT_STATUS_BY_NUMBER[text];
  const lower = text.toLowerCase();
  const known: PaymentStatusValue[] = ["Pending", "Completed", "Failed", "Refunded", "PartiallyRefunded", "Expired", "Cancelled"];
  return known.find((status) => status.toLowerCase() === lower) ?? text;
};

const VALUE_TYPE_BY_NUMBER: Record<string, EntitlementValueType> = { "1": "Integer", "2": "Decimal", "3": "Boolean" };

const normalizeEntitlement = (value: any): PackageEntitlement | null => {
  if (!value || typeof value !== "object") return null;
  const key = asTextOrNull(value.key ?? value.Key);
  if (!key) return null;
  const rawType = String(value.valueType ?? value.ValueType ?? "").trim();
  return {
    packageEntitlementId: asTextOrNull(value.packageEntitlementId ?? value.PackageEntitlementId) ?? undefined,
    key,
    valueType: VALUE_TYPE_BY_NUMBER[rawType] ?? rawType,
    numericValue: asNumberOrNull(value.numericValue ?? value.NumericValue),
    booleanValue: typeof (value.booleanValue ?? value.BooleanValue) === "boolean" ? (value.booleanValue ?? value.BooleanValue) : null,
    isUnlimited: (value.isUnlimited ?? value.IsUnlimited) === true,
  };
};

const normalizeEntitlements = (value: unknown): PackageEntitlement[] =>
  Array.isArray(value) ? value.map(normalizeEntitlement).filter((item): item is PackageEntitlement => item !== null) : [];

export const normalizeSubscriptionPackage = (value: unknown): SubscriptionPackage | null => {
  const raw = unwrap(value);
  if (!raw || typeof raw !== "object") return null;
  const packageId = asTextOrNull(raw.packageId ?? raw.PackageId);
  if (!packageId) return null;
  return {
    packageId,
    code: String(raw.code ?? raw.Code ?? ""),
    name: String(raw.name ?? raw.Name ?? "").trim(),
    description: asTextOrNull(raw.description ?? raw.Description),
    price: asNumberOrNull(raw.price ?? raw.Price) ?? 0,
    duration: asNumberOrNull(raw.duration ?? raw.Duration) ?? 0,
    targetRole: String(raw.targetRole ?? raw.TargetRole ?? ""),
    isActive: (raw.isActive ?? raw.IsActive) !== false,
    createdAt: asTextOrNull(raw.createdAt ?? raw.CreatedAt),
    updatedAt: asTextOrNull(raw.updatedAt ?? raw.UpdatedAt),
    entitlements: normalizeEntitlements(raw.entitlements ?? raw.Entitlements),
  };
};

export const normalizeUserSubscription = (value: unknown): UserSubscription | null => {
  const raw = unwrap(value);
  // 204 / body rỗng / null → không có subscription hiện tại (Free), không phải lỗi.
  if (!raw || typeof raw !== "object") return null;
  const subscriptionId = asTextOrNull(raw.subscriptionId ?? raw.SubscriptionId);
  if (!subscriptionId) return null;
  return {
    subscriptionId,
    userId: String(raw.userId ?? raw.UserId ?? ""),
    packageId: String(raw.packageId ?? raw.PackageId ?? ""),
    status: normalizeSubscriptionStatus(raw.status ?? raw.Status),
    packageNameSnapshot: asTextOrNull(raw.packageNameSnapshot ?? raw.PackageNameSnapshot),
    durationDaysSnapshot: asNumberOrNull(raw.durationDaysSnapshot ?? raw.DurationDaysSnapshot),
    checkoutAmount: asNumberOrNull(raw.checkoutAmount ?? raw.CheckoutAmount),
    pricePaid: asNumberOrNull(raw.pricePaid ?? raw.PricePaid),
    checkoutExpiresAt: asTextOrNull(raw.checkoutExpiresAt ?? raw.CheckoutExpiresAt),
    activatedAt: asTextOrNull(raw.activatedAt ?? raw.ActivatedAt),
    expiresAt: asTextOrNull(raw.expiresAt ?? raw.ExpiresAt),
    createdAt: asTextOrNull(raw.createdAt ?? raw.CreatedAt),
    withdrawalQuota: (raw.withdrawalQuota ?? raw.WithdrawalQuota ?? null) as WithdrawalQuota | null,
    aiDailyLimit: asNumberOrNull(raw.aiDailyLimit ?? raw.AiDailyLimit),
    aiRemainingToday: asNumberOrNull(raw.aiRemainingToday ?? raw.AiRemainingToday),
    aiResetsAt: asTextOrNull(raw.aiResetsAt ?? raw.AiResetsAt),
    entitlements: normalizeEntitlements(raw.entitlements ?? raw.Entitlements),
  };
};

export const normalizeSubscriptionPaymentStatus = (value: unknown): SubscriptionPaymentStatus | null => {
  const raw = unwrap(value);
  if (!raw || typeof raw !== "object") return null;
  const subscriptionId = asTextOrNull(raw.subscriptionId ?? raw.SubscriptionId);
  if (!subscriptionId) return null;
  return {
    subscriptionId,
    paymentId: String(raw.paymentId ?? raw.PaymentId ?? ""),
    paymentStatus: normalizePaymentStatus(raw.paymentStatus ?? raw.PaymentStatus),
    subscriptionStatus: normalizeSubscriptionStatus(raw.subscriptionStatus ?? raw.SubscriptionStatus),
    packageNameSnapshot: asTextOrNull(raw.packageNameSnapshot ?? raw.PackageNameSnapshot),
    durationDaysSnapshot: asNumberOrNull(raw.durationDaysSnapshot ?? raw.DurationDaysSnapshot),
    checkoutAmount: asNumberOrNull(raw.checkoutAmount ?? raw.CheckoutAmount),
    checkoutExpiresAt: asTextOrNull(raw.checkoutExpiresAt ?? raw.CheckoutExpiresAt),
    activatedAt: asTextOrNull(raw.activatedAt ?? raw.ActivatedAt),
    expiresAt: asTextOrNull(raw.expiresAt ?? raw.ExpiresAt),
    entitlements: normalizeEntitlements(raw.entitlements ?? raw.Entitlements),
  };
};

const normalizePayOSCheckout = (value: unknown): SubscriptionPayOSCheckout | null => {
  const raw = unwrap(value);
  if (!raw || typeof raw !== "object") return null;
  const subscriptionId = asTextOrNull(raw.subscriptionId ?? raw.SubscriptionId);
  const checkoutUrl = asTextOrNull(raw.checkoutUrl ?? raw.CheckoutUrl);
  if (!subscriptionId || !checkoutUrl) return null;
  return {
    subscriptionId,
    subscriptionStatus: normalizeSubscriptionStatus(raw.subscriptionStatus ?? raw.SubscriptionStatus),
    packageNameSnapshot: asTextOrNull(raw.packageNameSnapshot ?? raw.PackageNameSnapshot),
    durationDaysSnapshot: asNumberOrNull(raw.durationDaysSnapshot ?? raw.DurationDaysSnapshot),
    checkoutAmount: asNumberOrNull(raw.checkoutAmount ?? raw.CheckoutAmount),
    expiresAt: asTextOrNull(raw.expiresAt ?? raw.ExpiresAt),
    entitlements: normalizeEntitlements(raw.entitlements ?? raw.Entitlements),
    paymentId: String(raw.paymentId ?? raw.PaymentId ?? ""),
    checkoutUrl,
    checkoutExpiresAt: asTextOrNull(raw.checkoutExpiresAt ?? raw.CheckoutExpiresAt),
  };
};

// ---------------------------------------------------------------- trạng thái VIP

export const parseTime = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
};

/** VIP chỉ khi Active và expiresAt tồn tại, còn ở tương lai. */
export const isSubscriptionVip = (subscription: UserSubscription | null | undefined, now = Date.now()): boolean => {
  if (!subscription || subscription.status !== "Active") return false;
  const expiresAt = parseTime(subscription.expiresAt);
  return expiresAt !== null && expiresAt > now;
};

export const isSubscriptionPending = (subscription: UserSubscription | null | undefined): boolean =>
  subscription?.status === "Pending";

export const isCheckoutSessionOpen = (checkoutExpiresAt: string | null | undefined, now = Date.now()): boolean => {
  const expiresAt = parseTime(checkoutExpiresAt);
  return expiresAt === null || expiresAt > now;
};

export const isTerminalPaymentStatus = (status: PaymentStatusValue | string): boolean =>
  ["Completed", "Failed", "Refunded", "PartiallyRefunded", "Expired", "Cancelled"].includes(String(status));

// ---------------------------------------------------------------- nhãn quyền lợi

export const ENTITLEMENT_LABELS: Record<string, string> = {
  "ai.price_suggestion.daily_count": "Lượt AI gợi ý giá mỗi ngày",
  "ai.supplier_match.daily_count": "Lượt AI gợi ý nhà cung cấp mỗi ngày",
  "withdrawal.daily_count": "Số lần rút tiền tối đa mỗi ngày",
  "withdrawal.daily_amount": "Tổng số tiền được rút tối đa mỗi ngày",
};

const formatVnd = (value: number) => `${Math.round(value).toLocaleString("vi-VN")} đ`;

/** Trả về null với khóa chưa biết để UI bỏ qua thay vì hiển thị chuỗi kỹ thuật. */
export const describeEntitlement = (entitlement: PackageEntitlement): { label: string; value: string } | null => {
  const label = ENTITLEMENT_LABELS[entitlement.key];
  if (!label) return null;
  let value: string;
  if (entitlement.isUnlimited) value = "Không giới hạn";
  else if (entitlement.valueType === "Boolean" || typeof entitlement.booleanValue === "boolean") {
    value = entitlement.booleanValue ? "Có" : "Không";
  } else if (entitlement.numericValue !== null) {
    value = entitlement.key === "withdrawal.daily_amount"
      ? formatVnd(entitlement.numericValue)
      : entitlement.numericValue.toLocaleString("vi-VN");
  } else value = "—";
  return { label, value };
};

// ---------------------------------------------------------------- thông điệp lỗi

// Chỉ dùng làm dự phòng khi BE không trả message.
const SUBSCRIPTION_ERROR_MESSAGES: Record<string, string> = {
  "UserSubscription.RoleNotEligible": "Gói này không áp dụng cho loại tài khoản hiện tại.",
  "UserSubscription.UserInactive": "Tài khoản hiện không thể thực hiện giao dịch này.",
  "SubscriptionPackage.NotFound": "Gói đăng ký không còn tồn tại.",
  "SubscriptionPackage.Inactive": "Gói đăng ký hiện không còn được bán.",
  "UserSubscription.OpenExists": "Bạn đang có một gói hoặc phiên thanh toán chưa kết thúc.",
  "UserSubscription.InsufficientBalance": "Số dư ví không đủ để thanh toán gói này.",
  "UserSubscription.WalletNotFound": "Không tìm thấy ví của bạn. Vui lòng thử lại sau.",
  "UserSubscription.NotFound": "Không tìm thấy gói đăng ký của bạn.",
  "UserSubscription.InvalidStatus": "Trạng thái gói hiện tại không cho phép thao tác này.",
  "UserSubscription.InvalidSnapshot": "Gói đăng ký cần được đối soát trước khi kích hoạt. Vui lòng liên hệ hỗ trợ.",
  "Payment.InvalidRedirectUrl": "Không thể mở phiên thanh toán lúc này.",
  "Payment.InvalidAmount": "Số tiền thanh toán không hợp lệ.",
  "Payment.NotFound": "Không tìm thấy giao dịch thanh toán.",
  "AUTH_USER_NOT_FOUND": "Không xác định được tài khoản. Vui lòng đăng nhập lại.",
  "Auth.Forbidden": "Bạn không có quyền thực hiện thao tác này.",
};

export const readErrorCode = (error: unknown): string => {
  const data = (error as any)?.response?.data;
  const code = data?.code ?? data?.error?.code ?? data?.Code ?? (error as any)?.code;
  return String(code ?? "").trim();
};

export const getSubscriptionErrorMessage = (error: unknown, fallback: string): string => {
  // Ưu tiên thông điệp BE trả về (nguyên văn).
  const backendMessage = readSafeApiMessage((error as any)?.response?.data);
  if (backendMessage) return backendMessage;
  const code = readErrorCode(error);
  if (code && SUBSCRIPTION_ERROR_MESSAGES[code]) return SUBSCRIPTION_ERROR_MESSAGES[code];
  const status = Number((error as any)?.response?.status || 0);
  if (status === 401) return "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.";
  if (status === 403) return "Bạn không có quyền thực hiện thao tác này.";
  if (status === 404) return "Không tìm thấy dữ liệu gói đăng ký.";
  // Còn lại (5xx, lỗi mạng, lỗi do ứng dụng tự ném) dùng bộ xử lý chung.
  return getSafeErrorMessage(error, fallback);
};

// ---------------------------------------------------------------- API

export const subscriptionApi = {
  getPackages: async (): Promise<SubscriptionPackage[]> => {
    const raw = unwrap((await apiClient.get("/subscription-packages")).data);
    const list = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : [];
    return (list as unknown[]).map(normalizeSubscriptionPackage).filter((item): item is SubscriptionPackage => item !== null);
  },
  getPackageById: async (packageId: string): Promise<SubscriptionPackage | null> =>
    normalizeSubscriptionPackage((await apiClient.get(`/subscription-packages/${encodeURIComponent(packageId)}`)).data),
  getFreePlan: async (targetRole: PlanRole): Promise<PlanDefinition | null> =>
    normalizePlanDefinition(
      (await apiClient.get("/subscription-packages/free-plan", { params: { targetRole } })).data,
    ),
  // 200 + JSON hoặc 204/body rỗng (→ null).
  getMySubscription: async (): Promise<UserSubscription | null> => {
    const response = await apiClient.get("/subscription-packages/me/subscription");
    if (response.status === 204 || response.data === "" || response.data == null) return null;
    return normalizeUserSubscription(response.data);
  },
  getMyBenefits: async (): Promise<PlanBenefits | null> =>
    normalizePlanBenefits((await apiClient.get("/subscription-packages/me/benefits")).data),
  walletCheckout: async (packageId: string): Promise<SubscriptionPaymentStatus | null> =>
    normalizeSubscriptionPaymentStatus(
      (await apiClient.post(`/payments/subscriptions/${encodeURIComponent(packageId)}/wallet/checkout`, null, { timeout: 30000 })).data,
    ),
  payosCheckout: async (
    packageId: string,
    payload: { returnUrl: string; cancelUrl: string },
  ): Promise<SubscriptionPayOSCheckout | null> =>
    normalizePayOSCheckout(
      (await apiClient.post(`/payments/subscriptions/${encodeURIComponent(packageId)}/payos/checkout`, payload, { timeout: 30000 })).data,
    ),
  getPaymentStatus: async (subscriptionId: string): Promise<SubscriptionPaymentStatus | null> =>
    normalizeSubscriptionPaymentStatus(
      (await apiClient.get(`/payments/subscriptions/${encodeURIComponent(subscriptionId)}/status`)).data,
    ),
  cancelMySubscription: async (subscriptionId: string): Promise<void> => {
    await apiClient.post(`/subscription-packages/me/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, null);
  },
};

// ---------------------------------------------------------------- phiên PayOS đang mở (tối thiểu, theo user)

export type StoredSubscriptionCheckout = {
  subscriptionId: string;
  checkoutUrl: string;
  checkoutExpiresAt: string | null;
  createdAt: number;
};

const checkoutStorageKey = (userId: string) => `homecycle.subscriptionCheckout.${userId.toLowerCase()}`;

export const subscriptionCheckoutStore = {
  save: async (userId: string, value: StoredSubscriptionCheckout): Promise<void> => {
    if (!userId) return;
    try {
      await AsyncStorage.setItem(checkoutStorageKey(userId), JSON.stringify(value));
    } catch {
      // Không lưu được cũng không chặn thanh toán; "Tiếp tục thanh toán" chỉ mất tiện ích.
    }
  },
  load: async (userId: string): Promise<StoredSubscriptionCheckout | null> => {
    if (!userId) return null;
    try {
      const raw = await AsyncStorage.getItem(checkoutStorageKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      if (!parsed?.subscriptionId || !parsed?.checkoutUrl) return null;
      return {
        subscriptionId: String(parsed.subscriptionId),
        checkoutUrl: String(parsed.checkoutUrl),
        checkoutExpiresAt: asTextOrNull(parsed.checkoutExpiresAt),
        createdAt: Number(parsed.createdAt) || 0,
      };
    } catch {
      return null;
    }
  },
  clear: async (userId: string): Promise<void> => {
    if (!userId) return;
    try {
      await AsyncStorage.removeItem(checkoutStorageKey(userId));
    } catch {
      // bỏ qua
    }
  },
};
