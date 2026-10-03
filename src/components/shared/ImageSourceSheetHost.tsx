import { Ionicons } from "@expo/vector-icons";
import { ReactNode, useEffect, useRef, useState } from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { COLORS } from "../../constants/theme";
import { ModalBackdrop, ModalSurface } from "./ModalBackdrop";

export type ImageSource = "camera" | "library";

export type ImageSourcePrompt = {
  title?: string;
  hint?: string | null;
};

type SheetRequest = {
  title: string;
  hint: string | null;
  resolve: (source: ImageSource | null) => void;
};

const DEFAULT_TITLE = "Thêm ảnh";
const DEFAULT_HINT = "Đặt giấy tờ trên nền phẳng, đủ sáng, không lóa và thấy rõ 4 góc.";

let presentSheet: ((request: SheetRequest) => void) | null = null;

// Mở sheet chọn nguồn ảnh. Trả về null khi người dùng hủy.
// Khi chưa gắn host (không nên xảy ra) thì dùng thư viện ảnh như hành vi cũ.
export const requestImageSource = (prompt: ImageSourcePrompt = {}) =>
  new Promise<ImageSource | null>((resolve) => {
    if (!presentSheet) {
      resolve("library");
      return;
    }

    presentSheet({
      title: prompt.title || DEFAULT_TITLE,
      hint: prompt.hint === undefined ? DEFAULT_HINT : prompt.hint,
      resolve,
    });
  });

const OPTIONS: {
  source: ImageSource;
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  description: string;
}[] = [
  {
    source: "camera",
    icon: "camera-outline",
    title: "Chụp ảnh",
    description: "Dùng camera chụp trực tiếp",
  },
  {
    source: "library",
    icon: "images-outline",
    title: "Chọn từ thư viện",
    description: "Chọn ảnh có sẵn trong máy",
  },
];

export default function ImageSourceSheetHost({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<SheetRequest | null>(null);
  const requestRef = useRef<SheetRequest | null>(null);

  useEffect(() => {
    presentSheet = (next) => {
      // Yêu cầu cũ chưa trả lời thì coi như hủy.
      requestRef.current?.resolve(null);
      requestRef.current = next;
      setRequest(next);
    };

    return () => {
      presentSheet = null;
      requestRef.current?.resolve(null);
      requestRef.current = null;
    };
  }, []);

  const finish = (source: ImageSource | null) => {
    const current = requestRef.current;
    requestRef.current = null;
    setRequest(null);
    // Đợi sheet đóng rồi mới mở camera / thư viện, tránh hai modal chồng nhau trên iOS.
    if (current) setTimeout(() => current.resolve(source), 250);
  };

  return (
    <>
      {children}

      <Modal
        visible={Boolean(request)}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => finish(null)}
      >
        <ModalBackdrop style={styles.backdrop} onPress={() => finish(null)}>
          <ModalSurface style={styles.sheet}>
            <View style={styles.handle} />

            <Text style={styles.title}>{request?.title}</Text>

            <View style={styles.options}>
              {OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.source}
                  style={styles.option}
                  onPress={() => finish(option.source)}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={option.title}
                >
                  <View style={styles.optionIcon}>
                    <Ionicons name={option.icon} size={22} color={COLORS.primary} />
                  </View>
                  <View style={styles.optionText}>
                    <Text style={styles.optionTitle}>{option.title}</Text>
                    <Text style={styles.optionDescription}>{option.description}</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={COLORS.textLight} />
                </TouchableOpacity>
              ))}
            </View>

            {request?.hint ? (
              <View style={styles.hint}>
                <Ionicons name="bulb-outline" size={16} color={COLORS.warning} />
                <Text style={styles.hintText}>{request.hint}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={() => finish(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.cancelText}>Hủy</Text>
            </TouchableOpacity>
          </ModalSurface>
        </ModalBackdrop>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(23, 40, 48, 0.48)",
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: 16,
  },
  title: {
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 14,
  },
  options: { gap: 10 },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(84, 123, 125, 0.12)",
  },
  optionText: { flex: 1, gap: 2 },
  optionTitle: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
  optionDescription: { color: COLORS.textLight, fontSize: 12.5 },
  hint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 14,
    padding: 10,
    borderRadius: 10,
    backgroundColor: "#FBF3E6",
  },
  hintText: { flex: 1, color: COLORS.text, fontSize: 12.5, lineHeight: 18 },
  cancelButton: {
    marginTop: 14,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  cancelText: { color: COLORS.text, fontSize: 15, fontWeight: "700" },
});
