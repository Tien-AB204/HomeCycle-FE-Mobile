import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import {
  Image,
  ImageResizeMode,
  ImageStyle,
  Modal,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS } from "../../constants/theme";

const BLUR_RADIUS = 18;

type SensitiveDocumentImageProps = {
  uri: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  resizeMode?: ImageResizeMode;
  // false: chạm vào ảnh để phần tử cha xử lý (vd. chọn ảnh mới); chỉ nút mắt mở ảnh rõ.
  tapToView?: boolean;
  label?: string;
};

// Ảnh giấy tờ tùy thân (CCCD) được làm mờ; chỉ hiện rõ khi người dùng chủ động mở xem.
export default function SensitiveDocumentImage({
  uri,
  style,
  imageStyle,
  resizeMode = "cover",
  tapToView = true,
  label = "Nhấn để xem",
}: SensitiveDocumentImageProps) {
  const insets = useSafeAreaInsets();
  const [isViewerOpen, setIsViewerOpen] = useState(false);

  const openViewer = () => setIsViewerOpen(true);

  const content = (
    <>
      <Image
        source={{ uri }}
        style={[StyleSheet.absoluteFill, imageStyle]}
        resizeMode={resizeMode}
        blurRadius={BLUR_RADIUS}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <TouchableOpacity
          style={styles.viewButton}
          onPress={(event) => {
            event.stopPropagation();
            openViewer();
          }}
          accessibilityRole="button"
          accessibilityLabel="Xem rõ ảnh giấy tờ"
          hitSlop={8}
        >
          <Ionicons name="eye-outline" size={16} color={COLORS.white} />
          <Text style={styles.viewButtonText}>{label}</Text>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <>
      {tapToView ? (
        <Pressable
          style={[styles.container, style]}
          onPress={openViewer}
          accessibilityRole="imagebutton"
          accessibilityLabel="Ảnh giấy tờ đã được làm mờ. Nhấn để xem rõ."
        >
          {content}
        </Pressable>
      ) : (
        <View style={[styles.container, style]} pointerEvents="box-none">
          {content}
        </View>
      )}

      <Modal
        visible={isViewerOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => setIsViewerOpen(false)}
      >
        <View style={styles.viewerBackdrop}>
          <Image
            source={{ uri }}
            style={styles.viewerImage}
            resizeMode="contain"
          />
          <TouchableOpacity
            style={[styles.closeButton, { top: insets.top + 12 }]}
            onPress={() => setIsViewerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Đóng"
            hitSlop={10}
          >
            <Ionicons name="close" size={26} color={COLORS.white} />
          </TouchableOpacity>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
    backgroundColor: "#F8F9FA",
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  viewButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(23, 40, 48, 0.62)",
  },
  viewButtonText: {
    color: COLORS.white,
    fontSize: 12,
    fontWeight: "700",
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImage: {
    width: "100%",
    height: "80%",
  },
  closeButton: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255, 255, 255, 0.16)",
  },
});
