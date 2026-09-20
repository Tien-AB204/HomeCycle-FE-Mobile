import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../src/components/shared/Header";
import { ModalBackdrop, ModalSurface } from "../src/components/shared/ModalBackdrop";
import VipCrownBadge from "../src/components/shared/VipCrownBadge";
import { COLORS } from "../src/constants/theme";
import { useAuth } from "../src/contexts/AuthContext";
import { useSubscription } from "../src/contexts/SubscriptionContext";
import apiClient from "../src/services/apis/axiosClient";
import {
  describeEntitlement,
  getSubscriptionErrorMessage,
  isCheckoutSessionOpen,
  isTerminalPaymentStatus,
  PlanDefinition,
  PlanRole,
  parseTime,
  StoredSubscriptionCheckout,
  subscriptionApi,
  subscriptionCheckoutStore,
  SubscriptionPackage,
  SubscriptionPaymentStatus,
} from "../src/services/apis/subscriptionApi";
import { devLog } from "../src/utils/devLog";
import { localizeSystemText } from "../src/utils/localizeSystemText";
import { useGuardedRouter } from "../src/utils/tapGuard";
import { useAutoDismissFeedback } from "../src/utils/useAutoDismissFeedback";

/**
 * Gói đăng ký VIP — MỘT màn hình cho cả Personal và Business, dữ liệu gói/giá/thời hạn/
 * quyền lợi từ Backend; trạng thái hiện tại từ SubscriptionContext (không suy từ vai trò).
 * PayOS dùng lại kiến trúc trình duyệt ngoài (expo-web-browser) như thanh toán hợp đồng,
 * với returnUrl/cancelUrl riêng của subscription (không dùng chung với agreementId).
 */

const STATUS_POLL_MS = 4000;

type InlineMessage = { type: "success" | "info" | "error"; text: string } | null;
type PaymentMethod = "wallet" | "payos";
type BenefitRow = { key: string; label: string; value: string; available?: boolean };

const BENEFIT_ORDER_BY_ROLE: Record<"personal" | "business", readonly string[]> = {
  personal: ["ai.price_suggestion.daily_count"],
  business: [
    "ai.supplier_match.daily_count",
    "supplier_matching.result_limit",
    "supplier_matching.ai_reranking_enabled",
    "supplier_matching.advanced_filters_enabled",
    "supplier_matching.detailed_reasons_enabled",
    "supplier_matching.new_supplier_notifications_enabled",
    "withdrawal.daily_count",
    "withdrawal.daily_amount",
  ],
};

const getOrderedSubscriptionBenefits = (
  benefits: readonly (SubscriptionPackage["entitlements"][number] | BenefitRow)[],
  role: string,
): BenefitRow[] => {
  const normalizedRole = role === "personal" ? "personal" : role === "business" ? "business" : null;
  if (!normalizedRole) return [];
  const order = BENEFIT_ORDER_BY_ROLE[normalizedRole];

  return benefits
    .map((benefit): BenefitRow | null => {
      if ("label" in benefit) return benefit;
      const description = describeEntitlement(benefit);
      return description ? { key: benefit.key, ...description } : null;
    })
    .filter((row): row is BenefitRow => row !== null && order.includes(row.key))
    .sort((left, right) => order.indexOf(left.key) - order.indexOf(right.key));
};

const formatCurrency = (value: number | null | undefined) =>
  `${Math.round(Number(value ?? 0)).toLocaleString("vi-VN")} đ`;

const formatDateTime = (value: string | null | undefined) => {
  const time = parseTime(value);
  if (time === null) return "—";
  return new Date(time).toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const formatRemaining = (target: string | null | undefined, now: number) => {
  const time = parseTime(target);
  if (time === null) return null;
  const diff = time - now;
  if (diff <= 0) return "đã hết hạn";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "dưới 1 phút";
  if (minutes < 60) return `${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} giờ ${minutes % 60} phút`;
  const days = Math.floor(hours / 24);
  return `${days} ngày ${hours % 24} giờ`;
};

const sameRole = (targetRole: string, userRole: string) =>
  targetRole.trim().toLowerCase() === userRole.trim().toLowerCase() ||
  (targetRole.trim() === "1" && userRole === "personal") ||
  (targetRole.trim() === "2" && userRole === "business");

const walletApi = {
  getMyWallet: async () => {
    const response = (await apiClient.get("/wallet/me")).data;
    const data = response?.data ?? response;
    return Number(data?.availableBalance ?? data?.AvailableBalance ?? 0);
  },
};

export default function SubscriptionScreen() {
  const router = useGuardedRouter();
  const params = useLocalSearchParams();
  const { user, userToken } = useAuth();
  const subscription = useSubscription();
  const userId = String(user?.userId || user?.id || "");
  const userRole = String(user?.role || "").toLowerCase();
  const planRole: PlanRole | null = userRole === "business" ? "Business" : userRole === "personal" ? "Personal" : null;
  const isAuthenticated = Boolean(userToken && userId);

  const [packages, setPackages] = useState<SubscriptionPackage[]>([]);
  const [isLoadingPackages, setIsLoadingPackages] = useState(true);
  const [packagesError, setPackagesError] = useState<string | null>(null);
  const [freePlan, setFreePlan] = useState<PlanDefinition | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [message, setMessage] = useState<InlineMessage>(null);
  useAutoDismissFeedback(message, () => setMessage(null));
  const [now, setNow] = useState(() => Date.now());

  // Luồng mua.
  const [checkoutPackage, setCheckoutPackage] = useState<SubscriptionPackage | null>(null);
  const [isPreparingCheckout, setIsPreparingCheckout] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null);
  const [isSubmittingCheckout, setIsSubmittingCheckout] = useState(false);
  const checkoutInFlightRef = useRef(false);
  const prepareInFlightRef = useRef(false);

  // Phiên PayOS đang mở + đối chiếu trạng thái.
  const [storedCheckout, setStoredCheckout] = useState<StoredSubscriptionCheckout | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [lastStatus, setLastStatus] = useState<SubscriptionPaymentStatus | null>(null);
  const statusInFlightRef = useRef(false);
  const pollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollGenerationRef = useRef(0);
  const mountedRef = useRef(true);
  const handledReturnRef = useRef<string | null>(null);

  // Hủy gói.
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const cancelInFlightRef = useRef(false);

  const current = subscription.current;
  const isVip = subscription.isVip;
  const isPending = subscription.isPending;
  // Chỉ phụ thuộc vào hàm ổn định, không phải cả object context (đổi mỗi lần loading/current đổi)
  // để useFocusEffect/useCallback không tự kích hoạt lại thành vòng lặp tải.
  const refreshSubscription = subscription.refreshSubscription;
  const refreshBenefits = subscription.refreshBenefits;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pollGenerationRef.current += 1;
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
    };
  }, []);

  // Đồng hồ nhẹ cho đếm ngược phiên thanh toán (chỉ khi có Pending).
  useEffect(() => {
    if (!isPending) return;
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, [isPending]);

  const loadPackages = useCallback(async () => {
    try {
      setPackagesError(null);
      const list = await subscriptionApi.getPackages();
      if (!mountedRef.current) return;
      setPackages(list.filter((item) => item.isActive));
    } catch (error) {
      devLog("[subscription] Không tải được danh sách gói:", error);
      if (mountedRef.current) setPackagesError("Chưa tải được danh sách gói. Kéo xuống để thử lại.");
    } finally {
      if (mountedRef.current) setIsLoadingPackages(false);
    }
  }, []);

  const loadFreePlan = useCallback(async () => {
    if (!planRole) {
      setFreePlan(null);
      return;
    }
    try {
      const definition = await subscriptionApi.getFreePlan(planRole);
      if (mountedRef.current) setFreePlan(definition?.tier === "FREE" ? definition : null);
    } catch (error) {
      devLog("[subscription] Không tải được định nghĩa gói miễn phí:", error);
      if (mountedRef.current) setFreePlan(null);
    }
  }, [planRole]);

  const loadStoredCheckout = useCallback(async () => {
    if (!userId) {
      setStoredCheckout(null);
      return null;
    }
    const stored = await subscriptionCheckoutStore.load(userId);
    if (mountedRef.current) setStoredCheckout(stored);
    return stored;
  }, [userId]);

  const stopPolling = useCallback(() => {
    pollGenerationRef.current += 1;
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  // Đối chiếu trạng thái thanh toán subscription với Backend; VIP chỉ khi
  // paymentStatus Completed VÀ subscriptionStatus Active (không tin query param).
  const reconcileStatus = useCallback(
    async (subscriptionId: string, options?: { silent?: boolean }): Promise<SubscriptionPaymentStatus | null> => {
      if (!subscriptionId || statusInFlightRef.current) return null;
      statusInFlightRef.current = true;
      if (!options?.silent) setIsCheckingStatus(true);
      try {
        const status = await subscriptionApi.getPaymentStatus(subscriptionId);
        if (!mountedRef.current || !status) return null;
        setLastStatus(status);
        const paymentStatus = String(status.paymentStatus);
        const completed = paymentStatus === "Completed" && status.subscriptionStatus === "Active";
        if (completed) {
          stopPolling();
          await subscriptionCheckoutStore.clear(userId);
          setStoredCheckout(null);
          await Promise.all([refreshSubscription(), refreshBenefits()]);
          setMessage({ type: "success", text: "Thanh toán thành công. Gói VIP đã được kích hoạt." });
        } else if (isTerminalPaymentStatus(paymentStatus) || status.subscriptionStatus !== "Pending") {
          stopPolling();
          await subscriptionCheckoutStore.clear(userId);
          setStoredCheckout(null);
          await refreshSubscription();
          if (!options?.silent) {
            setMessage({
              type: "info",
              text:
                paymentStatus === "Cancelled"
                  ? "Bạn đã hủy phiên thanh toán."
                  : paymentStatus === "Expired"
                    ? "Phiên thanh toán đã hết hạn. Bạn có thể tạo thanh toán mới."
                    : paymentStatus === "Failed"
                      ? "Thanh toán không thành công. Bạn có thể thử lại."
                      : "Phiên thanh toán đã kết thúc.",
            });
          }
        } else if (!options?.silent) {
          setMessage({ type: "info", text: "Đang chờ thanh toán. Nếu bạn đã thanh toán, hệ thống sẽ cập nhật trong giây lát." });
        }
        return status;
      } catch (error) {
        devLog("[subscription] Không đối chiếu được trạng thái thanh toán:", error);
        if (!options?.silent && mountedRef.current) {
          setMessage({ type: "error", text: getSubscriptionErrorMessage(error, "Chưa kiểm tra được trạng thái thanh toán. Vui lòng thử lại.") });
        }
        return null;
      } finally {
        statusInFlightRef.current = false;
        if (mountedRef.current) setIsCheckingStatus(false);
      }
    },
    [refreshBenefits, refreshSubscription, stopPolling, userId],
  );

  // Polling chỉ khi phiên thanh toán còn Pending; dừng khi kết thúc/hết hạn/rời màn hình.
  const startPolling = useCallback(
    (subscriptionId: string, checkoutExpiresAt: string | null) => {
      stopPolling();
      const generation = pollGenerationRef.current;
      const tick = async () => {
        if (!mountedRef.current || generation !== pollGenerationRef.current) return;
        if (!isCheckoutSessionOpen(checkoutExpiresAt)) {
          await reconcileStatus(subscriptionId, { silent: true });
          void refreshSubscription();
          return;
        }
        const status = await reconcileStatus(subscriptionId, { silent: true });
        if (!mountedRef.current || generation !== pollGenerationRef.current) return;
        const stillPending =
          !status || (String(status.paymentStatus) === "Pending" && status.subscriptionStatus === "Pending");
        if (stillPending) pollTimerRef.current = setTimeout(() => void tick(), STATUS_POLL_MS);
      };
      pollTimerRef.current = setTimeout(() => void tick(), STATUS_POLL_MS);
    },
    [reconcileStatus, refreshSubscription, stopPolling],
  );

  const loadAll = useCallback(async () => {
    await Promise.allSettled([
      loadPackages(),
      loadFreePlan(),
      refreshSubscription(),
      refreshBenefits(),
      loadStoredCheckout(),
    ]);
  }, [loadFreePlan, loadPackages, loadStoredCheckout, refreshBenefits, refreshSubscription]);

  useFocusEffect(
    useCallback(() => {
      void loadAll();
      return () => stopPolling();
    }, [loadAll, stopPolling]),
  );

  // Quay lại từ PayOS qua deep link: /subscription?payos=return|cancel (subscriptionId chưa có
  // khi tạo URL nên lấy từ phiên đã lưu hoặc subscription Pending hiện tại; không tin query param
  // để kết luận VIP — luôn đối chiếu qua API trạng thái).
  const returnKind = String(Array.isArray(params.payos) ? params.payos[0] : params.payos ?? "");
  const returnSubscriptionId =
    String(Array.isArray(params.subscriptionId) ? params.subscriptionId[0] : params.subscriptionId ?? "") ||
    storedCheckout?.subscriptionId ||
    (current?.status === "Pending" ? current.subscriptionId : "");
  useEffect(() => {
    if (!returnKind || !returnSubscriptionId || !isAuthenticated) return;
    const key = `${returnSubscriptionId}:${returnKind}`;
    if (handledReturnRef.current === key) return;
    handledReturnRef.current = key;
    void (async () => {
      const status = await reconcileStatus(returnSubscriptionId);
      if (status && String(status.paymentStatus) === "Pending" && status.subscriptionStatus === "Pending") {
        startPolling(returnSubscriptionId, status.checkoutExpiresAt);
      }
    })();
  }, [isAuthenticated, reconcileStatus, returnKind, returnSubscriptionId, startPolling]);

  // Có Pending khi mở màn hình hoặc trở lại foreground → đối chiếu (và poll trong khi còn Pending).
  useEffect(() => {
    if (!isPending || !current?.subscriptionId) return;
    if (!isCheckoutSessionOpen(current.checkoutExpiresAt)) return;
    void (async () => {
      const status = await reconcileStatus(current.subscriptionId, { silent: true });
      if (status && String(status.paymentStatus) === "Pending" && status.subscriptionStatus === "Pending") {
        startPolling(current.subscriptionId, status.checkoutExpiresAt ?? current.checkoutExpiresAt);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.subscriptionId, isPending]);

  useEffect(() => {
    const listener = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      const pendingId = current?.status === "Pending" ? current.subscriptionId : storedCheckout?.subscriptionId;
      if (pendingId) {
        void (async () => {
          const status = await reconcileStatus(pendingId, { silent: true });
          if (status && String(status.paymentStatus) === "Pending" && status.subscriptionStatus === "Pending") {
            startPolling(pendingId, status.checkoutExpiresAt);
          }
        })();
      }
    });
    return () => listener.remove();
  }, [current?.status, current?.subscriptionId, reconcileStatus, startPolling, storedCheckout?.subscriptionId]);

  // ---------------------------------------------------------------- mua gói

  const applicablePackages = useMemo(() => {
    if (userRole !== "personal" && userRole !== "business") return [];
    return packages
      .filter((item) => sameRole(item.targetRole, userRole))
      .sort(
        (left, right) =>
          left.price - right.price ||
          left.packageId.localeCompare(right.packageId, "vi") ||
          left.name.localeCompare(right.name, "vi"),
      );
  }, [packages, userRole]);
  const otherPackages = useMemo(
    () => packages.filter((item) => userRole && !sameRole(item.targetRole, userRole)),
    [packages, userRole],
  );

  const openCheckout = async (pkg: SubscriptionPackage) => {
    if (prepareInFlightRef.current) return;
    if (!isAuthenticated) {
      router.push("/(auth)/login");
      return;
    }
    if (isPending) {
      setMessage({ type: "info", text: "Bạn đang có một phiên thanh toán chưa kết thúc. Vui lòng hoàn tất hoặc chờ phiên đó hết hạn." });
      return;
    }
    prepareInFlightRef.current = true;
    setIsPreparingCheckout(true);
    try {
      // Làm mới chi tiết gói trước khi xác nhận: giá/tên/thời hạn/quyền lợi mới nhất.
      const [freshPackage, balance] = await Promise.all([
        subscriptionApi.getPackageById(pkg.packageId),
        walletApi.getMyWallet().catch((error) => {
          devLog("[subscription] Không tải được số dư ví:", error);
          return null;
        }),
      ]);
      if (!mountedRef.current) return;
      if (!freshPackage || !freshPackage.isActive) {
        setMessage({ type: "error", text: "Gói đăng ký hiện không còn được bán. Vui lòng chọn gói khác." });
        void loadPackages();
        return;
      }
      setWalletBalance(balance);
      setPaymentMethod(null);
      setCheckoutPackage(freshPackage);
    } catch (error) {
      if (mountedRef.current) {
        setMessage({ type: "error", text: getSubscriptionErrorMessage(error, "Không thể mở gói lúc này. Vui lòng thử lại.") });
      }
    } finally {
      prepareInFlightRef.current = false;
      if (mountedRef.current) setIsPreparingCheckout(false);
    }
  };

  const closeCheckout = () => {
    if (isSubmittingCheckout) return;
    setCheckoutPackage(null);
    setPaymentMethod(null);
  };

  const openExternalCheckout = async (checkoutUrl: string, subscriptionId: string, checkoutExpiresAt: string | null) => {
    if (Platform.OS === "web") {
      const opened = window.open(checkoutUrl, "_self");
      if (!opened) throw new Error("Trình duyệt đã chặn trang thanh toán. Vui lòng cho phép mở cửa sổ mới và thử lại.");
      return;
    }
    const result = await WebBrowser.openBrowserAsync(checkoutUrl);
    if (!mountedRef.current) return;
    if (result.type === "cancel" || result.type === "dismiss") {
      const status = await reconcileStatus(subscriptionId, { silent: true });
      if (!status || (String(status.paymentStatus) === "Pending" && status.subscriptionStatus === "Pending")) {
        setMessage({ type: "info", text: "Đang chờ thanh toán. Nếu bạn đã thanh toán, trạng thái sẽ tự cập nhật." });
        startPolling(subscriptionId, status?.checkoutExpiresAt ?? checkoutExpiresAt);
      }
    }
  };

  const submitCheckout = async () => {
    if (checkoutInFlightRef.current || !checkoutPackage || !paymentMethod) return;
    checkoutInFlightRef.current = true;
    setIsSubmittingCheckout(true);
    try {
      if (paymentMethod === "wallet") {
        const result = await subscriptionApi.walletCheckout(checkoutPackage.packageId);
        if (!mountedRef.current) return;
        const activated = result && String(result.paymentStatus) === "Completed" && result.subscriptionStatus === "Active";
        setCheckoutPackage(null);
        setPaymentMethod(null);
        // Backend đã kích hoạt trong cùng giao dịch: lấy trạng thái có thẩm quyền rồi mới hiện VIP.
        await Promise.all([refreshSubscription(), refreshBenefits()]);
        setMessage(
          activated
            ? { type: "success", text: "Thanh toán bằng ví thành công. Gói VIP đã được kích hoạt." }
            : { type: "info", text: "Đã ghi nhận thanh toán. Trạng thái gói sẽ được cập nhật trong giây lát." },
        );
        return;
      }

      const returnUrl =
        Platform.OS === "web"
          ? `${window.location.origin}/subscription?payos=return`
          : Linking.createURL("/subscription", { queryParams: { payos: "return" } });
      const cancelUrl =
        Platform.OS === "web"
          ? `${window.location.origin}/subscription?payos=cancel`
          : Linking.createURL("/subscription", { queryParams: { payos: "cancel" } });
      const checkout = await subscriptionApi.payosCheckout(checkoutPackage.packageId, { returnUrl, cancelUrl });
      if (!mountedRef.current) return;
      if (!checkout) throw new Error("Không nhận được liên kết thanh toán từ hệ thống.");
      const stored: StoredSubscriptionCheckout = {
        subscriptionId: checkout.subscriptionId,
        checkoutUrl: checkout.checkoutUrl,
        checkoutExpiresAt: checkout.checkoutExpiresAt,
        createdAt: Date.now(),
      };
      await subscriptionCheckoutStore.save(userId, stored);
      setStoredCheckout(stored);
      setCheckoutPackage(null);
      setPaymentMethod(null);
      // Pending vừa tạo → context phản ánh Pending (không phải VIP).
      void refreshSubscription();
      setMessage({ type: "info", text: "Đang mở trang thanh toán PayOS..." });
      await openExternalCheckout(checkout.checkoutUrl, checkout.subscriptionId, checkout.checkoutExpiresAt);
    } catch (error) {
      devLog("[subscription] Lỗi thanh toán gói:", error);
      if (mountedRef.current) {
        setMessage({ type: "error", text: getSubscriptionErrorMessage(error, "Không thể thanh toán gói lúc này. Vui lòng thử lại.") });
        void refreshSubscription();
      }
    } finally {
      checkoutInFlightRef.current = false;
      if (mountedRef.current) setIsSubmittingCheckout(false);
    }
  };

  const continuePendingCheckout = async () => {
    if (!storedCheckout || checkoutInFlightRef.current) return;
    if (!isCheckoutSessionOpen(storedCheckout.checkoutExpiresAt)) {
      setMessage({ type: "info", text: "Phiên thanh toán đã hết hạn. Vui lòng kiểm tra trạng thái để tạo thanh toán mới." });
      return;
    }
    checkoutInFlightRef.current = true;
    setIsSubmittingCheckout(true);
    try {
      await openExternalCheckout(storedCheckout.checkoutUrl, storedCheckout.subscriptionId, storedCheckout.checkoutExpiresAt);
    } catch (error) {
      devLog("[subscription] Không mở lại được trang thanh toán:", error);
      if (mountedRef.current) setMessage({ type: "error", text: "Không thể mở lại trang thanh toán lúc này." });
    } finally {
      checkoutInFlightRef.current = false;
      if (mountedRef.current) setIsSubmittingCheckout(false);
    }
  };

  const checkPendingStatus = async () => {
    const pendingId = current?.status === "Pending" ? current.subscriptionId : storedCheckout?.subscriptionId;
    if (!pendingId) return;
    const status = await reconcileStatus(pendingId);
    if (status && String(status.paymentStatus) === "Pending" && status.subscriptionStatus === "Pending") {
      startPolling(pendingId, status.checkoutExpiresAt);
    }
  };

  // ---------------------------------------------------------------- hủy gói

  const confirmCancel = async () => {
    if (cancelInFlightRef.current || !current || current.status !== "Active") return;
    cancelInFlightRef.current = true;
    setIsCancelling(true);
    try {
      await subscriptionApi.cancelMySubscription(current.subscriptionId);
      if (!mountedRef.current) return;
      setShowCancelConfirm(false);
      await Promise.all([refreshSubscription(), refreshBenefits()]);
      setMessage({ type: "success", text: "Đã hủy gói VIP. Quyền lợi VIP kết thúc kể từ bây giờ." });
    } catch (error) {
      devLog("[subscription] Lỗi hủy gói:", error);
      if (mountedRef.current) {
        setShowCancelConfirm(false);
        setMessage({ type: "error", text: getSubscriptionErrorMessage(error, "Không thể hủy gói lúc này. Vui lòng thử lại.") });
        void refreshSubscription();
      }
    } finally {
      cancelInFlightRef.current = false;
      if (mountedRef.current) setIsCancelling(false);
    }
  };

  // ---------------------------------------------------------------- render helpers

  const currentExpiresAt = parseTime(current?.expiresAt);
  const hasActiveLifecycle = current?.status === "Active" && currentExpiresAt !== null && currentExpiresAt > Date.now();
  const hasEffectiveVipTier = subscription.benefits?.tier === "VIP";
  const isVipStateReconciling = !isVip && (hasActiveLifecycle || hasEffectiveVipTier);

  const purchaseButtonLabel = (pkg: SubscriptionPackage) => {
    if (!isAuthenticated) return "Đăng nhập để nâng cấp";
    if (userRole && !sameRole(pkg.targetRole, userRole)) return "Không áp dụng";
    if (subscription.loading && !current) return "Đang tải trạng thái";
    if (isPending) return "Đang chờ thanh toán";
    if (isVipStateReconciling) return "Đang cập nhật trạng thái";
    if (isVip && current?.packageId === pkg.packageId) return "Gói hiện tại";
    if (isVip) return "Đang dùng gói khác";
    return "Nâng cấp VIP";
  };
  const isPurchaseDisabled = (pkg: SubscriptionPackage) =>
    isPreparingCheckout ||
    (subscription.loading && !current) ||
    (isAuthenticated && ((userRole && !sameRole(pkg.targetRole, userRole)) || isPending || isVip || isVipStateReconciling));

  const pendingCountdown = formatRemaining(current?.checkoutExpiresAt, now);
  const storedMatchesPending = Boolean(storedCheckout && current?.status === "Pending" && storedCheckout.subscriptionId === current.subscriptionId);
  const canContinuePayment = storedMatchesPending && isCheckoutSessionOpen(storedCheckout?.checkoutExpiresAt ?? current?.checkoutExpiresAt, now);

  const renderBenefits = (
    benefits: readonly (SubscriptionPackage["entitlements"][number] | BenefitRow)[],
  ) => {
    const rows = getOrderedSubscriptionBenefits(benefits, userRole);
    if (rows.length === 0) return null;
    return (
      <View style={styles.entitlementList}>
        {rows.map((row) => (
          <View key={row.key} style={styles.entitlementRow}>
            <Ionicons
              name={row.available === false ? "close-circle" : "checkmark-circle"}
              size={15}
              color={row.available === false ? COLORS.textLight : COLORS.success}
            />
            <Text style={styles.entitlementLabel} numberOfLines={2}>{row.label}</Text>
            <Text style={styles.entitlementValue}>{row.value}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderEffectiveAiUsage = (tier: PlanDefinition["tier"]) => {
    const effectiveBenefits = subscription.benefits;
    const ai = effectiveBenefits?.ai;
    if (!effectiveBenefits || effectiveBenefits.tier !== tier || effectiveBenefits.role.toLowerCase() !== userRole || !ai) {
      return null;
    }

    const usageName = userRole === "business" ? "gợi ý nhà cung cấp" : "gợi ý giá";
    let primaryText: string | null = null;
    if (ai.remainingToday !== null && ai.dailyLimit !== null) {
      primaryText = `Còn ${ai.remainingToday.toLocaleString("vi-VN")}/${ai.dailyLimit.toLocaleString("vi-VN")} lượt ${usageName} hôm nay`;
    } else if (ai.remainingToday !== null) {
      primaryText = `Còn ${ai.remainingToday.toLocaleString("vi-VN")} lượt ${usageName} hôm nay`;
    } else if (ai.dailyLimit !== null) {
      primaryText = `Hạn mức ${ai.dailyLimit.toLocaleString("vi-VN")} lượt ${usageName} mỗi ngày`;
    }

    const detailParts: string[] = [];
    if (ai.usedToday !== null) detailParts.push(`Đã dùng ${ai.usedToday.toLocaleString("vi-VN")}`);
    if (ai.resetsAt && parseTime(ai.resetsAt) !== null) detailParts.push(`Làm mới lúc ${formatDateTime(ai.resetsAt)}`);
    if (!primaryText && detailParts.length === 0) return null;

    return (
      <View style={styles.usageBox}>
        {primaryText ? <Text style={styles.usageText}>{primaryText}</Text> : null}
        {detailParts.length > 0 ? <Text style={styles.cardHint}>{detailParts.join(" · ")}</Text> : null}
      </View>
    );
  };

  const renderFreePlan = () => {
    const isCurrentFreePlan =
      isAuthenticated && !isVip && !isVipStateReconciling && (!subscription.loading || current !== null);
    const freeBenefits: BenefitRow[] = [];
    const roleMatchesDefinition = freePlan?.role.toLowerCase() === userRole;
    if (roleMatchesDefinition && freePlan?.aiDailyLimit !== null && freePlan?.aiDailyLimit !== undefined) {
      const aiFeature = freePlan.aiFeature?.toUpperCase() ?? "";
      const isSupplierFeature = aiFeature.includes("SUPPLIER") || userRole === "business";
      freeBenefits.push({
        key: isSupplierFeature ? "ai.supplier_match.daily_count" : "ai.price_suggestion.daily_count",
        label: isSupplierFeature ? "Lượt AI gợi ý nhà cung cấp mỗi ngày" : "Lượt AI gợi ý giá mỗi ngày",
        value: freePlan.aiDailyLimit.toLocaleString("vi-VN"),
      });
    }
    if (roleMatchesDefinition && userRole === "business" && freePlan?.supplierMatching) {
      const supplier = freePlan.supplierMatching;
      if (supplier.resultLimit !== null) {
        freeBenefits.push({
          key: "supplier_matching.result_limit",
          label: "Số kết quả nhà cung cấp tối đa",
          value: supplier.resultLimit.toLocaleString("vi-VN"),
        });
      }
      const booleanBenefits: { key: string; label: string; value: boolean | null }[] = [
        { key: "supplier_matching.ai_reranking_enabled", label: "AI sắp xếp kết quả phù hợp", value: supplier.aiRerankingEnabled },
        { key: "supplier_matching.advanced_filters_enabled", label: "Bộ lọc nâng cao", value: supplier.advancedFiltersEnabled },
        { key: "supplier_matching.detailed_reasons_enabled", label: "Giải thích chi tiết kết quả", value: supplier.detailedReasonsEnabled },
        { key: "supplier_matching.new_supplier_notifications_enabled", label: "Thông báo nguồn cung phù hợp mới", value: supplier.newSupplierNotificationsEnabled },
      ];
      booleanBenefits.forEach((benefit) => {
        if (benefit.value !== null) {
          freeBenefits.push({
            key: benefit.key,
            label: benefit.label,
            value: benefit.value ? "Có" : "Không",
            available: benefit.value,
          });
        }
      });
    }

    return (
      <View style={[styles.card, styles.planCard, isCurrentFreePlan && styles.cardCurrentFree]}>
        <View style={styles.cardHeaderRow}>
          <Text style={styles.packageName}>{roleMatchesDefinition && freePlan?.planName
            ? localizeSystemText(freePlan.planName, "Gói Miễn phí")
            : "Gói Miễn phí"}</Text>
          {isCurrentFreePlan ? <View style={styles.freePill}><Text style={styles.freePillText}>Đang dùng</Text></View> : null}
        </View>
        <Text style={styles.packagePrice}>0 đ</Text>
        <Text style={styles.cardText}>
          {roleMatchesDefinition && freePlan?.description
            ? localizeSystemText(
                freePlan.description,
                "Sử dụng các tính năng cơ bản của HomeCycle theo hạn mức hiện tại.",
              )
            : "Sử dụng các tính năng cơ bản của HomeCycle theo hạn mức hiện tại."}
        </Text>
        {renderBenefits(freeBenefits)}
        {isCurrentFreePlan ? renderEffectiveAiUsage("FREE") : null}
        {lastStatus && current === null && String(lastStatus.paymentStatus) !== "Completed" ? (
          <Text style={styles.cardHint}>Phiên thanh toán gần nhất đã kết thúc. Bạn có thể nâng cấp lại bất cứ lúc nào.</Text>
        ) : null}
        <TouchableOpacity
          style={[styles.secondaryButton, styles.planButton, styles.buttonDisabled]}
          disabled
          accessibilityRole="button"
          accessibilityState={{ disabled: true }}
        >
          <Text style={styles.secondaryButtonText}>{isCurrentFreePlan ? "Gói hiện tại" : "Gói miễn phí"}</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderPackage = (pkg: SubscriptionPackage) => {
    const label = purchaseButtonLabel(pkg);
    const disabled = isPurchaseDisabled(pkg);
    const isCurrentPackage = isVip && current?.packageId === pkg.packageId;
    const isPendingPackage = isPending && current?.packageId === pkg.packageId;
    return (
      <View
        key={pkg.packageId}
        style={[
          styles.card,
          styles.planCard,
          styles.packageCard,
          isCurrentPackage && styles.cardVip,
          isPendingPackage && styles.cardPending,
        ]}
      >
        <View style={styles.cardHeaderRow}>
          <Text style={styles.packageName} numberOfLines={2}>
            {localizeSystemText(pkg.name, "Gói VIP")}
          </Text>
          <View style={styles.planBadgeRow}>
            {isCurrentPackage ? <VipCrownBadge size="medium" withLabel /> : <Ionicons name="star" size={18} color="#C8951A" />}
            {isPendingPackage ? <View style={styles.pendingPill}><Text style={styles.pendingPillText}>Đang chờ thanh toán</Text></View> : null}
          </View>
        </View>
        <Text style={styles.packagePrice}>{formatCurrency(pkg.price)} <Text style={styles.packageDuration}>/ {pkg.duration} ngày</Text></Text>
        {pkg.description ? (
          <Text style={styles.cardText}>
            {localizeSystemText(pkg.description, "Gói quyền lợi VIP của HomeCycle.")}
          </Text>
        ) : null}
        {renderBenefits(pkg.entitlements)}
        {isCurrentPackage ? renderEffectiveAiUsage("VIP") : null}
        {isCurrentPackage && current ? (
          <View style={styles.currentPlanDetails}>
            <Text style={styles.cardText}>Hiệu lực đến: <Text style={styles.strong}>{formatDateTime(current.expiresAt)}</Text></Text>
          </View>
        ) : null}
        {isPendingPackage && current ? (
          <View style={styles.currentPlanDetails}>
            <Text style={styles.currentPlanDetailsTitle}>Thông tin thanh toán đang chờ</Text>
            {current.checkoutAmount !== null ? <Text style={styles.cardText}>Số tiền: <Text style={styles.strong}>{formatCurrency(current.checkoutAmount)}</Text></Text> : null}
            <Text style={styles.cardText}>
              Phiên thanh toán hết hạn: {formatDateTime(current.checkoutExpiresAt)}
              {pendingCountdown ? ` (còn ${pendingCountdown})` : ""}
            </Text>
            <Text style={styles.cardHint}>Gói chỉ có hiệu lực sau khi thanh toán được xác nhận. Bạn chưa thể mua gói khác trong lúc này.</Text>
          </View>
        ) : null}
        <TouchableOpacity
          style={[styles.primaryButton, styles.planButton, disabled && styles.buttonDisabled]}
          onPress={() => void openCheckout(pkg)}
          disabled={disabled}
          accessibilityRole="button"
          accessibilityState={{ disabled }}
        >
          {isPreparingCheckout ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>{label}</Text>}
        </TouchableOpacity>
        {isCurrentPackage ? (
          <TouchableOpacity
            style={[styles.secondaryButton, isCancelling && styles.buttonDisabled]}
            onPress={() => setShowCancelConfirm(true)}
            disabled={isCancelling}
            accessibilityRole="button"
            accessibilityState={{ disabled: isCancelling }}
          >
            <Text style={styles.secondaryButtonText}>Hủy gói VIP</Text>
          </TouchableOpacity>
        ) : null}
        {isPendingPackage ? (
          <View style={styles.actionRow}>
            {canContinuePayment ? (
              <TouchableOpacity
                style={[styles.primaryButton, styles.actionButton, isSubmittingCheckout && styles.buttonDisabled]}
                onPress={() => void continuePendingCheckout()}
                disabled={isSubmittingCheckout}
                accessibilityRole="button"
                accessibilityState={{ disabled: isSubmittingCheckout }}
              >
                {isSubmittingCheckout ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>Tiếp tục thanh toán</Text>}
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={[styles.secondaryButton, styles.actionButton, isCheckingStatus && styles.buttonDisabled]}
              onPress={() => void checkPendingStatus()}
              disabled={isCheckingStatus}
              accessibilityRole="button"
              accessibilityState={{ disabled: isCheckingStatus }}
            >
              {isCheckingStatus ? <ActivityIndicator color={COLORS.primary} /> : <Text style={styles.secondaryButtonText}>Kiểm tra trạng thái</Text>}
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    );
  };

  const checkoutBalanceEnough = walletBalance !== null && checkoutPackage !== null && walletBalance >= checkoutPackage.price;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Gói đăng ký VIP" showBack />
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => {
              setIsRefreshing(true);
              void loadAll().finally(() => mountedRef.current && setIsRefreshing(false));
            }}
            tintColor={COLORS.primary}
          />
        }
      >
        {message ? (
          <View style={[styles.messageBox, message.type === "error" ? styles.messageError : message.type === "success" ? styles.messageSuccess : styles.messageInfo]}>
            <Text style={[styles.messageText, message.type === "error" ? styles.messageErrorText : message.type === "success" ? styles.messageSuccessText : styles.messageInfoText]}>
              {message.text}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionTitle}>Các gói dành cho bạn</Text>
        {renderFreePlan()}
        {isLoadingPackages ? (
          <View style={[styles.card, styles.centered]}><ActivityIndicator color={COLORS.primary} /></View>
        ) : packagesError ? (
          <View style={styles.card}>
            <Text style={styles.cardText}>{packagesError}</Text>
            <TouchableOpacity style={styles.secondaryButton} onPress={() => void loadPackages()} accessibilityRole="button">
              <Text style={styles.secondaryButtonText}>Thử lại</Text>
            </TouchableOpacity>
          </View>
        ) : applicablePackages.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.cardText}>
              {isAuthenticated ? "Hiện chưa có gói VIP dành cho loại tài khoản của bạn." : "Hiện chưa có gói VIP nào đang mở bán."}
            </Text>
          </View>
        ) : (
          applicablePackages.map(renderPackage)
        )}
        {otherPackages.length > 0 ? (
          <Text style={styles.footnote}>Các gói dành cho loại tài khoản khác không hiển thị ở đây.</Text>
        ) : null}
      </ScrollView>

      {/* Xác nhận mua */}
      <Modal visible={checkoutPackage !== null} transparent animationType="fade" onRequestClose={closeCheckout}>
        <ModalBackdrop style={styles.sheetBackdrop} onPress={closeCheckout}>
          <ModalSurface style={styles.sheet}>
            {checkoutPackage ? (
              <>
                <Text style={styles.sheetTitle}>Xác nhận nâng cấp</Text>
                <Text style={styles.cardText}>
                  Gói:{" "}
                  <Text style={styles.strong}>
                    {localizeSystemText(checkoutPackage.name, "Gói VIP")}
                  </Text>
                </Text>
                <Text style={styles.cardText}>Giá: <Text style={styles.strong}>{formatCurrency(checkoutPackage.price)}</Text> · {checkoutPackage.duration} ngày</Text>
                {renderBenefits(checkoutPackage.entitlements)}

                <Text style={styles.sheetLabel}>Phương thức thanh toán</Text>
                {(
                  [
                    { key: "wallet" as const, title: "Ví HomeCycle", icon: "wallet-outline" as const, hint: walletBalance === null ? "Chưa tải được số dư" : `Số dư khả dụng: ${formatCurrency(walletBalance)}` },
                    { key: "payos" as const, title: "PayOS", icon: "card-outline" as const, hint: "Thanh toán qua trình duyệt an toàn" },
                  ]
                ).map((method) => {
                  const selected = paymentMethod === method.key;
                  const insufficient = method.key === "wallet" && walletBalance !== null && !checkoutBalanceEnough;
                  return (
                    <TouchableOpacity
                      key={method.key}
                      style={[styles.methodRow, selected && styles.methodRowActive]}
                      // Chạm lại phương thức đang chọn để bỏ chọn (quy tắc bỏ chọn toàn ứng dụng).
                      onPress={() => setPaymentMethod((currentMethod) => (currentMethod === method.key ? null : method.key))}
                      disabled={isSubmittingCheckout}
                      accessibilityRole="radio"
                      accessibilityState={{ selected, disabled: isSubmittingCheckout }}
                    >
                      <Ionicons name={method.icon} size={20} color={selected ? COLORS.primary : COLORS.textLight} />
                      <View style={{ flex: 1 }}>
                        <Text style={styles.methodTitle}>{method.title}</Text>
                        <Text style={[styles.methodHint, insufficient && styles.methodHintWarning]}>
                          {insufficient ? `${method.hint} · không đủ để thanh toán` : method.hint}
                        </Text>
                      </View>
                      <Ionicons name={selected ? "radio-button-on" : "radio-button-off"} size={20} color={selected ? COLORS.primary : COLORS.border} />
                    </TouchableOpacity>
                  );
                })}
                {paymentMethod === "wallet" && walletBalance !== null && !checkoutBalanceEnough ? (
                  <Text style={styles.fieldError}>Số dư ví không đủ để thanh toán gói này. Hãy nạp thêm hoặc chọn PayOS.</Text>
                ) : null}

                <View style={styles.actionRow}>
                  <TouchableOpacity style={[styles.secondaryButton, styles.actionButton]} onPress={closeCheckout} disabled={isSubmittingCheckout} accessibilityRole="button">
                    <Text style={styles.secondaryButtonText}>Đóng</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      styles.actionButton,
                      (!paymentMethod || isSubmittingCheckout || (paymentMethod === "wallet" && walletBalance !== null && !checkoutBalanceEnough)) && styles.buttonDisabled,
                    ]}
                    onPress={() => void submitCheckout()}
                    disabled={!paymentMethod || isSubmittingCheckout || (paymentMethod === "wallet" && walletBalance !== null && !checkoutBalanceEnough)}
                    accessibilityRole="button"
                  >
                    {isSubmittingCheckout ? (
                      <ActivityIndicator color={COLORS.white} />
                    ) : (
                      <Text style={styles.primaryButtonText}>{paymentMethod === "payos" ? "Thanh toán qua PayOS" : "Xác nhận thanh toán"}</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : null}
          </ModalSurface>
        </ModalBackdrop>
      </Modal>

      {/* Xác nhận hủy */}
      <Modal visible={showCancelConfirm} transparent animationType="fade" onRequestClose={() => !isCancelling && setShowCancelConfirm(false)}>
        <ModalBackdrop style={styles.centerBackdrop} onPress={() => !isCancelling && setShowCancelConfirm(false)}>
          <ModalSurface style={styles.dialog}>
            <Text style={styles.sheetTitle}>Hủy gói VIP?</Text>
            <Text style={styles.cardText}>Bạn sẽ mất quyền lợi VIP ngay sau khi hủy.</Text>
            <Text style={styles.cardText}>Khoản thanh toán hiện tại không được tự động hoàn lại.</Text>
            <View style={styles.actionRow}>
              <TouchableOpacity style={[styles.secondaryButton, styles.actionButton]} onPress={() => setShowCancelConfirm(false)} disabled={isCancelling} accessibilityRole="button">
                <Text style={styles.secondaryButtonText}>Giữ gói</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.dangerButton, styles.actionButton, isCancelling && styles.buttonDisabled]} onPress={() => void confirmCancel()} disabled={isCancelling} accessibilityRole="button">
                {isCancelling ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.primaryButtonText}>Hủy gói</Text>}
              </TouchableOpacity>
            </View>
          </ModalSurface>
        </ModalBackdrop>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  content: { padding: 16, paddingBottom: 32, gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text, marginTop: 4 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
    gap: 6,
  },
  cardVip: { borderColor: "#C8951A", backgroundColor: "#FFFBF0" },
  cardPending: { borderColor: "rgba(84, 123, 125, 0.4)" },
  planCard: { padding: 14 },
  cardCurrentFree: { borderColor: "rgba(43, 86, 89, 0.45)", backgroundColor: "rgba(43, 86, 89, 0.03)" },
  packageCard: { borderColor: "rgba(43, 86, 89, 0.35)" },
  centered: { alignItems: "center", justifyContent: "center", minHeight: 72 },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  cardTitle: { fontSize: 15, fontWeight: "700", color: COLORS.text, flexShrink: 1 },
  cardText: { fontSize: 13, lineHeight: 19, color: COLORS.text },
  cardHint: { fontSize: 12, lineHeight: 17, color: COLORS.textLight },
  strong: { fontWeight: "700", color: COLORS.primary },
  packageName: { fontSize: 16, fontWeight: "800", color: COLORS.text, flex: 1 },
  packagePrice: { fontSize: 20, fontWeight: "800", color: COLORS.primary },
  packageDuration: { fontSize: 13, fontWeight: "600", color: COLORS.textLight },
  planBadgeRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", gap: 6, flexShrink: 1 },
  currentPlanDetails: { borderTopWidth: 1, borderTopColor: COLORS.border, marginTop: 6, paddingTop: 10, gap: 4 },
  currentPlanDetailsTitle: { fontSize: 13, fontWeight: "700", color: COLORS.text },
  usageBox: { borderRadius: 8, backgroundColor: "rgba(43, 86, 89, 0.06)", paddingHorizontal: 10, paddingVertical: 8, gap: 2, marginTop: 4 },
  usageText: { fontSize: 13, lineHeight: 18, fontWeight: "700", color: COLORS.primary },
  entitlementList: { gap: 6, marginTop: 4 },
  entitlementRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  entitlementLabel: { flex: 1, fontSize: 13, color: COLORS.text },
  entitlementValue: { fontSize: 13, fontWeight: "700", color: COLORS.primary, maxWidth: "45%", textAlign: "right" },
  pendingPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(84, 123, 125, 0.14)" },
  pendingPillText: { fontSize: 11, fontWeight: "700", color: COLORS.primary },
  freePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: "rgba(23, 40, 48, 0.08)" },
  freePillText: { fontSize: 11, fontWeight: "700", color: COLORS.textLight },
  actionRow: { flexDirection: "row", gap: 10, marginTop: 8 },
  actionButton: { flex: 1 },
  planButton: { marginTop: 10 },
  primaryButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    marginTop: 6,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "700", fontSize: 14 },
  secondaryButton: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    marginTop: 6,
  },
  secondaryButtonText: { color: COLORS.primary, fontWeight: "700", fontSize: 14 },
  dangerButton: {
    minHeight: 44,
    borderRadius: 10,
    backgroundColor: COLORS.error,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
    marginTop: 6,
  },
  buttonDisabled: { opacity: 0.55 },
  footnote: { fontSize: 12, color: COLORS.textLight, textAlign: "center", marginTop: 4 },
  messageBox: { borderWidth: 1, borderRadius: 10, padding: 11 },
  messageText: { fontSize: 12, lineHeight: 18 },
  messageError: { borderColor: "rgba(122, 16, 18, 0.35)", backgroundColor: "rgba(122, 16, 18, 0.06)" },
  messageErrorText: { color: COLORS.error },
  messageSuccess: { borderColor: "rgba(47, 118, 93, 0.35)", backgroundColor: "rgba(47, 118, 93, 0.08)" },
  messageSuccessText: { color: COLORS.success },
  messageInfo: { borderColor: "rgba(84, 123, 125, 0.35)", backgroundColor: "rgba(84, 123, 125, 0.08)" },
  messageInfoText: { color: COLORS.primary },
  fieldError: { color: COLORS.error, fontSize: 12, lineHeight: 17 },
  sheetBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(23, 40, 48, 0.45)" },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    padding: 16,
    paddingBottom: 20,
    gap: 6,
    maxHeight: "88%",
  },
  sheetTitle: { fontSize: 16, fontWeight: "800", color: COLORS.text, marginBottom: 4 },
  sheetLabel: { fontSize: 13, fontWeight: "700", color: COLORS.text, marginTop: 8 },
  methodRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 6,
  },
  methodRowActive: { borderColor: COLORS.primary, backgroundColor: "rgba(43, 86, 89, 0.06)" },
  methodTitle: { fontSize: 14, fontWeight: "700", color: COLORS.text },
  methodHint: { fontSize: 12, color: COLORS.textLight, marginTop: 2 },
  methodHintWarning: { color: COLORS.error },
  centerBackdrop: { flex: 1, justifyContent: "center", paddingHorizontal: 24, backgroundColor: "rgba(23, 40, 48, 0.45)" },
  dialog: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, gap: 6 },
});
