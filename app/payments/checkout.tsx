import { Ionicons } from "@expo/vector-icons";
import * as Linking from "expo-linking";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  AppState,
  Modal,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../../src/components/shared/Header";
import { ModalBackdrop, ModalSurface } from "../../src/components/shared/ModalBackdrop";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import { devLog } from "../../src/utils/devLog";
import {
  getApiErrorMessage,
  getApiSuccessMessage,
} from "../../src/utils/apiFeedback";
import { readSafeApiMessage } from "../../src/utils/errorMessage";
import { useAutoDismissFeedback } from "../../src/utils/useAutoDismissFeedback";
import { useGuardedRouter } from "../../src/utils/tapGuard";

type FeedbackState = {
  type: "error" | "success" | "info";
  text: string;
} | null;

type PaymentQuote = {
  paymentType: string | number;
  depositRatePercent: number;
  baseAmount: number;
  shippingFee: number;
  amountToPay: number;
};

const agreementApi = {
  getAgreementById: (agreementId: string) =>
    apiClient
      .get(`/agreements/${agreementId}`)
      .then((response) => response.data),
};

const paymentApi = {
  getQuote: (agreementId: string) =>
    apiClient
      .get(`/payments/${agreementId}/quote`)
      .then((response) => response.data),

  checkoutWithPayOS: (
    agreementId: string,
    payload: { returnUrl: string; cancelUrl: string },
  ) =>
    apiClient
      .post(`/payments/payos/checkout/${agreementId}`, payload)
      .then((response) => response.data),

  checkoutWithWallet: (agreementId: string) =>
    apiClient
      .post(`/payments/wallet/checkout/${agreementId}`)
      .then((response) => response.data),

  // Trạng thái thanh toán do Backend xác nhận (không suy ra từ trình duyệt/URL).
  getStatus: (agreementId: string) =>
    apiClient
      .get(`/payments/${agreementId}/status`)
      .then((response) => response.data),
};

const isCompletedPaymentStatus = (value: unknown) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "completed" || normalized === "1";
};

const walletApi = {
  getMyWallet: () =>
    apiClient.get("/wallet/me").then((response) => response.data),
};

const unwrap = (value: any) => value?.data ?? value;

const normalizeEnum = (value: unknown) =>
  String(value ?? "").trim().toLowerCase();

const normalizeId = (value: unknown) =>
  String(value ?? "").trim().toLowerCase();

const normalizePaymentQuote = (value: any): PaymentQuote => {
  const data = unwrap(value);
  const quote: PaymentQuote = {
    paymentType: data?.paymentType,
    depositRatePercent: Number(data?.depositRatePercent),
    baseAmount: Number(data?.baseAmount),
    shippingFee: Number(data?.shippingFee),
    amountToPay: Number(data?.amountToPay),
  };

  if (
    (quote.paymentType === null || quote.paymentType === undefined) ||
    ![quote.depositRatePercent, quote.baseAmount, quote.shippingFee, quote.amountToPay]
      .every((amount) => Number.isFinite(amount) && amount >= 0)
  ) {
    throw new Error("Báo giá thanh toán từ hệ thống không hợp lệ.");
  }

  return quote;
};

function InlineFeedback({ feedback }: { feedback: FeedbackState }) {
  if (!feedback) return null;

  const palette =
    feedback.type === "error"
      ? {
          backgroundColor: "rgba(122, 16, 18, 0.08)",
          borderColor: "rgba(122, 16, 18, 0.22)",
          color: "#7A1012",
          icon: "alert-circle-outline" as const,
        }
      : feedback.type === "success"
        ? {
            backgroundColor: "rgba(47, 118, 93, 0.10)",
            borderColor: "rgba(47, 118, 93, 0.24)",
            color: "#2F765D",
            icon: "checkmark-circle-outline" as const,
          }
        : {
            backgroundColor: "rgba(84, 123, 125, 0.10)",
            borderColor: "rgba(84, 123, 125, 0.24)",
            color: "#2B5659",
            icon: "information-circle-outline" as const,
          };

  return (
    <View
      style={[
        styles.inlineFeedback,
        {
          backgroundColor: palette.backgroundColor,
          borderColor: palette.borderColor,
        },
      ]}
    >
      <Ionicons name={palette.icon} size={18} color={palette.color} />
      <Text style={[styles.inlineFeedbackText, { color: palette.color }]}>
        {feedback.text}
      </Text>
    </View>
  );
}

export default function CheckoutScreen() {
  const router = useGuardedRouter();
  const params = useLocalSearchParams();
  const { user } = useAuth();

  const agreementId = Array.isArray(params.agreementId)
    ? params.agreementId[0]
    : params.agreementId;

  const [agreement, setAgreement] = useState<any>(null);
  const [quote, setQuote] = useState<PaymentQuote | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [walletLoadError, setWalletLoadError] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isPaymentCompleted, setIsPaymentCompleted] = useState(false);
  // Đã mở PayOS ở trình duyệt ngoài và chưa nhận được kết quả trong ứng dụng.
  const externalCheckoutPendingRef = useRef(false);
  const reconcileInFlightRef = useRef(false);
  // Mỗi lần bấm thanh toán: tối đa MỘT yêu cầu tạo checkout và MỘT phiên trình duyệt.
  const submitInFlightRef = useRef(false);
  const browserSessionOpenRef = useRef(false);
  // Callback từ PayOS (deep link + kết quả phiên trình duyệt) chỉ xử lý một lần
  // cho mỗi lần quay về; điều hướng sang màn thành công cũng chỉ một lần.
  const handledReturnKeyRef = useRef<string | null>(null);
  const navigatedToSuccessRef = useRef(false);
  const lastReconcileAtRef = useRef(0);
  // Đang đối chiếu kết quả PayOS sau khi quay về: chặn hiển thị lại màn thanh toán cũ.
  const [isReconcilingReturn, setIsReconcilingReturn] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"wallet" | "payos">(
    "wallet",
  );
  const [hasAcceptedTerms, setHasAcceptedTerms] = useState(false);
  const [showLowAmountConfirm, setShowLowAmountConfirm] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  useAutoDismissFeedback(feedback, () => setFeedback(null));

  const clearFeedback = useCallback(() => setFeedback(null), []);
  const showError = useCallback(
    (text: string) => setFeedback({ type: "error", text }),
    [],
  );
  const showInfo = useCallback(
    (text: string) => setFeedback({ type: "info", text }),
    [],
  );
  const showSuccess = useCallback(
    (text: string) => setFeedback({ type: "success", text }),
    [],
  );

  const fetchCheckoutData = useCallback(async () => {
    if (!agreementId) {
      setAgreement(null);
      setQuote(null);
      setWallet(null);
      setIsLoading(false);
      showError("Không tìm thấy mã hợp đồng cần thanh toán.");
      return false;
    }

    try {
      setIsLoading(true);
      clearFeedback();
      setWalletLoadError("");

      const [agreementResult, quoteResult, walletResult] = await Promise.allSettled([
        agreementApi.getAgreementById(agreementId),
        paymentApi.getQuote(agreementId),
        walletApi.getMyWallet(),
      ]);

      if (agreementResult.status === "rejected") {
        throw agreementResult.reason;
      }
      if (quoteResult.status === "rejected") {
        throw quoteResult.reason;
      }

      setAgreement(unwrap(agreementResult.value));
      setQuote(normalizePaymentQuote(quoteResult.value));

      if (walletResult.status === "fulfilled") {
        const nextWallet = unwrap(walletResult.value);
        setWallet(nextWallet);

        if (!nextWallet) {
          setWalletLoadError("Không tải được số dư ví lúc này.");
          setPaymentMethod("payos");
        }
      } else {
        setWallet(null);
        setWalletLoadError(
          getApiErrorMessage(walletResult.reason, "Không tải được số dư ví lúc này."),
        );
        setPaymentMethod("payos");
      }

      return true;
    } catch (error: unknown) {
      devLog("[checkout] Lỗi lấy thông tin thanh toán:", error);
      setAgreement(null);
      setQuote(null);
      const errorCode = String(
        (error as any)?.response?.data?.error?.code ??
          (error as any)?.response?.data?.code ??
          (error as any)?.error?.code ??
          (error as any)?.code ??
          "",
      )
        .trim()
        .toLowerCase();
      const checkoutUnavailableMessage =
        errorCode === "agreement.appointmentschedulemissing"
          ? "Hợp đồng chưa có lịch hẹn hợp lệ. Vui lòng quay lại cập nhật Hợp đồng/lịch hẹn trước khi thanh toán."
          : errorCode === "agreement.appointmentscheduleexpired"
            ? "Lịch hẹn của Hợp đồng đã hết hạn. Vui lòng quay lại cập nhật Hợp đồng/lịch hẹn trước khi thanh toán."
            : errorCode === "auth.forbidden"
              ? "Bạn không có quyền thanh toán Hợp đồng này. Vui lòng kiểm tra lại tài khoản và quyền truy cập."
              : errorCode === "agreement.notfound"
                ? "Không tìm thấy Hợp đồng. Vui lòng quay lại và kiểm tra lại giao dịch."
                : null;
      showError(
        readSafeApiMessage((error as any)?.response?.data ?? error) ||
          checkoutUnavailableMessage ||
          getApiErrorMessage(error, "Không thể tải thông tin thanh toán."),
      );
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [agreementId, clearFeedback, showError]);

  // Người dùng có thể thanh toán xong ở PayOS rồi tự quay lại ứng dụng mà không
  // bấm liên kết trở về: đối chiếu trạng thái với Backend khi màn hình được
  // focus lại hoặc ứng dụng trở lại foreground (một lần cho mỗi sự kiện, không polling).
  // source "return"/"cancel": PayOS đã gọi returnUrl/cancelUrl (deep link về màn này);
  // trạng thái vẫn chỉ lấy từ Backend, không kết luận từ URL. Callback và
  // foreground/focus sát nhau chỉ tạo một lần đối chiếu.
  const reconcileExternalCheckout = useCallback(async (
    source: "return" | "cancel" | "resume" = "resume",
  ) => {
    if (!agreementId || reconcileInFlightRef.current || navigatedToSuccessRef.current) {
      return;
    }
    if (source === "resume") {
      if (!externalCheckoutPendingRef.current) return;
      if (Date.now() - lastReconcileAtRef.current < 1500) return;
    }
    reconcileInFlightRef.current = true;
    // Mọi lần đối chiếu ở đây đều xuất phát từ một phiên PayOS đang chờ (callback
    // hoặc quay lại ứng dụng): che màn thanh toán cũ cho tới khi có kết quả.
    const isReturnCallback = source !== "resume";
    setIsReconcilingReturn(true);
    try {
      const statusResponse = await paymentApi.getStatus(agreementId);
      const statusData = unwrap(statusResponse);
      const rawStatus =
        statusData?.paymentStatus ??
        statusData?.status ??
        statusData?.payment?.paymentStatus ??
        statusData?.payment?.status;
      lastReconcileAtRef.current = Date.now();

      if (isCompletedPaymentStatus(rawStatus)) {
        if (navigatedToSuccessRef.current) return;
        navigatedToSuccessRef.current = true;
        externalCheckoutPendingRef.current = false;
        setIsPaymentCompleted(true);
        clearFeedback();
        router.replace({
          pathname: "/payments/success",
          params: { agreementId },
        });
        return;
      }

      // Chưa ghi nhận thanh toán: bỏ trạng thái "đang mở PayOS" cũ và
      // phản ánh dữ liệu hiện tại; không tự tạo phiên thanh toán mới.
      clearFeedback();
      showInfo(
        source === "cancel"
          ? "Bạn đã hủy hoặc đóng phiên thanh toán. Hợp đồng chưa được thanh toán; bạn có thể thanh toán lại khi sẵn sàng."
          : "Chưa ghi nhận thanh toán cho hợp đồng này. Nếu bạn đã thanh toán, hệ thống sẽ cập nhật trong ít phút; vui lòng không thanh toán lại.",
      );
      await fetchCheckoutData();
    } catch (error) {
      devLog("[checkout] Không đối chiếu được trạng thái thanh toán:", error);
      clearFeedback();
      if (isReturnCallback) {
        showInfo(
          readSafeApiMessage((error as any)?.response?.data) ??
          "Chưa kiểm tra được trạng thái thanh toán. Nếu bạn đã thanh toán, hệ thống sẽ cập nhật trong ít phút; vui lòng không thanh toán lại.",
        );
      }
    } finally {
      reconcileInFlightRef.current = false;
      setIsReconcilingReturn(false);
    }
  }, [agreementId, clearFeedback, fetchCheckoutData, router, showInfo]);

  // PayOS quay về ứng dụng qua deep link /payments/checkout?payos=return|cancel
  // (cả khi ứng dụng đang mở lẫn khi khởi động lại từ liên kết).
  const payosReturnKind = String(
    Array.isArray(params.payos) ? params.payos[0] : params.payos ?? "",
  );
  const handleExternalReturn = useCallback((kind: string) => {
    if (kind !== "return" && kind !== "cancel") return;
    const key = `${agreementId}:${kind}`;
    if (handledReturnKeyRef.current === key) return;
    handledReturnKeyRef.current = key;
    // Hiện trạng thái xác nhận ngay cả khi một lần đối chiếu khác đang chạy;
    // lần đối chiếu đó sẽ tắt trạng thái này khi kết thúc.
    if (agreementId) setIsReconcilingReturn(true);
    void reconcileExternalCheckout(kind);
  }, [agreementId, reconcileExternalCheckout]);

  useEffect(() => {
    handleExternalReturn(payosReturnKind);
  }, [handleExternalReturn, payosReturnKind]);

  const hasUnhandledReturnParam =
    (payosReturnKind === "return" || payosReturnKind === "cancel") &&
    handledReturnKeyRef.current !== `${agreementId}:${payosReturnKind}` &&
    !navigatedToSuccessRef.current;
  const showReturnReconciling = isReconcilingReturn || hasUnhandledReturnParam;

  useFocusEffect(
    useCallback(() => {
      if (externalCheckoutPendingRef.current) {
        void reconcileExternalCheckout();
      } else {
        void fetchCheckoutData();
      }
    }, [fetchCheckoutData, reconcileExternalCheckout]),
  );

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") void reconcileExternalCheckout();
    });
    return () => subscription.remove();
  }, [reconcileExternalCheckout]);

  const isDeposit = ["deposit", "1"].includes(normalizeEnum(quote?.paymentType));
  const depositRatePercent = quote?.depositRatePercent ?? 0;
  const baseAmount = quote?.baseAmount ?? 0;
  const shippingFee = quote?.shippingFee ?? 0;
  const totalPayment = quote?.amountToPay ?? 0;
  const currentUserId = normalizeId(user?.userId || user?.id);
  const buyerId = normalizeId(agreement?.buyerId ?? agreement?.buyerUserId);
  const sellerId = normalizeId(agreement?.sellerId ?? agreement?.sellerUserId);
  const isBuyer = Boolean(currentUserId && buyerId && currentUserId === buyerId);
  const isSeller = Boolean(currentUserId && sellerId && currentUserId === sellerId);

  const availableBalance = Number(
    wallet?.availableBalance ?? wallet?.AvailableBalance ?? 0,
  );
  const hasWalletData = wallet !== null;
  const walletHasEnoughBalance =
    hasWalletData && availableBalance >= totalPayment;
  const isWalletUnavailable = !hasWalletData;
  const isWalletInsufficient =
    hasWalletData && availableBalance < totalPayment;
  const isWalletDisabled =
    isWalletUnavailable || isWalletInsufficient;
  const isWalletSelected =
    paymentMethod === "wallet" && !isWalletDisabled;
  const isSubmitDisabled =
    isProcessing ||
    isPaymentCompleted ||
    !hasAcceptedTerms ||
    isSeller ||
    (paymentMethod === "wallet" && isWalletDisabled);

  React.useEffect(() => {
    if (!isLoading && isWalletDisabled && paymentMethod === "wallet") {
      setPaymentMethod("payos");
    }
  }, [isLoading, isWalletDisabled, paymentMethod]);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("vi-VN", {
      style: "currency",
      currency: "VND",
      maximumFractionDigits: 0,
    }).format(value);

  const openPayOSCheckout = async (checkoutUrl: string) => {
    if (Platform.OS === "web") {
      const openedWindow = window.open(checkoutUrl, "_self");
      if (!openedWindow) {
        throw new Error(
          "Trình duyệt đã chặn trang thanh toán. Vui lòng cho phép mở cửa sổ mới và thử lại.",
        );
      }
      return;
    }

    if (browserSessionOpenRef.current) return;
    browserSessionOpenRef.current = true;
    externalCheckoutPendingRef.current = true;
    handledReturnKeyRef.current = null;
    try {
      // Phiên trình duyệt có redirect về app scheme: khi PayOS gọi returnUrl/cancelUrl
      // (homecycle://payments/checkout?...) phiên tự kết thúc (iOS đóng sheet; Android
      // nhận sự kiện liên kết) và ứng dụng đối chiếu trạng thái với Backend.
      const result = await WebBrowser.openAuthSessionAsync(
        checkoutUrl,
        Linking.createURL("/payments/checkout"),
      );

      if (result.type === "success") {
        const returnedUrl = String((result as { url?: string }).url ?? "");
        const kind = /[?&]payos=cancel(?:&|$)/.test(returnedUrl) ? "cancel" : "return";
        handleExternalReturn(kind);
        return;
      }

      // Trình duyệt ngoài đã đóng (người dùng tự quay lại): đối chiếu với Backend
      // thay vì giữ thông báo "Đang mở trang thanh toán PayOS...".
      if (result.type === "cancel" || result.type === "dismiss") {
        await reconcileExternalCheckout();
      }
    } finally {
      browserSessionOpenRef.current = false;
    }
  };

  const handlePaymentSubmit = async (confirmedLowAmount = false) => {
    if (!agreementId) {
      showError("Không tìm thấy mã hợp đồng cần thanh toán.");
      return;
    }

    if (isPaymentCompleted) return;

    if (!hasAcceptedTerms) {
      showError(
        "Vui lòng xác nhận đã đọc và đồng ý với điều khoản thanh toán trước khi tiếp tục.",
      );
      return;
    }

    if (paymentMethod === "wallet") {
      if (!hasWalletData) {
        showError(
          walletLoadError ||
            "Chưa tải được số dư ví. Vui lòng thử lại hoặc chọn PayOS.",
        );
        return;
      }

      if (!walletHasEnoughBalance) {
        showError(
          `Số dư ví khả dụng chỉ còn ${formatCurrency(availableBalance)}, không đủ để thanh toán ${formatCurrency(totalPayment)}.`,
        );
        return;
      }
    }

    if (
      paymentMethod === "payos" &&
      totalPayment < 10_000 &&
      !confirmedLowAmount
    ) {
      clearFeedback();
      setShowLowAmountConfirm(true);
      return;
    }

    if (submitInFlightRef.current) return;
    clearFeedback();

    try {
      submitInFlightRef.current = true;
      setIsProcessing(true);

      if (paymentMethod === "wallet") {
        const response = await paymentApi.checkoutWithWallet(agreementId);
        setIsPaymentCompleted(true);
        showSuccess(
          getApiSuccessMessage(response, "Thanh toán qua ví thành công."),
        );
        await fetchCheckoutData();
        return;
      }

      // Native: PayOS quay về chính màn thanh toán; màn này đối chiếu trạng thái
      // với Backend rồi mới chuyển sang màn thành công (không tin URL).
      const returnUrl =
        Platform.OS === "web"
          ? `${window.location.origin}/payments/success?agreementId=${agreementId}`
          : Linking.createURL("/payments/checkout", {
              queryParams: { agreementId, payos: "return" },
            });

      const cancelUrl =
        Platform.OS === "web"
          ? `${window.location.origin}/payments/success?agreementId=${agreementId}&cancel=true`
          : Linking.createURL("/payments/checkout", {
              queryParams: { agreementId, payos: "cancel" },
            });

      const response = await paymentApi.checkoutWithPayOS(agreementId, {
        returnUrl,
        cancelUrl,
      });

      const checkoutUrl = response?.data?.checkoutUrl || response?.checkoutUrl;

      if (!checkoutUrl) {
        throw new Error("Không nhận được link thanh toán từ hệ thống.");
      }

      showInfo("Đang mở trang thanh toán PayOS...");
      await openPayOSCheckout(checkoutUrl);
    } catch (error: unknown) {
      devLog("[checkout] Lỗi thanh toán:", error);

      const errorCode = String(
        (error as any)?.response?.data?.error?.code ??
          (error as any)?.response?.data?.code ??
          (error as any)?.error?.code ??
          (error as any)?.code ??
          "",
      ).trim();
      const normalizedErrorCode = errorCode.toLowerCase();
      // Ưu tiên thông điệp BE; chuỗi FE chỉ là dự phòng khi BE không trả.
      const beMessage = readSafeApiMessage(
        (error as any)?.response?.data ?? error,
      );

      if (normalizedErrorCode === "agreement.invalidstatus") {
        const refreshed = await fetchCheckoutData();

        if (!refreshed) {
          return;
        }

        showError(
          beMessage ??
            "Hợp đồng không còn ở trạng thái chờ thanh toán. Dữ liệu đã được làm mới, vui lòng kiểm tra lại.",
        );

        return;
      }

      if (
        normalizedErrorCode === "agreement.appointmentschedulemissing" ||
        normalizedErrorCode === "agreement.appointmentscheduleexpired"
      ) {
        await fetchCheckoutData();
        showError(
          beMessage ??
          (normalizedErrorCode === "agreement.appointmentschedulemissing"
            ? "Hợp đồng chưa có lịch hẹn hợp lệ. Vui lòng quay lại cập nhật Hợp đồng/lịch hẹn trước khi thanh toán."
            : "Lịch hẹn của Hợp đồng đã hết hạn. Vui lòng quay lại cập nhật Hợp đồng/lịch hẹn trước khi thanh toán."),
        );
        return;
      }

      if (normalizedErrorCode === "auth.forbidden") {
        showError(
          beMessage ??
            "Bạn không có quyền thanh toán Hợp đồng này. Vui lòng kiểm tra lại tài khoản và quyền truy cập.",
        );
        return;
      }

      if (normalizedErrorCode === "agreement.notfound") {
        await fetchCheckoutData();
        showError(
          beMessage ??
            "Không tìm thấy Hợp đồng. Vui lòng quay lại và kiểm tra lại giao dịch.",
        );
        return;
      }

      if (normalizedErrorCode === "payment.activecheckoutexists") {
        // Không tự suy luận Payment cũ đã thất bại/hết hạn — chỉ PayOS mới
        // là nguồn xác nhận trạng thái cuối. Làm mới dữ liệu để phản ánh
        // đúng trạng thái hiện tại, không polling/lặp lại.
        await fetchCheckoutData();

        showError(
          beMessage ??
            "Hợp đồng này đang có một phiên thanh toán PayOS chờ xử lý. Vui lòng kiểm tra hoặc hoàn tất phiên thanh toán hiện tại trước khi tạo thanh toán mới.",
        );

        return;
      }

      showError(
        getApiErrorMessage(
          error,
          "Giao dịch thất bại.",
        ),
      );
    } finally {
      submitInFlightRef.current = false;
      setIsProcessing(false);
    }
  };

  if (showReturnReconciling) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Thanh toán" showBack={false} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.reconcileTitle}>Đang xác nhận thanh toán...</Text>
          <Text style={styles.reconcileHint}>Vui lòng chờ trong giây lát.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Thanh toán" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!agreement || !quote) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Thanh toán" showBack={true} />
        <View style={styles.emptyContainer}>
          <Ionicons name="card-outline" size={48} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>
            Chưa tải được thông tin thanh toán
          </Text>
          <InlineFeedback feedback={feedback} />
          {agreementId ? (
            <TouchableOpacity
              style={styles.retryBtn}
              onPress={() => void fetchCheckoutData()}
            >
              <Text style={styles.retryBtnText}>Thử lại</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Thanh toán" showBack={true} />
      <View style={styles.container}>
        {isBuyer || isSeller ? (
          <View style={styles.transactionRoleCard}>
            <View>
              <Text style={styles.transactionRoleLabel}>Vai trò của bạn</Text>
              <Text style={styles.transactionRoleValue}>
                {isBuyer ? "Người mua" : "Người bán"}
              </Text>
            </View>
            <Text style={styles.transactionRoleHint}>
              {isBuyer
                ? "Người mua thực hiện thanh toán hợp đồng."
                : "Chỉ Người mua có thể thanh toán hợp đồng này."}
            </Text>
          </View>
        ) : null}
        <View style={styles.invoiceCard}>
          <Text style={styles.sectionTitle}>Tổng hóa đơn</Text>
          <View style={styles.row}>
            <Text style={styles.label}>Giá trị tiền hàng:</Text>
            <Text style={styles.value}>{formatCurrency(baseAmount)}</Text>
          </View>
          {isDeposit ? (
            <View style={styles.row}>
              <Text style={styles.label}>Tỷ lệ đặt cọc:</Text>
              <Text style={styles.value}>{depositRatePercent}%</Text>
            </View>
          ) : null}
          {shippingFee > 0 ? (
            <View style={styles.row}>
              <Text style={styles.label}>Phí vận chuyển:</Text>
              <Text style={styles.value}>{formatCurrency(shippingFee)}</Text>
            </View>
          ) : null}
          <View style={styles.divider} />
          <View style={styles.row}>
            <Text style={styles.totalLabel}>Tổng thanh toán:</Text>
            <Text style={styles.totalValue}>{formatCurrency(totalPayment)}</Text>
          </View>
        </View>

        <Text style={styles.paymentMethodsTitle}>Phương thức thanh toán</Text>

        <TouchableOpacity
          style={[
            styles.methodCard,
            isWalletSelected && styles.methodCardActive,
            isWalletDisabled && styles.methodCardDisabled,
          ]}
          onPress={() => {
            if (isWalletDisabled) return;
            clearFeedback();
            setPaymentMethod("wallet");
          }}
          activeOpacity={0.8}
          disabled={
            isProcessing ||
            isPaymentCompleted ||
            isWalletDisabled
          }
        >
          <View
            style={[
              styles.methodIconBox,
              isWalletSelected && styles.methodIconBoxActive,
            ]}
          >
            <Ionicons
              name="wallet"
              size={24}
              color={
                isWalletSelected ? COLORS.white : COLORS.textLight
              }
            />
          </View>
          <View style={styles.methodInfo}>
            <Text style={styles.methodTitle}>Ví HomeCycle</Text>
            <Text
              style={[
                styles.methodSubtitle,
                hasWalletData && !walletHasEnoughBalance
                  ? styles.insufficientBalanceText
                  : undefined,
              ]}
            >
              {hasWalletData
                ? `Số dư khả dụng: ${formatCurrency(availableBalance)}`
                : walletLoadError || "Đang cập nhật số dư..."}
            </Text>
          </View>
          <View
            style={[
              styles.radioCircle,
              isWalletSelected && styles.radioCircleActive,
            ]}
          >
            {isWalletSelected ? (
              <View style={styles.radioInner} />
            ) : null}
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.methodCard,
            paymentMethod === "payos" && styles.methodCardActive,
          ]}
          onPress={() => {
            clearFeedback();
            setPaymentMethod("payos");
          }}
          activeOpacity={0.8}
          disabled={isProcessing || isPaymentCompleted}
        >
          <View
            style={[
              styles.methodIconBox,
              paymentMethod === "payos" && styles.methodIconBoxActive,
            ]}
          >
            <Ionicons
              name="qr-code-outline"
              size={24}
              color={
                paymentMethod === "payos" ? COLORS.white : COLORS.textLight
              }
            />
          </View>
          <View style={styles.methodInfo}>
            <Text style={styles.methodTitle}>PayOS</Text>
            <Text style={styles.methodSubtitle}>
              Chuyển khoản ngân hàng / Mã QR
            </Text>
          </View>
          <View
            style={[
              styles.radioCircle,
              paymentMethod === "payos" && styles.radioCircleActive,
            ]}
          >
            {paymentMethod === "payos" ? (
              <View style={styles.radioInner} />
            ) : null}
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomBar}>
        <InlineFeedback feedback={feedback} />
        {!isPaymentCompleted ? (
          <View style={styles.termsBox}>
            <TouchableOpacity
              style={styles.termsRow}
              onPress={() => {
                clearFeedback();
                setHasAcceptedTerms((current) => !current);
              }}
              disabled={isProcessing}
              accessibilityRole="checkbox"
              accessibilityState={{
                checked: hasAcceptedTerms,
                disabled: isProcessing,
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name={hasAcceptedTerms ? "checkbox" : "square-outline"}
                size={22}
                color={
                  hasAcceptedTerms ? COLORS.primary : COLORS.textLight
                }
              />
              <Text style={styles.termsText}>
                Tôi đã đọc và đồng ý với điều khoản thanh toán.
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.push("/policy")}
              disabled={isProcessing}
              activeOpacity={0.8}
            >
              <Text style={styles.termsLink}>
                Xem Quy định & Chính sách
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
        <TouchableOpacity
          style={[
            styles.submitBtn,
            isSubmitDisabled && styles.disabledBtn,
          ]}
          onPress={() => void handlePaymentSubmit()}
          disabled={isSubmitDisabled}
        >
          {isProcessing ? (
            <ActivityIndicator color={COLORS.white} />
          ) : (
            <Text style={styles.submitBtnText}>
              {isPaymentCompleted
                ? "Thanh toán thành công"
                : `Thanh toán ${formatCurrency(totalPayment)}`}
            </Text>
          )}
        </TouchableOpacity>
        {isPaymentCompleted ? (
          <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>Quay lại</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      <Modal
        visible={showLowAmountConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLowAmountConfirm(false)}
      >
        <ModalBackdrop
          style={styles.confirmBackdrop}
          onPress={() => setShowLowAmountConfirm(false)}
        >
          <ModalSurface style={styles.confirmCard}>
            <Text style={styles.confirmMessage}>
              Số tiền cần thanh toán hiện dưới 10.000đ. PayOS có thể từ chối giao dịch do giới hạn số tiền tối thiểu.
            </Text>
            <View style={styles.confirmActions}>
              <TouchableOpacity
                style={styles.confirmSecondaryButton}
                onPress={() => setShowLowAmountConfirm(false)}
              >
                <Text style={styles.confirmSecondaryText}>Chọn phương thức khác</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.confirmPrimaryButton}
                onPress={() => {
                  setShowLowAmountConfirm(false);
                  void handlePaymentSubmit(true);
                }}
              >
                <Text style={styles.confirmPrimaryText}>Vẫn tiếp tục</Text>
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
  loadingContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  reconcileTitle: { marginTop: 16, fontSize: 16, fontWeight: "700", color: COLORS.text },
  reconcileHint: { marginTop: 6, fontSize: 13, color: COLORS.textLight },
  container: { flex: 1, padding: 16 },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 16,
    marginTop: 12,
    textAlign: "center",
  },
  retryBtn: {
    alignItems: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginTop: 12,
  },
  retryBtnText: { color: COLORS.white, fontWeight: "700" },
  invoiceCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  transactionRoleCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    marginBottom: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(84, 123, 125, 0.24)",
    borderRadius: 12,
    backgroundColor: "rgba(84, 123, 125, 0.08)",
  },
  transactionRoleLabel: { color: COLORS.textLight, fontSize: 11 },
  transactionRoleValue: {
    marginTop: 2,
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: "800",
  },
  transactionRoleHint: {
    flex: 1,
    color: COLORS.textLight,
    fontSize: 12,
    lineHeight: 17,
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 16,
  },
  paymentMethodsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginTop: 24,
    marginBottom: 12,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  label: { fontSize: 14, color: COLORS.textLight },
  value: { fontSize: 15, fontWeight: "600", color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 12 },
  totalLabel: { fontSize: 16, fontWeight: "bold", color: COLORS.text },
  totalValue: { fontSize: 20, fontWeight: "bold", color: COLORS.primary },
  methodCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  methodCardActive: { borderColor: COLORS.primary, backgroundColor: "rgba(84, 123, 125, 0.10)" },
  methodCardDisabled: { opacity: 0.55 },
  methodIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    backgroundColor: "#F8F9FA",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 16,
  },
  methodIconBoxActive: { backgroundColor: COLORS.primary },
  methodInfo: { flex: 1 },
  methodTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 4,
  },
  methodSubtitle: { fontSize: 13, color: COLORS.textLight },
  insufficientBalanceText: { color: "#9A6418" },
  radioCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: COLORS.border,
    justifyContent: "center",
    alignItems: "center",
  },
  radioCircleActive: { borderColor: COLORS.primary },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.primary,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 10,
  },
  inlineFeedback: {
    width: "100%",
    flexDirection: "row",
    alignItems: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  inlineFeedbackText: { flex: 1, fontSize: 13, lineHeight: 18 },
  submitBtn: {
    backgroundColor: COLORS.primary,
    height: 54,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  termsBox: {
    marginBottom: 12,
  },
  termsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  termsText: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    lineHeight: 19,
  },
  termsLink: {
    marginLeft: 32,
    marginTop: 6,
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  disabledBtn: { opacity: 0.7 },
  submitBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },
  backBtn: {
    alignItems: "center",
    borderColor: COLORS.primary,
    borderRadius: 12,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
  },
  backBtnText: { color: COLORS.primary, fontSize: 15, fontWeight: "700" },
  confirmBackdrop: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(23, 40, 48, 0.45)",
    padding: 20,
  },
  confirmCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: 20,
  },
  confirmMessage: {
    color: COLORS.text,
    fontSize: 15,
    lineHeight: 22,
  },
  confirmActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },
  confirmSecondaryButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  confirmSecondaryText: {
    color: COLORS.primary,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
  confirmPrimaryButton: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    borderRadius: 10,
    paddingHorizontal: 10,
  },
  confirmPrimaryText: {
    color: COLORS.white,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
  },
});
