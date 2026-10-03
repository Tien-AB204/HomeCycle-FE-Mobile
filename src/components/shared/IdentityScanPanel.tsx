import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
  | { kind: "review"; result: IdentityScanResult }
  | { kind: "done"; result: IdentityScanResult };

type ReviewDraft = {
  identityNumber: string;
  fullName: string;
  // dd/MM/yyyy để người dùng sửa trực tiếp.
  dateOfBirth: string;
  address: string;
};

const EMPTY_DRAFT: ReviewDraft = {
  identityNumber: "",
  fullName: "",
  dateOfBirth: "",
  address: "",
};

const toDisplayDate = (isoDate: string | null) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate ?? "");
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
};

// dd/MM/yyyy -> yyyy-MM-dd; trả null nếu không phải ngày hợp lệ trong quá khứ.
const toIsoDate = (displayDate: string): string | null => {
  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(displayDate.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getTime() > Date.now()
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

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
  const [draft, setDraft] = useState<ReviewDraft>(EMPTY_DRAFT);
  const [reviewError, setReviewError] = useState("");

  const hasBothImages = Boolean(front?.uri && back?.uri);
  const canScan = Boolean(target) && hasBothImages && !disabled && !isScanning;

  const runScan = async () => {
    if (!target || !front || !back) return;
    setIsConsentVisible(false);
    setIsScanning(true);
    setState({ kind: "idle" });
    try {
      const result = await scanIdentityDocument(target, front, back);
      // Chưa điền vào form: người dùng xem lại kết quả, sửa nếu sai rồi mới xác nhận.
      setDraft({
        identityNumber: result.identityNumber ?? "",
        fullName: (result.fullName ?? "").toLocaleUpperCase("vi-VN"),
        dateOfBirth: toDisplayDate(result.dateOfBirth),
        address: result.address ?? "",
      });
      setReviewError("");
      setState({ kind: "review", result });
    } catch (error) {
      setState({ kind: "error", text: getIdentityScanErrorMessage(error) });
    } finally {
      setIsScanning(false);
    }
  };

  const updateDraft = (field: keyof ReviewDraft, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setReviewError("");
  };

  const dismissReview = () => {
    setState({ kind: "idle" });
    setReviewError("");
  };

  const confirmReview = () => {
    if (state.kind !== "review") return;

    const identityNumber = draft.identityNumber.trim();
    if (identityNumber && !/^\d{12}$/.test(identityNumber)) {
      setReviewError("Số CCCD phải gồm đúng 12 chữ số.");
      return;
    }

    const dateText = draft.dateOfBirth.trim();
    const dateOfBirth = dateText ? toIsoDate(dateText) : null;
    if (dateText && !dateOfBirth) {
      setReviewError("Ngày sinh chưa hợp lệ. Nhập theo dạng ngày/tháng/năm, ví dụ 05/02/1990.");
      return;
    }

    const confirmed: IdentityScanResult = {
      ...state.result,
      identityNumber: identityNumber || null,
      fullName: draft.fullName.trim() || null,
      dateOfBirth,
      address: draft.address.trim() || null,
    };

    onResult(confirmed);
    setState({ kind: "done", result: confirmed });
  };

  const reviewUnreadable =
    state.kind === "review" ? new Set(state.result.unreadableFields) : new Set<string>();

  const renderReviewField = (
    field: keyof ReviewDraft,
    label: string,
    options: {
      placeholder: string;
      keyboardType?: "default" | "number-pad" | "numbers-and-punctuation";
      maxLength?: number;
      multiline?: boolean;
      autoCapitalize?: "characters" | "sentences";
    },
  ) => {
    const needsInput = reviewUnreadable.has(field) || !draft[field].trim();

    return (
      <View style={styles.reviewField}>
        <Text style={styles.reviewLabel}>{label}</Text>
        <TextInput
          style={[
            styles.reviewInput,
            options.multiline ? styles.reviewInputMultiline : undefined,
            needsInput ? styles.reviewInputWarning : undefined,
          ]}
          value={draft[field]}
          onChangeText={(value) =>
            updateDraft(
              field,
              field === "fullName" ? value.toLocaleUpperCase("vi-VN") : value,
            )
          }
          placeholder={options.placeholder}
          placeholderTextColor={COLORS.textLight}
          keyboardType={options.keyboardType ?? "default"}
          maxLength={options.maxLength}
          multiline={options.multiline}
          autoCapitalize={options.autoCapitalize ?? "sentences"}
          autoCorrect={false}
        />
        {needsInput ? (
          <Text style={styles.reviewFieldHint}>Chưa đọc rõ, vui lòng nhập theo CCCD.</Text>
        ) : null}
      </View>
    );
  };

  // Sau khi xác nhận, chỉ nhắc các trường người dùng vẫn để trống.
  const unreadableLabels =
    state.kind === "done"
      ? Object.keys(IDENTITY_SCAN_FIELD_LABELS)
          .filter((field) => !state.result[field as keyof ReviewDraft])
          .map((field) => IDENTITY_SCAN_FIELD_LABELS[field])
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
          <Text style={styles.noticeTitle}>Đã điền thông tin CCCD bạn vừa xác nhận</Text>
          <Text style={styles.noticeText}>
            Bạn vẫn có thể sửa từng trường bên dưới trước khi gửi.
          </Text>
          {unreadableLabels.length > 0 ? (
            <Text style={[styles.noticeText, styles.noticeWarning]}>
              Còn thiếu: {unreadableLabels.join(", ")}. Vui lòng tự nhập hoặc tải ảnh rõ hơn.
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
        visible={state.kind === "review"}
        transparent
        animationType="fade"
        onRequestClose={dismissReview}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <ModalBackdrop style={styles.backdrop} onPress={dismissReview}>
            <ModalSurface style={[styles.consentCard, styles.reviewCard]}>
              <Text style={styles.consentTitle}>Kiểm tra thông tin trên CCCD</Text>
              <Text style={styles.consentText}>
                Đối chiếu với CCCD của bạn. Thông tin đúng thì bấm Xác nhận, sai thì sửa trực tiếp
                rồi xác nhận.
              </Text>

              <ScrollView
                style={styles.reviewScroll}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {renderReviewField("identityNumber", "Số CCCD", {
                  placeholder: "12 chữ số",
                  keyboardType: "number-pad",
                  maxLength: 12,
                })}
                {renderReviewField("fullName", "Họ và tên", {
                  placeholder: "Họ tên như trên CCCD",
                  autoCapitalize: "characters",
                })}
                {renderReviewField("dateOfBirth", "Ngày sinh", {
                  placeholder: "ngày/tháng/năm, ví dụ 05/02/1990",
                  keyboardType: "numbers-and-punctuation",
                  maxLength: 10,
                })}
                {renderReviewField("address", "Địa chỉ thường trú", {
                  placeholder: "Địa chỉ như trên CCCD",
                  multiline: true,
                })}

                {state.kind === "review"
                  ? state.result.warnings.map((warning) => (
                      <Text key={warning} style={[styles.noticeText, styles.noticeWarning]}>
                        {warning}
                      </Text>
                    ))
                  : null}
              </ScrollView>

              {reviewError ? <Text style={styles.reviewError}>{reviewError}</Text> : null}

              <View style={styles.consentActions}>
                <TouchableOpacity style={styles.consentSecondary} onPress={dismissReview}>
                  <Text style={styles.consentSecondaryText}>Bỏ qua, tự nhập</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.consentPrimary} onPress={confirmReview}>
                  <Text style={styles.consentPrimaryText}>Xác nhận</Text>
                </TouchableOpacity>
              </View>
            </ModalSurface>
          </ModalBackdrop>
        </KeyboardAvoidingView>
      </Modal>

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
  flex: { flex: 1 },
  reviewCard: { maxHeight: "90%" },
  reviewScroll: { flexGrow: 0 },
  reviewField: { marginBottom: 12 },
  reviewLabel: { color: COLORS.text, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  reviewInput: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.text,
    fontSize: 14,
    backgroundColor: "#F8F9FA",
  },
  reviewInputMultiline: { minHeight: 64, textAlignVertical: "top" },
  reviewInputWarning: { borderColor: COLORS.warning },
  reviewFieldHint: { color: COLORS.warning, fontSize: 12, marginTop: 4 },
  reviewError: { color: COLORS.error, fontSize: 13, lineHeight: 18 },
});
