import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import MainHeader from '../../src/components/shared/MainHeader';
import { COLORS } from '../../src/constants/theme';

export default function CartScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <MainHeader title="Giỏ hàng của bạn" />
      <View style={styles.container}>
        <Text style={styles.title}>Chưa có sản phẩm nào trong giỏ</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.white },
  container: { flex: 1, padding: 20, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 16, color: COLORS.textLight },
});