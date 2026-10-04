import { useNavigationContainerRef } from "expo-router";
import { useCallback } from "react";

import { allowNavigation, useGuardedRouter } from "./tapGuard";

/**
 * Điều hướng không làm chồng màn hình lên nhau.
 *
 * - returnToTabs: push/replace tới một route trong (tabs) từ màn con sẽ đẩy thêm
 *   cả một bộ tab mới lên ngăn xếp. Quay về bộ tab sẵn có rồi mới chuyển tab.
 * - useOpenScreen: các màn chi tiết mở qua lại lẫn nhau (đơn hàng ↔ chat ↔ tranh chấp...).
 *   Nếu màn đích đã nằm phía sau trong ngăn xếp thì quay lại màn đó thay vì mở thêm bản mới.
 */

type GuardedRouter = ReturnType<typeof useGuardedRouter>;

type TabHref = "/(tabs)/cart" | "/(tabs)/chat" | "/(tabs)/posts" | "/(tabs)/profile";

export const returnToTabs = (router: GuardedRouter, tab?: TabHref) => {
  router.dismissTo("/(tabs)");
  if (tab) router.navigate(tab);
};

type ScreenHref = string | { pathname: string; params?: Record<string, unknown> };

type StackRoute = { name: string; params?: object };

// Màn không có tham số động được nhận diện bằng tham số truy vấn này.
const STATIC_ROUTE_KEYS: Record<string, string[]> = {
  "agreements/preview": ["agreementId"],
  "inspections/form": ["appointmentId"],
};

const trimSlashes = (value: string) => value.replace(/^\/+|\/+$/g, "");

const parseQuery = (query: string): Record<string, string> => {
  const params: Record<string, string> = {};
  for (const part of query.split("&")) {
    if (!part) continue;
    const [rawKey, rawValue = ""] = part.split("=");
    params[decodeURIComponent(rawKey)] = decodeURIComponent(rawValue);
  }
  return params;
};

// Khóa nhận diện một màn: đường dẫn đã điền tham số động, kèm tham số nhận diện của màn tĩnh.
// Trả về null cho màn không có gì để nhận diện (luôn mở mới).
const buildScreenKey = (pattern: string, params: Record<string, unknown>): string | null => {
  const segments = trimSlashes(pattern).split("/");
  const path = segments
    .map((segment) => {
      const dynamic = segment.match(/^\[(.+)\]$/);
      return dynamic ? String(params[dynamic[1]] ?? "") : segment;
    })
    .join("/");
  const staticKeys = STATIC_ROUTE_KEYS[path] ?? [];
  const hasDynamicSegment = segments.some((segment) => segment.startsWith("["));
  if (!hasDynamicSegment && staticKeys.length === 0) return null;
  if (path.split("/").some((segment) => !segment)) return null;
  const identity = staticKeys.map((key) => `${key}=${String(params[key] ?? "")}`);
  if (identity.some((entry) => entry.endsWith("="))) return null;
  return [path, ...identity].join("|");
};

const getHrefKey = (href: ScreenHref): string | null => {
  if (typeof href !== "string") return buildScreenKey(href.pathname, href.params ?? {});
  const [path, query = ""] = href.split("?");
  const params = parseQuery(query);
  const staticKeys = STATIC_ROUTE_KEYS[trimSlashes(path)];
  if (staticKeys) return buildScreenKey(path, params);
  // Đường dẫn đã điền sẵn tham số (vd. /orders/123) không còn ngoặc vuông nên đánh dấu là động.
  const trimmed = trimSlashes(path);
  return trimmed.includes("/") ? trimmed : null;
};

const getRouteKey = (route: StackRoute): string | null =>
  buildScreenKey(route.name, (route.params ?? {}) as Record<string, unknown>);

export function useOpenScreen() {
  const router = useGuardedRouter();
  const navigationRef = useNavigationContainerRef();

  return useCallback(
    (href: ScreenHref) => {
      const targetKey = getHrefKey(href);
      const rootState = navigationRef.isReady() ? navigationRef.getRootState() : undefined;
      if (!targetKey || !rootState || rootState.type !== "stack") {
        router.push(href as any);
        return;
      }

      const routes = rootState.routes as StackRoute[];
      const currentIndex = rootState.index;
      if (getRouteKey(routes[currentIndex]) === targetKey) return;

      for (let index = currentIndex - 1; index >= 0; index -= 1) {
        if (getRouteKey(routes[index]) !== targetKey) continue;
        if (!allowNavigation(`dismiss:${targetKey}`)) return;
        router.dismiss(currentIndex - index);
        return;
      }

      router.push(href as any);
    },
    [navigationRef, router],
  );
}
