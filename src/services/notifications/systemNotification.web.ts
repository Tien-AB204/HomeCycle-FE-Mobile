// Web counterpart of systemNotification.ts.
//
// This phase never attempts a native system notification on Web, and never
// imports expo-notifications on Web (its native calls are not meaningful in
// a browser tab and must not be exercised here). Same exported surface as
// the native module so every caller stays platform-agnostic.

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

export async function ensureAndroidChannelAsync(): Promise<void> {
  // No-op on Web.
}

export async function ensureNotificationPermissionAsync(): Promise<boolean> {
  return false;
}

export async function presentLocalNotificationAsync(
  _payload: SystemNotificationPayload,
): Promise<void> {
  // No-op on Web — the persistent in-app Notification list is the Web
  // experience for this phase, not a browser notification.
}

export function registerNotificationResponseHandler(
  _onResponse: (data: SystemNotificationTapData) => void,
): () => void {
  return () => {};
}

export function consumeInitialNotificationResponse(): SystemNotificationTapData | null {
  return null;
}
