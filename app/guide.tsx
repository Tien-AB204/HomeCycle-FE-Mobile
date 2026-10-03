import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import OnboardingGuide from "../src/components/onboarding/OnboardingGuide";
import Header from "../src/components/shared/Header";
import { GUIDE_FAQ } from "../src/constants/onboardingGuide";
import { COLORS } from "../src/constants/theme";
import { useAuth } from "../src/contexts/AuthContext";

export default function GuideScreen() {
  const { user } = useAuth();
  const role = user?.role?.toLowerCase() === "business" ? "business" : "personal";
  const [isIntroOpen, setIsIntroOpen] = useState(false);
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Hướng dẫn sử dụng" showBack />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TouchableOpacity
          style={styles.introCard}
          activeOpacity={0.85}
          onPress={() => setIsIntroOpen(true)}
        >
          <View style={styles.introIcon}>
            <Ionicons name="play" size={20} color={COLORS.primary} />
          </View>
          <View style={styles.introText}>
            <Text style={styles.introTitle}>Xem lại giới thiệu</Text>
            <Text style={styles.introSubtitle}>
              {role === "business"
                ? "4 bước thu mua đồ cũ trên HomeCycle"
                : "4 bước mua bán đồ cũ trên HomeCycle"}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={COLORS.white} />
        </TouchableOpacity>

        <Text style={styles.sectionHeading}>Câu hỏi thường gặp</Text>

        {GUIDE_FAQ.map((section) => (
          <View key={section.key} style={styles.section}>
            <View style={styles.sectionHeader}>
              <Ionicons name={section.icon} size={18} color={COLORS.primary} />
              <Text style={styles.sectionTitle}>{section.title}</Text>
            </View>

            {section.items.map((item, itemIndex) => {
              const key = `${section.key}-${itemIndex}`;
              const isOpen = openKey === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.faqItem, itemIndex > 0 ? styles.faqItemDivider : undefined]}
                  activeOpacity={0.7}
                  onPress={() => setOpenKey(isOpen ? null : key)}
                  accessibilityRole="button"
                  accessibilityState={{ expanded: isOpen }}
                >
                  <View style={styles.faqQuestionRow}>
                    <Text style={styles.faqQuestion}>{item.question}</Text>
                    <Ionicons
                      name={isOpen ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={COLORS.textLight}
                    />
                  </View>
                  {isOpen ? <Text style={styles.faqAnswer}>{item.answer}</Text> : null}
                </TouchableOpacity>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <OnboardingGuide
        visible={isIntroOpen}
        role={role}
        onClose={() => setIsIntroOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#F8F9FA" },
  content: { padding: 16, paddingBottom: 40 },
  introCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 16,
    borderRadius: 16,
    backgroundColor: COLORS.primary,
  },
  introIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.white,
  },
  introText: { flex: 1 },
  introTitle: { color: COLORS.white, fontSize: 16, fontWeight: "800" },
  introSubtitle: { marginTop: 2, color: "rgba(255, 255, 255, 0.82)", fontSize: 13 },
  sectionHeading: {
    marginTop: 24,
    marginBottom: 10,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
  },
  section: {
    marginBottom: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
    overflow: "hidden",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "rgba(84, 123, 125, 0.08)",
  },
  sectionTitle: { color: COLORS.text, fontSize: 14, fontWeight: "800" },
  faqItem: { paddingHorizontal: 14, paddingVertical: 12 },
  faqItemDivider: { borderTopWidth: 1, borderTopColor: COLORS.border },
  faqQuestionRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  faqQuestion: { flex: 1, color: COLORS.text, fontSize: 14, fontWeight: "600", lineHeight: 20 },
  faqAnswer: { marginTop: 8, color: COLORS.textLight, fontSize: 13, lineHeight: 20 },
});
