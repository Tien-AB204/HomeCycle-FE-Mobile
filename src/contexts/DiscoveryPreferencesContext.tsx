import AsyncStorage from "@react-native-async-storage/async-storage";
import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

const SHOW_OWN_POSTS_STORAGE_KEY =
  "homecycle.showOwnPostsInDiscovery.v1";

type DiscoveryPreferencesContextValue = {
  showOwnPostsInDiscovery: boolean;
  isDiscoveryPreferenceLoaded: boolean;
  setShowOwnPostsInDiscovery: (value: boolean) => Promise<void>;
};

const DiscoveryPreferencesContext = createContext<
  DiscoveryPreferencesContextValue | undefined
>(undefined);

const normalizeId = (value: unknown) =>
  String(value ?? "").trim().toLowerCase();

export const filterDiscoveryPosts = <T extends { ownerId?: unknown }>(
  posts: T[],
  currentUserId: unknown,
  showOwnPostsInDiscovery: boolean,
) => {
  const normalizedCurrentUserId = normalizeId(currentUserId);

  if (showOwnPostsInDiscovery || !normalizedCurrentUserId) {
    return posts;
  }

  return posts.filter(
    (post) => normalizeId(post.ownerId) !== normalizedCurrentUserId,
  );
};

export function DiscoveryPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [showOwnPostsInDiscovery, setStoredPreference] = useState(false);
  const [isDiscoveryPreferenceLoaded, setIsPreferenceLoaded] =
    useState(false);

  useEffect(() => {
    let isMounted = true;

    void AsyncStorage.getItem(SHOW_OWN_POSTS_STORAGE_KEY)
      .then((storedValue) => {
        if (isMounted) {
          setStoredPreference(storedValue === "true");
        }
      })
      .catch(() => {
        // Giữ mặc định tắt nếu thiết bị không đọc được lựa chọn đã lưu.
      })
      .finally(() => {
        if (isMounted) {
          setIsPreferenceLoaded(true);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const setShowOwnPostsInDiscovery = useCallback(async (value: boolean) => {
    setStoredPreference(value);

    try {
      await AsyncStorage.setItem(
        SHOW_OWN_POSTS_STORAGE_KEY,
        value ? "true" : "false",
      );
    } catch {
      setStoredPreference((current) => (current === value ? !value : current));
    }
  }, []);

  return (
    <DiscoveryPreferencesContext.Provider
      value={{
        showOwnPostsInDiscovery,
        isDiscoveryPreferenceLoaded,
        setShowOwnPostsInDiscovery,
      }}
    >
      {children}
    </DiscoveryPreferencesContext.Provider>
  );
}

export function useDiscoveryPreferences() {
  const context = useContext(DiscoveryPreferencesContext);

  if (!context) {
    throw new Error(
      "useDiscoveryPreferences phải được dùng bên trong DiscoveryPreferencesProvider",
    );
  }

  return context;
}
