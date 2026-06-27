import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  const handleSendCode = () => {
    if (!email) {
      alert("Vui lòng nhập email của bạn");
      return;
    }
    // Chuyển sang trang OTP, mang theo email và luồng 'forgot_password'
    router.push({
      pathname: '/(auth)/otp',
      params: { email: email, flow: 'forgot_password' }
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Khung nội dung chính */}
        <View style={styles.contentCard}>
          <View style={styles.logoCenterContainer}>
            <View style={styles.logoBox}>
              <Ionicons name="sync-circle" size={32} color={COLORS.white} />
            </View>
            <Text style={styles.logoText}>HomeCycle</Text>
            <Text style={styles.title}>Khôi phục mật khẩu</Text>
            <Text style={styles.subtitle}>Nhập email của bạn để nhận mã OTP xác thực khôi phục tài khoản.</Text>
          </View>

          {/* Ô nhập Email */}
          <Text style={styles.label}>ĐỊA CHỈ EMAIL</Text>
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={20} color={COLORS.textLight} style={styles.inputIcon} />
            <TextInput
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              placeholder="user@example.com"
              placeholderTextColor={COLORS.textLight}
              keyboardType="email-address"
              autoCapitalize="none"
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Nút Gửi mã */}
          <TouchableOpacity style={styles.primaryButton} onPress={handleSendCode}>
            <Text style={styles.primaryButtonText}>GỬI MÃ KHÔI PHỤC</Text>
          </TouchableOpacity>

          {/* Quay lại đăng nhập */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.backToLoginButton} onPress={() => router.push('/(auth)/login')}>
              <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
              <Text style={styles.backToLoginText}>Quay lại đăng nhập</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
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
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 20,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  contentCard: {
    backgroundColor: COLORS.white,
    borderRadius: 24,
    padding: 24,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8 },
      android: { elevation: 2 },
      web: { boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)' } as any,
    }),
  },
  logoCenterContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoBox: {
    backgroundColor: COLORS.primary,
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  logoText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.primary,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: '#FAFAFA',
    marginBottom: 24,
  },
  inputIcon: {
    marginRight: 12,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 14,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
  footer: {
    alignItems: 'center',
  },
  backToLoginButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  backToLoginText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
});