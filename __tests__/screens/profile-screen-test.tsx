import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  DEFAULT_USER,
  mockApiClient,
  mockApiResponse,
  mockAuth,
  mockRouter,
  renderScreen,
  resetScreenHarness,
  setAuth,
} from "../helpers/screenHarness";
import ProfileScreen from "../../app/(tabs)/profile";

function mockProfileData() {
  mockApiClient.current.get.mockImplementation((url: string) => {
    if (url === "/posts/get-all/by-user/user-1") {
      return Promise.resolve(
        mockApiResponse({ data: { totalCount: 5 } }),
      );
    }
    return Promise.resolve(mockApiResponse({ data: {} }));
  });
}

describe("ProfileScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("shows user info from auth context", async () => {
    mockProfileData();
    const { getByText, getAllByText } = await renderScreen(
      <ProfileScreen />,
    );

    await waitFor(() =>
      expect(mockApiClient.current.get).toHaveBeenCalledWith(
        "/posts/get-all/by-user/user-1",
        expect.anything(),
      ),
    );
    await waitFor(() => expect(getByText("tester")).toBeTruthy());
    expect(getByText(/Tham gia:/)).toBeTruthy();
    expect(getByText("Điểm uy tín: 100")).toBeTruthy();
    await waitFor(() => expect(getByText("5 bài")).toBeTruthy());
    expect(getByText("Thông tin tài khoản")).toBeTruthy();
    expect(getByText("Thiết lập ứng dụng")).toBeTruthy();
    expect(getAllByText("Đăng xuất").length).toBeGreaterThan(0);
  });

  test("navigates to account info menu", async () => {
    mockProfileData();
    const { getByText } = await renderScreen(<ProfileScreen />);
    await waitFor(() => expect(getByText("tester")).toBeTruthy());

    await fireEvent.press(getByText("Thông tin tài khoản"));
    expect(mockRouter.current.push).toHaveBeenCalledWith(
      "/profile/account-info",
    );
  });

  test("shows dev notice for Lịch sử giao dịch", async () => {
    mockProfileData();
    const { getByText } = await renderScreen(<ProfileScreen />);
    await waitFor(() => expect(getByText("tester")).toBeTruthy());

    await fireEvent.press(getByText("Lịch sử giao dịch"));
    await waitFor(() =>
      expect(getByText("Tính năng đang được phát triển.")).toBeTruthy(),
    );
  });

  test("cancels logout keeps session", async () => {
    mockProfileData();
    const { getByText, getAllByText } = await renderScreen(
      <ProfileScreen />,
    );
    await waitFor(() => expect(getByText("tester")).toBeTruthy());

    await fireEvent.press(getByText("Đăng xuất"));
    expect(
      getByText("Bạn có chắc muốn đăng xuất khỏi tài khoản hiện tại?"),
    ).toBeTruthy();

    await fireEvent.press(getByText("Ở lại"));
    expect(getAllByText("Đăng xuất").length).toBeGreaterThan(0);
    expect(mockAuth.current.logout).not.toHaveBeenCalled();
  });

  test("logs out and replaces to (tabs) after confirming", async () => {
    mockProfileData();
    const { getByText, getAllByText } = await renderScreen(
      <ProfileScreen />,
    );
    await waitFor(() => expect(getByText("tester")).toBeTruthy());

    await fireEvent.press(getByText("Đăng xuất"));
    await fireEvent.press(getAllByText("Đăng xuất")[2]);

    await waitFor(() =>
      expect(mockAuth.current.logout).toHaveBeenCalled(),
    );
    expect(mockRouter.current.replace).toHaveBeenCalledWith("/(tabs)");
  });

  test("business user sees onboarding status", async () => {
    setAuth({
      user: {
        ...DEFAULT_USER,
        id: "b-1",
        userId: "b-1",
        username: "congtyx",
        role: "business",
      },
    });
    mockApiClient.current.get.mockImplementation((url: string) => {
      if (url === "/posts/get-all/by-user/b-1") {
        return Promise.resolve(
          mockApiResponse({ data: { data: { totalCount: 0 } } }),
        );
      }
      if (url === "/business-profiles/onboarding-status") {
        return Promise.resolve(
          mockApiResponse({ data: { status: "PendingApproval" } }),
        );
      }
      return Promise.resolve(mockApiResponse({ data: {} }));
    });

    const { getByText } = await renderScreen(<ProfileScreen />);

    await waitFor(() => expect(getByText("congtyx")).toBeTruthy());
    await waitFor(() =>
      expect(
        mockApiClient.current.get,
      ).toHaveBeenCalledWith("/business-profiles/onboarding-status"),
    );
    await waitFor(() =>
      expect(getByText("Đang chờ duyệt")).toBeTruthy(),
    );
    expect(getByText("Thống kê & Đơn hàng")).toBeTruthy();
    expect(getByText("0 Giao dịch hoàn tất")).toBeTruthy();
  });
});
