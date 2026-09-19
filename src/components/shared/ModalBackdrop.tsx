import type { PropsWithChildren } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type PressableProps,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ModalBackdropProps = PropsWithChildren<
  Omit<PressableProps, "children" | "onPress"> & {
    onPress: () => void;
  }
>;

type ModalSurfaceProps = PropsWithChildren<
  Omit<PressableProps, "children" | "onPress"> & {
    onPress?: (event: GestureResponderEvent) => void;
  }
>;

/**
 * Global transparent-modal rule:
 * - tapping the backdrop dismisses the modal;
 * - tapping anywhere inside ModalSurface never bubbles to the backdrop.
 *
 * Full-screen, non-transparent modals do not use this pair.
 *
 * Android: a <Modal> is a separate native window, so the root layout's
 * bottom safe-area padding does not reach it. Bottom-anchored backdrops
 * (justifyContent: "flex-end") therefore pad the system navigation bar
 * themselves so sheets, footers and their scrollable content stay above it.
 */
export function ModalBackdrop({
  children,
  onPress,
  style,
  ...props
}: ModalBackdropProps) {
  const insets = useSafeAreaInsets();
  const flattened =
    typeof style === "function" ? null : StyleSheet.flatten(style);
  const isBottomAnchored = flattened?.justifyContent === "flex-end";
  const bottomInset =
    Platform.OS === "android" && isBottomAnchored ? insets.bottom : 0;

  const resolvedStyle =
    typeof style === "function"
      ? style
      : bottomInset > 0
        ? [
            style,
            {
              paddingBottom:
                Number(flattened?.paddingBottom ?? flattened?.padding ?? 0) +
                bottomInset,
            },
          ]
        : style;

  return (
    <Pressable {...props} style={resolvedStyle} onPress={onPress}>
      {children}
    </Pressable>
  );
}

export function ModalSurface({
  children,
  onPress,
  ...props
}: ModalSurfaceProps) {
  const stopBackdropPress = (event: GestureResponderEvent) => {
    event.stopPropagation();
    onPress?.(event);
  };

  return (
    <Pressable {...props} onPress={stopBackdropPress}>
      {children}
    </Pressable>
  );
}
