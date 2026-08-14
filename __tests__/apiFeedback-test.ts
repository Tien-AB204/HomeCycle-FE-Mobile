import { AxiosError } from "axios";

import {
  NETWORK_ERROR_MESSAGE,
  SERVER_ERROR_MESSAGE,
  getApiErrorMessage,
  getApiSuccessMessage,
} from "../src/utils/apiFeedback";

const FALLBACK = "Không thể thực hiện thao tác. Vui lòng thử lại.";

const createAxiosError = (
  response?: { status: number; data: unknown },
) => {
  return new AxiosError(
    "Request failed",
    response ? `ERR_${response.status}` : "ERR_NETWORK",
    undefined,
    {},
    response as any,
  );
};

describe("getApiErrorMessage", () => {
  describe("Axios errors", () => {
    test("status 500 with server message -> SERVER_ERROR_MESSAGE", () => {
      const error = createAxiosError({
        status: 500,
        data: { message: "boom" },
      });
      expect(getApiErrorMessage(error)).toBe(SERVER_ERROR_MESSAGE);
    });

    test("status 503 -> SERVER_ERROR_MESSAGE", () => {
      const error = createAxiosError({
        status: 503,
        data: { message: "unavailable" },
      });
      expect(getApiErrorMessage(error)).toBe(SERVER_ERROR_MESSAGE);
    });

    test("boundary: status exactly 500 -> SERVER_ERROR_MESSAGE", () => {
      const error = createAxiosError({
        status: 500,
        data: { error: { message: "internal" } },
      });
      expect(getApiErrorMessage(error)).toBe(SERVER_ERROR_MESSAGE);
    });

    test("no response (network error) -> NETWORK_ERROR_MESSAGE", () => {
      const error = createAxiosError();
      expect(getApiErrorMessage(error)).toBe(NETWORK_ERROR_MESSAGE);
    });

    test("400 with response.data.message -> that message", () => {
      const error = createAxiosError({
        status: 400,
        data: { message: "Email không hợp lệ" },
      });
      expect(getApiErrorMessage(error)).toBe("Email không hợp lệ");
    });

    test("400 with response.data.error.message -> that message", () => {
      const error = createAxiosError({
        status: 400,
        data: { error: { message: "Sai OTP" } },
      });
      expect(getApiErrorMessage(error)).toBe("Sai OTP");
    });

    test("400 with response.data.data.message -> that message", () => {
      const error = createAxiosError({
        status: 400,
        data: { data: { message: "Trùng email" } },
      });
      expect(getApiErrorMessage(error)).toBe("Trùng email");
    });

    test("400 with response.data.data.error.message -> that message", () => {
      const error = createAxiosError({
        status: 400,
        data: { data: { error: { message: "Quá hạn OTP" } } },
      });
      expect(getApiErrorMessage(error)).toBe("Quá hạn OTP");
    });

    test("400 with string data -> trimmed string message", () => {
      const error = createAxiosError({
        status: 400,
        data: "   Server said no   ",
      });
      expect(getApiErrorMessage(error)).toBe("Server said no");
    });

    test("boundary: status 499 just below 500 -> reads payload message", () => {
      const error = createAxiosError({
        status: 499,
        data: { message: "custom" },
      });
      expect(getApiErrorMessage(error)).toBe("custom");
    });

    test("400 with empty object payload -> fallback", () => {
      const error = createAxiosError({ status: 400, data: {} });
      expect(getApiErrorMessage(error)).toBe(FALLBACK);
    });

    test("abnormal: whitespace-only message -> fallback", () => {
      const error = createAxiosError({
        status: 400,
        data: { message: "   " },
      });
      expect(getApiErrorMessage(error)).toBe(FALLBACK);
    });

    test("abnormal: null payload -> fallback", () => {
      const error = createAxiosError({ status: 400, data: null });
      expect(getApiErrorMessage(error)).toBe(FALLBACK);
    });

    test("abnormal: no payload and no status -> fallback", () => {
      const error = createAxiosError({ status: 400, data: undefined });
      expect(getApiErrorMessage(error)).toBe(FALLBACK);
    });
  });

  describe("Non-axios errors", () => {
    test("error shaped like server response status 503 -> SERVER_ERROR_MESSAGE", () => {
      const error = {
        response: { status: 503, data: { message: "down" } },
      };
      expect(getApiErrorMessage(error)).toBe(SERVER_ERROR_MESSAGE);
    });

    test("400-shaped error with data.message -> that message", () => {
      const error = {
        response: { status: 400, data: { message: "Bad request" } },
      };
      expect(getApiErrorMessage(error)).toBe("Bad request");
    });

    test("plain Error with message -> error.message", () => {
      const error = new Error("Something broke");
      expect(getApiErrorMessage(error)).toBe("Something broke");
    });

    test("abnormal: null error -> fallback", () => {
      expect(getApiErrorMessage(null)).toBe(FALLBACK);
    });

    test("abnormal: undefined error -> fallback", () => {
      expect(getApiErrorMessage(undefined)).toBe(FALLBACK);
    });

    test("custom fallback is used when nothing to read", () => {
      const error = { response: { status: 400, data: {} } };
      expect(getApiErrorMessage(error, "Xảy ra lỗi")).toBe(
        "Xảy ra lỗi",
      );
    });
  });
});

describe("getApiSuccessMessage", () => {
  test("response.data.message -> that message", () => {
    expect(
      getApiSuccessMessage({ data: { message: "Thành công" } }, FALLBACK),
    ).toBe("Thành công");
  });

  test("response.data.error.message -> that message", () => {
    expect(
      getApiSuccessMessage(
        { data: { error: { message: "Đã đăng ký" } } },
        FALLBACK,
      ),
    ).toBe("Đã đăng ký");
  });

  test("direct string response -> trimmed string", () => {
    expect(getApiSuccessMessage("   OK   ", FALLBACK)).toBe("OK");
  });

  test("abnormal: empty response -> fallback", () => {
    expect(getApiSuccessMessage({}, FALLBACK)).toBe(FALLBACK);
  });

  test("abnormal: null response -> fallback", () => {
    expect(getApiSuccessMessage(null, FALLBACK)).toBe(FALLBACK);
  });
});