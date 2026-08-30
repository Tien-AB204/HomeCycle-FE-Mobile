import type { PropsWithChildren } from "react";
import {
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
} from "react-native";

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
 */
export function ModalBackdrop({
  children,
  onPress,
  ...props
}: ModalBackdropProps) {
  return (
    <Pressable {...props} onPress={onPress}>
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
