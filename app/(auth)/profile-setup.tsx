// app/(auth)/profile-setup.tsx
import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, SafeAreaView, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../src/constants/theme';

export default function ProfileSetupScreen() {
  const router = useRouter();

  // State lưu thông tin cá nhân
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [dob, setDob] = useState('');
  const [phone, setPhone] = useState('');

  const handleNext = () => {
    // Lưu thông tin cá nhân (Tạm thời log)
    console.log("Thông tin cá nhân:", { fullName, username, dob, phone });
    
    // Chuyển sang bước 2: Xác minh & Thanh toán
    router.push('/(auth)/verification-setup' as any);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          <View style={styles.headerCenter}>
            <Ionicons name="person-circle" size={48} color={COLORS.primary} style={{ marginBottom: 8 }} />
            <Text style={styles.title}>Thiết lập hồ sơ cá nhân</Text>
            <Text style={styles.subtitle}>Bước 1/2: Thông tin cơ bản giúp bạn trải nghiệm mua bán tốt hơn.</Text>
          </View>

          <View style={styles.avatarContainer}>
            <View style={styles.avatarBox}>
              <Ionicons name="person-outline" size={40} color="#B0B8C1" />
              <TouchableOpacity style={styles.cameraBadge}>
                <Ionicons name="camera" size={14} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.sectionHeader}>
            <View style={styles.verticalBar} />
            <Text style={styles.sectionTitle}>THÔNG TIN CÁ NHÂN</Text>
          </View>

          <Text style={styles.fieldLabel}>Họ và tên</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              placeholder="Nhập họ và tên của bạn..."
              placeholderTextColor={COLORS.textLight}
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <Text style={styles.fieldLabel}>Username</Text>
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

          <Text style={styles.fieldLabel}>Ngày sinh</Text>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]}
              placeholder="dd/mm/yyyy"
              placeholderTextColor={COLORS.textLight}
              value={dob}
              onChangeText={setDob}
            />
            <Ionicons name="calendar-outline" size={20} color={COLORS.textLight} />
          </View>

          <Text style={styles.fieldLabel}>Số điện thoại</Text>
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

          <TouchableOpacity style={styles.primaryButton} onPress={handleNext}>
            <Text style={styles.primaryButtonText}>TIẾP TỤC</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  scrollContainer: { paddingHorizontal: 20, paddingTop: 40, paddingBottom: 40 },
  headerCenter: { alignItems: 'center', marginBottom: 32 },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.text, marginBottom: 8 },
  subtitle: { fontSize: 14, color: COLORS.textLight, textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 },
  avatarContainer: { alignItems: 'center', marginBottom: 32 },
  avatarBox: { width: 80, height: 80, borderRadius: 24, borderWidth: 2, borderColor: '#E0E4EC', borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  cameraBadge: { position: 'absolute', bottom: -8, right: -8, backgroundColor: COLORS.primary, width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.white },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  verticalBar: { width: 4, height: 16, backgroundColor: '#34495E', marginRight: 8, borderRadius: 2 },
  sectionTitle: { fontSize: 14, fontWeight: 'bold', color: '#34495E', textTransform: 'uppercase', letterSpacing: 0.5 },
  fieldLabel: { fontSize: 13, fontWeight: 'bold', color: '#2C3E50', marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 8, paddingHorizontal: 16, height: 48, backgroundColor: COLORS.white, marginBottom: 16 },
  input: { flex: 1, fontSize: 14, color: COLORS.text },
  privacyNoteContainer: { flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: -8, marginBottom: 32 },
  privacyNoteText: { flex: 1, fontSize: 12, color: COLORS.textLight, lineHeight: 18 },
  primaryButton: { backgroundColor: COLORS.primary, borderRadius: 12, height: 52, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  primaryButtonText: { color: COLORS.white, fontSize: 15, fontWeight: 'bold' },
});