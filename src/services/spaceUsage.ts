// Không gian sử dụng (SpaceUsage) — nguồn giá trị duy nhất là Backend:
// GET /api/product-types/space-usages (công khai) trả Result<SpaceUsageResponse[]>
// với { value: number, name: string }. Danh sách này quyết định lựa chọn nào tồn tại;
// bảng nhãn tiếng Việt bên dưới chỉ để hiển thị, không tạo thêm lựa chọn.
//
// Đây không phải wrapper API theo tính năng: tải một lần, cache trong phiên và
// cung cấp helper chuẩn hóa/hiển thị cho các màn hình dùng chung.

import { useCallback, useEffect, useRef, useState } from "react";
import apiClient from "./apis/axiosClient";

export type SpaceUsageOption = {
  value: number;
  name: string;
  label: string;
};

// Chỉ phục vụ hiển thị; tên chưa biết sẽ được hiển thị an toàn từ chính tên enum.
const SPACE_USAGE_LABELS: Record<string, string> = {
  Living_room: "Phòng khách",
  Kitchen: "Nhà bếp",
  Bedroom: "Phòng ngủ",
  Bathroom: "Phòng tắm",
  Laundry_room: "Phòng giặt",
  Balcony: "Ban công",
  Garage: "Nhà để xe",
  Restroom: "Nhà vệ sinh",
};

export const getSpaceUsageLabel = (name: string | null | undefined): string => {
  const key = String(name ?? "").trim();
  if (!key) return "";
  return SPACE_USAGE_LABELS[key] ?? key.replace(/_/g, " ");
};

const normalizeItem = (raw: any): SpaceUsageOption | null => {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name ?? raw.Name ?? "").trim();
  const value = Number(raw.value ?? raw.Value);
  if (!name || !Number.isFinite(value)) return null;
  return { value, name, label: getSpaceUsageLabel(name) };
};

const unwrapList = (payload: any): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (payload && typeof payload === "object") {
    if (payload.isSuccess === false) throw payload;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
    if (payload.data && Array.isArray(payload.data.items)) return payload.data.items;
  }
  return [];
};

let cachedOptions: SpaceUsageOption[] | null = null;
let inFlight: Promise<SpaceUsageOption[]> | null = null;

export const fetchSpaceUsages = (): Promise<SpaceUsageOption[]> => {
  if (cachedOptions) return Promise.resolve(cachedOptions);
  if (inFlight) return inFlight;
  inFlight = apiClient
    .get("/product-types/space-usages")
    .then((response) => {
      const options = unwrapList(response.data)
        .map(normalizeItem)
        .filter((item): item is SpaceUsageOption => item !== null)
        .sort((a, b) => a.value - b.value);
      cachedOptions = options;
      return options;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
};

/**
 * Chuẩn hóa giá trị Backend trả về (số enum, chuỗi số hoặc tên enum) thành tên enum.
 * 0 (Living_room) là giá trị hợp lệ — không được coi là "rỗng".
 */
export const normalizeSpaceUsageName = (
  value: unknown,
  options: readonly SpaceUsageOption[],
): string => {
  if (value === null || value === undefined) return "";
  const text = String(value).trim();
  if (!text) return "";
  if (/^-?\d+$/.test(text)) {
    const match = options.find((option) => option.value === Number(text));
    return match ? match.name : text;
  }
  return text;
};

export function useSpaceUsages() {
  const [options, setOptions] = useState<SpaceUsageOption[]>(cachedOptions ?? []);
  const [isLoading, setIsLoading] = useState(!cachedOptions);
  const [hasError, setHasError] = useState(false);
  const mountedRef = useRef(true);

  const load = useCallback(async () => {
    setIsLoading(true);
    setHasError(false);
    try {
      const next = await fetchSpaceUsages();
      if (!mountedRef.current) return;
      setOptions(next);
    } catch {
      // Không dựng danh sách giả; màn hình hiển thị trạng thái lỗi/để trống.
      if (mountedRef.current) setHasError(true);
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void load();
    return () => {
      mountedRef.current = false;
    };
  }, [load]);

  return { options, isLoading, hasError, reload: load };
}
