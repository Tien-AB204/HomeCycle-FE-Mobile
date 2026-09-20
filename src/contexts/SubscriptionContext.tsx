import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import {
  isSubscriptionPending,
  isSubscriptionVip,
  PlanBenefits,
  parseTime,
  subscriptionApi,
  UserSubscription,
} from "../services/apis/subscriptionApi";
import { devLog } from "../utils/devLog";
import { useAuth } from "./AuthContext";

/**
 * Trạng thái gói và quyền lợi hiệu lực của NGƯỜI DÙNG HIỆN TẠI.
 * - isVip luôn cần lifecycle Active + expiresAt ở tương lai; khi benefits đã tải,
 *   tier hiệu lực cũng phải là VIP (không dùng vai trò, tên hay mã gói).
 * - Không polling; tải lại khi đăng nhập/đổi tài khoản, foreground với dữ liệu cũ,
 *   sau thanh toán/hủy (màn hình gọi refresh) và đúng lúc expiresAt trôi qua.
 * - Đổi tài khoản/đăng xuất → xóa ngay để không rò rỉ trạng thái VIP.
 */

const STALE_AFTER_MS = 60_000;
const MAX_TIMER_MS = 2_147_000_000; // giới hạn setTimeout

type SubscriptionContextValue = {
  loading: boolean;
  current: UserSubscription | null;
  benefits: PlanBenefits | null;
  benefitsLoading: boolean;
  isVip: boolean;
  isPending: boolean;
  // Tăng mỗi khi trạng thái quyền lợi thay đổi (Active/Free/Pending, hết hạn, hủy)
  // để các màn hình phụ thuộc hạn mức tải lại hoặc xóa UI VIP cũ.
  entitlementVersion: number;
  refreshSubscription: () => Promise<UserSubscription | null>;
  refreshBenefits: () => Promise<PlanBenefits | null>;
  applySubscription: (subscription: UserSubscription | null) => void;
  clearSubscription: () => void;
};

const signatureOf = (subscription: UserSubscription | null) =>
  subscription
    ? `${subscription.subscriptionId}:${subscription.status}:${subscription.expiresAt ?? ""}`
    : "none";

const benefitsSignatureOf = (benefits: PlanBenefits | null) =>
  benefits
    ? [
        benefits.tier,
        benefits.subscriptionId ?? "",
        benefits.ai?.dailyLimit ?? "",
        benefits.supplierMatching?.resultLimit ?? "",
        benefits.supplierMatching?.aiRerankingEnabled ?? "",
        benefits.supplierMatching?.advancedFiltersEnabled ?? "",
        benefits.supplierMatching?.detailedReasonsEnabled ?? "",
        benefits.supplierMatching?.newSupplierNotificationsEnabled ?? "",
      ].join(":")
    : "none";

const SubscriptionContext = createContext<SubscriptionContextValue | undefined>(undefined);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { user, userToken } = useAuth();
  const userId = String(user?.userId || user?.id || "").toLowerCase();
  const isAuthenticated = Boolean(userToken && userId);

  const [current, setCurrent] = useState<UserSubscription | null>(null);
  const [loading, setLoading] = useState(false);
  const [benefits, setBenefits] = useState<PlanBenefits | null>(null);
  const [benefitsLoading, setBenefitsLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [entitlementVersion, setEntitlementVersion] = useState(0);
  const loadedForUserRef = useRef<string | null>(null);
  const lastLoadedAtRef = useRef<number | null>(null);
  const inFlightRef = useRef<Promise<UserSubscription | null> | null>(null);
  const benefitsLoadedForUserRef = useRef<string | null>(null);
  const benefitsLastLoadedAtRef = useRef<number | null>(null);
  const benefitsInFlightRef = useRef<Promise<PlanBenefits | null> | null>(null);
  const benefitsRequestUserRef = useRef<string>("");
  const requestUserRef = useRef<string>("");
  const previousSignatureRef = useRef<string>("");
  const previousBenefitsSignatureRef = useRef<string>("");
  const currentRef = useRef<UserSubscription | null>(null);
  const benefitsRef = useRef<PlanBenefits | null>(null);

  const commit = useCallback((subscription: UserSubscription | null) => {
    currentRef.current = subscription;
    setCurrent(subscription);
    setNow(Date.now());
    const signature = signatureOf(subscription);
    if (signature !== previousSignatureRef.current) {
      previousSignatureRef.current = signature;
      setEntitlementVersion((version) => version + 1);
    }
  }, []);

  const commitBenefits = useCallback((nextBenefits: PlanBenefits | null) => {
    benefitsRef.current = nextBenefits;
    setBenefits(nextBenefits);
    const signature = benefitsSignatureOf(nextBenefits);
    if (signature !== previousBenefitsSignatureRef.current) {
      previousBenefitsSignatureRef.current = signature;
      setEntitlementVersion((version) => version + 1);
    }
  }, []);

  const clearSubscription = useCallback(() => {
    loadedForUserRef.current = null;
    lastLoadedAtRef.current = null;
    requestUserRef.current = "";
    benefitsLoadedForUserRef.current = null;
    benefitsLastLoadedAtRef.current = null;
    benefitsRequestUserRef.current = "";
    inFlightRef.current = null;
    benefitsInFlightRef.current = null;
    setLoading(false);
    setBenefitsLoading(false);
    commit(null);
    commitBenefits(null);
  }, [commit, commitBenefits]);

  const refreshBenefits = useCallback(async (): Promise<PlanBenefits | null> => {
    if (!isAuthenticated) {
      clearSubscription();
      return null;
    }
    if (benefitsInFlightRef.current && benefitsRequestUserRef.current === userId) {
      return benefitsInFlightRef.current;
    }

    const targetUser = userId;
    benefitsRequestUserRef.current = targetUser;
    setBenefitsLoading(true);
    const task: Promise<PlanBenefits | null> = (async () => {
      try {
        const nextBenefits = await subscriptionApi.getMyBenefits();
        if (benefitsRequestUserRef.current !== targetUser) return null;
        benefitsLoadedForUserRef.current = targetUser;
        benefitsLastLoadedAtRef.current = Date.now();
        commitBenefits(nextBenefits);
        return nextBenefits;
      } catch (error) {
        // Lỗi tải không được tự nâng/hạ quyền lợi; giữ snapshot hiệu lực gần nhất.
        devLog("[subscription] Không tải được quyền lợi hiện tại:", error);
        return benefitsRef.current;
      } finally {
        if (benefitsRequestUserRef.current === targetUser) setBenefitsLoading(false);
        if (benefitsRequestUserRef.current === targetUser) benefitsInFlightRef.current = null;
      }
    })();
    benefitsInFlightRef.current = task;
    return task;
  }, [clearSubscription, commitBenefits, isAuthenticated, userId]);

  const refreshSubscription = useCallback(async (): Promise<UserSubscription | null> => {
    if (!isAuthenticated) {
      clearSubscription();
      return null;
    }
    if (inFlightRef.current && requestUserRef.current === userId) return inFlightRef.current;

    const targetUser = userId;
    requestUserRef.current = targetUser;
    setLoading(true);
    const task: Promise<UserSubscription | null> = (async () => {
      try {
        const subscription = await subscriptionApi.getMySubscription();
        // Kết quả của tài khoản trước không được áp cho tài khoản hiện tại.
        if (requestUserRef.current !== targetUser) return null;
        loadedForUserRef.current = targetUser;
        lastLoadedAtRef.current = Date.now();
        commit(subscription);
        return subscription;
      } catch (error) {
        // 401/mạng: giữ trạng thái hiện có (không nâng/hạ VIP dựa trên lỗi).
        devLog("[subscription] Không tải được gói hiện tại:", error);
        return currentRef.current;
      } finally {
        if (requestUserRef.current === targetUser) setLoading(false);
        if (requestUserRef.current === targetUser) inFlightRef.current = null;
      }
    })();
    inFlightRef.current = task;
    return task;
  }, [clearSubscription, commit, isAuthenticated, userId]);

  const applySubscription = useCallback(
    (subscription: UserSubscription | null) => {
      loadedForUserRef.current = userId;
      lastLoadedAtRef.current = Date.now();
      commit(subscription);
    },
    [commit, userId],
  );

  // Đăng nhập / khôi phục phiên / đổi tài khoản / đăng xuất.
  useEffect(() => {
    if (!isAuthenticated) {
      if (
        loadedForUserRef.current !== null ||
        benefitsLoadedForUserRef.current !== null ||
        currentRef.current ||
        benefitsRef.current
      ) {
        clearSubscription();
      }
      return;
    }
    if (loadedForUserRef.current !== userId) {
      if (currentRef.current || benefitsRef.current) clearSubscription();
      void Promise.allSettled([refreshSubscription(), refreshBenefits()]);
    }
  }, [clearSubscription, isAuthenticated, refreshBenefits, refreshSubscription, userId]);

  // Trở lại foreground với dữ liệu cũ → tải lại một lần (không polling).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || !isAuthenticated) return;
      const loadedAt = lastLoadedAtRef.current;
      if (!loadedAt || Date.now() - loadedAt > STALE_AFTER_MS) void refreshSubscription();
      const benefitsLoadedAt = benefitsLastLoadedAtRef.current;
      if (!benefitsLoadedAt || Date.now() - benefitsLoadedAt > STALE_AFTER_MS) void refreshBenefits();
    });
    return () => subscription.remove();
  }, [isAuthenticated, refreshBenefits, refreshSubscription]);

  // Đúng lúc expiresAt trôi qua: bỏ VIP ngay và tải lại trạng thái có thẩm quyền.
  useEffect(() => {
    if (!current || current.status !== "Active") return;
    const expiresAt = parseTime(current.expiresAt);
    if (expiresAt === null) return;
    const delay = Math.min(Math.max(expiresAt - Date.now(), 0) + 500, MAX_TIMER_MS);
    const timer = setTimeout(() => {
      setNow(Date.now());
      setEntitlementVersion((version) => version + 1);
      void Promise.allSettled([refreshSubscription(), refreshBenefits()]);
    }, delay);
    return () => clearTimeout(timer);
  }, [current, refreshBenefits, refreshSubscription]);

  const lifecycleVip = isSubscriptionVip(current, now);
  const effectiveVipMatches =
    benefits === null ||
    (benefits.tier === "VIP" && (!benefits.subscriptionId || benefits.subscriptionId === current?.subscriptionId));
  const isVip = lifecycleVip && effectiveVipMatches;

  const value = useMemo<SubscriptionContextValue>(
    () => ({
      loading,
      current,
      benefits,
      benefitsLoading,
      isVip,
      isPending: isSubscriptionPending(current),
      entitlementVersion,
      refreshSubscription,
      refreshBenefits,
      applySubscription,
      clearSubscription,
    }),
    [
      applySubscription,
      benefits,
      benefitsLoading,
      clearSubscription,
      current,
      entitlementVersion,
      isVip,
      loading,
      refreshBenefits,
      refreshSubscription,
    ],
  );

  return <SubscriptionContext.Provider value={value}>{children}</SubscriptionContext.Provider>;
}

export const useSubscription = (): SubscriptionContextValue => {
  const context = useContext(SubscriptionContext);
  if (context === undefined) {
    throw new Error("useSubscription phải được dùng bên trong SubscriptionProvider.");
  }
  return context;
};

/** Phiên bản không ném lỗi cho component dùng chung (ví dụ trong harness không có provider). */
export const useOptionalSubscription = (): SubscriptionContextValue | null =>
  useContext(SubscriptionContext) ?? null;
