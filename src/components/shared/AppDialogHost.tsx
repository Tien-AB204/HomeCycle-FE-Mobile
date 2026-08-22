import React, { ReactNode, useEffect, useState } from "react";
import {
  Alert,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { COLORS } from "../../constants/theme";

type DialogButton = {
  text?: string;
  onPress?: (value?: string) => void;
  style?: "default" | "cancel" | "destructive";
  isPreferred?: boolean;
};

type DialogState = {
  title: string;
  message: string;
  buttons: DialogButton[];
  cancelable: boolean;
} | null;

type Props = {
  children: ReactNode;
};

export default function AppDialogHost({ children }: Props) {
  const [dialog, setDialog] = useState<DialogState>(null);

  useEffect(() => {
    const originalAlert = (Alert as any).alert;

    (Alert as any).alert = (
      title?: string,
      message?: string,
      buttons?: DialogButton[],
      options?: { cancelable?: boolean },
    ) => {
      const normalizedButtons =
        Array.isArray(buttons) && buttons.length > 0
          ? buttons
          : [{ text: "OK", style: "default" as const }];

      setDialog({
        title: String(title || "Thông báo"),
        message: String(message || ""),
        buttons: normalizedButtons,
        cancelable: options?.cancelable !== false,
      });
    };

    return () => {
      (Alert as any).alert = originalAlert;
    };
  }, []);

  const closeDialog = () => {
    setDialog(null);
  };

  const runButton = (button: DialogButton) => {
    closeDialog();

    if (button.onPress) {
      setTimeout(() => {
        button.onPress?.();
      }, 0);
    }
  };

  const handleBackdropPress = () => {
    if (!dialog?.cancelable) return;

    const cancelButton = dialog.buttons.find(
      (button) => button.style === "cancel",
    );

    if (cancelButton) {
      runButton(cancelButton);
      return;
    }

    closeDialog();
  };

  return (
    <>
      {children}

      <Modal
        visible={Boolean(dialog)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={handleBackdropPress}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={styles.overlay}
          onPress={handleBackdropPress}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={styles.card}
            onPress={() => undefined}
          >
            <Text style={styles.title}>{dialog?.title}</Text>
            {dialog?.message ? (
              <Text style={styles.message}>{dialog.message}</Text>
            ) : null}

            <View style={styles.actions}>
              {dialog?.buttons.map((button, index) => {
                const destructive = button.style === "destructive";
                const cancel = button.style === "cancel";

                return (
                  <TouchableOpacity
                    key={`${button.text || "button"}-${index}`}
                    style={[
                      styles.button,
                      cancel ? styles.cancelButton : styles.primaryButton,
                      destructive ? styles.destructiveButton : undefined,
                    ]}
                    onPress={() => runButton(button)}
                    activeOpacity={0.85}
                  >
                    <Text
                      style={[
                        styles.buttonText,
                        cancel ? styles.cancelButtonText : styles.primaryButtonText,
                      ]}
                    >
                      {button.text || "OK"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    backgroundColor: "rgba(15, 23, 42, 0.48)",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 16,
    padding: 20,
    backgroundColor: COLORS.white,
  },
  title: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: "800",
    textAlign: "center",
  },
  message: {
    marginTop: 10,
    color: COLORS.textLight,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
  },
  actions: {
    marginTop: 20,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    flexWrap: "wrap",
  },
  button: {
    minWidth: 96,
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
  },
  destructiveButton: {
    backgroundColor: COLORS.error,
  },
  cancelButton: {
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: "700",
  },
  primaryButtonText: {
    color: COLORS.white,
  },
  cancelButtonText: {
    color: COLORS.text,
  },
});
