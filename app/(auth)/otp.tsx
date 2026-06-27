import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/theme';

export default function OTPScreen() {
  const router = useRouter();
  // Nhận email và luồng (login, register, forgot_password) từ trang trước truyền sang
  const { email, flow, role } = useLocalSearchParams();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const inputRefs = useRef<Array<TextInput | null>>([]);
  const [timeLeft, setTimeLeft] = useState(118); // 1 phút 58 giây

  // Đếm ngược thời gian giả lập
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleOtpChange = (text: string, index: number) => {
    // Chỉ lấy 1 ký tự cuối cùng (tránh việc copy/paste dài)
    const value = text.length > 0 ? text[text.length - 1] : '';
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Tự động nhảy sang ô tiếp theo nếu có nhập
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Kiểm tra xem đã nhập đủ 6 số chưa
    if (newOtp.every((val) => val !== '')) {
      handleVerify(newOtp.join(''));
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    // Tự động lùi về ô trước nếu bấm xóa (Backspace) ở ô trống
    if (e.nativeEvent.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = (fullOtp: string) => {
    console.log("Xác thực OTP:", fullOtp);
    
    if (flow === 'login') {
      router.push({ pathname: '/(auth)/password', params: { email } });
    } else if (flow === 'register') {
      // Phân luồng rõ ràng dựa trên Role
      if (role === 'business') {
        // Tạm thời hiển thị cảnh báo, sau này sẽ thay bằng trang thiết lập doanh nghiệp
        alert("Thành công! Tính năng Thiết lập Doanh Nghiệp đang được xây dựng.");
      } else {
        router.push('/(auth)/profile-setup' as any); // Luồng cá nhân
      }
    } else if (flow === 'forgot_password') {
      router.push('/(auth)/reset-password' as any);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        {/* Header (Nút Back chuẩn form) */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
        </View>

        {/* Khung nội dung */}
        <View style={styles.contentCard}>
          <View style={styles.iconCenterContainer}>
            <View style={styles.lockIconBox}>
              <Ionicons name="lock-closed" size={32} color={COLORS.white} />
            </View>
            <Text style={styles.title}>Xác thực Email</Text>
            <Text style={styles.subtitle}>
              Hệ thống đã gửi mã OTP gồm 6 chữ số đến email của bạn. Vui lòng kiểm tra và gõ vào ô bên dưới.
            </Text>
          </View>

          {/* Cụm 6 ô nhập OTP */}
          <View style={styles.otpContainer}>
            {otp.map((digit, index) => (
              <TextInput
                key={index}
                ref={(ref) => { inputRefs.current[index] = ref; }}
                style={[
                  styles.otpInput,
                  Platform.OS === 'web' && { outlineStyle: 'none' } as any,
                  digit ? styles.otpInputActive : null // Đổi màu viền nếu có chữ
                ]}
                keyboardType="number-pad"
                maxLength={1}
                value={digit}
                onChangeText={(text) => handleOtpChange(text, index)}
                onKeyPress={(e) => handleKeyPress(e, index)}
              />
            ))}
          </View>

          {/* Thời gian đếm ngược */}
          <View style={styles.timerContainer}>
            <Ionicons name="time" size={16} color={COLORS.error} />
            <Text style={styles.timerText}>{formatTime(timeLeft)}</Text>
          </View>

          {/* Gửi lại mã */}
          <View style={styles.resendContainer}>
            <Text style={styles.resendTextBase}>Chưa nhận được mã? </Text>
            <TouchableOpacity>
              <Text style={styles.resendTextHighlight}>Gửi lại mã</Text>
            </TouchableOpacity>
          </View>

          {/* Đường kẻ ngang mỏng */}
          <View style={styles.divider} />

          {/* Nút quay lại đăng nhập ở đáy */}
          <TouchableOpacity onPress={() => router.push('/(auth)/login')} style={styles.backToLoginButton}>
            <Ionicons name="arrow-back" size={16} color={COLORS.primary} />
            <Text style={styles.backToLoginText}>Quay lại đăng nhập</Text>
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
  iconCenterContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  lockIconBox: {
    backgroundColor: COLORS.primary,
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  otpContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  otpInput: {
    width: 45,
    height: 55,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  otpInputActive: {
    borderColor: '#2F80ED', // Màu viền xanh dương như trong thiết kế Hình 2
    borderWidth: 2,
  },
  timerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 16,
  },
  timerText: {
    color: COLORS.error,
    fontWeight: 'bold',
    fontSize: 14,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  resendTextBase: {
    color: COLORS.textLight,
    fontSize: 14,
  },
  resendTextHighlight: {
    color: '#4F7C7B', // Màu xanh lục nhạt hơn một chút
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginBottom: 24,
    marginHorizontal: 10,
  },
  backToLoginButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  backToLoginText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
  },
});