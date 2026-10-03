import * as ImagePicker from "expo-image-picker";
import { Alert } from "react-native";

import {
  requestImageSource,
  type ImageSourcePrompt,
} from "../components/shared/ImageSourceSheetHost";

const CANCELED_RESULT: ImagePicker.ImagePickerResult = {
  canceled: true,
  assets: null,
};

// Thay cho ImagePicker.launchImageLibraryAsync ở các ô tải ảnh giấy tờ: cho chọn chụp ảnh
// hoặc lấy từ thư viện, trả về cùng dạng kết quả nên nơi gọi không phải đổi cách xử lý.
export const launchImagePickerWithCamera = async (
  options: ImagePicker.ImagePickerOptions,
  prompt?: ImageSourcePrompt,
): Promise<ImagePicker.ImagePickerResult> => {
  const source = await requestImageSource(prompt);
  if (!source) return CANCELED_RESULT;

  if (source === "library") {
    return ImagePicker.launchImageLibraryAsync(options);
  }

  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) {
    Alert.alert(
      "Chưa có quyền dùng camera",
      "Vui lòng cho phép HomeCycle dùng camera trong Cài đặt của máy, hoặc chọn ảnh từ thư viện.",
    );
    return CANCELED_RESULT;
  }

  try {
    return await ImagePicker.launchCameraAsync(options);
  } catch {
    // Ví dụ máy ảo iOS không có camera.
    Alert.alert(
      "Không mở được camera",
      "Thiết bị này không dùng được camera. Vui lòng chọn ảnh từ thư viện.",
    );
    return CANCELED_RESULT;
  }
};
