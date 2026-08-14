import { render } from "@testing-library/react-native";
import React from "react";
import { AppFeedbackProvider } from "../../src/components/shared/ActionFeedback";

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

jest.mock("@expo/vector-icons", () => {
  const ReactMock = require("react");
  const { View } = require("react-native");
  const Icon = (props: any) =>
    ReactMock.createElement(View, { testID: `icon-${props.name}` });
  return { Ionicons: Icon };
});

jest.mock("react-native-safe-area-context", () => {
  const ReactMock = require("react");
  const { View } = require("react-native");
  return {
    SafeAreaProvider: ({ children }: any) =>
      ReactMock.createElement(View, null, children),
    SafeAreaView: (props: any) => ReactMock.createElement(View, props),
    useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
    useSafeAreaFrame: () => ({ x: 0, y: 0, width: 390, height: 844 }),
    initialWindowMetrics: {
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
      frame: { x: 0, y: 0, width: 390, height: 844 },
    },
  };
});

export const mockRouter = {
  current: {
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    navigate: jest.fn(),
    setParams: jest.fn(),
    canGoBack: jest.fn(() => true),
  },
};

export const mockParams: { current: Record<string, any> } = { current: {} };

jest.mock("expo-router", () => {
  const ReactMock = require("react");
  return {
    useRouter: () => mockRouter.current,
    useLocalSearchParams: () => mockParams.current,
    useFocusEffect: (cb: any) => {
      const { useEffect } = ReactMock;
      useEffect(cb, [cb]);
    },
    useNavigation: () => ({
      navigate: jest.fn(),
      goBack: jest.fn(),
      setOptions: jest.fn(),
      addListener: jest.fn(),
    }),
    usePathname: () => "/",
    useSegments: () => [],
    router: {
      push: (...args: any[]) => mockRouter.current.push(...args),
      replace: (...args: any[]) => mockRouter.current.replace(...args),
      back: (...args: any[]) => mockRouter.current.back(...args),
      navigate: (...args: any[]) => mockRouter.current.navigate(...args),
      setParams: (...args: any[]) => mockRouter.current.setParams(...args),
    },
    Link: (props: any) =>
      ReactMock.createElement(ReactMock.Fragment, null, props.children),
    Redirect: () => null,
    Stack: { Screen: () => null },
    Tabs: { Screen: () => null },
    Slot: () => null,
  };
});

export const DEFAULT_USER: any = {
  id: "user-1",
  userId: "user-1",
  username: "tester",
  email: "tester@example.com",
  name: "Người Dùng Test",
  avatar: null,
  avatarUrl: null,
  role: "personal",
  createdAt: "2026-01-01T00:00:00Z",
  phone: "0900000000",
  status: "active",
  verificationStatus: "verified",
  reputationScore: 100,
  isEmailVerified: true,
  address: "TP. Hồ Chí Minh",
};

export const mockAuth = {
  current: {
    user: { ...DEFAULT_USER },
    isLoading: false,
    userToken: "test-access-token",
    login: jest.fn(async () => {}),
    logout: jest.fn(),
    reloadUser: jest.fn(async () => {}),
  },
};

jest.mock("../../src/contexts/AuthContext", () => ({
  AuthProvider: ({ children }: any) => children,
  useAuth: () => mockAuth.current,
}));

export const mockChat = {
  current: {
    connection: null,
    joinNegotiation: jest.fn(),
    leaveNegotiation: jest.fn(),
  },
};

jest.mock("../../src/contexts/ChatRealtimeContext", () => ({
  ChatRealtimeProvider: ({ children }: any) => children,
  useChatRealtime: () => mockChat.current,
}));

export const mockApiClient = {
  current: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    patch: jest.fn(),
    delete: jest.fn(),
    request: jest.fn(),
    defaults: { headers: { common: {} }, baseURL: "", timeout: 10000 },
    interceptors: { request: { use: jest.fn() }, response: { use: jest.fn() } },
  },
};

jest.mock("../../src/services/apis/axiosClient", () => ({
  __esModule: true,
  default: mockApiClient.current,
}));

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [{ uri: "file:///tmp/mock-image.jpg", fileName: "mock.jpg" }],
  }),
  requestMediaLibraryPermissionsAsync: jest
    .fn()
    .mockResolvedValue({ granted: true }),
  MediaTypeOptions: { Images: "Images", Videos: "Videos" },
}));

jest.mock("expo-linking", () => ({
  createURL: (path: string) => `homecycle://${path}`,
  openURL: jest.fn(),
  canOpenURL: jest.fn().mockResolvedValue(true),
  useURL: () => null,
}));

jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn().mockResolvedValue({ type: "dismiss" }),
  maybeCompleteAuthSession: jest.fn(),
}));

jest.mock("expo-auth-session", () => ({
  AuthRequest: { useAuthRequest: () => [null, null, jest.fn()] },
  makeRedirectUri: jest.fn(() => "mock-redirect-uri"),
}));

jest.mock("expo-auth-session/providers/google", () => ({
  useIdTokenAuthRequest: () => [null, null, jest.fn()],
}));

export function mockApiResponse(
  data: any,
  status = 200,
  statusText = "OK",
): any {
  return { data, status, statusText, headers: {}, config: {} };
}

export function mockApiError(
  message: string,
  status?: number,
  data: any = {},
): any {
  const error: any = new Error(message);
  error.message = message;
  error.isAxiosError = true;
  if (status !== undefined) {
    error.response = { status, data, headers: {}, config: {} };
  }
  return error;
}

export function setAuth(overrides: Partial<typeof mockAuth.current>): void {
  mockAuth.current = { ...mockAuth.current, ...overrides };
}

export function setParams(params: Record<string, any>): void {
  mockParams.current = params;
}

export function resetScreenHarness(): void {
  mockParams.current = {};
  mockRouter.current.push.mockClear();
  mockRouter.current.replace.mockClear();
  mockRouter.current.back.mockClear();
  mockRouter.current.navigate.mockClear();
  mockRouter.current.setParams.mockClear();
  mockApiClient.current.get.mockClear();
  mockApiClient.current.post.mockClear();
  mockApiClient.current.put.mockClear();
  mockApiClient.current.patch.mockClear();
  mockApiClient.current.delete.mockClear();
  mockApiClient.current.request.mockClear();
  mockAuth.current = {
    user: { ...DEFAULT_USER },
    isLoading: false,
    userToken: "test-access-token",
    login: jest.fn(async () => {}),
    logout: jest.fn(),
    reloadUser: jest.fn(async () => {}),
  };
  mockChat.current.connection = null;
  mockChat.current.joinNegotiation.mockClear();
  mockChat.current.leaveNegotiation.mockClear();
}

export async function renderScreen(
  ui: React.ReactElement,
  options: { params?: Record<string, any> } = {},
) {
  if (options.params) setParams(options.params);
  return render(<AppFeedbackProvider>{ui}</AppFeedbackProvider>);
}
