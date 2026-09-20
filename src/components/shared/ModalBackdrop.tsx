import { useEffect, useRef, useState, type PropsWithChildren } from "react";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  type GestureResponderEvent,
  type LayoutChangeEvent,
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
 *
 * Android keyboard: the modal window is edge-to-edge and is not resized by
 * the soft keyboard, so the keyboard would cover inputs and footers. While
 * the keyboard is visible the backdrop reserves its height (keyboard height
 * + navigation bar) as bottom padding, so surfaces sized with percentage
 * maxHeight shrink and their scrollable bodies stay reachable. If the modal
 * window *is* resized by the system (the backdrop's own height shrinks), no
 * padding is added — never both. KeyboardAvoidingView is not needed inside
 * modals on Android; keep it for iOS only.
 */
const RESIZE_DETECTION_THRESHOLD = 40;

function useAndroidModalKeyboardInset(): number {
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    if (Platform.OS !== "android") return;
    const initial = Keyboard.isVisible() ? Keyboard.metrics()?.height ?? 0 : 0;
    if (initial > 0) setKeyboardHeight(initial);
    const show = Keyboard.addListener("keyboardDidShow", (event) =>
      setKeyboardHeight(Math.max(0, Math.round(event.endCoordinates.height))),
    );
    const hide = Keyboard.addListener("keyboardDidHide", () =>
      setKeyboardHeight(0),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  return keyboardHeight;
}

export function ModalBackdrop({
  children,
  onPress,
  style,
  onLayout,
  ...props
}: ModalBackdropProps) {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useAndroidModalKeyboardInset();
  // Chiều cao nền khi bàn phím đóng; nếu nền tự co lại khi bàn phím mở thì hệ
  // thống đã resize cửa sổ modal và không cần chừa thêm chỗ cho bàn phím.
  const baseHeightRef = useRef(0);
  const [windowResizedByKeyboard, setWindowResizedByKeyboard] = useState(false);

  const flattened =
    typeof style === "function" ? null : StyleSheet.flatten(style);
  const isBottomAnchored = flattened?.justifyContent === "flex-end";
  const navigationInset =
    Platform.OS === "android" && isBottomAnchored ? insets.bottom : 0;
  const keyboardInset =
    Platform.OS === "android" && keyboardHeight > 0 && !windowResizedByKeyboard
      ? keyboardHeight + insets.bottom
      : 0;
  const bottomInset = Math.max(navigationInset, keyboardInset);

  const handleLayout = (event: LayoutChangeEvent) => {
    onLayout?.(event);
    if (Platform.OS !== "android") return;
    const height = event.nativeEvent.layout.height;
    if (keyboardHeight === 0) {
      baseHeightRef.current = height;
      if (windowResizedByKeyboard) setWindowResizedByKeyboard(false);
      return;
    }
    const shrunk =
      baseHeightRef.current > 0 &&
      height < baseHeightRef.current - RESIZE_DETECTION_THRESHOLD;
    if (shrunk !== windowResizedByKeyboard) setWindowResizedByKeyboard(shrunk);
  };

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
    <Pressable
      {...props}
      style={resolvedStyle}
      onPress={onPress}
      onLayout={handleLayout}
    >
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
