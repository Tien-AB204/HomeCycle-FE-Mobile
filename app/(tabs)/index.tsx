import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/theme';

export default function HomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="home" size={64} color={COLORS.primary} style={styles.icon} />
        <Text style={styles.title}>Trang chủ HomeCycle</Text>
        <Text style={styles.subtitle}>Chào mừng bạn đến với nền tảng mua bán đồ cũ an toàn và tiện lợi.</Text>
        
        <View style={styles.buttonGroup}>
          <TouchableOpacity 
            style={styles.primaryButton} 
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.primaryButtonText}>Đăng Nhập</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={styles.outlineButton} 
            onPress={() => router.push('/(auth)/register')}
          >
            <Text style={styles.outlineButtonText}>Đăng Ký</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  icon: {
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 40,
  },
  buttonGroup: {
    width: '100%',
    gap: 16,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: 'bold',
  },
  outlineButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: COLORS.primary,
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  outlineButtonText: {
    color: COLORS.primary,
    fontSize: 15,
    fontWeight: 'bold',
  },
});