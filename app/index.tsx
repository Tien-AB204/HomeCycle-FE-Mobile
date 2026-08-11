import { Redirect } from "expo-router";

export default function RootIndex() {
  // Luôn luôn điều hướng thẳng vào khu vực (tabs) - Trang chủ bất kể trạng thái đăng nhập
  return <Redirect href="/(tabs)" />;
}
