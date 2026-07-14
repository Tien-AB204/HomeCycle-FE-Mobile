import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import MainHeader from '../../src/components/shared/MainHeader';
import { COLORS } from '../../src/constants/theme';
import { useAuth } from '../../src/contexts/AuthContext';

export default function PostsScreen() {
  const { user } = useAuth();
  const isBusiness = user?.role === 'business';

  return (
    <SafeAreaView style={styles.safeArea}>
      <MainHeader title="Quản lý tin đăng" />
      <View style={styles.container}>
        <Text style={styles.title}>
          {isBusiness ? "Danh sách tin mua (Doanh nghiệp)" : "Danh sách tin bán (Cá nhân)"}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
});