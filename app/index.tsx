import { Redirect } from 'expo-router';

export default function RootIndex() {
  // Tạm thời chưa có logic check Token, đá thẳng vào khu vực (tabs)
  return <Redirect href="/(tabs)" />;
}