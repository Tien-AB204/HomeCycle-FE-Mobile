import AsyncStorage from "@react-native-async-storage/async-storage";
import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import SettingsScreen from "../../app/settings";

describe("SettingsScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
    (AsyncStorage.setItem as jest.Mock).mockClear();
    (AsyncStorage.getItem as jest.Mock).mockClear();
  });

  test("renders settings options", async () => {
    const { getByText, getAllByRole } = await renderScreen(
      <SettingsScreen />,
    );
    expect(getByText("Thiết lập ứng dụng")).toBeTruthy();
    expect(getByText("Giao diện & Hiển thị")).toBeTruthy();
    expect(getByText("Giao diện tối (Dark Mode)")).toBeTruthy();
    expect(getByText("Thông báo")).toBeTruthy();
    expect(getByText("Nhận thông báo đẩy (Push)")).toBeTruthy();
    expect(getByText("Nhận email tin tức")).toBeTruthy();
    expect(getByText("Phiên bản hiện tại: 1.0.0")).toBeTruthy();
    expect(getAllByRole("switch")).toHaveLength(3);
    expect(AsyncStorage.getItem).toHaveBeenCalledWith("theme");
  });

  test("toggles dark mode and persists theme to AsyncStorage", async () => {
    const { getAllByRole } = await renderScreen(<SettingsScreen />);
    const themeSwitch = getAllByRole("switch")[0];
    await fireEvent(themeSwitch, "valueChange", true);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("theme", "dark");
    await fireEvent(themeSwitch, "valueChange", false);
    expect(AsyncStorage.setItem).toHaveBeenCalledWith("theme", "light");
  });

  test("loads dark theme from AsyncStorage", async () => {
    (AsyncStorage.getItem as jest.Mock).mockResolvedValueOnce("dark");
    const { getAllByRole } = await renderScreen(<SettingsScreen />);
    await waitFor(() =>
      expect(getAllByRole("switch")[0].props.value).toBe(true),
    );
  });
});