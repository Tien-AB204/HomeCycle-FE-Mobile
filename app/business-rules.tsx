import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { SafeAreaView, StyleSheet, Text, View } from "react-native";
import Header from "../src/components/shared/Header";
import { COLORS } from "../src/constants/theme";

export default function BusinessRulesScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Quy định & Chính sách" showBack={true} />

      <View style={styles.container}>
        <View style={styles.iconCircle}>
          <Ionicons name="construct-outline" size={64} color={COLORS.primary} />
        </View>
        <Text style={styles.title}>Tính năng đang phát triển</Text>
        <Text style={styles.desc}>
          Nội dung về quy định, điều khoản và chính sách dành cho người dùng
          đang được đội ngũ cập nhật. Vui lòng quay lại sau nhé!
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 12,
  },
  desc: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: "center",
    lineHeight: 22,
  },
});
