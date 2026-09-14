import AsyncStorage from "@react-native-async-storage/async-storage";
import { Appearance } from "react-native";

export type AppearancePreference = "light" | "dark" | "system";

// Khóa lưu trữ đã tồn tại từ màn Thiết lập cũ ("light" | "dark"); thêm "system".
export const APPEARANCE_STORAGE_KEY = "theme";

export const normalizeAppearancePreference = (
  value: unknown,
): AppearancePreference => {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "light" || normalized === "dark") return normalized;
  return "system";
};

export const loadAppearancePreference = async (): Promise<AppearancePreference> => {
  try {
    return normalizeAppearancePreference(
      await AsyncStorage.getItem(APPEARANCE_STORAGE_KEY),
    );
  } catch {
    return "system";
  }
};

export const saveAppearancePreference = async (
  preference: AppearancePreference,
): Promise<void> => {
  await AsyncStorage.setItem(APPEARANCE_STORAGE_KEY, preference);
};

// Chỉ áp dụng ở nền tảng hỗ trợ; trên web react-native-web chưa có setColorScheme.
export const applyAppearancePreference = (
  preference: AppearancePreference,
): void => {
  const setColorScheme = (Appearance as { setColorScheme?: (value: "light" | "dark" | null) => void })
    .setColorScheme;
  if (typeof setColorScheme !== "function") return;
  try {
    setColorScheme(preference === "system" ? null : preference);
  } catch {
    // Không chặn ứng dụng nếu nền tảng từ chối thay đổi.
  }
};
