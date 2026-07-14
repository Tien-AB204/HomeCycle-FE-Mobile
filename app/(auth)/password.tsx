import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';

export default function PasswordScreen() {
  const router = useRouter();
  const { login } = useAuth();
  // Hứng lấy cái email từ trang login truyền sang
  const { email, returnUrl } = useLocalSearchParams();
  
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Trạng thái ẩn/hiện mật khẩu

  const handleLogin = async () => {
    if (!password) {
      alert("Vui lòng nhập mật khẩu");
      return;
    }
    console.log("Tiến hành đăng nhập với:", email, password);
    
    // GỌI HÀM LOGIN (Bây giờ nó sẽ không bị đỏ nữa)
    await login({
      email: email,
      name: "Tên giả lập",
    });

    if (returnUrl) {
      router.replace(returnUrl as any); // Đổi "string" thành "any"
    } else {
      router.replace('/(tabs)'); 
    }
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
            <Text style={styles.title}>Nhập mật khẩu</Text>
          </View>

          {/* Ô hiển thị Email (Readonly) */}
          <Text style={styles.label}>Tài khoản</Text>
          <View style={[styles.inputContainer, styles.inputDisabled]}>
            <TextInput
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any, { color: COLORS.text }]}
              value={email as string}
              editable={false} // Khóa ô này lại, không cho sửa
            />
          </View>

          {/* Ô nhập Mật khẩu */}
          <Text style={styles.label}>Mật khẩu</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              placeholder="Nhập mật khẩu của bạn..."
              placeholderTextColor={COLORS.textLight}
              secureTextEntry={!showPassword}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
              <Ionicons name={showPassword ? "eye-outline" : "eye-off-outline"} size={20} color={COLORS.textLight} />
            </TouchableOpacity>
          </View>

          {/* Quên mật khẩu */}
          <TouchableOpacity style={styles.forgotPasswordContainer} onPress={() => router.push('/(auth)/forgot-password' as any)}>
            <Text style={styles.forgotPasswordText}>Quên mật khẩu?</Text>
          </TouchableOpacity>

          {/* Nút Đăng Nhập */}
          <TouchableOpacity style={styles.primaryButton} onPress={handleLogin}>
            <Text style={styles.primaryButtonText}>ĐĂNG NHẬP</Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Bạn chưa có tài khoản? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.registerText}>Đăng ký tài khoản</Text>
          </TouchableOpacity>
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
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
      },
      android: {
        elevation: 2,
      },
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.05)',
      } as any,
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
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textLight,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: COLORS.white,
    marginBottom: 20,
  },
  inputDisabled: {
    backgroundColor: '#F5F5F5', // Đổi màu nền cho ô bị khóa
    borderColor: '#E0E0E0',
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  eyeIcon: {
    padding: 4,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
    marginTop: -8,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.primary,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: 'bold',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textLight,
  },
  registerText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
});