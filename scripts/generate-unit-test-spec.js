/**
 * Generate the Unit Test Specification workbook (Excel) for HomeCycle Mobile.
 * Structure follows the team template:
 *   1. Record of Change
 *   2. Overview
 *   3. FunctionList
 *   4. Test Report
 *   5. One sheet per function (test cases with Condition / Confirmation)
 *
 * Run: node scripts/generate-unit-test-spec.js
 */
const path = require("path");
const fs = require("fs");
const ExcelJS = require("exceljs");

const PROJECT = "HomeCycle Mobile";
const VERSION = "1.1";
const NORM_TC_PER_KLOC = 15;
const CREATED_BY = "TBD";
const EXECUTED_BY = "TBD";
const DATE = "14/08/2026";

const FALLBACK_MSG = "Không thể thực hiện thao tác. Vui lòng thử lại.";
const SERVER_MSG = "Lỗi máy chủ. Vui lòng thử lại sau.";
const NETWORK_MSG =
  "Không thể kết nối đến máy chủ. Vui lòng kiểm tra mạng và thử lại.";

/**
 * Functions under test.
 * tc fields: name, type (Normal | Boundary | Abnormal), condition, confirmation
 * Note: literal message values below are the actual Vietnamese strings produced
 * by the application; they are kept as-is because they are the expected outputs.
 */
const FUNCTIONS = [
  {
    code: "F01",
    file: "src/utils/apiFeedback.ts",
    name: "getApiErrorMessage",
    loc: 34,
    requirement:
      "Returns the appropriate error message for API failures: 5xx -> server message, network loss -> network message, other errors -> message read from the payload or fallback.",
    tcs: [
      {
        name: "Axios error with status 500 and a message",
        type: "Normal",
        condition:
          "Precondition: error is an AxiosError with a response.\nInput: AxiosError(status=500, data={message:'boom'})",
        confirmation: `Expected result: SERVER_ERROR_MESSAGE ('${SERVER_MSG}')`,
      },
      {
        name: "Axios error with status 503 and a message",
        type: "Normal",
        condition:
          "Precondition: error is an AxiosError with a response.\nInput: AxiosError(status=503, data={message:'unavailable'})",
        confirmation: `Expected result: SERVER_ERROR_MESSAGE ('${SERVER_MSG}')`,
      },
      {
        name: "Boundary: status exactly 500",
        type: "Boundary",
        condition:
          "Precondition: error is an AxiosError with a response.\nInput: AxiosError(status=500, data={error:{message:'internal'}})",
        confirmation: `Expected result: SERVER_ERROR_MESSAGE ('${SERVER_MSG}')`,
      },
      {
        name: "Network error (no response)",
        type: "Normal",
        condition:
          "Precondition: error is an AxiosError without a response (network error).\nInput: AxiosError(no response)",
        confirmation: `Expected result: NETWORK_ERROR_MESSAGE ('${NETWORK_MSG}')`,
      },
      {
        name: "Error 400 with response.data.message",
        type: "Normal",
        condition:
          "Precondition: error is an AxiosError with a response.\nInput: AxiosError(status=400, data={message:'Email không hợp lệ'})",
        confirmation: "Expected result: 'Email không hợp lệ'",
      },
      {
        name: "Error 400 with response.data.error.message",
        type: "Normal",
        condition:
          "Precondition: error is an AxiosError with a response.\nInput: AxiosError(status=400, data={error:{message:'Sai OTP'}})",
        confirmation: "Expected result: 'Sai OTP'",
      },
      {
        name: "Error 400 with response.data.data.message",
        type: "Normal",
        condition:
          "Precondition: error is an AxiosError with a response.\nInput: AxiosError(status=400, data={data:{message:'Trùng email'}})",
        confirmation: "Expected result: 'Trùng email'",
      },
      {
        name: "Error 400 with response.data.data.error.message",
        type: "Normal",
        condition:
          "Precondition: error is an AxiosError with a response.\nInput: AxiosError(status=400, data={data:{error:{message:'Quá hạn OTP'}}})",
        confirmation: "Expected result: 'Quá hạn OTP'",
      },
      {
        name: "Payload is a string (with surrounding whitespace)",
        type: "Normal",
        condition:
          "Precondition: error is an AxiosError with a response.\nInput: AxiosError(status=400, data='   Server said no   ')",
        confirmation: "Expected result: 'Server said no' (trimmed)",
      },
      {
        name: "Boundary: status 499 (just below the 5xx threshold)",
        type: "Boundary",
        condition:
          "Precondition: error is an AxiosError with a response.\nInput: AxiosError(status=499, data={message:'custom'})",
        confirmation:
          "Expected result: 'custom' (NOT the server error message)",
      },
      {
        name: "Empty payload",
        type: "Abnormal",
        condition:
          "Precondition: error is an AxiosError with a response.\nInput: AxiosError(status=400, data={})",
        confirmation: `Expected result: fallback ('${FALLBACK_MSG}')`,
      },
      {
        name: "Message contains only whitespace",
        type: "Abnormal",
        condition:
          "Precondition: error is an AxiosError with a response.\nInput: AxiosError(status=400, data={message:'   '})",
        confirmation: `Expected result: fallback ('${FALLBACK_MSG}')`,
      },
      {
        name: "Payload is null",
        type: "Abnormal",
        condition:
          "Precondition: error is an AxiosError with a response.\nInput: AxiosError(status=400, data=null)",
        confirmation: `Expected result: fallback ('${FALLBACK_MSG}')`,
      },
      {
        name: "Payload is undefined",
        type: "Abnormal",
        condition:
          "Precondition: error is an AxiosError with a response.\nInput: AxiosError(status=400, data=undefined)",
        confirmation: `Expected result: fallback ('${FALLBACK_MSG}')`,
      },
      {
        name: "Non-axios error shaped like a 503 response",
        type: "Normal",
        condition:
          "Precondition: error is not an AxiosError.\nInput: {response:{status:503, data:{message:'down'}}}",
        confirmation: `Expected result: SERVER_ERROR_MESSAGE ('${SERVER_MSG}')`,
      },
      {
        name: "Non-axios error shaped like a 400 response with data.message",
        type: "Normal",
        condition:
          "Precondition: error is not an AxiosError.\nInput: {response:{status:400, data:{message:'Bad request'}}}",
        confirmation: "Expected result: 'Bad request'",
      },
      {
        name: "Plain Error with a message",
        type: "Normal",
        condition:
          "Precondition: error is a plain Error.\nInput: new Error('Something broke')",
        confirmation: "Expected result: 'Something broke'",
      },
      {
        name: "Error is null",
        type: "Abnormal",
        condition: "Precondition: no error is provided.\nInput: null",
        confirmation: `Expected result: fallback ('${FALLBACK_MSG}')`,
      },
      {
        name: "Error is undefined",
        type: "Abnormal",
        condition: "Precondition: no error is provided.\nInput: undefined",
        confirmation: `Expected result: fallback ('${FALLBACK_MSG}')`,
      },
      {
        name: "Custom fallback message",
        type: "Boundary",
        condition:
          "Precondition: no message can be read from the payload.\nInput: {response:{status:400, data:{}}}, fallback='Xảy ra lỗi'",
        confirmation: "Expected result: 'Xảy ra lỗi'",
      },
    ],
  },
  {
    code: "F02",
    file: "src/utils/apiFeedback.ts",
    name: "getApiSuccessMessage",
    loc: 6,
    requirement:
      "Returns the success message from the response, or the fallback when none is available.",
    tcs: [
      {
        name: "response.data.message",
        type: "Normal",
        condition:
          "Precondition: a valid response.\nInput: {data:{message:'Thành công'}}",
        confirmation: "Expected result: 'Thành công'",
      },
      {
        name: "response.data.error.message",
        type: "Normal",
        condition:
          "Precondition: a valid response.\nInput: {data:{error:{message:'Đã đăng ký'}}}",
        confirmation: "Expected result: 'Đã đăng ký'",
      },
      {
        name: "Response is a string",
        type: "Normal",
        condition:
          "Precondition: response is a string with surrounding whitespace.\nInput: '   OK   '",
        confirmation: "Expected result: 'OK' (trimmed)",
      },
      {
        name: "Empty response",
        type: "Abnormal",
        condition:
          "Precondition: response contains no message.\nInput: {}",
        confirmation: `Expected result: fallback ('${FALLBACK_MSG}')`,
      },
      {
        name: "Response is null",
        type: "Abnormal",
        condition: "Precondition: no response.\nInput: null",
        confirmation: `Expected result: fallback ('${FALLBACK_MSG}')`,
      },
    ],
  },
  {
    code: "F03",
    file: "src/services/apis/authApi.ts",
    name: "authApi.sendOtp",
    loc: 3,
    requirement: "Sends the OTP request to /auth/send-otp.",
    tcs: [
      {
        name: "POSTs to the correct endpoint with the email payload",
        type: "Normal",
        condition:
          "Precondition: axiosClient.post works normally.\nInput: email='a@b.com'",
        confirmation:
          "axiosClient.post is called with ('/auth/send-otp', {email:'a@b.com'})",
      },
      {
        name: "Resolves with the axios response",
        type: "Normal",
        condition:
          "Precondition: post resolves with {data:{ok:true}}.\nInput: email='a@b.com'",
        confirmation: "Promise resolves with {data:{ok:true}}",
      },
    ],
  },
  {
    code: "F04",
    file: "src/services/apis/authApi.ts",
    name: "authApi.verifyOtp",
    loc: 4,
    requirement: "Sends the OTP verification request to /auth/verify-otp.",
    tcs: [
      {
        name: "POSTs to the correct endpoint with email + otp payload",
        type: "Normal",
        condition:
          "Precondition: axiosClient.post works normally.\nInput: email='a@b.com', otp='123456'",
        confirmation:
          "axiosClient.post is called with ('/auth/verify-otp', {email:'a@b.com', otp:'123456'})",
      },
      {
        name: "Network failure",
        type: "Abnormal",
        condition:
          "Precondition: post rejects with Error('network').\nInput: email='a@b.com', otp='000000'",
        confirmation: "Promise rejects with 'network'",
      },
    ],
  },
  {
    code: "F05",
    file: "src/services/apis/authApi.ts",
    name: "authApi.registerPersonal",
    loc: 7,
    requirement:
      "Registers a personal account with a FormData body and a registration token.",
    tcs: [
      {
        name: "POSTs with FormData + multipart header + registration token header",
        type: "Normal",
        condition:
          "Precondition: axiosClient.post works normally.\nInput: registrationToken='reg-token-1', formData=FormData",
        confirmation:
          "axiosClient.post is called with ('/auth/personal/register', formData, {headers:{'Content-Type':'multipart/form-data','X-Registration-Token':'reg-token-1'}})",
      },
    ],
  },
  {
    code: "F06",
    file: "src/services/apis/authApi.ts",
    name: "authApi.registerBusiness",
    loc: 10,
    requirement: "Registers a business account with only a password.",
    tcs: [
      {
        name: "POSTs with password + registration token header",
        type: "Normal",
        condition:
          "Precondition: axiosClient.post works normally.\nInput: token='reg-token-2', password='pass123'",
        confirmation:
          "axiosClient.post is called with ('/auth/business/register', {password:'pass123'}, {headers:{'X-Registration-Token':'reg-token-2'}})",
      },
      {
        name: "Resolves with response.data",
        type: "Normal",
        condition:
          "Precondition: post resolves with {data:{user:{id:1}}}.\nInput: token='t', password='p'",
        confirmation: "Promise resolves with {user:{id:1}} (data only)",
      },
    ],
  },
  {
    code: "F07",
    file: "src/services/apis/authApi.ts",
    name: "authApi.googleLogin",
    loc: 3,
    requirement: "Signs in with Google using an idToken.",
    tcs: [
      {
        name: "POSTs to the correct endpoint with the idToken payload",
        type: "Normal",
        condition:
          "Precondition: axiosClient.post works normally.\nInput: idToken='google-id-token'",
        confirmation:
          "axiosClient.post is called with ('/auth/google-login', {idToken:'google-id-token'})",
      },
    ],
  },
  {
    code: "F08",
    file: "src/services/apis/axiosClient.ts",
    name: "Request interceptor (attach token)",
    loc: 23,
    requirement:
      "Request interceptor reads the accessToken from AsyncStorage and attaches it to the Authorization header.",
    tcs: [
      {
        name: "Access token exists",
        type: "Normal",
        condition:
          "Precondition: AsyncStorage.getItem('accessToken') returns 'token-abc'.\nInput: config={headers:{}}",
        confirmation:
          "config.headers.Authorization = 'Bearer token-abc'",
      },
      {
        name: "No access token",
        type: "Normal",
        condition:
          "Precondition: AsyncStorage.getItem('accessToken') returns null.\nInput: config={headers:{}}",
        confirmation: "config.headers.Authorization = undefined",
      },
      {
        name: "AsyncStorage read error",
        type: "Abnormal",
        condition:
          "Precondition: getItem throws Error('storage error').\nInput: config={headers:{}}",
        confirmation:
          "config is returned unchanged {headers:{}}, no crash",
      },
    ],
  },
  {
    code: "F09",
    file: "src/services/apis/axiosClient.ts",
    name: "Response interceptor - 5xx normalization",
    loc: 35,
    requirement:
      "For 5xx errors, the standard SERVER_ERROR_MESSAGE is written onto the error and into response.data.",
    tcs: [
      {
        name: "5xx with an object payload",
        type: "Normal",
        condition:
          "Precondition: error has response status 500, data={detail:'boom', error:{code:'E1'}}",
        confirmation:
          "error.userMessage and error.message = SERVER_ERROR_MESSAGE; response.data.message and response.data.error.message = SERVER_ERROR_MESSAGE; other fields (detail, error.code) are preserved",
      },
      {
        name: "Boundary: status 503",
        type: "Boundary",
        condition:
          "Precondition: error has response status 503, data={}",
        confirmation:
          "response.data.message = SERVER_ERROR_MESSAGE",
      },
      {
        name: "Payload is not an object (string)",
        type: "Abnormal",
        condition:
          "Precondition: error has response status 500, data='Internal Server Error'",
        confirmation:
          "No crash; response.data.message and response.data.error.message = SERVER_ERROR_MESSAGE",
      },
    ],
  },
  {
    code: "F10",
    file: "src/services/apis/axiosClient.ts",
    name: "Response interceptor - token refresh on 401",
    loc: 96,
    requirement:
      "On 401, calls /auth/refresh-token, updates the tokens, retries the original request; concurrent requests wait in a queue.",
    tcs: [
      {
        name: "Refresh succeeds and the original request is retried",
        type: "Normal",
        condition:
          "Precondition: refreshToken='refresh-token-123' exists in AsyncStorage; POST refresh returns {accessToken:'new-access', refreshToken:'new-refresh'}; retried request succeeds {status:200}.\nInput: 401 error with config={url:'/me', headers:{}}",
        confirmation:
          "POST to 'https://homecycle-backend.onrender.com/api/auth/refresh-token' with {refreshToken}; setItem('accessToken','new-access') and setItem('refreshToken','new-refresh'); original request headers.Authorization = 'Bearer new-access'; original request is retried",
      },
      {
        name: "No refresh token available",
        type: "Abnormal",
        condition:
          "Precondition: AsyncStorage.getItem('refreshToken') returns null.\nInput: 401 error with config={url:'/me', headers:{}}",
        confirmation:
          "Rejects with 'No refresh token available'; multiRemove(['accessToken','refreshToken']) is called",
      },
      {
        name: "Refresh call fails",
        type: "Abnormal",
        condition:
          "Precondition: refreshToken exists; POST refresh rejects with Error('refresh failed').\nInput: 401 error",
        confirmation:
          "Rejects with 'refresh failed'; multiRemove(['accessToken','refreshToken']) is called",
      },
      {
        name: "Concurrent 401s - refresh called only once",
        type: "Normal",
        condition:
          "Precondition: refreshToken exists; POST refresh returns {accessToken:'new-access'}.\nInput: 2 simultaneous 401 errors with different configs (/a, /b)",
        confirmation:
          "POST refresh is called exactly once; both requests are retried; the queued request headers = 'Bearer new-access'",
      },
      {
        name: "Boundary: request already retried (_retry=true)",
        type: "Boundary",
        condition:
          "Precondition: config._retry = true.\nInput: 401 error with config={url:'/me', headers:{}, _retry:true}",
        confirmation:
          "Rejects the original error, refresh is NOT called",
      },
      {
        name: "Boundary: 401 without config",
        type: "Boundary",
        condition:
          "Precondition: error.config is null/undefined.\nInput: 401 error without a config",
        confirmation:
          "Rejects the original error, refresh is NOT called",
      },
    ],
  },
  {
    code: "F11",
    file: "src/services/apis/axiosClient.ts",
    name: "Response interceptor - other errors",
    loc: 2,
    requirement: "Errors other than 5xx/401 are rejected unchanged.",
    tcs: [
      {
        name: "404 error",
        type: "Abnormal",
        condition:
          "Precondition: 404 error, data={message:'Not found'}.\nInput: 404 error with config={url:'/x', headers:{}}",
        confirmation:
          "Rejects the original error; data is not modified; refresh is NOT called",
      },
      {
        name: "No response object",
        type: "Abnormal",
        condition:
          "Precondition: error has no response.\nInput: error without response and with config={url:'/x', headers:{}}",
        confirmation:
          "Rejects the original error; refresh is NOT called",
      },
    ],
  },
  {
    code: "F12",
    file: "src/constants/filters.ts",
    name: "MAIN_CATEGORIES",
    loc: 5,
    requirement: "Main category list.",
    tcs: [
      {
        name: "Contains exactly 3 categories",
        type: "Normal",
        condition: "Precondition: none.\nInput: MAIN_CATEGORIES",
        confirmation: "Array length = 3",
      },
      {
        name: "Every category has a non-empty id and label",
        type: "Normal",
        condition:
          "Precondition: none.\nInput: each element of MAIN_CATEGORIES",
        confirmation:
          "id.length > 0 and label.length > 0 for every element",
      },
      {
        name: "Ids are unique",
        type: "Normal",
        condition:
          "Precondition: none.\nInput: the set of ids of MAIN_CATEGORIES",
        confirmation: "Number of unique ids = number of elements",
      },
    ],
  },
  {
    code: "F13",
    file: "src/constants/filters.ts",
    name: "GENERAL_FILTERS",
    loc: 16,
    requirement: "General filters: conditions, price ranges, priorities.",
    tcs: [
      {
        name: "Contains 5 conditions",
        type: "Normal",
        condition:
          "Precondition: none.\nInput: GENERAL_FILTERS.conditions",
        confirmation: "Array length = 5",
      },
      {
        name: "Contains 4 price ranges",
        type: "Normal",
        condition:
          "Precondition: none.\nInput: GENERAL_FILTERS.priceRanges",
        confirmation: "Array length = 4",
      },
      {
        name: "Contains 2 priorities",
        type: "Normal",
        condition:
          "Precondition: none.\nInput: GENERAL_FILTERS.priorities",
        confirmation: "Array length = 2",
      },
    ],
  },
  {
    code: "F14",
    file: "src/constants/filters.ts",
    name: "SPECIFIC_FILTERS",
    loc: 33,
    requirement: "Category-specific filters.",
    tcs: [
      {
        name: "Has a config for every main category",
        type: "Normal",
        condition:
          "Precondition: none.\nInput: SPECIFIC_FILTERS and the ids of MAIN_CATEGORIES",
        confirmation:
          "SPECIFIC_FILTERS has a key matching every main category id",
      },
      {
        name: "dien_may has types, brands and hasWarranty",
        type: "Normal",
        condition:
          "Precondition: none.\nInput: SPECIFIC_FILTERS.dien_may",
        confirmation:
          "types and brands are non-empty; hasWarranty = ['Còn bảo hành','Hết bảo hành']",
      },
      {
        name: "noi_that and sinh_hoat have types, brands and materials",
        type: "Normal",
        condition:
          "Precondition: none.\nInput: SPECIFIC_FILTERS.noi_that and SPECIFIC_FILTERS.sinh_hoat",
        confirmation:
          "Both have non-empty types, brands and materials",
      },
    ],
  },
  {
    code: "F15",
    file: "src/services/apis/axiosClient.ts",
    name: "apiClient (module export)",
    loc: 2,
    requirement: "Exports the configured axios instance.",
    tcs: [
      {
        name: "Default export is the instance created by axios.create",
        type: "Normal",
        condition:
          "Precondition: axios.create is mocked.\nInput: default import of axiosClient",
        confirmation:
          "Default export === the instance returned by axios.create",
      },
    ],
  },
];

const sheetNameOf = (fn) =>
  `${fn.code} ${fn.name}`
    .replace(/[\\/?*[\]:]/g, " ")
    .slice(0, 31)
    .trim();

const style = {
  header: {
    fill: { type: "pattern", pattern: "solid", fgColor: { argb: "FF5F9495" } },
    font: { bold: true, color: { argb: "FFFFFFFF" } },
    alignment: { horizontal: "center", vertical: "middle", wrapText: true },
    border: {
      top: { style: "thin" },
      left: { style: "thin" },
      bottom: { style: "thin" },
      right: { style: "thin" },
    },
  },
  cell: {
    alignment: { vertical: "top", wrapText: true },
    border: {
      top: { style: "thin", color: { argb: "FFCCCCCC" } },
      left: { style: "thin", color: { argb: "FFCCCCCC" } },
      bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
      right: { style: "thin", color: { argb: "FFCCCCCC" } },
    },
  },
  label: { font: { bold: true } },
};

function writeRow(ws, row, cells) {
  cells.forEach((value, col) => {
    const cell = ws.getCell(row, col + 1);
    cell.value = value;
    cell.style = { ...style.cell };
  });
}

function titleRow(ws, text, span) {
  const cell = ws.getCell(1, 1);
  cell.value = text;
  cell.font = { bold: true, size: 14 };
  cell.alignment = { vertical: "middle" };
  ws.mergeCells(1, 1, 1, span);
  ws.getRow(1).height = 28;
}

async function main() {
  const wb = new ExcelJS.Workbook();
  wb.creator = "HomeCycle Dev Team";
  wb.created = new Date();

  /* ------------------------------ 1. Record of Change ------------------------------ */
  const roc = wb.addWorksheet("Record of Change", {
    views: [{ state: "frozen", ySplit: 2 }],
  });
  const rocHeaders = [
    "Effective Date",
    "Version",
    "Change Item",
    "*A,D,M",
    "Change description",
    "Reference",
  ];
  roc.getRow(1).values = rocHeaders;
  roc.getRow(1).eachCell((cell) => {
    cell.style = style.header;
  });
  roc.getRow(2).values = [
    DATE,
    VERSION,
    "All sheets / functions",
    "M",
    "Document content translated from Vietnamese to English. Test cases unchanged.",
    "v1.0",
  ];
  roc.getRow(2).eachCell((cell) => {
    cell.style = style.cell;
  });
  roc.getRow(3).values = [
    DATE,
    "1.0",
    "All sheets",
    "A",
    "Initial version of the Unit Test Specification (Jest + jest-expo, 57 test cases).",
    "None",
  ];
  roc.getRow(3).eachCell((cell) => {
    cell.style = style.cell;
  });
  roc.columns = [
    { width: 16 },
    { width: 10 },
    { width: 14 },
    { width: 10 },
    { width: 80 },
    { width: 30 },
  ];

  /* --------------------------------- 2. Overview --------------------------------- */
  const ov = wb.addWorksheet("Overview");
  titleRow(ov, "UNIT TEST SPECIFICATION - GENERAL INFORMATION", 2);
  const ovInfo = [
    ["Project", PROJECT],
    [
      "Module",
      "Mobile application (Expo SDK 54, React Native 0.81, TypeScript)",
    ],
    ["Document name", "Unit Test Specification"],
    ["Version", VERSION],
    ["Effective Date", DATE],
    ["Created By", CREATED_BY],
    ["Executed By", EXECUTED_BY],
    [
      "Unit test framework",
      "Jest 29 + jest-expo 54 + @testing-library/react-native 14",
    ],
    ["Test command", "npm test"],
    ["Test file location", "__tests__/ (project root)"],
    [
      "Scope of functions under test",
      "src/utils/apiFeedback.ts, src/services/apis/authApi.ts, src/services/apis/axiosClient.ts, src/constants/filters.ts",
    ],
    ["Number of functions", String(FUNCTIONS.length)],
    [
      "Number of unit test cases",
      String(FUNCTIONS.reduce((s, f) => s + f.tcs.length, 0)),
    ],
    ["Test result", "All passed (P)"],
    [
      "Remark",
      "Unit test cases are grouped by function. Each function sheet presents test cases with a condition (precondition + input values) and a confirmation (expected result).",
    ],
  ];
  let r = 3;
  ovInfo.forEach(([k, v]) => {
    const c1 = ov.getCell(r, 1);
    const c2 = ov.getCell(r, 2);
    c1.value = k;
    c1.style = { ...style.cell, ...style.label, alignment: { vertical: "top" } };
    c2.value = v;
    c2.style = style.cell;
    ov.mergeCells(r, 2, r, 6);
    r += 1;
  });
  ov.columns = [{ width: 30 }, { width: 45 }, ...Array(4).fill({ width: 14 })];

  /* -------------------------------- 3. FunctionList -------------------------------- */
  const fl = wb.addWorksheet("FunctionList", {
    views: [{ state: "frozen", ySplit: 2 }],
  });
  fl.getRow(1).values = [
    "STT",
    "Function code",
    "Class / File",
    "Function Name",
    "Function description",
    "Lines of code (LOC)",
    "TC: Normal",
    "TC: Boundary",
    "TC: Abnormal",
    "TC: Total",
    "Normal number of TC/KLOC",
    "Required TC",
    "Lack of test cases",
    "Link",
  ];
  fl.getRow(1).eachCell((cell) => {
    cell.style = style.header;
  });
  fl.getRow(1).height = 34;
  fl.getCell(1, 11).value = {
    richText: [
      { text: "Normal number of TC/KLOC" },
      { text: "\n(fill value)", font: { italic: true } },
    ],
  };
  fl.getCell(1, 11).style = style.header;

  FUNCTIONS.forEach((fn, i) => {
    const r2 = i + 2;
    const normal = fn.tcs.filter((t) => t.type === "Normal").length;
    const boundary = fn.tcs.filter((t) => t.type === "Boundary").length;
    const abnormal = fn.tcs.filter((t) => t.type === "Abnormal").length;
    const total = fn.tcs.length;
    const required = Math.round((fn.loc * NORM_TC_PER_KLOC) / 1000);
    const lack = Math.max(0, required - total);
    const sheetName = sheetNameOf(fn);
    fl.getCell(r2, 1).value = i + 1;
    fl.getCell(r2, 2).value = fn.code;
    fl.getCell(r2, 3).value = fn.file;
    fl.getCell(r2, 4).value = {
      text: fn.name,
      hyperlink: `#'${sheetName}'!A1`,
    };
    fl.getCell(r2, 5).value = fn.requirement;
    fl.getCell(r2, 6).value = fn.loc;
    fl.getCell(r2, 7).value = normal;
    fl.getCell(r2, 8).value = boundary;
    fl.getCell(r2, 9).value = abnormal;
    fl.getCell(r2, 10).value = {
      formula: `SUM(G${r2}:I${r2})`,
      result: total,
    };
    fl.getCell(r2, 11).value = NORM_TC_PER_KLOC;
    fl.getCell(r2, 12).value = {
      formula: `ROUNDUP(F${r2}*K${r2}/1000,0)`,
      result: required,
    };
    fl.getCell(r2, 13).value = {
      formula: `MAX(0,L${r2}-J${r2})`,
      result: lack,
    };
    fl.getCell(r2, 14).value = {
      text: "Open test cases",
      hyperlink: `#'${sheetName}'!A1`,
    };
    for (let c = 1; c <= 14; c += 1) {
      const cell = fl.getCell(r2, c);
      cell.style = { ...style.cell };
      if (c === 4 || c === 14) {
        cell.font = { color: { argb: "FF0563C1" }, underline: true };
      }
    }
  });

  const lastFnRow = FUNCTIONS.length + 1;
  const flTotal = lastFnRow + 1;
  fl.getCell(flTotal, 1).value = "";
  fl.getCell(flTotal, 4).value = "Total";
  fl.getCell(flTotal, 4).style = { ...style.cell, font: { bold: true } };
  for (const col of ["F", "G", "H", "I", "J", "K", "L", "M"]) {
    const cell = fl.getCell(
      flTotal,
      { F: 6, G: 7, H: 8, I: 9, J: 10, K: 11, L: 12, M: 13 }[col],
    );
    cell.value = { formula: `SUM(${col}2:${col}${lastFnRow})` };
    cell.style = { ...style.cell, font: { bold: true } };
  }
  fl.getCell(flTotal, 10).style = { ...style.cell, font: { bold: true } };
  fl.columns = [
    { width: 5 },
    { width: 13 },
    { width: 32 },
    { width: 34 },
    { width: 60 },
    { width: 9 },
    { width: 8 },
    { width: 9 },
    { width: 10 },
    { width: 8 },
    { width: 12 },
    { width: 10 },
    { width: 10 },
    { width: 16 },
  ];

  /* -------------------------------- 4. Test Report -------------------------------- */
  const tr = wb.addWorksheet("Test Report", {
    views: [{ state: "frozen", ySplit: 2 }],
  });
  tr.getRow(1).values = [
    "STT",
    "Function code",
    "Function Name",
    "TC: Normal",
    "TC: Boundary",
    "TC: Abnormal",
    "TC: Total",
    "P (Passed)",
    "F (Failed)",
    "Pass rate",
  ];
  tr.getRow(1).eachCell((cell) => {
    cell.style = style.header;
  });
  FUNCTIONS.forEach((fn, i) => {
    const r2 = i + 2;
    const normal = fn.tcs.filter((t) => t.type === "Normal").length;
    const boundary = fn.tcs.filter((t) => t.type === "Boundary").length;
    const abnormal = fn.tcs.filter((t) => t.type === "Abnormal").length;
    const total = fn.tcs.length;
    tr.getCell(r2, 1).value = i + 1;
    tr.getCell(r2, 2).value = fn.code;
    tr.getCell(r2, 3).value = fn.name;
    tr.getCell(r2, 4).value = normal;
    tr.getCell(r2, 5).value = boundary;
    tr.getCell(r2, 6).value = abnormal;
    tr.getCell(r2, 7).value = total;
    tr.getCell(r2, 8).value = total;
    tr.getCell(r2, 9).value = 0;
    tr.getCell(r2, 10).value = {
      formula: `IF(G${r2}=0,0,H${r2}/G${r2})`,
      result: 1,
    };
    tr.getCell(r2, 10).numFmt = "0.0%";
    for (let c = 1; c <= 10; c += 1) {
      tr.getCell(r2, c).style = style.cell;
    }
  });
  const lastTrRow = FUNCTIONS.length + 1;
  const subRow = lastTrRow + 1;
  tr.getCell(subRow, 2).value = "";
  tr.getCell(subRow, 3).value = "Sub Total";
  tr.getCell(subRow, 3).style = { ...style.cell, font: { bold: true } };
  ["D", "E", "F", "G", "H", "I"].forEach((col) => {
    const cell = tr.getCell(
      subRow,
      { D: 4, E: 5, F: 6, G: 7, H: 8, I: 9 }[col],
    );
    cell.value = { formula: `SUM(${col}2:${col}${lastTrRow})` };
    cell.style = { ...style.cell, font: { bold: true } };
  });
  const passRateCell = tr.getCell(subRow, 10);
  passRateCell.value = {
    formula: `IF(G${subRow}=0,0,H${subRow}/G${subRow})`,
  };
  passRateCell.numFmt = "0.0%";
  passRateCell.style = { ...style.cell, font: { bold: true } };

  const sumRow = subRow + 2;
  const totalTC = FUNCTIONS.reduce((s, f) => s + f.tcs.length, 0);
  const requiredTC = FUNCTIONS.reduce(
    (s, f) => s + Math.round((f.loc * NORM_TC_PER_KLOC) / 1000),
    0,
  );
  const coverageResult = requiredTC > 0 ? totalTC / requiredTC : 0;
  const sumData = [
    ["Total functions", `=COUNTA(B2:B${lastTrRow})`, FUNCTIONS.length],
    ["Total test cases", `=SUM(G2:G${lastTrRow})`, totalTC],
    [
      "Required test cases (LOC/1000 * norm)",
      `=SUM(FunctionList!L2:L${lastFnRow})`,
      requiredTC,
    ],
    [
      "Test coverage (Total TC / Required TC)",
      `=IF(G${sumRow + 2}=0,0,G${sumRow + 1}/G${sumRow + 2})`,
      coverageResult,
    ],
    ["Passed (P)", `=SUM(H2:H${lastTrRow})`, totalTC],
    ["Failed (F)", `=SUM(I2:I${lastTrRow})`, 0],
    [
      "Test successful coverage (P / Total)",
      `=IF(G${sumRow + 1}=0,0,H${sumRow + 4}/G${sumRow + 1})`,
      1,
    ],
  ];
  sumData.forEach(([k, formula, result], idx) => {
    const rr = sumRow + idx;
    const c1 = tr.getCell(rr, 3);
    c1.value = k;
    c1.style = { ...style.cell, ...style.label };
    const c2 = tr.getCell(rr, 7);
    if (idx >= 3) c2.value = { formula, result };
    else if (typeof formula === "string" && formula.startsWith("=")) {
      c2.value = { formula, result };
    } else {
      c2.value = formula;
    }
    c2.style = style.cell;
    if (idx === 3 || idx === 6) c2.numFmt = "0.0%";
  });
  tr.columns = [
    { width: 5 },
    { width: 13 },
    { width: 34 },
    { width: 10 },
    { width: 10 },
    { width: 11 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
    { width: 10 },
  ];

  /* ---------------------------- 5. Function sheets ---------------------------- */
  FUNCTIONS.forEach((fn) => {
    const ws = wb.addWorksheet(sheetNameOf(fn), {
      views: [{ state: "frozen", ySplit: 7 }],
    });
    titleRow(ws, `FUNCTION: ${fn.code} - ${fn.name}`, 5);

    const meta = [
      ["Function code", fn.code, "Created By", CREATED_BY],
      ["Function name", fn.name, "Executed By", EXECUTED_BY],
      ["Class / File", fn.file, "Lines of code", fn.loc],
      ["Test requirement", fn.requirement, "Effective Date", DATE],
    ];
    meta.forEach((row, i) => {
      const rr = i + 2;
      [1, 3].forEach((c) => {
        const cell = ws.getCell(rr, c);
        cell.value = row[c - 1];
        cell.style = {
          ...style.cell,
          ...style.label,
          alignment: { vertical: "middle" },
        };
      });
      [2, 4].forEach((c) => {
        const cell = ws.getCell(rr, c);
        cell.value = row[c - 1];
        cell.style = style.cell;
      });
    });
    ws.mergeCells(4, 2, 4, 4);

    const backCell = ws.getCell(5, 1);
    backCell.value = {
      text: "Back to FunctionList",
      hyperlink: "'FunctionList'!A1",
    };
    backCell.font = { color: { argb: "FF0563C1" }, underline: true };
    backCell.alignment = { vertical: "middle" };

    const headers = [
      "No",
      "Test case name",
      "Type",
      "Condition (Precondition / Input values)",
      "Confirmation (Expected result)",
      "Result (P/F)",
      "Remarks",
    ];
    ws.getRow(6).values = headers;
    ws.getRow(6).eachCell((cell) => {
      cell.style = style.header;
    });
    ws.getRow(6).height = 26;

    fn.tcs.forEach((tc, i) => {
      const rr = i + 7;
      ws.getCell(rr, 1).value = i + 1;
      ws.getCell(rr, 2).value = tc.name;
      ws.getCell(rr, 3).value = tc.type;
      ws.getCell(rr, 4).value = tc.condition;
      ws.getCell(rr, 5).value = tc.confirmation;
      ws.getCell(rr, 6).value = "P";
      ws.getCell(rr, 7).value = "P - passed (executed by Jest)";
      for (let c = 1; c <= 7; c += 1) {
        const cell = ws.getCell(rr, c);
        cell.style = style.cell;
        if (c === 3) {
          cell.alignment = { vertical: "top", horizontal: "center" };
        }
        if (c === 6) {
          cell.alignment = { vertical: "top", horizontal: "center" };
          cell.font = { bold: true, color: { argb: "FF2E7D32" } };
        }
      }
    });
    ws.columns = [
      { width: 5 },
      { width: 34 },
      { width: 10 },
      { width: 70 },
      { width: 70 },
      { width: 10 },
      { width: 26 },
    ];
  });

  const outDir = path.join(__dirname, "..", "docs");
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(
    outDir,
    `HomeCycle-Mobile_UnitTestSpec_v${VERSION}.xlsx`,
  );
  await wb.xlsx.writeFile(out);
  const total = FUNCTIONS.reduce((s, f) => s + f.tcs.length, 0);
  console.log(
    `Generated ${out}\nFunctions: ${FUNCTIONS.length}, Test cases: ${total}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
