import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../../src/components/shared/Header";
import {
  ModalBackdrop,
  ModalSurface,
} from "../../src/components/shared/ModalBackdrop";
import { COLORS } from "../../src/constants/theme";
import { useChatRealtime } from "../../src/contexts/ChatRealtimeContext";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";
import { getApiErrorMessage, getApiSuccessMessage } from "../../src/utils/apiFeedback";
import { getPosterRoleLabel } from "../../src/utils/postType";
import {
  canRespondToOffer,
  getOfferVersion,
  isPendingOffer,
  validOfferTerms,
  type OfferResponseAction,
} from "../../src/utils/offerActions";
import { useAutoDismissFeedback } from "../../src/utils/useAutoDismissFeedback";
import { useGuardedRouter } from "../../src/utils/tapGuard";

const offerApi = {
  getOfferById: (offerId: string) =>
    apiClient.get(`/offers/${offerId}`).then((response) => response.data),

  cancelOffer: (offerId: string) =>
    apiClient.post(`/offers/${offerId}/cancel`).then((response) => response.data),

  acceptOffer: (offerId: string, version: number) =>
    apiClient.patch(`/offers/${offerId}/accept`, { version }).then((response) => response.data),
  rejectOffer: (offerId: string) =>
    apiClient.post(`/offers/${offerId}/reject`).then((response) => response.data),
  counterOffer: (offerId: string, data: { offerPrice: number; offerQuantity: number; version: number }) =>
    apiClient.patch(`/offers/${offerId}/counter`, data).then((response) => response.data),

  updateOffer: (
    offerId: string,
    data: {
      offerPrice: number;
      offerQuantity: number;
      version: number;
    },
  ) =>
    apiClient
      .put(`/offers/${offerId}`, data)
      .then((response) => response.data),
};

type InlineMessage = {
  type: "error" | "success" | "warning";
  text: string;
} | null;

const unwrap = (value: any) => value?.data ?? value;

const normalizeStatus = (value: unknown) =>
  String(value ?? "")
    .replace(/[\s_-]/g, "")
    .toLowerCase();

const normalizeId = (value: unknown) =>
  String(value ?? "").trim().toLowerCase();

const getParticipantName = (participant: any, fallback: string) =>
  String(
    participant?.displayName ??
      participant?.DisplayName ??
      participant?.username ??
      participant?.Username ??
      "",
  ).trim() || fallback;

const getOfferErrorCode = (error: any) =>
  String(
    error?.response?.data?.error?.code ??
      error?.response?.data?.code ??
      error?.error?.code ??
      error?.code ??
      "",
  )
    .trim()
    .toUpperCase();

const translateStatus = (
  value: unknown,
  negotiationId?: unknown,
) => {
  const status = normalizeStatus(value);

  if (
    (status === "1" || status === "accepted") &&
    Boolean(negotiationId)
  ) {
    return "Đã chuyển sang thương lượng";
  }

  switch (status) {
    case "0":
    case "pending":
      return "Đang chờ phản hồi";
    case "1":
    case "accepted":
      return "Đã chấp nhận";
    case "2":
    case "rejected":
      return "Đã từ chối";
    case "3":
    case "cancelled":
    case "canceled":
      return "Đã hủy";
    default:
      return value ? String(value) : "Chưa xác định";
  }
};

const formatPrice = (value: unknown) =>
  `${Number(value || 0).toLocaleString("vi-VN")} đ`;

const formatDate = (value: unknown) => {
  if (!value) return "Chưa có";
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

export default function OfferDetailScreen() {
  const router = useGuardedRouter();
  const params = useLocalSearchParams();
  const { connection } = useChatRealtime();
  const { user } = useAuth();
  const currentUserId = user?.userId || user?.id;
  const offerId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [offer, setOffer] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isConfirmingCancel, setIsConfirmingCancel] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editPrice, setEditPrice] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [message, setMessage] = useState<InlineMessage>(null);
  useAutoDismissFeedback(message, () => setMessage(null));
  const [responseAction, setResponseAction] = useState<OfferResponseAction | null>(null);
  const [responseVersion, setResponseVersion] = useState<number | null>(null);
  const [responsePrice, setResponsePrice] = useState("");
  const [responseQuantity, setResponseQuantity] = useState("");
  const [isResponding, setIsResponding] = useState(false);
  const offerActionLockRef = useRef(false);
  const screenGeneration = useRef(0);
  const fetchGeneration = useRef(0);

  const fetchOffer = useCallback(async () => {
    const request = ++fetchGeneration.current;
    if (!offerId) {
      setMessage({ type: "error", text: "Không tìm thấy mã đề nghị." });
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setMessage(null);
      const response = await offerApi.getOfferById(offerId);
      if (request !== fetchGeneration.current) return null;
      if (response?.isSuccess === false) throw response;
      const detail = unwrap(response);
      if (normalizeId(detail?.offerId) !== normalizeId(offerId)) throw new Error("Không xác định được đề nghị.");
      setOffer(detail);
      return detail;
    } catch (error) {
      if (request !== fetchGeneration.current) return null;
      setOffer(null);
      setMessage({
        type: "error",
        text: getApiErrorMessage(error, "Không thể tải chi tiết đề nghị."),
      });
    } finally {
      if (request === fetchGeneration.current) setIsLoading(false);
    }
    return null;
  }, [offerId, currentUserId]);

  useFocusEffect(
    useCallback(() => {
      screenGeneration.current += 1;
      setOffer(null);
      setResponseAction(null);
      void fetchOffer();
      return () => {
        screenGeneration.current += 1;
        fetchGeneration.current += 1;
      };
    }, [fetchOffer]),
  );

  useEffect(() => {
    if (!connection || !offerId) return;

    const handleOfferUpdated = (payload: any) => {
      const updatedOffer = payload?.data ?? payload;
      const updatedOfferId = String(
        updatedOffer?.offerId ?? updatedOffer?.OfferId ?? "",
      );

      if (updatedOfferId === String(offerId)) {
        // OfferResponse realtime không chứa đầy đủ canUpdate/canCancel.
        // Refetch đúng detail này một lần để giữ action flags authoritative.
        void fetchOffer();
      }
    };

    connection.on("OfferUpdated", handleOfferUpdated);

    return () => {
      connection.off("OfferUpdated", handleOfferUpdated);
    };
  }, [connection, fetchOffer, offerId]);

  const handleOpenEditOffer = async () => {
    const pendingNow = isPendingOffer(offer?.offerStatus);
    const version = Number(offer?.version ?? offer?.Version);

    if (offer?.canUpdate !== true || !pendingNow) {
      setMessage({
        type: "warning",
        text: "Đề nghị này không còn ở trạng thái có thể chỉnh sửa.",
      });
      return;
    }

    if (!Number.isInteger(version) || version < 0) {
      setMessage({
        type: "warning",
        text: "Không xác định được phiên bản hiện tại của đề nghị. Dữ liệu sẽ được tải lại.",
      });
      await fetchOffer();
      return;
    }

    setMessage(null);
    setEditPrice(String(offer?.offerPrice ?? ""));
    setEditQuantity(String(offer?.offerQuantity ?? ""));
    setShowEditModal(true);
  };

  const handleCloseEditModal = () => {
    if (isUpdating) return;
    setShowEditModal(false);
  };

  const handleUpdateOffer = async () => {
    if (!offerId || offerActionLockRef.current) return;
    offerActionLockRef.current = true;

    const price = Number(editPrice.trim());
    const quantity = Number(editQuantity.trim());
    const version = Number(offer?.version ?? offer?.Version);

    if (
      !Number.isFinite(price) ||
      price <= 0 ||
      !Number.isInteger(quantity) ||
      quantity <= 0
    ) {
      setMessage({
        type: "warning",
        text: "Vui lòng nhập giá và số lượng hợp lệ.",
      });
      return;
    }

    if (!Number.isInteger(version) || version < 0) {
      setShowEditModal(false);
      setMessage({
        type: "warning",
        text: "Không xác định được phiên bản hiện tại của đề nghị. Dữ liệu sẽ được tải lại.",
      });
      await fetchOffer();
      return;
    }

    try {
      setIsUpdating(true);
      setMessage(null);

      const response = await offerApi.updateOffer(offerId, {
        offerPrice: price,
        offerQuantity: quantity,
        version,
      });

      if (response?.isSuccess === false) {
        throw response;
      }

      const updatedOffer = unwrap(response);

      if (updatedOffer?.offerId) {
        setOffer(updatedOffer);
      } else {
        await fetchOffer();
      }

      setShowEditModal(false);
      setMessage({
        type: "success",
        text: getApiSuccessMessage(response, "Đã cập nhật đề nghị."),
      });
    } catch (error) {
      if (getOfferErrorCode(error) === "OFFER_TERMS_CHANGED") {
        setShowEditModal(false);
        await fetchOffer();
        setMessage({
          type: "warning",
          text: "Đề nghị đã thay đổi ở nơi khác. Dữ liệu mới nhất đã được tải lại, vui lòng kiểm tra trước khi chỉnh sửa tiếp.",
        });
        return;
      }

      setMessage({
        type: "error",
        text: getApiErrorMessage(error, "Không thể cập nhật đề nghị lúc này."),
      });
    } finally {
      offerActionLockRef.current = false;
      setIsUpdating(false);
    }
  };

  const handleCancelOffer = async () => {
    if (!offerId || offerActionLockRef.current) return;
    offerActionLockRef.current = true;

    try {
      setIsCancelling(true);
      setMessage(null);

      const response = await offerApi.cancelOffer(offerId);
      const updatedOffer = unwrap(response);

      if (updatedOffer?.offerId) {
        setOffer(updatedOffer);
      } else {
        await fetchOffer();
      }

      setIsConfirmingCancel(false);
      setMessage({
        type: "success",
        text: getApiSuccessMessage(response, "Đã hủy đề nghị thương lượng."),
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: getApiErrorMessage(error, "Không thể hủy đề nghị lúc này."),
      });
    } finally {
      offerActionLockRef.current = false;
      setIsCancelling(false);
    }
  };

  const closeResponseAction = () => {
    if (offerActionLockRef.current) return;
    setResponseAction(null);
    setResponseVersion(null);
  };

  const openResponseAction = async (action: OfferResponseAction) => {
    if (offerActionLockRef.current || isUpdating || isCancelling) return;
    const generation = screenGeneration.current;
    offerActionLockRef.current = true;
    setIsResponding(true);
    try {
      const detail = await fetchOffer();
      if (generation !== screenGeneration.current || !detail) return;
      if (!canRespondToOffer(detail, action)) {
        setMessage({ type: "warning", text: "Đề nghị này không còn cho phép thao tác đã chọn. Vui lòng kiểm tra lại." });
        return;
      }
      setResponseVersion(getOfferVersion(detail));
      setResponsePrice(String(detail.offerPrice ?? ""));
      setResponseQuantity(String(detail.offerQuantity ?? ""));
      setResponseAction(action);
    } finally {
      offerActionLockRef.current = false;
      setIsResponding(false);
    }
  };

  const submitResponseAction = async () => {
    if (!offerId || !responseAction || offerActionLockRef.current) return;
    const action = responseAction;
    const version = responseVersion;
    const price = Number(responsePrice.trim());
    const quantity = Number(responseQuantity.trim());
    if (action === "counter" && !validOfferTerms(price, quantity)) {
      setMessage({ type: "warning", text: "Vui lòng nhập giá và số lượng hợp lệ." });
      return;
    }
    const generation = screenGeneration.current;
    const isCurrent = () => generation === screenGeneration.current;
    offerActionLockRef.current = true;
    setIsResponding(true);
    let succeeded = false;
    try {
      const latest = await fetchOffer();
      if (!isCurrent()) return;
      if (!latest || !canRespondToOffer(latest, action) ||
        (action !== "reject" && (version === null || version !== getOfferVersion(latest)))) {
        setResponseAction(null);
        if (latest) setMessage({ type: "warning", text: "Đề nghị đã thay đổi. Vui lòng xem lại thông tin mới nhất trước khi phản hồi." });
        return;
      }
      const result = action === "accept"
        ? await offerApi.acceptOffer(offerId, version!)
        : action === "reject"
          ? await offerApi.rejectOffer(offerId)
          : await offerApi.counterOffer(offerId, { offerPrice: price, offerQuantity: quantity, version: version! });
      if (result?.isSuccess === false) throw result;
      succeeded = true;
      if (!isCurrent()) return;
      setResponseAction(null);
      setResponseVersion(null);
      const refreshed = await fetchOffer();
      if (!isCurrent()) return;
      const negotiationId = String(unwrap(result)?.negotiationId ?? refreshed?.negotiationId ?? "").trim();
      if (action !== "reject" && negotiationId) {
        router.push(`/chat/${negotiationId}` as any);
      } else {
        setMessage({ type: refreshed ? "success" : "warning", text: !refreshed
          ? "Đã xử lý đề nghị nhưng chưa tải lại được dữ liệu. Vui lòng làm mới, không gửi lại thao tác."
          : action === "reject" ? "Đã từ chối đề nghị."
            : "Đã xử lý đề nghị. Vui lòng mở lại chi tiết để đi tới trò chuyện." });
      }
    } catch (error) {
      if (!isCurrent()) return;
      setResponseAction(null);
      await fetchOffer();
      if (!isCurrent()) return;
      setMessage({ type: "warning", text: succeeded
        ? "Đã xử lý đề nghị. Vui lòng mở lại chi tiết, không gửi lại thao tác."
        : getOfferErrorCode(error) === "OFFER_TERMS_CHANGED"
          ? "Đề nghị đã thay đổi ở nơi khác. Vui lòng kiểm tra dữ liệu mới nhất trước khi phản hồi."
          : getApiErrorMessage(error, "Không thể xử lý đề nghị lúc này.") });
    } finally {
      offerActionLockRef.current = false;
      setIsResponding(false);
    }
  };

  if (isLoading && !offer) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết đề nghị" showBack={true} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Đang tải đề nghị...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!offer) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <Header title="Chi tiết đề nghị" showBack={true} />
        <View style={styles.centered}>
          <Ionicons name="document-text-outline" size={44} color={COLORS.textLight} />
          <Text style={styles.emptyTitle}>Không thể hiển thị đề nghị</Text>
          {message ? <Text style={styles.errorText}>{message.text}</Text> : null}
          <TouchableOpacity style={styles.primaryButton} onPress={() => void fetchOffer()}>
            <Text style={styles.primaryButtonText}>Thử lại</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const pending = isPendingOffer(offer.offerStatus);
  const canUpdate = offer.canUpdate === true && pending;
  const canCancel = offer.canCancel === true && pending;
  const responseActions = (["counter", "accept", "reject"] as const)
    .filter((action) => canRespondToOffer(offer, action));
  const movedToNegotiation =
    (normalizeStatus(offer.offerStatus) === "accepted" ||
      String(offer.offerStatus) === "1") &&
    Boolean(offer.negotiationId);
  const seller = offer.seller ?? offer.Seller;
  const buyer = offer.buyer ?? offer.Buyer;
  const postOwnerId = normalizeId(
    offer.buyPost?.ownerId ??
      offer.BuyPost?.OwnerId ??
      offer.sellPost?.ownerId ??
      offer.SellPost?.OwnerId,
  );
  const sellerId = normalizeId(seller?.userId ?? seller?.UserId);
  const buyerId = normalizeId(buyer?.userId ?? buyer?.UserId);
  const isBuyPostOffer = Boolean(offer.buyPost ?? offer.BuyPost);
  const posterRoleLabel = getPosterRoleLabel(isBuyPostOffer);
  const sellerRoles =
    sellerId && sellerId === postOwnerId ? [posterRoleLabel] : ["Người bán"];
  const buyerRoles =
    buyerId && buyerId === postOwnerId ? [posterRoleLabel] : ["Người mua"];

  // Hồ sơ công khai của người tham gia (ID lấy từ dữ liệu đề nghị, không suy từ tên).
  const openParticipantProfile = (userId: string) => {
    if (!userId) return;
    router.push(`/users/${userId}` as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Chi tiết đề nghị" showBack={true} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <View style={styles.iconBox}>
              <Ionicons name="pricetag-outline" size={22} color={COLORS.primary} />
            </View>
            <View style={styles.headerTextWrapper}>
              <Text style={styles.cardTitle}>Đề nghị thương lượng đã gửi</Text>
              <Text style={styles.cardSubtitle}>
                {canUpdate
                  ? "Đề nghị đang chờ phản hồi; bạn có thể cập nhật giá hoặc số lượng."
                  : movedToNegotiation
                    ? "Đề nghị đã chuyển sang phiên thương lượng."
                    : responseActions.length > 0
                      ? "Đề nghị đang chờ phản hồi của bạn."
                      : "Đề nghị này chỉ có thể xem."}
              </Text>
            </View>
          </View>

          {sellerId || buyerId ? (
            <View style={styles.participantSection}>
              {sellerId ? (
                <TouchableOpacity
                  style={styles.participantRow}
                  onPress={() => openParticipantProfile(sellerId)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Xem hồ sơ người bán"
                >
                  <Text style={styles.participantName} numberOfLines={1}>
                    {getParticipantName(seller, "Người bán")}
                  </Text>
                  <Text style={styles.participantRoles}>{sellerRoles.join(" · ")}</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                </TouchableOpacity>
              ) : null}
              {buyerId ? (
                <TouchableOpacity
                  style={styles.participantRow}
                  onPress={() => openParticipantProfile(buyerId)}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                  accessibilityLabel="Xem hồ sơ người mua"
                >
                  <Text style={styles.participantName} numberOfLines={1}>
                    {getParticipantName(buyer, "Người mua")}
                  </Text>
                  <Text style={styles.participantRoles}>{buyerRoles.join(" · ")}</Text>
                  <Ionicons name="chevron-forward" size={16} color={COLORS.textLight} />
                </TouchableOpacity>
              ) : null}
            </View>
          ) : null}

          <View style={styles.row}>
            <Text style={styles.label}>Giá đề nghị</Text>
            <Text style={[styles.value, styles.price]}>{formatPrice(offer.offerPrice)}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Số lượng</Text>
            <Text style={styles.value}>{offer.offerQuantity ?? 0}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Người nhận</Text>
            <Text style={styles.value}>{offer.receiver?.displayName || "Đối tác"}</Text>
          </View>

          <View style={styles.row}>
            <Text style={styles.label}>Trạng thái</Text>
            <Text style={[styles.value, styles.statusValue]}>{translateStatus(
              offer.offerStatus,
              offer.negotiationId,
            )}</Text>
          </View>

          <View style={[styles.row, styles.lastRow]}>
            <Text style={styles.label}>Thời gian gửi</Text>
            <Text style={styles.value}>{formatDate(offer.createdAt)}</Text>
          </View>
        </View>

        {message ? (
          <Text
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[
              styles.message,
              message.type === "error"
                ? styles.errorMessage
                : message.type === "warning"
                  ? styles.warningMessage
                  : styles.successMessage,
            ]}
          >
            {message.text}
          </Text>
        ) : null}

        {responseActions.length > 0 ? <View style={styles.actionRow}>
          {responseActions.map((action) => (
            <TouchableOpacity key={action} style={styles.secondaryButton}
              disabled={isLoading || isResponding || isUpdating || isCancelling}
              onPress={() => void openResponseAction(action)}>
              <Text style={styles.secondaryButtonText}>{action === "counter" ? "Trả giá" : action === "accept" ? "Đồng ý" : "Từ chối"}</Text>
            </TouchableOpacity>
          ))}
        </View> : null}

        {movedToNegotiation ? (
          <TouchableOpacity
            style={styles.chatButton}
            onPress={() =>
              router.push(`/chat/${String(offer.negotiationId)}` as any)
            }
          >
            <Ionicons name="chatbubbles-outline" size={19} color={COLORS.white} />
            <Text style={styles.chatButtonText}>Đi tới trò chuyện</Text>
          </TouchableOpacity>
        ) : null}

        {canUpdate ? (
          <TouchableOpacity
            style={styles.updateButton}
            onPress={() => void handleOpenEditOffer()}
            disabled={isUpdating || isCancelling}
          >
            <Ionicons
              name="create-outline"
              size={19}
              color={COLORS.white}
            />
            <Text style={styles.updateButtonText}>
              Cập nhật đề nghị
            </Text>
          </TouchableOpacity>
        ) : null}

        {isConfirmingCancel ? (
          <View style={styles.confirmBox}>
            <View style={styles.confirmHeader}>
              <Ionicons name="warning-outline" size={20} color="#7A1012" />
              <Text style={styles.confirmTitle}>Hủy đề nghị này?</Text>
            </View>
            <Text style={styles.confirmText}>
              Sau khi hủy, đề nghị này sẽ không còn chờ đối tác phản hồi.
            </Text>
            <View style={styles.actionRow}>
              <TouchableOpacity
                style={[styles.secondaryButton, styles.confirmActionButton]}
                onPress={() => setIsConfirmingCancel(false)}
                disabled={isCancelling}
              >
                <Text style={styles.secondaryButtonText}>Ở lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.cancelButton,
                  styles.confirmActionButton,
                  isCancelling && styles.disabled,
                ]}
                onPress={() => void handleCancelOffer()}
                disabled={isCancelling}
              >
                {isCancelling ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.cancelButtonText}>Xác nhận hủy</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        ) : canCancel ? (
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => {
              setMessage(null);
              setIsConfirmingCancel(true);
            }}
          >
            <Ionicons name="trash-outline" size={19} color={COLORS.white} />
            <Text style={styles.cancelButtonText}>Hủy đề nghị</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>

      <Modal visible={responseAction !== null} transparent animationType="fade" onRequestClose={closeResponseAction}>
        <ModalBackdrop style={styles.modalOverlay} disabled={isResponding} onPress={closeResponseAction}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <ModalSurface style={styles.modalCard}>
              <Text style={styles.modalTitle}>{responseAction === "counter" ? "Trả giá đề nghị" : responseAction === "accept" ? "Đồng ý đề nghị" : "Từ chối đề nghị"}</Text>
              {responseAction === "counter" ? <>
                <Text style={styles.inputLabel}>Giá đề xuất mới (VNĐ)</Text>
                <TextInput style={styles.input} value={responsePrice} keyboardType="number-pad" editable={!isResponding}
                  onChangeText={(value) => setResponsePrice(value.replace(/[^0-9]/g, ""))} />
                <Text style={styles.inputLabel}>Số lượng</Text>
                <TextInput style={styles.input} value={responseQuantity} keyboardType="number-pad" editable={!isResponding}
                  onChangeText={(value) => setResponseQuantity(value.replace(/[^0-9]/g, ""))} />
              </> : <Text style={styles.cardSubtitle}>{responseAction === "accept"
                ? "Bạn có muốn đồng ý với đề nghị này và mở phiên thương lượng?"
                : "Bạn có chắc muốn từ chối đề nghị này?"}</Text>}
              {message ? <Text style={styles.errorText}>{message.text}</Text> : null}
              <View style={styles.actionRow}>
                <TouchableOpacity style={styles.secondaryButton} disabled={isResponding} onPress={closeResponseAction}>
                  <Text style={styles.secondaryButtonText}>Quay lại</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.updateButton, styles.confirmActionButton]} disabled={isResponding} onPress={() => void submitResponseAction()}>
                  {isResponding ? <ActivityIndicator color={COLORS.white} /> : <Text style={styles.updateButtonText}>
                    {responseAction === "counter" ? "Gửi đề xuất" : responseAction === "accept" ? "Đồng ý" : "Từ chối"}
                  </Text>}
                </TouchableOpacity>
              </View>
            </ModalSurface>
          </KeyboardAvoidingView>
        </ModalBackdrop>
      </Modal>

      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={handleCloseEditModal}
      >
        <ModalBackdrop
          style={styles.modalOverlay}
          disabled={isUpdating}
          onPress={handleCloseEditModal}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            <ModalSurface style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  Cập nhật đề nghị
                </Text>
                <TouchableOpacity
                  onPress={handleCloseEditModal}
                  disabled={isUpdating}
                  style={styles.modalCloseButton}
                >
                  <Ionicons
                    name="close"
                    size={24}
                    color={COLORS.text}
                  />
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>
                Giá đề nghị (VNĐ)
              </Text>
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === "web"
                    ? ({ outlineStyle: "none" } as any)
                    : undefined,
                ]}
                value={editPrice}
                onChangeText={setEditPrice}
                keyboardType="numeric"
                editable={!isUpdating}
              />

              <Text style={styles.inputLabel}>
                Số lượng
              </Text>
              <TextInput
                style={[
                  styles.input,
                  Platform.OS === "web"
                    ? ({ outlineStyle: "none" } as any)
                    : undefined,
                ]}
                value={editQuantity}
                onChangeText={setEditQuantity}
                keyboardType="numeric"
                editable={!isUpdating}
              />

              <TouchableOpacity
                style={[
                  styles.updateButton,
                  styles.modalSubmitButton,
                  isUpdating ? styles.disabled : undefined,
                ]}
                onPress={() => void handleUpdateOffer()}
                disabled={isUpdating}
              >
                {isUpdating ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons
                      name="checkmark-outline"
                      size={19}
                      color={COLORS.white}
                    />
                    <Text style={styles.updateButtonText}>
                      Lưu thay đổi
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </ModalSurface>
          </KeyboardAvoidingView>
        </ModalBackdrop>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  content: { padding: 16, paddingBottom: 40 },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  loadingText: { marginTop: 10, color: COLORS.textLight },
  emptyTitle: {
    marginTop: 12,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "700",
  },
  errorText: {
    marginTop: 8,
    color: COLORS.error,
    textAlign: "center",
    lineHeight: 20,
  },
  card: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    padding: 16,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: 14,
    marginBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  participantSection: {
    gap: 8,
    marginBottom: 16,
    padding: 12,
    borderRadius: 10,
    backgroundColor: "rgba(84, 123, 125, 0.08)",
  },
  participantRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
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
  iconBox: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    marginRight: 12,
  },
  headerTextWrapper: { flex: 1 },
  cardTitle: { color: COLORS.text, fontSize: 16, fontWeight: "800" },
  cardSubtitle: {
    marginTop: 3,
    color: COLORS.textLight,
    fontSize: 12,
    lineHeight: 17,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 14,
  },
  lastRow: { marginBottom: 0 },
  label: { flex: 1, color: COLORS.textLight, fontSize: 13 },
  value: {
    flex: 1.5,
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
  },
  price: { color: COLORS.error, fontWeight: "800" },
  statusValue: { color: COLORS.primary, fontWeight: "800" },
  message: {
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    fontSize: 13,
    lineHeight: 19,
  },
  errorMessage: { color: "#7A1012", backgroundColor: "rgba(122, 16, 18, 0.08)" },
  warningMessage: { color: "#9A6418", backgroundColor: "rgba(154, 100, 24, 0.10)" },
  successMessage: { color: "#2F765D", backgroundColor: "rgba(47, 118, 93, 0.10)" },
  confirmBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(122, 16, 18, 0.22)",
    backgroundColor: "rgba(122, 16, 18, 0.08)",
  },
  confirmHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  confirmTitle: { color: "#7A1012", fontSize: 15, fontWeight: "800" },
  confirmText: {
    marginTop: 8,
    color: "#7A1012",
    fontSize: 13,
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "stretch",
    gap: 10,
    marginTop: 14,
  },
  confirmActionButton: {
    flex: 1,
    minHeight: 48,
    marginTop: 0,
    paddingHorizontal: 12,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  secondaryButtonText: { color: COLORS.text, fontWeight: "700" },
  updateButton: {
    marginTop: 16,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
  },
  updateButtonText: {
    color: COLORS.white,
    fontWeight: "800",
    fontSize: 14,
  },
  chatButton: {
    marginTop: 16,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
  },
  chatButtonText: {
    color: COLORS.white,
    fontWeight: "800",
    fontSize: 14,
  },
  cancelButton: {
    marginTop: 12,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10,
    backgroundColor: COLORS.error,
    paddingHorizontal: 16,
  },
  cancelButtonText: { color: COLORS.white, fontWeight: "800", fontSize: 14 },
  disabled: { opacity: 0.65 },
  primaryButton: {
    marginTop: 16,
    minHeight: 48,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  primaryButtonText: { color: COLORS.white, fontWeight: "800" },
  modalOverlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  modalCard: {
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    backgroundColor: COLORS.white,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  modalTitle: {
    flex: 1,
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  inputLabel: {
    marginBottom: 7,
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  input: {
    minHeight: 48,
    marginBottom: 16,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    backgroundColor: COLORS.white,
    color: COLORS.text,
    fontSize: 14,
  },
  modalSubmitButton: {
    marginTop: 2,
  },
});
