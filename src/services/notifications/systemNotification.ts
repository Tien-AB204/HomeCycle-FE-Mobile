// FE-first native system notification bridge (Android first; iOS best-effort).
//
// Scope (see project handoff): this turns an already-authoritative,
// already-persisted HomeCycle Notification — received over the existing
// realtime NotificationCreated stream while this app process is alive — into
// a real native system notification. It is NOT remote/killed-app push: a
// fully killed process with no live realtime connection cannot receive a new
// event without a future Backend + FCM/Expo Push phase.
//
// All expo-notifications calls live here so the rest of the app never
// imports expo-notifications directly. Native-only; see systemNotification.web.ts
// for the no-op Web counterpart with the identical exported surface.

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { devLog } from "../../utils/devLog";

// Stable, project-owned channel id. One channel for all HomeCycle user
// notifications — never one per business event/type.
export const ANDROID_CHANNEL_ID = "homecycle-notifications";

export type SystemNotificationPayload = {
  notificationId: string;
  title: string;
  message: string;
  targetType: string | null;
  targetId: string | null;
};

export type SystemNotificationTapData = {
  notificationId: string | null;
  targetType: string | null;
  targetId: string | null;
};

let handlerConfigured = false;
let channelEnsured = false;
let coldStartResponseConsumed = false;

/**
 * Registers the foreground presentation policy exactly once per process.
 * Safe to call repeatedly; only the first call has any effect.
 */
function ensureHandlerConfigured() {
  if (handlerConfigured) return;
  handlerConfigured = true;

  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Idempotent Android notification channel setup. One stable channel for all
 * HomeCycle user notifications, Vietnamese display name, default importance
 * and sound so notifications surface normally in the shade/lock screen.
 */
export async function ensureAndroidChannelAsync(): Promise<void> {
  if (Platform.OS !== "android" || channelEnsured) return;
  channelEnsured = true;

  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: "Thông báo HomeCycle",
      importance: Notifications.AndroidImportance.DEFAULT,
      sound: "default",
    });
  } catch (error) {
    // Channel setup failing must never crash the app; the OS falls back to
    // its own default channel behavior for this app.
    if (__DEV__) {
      devLog("[systemNotification] Không thể tạo kênh thông báo Android:", error);
    }
    channelEnsured = false;
  }
}

/**
 * Checks/requests notification permission at most once per call site
 * invocation — callers are responsible for only calling this at a sensible
 * point (e.g. once after an authenticated app shell mounts), not per event.
 * Never throws; a denial or platform error simply resolves to false.
 */
export async function ensureNotificationPermissionAsync(): Promise<boolean> {
  try {
    ensureHandlerConfigured();
    await ensureAndroidChannelAsync();

    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;

    // iOS "provisional" counts as allowed-to-display for this FE-local phase.
    if (current.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL) {
      return true;
    }

    // Only prompt when the OS has not already recorded a decision. Re-asking
    // after a real denial would either no-op (Android) or never re-prompt
    // anyway (iOS) — but we still avoid calling it needlessly.
    if (current.canAskAgain) {
      const requested = await Notifications.requestPermissionsAsync();
      return (
        requested.granted ||
        requested.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL
      );
    }

    return false;
  } catch (error) {
    if (__DEV__) {
      devLog("[systemNotification] Không thể kiểm tra quyền thông báo:", error);
    }
    return false;
  }
}

/**
 * Displays exactly one native notification for one authoritative HomeCycle
 * Notification. Callers own dedupe (do not call this twice for the same
 * notificationId) — this function does not re-check identity itself, it
 * only guarantees a single native call produces a single native notification.
 * Fails silently: a scheduling error must never surface to the user or crash
 * the app.
 */
export async function presentLocalNotificationAsync(
  payload: SystemNotificationPayload,
): Promise<void> {
  try {
    const granted = await ensureNotificationPermissionAsync();
    if (!granted) return;

    await Notifications.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.message,
        data: {
          notificationId: payload.notificationId,
          targetType: payload.targetType,
          targetId: payload.targetId,
        },
      },
      trigger:
        Platform.OS === "android" ? { channelId: ANDROID_CHANNEL_ID } : null,
    });
  } catch (error) {
    if (__DEV__) {
      devLog("[systemNotification] Không thể hiển thị thông báo hệ thống:", error);
    }
  }
}

const extractTapData = (
  response: Notifications.NotificationResponse | null,
): SystemNotificationTapData | null => {
  if (!response) return null;

  const data = response.notification.request.content.data as
    | Record<string, unknown>
    | undefined;

  if (!data) return null;

  return {
    notificationId:
      data.notificationId !== undefined && data.notificationId !== null
        ? String(data.notificationId)
        : null,
    targetType:
      data.targetType !== undefined && data.targetType !== null
        ? String(data.targetType)
        : null,
    targetId:
      data.targetId !== undefined && data.targetId !== null
        ? String(data.targetId)
        : null,
  };
};

/**
 * Registers the single, process-lifetime listener for the user tapping a
 * native notification while the app is running (foreground or bringing the
 * app back from background). Call once at a root/provider level; returns a
 * cleanup function.
 */
export function registerNotificationResponseHandler(
  onResponse: (data: SystemNotificationTapData) => void,
): () => void {
  ensureHandlerConfigured();

  const subscription = Notifications.addNotificationResponseReceivedListener(
    (response) => {
      const data = extractTapData(response);
      if (data) onResponse(data);
    },
  );

  return () => subscription.remove();
}

/**
 * Consumes (at most once per app process) a notification response that was
 * already pending when the app cold-started — e.g. the process was recreated
 * by the user tapping a notification that had been scheduled while the app
 * was previously alive. Returns null on every call after the first, and null
 * if there was nothing pending, so callers can safely call this on every
 * mount without risking a duplicate/stale navigation.
 */
export function consumeInitialNotificationResponse(): SystemNotificationTapData | null {
  if (coldStartResponseConsumed) return null;
  coldStartResponseConsumed = true;

  try {
    const response = Notifications.getLastNotificationResponse();
    Notifications.clearLastNotificationResponse();
    return extractTapData(response);
  } catch (error) {
    if (__DEV__) {
      devLog(
        "[systemNotification] Không thể đọc phản hồi thông báo khi khởi động:",
        error,
      );
    }
    return null;
  }
}
