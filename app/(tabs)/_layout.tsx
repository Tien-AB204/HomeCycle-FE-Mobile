import { Tabs } from 'expo-router';

export default function TabLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Trang chủ' }} />
      <Tabs.Screen name="orders" options={{ title: 'Đơn hàng' }} />
      <Tabs.Screen name="profile" options={{ title: 'Cá nhân' }} />
    </Tabs>
  );
}