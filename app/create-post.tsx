import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../src/constants/theme';

export default function CreatePostScreen() {
  const router = useRouter();

  // DEV MODE: Giả lập Role để xem 2 loại form
  const [devRole, setDevRole] = useState<'personal' | 'business'>('personal');

  const handlePublish = () => {
    alert(`Đã gửi yêu cầu tạo tin ${devRole === 'personal' ? 'ĐĂNG BÁN' : 'THU MUA'} thành công!`);
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
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="close" size={28} color={COLORS.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {devRole === 'personal' ? 'Đăng tin Bán' : 'Tạo tin Thu mua'}
          </Text>
          <TouchableOpacity onPress={handlePublish}>
            <Text style={styles.publishButtonText}>Đăng</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContainer} showsVerticalScrollIndicator={false}>
          
          {/* NÚT DEV MODE */}
          <TouchableOpacity 
            style={styles.devToggleBtn}
            onPress={() => setDevRole(devRole === 'personal' ? 'business' : 'personal')}
          >
            <Ionicons name="swap-horizontal" size={20} color="#D97706" />
            <Text style={styles.devToggleText}>
              DEV MODE: Form [{devRole === 'personal' ? 'Cá nhân - Bán' : 'Doanh nghiệp - Mua'}]
            </Text>
          </TouchableOpacity>

          {/* ================= KHỐI 1: HÌNH ẢNH SẢN PHẨM ================= */}
          {/* Chỉ Cá nhân (Đăng bán) mới bắt buộc có ảnh */}
          {devRole === 'personal' && (
            <View style={styles.imageSection}>
              <Text style={styles.label}>Hình ảnh sản phẩm <Text style={styles.required}>* (2-5 ảnh)</Text></Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.imageScroll}>
                <TouchableOpacity style={styles.addImageBox}>
                  <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
                  <Text style={styles.addImageText}>Thêm ảnh</Text>
                </TouchableOpacity>
                {/* Mock placeholders */}
                <View style={styles.imagePlaceholder}><Ionicons name="image-outline" size={24} color={COLORS.textLight} /></View>
                <View style={styles.imagePlaceholder}><Ionicons name="image-outline" size={24} color={COLORS.textLight} /></View>
              </ScrollView>
            </View>
          )}

          {/* ================= KHỐI 2: THÔNG TIN CƠ BẢN ================= */}
          <SectionTitle title="THÔNG TIN CƠ BẢN" />

          <Text style={styles.label}>
            {devRole === 'personal' ? 'Tên sản phẩm' : 'Tiêu đề tin thu mua / Tên sản phẩm'} <Text style={styles.required}>*</Text>
          </Text>
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="Nhập tiêu đề..." />
          </View>

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Phân loại <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputContainer}>
                <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder={devRole === 'business' ? "Tất cả / Điện máy..." : "Điện máy/Nội thất..."} />
                <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Thương hiệu <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputContainer}>
                <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder={devRole === 'business' ? "Tất cả / Sony..." : "VD: Samsung..."} />
              </View>
            </View>
          </View>

          <Text style={styles.label}>Mô tả chi tiết <Text style={styles.required}>*</Text></Text>
          <View style={[styles.inputContainer, { height: 100, alignItems: 'flex-start', paddingTop: 12 }]}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} multiline placeholder="Mô tả tình trạng, đặc điểm nổi bật..." />
          </View>

          {/* ================= KHỐI 3: TÌNH TRẠNG & THÔNG SỐ ================= */}
          <SectionTitle title="TÌNH TRẠNG & THÔNG SỐ" />

          {devRole === 'personal' && (
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Kích thước (DxRxC) <Text style={styles.required}>*</Text></Text>
                <View style={styles.inputContainer}>
                  <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="VD: 120x60x80 cm" />
                </View>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.label}>Cân nặng (kg)</Text>
                <View style={styles.inputContainer}>
                  <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} keyboardType="numeric" placeholder="VD: 15" />
                </View>
              </View>
            </View>
          )}

          <Text style={styles.label}>Tình trạng sản phẩm <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder={devRole === 'personal' ? "Hoạt động tốt / Hư nhẹ..." : "Tất cả tình trạng..."} />
            <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
          </View>

          <Text style={styles.label}>Thời gian đã sử dụng <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="Dưới 1 tháng, Trên 1 năm..." />
            <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
          </View>

          {/* ================= KHỐI 4: GIAO DỊCH & MỨC GIÁ ================= */}
          <SectionTitle title="GIAO DỊCH & MỨC GIÁ" />

          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                {devRole === 'personal' ? 'Giá mong muốn' : 'Khoảng giá dự kiến'} <Text style={styles.required}>*</Text>
              </Text>
              <View style={styles.inputContainer}>
                <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} keyboardType="numeric" placeholder={devRole === 'personal' ? "VNĐ" : "VD: 1tr - 2tr"} />
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Số lượng <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputContainer}>
                <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} keyboardType="numeric" placeholder="Nhập SL..." />
              </View>
            </View>
          </View>

          <Text style={styles.label}>Khu vực giao dịch <Text style={styles.required}>*</Text></Text>
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="Chọn khu vực..." />
            <Ionicons name="location-outline" size={20} color={COLORS.textLight} />
          </View>

          <Text style={styles.label}>Mức độ ưu tiên</Text>
          <View style={styles.inputContainer}>
            <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="Không / Bán gấp / Thanh lý SLL..." />
            <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
          </View>

          {devRole === 'business' && (
            <>
              <Text style={styles.label}>Thời hạn tin thu mua <Text style={styles.required}>*</Text></Text>
              <View style={styles.inputContainer}>
                <TextInput style={[styles.input, Platform.OS === 'web' && { outlineStyle: 'none' } as any]} placeholder="1 tuần / 1 tháng / Đến khi đủ SL..." />
                <Ionicons name="chevron-down" size={20} color={COLORS.textLight} />
              </View>
            </>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  backButton: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  publishButtonText: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },

  devToggleBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FEF3C7', paddingVertical: 12, borderRadius: 12, marginTop: 16, marginBottom: 8, borderWidth: 1, borderColor: '#F59E0B', borderStyle: 'dashed', gap: 8 },
  devToggleText: { color: '#D97706', fontSize: 13, fontWeight: '700' },

  sectionTitleContainer: { flexDirection: 'row', alignItems: 'center', marginTop: 24, marginBottom: 16 },
  sectionTitleBar: { width: 4, height: 16, backgroundColor: COLORS.primary, borderRadius: 2, marginRight: 8 },
  sectionTitleText: { fontSize: 15, fontWeight: 'bold', color: '#334155', textTransform: 'uppercase' },

  imageSection: { marginTop: 16 },
  imageScroll: { gap: 12, paddingVertical: 8 },
  addImageBox: { width: 100, height: 100, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary, borderStyle: 'dashed', backgroundColor: '#F0F9FF', justifyContent: 'center', alignItems: 'center' },
  addImageText: { fontSize: 12, color: COLORS.primary, fontWeight: '600', marginTop: 4 },
  imagePlaceholder: { width: 100, height: 100, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },

  label: { fontSize: 13, fontWeight: '600', color: COLORS.text, marginBottom: 8 },
  required: { color: COLORS.error, fontWeight: 'normal' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, paddingHorizontal: 16, minHeight: 50, backgroundColor: COLORS.white, marginBottom: 16 },
  input: { flex: 1, fontSize: 15, color: COLORS.text, height: '100%' },
  row: { flexDirection: 'row', gap: 12 },
});