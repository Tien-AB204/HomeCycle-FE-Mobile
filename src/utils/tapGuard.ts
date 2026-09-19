import { useRouter } from "expo-router";
import { useCallback, useMemo, useRef } from "react";

/**
 * Quy tắc toàn ứng dụng: một thao tác của người dùng chỉ tạo tối đa
 * MỘT điều hướng hoặc MỘT yêu cầu thay đổi dữ liệu.
 *
 * - useGuardedRouter: thay thế trực tiếp cho useRouter(); chạm lặp nhanh
 *   vào cùng một đích (push/replace/navigate/back) trong cửa sổ ngắn bị bỏ qua,
 *   điều hướng khác đích vẫn đi bình thường.
 * - useInFlightGuard: khóa một hành động bất đồng bộ cho tới khi hoàn tất.
 */
export const NAVIGATION_REPEAT_WINDOW_MS = 800;

let lastNavigationKey = "";
let lastNavigationAt = 0;

const serializeHref = (href: unknown): string => {
  if (typeof href === "string") return href;
  try {
    return JSON.stringify(href);
  } catch {
    return String(href);
  }
};

export const allowNavigation = (
  key: string,
  windowMs: number = NAVIGATION_REPEAT_WINDOW_MS,
): boolean => {
  const now = Date.now();
  if (key === lastNavigationKey && now - lastNavigationAt < windowMs) {
    return false;
  }
  lastNavigationKey = key;
  lastNavigationAt = now;
  return true;
};

type ExpoRouter = ReturnType<typeof useRouter>;

export function useGuardedRouter(): ExpoRouter {
  const router = useRouter();

  return useMemo<ExpoRouter>(
    () => ({
      ...router,
      push: ((href: any, options?: any) => {
        if (!allowNavigation(`push:${serializeHref(href)}`)) return;
        return router.push(href, options);
      }) as ExpoRouter["push"],
      navigate: ((href: any, options?: any) => {
        if (!allowNavigation(`navigate:${serializeHref(href)}`)) return;
        return router.navigate(href, options);
      }) as ExpoRouter["navigate"],
      replace: ((href: any, options?: any) => {
        if (!allowNavigation(`replace:${serializeHref(href)}`)) return;
        return router.replace(href, options);
      }) as ExpoRouter["replace"],
      back: (() => {
        if (!allowNavigation("back")) return;
        return router.back();
      }) as ExpoRouter["back"],
    }),
    [router],
  );
}

/**
 * Bọc một hành động bất đồng bộ: các lần gọi trong lúc đang chạy bị bỏ qua.
 * Dùng cho nút gửi/xác nhận khi màn hình chưa có cờ "đang xử lý" riêng.
 */
export function useInFlightGuard() {
  const inFlightRef = useRef(false);

  const run = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
      if (inFlightRef.current) return undefined;
      inFlightRef.current = true;
      try {
        return await action();
      } finally {
        inFlightRef.current = false;
      }
    },
    [],
  );

  const isInFlight = useCallback(() => inFlightRef.current, []);

  return { run, isInFlight };
}
