import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { COLORS } from "../../constants/theme";
import apiClient from "../../services/apis/axiosClient";
import { validateNewLocalFiles } from "../../services/fileUploadPolicy";
import { getApiErrorMessage } from "../../utils/apiFeedback";
import { ModalBackdrop, ModalSurface } from "../shared/ModalBackdrop";

export type DisputeResponseMode = "accept" | "rebut" | "statement";

// BE: DisputeResponseType Accept = 1, Rebut = 2, Statement = 3.
const RESPONSE_TYPE_VALUE: Record<DisputeResponseMode, string> = {
  accept: "1",
  rebut: "2",
  statement: "3",
};

const MAX_IMAGES = 5;
const MIN_CONTENT = 10;
const MAX_CONTENT = 2000;

const COPY: Record<DisputeResponseMode, { title: string; description: string; placeholder: string; submit: string }> = {
  accept: {
    title: "Đồng ý với khiếu nại?",
    description:
      "Tranh chấp sẽ được giải quyết theo phương án bên khiếu nại đề xuất và không cần kiểm duyệt viên. Khi hai bên tự thống nhất, không bên nào bị trừ điểm uy tín.",
    placeholder: "Ghi chú thêm (không bắt buộc)",
    submit: "Đồng ý",
  },
  rebut: {
    title: "Phản biện khiếu nại",
    description:
      "Nêu lý do bạn không đồng ý. Sau khi gửi, tranh chấp được chuyển cho kiểm duyệt viên xem xét.",
    placeholder: "Nội dung phản biện (10–2000 ký tự)",
    submit: "Gửi phản biện",
  },
  statement: {
    title: "Gửi tường trình",
    description:
      "Giải thích những gì đã xảy ra với lịch hẹn. Kiểm duyệt viên sẽ dùng tường trình này cùng dữ liệu hệ thống khi xem xét.",
    placeholder: "Nội dung tường trình (10–2000 ký tự)",
    submit: "Gửi tường trình",
  },
};

const appendImage = async (formData: FormData, asset: ImagePicker.ImagePickerAsset, index: number) => {
  const fallbackName = `dispute-response-${index + 1}.jpg`;
  if (Platform.OS === "web") {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    formData.append("EvidenceImages", blob, asset.fileName || fallbackName);
    return;
  }
  formData.append("EvidenceImages", {
    uri: asset.uri,
    name: asset.fileName || fallbackName,
    type: asset.mimeType || "image/jpeg",
  } as any);
};

type Props = {
  disputeId: string;
  mode: DisputeResponseMode | null;
  onClose: () => void;
  // BE trả lại chi tiết tranh chấp sau khi phản hồi.
  onSubmitted: (detail: any, mode: DisputeResponseMode) => void;
};

export default function DisputeResponseModal({ disputeId, mode, onClose, onSubmitted }: Props) {
  const [content, setContent] = useState("");
  const [images, setImages] = useState<ImagePicker.ImagePickerAsset[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  useEffect(() => {
    if (!mode) return;
    setContent("");
    setImages([]);
    setError(null);
  }, [mode]);

  if (!mode) return null;

  const copy = COPY[mode];
  const allowImages = mode !== "accept";
  const requiresContent = mode !== "accept";

  const close = () => {
    if (isSubmitting) return;
    onClose();
  };

  const pickImages = async () => {
    setError(null);
    if (images.length >= MAX_IMAGES) {
      setError(`Tối đa ${MAX_IMAGES} ảnh.`);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: MAX_IMAGES - images.length,
      quality: 0.8,
    });
    if (result.canceled) return;
    const validation = await validateNewLocalFiles(
      "DisputeEvidence",
      result.assets.map((asset) => ({ fileName: asset.fileName, uri: asset.uri, fileSize: asset.fileSize })),
    );
    if (!validation.valid) {
      setError(validation.message);
      return;
    }
    setImages((current) => [...current, ...result.assets].slice(0, MAX_IMAGES));
  };

  const submit = async () => {
    if (submitLockRef.current) return;
    const trimmed = content.trim();
    if (requiresContent && trimmed.length < MIN_CONTENT) {
      setError(`Nội dung phải có ít nhất ${MIN_CONTENT} ký tự.`);
      return;
    }
    if (trimmed.length > MAX_CONTENT) {
      setError(`Nội dung không được vượt quá ${MAX_CONTENT} ký tự.`);
      return;
    }
    submitLockRef.current = true;
    setIsSubmitting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("ResponseType", RESPONSE_TYPE_VALUE[mode]);
      if (trimmed) formData.append("Content", trimmed);
      if (allowImages) {
        for (let index = 0; index < images.length; index += 1) {
          await appendImage(formData, images[index], index);
        }
      }
      const response = await apiClient.post(`/disputes/${disputeId}/response`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onSubmitted(response.data?.data ?? response.data, mode);
    } catch (submitError) {
      setError(getApiErrorMessage(submitError, "Không thể gửi phản hồi lúc này."));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <ModalBackdrop style={styles.backdrop} onPress={close} disabled={isSubmitting}>
        <ModalSurface style={styles.card}>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>{copy.title}</Text>
            <Text style={styles.description}>{copy.description}</Text>

            <TextInput
              style={styles.input}
              value={content}
              onChangeText={(value) => {
                setContent(value);
                if (error) setError(null);
              }}
              placeholder={copy.placeholder}
              placeholderTextColor={COLORS.textLight}
              multiline
              maxLength={MAX_CONTENT}
              editable={!isSubmitting}
            />
            {requiresContent ? (
              <Text style={styles.counter}>{content.trim().length}/{MAX_CONTENT}</Text>
            ) : null}

            {allowImages ? (
              <>
                <TouchableOpacity style={styles.pickButton} onPress={() => void pickImages()} disabled={isSubmitting}>
                  <Ionicons name="images-outline" size={18} color={COLORS.primary} />
                  <Text style={styles.pickButtonText}>Thêm ảnh ({images.length}/{MAX_IMAGES}, không bắt buộc)</Text>
                </TouchableOpacity>
                {images.length > 0 ? (
                  <View style={styles.imageRow}>
                    {images.map((asset, index) => (
                      <View key={`${asset.uri}-${index}`} style={styles.imageWrap}>
                        <Image source={{ uri: asset.uri }} style={styles.image} />
                        <TouchableOpacity
                          style={styles.removeImage}
                          onPress={() => setImages((current) => current.filter((_, i) => i !== index))}
                          disabled={isSubmitting}
                          accessibilityLabel="Bỏ ảnh"
                        >
                          <Ionicons name="close" size={14} color={COLORS.white} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : null}
              </>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <View style={styles.actions}>
              <TouchableOpacity style={styles.secondaryButton} onPress={close} disabled={isSubmitting}>
                <Text style={styles.secondaryText}>Quay lại</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryButton} onPress={() => void submit()} disabled={isSubmitting}>
                {isSubmitting ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.primaryText}>{copy.submit}</Text>
                )}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </ModalSurface>
      </ModalBackdrop>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: "center", backgroundColor: "rgba(23, 40, 48, 0.45)", padding: 20 },
  card: { maxHeight: "85%", backgroundColor: COLORS.white, borderRadius: 16, padding: 20 },
  title: { fontSize: 17, fontWeight: "700", color: COLORS.text, marginBottom: 8 },
  description: { fontSize: 14, lineHeight: 20, color: COLORS.textLight, marginBottom: 14 },
  input: {
    minHeight: 110,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: COLORS.text,
    textAlignVertical: "top",
    ...(Platform.OS === "web" ? ({ outlineStyle: "none" } as any) : {}),
  },
  counter: { alignSelf: "flex-end", fontSize: 12, color: COLORS.textLight, marginTop: 4 },
  pickButton: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, paddingVertical: 8 },
  pickButtonText: { color: COLORS.primary, fontSize: 14, fontWeight: "600" },
  imageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 6 },
  imageWrap: { position: "relative" },
  image: { width: 64, height: 64, borderRadius: 8, backgroundColor: COLORS.border },
  removeImage: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(23, 40, 48, 0.8)",
    alignItems: "center",
    justifyContent: "center",
  },
  error: { color: COLORS.error, fontSize: 13, marginTop: 10, lineHeight: 18 },
  actions: { flexDirection: "row", gap: 10, marginTop: 18 },
  secondaryButton: {
    flex: 1,
    minHeight: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryText: { color: COLORS.primary, fontSize: 14, fontWeight: "700" },
  primaryButton: { flex: 1, minHeight: 46, borderRadius: 10, backgroundColor: COLORS.primary, alignItems: "center", justifyContent: "center" },
  primaryText: { color: COLORS.white, fontSize: 14, fontWeight: "700" },
});
