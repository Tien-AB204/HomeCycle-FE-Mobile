import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { COLORS } from "../../constants/theme";
import {
  getIdentityScanErrorMessage,
  IDENTITY_SCAN_FIELD_LABELS,
  IdentityScanImage,
  IdentityScanResult,
  IdentityScanTarget,
  scanIdentityDocument,
} from "../../services/apis/identityScanApi";
import { ModalBackdrop, ModalSurface } from "./ModalBackdrop";

type IdentityScanPanelProps = {
  target: IdentityScanTarget | null;
  front: IdentityScanImage | null;
  back: IdentityScanImage | null;
  disabled?: boolean;
  // Màn hình tự điền các trường còn đọc được; người dùng vẫn sửa được trước khi gửi.
  onResult: (result: IdentityScanResult) => void;
};

type PanelState =
  | { kind: "idle" }
  | { kind: "error"; text: string }
  | { kind: "done"; result: IdentityScanResult };

// Nút "Quét thông tin" cho ảnh CCCD vừa chọn: hỏi đồng ý gửi ảnh cho dịch vụ AI, gọi API quét,
// rồi nhắc người dùng đối chiếu lại với CCCD.
export default function IdentityScanPanel({
  target,
  front,
  back,
  disabled = false,
  onResult,
}: IdentityScanPanelProps) {
  const [isConsentVisible, setIsConsentVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [state, setState] = useState<PanelState>({ kind: "idle" });

  const hasBothImages = Boolean(front?.uri && back?.uri);
  const canScan = Boolean(target) && hasBothImages && !disabled && !isScanning;

  const runScan = async () => {
    if (!target || !front || !back) return;
    setIsConsentVisible(false);
    setIsScanning(true);
    setState({ kind: "idle" });
    try {
      const result = await scanIdentityDocument(target, front, back);
      onResult(result);
      setState({ kind: "done", result });
    } catch (error) {
      setState({ kind: "error", text: getIdentityScanErrorMessage(error) });
    } finally {
      setIsScanning(false);
    }
  };

  const unreadableLabels =
    state.kind === "done"
      ? state.result.unreadableFields.map(
          (field) => IDENTITY_SCAN_FIELD_LABELS[field] || field,
        )
      : [];

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.scanButton, !canScan ? styles.scanButtonDisabled : undefined]}
        onPress={() => setIsConsentVisible(true)}
        disabled={!canScan}
        accessibilityRole="button"
      >
        {isScanning ? (
          <>
            <ActivityIndicator size="small" color={COLORS.primary} />
            <Text style={styles.scanButtonText}>Đang đọc ảnh CCCD...</Text>
          </>
        ) : (
          <>
            <Ionicons name="scan-outline" size={18} color={COLORS.primary} />
            <Text style={styles.scanButtonText}>Quét thông tin từ ảnh CCCD</Text>
          </>
        )}
      </TouchableOpacity>

      {!hasBothImages ? (
        <Text style={styles.hint}>
          Chọn đủ ảnh mặt trước và mặt sau để quét tự động, hoặc tự nhập thông tin.
        </Text>
      ) : null}

      {state.kind === "error" ? (
        <Text style={[styles.notice, styles.noticeError]}>{state.text}</Text>
      ) : null}

      {state.kind === "done" ? (
        <View style={[styles.notice, styles.noticeInfo]}>
          <Text style={styles.noticeTitle}>
            Thông tin nhận dạng tự động — vui lòng đối chiếu với CCCD
          </Text>
          <Text style={styles.noticeText}>
            Các trường đọc được đã được điền sẵn. Bạn có thể sửa từng trường trước khi gửi.
          </Text>
          {unreadableLabels.length > 0 ? (
            <Text style={[styles.noticeText, styles.noticeWarning]}>
              Chưa đọc rõ: {unreadableLabels.join(", ")}. Vui lòng tự nhập hoặc tải ảnh rõ hơn.
            </Text>
          ) : null}
          {state.result.warnings.map((warning) => (
            <Text key={warning} style={[styles.noticeText, styles.noticeWarning]}>
              {warning}
            </Text>
          ))}
        </View>
      ) : null}

      <Modal
        visible={isConsentVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsConsentVisible(false)}
      >
        <ModalBackdrop style={styles.backdrop} onPress={() => setIsConsentVisible(false)}>
          <ModalSurface style={styles.consentCard}>
            <Text style={styles.consentTitle}>Đồng ý quét CCCD tự động?</Text>
            <Text style={styles.consentText}>
              Để điền nhanh số CCCD, họ tên, ngày sinh và địa chỉ, HomeCycle sẽ gửi hai ảnh CCCD
              của bạn tới dịch vụ AI bên ngoài (Google Gemini) để đọc chữ trên ảnh.
            </Text>
            <Text style={styles.consentText}>
              Kết quả chỉ là gợi ý, không dùng để xác minh danh tính. Bạn vẫn phải tự kiểm tra và
              chịu trách nhiệm với thông tin gửi đi. Nếu không đồng ý, bạn có thể tự nhập.
            </Text>
            <View style={styles.consentActions}>
              <TouchableOpacity
                style={styles.consentSecondary}
                onPress={() => setIsConsentVisible(false)}
              >
                <Text style={styles.consentSecondaryText}>Tự nhập</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.consentPrimary}
                onPress={() => void runScan()}
              >
                <Text style={styles.consentPrimaryText}>Đồng ý và quét</Text>
              </TouchableOpacity>
            </View>
          </ModalSurface>
        </ModalBackdrop>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginBottom: 16, gap: 8 },
  scanButton: {
    minHeight: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 10,
    backgroundColor: "rgba(43, 86, 89, 0.06)",
  },
  scanButtonDisabled: { opacity: 0.5 },
  scanButtonText: { color: COLORS.primary, fontSize: 14, fontWeight: "700" },
  hint: { color: COLORS.textLight, fontSize: 12, lineHeight: 17 },
  notice: {
    borderRadius: 10,
    padding: 10,
    gap: 4,
  },
  noticeError: {
    color: COLORS.error,
    backgroundColor: "rgba(122, 16, 18, 0.06)",
    fontSize: 13,
    lineHeight: 18,
  },
  noticeInfo: { backgroundColor: "#FBF3E6" },
  noticeTitle: { color: COLORS.warning, fontSize: 13, fontWeight: "800" },
  noticeText: { color: COLORS.text, fontSize: 12.5, lineHeight: 18 },
  noticeWarning: { color: COLORS.warning, fontWeight: "600" },
  backdrop: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "rgba(23, 40, 48, 0.5)",
  },
  consentCard: {
    borderRadius: 16,
    padding: 20,
    gap: 10,
    backgroundColor: COLORS.white,
  },
  consentTitle: { color: COLORS.text, fontSize: 17, fontWeight: "800" },
  consentText: { color: COLORS.text, fontSize: 13.5, lineHeight: 20 },
  consentActions: { flexDirection: "row", gap: 10, marginTop: 6 },
  consentSecondary: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 10,
  },
  consentSecondaryText: { color: COLORS.primary, fontWeight: "700" },
  consentPrimary: {
    flex: 1,
    minHeight: 46,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    backgroundColor: COLORS.primary,
  },
  consentPrimaryText: { color: COLORS.white, fontWeight: "700" },
});
