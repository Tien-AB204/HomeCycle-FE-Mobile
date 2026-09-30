import { Platform } from "react-native";

import apiClient from "../services/apis/axiosClient";

const PDF_ERROR_MESSAGES: Record<number, string> = {
  403: "Bạn không có quyền tải hợp đồng này.",
  404: "Không tìm thấy hợp đồng.",
  409: "Hợp đồng chưa được thanh toán nên chưa có bản PDF.",
  503: "Hệ thống chưa lấy được bản PDF của hợp đồng. Vui lòng thử lại sau.",
};

const PDF_UNSUPPORTED_MESSAGE =
  "Phiên bản ứng dụng này chưa hỗ trợ tải PDF. Vui lòng cập nhật ứng dụng.";

export const getAgreementPdfErrorMessage = (error: unknown): string => {
  if ((error as Error)?.message === PDF_UNSUPPORTED_MESSAGE) return PDF_UNSUPPORTED_MESSAGE;
  const status = Number((error as any)?.response?.status || 0);
  return (
    PDF_ERROR_MESSAGES[status] ||
    "Không thể tải hợp đồng PDF. Vui lòng kiểm tra kết nối và thử lại."
  );
};

// Tải PDF hợp đồng đã thanh toán qua API có xác thực (BE không trả đường dẫn lưu trữ trực tiếp),
// rồi mở bảng chia sẻ để người dùng lưu hoặc xem file.
export const downloadAgreementPdf = async (agreementId: string) => {
  const response = await apiClient.get(`/agreements/${agreementId}/pdf`, {
    responseType: "arraybuffer",
  });
  const fileName = `HopDong-HomeCycle-${agreementId.slice(0, 8)}.pdf`;
  const bytes = new Uint8Array(response.data as ArrayBuffer);

  if (Platform.OS === "web") {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
    return;
  }

  // Nạp module native khi cần: bản app build trước khi thêm expo-sharing vẫn mở được màn hình,
  // chỉ báo lỗi khi bấm tải.
  let FileSystem: typeof import("expo-file-system");
  let Sharing: typeof import("expo-sharing");
  try {
    FileSystem = await import("expo-file-system");
    Sharing = await import("expo-sharing");
  } catch {
    throw new Error(PDF_UNSUPPORTED_MESSAGE);
  }

  const file = new FileSystem.File(FileSystem.Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(bytes);

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Hợp đồng HomeCycle",
      UTI: "com.adobe.pdf",
    });
  }
};
