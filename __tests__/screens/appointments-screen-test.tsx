import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiError,
  mockApiResponse,
  mockRouter,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import AppointmentsScreen from "../../app/(tabs)/appointments";

const INSPECTION_ITEM = {
  appointmentId: "a-1",
  productName: "Máy giặt LG",
  counterpartyName: "Anh Tuấn",
  appointmentStatus: 1,
  inspectionDate: "2026-08-20T10:00:00",
  pickupAddress: "123 Lê Lợi, Q1, TP.HCM",
  createdAt: "2026-08-01T10:00:00",
};

const COLLECTION_ITEM = {
  appointmentId: "a-2",
  productName: "Nồi cơm điện",
  counterpartyName: "Chị Hoa",
  appointmentStatus: 2,
  collectionDate: "2026-08-22T14:00:00",
  deliveryAddress: "45 Nguyễn Huệ, Q1, TP.HCM",
  createdAt: "2026-08-02T10:00:00",
};

function mockAppointmentsData(
  inspectionItems: any[] = [INSPECTION_ITEM],
  collectionItems: any[] = [COLLECTION_ITEM],
) {
  mockApiClient.current.get.mockImplementation((url: string) => {
    if (url === "/appointments/buyer/inspections") {
      return Promise.resolve(mockApiResponse({ items: inspectionItems }));
    }
    if (url === "/appointments/buyer/collections") {
      return Promise.resolve(mockApiResponse({ items: collectionItems }));
    }
    return Promise.resolve(mockApiResponse({ items: [] }));
  });
}

describe("AppointmentsScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
  });

  test("renders appointment cards from API", async () => {
    mockAppointmentsData();
    const { getByText, getAllByText } = await renderScreen(
      <AppointmentsScreen />,
    );

    await waitFor(() =>
      expect(mockApiClient.current.get).toHaveBeenCalledWith(
        "/appointments/buyer/inspections",
        expect.anything(),
      ),
    );
    await waitFor(() => expect(getByText("Máy giặt LG")).toBeTruthy());
    expect(getByText("Đã xác nhận")).toBeTruthy();
    expect(getByText("Nồi cơm điện")).toBeTruthy();
    expect(getByText("Đã hoàn thành")).toBeTruthy();
    expect(getByText("Lịch kiểm định")).toBeTruthy();
    expect(getByText("Lịch thu gom")).toBeTruthy();
    expect(getByText("Đơn mua: Anh Tuấn")).toBeTruthy();
    expect(getByText("Đơn mua: Chị Hoa")).toBeTruthy();
    expect(getAllByText("Chi tiết lịch hẹn")).toHaveLength(2);
  });

  test("filters list when tapping type filter", async () => {
    mockAppointmentsData();
    const { getByText, queryByText } = await renderScreen(
      <AppointmentsScreen />,
    );
    await waitFor(() => expect(getByText("Máy giặt LG")).toBeTruthy());

    await fireEvent.press(getByText("Thu gom"));
    await waitFor(() => expect(queryByText("Máy giặt LG")).toBeNull());
    expect(getByText("Nồi cơm điện")).toBeTruthy();
  });

  test("shows empty state when no appointments", async () => {
    mockAppointmentsData([], []);
    const { getByText } = await renderScreen(<AppointmentsScreen />);

    await waitFor(() =>
      expect(getByText("Chưa có lịch hẹn nào.")).toBeTruthy(),
    );
  });

  test("shows empty state when APIs fail", async () => {
    mockApiClient.current.get.mockRejectedValue(
      mockApiError("Lỗi máy chủ", 500),
    );
    const { getByText } = await renderScreen(<AppointmentsScreen />);

    await waitFor(() =>
      expect(getByText("Chưa có lịch hẹn nào.")).toBeTruthy(),
    );
  });

  test("navigates to appointment detail", async () => {
    mockAppointmentsData([INSPECTION_ITEM]);
    const { getByText, getAllByText } = await renderScreen(
      <AppointmentsScreen />,
    );
    await waitFor(() => expect(getByText("Máy giặt LG")).toBeTruthy());

    await fireEvent.press(getAllByText("Chi tiết lịch hẹn")[0]);
    expect(mockRouter.current.push).toHaveBeenCalledWith(
      "/appointments/a-1",
    );
  });
});
