import { useEffect, useRef } from "react";

// Quy ước phản hồi toàn ứng dụng:
// - thành công/thông tin: tự ẩn sau ~5 giây
// - lỗi chung (không gắn với ô nhập): tự ẩn sau ~10 giây
// Lỗi kiểm tra theo từng ô nhập KHÔNG dùng hook này; chúng giữ đến khi được sửa.
export const FEEDBACK_SUCCESS_MS = 5000;
export const FEEDBACK_ERROR_MS = 10000;

type DismissableFeedback = { type: string } | null | undefined;

export function useAutoDismissFeedback(
  feedback: DismissableFeedback,
  clear: () => void,
): void {
  const clearRef = useRef(clear);
  clearRef.current = clear;

  useEffect(() => {
    if (!feedback) return;
    const delay =
      feedback.type === "error" ? FEEDBACK_ERROR_MS : FEEDBACK_SUCCESS_MS;
    const timer = setTimeout(() => clearRef.current(), delay);
    return () => clearTimeout(timer);
  }, [feedback]);
}
