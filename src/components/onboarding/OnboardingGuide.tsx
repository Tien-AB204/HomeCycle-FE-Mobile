import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";

import { GUIDE_SLIDES, GuideRole } from "../../constants/onboardingGuide";
import { COLORS } from "../../constants/theme";

type OnboardingGuideProps = {
  visible: boolean;
  role: GuideRole;
  onClose: () => void;
};

// Giới thiệu dạng trượt: mỗi trang một bước chính của luồng giao dịch theo vai trò.
export default function OnboardingGuide({ visible, role, onClose }: OnboardingGuideProps) {
  const { width } = useWindowDimensions();
  const pageWidth = Math.min(width, 480);
  const scrollRef = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const slides = GUIDE_SLIDES[role];
  const isLast = index === slides.length - 1;

  // Mỗi lần mở lại luôn bắt đầu từ trang đầu.
  useEffect(() => {
    if (!visible) return;
    setIndex(0);
    requestAnimationFrame(() => scrollRef.current?.scrollTo({ x: 0, animated: false }));
  }, [visible]);

  const goTo = (next: number) => {
    setIndex(next);
    scrollRef.current?.scrollTo({ x: next * pageWidth, animated: true });
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (next !== index) setIndex(Math.max(0, Math.min(next, slides.length - 1)));
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, { width: pageWidth }]}>
          <View style={styles.topBar}>
            <Text style={styles.brand}>
              {role === "business" ? "HomeCycle cho Doanh nghiệp" : "Chào mừng đến HomeCycle"}
            </Text>
            {!isLast ? (
              <TouchableOpacity onPress={onClose} hitSlop={10} accessibilityRole="button">
                <Text style={styles.skipText}>Bỏ qua</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView
            ref={scrollRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
            style={styles.pager}
          >
            {slides.map((slide, slideIndex) => (
              <View key={slide.key} style={[styles.page, { width: pageWidth }]}>
                <View style={styles.illustration}>
                  <View style={styles.illustrationRing} />
                  <View style={styles.illustrationCircle}>
                    <Ionicons name={slide.icon} size={56} color={COLORS.white} />
                  </View>
                </View>

                <Text style={styles.stepLabel}>
                  Bước {slideIndex + 1}/{slides.length}
                </Text>
                <Text style={styles.title}>{slide.title}</Text>
                <Text style={styles.description}>{slide.description}</Text>

                <View style={styles.points}>
                  {slide.points.map((point) => (
                    <View key={point} style={styles.pointRow}>
                      <Ionicons name="checkmark-circle" size={18} color={COLORS.primary} />
                      <Text style={styles.pointText}>{point}</Text>
                    </View>
                  ))}
                </View>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.dots}>
              {slides.map((slide, dotIndex) => (
                <TouchableOpacity
                  key={slide.key}
                  onPress={() => goTo(dotIndex)}
                  hitSlop={6}
                  accessibilityLabel={`Trang ${dotIndex + 1}`}
                >
                  <View style={[styles.dot, dotIndex === index ? styles.dotActive : undefined]} />
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.actions}>
              {index > 0 ? (
                <TouchableOpacity
                  style={styles.backButton}
                  onPress={() => goTo(index - 1)}
                  accessibilityLabel="Trang trước"
                >
                  <Ionicons name="arrow-back" size={20} color={COLORS.primary} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                style={styles.nextButton}
                activeOpacity={0.85}
                onPress={() => (isLast ? onClose() : goTo(index + 1))}
              >
                <Text style={styles.nextText}>{isLast ? "Bắt đầu sử dụng" : "Tiếp tục"}</Text>
                <Ionicons
                  name={isLast ? "checkmark" : "arrow-forward"}
                  size={18}
                  color={COLORS.white}
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white, alignItems: "center" },
  container: { flex: 1 },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 48,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  brand: { flex: 1, color: COLORS.primary, fontSize: 14, fontWeight: "800" },
  skipText: { color: COLORS.textLight, fontSize: 14, fontWeight: "700" },
  pager: { flex: 1 },
  page: { flex: 1, paddingHorizontal: 28, justifyContent: "center" },
  illustration: {
    alignSelf: "center",
    width: 200,
    height: 200,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
  },
  illustrationRing: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(84, 123, 125, 0.10)",
  },
  illustrationCircle: {
    width: 128,
    height: 128,
    borderRadius: 64,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.primary,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  stepLabel: {
    color: COLORS.primary,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  title: { marginTop: 6, color: COLORS.text, fontSize: 24, fontWeight: "800", lineHeight: 31 },
  description: { marginTop: 10, color: COLORS.textLight, fontSize: 15, lineHeight: 22 },
  points: { marginTop: 20, gap: 10 },
  pointRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  pointText: { flex: 1, color: COLORS.text, fontSize: 14, lineHeight: 20 },
  footer: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20, gap: 18 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.border },
  dotActive: { width: 24, backgroundColor: COLORS.primary },
  actions: { flexDirection: "row", gap: 12 },
  backButton: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  nextButton: {
    flex: 1,
    height: 52,
    borderRadius: 26,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primary,
  },
  nextText: { color: COLORS.white, fontSize: 16, fontWeight: "800" },
});
