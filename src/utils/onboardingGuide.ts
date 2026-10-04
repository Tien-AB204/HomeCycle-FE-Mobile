import AsyncStorage from "@react-native-async-storage/async-storage";

// BE không có cờ "đăng nhập lần đầu" cho tài khoản email, nên app tự nhớ theo
// từng userId trên máy. Cài lại app thì tài khoản mới sẽ thấy lại giới thiệu một lần.
const storageKey = (userId: string) => `homecycle.guideSeen.${userId}`;

// Chỉ tự hiện cho tài khoản mới tạo; tài khoản cũ vẫn xem lại được ở Hồ sơ.
const NEW_ACCOUNT_WINDOW_DAYS = 7;

export const isNewAccount = (createdAt: unknown) => {
  const time = new Date(String(createdAt ?? "")).getTime();
  // Không đọc được ngày tạo thì coi như tài khoản mới để không bỏ sót hướng dẫn.
  if (Number.isNaN(time)) return true;
  return Date.now() - time <= NEW_ACCOUNT_WINDOW_DAYS * 24 * 60 * 60 * 1000;
};

// Trong một phiên app chỉ một màn Trang chủ được hiện giới thiệu cho mỗi tài khoản,
// kể cả khi ngăn xếp lỡ có nhiều Trang chủ cùng lúc (mỗi màn tự kiểm tra riêng).
const claimedGuideUserIds = new Set<string>();

export const claimGuideDisplay = (userId: string) => {
  if (claimedGuideUserIds.has(userId)) return false;
  claimedGuideUserIds.add(userId);
  return true;
};

export const hasSeenGuide = async (userId: string) => {
  try {
    return (await AsyncStorage.getItem(storageKey(userId))) === "1";
  } catch {
    // Không đọc được bộ nhớ thì không làm phiền người dùng.
    return true;
  }
};

export const markGuideSeen = async (userId: string) => {
  try {
    await AsyncStorage.setItem(storageKey(userId), "1");
  } catch {
    // Lần sau sẽ hiện lại; không ảnh hưởng luồng chính.
  }
};
