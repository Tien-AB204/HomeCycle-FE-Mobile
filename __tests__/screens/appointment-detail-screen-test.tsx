import { fireEvent, waitFor } from "@testing-library/react-native";
import {
  mockApiClient,
  mockApiError,
  mockApiResponse,
  mockRouter,
  renderScreen,
  resetScreenHarness,
} from "../helpers/screenHarness";
import AppointmentDetailScreen from "../../app/appointments/[id]";

const APPOINTMENT_DATA = {
  appointment: {
    appointmentType: 1,
    appointmentStatus: 0,
    buyerCheckedIn: false,
    sellerCheckedIn: true,
    createdAt: "2026-07-20T08:00:00Z",
    updatedAt: "2026-07-21T08:00:00Z",
  },
  inspectionAppointment: {
    inspectionDate: "2026-08-01T09:00:00Z",
    inspectionAddress: "123 Nguyễn Trãi, Quận 1, TP.HCM",
  },
};

describe("AppointmentDetailScreen", () => {
  beforeEach(() => {
    resetScreenHarness();
    mockApiClient.current.get.mockResolvedValue(
      mockApiResponse(APPOINTMENT_DATA),
    );
  });

  test("renders appointment details from API", async () => {
    const { getByText, getAllByText } = await renderScreen(
      <AppointmentDetailScreen />,
      { params: { id: "appt-1" } },
    );
    await waitFor(() => expect(getByText("Lịch kiểm định")).toBeTruthy());
    expect(mockApiClient.current.get).toHaveBeenCalledWith(
      "/appointments/appt-1",
    );
    expect(getAllByText("Chờ xác nhận")).toHaveLength(2);
    expect(getByText("Tiến trình lịch hẹn")).toBeTruthy();
    expect(getByText("Thời gian & Địa điểm")).toBeTruthy();
    expect(getByText("123 Nguyễn Trãi, Quận 1, TP.HCM")).toBeTruthy();
    expect(getByText("Trạng thái Check-in")).toBeTruthy();
    expect(getByText("Chưa check-in")).toBeTruthy();
    expect(getByText("Đã check-in")).toBeTruthy();
    expect(getByText("Thông tin hệ thống")).toBeTruthy();
    expect(getByText("Check-in tại điểm hẹn")).toBeTruthy();
  });

  test("shows in-development info when pressing check-in", async () => {
    const { getByText } = await renderScreen(<AppointmentDetailScreen />, {
      params: { id: "appt-1" },
    });
    await waitFor(() =>
      expect(getByText("Check-in tại điểm hẹn")).toBeTruthy(),
    );
    await fireEvent.press(getByText("Check-in tại điểm hẹn"));
    expect(
      getByText('Tính năng "Check-in lịch hẹn" đang được phát triển.'),
    ).toBeTruthy();
  });

  test("shows not-found view when appointment data is missing", async () => {
    mockApiClient.current.get.mockResolvedValue(mockApiResponse({}));
    const { getByText } = await renderScreen(<AppointmentDetailScreen />, {
      params: { id: "appt-x" },
    });
    await waitFor(() =>
      expect(
        getByText("Không tìm thấy thông tin lịch hẹn!"),
      ).toBeTruthy(),
    );
    await fireEvent.press(getByText("Quay lại"));
    expect(mockRouter.current.back).toHaveBeenCalled();
  });

  test("shows not-found view when server returns error", async () => {
    mockApiClient.current.get.mockRejectedValue(
      mockApiError("boom", 500),
    );
    const { getByText } = await renderScreen(<AppointmentDetailScreen />, {
      params: { id: "appt-1" },
    });
    await waitFor(() =>
      expect(
        getByText("Không tìm thấy thông tin lịch hẹn!"),
      ).toBeTruthy(),
    );
  });
});
