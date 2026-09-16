// Canonical HomeCycle Notification shape + target routing.
//
// This is the SINGLE source of truth for turning an authoritative persisted
// HomeCycle Notification (REST item or realtime NotificationCreated payload)
// into: a normalized in-app item, and a navigation action. Both the in-app
// Notification screen and the native system-notification tap handler use
// these exact same functions, so a tap can never land on a different route
// than the equivalent in-app row.
//
// Do not duplicate this parsing/routing elsewhere.

import { router } from "expo-router";
import apiClient from "../apis/axiosClient";

export type NotificationTargetType =
  | "offer"
  | "negotiation"
  | "agreement"
  | "order"
  | "dispute"
  | "post"
  | "appointment"
  | "withdrawal"
  | "businessProfile"
  | "personalProfile"
  | "review"
  | "";

export type NotificationItem = {
  notificationId: string;
  title: string;
  message: string;
  targetType: string | null;
  targetId: string | null;
  isRead: boolean;
  createdAt: string;
};

const unwrap = (value: any) => value?.data ?? value;

export const normalizeNotificationItem = (
  value: any,
): NotificationItem | null => {
  const notificationId = String(
    value?.notificationId ?? value?.NotificationId ?? "",
  ).trim();

  if (!notificationId) return null;

  const targetIdRaw = value?.targetId ?? value?.TargetId;

  return {
    notificationId,
    title: String(value?.title ?? value?.Title ?? "Thông báo"),
    message: String(value?.message ?? value?.Message ?? ""),
    targetType:
      value?.targetType !== undefined && value?.targetType !== null
        ? String(value.targetType)
        : value?.TargetType !== undefined && value?.TargetType !== null
          ? String(value.TargetType)
          : null,
    targetId:
      targetIdRaw !== undefined && targetIdRaw !== null
        ? String(targetIdRaw)
        : null,
    isRead: Boolean(value?.isRead ?? value?.IsRead ?? false),
    createdAt: String(value?.createdAt ?? value?.CreatedAt ?? ""),
  };
};

export const normalizeTargetType = (
  value: unknown,
): NotificationTargetType => {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  switch (normalized) {
    case "1":
    case "offer":
      return "offer";
    case "2":
    case "negotiation":
      return "negotiation";
    case "3":
    case "agreement":
      return "agreement";
    case "4":
    case "order":
      return "order";
    case "5":
    case "dispute":
      return "dispute";
    case "6":
    case "post":
      return "post";
    case "7":
    case "appointment":
      return "appointment";
    case "8":
    case "withdrawal":
      return "withdrawal";
    case "9":
    case "businessprofile":
      return "businessProfile";
    case "10":
    case "personalprofile":
      return "personalProfile";
    case "11":
    case "review":
      return "review";
    default:
      return "";
  }
};

export const isProfileVerificationTarget = (value: unknown) => {
  const targetType = normalizeTargetType(value);
  return (
    targetType === "businessProfile" || targetType === "personalProfile"
  );
};

/**
 * Resolves and navigates to the exact same destination the in-app
 * Notification list would open for this item. Used by both that screen and
 * the native notification tap handler.
 *
 * Returns true if a route was opened, false if the notification carries no
 * resolvable target (caller decides how to communicate that — e.g. an inline
 * "chưa có khu vực chi tiết" message on the Notification screen, or simply
 * doing nothing for a native tap).
 */
export async function navigateToNotificationTarget(
  target: { targetType: string | null; targetId: string | null },
  currentUserId?: string | null,
  currentUserRole?: string | null,
): Promise<boolean> {
  const targetType = normalizeTargetType(target.targetType);
  const targetId = target.targetId;
  const normalizedCurrentUserRole = String(currentUserRole ?? "")
    .trim()
    .toLowerCase();

  if (
    !targetType ||
    (!targetId && !isProfileVerificationTarget(targetType))
  ) {
    return false;
  }

  switch (targetType) {
    case "offer": {
      const response = await apiClient.get(`/offers/${targetId}`);
      const offer = unwrap(response.data);

      const negotiationId = String(
        offer?.negotiationId ?? offer?.NegotiationId ?? "",
      ).trim();

      if (negotiationId) {
        router.push(`/chat/${negotiationId}` as any);
        return true;
      }

      const offerStatus = String(
        offer?.offerStatus ?? offer?.OfferStatus ?? "",
      )
        .trim()
        .toLowerCase();

      const isPending = offerStatus === "pending" || offerStatus === "0";

      if (isPending) {
        const myUserId = String(currentUserId ?? "").toLowerCase();
        const receiverId = String(
          offer?.receiver?.userId ??
            offer?.receiver?.UserId ??
            offer?.receiverId ??
            offer?.ReceiverId ??
            "",
        ).toLowerCase();

        router.push({
          pathname: "/(tabs)/posts" as any,
          params: {
            section: "offers",
            tab: receiverId && receiverId === myUserId ? "received" : "sent",
          },
        });
        return true;
      }

      router.push(`/offers/${targetId}` as any);
      return true;
    }
    case "negotiation":
      router.push(`/chat/${targetId}` as any);
      return true;
    case "order":
      router.push(`/orders/${targetId}` as any);
      return true;
    case "dispute":
      router.push(`/disputes/${targetId}` as any);
      return true;
    case "post":
      router.push(`/posts/${targetId}` as any);
      return true;
    case "appointment":
      router.push(`/appointments/${targetId}` as any);
      return true;
    case "withdrawal":
      router.push(`/wallet/withdrawals/${targetId}` as any);
      return true;
    case "businessProfile":
      if (normalizedCurrentUserRole !== "business") {
        return false;
      }

      router.push("/profile/business-account-info" as any);
      return true;

    case "personalProfile":
      // Personal account information is the stable current-user destination
      // for identity-verification notifications on Mobile.
      if (normalizedCurrentUserRole !== "personal") {
        return false;
      }

      router.push("/profile/account-info" as any);
      return true;
    case "review":
      router.push(`/reviews/${targetId}` as any);
      return true;
    case "agreement": {
      const response = await apiClient.get(`/agreements/${targetId}`);
      const agreement = unwrap(response.data);
      const negotiationId = String(
        agreement?.negotiationId ?? agreement?.NegotiationId ?? "",
      ).trim();

      if (!negotiationId) {
        throw new Error(
          "Không tìm thấy phiên thương lượng của hợp đồng này.",
        );
      }

      router.push({
        pathname: "/agreements/preview" as any,
        params: {
          agreementId: targetId,
          negotiationId,
        },
      });
      return true;
    }
    default:
      return false;
  }
}
