import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../src/constants/theme';

export default function AccountInfoScreen() {
  const router = useRouter();

  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress] = useState('');

  const [representativeCode, setRepresentativeCode] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [representativeDob, setRepresentativeDob] = useState('');
  const [representativeAddress, setRepresentativeAddress] = useState('');
  const [frontIDCardImage, setFrontIDCardImage] = useState<string | null>(null);
  const [backIDCardImage, setBackIDCardImage] = useState<string | null>(null);

  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountName, setAccountName] = useState('');

  const handleSaveChanges = () => {
    const profilePayload = { username, fullName, phoneNumber, address };
    const identityPayload = { 
      representativeCode, representativeName, representativeDob, 
      representativeAddress, frontIDCardImage, backIDCardImage 
    };
    const bankPayload = { bankName, accountNumber, accountName };

    console.log("Saving Profile: ", profilePayload);
    console.log("Saving Identity: ", identityPayload);
    console.log("Saving Bank: ", bankPayload);

    alert("Cập nhật thông tin thành công!");
    router.back();
  };

  const SectionTitle = ({ title }: { title: string }) => (
    <View style={styles.sectionTitleContainer}>
      <View style={styles.sectionTitleBar} />
      <Text style={styles.sectionTitleText}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Thông tin tài khoản</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          <View style={styles.avatarContainer}>
            <View style={styles.avatarPlaceholder}>
              <Ionicons name="person-outline" size={40} color={COLORS.textLight} />
              <TouchableOpacity style={styles.cameraIcon}>
                <Ionicons name="camera" size={16} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>

          <SectionTitle title="THÔNG TIN CÁ NHÂN" />
          
          <Text style={styles.label}>Username</Text>
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="username_cua_ban" value={username} onChangeText={setUsername} />
          </View>

          <Text style={styles.label}>Họ và tên</Text>
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="Nhập họ và tên..." value={fullName} onChangeText={setFullName} />
          </View>

          <Text style={styles.label}>Số điện thoại</Text>
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="Nhập số điện thoại..." keyboardType="phone-pad" value={phoneNumber} onChangeText={setPhoneNumber} />
          </View>

          <Text style={styles.label}>Địa chỉ</Text>
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="Nhập địa chỉ..." value={address} onChangeText={setAddress} />
          </View>

          <SectionTitle title="HỒ SƠ PHÁP LÝ" />

          <Text style={styles.label}>CCCD của bạn</Text>
          <View style={styles.cccdRow}>
            <TouchableOpacity style={styles.cccdBox}>
              <Ionicons name="camera-outline" size={28} color={COLORS.textLight} />
              <Text style={styles.cccdText}>Mặt trước</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cccdBox}>
              <Ionicons name="camera-outline" size={28} color={COLORS.textLight} />
              <Text style={styles.cccdText}>Mặt sau</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.label}>Số CCCD</Text>
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="Nhập số thẻ CCCD..." keyboardType="number-pad" value={representativeCode} onChangeText={setRepresentativeCode} />
          </View>

          <Text style={styles.label}>Họ tên trên CCCD</Text>
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="Nhập chính xác họ tên..." value={representativeName} onChangeText={setRepresentativeName} />
          </View>

          <Text style={styles.label}>Ngày sinh (trên CCCD)</Text>
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="YYYY-MM-DD" value={representativeDob} onChangeText={setRepresentativeDob} />
            <Ionicons name="calendar-outline" size={20} color={COLORS.textLight} />
          </View>

          <Text style={styles.label}>Địa chỉ thường trú</Text>
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="Nhập địa chỉ thường trú..." value={representativeAddress} onChangeText={setRepresentativeAddress} />
          </View>

          <SectionTitle title="THÔNG TIN THANH TOÁN" />

          <Text style={styles.label}>Ngân hàng thụ hưởng</Text>
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="VD: Vietcombank, Techcombank..." value={bankName} onChangeText={setBankName} />
          </View>

          <Text style={styles.label}>Số tài khoản</Text>
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="Nhập số tài khoản..." keyboardType="number-pad" value={accountNumber} onChangeText={setAccountNumber} />
          </View>

          <Text style={styles.label}>Tên chủ tài khoản (Phải khớp với CCCD)</Text>
          <View style={[styles.inputContainer, { marginBottom: 32 }]}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="VD: NGUYEN VAN A" autoCapitalize="characters" value={accountName} onChangeText={setAccountName} />
          </View>

          <TouchableOpacity style={styles.primaryButton} onPress={handleSaveChanges}>
            <Text style={styles.primaryButtonText}>LƯU THAY ĐỔI</Text>
          </TouchableOpacity>

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backButton: { padding: 4, marginLeft: -4 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  
  avatarContainer: { alignItems: 'center', marginTop: 24, marginBottom: 16 },
  avatarPlaceholder: { width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', position: 'relative' },
  cameraIcon: { position: 'absolute', bottom: 0, right: -4, backgroundColor: COLORS.primary, width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: COLORS.white },

  sectionTitleContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 16 },
  sectionTitleBar: { width: 4, height: 16, backgroundColor: COLORS.primary, borderRadius: 2, marginRight: 8 },
  sectionTitleText: { fontSize: 15, fontWeight: 'bold', color: '#334155' },

  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, height: 52, backgroundColor: COLORS.white, marginBottom: 20 },
  input: { flex: 1, fontSize: 15, color: COLORS.text, height: '100%' },

  cccdRow: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  cccdBox: { flex: 1, height: 100, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: COLORS.border, borderStyle: 'dashed', borderRadius: 12, justifyContent: 'center', alignItems: 'center', gap: 8 },
  cccdText: { fontSize: 13, color: COLORS.textLight, fontWeight: '500' },

  primaryButton: { backgroundColor: COLORS.primary, borderRadius: 12, height: 54, justifyContent: 'center', alignItems: 'center' },
  primaryButtonText: { color: COLORS.white, fontSize: 16, fontWeight: 'bold' },
});