import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/theme';

export default function ProfileSetupScreen() {
  const router = useRouter();

  // State lưu thông tin form
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');

  const handleComplete = () => {
    // Tạm thời log ra, sau này sẽ gọi API lưu Profile rồi bay vào App
    console.log("Hoàn thành thiết lập:", { fullName, username, dob, phone });
    router.replace('/(tabs)'); // replace để không cho back lại trang đăng ký
  };

  const handleSkip = () => {
    // Bỏ qua thiết lập, bay thẳng vào App
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          {/* Section 1: Hồ sơ cá nhân (Hình 6) */}
          <View style={styles.headerCenter}>
            <Ionicons name="sync-circle" size={32} color={COLORS.primary} style={{ marginBottom: 12 }} />
            <Text style={styles.title}>Thiết lập hồ sơ cá nhân</Text>
            <Text style={styles.subtitle}>Một vài thông tin cơ bản giúp bạn trải nghiệm mua bán tốt hơn.</Text>
          </View>

          {/* Avatar Picker Placeholder */}
          <View style={styles.avatarContainer}>
            <View style={styles.avatarBox}>
              <Ionicons name="person-outline" size={40} color="#B0B8C1" />
              <TouchableOpacity style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>

          <Text style={styles.label}>HỌ VÀ TÊN</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              placeholder="Nhập họ và tên của bạn..."
              placeholderTextColor={COLORS.textLight}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <Text style={styles.label}>USERNAME</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              placeholder="username_cua_ban"
              placeholderTextColor={COLORS.textLight}
              autoCapitalize="none"
              value={username}
              onChangeText={setUsername}
            />
          </View>

          <Text style={styles.label}>NGÀY SINH</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              placeholder="mm/dd/yyyy"
              placeholderTextColor={COLORS.textLight}
              value={dob}
              onChangeText={setDob}
            />
            <Ionicons name="calendar-outline" size={20} color={COLORS.textLight} />
          </View>

          <Text style={styles.label}>SỐ ĐIỆN THOẠI</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              placeholder="Nhập số điện thoại..."
              placeholderTextColor={COLORS.textLight}
              keyboardType="phone-pad"
              value={phone}
              onChangeText={setPhone}
            />
          </View>
          <View style={styles.privacyNoteContainer}>
            <Ionicons name="lock-closed-outline" size={14} color={COLORS.textLight} />
            <Text style={styles.privacyNoteText}>Số điện thoại của bạn sẽ được bảo mật và không hiển thị công khai.</Text>
          </View>

          {/* Đường kẻ phân cách 2 Section */}
          <View style={styles.divider} />

          {/* Section 2: Vị trí hoạt động (Hình 7) */}
          <View style={styles.headerCenter}>
            <Text style={styles.title}>Vị trí hoạt động</Text>
          </View>

          <Text style={styles.label}>Tỉnh / Thành phố</Text>
          <TouchableOpacity style={styles.dropdownContainer}>
            <Text style={styles.dropdownText}>Chọn Tỉnh / Thành phố</Text>
            <Ionicons name="chevron-down" size={20} color={COLORS.text} />
          </TouchableOpacity>

          <Text style={styles.label}>Quận / Huyện / Phường / Xã</Text>
          <TouchableOpacity style={styles.dropdownContainer}>
            <Text style={styles.dropdownText}>Chọn Quận / Huyện / Phường / Xã</Text>
            <Ionicons name="chevron-down" size={20} color={COLORS.text} />
          </TouchableOpacity>

          {/* Hộp thông báo */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={20} color={COLORS.primary} style={styles.infoIcon} />
            <Text style={styles.infoText}>
              HomeCycle chỉ sử dụng thông tin khu vực tổng quan để tối ưu bộ lọc tìm kiếm sản phẩm gần bạn. Tuyệt đối không yêu cầu số nhà hay tên đường tại đây nhằm bảo vệ quyền riêng tư cá nhân.
            </Text>
          </View>

          {/* Nút thao tác */}
          <TouchableOpacity style={styles.primaryButton} onPress={handleComplete}>
            <Text style={styles.primaryButtonText}>HOÀN THÀNH</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Bỏ qua</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollContainer: {
    paddingHorizontal: 24,
    paddingTop: 40,
    paddingBottom: 40,
  },
  headerCenter: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textLight,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 20,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatarBox: {
    width: 80,
    height: 80,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#E0E4EC',
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cameraBadge: {
    position: 'absolute',
    bottom: -8,
    right: -8,
    backgroundColor: COLORS.primary,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  label: {
    fontSize: 11,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
    textTransform: 'uppercase',
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
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
  },
  privacyNoteContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    marginTop: -8,
    marginBottom: 24,
  },
  privacyNoteText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.textLight,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 32,
  },
  dropdownContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 52,
    backgroundColor: COLORS.white,
    marginBottom: 16,
  },
  dropdownText: {
    fontSize: 15,
    color: COLORS.textLight,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#EFFFFE', // Xanh nhạt
    padding: 16,
    borderRadius: 12,
    marginBottom: 32,
    marginTop: 8,
  },
  infoIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: '#34495E',
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: 'bold',
  },
  skipButton: {
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  skipButtonText: {
    color: '#607D8B',
    fontSize: 15,
    fontWeight: '600',
  },
});