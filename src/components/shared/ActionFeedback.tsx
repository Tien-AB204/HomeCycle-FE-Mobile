import { Ionicons } from "@expo/vector-icons";
import {
  ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { COLORS } from "../../constants/theme";

export type FeedbackType = "success" | "error" | "info" | "warning";

export type ActionFeedbackState = {
  message: string;
  type: FeedbackType;
} | null;

type InlineFeedbackProps = {
  feedback: ActionFeedbackState;
  onDismiss?: () => void;
  style?: StyleProp<ViewStyle>;
};

const FEEDBACK_COLORS: Record<
  FeedbackType,
  {
    background: string;
    border: string;
    icon: keyof typeof Ionicons.glyphMap;
  }
> = {
  success: {
    background: "#ECFDF3",
    border: "#15803D",
    icon: "checkmark-circle-outline",
  },
  error: {
    background: "#FFF1F2",
    border: COLORS.error,
    icon: "alert-circle-outline",
  },
  warning: {
    background: "#FFFBEB",
    border: "#B45309",
    icon: "warning-outline",
  },
  info: {
    background: "#EFF6FF",
    border: COLORS.primary,
    icon: "information-circle-outline",
  },
};

export function InlineFeedback({
  feedback,
  onDismiss,
  style,
}: InlineFeedbackProps) {
  if (!feedback?.message) return null;

  const colors = FEEDBACK_COLORS[feedback.type];

  return (
    <View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      style={[
        styles.feedback,
        {
          backgroundColor: colors.background,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      <Ionicons name={colors.icon} size={20} color={colors.border} />

      <Text style={[styles.feedbackText, { color: colors.border }]}>
        {feedback.message}
      </Text>

      {onDismiss ? (
        <Pressable
          accessibilityLabel="Đóng thông báo"
          accessibilityRole="button"
          hitSlop={8}
          onPress={onDismiss}
          style={styles.dismissButton}
        >
          <Ionicons name="close" size={18} color={colors.border} />
        </Pressable>
      ) : null}
    </View>
  );
}

type ConfirmActionModalProps = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  isLoading?: boolean;
  children?: ReactNode;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmActionModal({
  visible,
  title,
  message,
  confirmLabel = "Xác nhận",
  cancelLabel = "Quay lại",
  destructive = false,
  isLoading = false,
  children,
  onConfirm,
  onCancel,
}: ConfirmActionModalProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onCancel}
      transparent
      visible={visible}
    >
      <View style={styles.overlay}>
        <Pressable
          accessibilityLabel="Đóng hộp xác nhận"
          onPress={isLoading ? undefined : onCancel}
          style={StyleSheet.absoluteFill}
        />

        <View accessibilityViewIsModal style={styles.modalCard}>
          <View style={styles.modalIcon}>
            <Ionicons
              name={
                destructive
                  ? "warning-outline"
                  : "help-circle-outline"
              }
              size={28}
              color={destructive ? COLORS.error : COLORS.primary}
            />
          </View>

          <Text style={styles.modalTitle}>{title}</Text>
          <Text style={styles.modalMessage}>{message}</Text>

          {children}

          <View style={styles.modalActions}>
            <Pressable
              accessibilityRole="button"
              disabled={isLoading}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.modalButton,
                styles.cancelButton,
                pressed ? styles.pressed : undefined,
              ]}
            >
              <Text style={styles.cancelButtonText}>
                {cancelLabel}
              </Text>
            </Pressable>

            <Pressable
              accessibilityRole="button"
              disabled={isLoading}
              onPress={onConfirm}
              style={({ pressed }) => [
                styles.modalButton,
                destructive
                  ? styles.destructiveButton
                  : styles.confirmButton,
                pressed ? styles.pressed : undefined,
                isLoading ? styles.disabled : undefined,
              ]}
            >
              <Text style={styles.confirmButtonText}>
                {isLoading ? "Đang xử lý..." : confirmLabel}
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function useActionFeedback() {
  const [feedback, setFeedback] =
    useState<ActionFeedbackState>(null);

  const showFeedback = useCallback(
    (message: string, type: FeedbackType) => {
      const normalizedMessage = message.trim();

      setFeedback(
        normalizedMessage
          ? {
              message: normalizedMessage,
              type,
            }
          : null,
      );
    },
    [],
  );

  const clearFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const showSuccess = useCallback(
    (message: string) => {
      showFeedback(message, "success");
    },
    [showFeedback],
  );

  const showError = useCallback(
    (message: string) => {
      showFeedback(message, "error");
    },
    [showFeedback],
  );

  const showInfo = useCallback(
    (message: string) => {
      showFeedback(message, "info");
    },
    [showFeedback],
  );

  const showWarning = useCallback(
    (message: string) => {
      showFeedback(message, "warning");
    },
    [showFeedback],
  );

  return {
    feedback,
    setFeedback,
    showFeedback,
    showSuccess,
    showError,
    showInfo,
    showWarning,
    clearFeedback,
  };
}

export type ConfirmationOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type FeedbackListener = (
  message: string,
  type: FeedbackType,
) => void;

type ConfirmationListener = (
  options: ConfirmationOptions,
) => Promise<boolean>;

let feedbackListener: FeedbackListener | null = null;
let confirmationListener: ConfirmationListener | null = null;

export const notifyUser = (
  message: string,
  type: FeedbackType = "info",
) => {
  feedbackListener?.(message, type);
};

export const confirmUserAction = (
  options: ConfirmationOptions,
) => {
  if (!confirmationListener) {
    return Promise.resolve(false);
  }

  return confirmationListener(options);
};

type PendingConfirmation = ConfirmationOptions & {
  resolve: (confirmed: boolean) => void;
};

export function useConfirmAction() {
  const [pending, setPending] =
    useState<PendingConfirmation | null>(null);

  const pendingRef =
    useRef<PendingConfirmation | null>(null);

  const confirm = useCallback(
    (options: ConfirmationOptions) => {
      pendingRef.current?.resolve(false);

      return new Promise<boolean>((resolve) => {
        const next = {
          ...options,
          resolve,
        };

        pendingRef.current = next;
        setPending(next);
      });
    },
    [],
  );

  const settle = useCallback((confirmed: boolean) => {
    const current = pendingRef.current;

    pendingRef.current = null;
    setPending(null);
    current?.resolve(confirmed);
  }, []);

  const confirmationModal = (
    <ConfirmActionModal
      cancelLabel={pending?.cancelLabel}
      confirmLabel={pending?.confirmLabel}
      destructive={pending?.destructive}
      message={pending?.message ?? ""}
      onCancel={() => settle(false)}
      onConfirm={() => settle(true)}
      title={pending?.title ?? "Xác nhận"}
      visible={Boolean(pending)}
    />
  );

  return {
    confirm,
    confirmationModal,
  };
}

export function AppFeedbackProvider({
  children,
}: {
  children: ReactNode;
}) {
  const {
    feedback,
    clearFeedback,
    showFeedback,
  } = useActionFeedback();

  const {
    confirm,
    confirmationModal,
  } = useConfirmAction();

  useEffect(() => {
    feedbackListener = showFeedback;
    confirmationListener = confirm;

    return () => {
      if (feedbackListener === showFeedback) {
        feedbackListener = null;
      }

      if (confirmationListener === confirm) {
        confirmationListener = null;
      }
    };
  }, [confirm, showFeedback]);

  return (
    <View style={styles.providerRoot}>
      {children}

      {feedback ? (
        <View
          pointerEvents="box-none"
          style={styles.globalFeedbackHost}
        >
          <InlineFeedback
            feedback={feedback}
            onDismiss={clearFeedback}
            style={styles.globalFeedback}
          />
        </View>
      ) : null}

      {confirmationModal}
    </View>
  );
}

const styles = StyleSheet.create({
  providerRoot: {
    flex: 1,
  },

  globalFeedbackHost: {
    alignItems: "center",
    bottom: 82,
    left: 0,
    paddingHorizontal: 16,
    position: "absolute",
    right: 0,
    zIndex: 1000,
  },

  globalFeedback: {
    maxWidth: 480,
  },

  feedback: {
    alignItems: "flex-start",
    borderLeftWidth: 4,
    borderRadius: 10,
    flexDirection: "row",
    gap: 9,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    width: "100%",
  },

  feedbackText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },

  dismissButton: {
    padding: 1,
  },

  overlay: {
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.55)",
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },

  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    maxWidth: 420,
    padding: 22,
    width: "100%",
  },

  modalIcon: {
    alignItems: "center",
    alignSelf: "center",
    backgroundColor: "#F1F5F9",
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    marginBottom: 14,
    width: 48,
  },

  modalTitle: {
    color: COLORS.text,
    fontSize: 19,
    fontWeight: "800",
    textAlign: "center",
  },

  modalMessage: {
    color: COLORS.textLight,
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
    textAlign: "center",
  },

  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 20,
  },

  modalButton: {
    alignItems: "center",
    borderRadius: 10,
    flex: 1,
    justifyContent: "center",
    minHeight: 46,
    paddingHorizontal: 12,
  },

  cancelButton: {
    backgroundColor: "#F1F5F9",
    borderColor: COLORS.border,
    borderWidth: 1,
  },

  confirmButton: {
    backgroundColor: COLORS.primary,
  },

  destructiveButton: {
    backgroundColor: COLORS.error,
  },

  cancelButtonText: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: "700",
  },

  confirmButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: "800",
  },

  pressed: {
    opacity: 0.78,
  },

  disabled: {
    opacity: 0.6,
  },
});