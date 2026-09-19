import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../../src/components/shared/Header";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import { useChatRealtime } from "../../src/contexts/ChatRealtimeContext";
import { normalizeTargetType } from "../../src/services/notifications/notificationTargets";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage } from "../../src/utils/apiFeedback";
import { getPosterRoleLabel, isBuyPostType } from "../../src/utils/postType";
import { devLog } from "../../src/utils/devLog";
import { useGuardedRouter } from "../../src/utils/tapGuard";

const agreementApi = {
  getPreview: async (negotiationId: string) => {
    const response = await apiClient.get(
      `/agreements/preview/${negotiationId}`,
    );
    return response.data;
  },

  getAgreementById: async (agreementId: string) => {
    const response = await apiClient.get(`/agreements/${agreementId}`);
    return response.data;
  },

  acceptAgreement: async (agreementId: string, expectedRevision: number) => {
    const response = await apiClient.patch(`/agreements/${agreementId}/accept`, {
      expectedRevision,
    });
    return response.data;
  },

  /* [KHÔNG ĐƯỢC XÓA] - Tạm thời đóng tính năng Yêu cầu chỉnh sửa
  requestEditAgreement: async (agreementId: string) => {
    const response = await apiClient.patch(
      `/agreements/${agreementId}/request-edit`,
    );
    return response.data;
  },
  */
};

const orderApi = {
  getByAgreement: async (agreementId: string) => {
    const response = await apiClient.get(`/orders/agreement/${agreementId}`);
    return response.data;
  },
};

const postApi = {
  getById: async (postId: string) => {
    const response = await apiClient.get(`/posts/get-by-id/${postId}`);
    return response.data;
  },
};

// Tên đăng nhập của các bên trong thương lượng: Backend trả về trong Offer
// (sender/receiver.displayName chính là username), dùng khi hợp đồng/bài đăng
// chưa cho biết tên của bên còn lại.
const negotiationParticipantApi = {
  getUsernamesByNegotiation: async (
    negotiationId: string,
  ): Promise<Record<string, string>> => {
    const negotiationRes = await apiClient.get(`/negotiations/${negotiationId}`);
    const negotiation = unwrapResponse(negotiationRes.data);
    const offerId = String(negotiation?.offerId || negotiation?.OfferId || "");
    if (!offerId) return {};
    const offerRes = await apiClient.get(`/offers/${offerId}`);
    const offer = unwrapResponse(offerRes.data);
    const result: Record<string, string> = {};
    for (const participant of [offer?.sender, offer?.receiver, offer?.seller, offer?.buyer]) {
      const userId = normalizeId(participant?.userId ?? participant?.UserId);
      const username = String(
        participant?.username ?? participant?.displayName ?? participant?.DisplayName ?? "",
      ).trim();
      if (userId && username) result[userId] = username;
    }
    return result;
  },
};

const profileApi = {
  getPersonalProfile: async () => {
    const response = await apiClient.get("/personal-profiles/me");
    return response.data;
  },

  getBusinessProfile: async () => {
    const response = await apiClient.get("/business-profiles");
    return response.data;
  },
};

const unwrapResponse = (response: any) => response?.data || response;

const normalizeStatus = (status: unknown) =>
  String(status ?? "")
    .replace(/[\s_-]/g, "")
    .toLowerCase();

const isPendingAgreementStatus = (status: unknown) =>
  typeof status === "string" && normalizeStatus(status) === "pending";

const normalizeId = (id: unknown) =>
  String(id ?? "")
    .trim()
    .toLowerCase();

const hasCompleteBankAccount = (bankAccount: any) => {
  if (!bankAccount) return false;

  return [
    bankAccount.bankCode,
    bankAccount.bankName,
    bankAccount.accountNumber,
    bankAccount.accountName,
  ].every((value) => String(value ?? "").trim().length > 0);
};

type MessageState = {
  text: string;
  type: "error" | "success" | "warning";
} | null;

type ChangedFields = Record<string, { old: any; new: any }>;

type BankRequirementState = {
  profileType: "personal" | "business";
} | null;

export default function AgreementPreviewScreen() {
  const router = useGuardedRouter();
  const params = useLocalSearchParams();

  const agreementId = Array.isArray(params.agreementId)
    ? params.agreementId[0]
    : params.agreementId;

  const negotiationId = Array.isArray(params.negotiationId)
    ? params.negotiationId[0]
    : params.negotiationId;

  const successMsg = Array.isArray(params.successMsg)
    ? params.successMsg[0]
    : params.successMsg;

  const { user } = useAuth();
  const { connection, reconnectVersion } = useChatRealtime();
  const refreshRequestRef = useRef(0);
  const [isStateInvalidated, setIsStateInvalidated] = useState(false);
  const currentUserId = normalizeId(user?.userId || user?.id);

  const [agreementData, setAgreementData] = useState<any>(null);
  const [previewInfo, setPreviewInfo] = useState<any>(null);
  const [postContext, setPostContext] = useState<any>(null);
  const [participantUsernames, setParticipantUsernames] = useState<Record<string, string>>({});
  const participantLookupRef = useRef<string>("");

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // const [isConfirmingRequestEdit, setIsConfirmingRequestEdit] = useState(false); // [KHÔNG ĐƯỢC XÓA]

  // [THÊM MỚI] State để hiển thị bảng cảnh báo khi có người vừa sửa xong hợp đồng
  const [isConfirmingEditConflict, setIsConfirmingEditConflict] =
    useState(false);

  const [statusMessage, setStatusMessage] = useState<MessageState>(
    successMsg ? { type: "success", text: successMsg } : null,
  );
  const [changedFields, setChangedFields] = useState<ChangedFields | null>(
    null,
  );
  const [bankRequirement, setBankRequirement] =
    useState<BankRequirementState>(null);
  const [postPaymentLinks, setPostPaymentLinks] = useState<{
    orderId: string | null;
    appointmentId: string | null;
  }>({ orderId: null, appointmentId: null });

  const resolvePostPaymentLinks = useCallback(
    async (targetAgreementId: string, request: number) => {
      try {
        const response = await orderApi.getByAgreement(targetAgreementId);
        if (request !== refreshRequestRef.current) return;
        const raw = unwrapResponse(response);
        const order = raw?.order || raw;
        const resolvedOrderId =
          order?.orderId || raw?.orderId || raw?.id || null;
        const appointments = Array.isArray(order?.appointments)
          ? order.appointments
          : Array.isArray(raw?.appointments)
            ? raw.appointments
            : [];
        const preferredAppointment =
          appointments.find((item: any) => {
            const normalized = normalizeStatus(item?.appointmentStatus);
            return (
              normalized === "scheduled" ||
              normalized === "1" ||
              normalized === "inprogress" ||
              normalized === "5"
            );
          }) || appointments[0] || null;
        const resolvedAppointmentId =
          preferredAppointment?.appointmentId || null;

        setPostPaymentLinks({
          orderId: resolvedOrderId ? String(resolvedOrderId) : null,
          appointmentId: resolvedAppointmentId
            ? String(resolvedAppointmentId)
            : null,
        });
      } catch {
        if (request !== refreshRequestRef.current) return;
        setPostPaymentLinks({ orderId: null, appointmentId: null });
      }
    },
    [],
  );

  const fetchAgreementDetails = useCallback(
    async (showLoader = true) => {
      const request = ++refreshRequestRef.current;
      setIsStateInvalidated(true);
      if (!agreementId || !negotiationId) {
        setIsLoading(false);
        setStatusMessage({
          type: "error",
          text: "Không tìm thấy mã hợp đồng hoặc phiên thương lượng.",
        });
        return null;
      }

      try {
        if (showLoader) {
          setIsLoading(true);
        }

        const [detailRes, previewRes] = await Promise.all([
          agreementApi.getAgreementById(agreementId),
          agreementApi.getPreview(negotiationId),
        ]);
        if (request !== refreshRequestRef.current) return null;

        const agreement = unwrapResponse(detailRes);
        const preview = unwrapResponse(previewRes);

        setAgreementData(agreement);
        setPreviewInfo(preview);

        if (agreement?.postId) {
          try {
            const postResponse = await postApi.getById(String(agreement.postId));
            if (request !== refreshRequestRef.current) return null;
            setPostContext(unwrapResponse(postResponse));
          } catch {
            if (request !== refreshRequestRef.current) return null;
            setPostContext(null);
          }
        } else {
          setPostContext(null);
        }

        const latestStatus = normalizeStatus(agreement?.agreementStatus);
        const isPostPayment =
          latestStatus === "confirmed" ||
          latestStatus === "2" ||
          latestStatus === "paid" ||
          latestStatus === "completed";

        if (isPostPayment && agreementId) {
          await resolvePostPaymentLinks(agreementId, request);
        } else {
          setPostPaymentLinks({ orderId: null, appointmentId: null });
        }

        if (request !== refreshRequestRef.current) return null;
        setIsStateInvalidated(false);
        return { agreement, preview };
      } catch (error) {
        if (request !== refreshRequestRef.current) return null;
        devLog("Lỗi tải chi tiết hợp đồng:", error);
        setStatusMessage({
          type: "error",
          text: getApiErrorMessage(error, "Không thể tải chi tiết hợp đồng."),
        });
        return null;
      } finally {
        if (request === refreshRequestRef.current) {
          setIsLoading(false);
        }
      }
    },
    [agreementId, negotiationId, resolvePostPaymentLinks],
  );

  useFocusEffect(
    useCallback(() => {
      let active = true;
      let running = false;
      let pending = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const refresh = async (showLoader = false) => {
        if (running || !active) return;
        running = true;
        do {
          pending = false;
          await fetchAgreementDetails(showLoader);
          showLoader = false;
        } while (active && pending);
        running = false;
      };
      const invalidate = () => {
        // Hide stale edit/confirm/pay actions immediately, including while an
        // older REST request is still completing. Only a fresh GET unlocks them.
        ++refreshRequestRef.current;
        setIsStateInvalidated(true);
        pending = true;
        if (timer) clearTimeout(timer);
        timer = setTimeout(() => { if (pending) void refresh(); }, 150);
      };
      const onConversation = (event: any) => {
        if (normalizeId(event?.negotiationId ?? event?.NegotiationId) === normalizeId(negotiationId)) invalidate();
      };
      const onNotification = (event: any) => {
        const type = normalizeTargetType(event?.targetType ?? event?.TargetType);
        const targetId = normalizeId(event?.targetId ?? event?.TargetId);
        if ((type === "agreement" && targetId === normalizeId(agreementId)) || type === "order") {
          // A newly-created Order ID is not known yet. Resolve it through this
          // Agreement's existing endpoint; never infer paid state from a toast.
          invalidate();
        }
      };
      connection?.on("ConversationUpdated", onConversation);
      connection?.on("NotificationCreated", onNotification);
      void refresh(true);
      return () => {
        active = false;
        ++refreshRequestRef.current;
        if (timer) clearTimeout(timer);
        connection?.off("ConversationUpdated", onConversation);
        connection?.off("NotificationCreated", onNotification);
      };
    }, [connection, reconnectVersion, agreementId, negotiationId, fetchAgreementDetails]),
  );

  const onRefresh = async () => {
    setIsRefreshing(true);
    setStatusMessage(null);
    setChangedFields(null);
    setBankRequirement(null);
    setIsConfirmingEditConflict(false);
    await fetchAgreementDetails(false);
    setIsRefreshing(false);
  };

  const handleManualReload = async () => {
    setIsProcessing(true);
    setStatusMessage(null);
    setChangedFields(null);
    setBankRequirement(null);
    setIsConfirmingEditConflict(false);
    await fetchAgreementDetails(false);
    setIsProcessing(false);
  };

  const isBuyerForAgreement = useCallback(
    (agreement: any, preview: any) => {
      if (preview?.canPay === true) {
        return true;
      }

      const buyerId = normalizeId(
        agreement?.buyerId ||
          agreement?.buyerUserId ||
          preview?.buyerId ||
          preview?.buyerUserId,
      );

      return Boolean(currentUserId && buyerId && currentUserId === buyerId);
    },
    [currentUserId],
  );

  const goToPayment = useCallback(async () => {
    if (!agreementId) return;

    try {
      setIsProcessing(true);
      setStatusMessage(null);
      setBankRequirement(null);

      // JIT Check trạng thái mới nhất trước khi cho phép qua trang thanh toán
      const checkRes = await agreementApi.getAgreementById(agreementId);
      const latestData = unwrapResponse(checkRes);
      const latestStatus = latestData?.agreementStatus;

      // Kiểm tra theo Enum: Confirmed = 2 (hoặc chuỗi "Confirmed")
      const isConfirmed = latestStatus === "Confirmed" || latestStatus === 2;
      const isAwaitingPayment =
        latestStatus === "Awaiting_Payment" || latestStatus === 1;

      // Nếu đã được xác nhận / thanh toán rồi (Confirmed = 2)
      if (isConfirmed) {
        setStatusMessage({
          type: "warning",
          text: "⚠️ Hợp đồng này đã được xác nhận và thanh toán trước đó rồi.",
        });
        await fetchAgreementDetails(false);
        return;
      }

      // Nếu không phải trạng thái chờ thanh toán (Awaiting_Payment = 1)
      if (!isAwaitingPayment) {
        setStatusMessage({
          type: "error",
          text: "⚠️ Hợp đồng không còn ở trạng thái chờ thanh toán.",
        });
        await fetchAgreementDetails(false);
        return;
      }

      // FE tạm kiểm tra thông tin ngân hàng trước khi cho qua checkout,
      // vì BE hiện chưa chặn trường hợp profile chưa có tài khoản ngân hàng.
      const profileType =
        normalizeStatus(user?.role) === "business" ? "business" : "personal";

      const profileRes =
        profileType === "business"
          ? await profileApi.getBusinessProfile()
          : await profileApi.getPersonalProfile();
      const profile = unwrapResponse(profileRes);

      if (!hasCompleteBankAccount(profile?.bankAccount)) {
        setBankRequirement({ profileType });
        setStatusMessage({
          type: "warning",
          text:
            "Bạn cần cập nhật đầy đủ thông tin ngân hàng trước khi thanh toán: mã ngân hàng, tên ngân hàng, số tài khoản và tên chủ tài khoản.",
        });
        return;
      }

      // Trạng thái hợp đồng hợp lệ và profile đã đủ thông tin ngân hàng.
      router.push({
        pathname: "/payments/checkout",
        params: { agreementId },
      });
    } catch (error: any) {
      setStatusMessage({
        type: "error",
        text: getApiErrorMessage(
          error,
          "Không thể kiểm tra điều kiện thanh toán lúc này.",
        ),
      });
    } finally {
      setIsProcessing(false);
    }
  }, [agreementId, user?.role, router, fetchAgreementDetails]);

  const goToBankProfile = useCallback(() => {
    if (!bankRequirement) return;

    const target =
      bankRequirement.profileType === "business"
        ? "/profile/business-account-info"
        : "/profile/account-info";

    setBankRequirement(null);
    router.push(target as any);
  }, [bankRequirement, router]);

  const detectChanges = (oldData: any, newData: any): ChangedFields => {
    const diffs: ChangedFields = {};
    const oldDetails = oldData?.agreementDetails || {};
    const newDetails = newData?.agreementDetails || {};

    const rootKeys = ["quantity", "initialPrice", "finalPrice", "paymentType"];
    rootKeys.forEach((key) => {
      if (oldData[key] !== newData[key]) {
        diffs[key] = { old: oldData[key], new: newData[key] };
      }
    });

    const detailKeys = [
      "deliveryMethod",
      "collectionDate",
      "pickupAddress",
      "deliveryAddress",
      "inspectionDate",
      "inspectionAddress",
      "estimatedShippingFee",
      "notes",
    ];
    detailKeys.forEach((key) => {
      if (String(oldDetails[key] || "") !== String(newDetails[key] || "")) {
        diffs[key] = { old: oldDetails[key], new: newDetails[key] };
      }
    });

    return diffs;
  };

  const hasInterveningAgreementChange = (oldData: any, newData: any) => {
    const diffs = detectChanges(oldData, newData);
    const oldRevision = Number(
      oldData?.revision ?? oldData?.agreementDetails?.revision,
    );
    const newRevision = Number(
      newData?.revision ?? newData?.agreementDetails?.revision,
    );
    const revisionChanged =
      Number.isInteger(oldRevision) &&
      Number.isInteger(newRevision) &&
      oldRevision !== newRevision;
    const oldUpdatedAt = Date.parse(oldData?.updatedAt || "");
    const newUpdatedAt = Date.parse(newData?.updatedAt || "");
    const updatedAtChanged =
      Number.isFinite(oldUpdatedAt) &&
      Number.isFinite(newUpdatedAt) &&
      oldUpdatedAt !== newUpdatedAt;

    return {
      diffs,
      changed:
        Object.keys(diffs).length > 0 || revisionChanged || updatedAtChanged,
    };
  };

  const handleAccept = async () => {
    if (!agreementId) return;

    try {
      setIsProcessing(true);

      // Accept with the displayed revision; Backend rejects stale revisions atomically.
      const expectedRevision = Number(
        agreementData?.revision ??
          agreementData?.agreementDetails?.revision,
      );

      if (
        !Number.isInteger(expectedRevision) ||
        expectedRevision < 1
      ) {
        setStatusMessage({
          type: "error",
          text: "Không xác định được phiên bản đang hiển thị của hợp đồng. Dữ liệu đã được làm mới, vui lòng kiểm tra lại trước khi xác nhận.",
        });

        await fetchAgreementDetails(false);
        return;
      }

      setStatusMessage(null);
      setChangedFields(null);

      const acceptRes = await agreementApi.acceptAgreement(
        agreementId,
        expectedRevision,
      );
      const refreshed = await fetchAgreementDetails(false);

      const nextAgreement =
        refreshed?.agreement || unwrapResponse(acceptRes) || agreementData;
      const nextPreview = refreshed?.preview || previewInfo;
      const nextStatus = normalizeStatus(nextAgreement?.agreementStatus);

      const isAwaitingPayment =
        nextStatus === "awaitingpayment" || nextStatus === "accepted";
      const canPay =
        isAwaitingPayment && isBuyerForAgreement(nextAgreement, nextPreview);

      if (!isAwaitingPayment) {
        setStatusMessage({
          type: "success",
          text: "✅ Bạn đã xác nhận hợp đồng. Đang chờ phía còn lại xác nhận.",
        });
      } else if (!canPay) {
        setStatusMessage({
          type: "success",
          text: "✅ Hai bên đã xác nhận hợp đồng. Đang chờ người mua thanh toán.",
        });
      } else {
        setStatusMessage({
          type: "success",
          text: "✅ Hai bên đã xác nhận hợp đồng. Bạn có thể chuyển sang thanh toán.",
        });
      }
    } catch (error: any) {
      const errorCode = String(
        error?.response?.data?.error?.code ??
          error?.response?.data?.code ??
          error?.error?.code ??
          error?.code ??
          "",
      )
        .trim()
        .toLowerCase();

      const isRevisionMismatch =
        errorCode === "agreement.revisionmismatch" ||
        errorCode.includes("revisionmismatch") ||
        errorCode.includes("revision_mismatch");

      if (isRevisionMismatch) {
        const previousAgreement = agreementData;

        const refreshed =
          await fetchAgreementDetails(false);

        const latestAgreement =
          refreshed?.agreement;

        if (!latestAgreement) {
          setChangedFields(null);
          return;
        }

        const diffs = detectChanges(
          previousAgreement,
          latestAgreement,
        );

        setChangedFields(
          Object.keys(diffs).length > 0
            ? diffs
            : null,
        );

        setStatusMessage({
          type: "warning",
          text: "Hợp đồng vừa có phiên bản mới trước khi xác nhận. Dữ liệu đã được làm mới, vui lòng kiểm tra lại rồi xác nhận lần nữa.",
        });

        return;
      }

      setStatusMessage({
        type: "error",
        text: getApiErrorMessage(
          error,
          "Không thể xác nhận hợp đồng.",
        ),
      });
    } finally {
      setIsProcessing(false);
    }
  };

  /* [KHÔNG ĐƯỢC XÓA] - Tạm thời đóng tính năng Yêu cầu chỉnh sửa
  const executeRequestEdit = async () => { ... }
  const handleRequestEdit = async () => { ... }
  */

  // [THÊM MỚI] Hàm xử lý nhảy sang trang Chỉnh sửa
  const executeEdit = () => {
    setIsConfirmingEditConflict(false);
    setChangedFields(null);
    setStatusMessage(null);
    router.push({
      pathname: "/agreements/form",
      params: {
        negotiationId,
        editAgreementId: agreementId,
      },
    });
  };

  const handleEdit = async () => {
    if (!agreementId || !negotiationId) return;

    try {
      setIsProcessing(true);

      // JIT CHECK (Kiểm tra xem đối tác có vừa sửa gì không)
      const checkRes = await agreementApi.getAgreementById(agreementId);
      const latestData = unwrapResponse(checkRes);

      if (!isPendingAgreementStatus(latestData?.agreementStatus)) {
        setIsConfirmingEditConflict(false);
        setChangedFields(null);
        setStatusMessage({
          type: "warning",
          text: "Hợp đồng không còn ở trạng thái cho phép chỉnh sửa.",
        });
        await fetchAgreementDetails(false);
        return;
      }

      const { diffs, changed } = hasInterveningAgreementChange(
        agreementData,
        latestData,
      );

      if (changed) {
        setStatusMessage({
          type: "warning",
          text: "Hợp đồng đã có thay đổi mới. Hãy xem lại trước khi tiếp tục chỉnh sửa.",
        });
        setChangedFields(Object.keys(diffs).length > 0 ? diffs : null);
        await fetchAgreementDetails(false);
        setIsConfirmingEditConflict(true);
        return;
      }

      // Nếu không có conflict, cho phép chuyển sang trang Form luôn
      executeEdit();
    } catch (error: any) {
      setStatusMessage({
        type: "error",
        text: getApiErrorMessage(
          error,
          "Có lỗi xảy ra khi kiểm tra trạng thái hợp đồng.",
        ),
      });
      await fetchAgreementDetails(false);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatPrice = (price: number) =>
    Number(price || 0).toLocaleString("vi-VN") + " đ";

  const formatDate = (value: string | null | undefined) =>
    value ? new Date(value).toLocaleString("vi-VN") : "Chưa có";

  const translateDeliveryMethod = (method: string) => {
    switch (method) {
      case "BuyerPickUp":
        return "Bên mua đến lấy";
      case "SellerDelivers":
        return "Bên bán tự giao";
      case "GhnDelivery":
        return "Giao hàng nhanh (GHN)";
      case "Unknown":
        return "Chưa xác định";
      default:
        return method || "Chưa xác định";
    }
  };

  const translateAgreementStatus = (status: string) => {
    switch (normalizeStatus(status)) {
      case "pending":
        return "Chờ hai bên xác nhận";
      case "awaitingpayment":
      case "accepted":
        return "Chờ thanh toán";
      case "confirmed":
      case "2":
      case "paid":
        return "Đã xác nhận";
      case "completed":
        return "Đã hoàn tất";
      case "rejected":
        return "Đã từ chối";
      case "cancelled":
      case "canceled":
        return "Đã hủy";
      default:
        return "Chưa xác định";
    }
  };

  const renderOldValue = (key: string, formatter?: (val: any) => string) => {
    if (!changedFields || !changedFields[key]) return null;
    const oldVal = changedFields[key].old;
    const newVal = changedFields[key].new;
    const displayVal = formatter ? formatter(oldVal) : oldVal || "Chưa có";
    const displayNewVal = formatter ? formatter(newVal) : newVal || "Chưa có";
    return (
      <View style={styles.changeNote}>
        <Ionicons name="alert-circle" size={12} color={COLORS.error} />
        <Text style={styles.changeNoteText}>
          Cũ: {displayVal}{"\n"}Mới: {displayNewVal}
        </Text>
      </View>
    );
  };

  // Tra tên đăng nhập của bên còn lại (nếu hợp đồng/bài đăng chưa cho biết).
  const lookupSellerId = normalizeId(
    agreementData?.sellerId || agreementData?.sellerUserId || previewInfo?.sellerId || previewInfo?.sellerUserId,
  );
  const lookupBuyerId = normalizeId(
    agreementData?.buyerId || agreementData?.buyerUserId || previewInfo?.buyerId || previewInfo?.buyerUserId,
  );
  const lookupOwnerId = normalizeId(postContext?.ownerId);
  const lookupOwnerName = String(postContext?.ownerUsername || postContext?.ownerName || "").trim();
  const needsParticipantLookup = Boolean(
    agreementData &&
      negotiationId &&
      [lookupSellerId, lookupBuyerId].some(
        (participantId) =>
          participantId &&
          participantId !== currentUserId &&
          !(participantId === lookupOwnerId && lookupOwnerName) &&
          !participantUsernames[participantId],
      ),
  );
  useEffect(() => {
    if (!needsParticipantLookup || !negotiationId) return;
    const lookupKey = String(negotiationId);
    if (participantLookupRef.current === lookupKey) return;
    participantLookupRef.current = lookupKey;
    let active = true;
    void negotiationParticipantApi
      .getUsernamesByNegotiation(lookupKey)
      .then((usernames) => {
        if (active && Object.keys(usernames).length > 0) {
          setParticipantUsernames((current) => ({ ...current, ...usernames }));
        }
      })
      .catch(() => {
        // Không tra được tên: giữ nhãn dự phòng, không chặn màn hình.
      });
    return () => {
      active = false;
    };
  }, [needsParticipantLookup, negotiationId]);

  if (isLoading && !agreementData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết hợp đồng" showBack={true} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      </SafeAreaView>
    );
  }

  if (!agreementData) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết hợp đồng" showBack={true} />
        <View style={styles.emptyContainer}>
          <Ionicons
            name="document-text-outline"
            size={46}
            color={COLORS.textLight}
          />
          <Text style={styles.emptyTitle}>Chưa tải được hợp đồng</Text>
          {statusMessage && (
            <Text style={[styles.inlineMessage, styles.errorText]}>
              {statusMessage.text}
            </Text>
          )}
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => void fetchAgreementDetails()}
          >
            <Text style={styles.retryBtnText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const isInspection =
    agreementData.agreementType === "Inspection" ||
    agreementData.agreementType === 0;
  const details = agreementData.agreementDetails || {};
  const status = normalizeStatus(agreementData.agreementStatus);

  const isPending = status === "pending";
  const isAwaitingPayment =
    status === "awaitingpayment" || status === "accepted";
  const isPostPayment =
    status === "confirmed" ||
    status === "2" ||
    status === "paid" ||
    status === "completed";

  const sellerId = normalizeId(
    agreementData.sellerId ||
      agreementData.sellerUserId ||
      previewInfo?.sellerId ||
      previewInfo?.sellerUserId,
  );
  const buyerId = normalizeId(
    agreementData.buyerId ||
      agreementData.buyerUserId ||
      previewInfo?.buyerId ||
      previewInfo?.buyerUserId,
  );

  const hasParticipantIds = Boolean(sellerId || buyerId);

  const isSeller = Boolean(
    currentUserId && sellerId && currentUserId === sellerId,
  );
  const isBuyer = Boolean(
    currentUserId && buyerId && currentUserId === buyerId,
  );
  const postOwnerId = normalizeId(postContext?.ownerId);
  // Hiển thị tên đăng nhập (username) cho các bên, cùng quy ước với Đơn hàng.
  const currentUserName = String(
    user?.username || user?.name || user?.displayName || "Bạn",
  ).trim();
  // PostResponse.ownerName do Backend ánh xạ từ Username của chủ bài đăng.
  const postOwnerName = String(
    postContext?.ownerUsername || postContext?.ownerName || "",
  ).trim();
  const resolveParticipantName = (participantId: string, isCurrentUser: boolean) => {
    if (isCurrentUser && currentUserName) return currentUserName;
    if (participantId && participantId === postOwnerId && postOwnerName) return postOwnerName;
    const lookedUp = participantId ? participantUsernames[participantId] : "";
    return lookedUp || "Chưa có tên người dùng";
  };
  const sellerName = resolveParticipantName(sellerId, isSeller);
  const buyerName = resolveParticipantName(buyerId, isBuyer);
  const posterRoleLabel = getPosterRoleLabel(
    isBuyPostType(postContext?.postType),
  );
  const sellerRoles =
    sellerId && sellerId === postOwnerId ? [posterRoleLabel] : ["Người bán"];
  const buyerRoles =
    buyerId && buyerId === postOwnerId ? [posterRoleLabel] : ["Người mua"];

  const isParticipant = hasParticipantIds
    ? isSeller || isBuyer
    : Boolean(
        previewInfo?.hasAgreement ||
        previewInfo?.canEdit ||
        previewInfo?.canConfirm ||
        previewInfo?.canRequestEdit ||
        previewInfo?.canPay,
      );

  const sellerConfirmed = Boolean(
    agreementData.sellerConfirmedAt || agreementData.sellerConfirmed,
  );
  const buyerConfirmed = Boolean(
    agreementData.buyerConfirmedAt || agreementData.buyerConfirmed,
  );

  const currentSideConfirmed = isSeller
    ? sellerConfirmed
    : isBuyer
      ? buyerConfirmed
      : false;

  const canEdit =
    !isStateInvalidated &&
    isPending &&
    (previewInfo?.canEdit === true || (hasParticipantIds && isParticipant));
  const canAccept =
    !isStateInvalidated &&
    isPending &&
    !currentSideConfirmed &&
    (previewInfo?.canConfirm === true || (hasParticipantIds && isParticipant));

  // Tạm ẩn quyền Yêu cầu chỉnh sửa
  // const canRequestEdit = isAwaitingPayment && isParticipant;
  const canPay = !isStateInvalidated && isAwaitingPayment && (previewInfo?.canPay === true || isBuyer);

  const hasPendingAction = canEdit || canAccept;
  const hasAwaitingAction = /* canRequestEdit || */ canPay;

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Chi tiết hợp đồng" showBack={true} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
            tintColor={COLORS.primary}
          />
        }
      >
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="document-text" size={24} color={COLORS.primary} />
            <Text style={styles.cardTitle}>Hợp đồng giao dịch</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Mã hợp đồng:</Text>
            <View style={styles.valueWrapper}>
              <Text style={[styles.value, styles.idValue]}>
                {agreementData.agreementId}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Trạng thái hợp đồng:</Text>
            <View style={styles.valueWrapper}>
              <Text style={[styles.value, styles.statusValue]}>
                {translateAgreementStatus(agreementData.agreementStatus)}
              </Text>
            </View>
          </View>

          {Number.isFinite(
            Number(agreementData.revision ?? details.revision),
          ) && (
            <View style={styles.row}>
              <Text style={styles.label}>Phiên bản:</Text>
              <View style={styles.valueWrapper}>
                <Text style={styles.value}>
                  {Number(agreementData.revision ?? details.revision)}
                </Text>
              </View>
            </View>
          )}

          {sellerId || buyerId ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.sectionTitle}>Các bên giao dịch</Text>
              {sellerId ? (
                <View style={styles.participantRow}>
                  <Text style={styles.participantName} numberOfLines={1}>{sellerName}</Text>
                  <Text style={styles.participantRoles}>{sellerRoles.join(" · ")}</Text>
                </View>
              ) : null}
              {buyerId ? (
                <View style={styles.participantRow}>
                  <Text style={styles.participantName} numberOfLines={1}>{buyerName}</Text>
                  <Text style={styles.participantRoles}>{buyerRoles.join(" · ")}</Text>
                </View>
              ) : null}
            </>
          ) : null}

          <View style={styles.row}>
            <Text style={styles.label}>Loại giao dịch:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {isInspection ? "Có kiểm định trước" : "Thu gom ngay"}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Hình thức thanh toán:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {agreementData.paymentType === "Deposit"
                  ? "Đặt cọc"
                  : "Toàn phần"}
              </Text>
              {renderOldValue("paymentType", (v) =>
                v === "Deposit" ? "Đặt cọc" : "Toàn phần",
              )}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Số lượng:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>{agreementData.quantity || 1}</Text>
              {renderOldValue("quantity")}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Giá ban đầu:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {formatPrice(agreementData.initialPrice)}
              </Text>
              {renderOldValue("initialPrice", formatPrice)}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Giá chốt giao dịch:</Text>
            <View style={styles.valueWrapper}>
              <Text style={[styles.value, styles.finalPrice]}>
                {formatPrice(agreementData.finalPrice)}
              </Text>
              {renderOldValue("finalPrice", formatPrice)}
            </View>
          </View>

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Lịch trình & Giao nhận</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Vận chuyển:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {translateDeliveryMethod(details.deliveryMethod)}
              </Text>
              {renderOldValue("deliveryMethod", translateDeliveryMethod)}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Thời gian thu gom:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {formatDate(details.collectionDate)}
              </Text>
              {renderOldValue("collectionDate", formatDate)}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Địa chỉ lấy:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {details.pickupAddress || "Chưa có"}
              </Text>
              {renderOldValue("pickupAddress")}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Địa chỉ giao:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {details.deliveryAddress || "Chưa có"}
              </Text>
              {renderOldValue("deliveryAddress")}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Thời gian kiểm định:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {formatDate(details.inspectionDate)}
              </Text>
              {renderOldValue("inspectionDate", formatDate)}
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Địa điểm kiểm định:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {details.inspectionAddress || "Chưa có"}
              </Text>
              {renderOldValue("inspectionAddress")}
            </View>
          </View>

          {typeof details.estimatedShippingFee === "number" && (
            <View style={styles.row}>
              <Text style={styles.label}>Phí giao hàng dự kiến:</Text>
              <View style={styles.valueWrapper}>
                <Text style={[styles.value, styles.finalPrice]}>
                  {formatPrice(details.estimatedShippingFee)}
                </Text>
                {renderOldValue("estimatedShippingFee", formatPrice)}
              </View>
            </View>
          )}

          <View style={styles.divider} />

          <Text style={styles.sectionTitle}>Xác nhận & Thời gian</Text>

          <View style={styles.row}>
            <Text style={styles.label}>Ngày tạo hợp đồng:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {formatDate(agreementData.createdAt)}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Người bán xác nhận:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {sellerConfirmed
                  ? formatDate(agreementData.sellerConfirmedAt)
                  : "Chưa xác nhận"}
              </Text>
            </View>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Người mua xác nhận:</Text>
            <View style={styles.valueWrapper}>
              <Text style={styles.value}>
                {buyerConfirmed
                  ? formatDate(agreementData.buyerConfirmedAt)
                  : "Chưa xác nhận"}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />
          <Text style={styles.sectionTitle}>Ghi chú</Text>
          <View>
            <Text style={styles.notesText}>
              {details.notes || "Không có ghi chú"}
            </Text>
            {renderOldValue("notes")}
          </View>
        </View>
      </ScrollView>

      <View style={styles.bottomBar}>
        <View style={styles.reloadRow}>
          <TouchableOpacity
            style={styles.reloadBtn}
            onPress={handleManualReload}
            disabled={isProcessing}
          >
            <Ionicons
              name="sync-outline"
              size={16}
              color={COLORS.primary}
              style={{ marginRight: 6 }}
            />
            <Text style={styles.reloadBtnText}>Làm mới dữ liệu</Text>
          </TouchableOpacity>
        </View>

        {statusMessage && (
          <Text
            style={[
              styles.inlineMessage,
              statusMessage.type === "error"
                ? styles.errorText
                : statusMessage.type === "warning"
                  ? styles.warningText
                  : styles.successText,
            ]}
          >
            {statusMessage.text}
          </Text>
        )}

        {bankRequirement ? (
          <View
            style={[
              styles.inlineConfirmation,
              { backgroundColor: "rgba(154, 100, 24, 0.10)", borderColor: "rgba(154, 100, 24, 0.24)" },
            ]}
          >
            <View style={styles.inlineConfirmationHeader}>
              <Ionicons name="card-outline" size={20} color="#9A6418" />
              <Text
                style={[styles.inlineConfirmationTitle, { color: "#9A6418" }]}
              >
                Chưa đủ thông tin ngân hàng
              </Text>
            </View>
            <Text style={styles.inlineConfirmationMessage}>
              Bạn cần cập nhật đầy đủ thông tin ngân hàng trước khi tiếp tục sang
              bước thanh toán.
            </Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => {
                  setBankRequirement(null);
                  setStatusMessage(null);
                }}
                disabled={isProcessing}
              >
                <Text style={styles.secondaryBtnText}>Ở lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={goToBankProfile}
                disabled={isProcessing}
              >
                <Text style={styles.primaryBtnText}>Cập nhật thông tin</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Xác nhận trước khi tiếp tục sau khi dữ liệu hợp đồng thay đổi. */}
        {isConfirmingEditConflict && !isStateInvalidated && isPending ? (
          <View
            style={[
              styles.inlineConfirmation,
              { backgroundColor: "rgba(154, 100, 24, 0.10)", borderColor: "rgba(154, 100, 24, 0.24)" },
            ]}
          >
            <View style={styles.inlineConfirmationHeader}>
              <Ionicons name="alert-circle" size={20} color="#9A6418" />
              <Text
                style={[styles.inlineConfirmationTitle, { color: "#9A6418" }]}
              >
                Hợp đồng đã được cập nhật
              </Text>
            </View>
            <Text style={styles.inlineConfirmationMessage}>
              Hợp đồng đã có thay đổi mới. Hãy xem lại trước khi tiếp tục chỉnh sửa.
              {"\n\n"}Bạn vẫn muốn chỉnh sửa hợp đồng này?
            </Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => void handleManualReload()}
                disabled={isProcessing}
              >
                <Text style={styles.secondaryBtnText}>Quay lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.primaryBtn,
                  { backgroundColor: "#9A6418", borderColor: "#9A6418" },
                ]}
                onPress={() => void handleEdit()}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>Vẫn chỉnh sửa</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        {/* Chỉ render các nút bên dưới nếu KHÔNG phải đang hỏi xác nhận conflict */}
        {isStateInvalidated ? <Text style={styles.waitingText}>
          Đang cần cập nhật trạng thái hợp đồng. Vui lòng tải lại nếu kết nối bị gián đoạn.
        </Text> : null}
        {!isConfirmingEditConflict && !isStateInvalidated && isPending && (
          <View style={styles.actionRow}>
            {canEdit && (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() => void handleEdit()}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color={COLORS.primary} />
                ) : (
                  <Text style={styles.secondaryBtnText}>
                    Chỉnh sửa hợp đồng
                  </Text>
                )}
              </TouchableOpacity>
            )}

            {canAccept && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={handleAccept}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>Xác nhận hợp đồng</Text>
                )}
              </TouchableOpacity>
            )}

            {!hasPendingAction && (
              <Text style={styles.waitingText}>
                Bạn đã xác nhận. Đang chờ phía còn lại xử lý...
              </Text>
            )}
          </View>
        )}

        {!bankRequirement && !isConfirmingEditConflict && isAwaitingPayment && (
          <View style={styles.actionRow}>
            {canPay && (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={goToPayment}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryBtnText}>Đi đến thanh toán</Text>
                )}
              </TouchableOpacity>
            )}

            {!hasAwaitingAction && (
              <Text style={styles.waitingText}>
                Hai bên đã chốt. Đang chờ người mua thanh toán...
              </Text>
            )}
          </View>
        )}

        {!isConfirmingEditConflict && isPostPayment && (
          <View style={styles.postPaymentActions}>
            {postPaymentLinks.orderId ? (
              <TouchableOpacity
                style={styles.primaryBtn}
                onPress={() =>
                  router.push(("/orders/" + postPaymentLinks.orderId) as any)
                }
              >
                <Ionicons
                  name="receipt-outline"
                  size={18}
                  color={COLORS.white}
                  style={{ marginRight: 7 }}
                />
                <Text style={styles.primaryBtnText}>Xem đơn hàng</Text>
              </TouchableOpacity>
            ) : null}

            {postPaymentLinks.appointmentId ? (
              <TouchableOpacity
                style={styles.secondaryBtn}
                onPress={() =>
                  router.push(
                    ("/appointments/" + postPaymentLinks.appointmentId) as any,
                  )
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={18}
                  color={COLORS.primary}
                  style={{ marginRight: 7 }}
                />
                <Text style={styles.secondaryBtnText}>Xem lịch hẹn</Text>
              </TouchableOpacity>
            ) : null}

            {!postPaymentLinks.orderId && !postPaymentLinks.appointmentId ? (
              <Text style={styles.waitingText}>
                Hợp đồng đã thanh toán. Đơn hàng đang được đồng bộ...
              </Text>
            ) : null}
          </View>
        )}

        {!isConfirmingEditConflict &&
          !isPending &&
          !isAwaitingPayment &&
          !isPostPayment && (
            <Text style={styles.waitingText}>
              Hợp đồng hiện không có thao tác cần xử lý.
            </Text>
          )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  emptyTitle: {
    marginTop: 12,
    marginBottom: 16,
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "600",
  },
  retryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryBtnText: {
    color: COLORS.white,
    fontWeight: "bold",
  },

  inlineMessage: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    textAlign: "center",
  },
  errorText: {
    color: COLORS.error,
  },
  warningText: {
    color: "#9A6418",
    backgroundColor: "rgba(154, 100, 24, 0.10)",
    padding: 12,
    borderRadius: 8,
    overflow: "hidden",
  },
  successText: {
    color: "#2F765D",
  },

  scrollContent: {
    padding: 16,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginLeft: 10,
    color: COLORS.text,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: COLORS.textLight,
    flex: 1,
  },
  valueWrapper: {
    flex: 2,
    alignItems: "flex-end",
  },
  value: {
    fontSize: 14,
    color: COLORS.text,
    fontWeight: "500",
    textAlign: "right",
  },
  changeNote: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(122, 16, 18, 0.08)",
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
    borderWidth: 1,
    borderColor: "rgba(122, 16, 18, 0.22)",
  },
  changeNoteText: {
    fontSize: 11,
    color: COLORS.error,
    marginLeft: 4,
    fontStyle: "italic",
    fontWeight: "500",
  },
  idValue: {
    fontSize: 11,
    color: COLORS.textLight,
  },
  statusValue: {
    fontWeight: "bold",
    color: COLORS.primary,
  },
  finalPrice: {
    color: COLORS.error,
    fontWeight: "bold",
  },
  notesText: {
    fontSize: 14,
    color: COLORS.text,
    fontStyle: "italic",
    backgroundColor: "#F8F9FA",
    padding: 12,
    borderRadius: 8,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 12,
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 10,
    padding: 11,
    borderRadius: 9,
    backgroundColor: "rgba(84, 123, 125, 0.08)",
  },
  participantName: {
    flex: 1,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  participantRoles: {
    flexShrink: 1,
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  postPaymentActions: {
    gap: 10,
  },
  bottomBar: {
    padding: 16,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    gap: 12,
  },

  reloadRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 4,
  },
  reloadBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    borderWidth: 1,
    borderColor: "rgba(84, 123, 125, 0.24)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  reloadBtnText: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "600",
  },

  actionRow: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  inlineConfirmation: {
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    borderColor: "rgba(84, 123, 125, 0.24)",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
    width: "100%",
  },
  inlineConfirmationHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 6,
  },
  inlineConfirmationTitle: {
    color: COLORS.text,
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
  },
  inlineConfirmationMessage: {
    color: COLORS.textLight,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 12,
  },
  waitingText: {
    textAlign: "center",
    flex: 1,
    color: COLORS.textLight,
    paddingVertical: 8,
  },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryBtnText: {
    color: COLORS.primary,
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
  },
  primaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryBtnText: {
    color: COLORS.white,
    fontWeight: "bold",
    fontSize: 14,
    textAlign: "center",
  },
});
