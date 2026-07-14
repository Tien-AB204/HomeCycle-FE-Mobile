// src/components/Header.tsx
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../constants/theme';
import { useRouter } from 'expo-router';

interface HeaderProps {
  title?: string;
  centerContent?: React.ReactNode;
  showBack?: boolean;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
}

export default function Header({ title, centerContent, showBack = false, leftContent, rightContent }: HeaderProps) {
  const router = useRouter();

  return (
    <View style={styles.header}>
      {/* Phần bên trái: Tự co giãn theo nội dung */}
      <View style={styles.headerLeft}>
        {showBack && (
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={26} color={COLORS.text} />
          </TouchableOpacity>
        )}
        {leftContent}
      </View>

      {/* Phần ở giữa: Nhận flex 1 và cách hai bên một khoảng an toàn */}
      <View style={styles.headerCenter}>
        {centerContent ? centerContent : (title ? <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text> : null)}
      </View>

      {/* Phần bên phải: Tự động giãn rộng để chứa đủ 3 icon không bị đè */}
      <View style={styles.headerRight}>
        {rightContent}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    paddingHorizontal: 16, 
    height: 56, 
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border
  },
  headerLeft: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    justifyContent: 'flex-start' 
  },
  headerCenter: { 
    flex: 1, 
    marginHorizontal: 12, // Tạo khoảng cách an toàn với các nút hai bên
    justifyContent: 'center' 
  },
  headerRight: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    justifyContent: 'flex-end' 
  },
  backButton: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
});