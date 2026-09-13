import { Platform } from "react-native";
import apiClient from "./axiosClient";

export const COLLECTION_DELIVERY_METHOD = {
  GHN: 1,
  SELLER_DELIVERS: 2,
  BUYER_PICKUP: 3,
} as const;

export type CollectionDeliveryMethod =
  (typeof COLLECTION_DELIVERY_METHOD)[keyof typeof COLLECTION_DELIVERY_METHOD];

export type GhnAddressInput = {
  provinceId: number;
  provinceName: string;
  districtId: number;
  districtName: string;
  wardCode: string;
  wardName: string;
  addressDetail: string;
};

export type GhnContactInput = {
  fullName: string;
  phone: string;
  address: GhnAddressInput;
};

export type GhnLightParcelInput = {
  weightGram: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
};

export type GhnItemInput = GhnLightParcelInput & {
  name: string;
  code?: string | null;
  quantity: number;
};

/**
 * Contract dành riêng cho POST collection-appointments.
 *
 * Cố ý KHÔNG có:
 * - paymentTypeId
 * - quoteStatus
 * - quote
 *
 * Các field này do backend quản lý và validator từ chối nếu client gửi.
 */
export type CollectionGhnInfoInput = {
  sender: GhnContactInput;
  receiver: GhnContactInput;
  serviceTypeId: 2 | 5;
  requiredNote:
    | "CHOTHUHANG"
    | "CHOXEMHANGKHONGTHU"
    | "KHONGCHOXEMHANG";
  lightParcel?: GhnLightParcelInput | null;
  items?: GhnItemInput[];
};

export type InspectionFormActions = {
  canEdit?: boolean;
  canSubmit?: boolean;
  canSellerConfirm?: boolean;
  canSellerReject?: boolean;
  canCollectNow?: boolean;
  canScheduleCollection?: boolean;
  canCancelTransaction?: boolean;
};

export type InspectionFormImage = {
  mediaId?: string;
  url: string;
  fileName?: string;
  fileSize?: number;
  displayOrder?: number;
};

export type InspectionFormSummary = {
  inspectionFormId: string;
  appointmentId?: string;
  inspectionAppointmentId?: string;
  orderId: string;
  inspectorId?: string;
  revision: number;
  inspectionStatus?: number | string;
  inspectionTime?: string | null;
  operatingStatus?: number | string | null;
  appearanceStatus?: number | string | null;
  partsStatus?: number | string | null;
  matchStatus?: number | string | null;
  inspectorNotes?: string | null;
  conclusion?: number | string | null;
  originalPrice?: number | null;
  suggestedPrice?: number | null;
  collectAction?: number | string | null;
  submittedAt?: string | null;
  sellerDecisionAt?: string | null;
  sellerDecisionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  images?: InspectionFormImage[];
  actions?: InspectionFormActions;
  order?: {
    orderId?: string;
    orderCode?: string;
    orderStatus?: number | string | null;
    paymentStatus?: number | string | null;
    originalTotalAmount?: number | null;
    finalTotalAmount?: number | null;
    amountPaid?: number | null;
    amountRemaining?: number | null;
  };
};

/**
 * Draft/update checklist payload. Every field is optional because the
 * Backend contract explicitly allows a partially-filled Draft — only
 * Submit enforces completeness.
 */
export type InspectionFormChecklist = {
  operatingStatus?: number | null;
  appearanceStatus?: number | null;
  partsStatus?: number | null;
  matchStatus?: number | null;
  inspectorNotes?: string | null;
  conclusion?: number | null;
  suggestedPrice?: number | null;
};

export type InspectionImageAsset = {
  uri: string;
  name?: string | null;
  type?: string | null;
};

const normalizeEnumKey = (value: unknown) =>
  String(value ?? "")
    .trim()
    .replace(/[\s_-]/g, "")
    .toLowerCase();

export const translateInspectionStatus = (value: unknown) => {
  switch (normalizeEnumKey(value)) {
    case "0":
    case "draft":
      return "Bản nháp";
    case "1":
    case "pendingsellerconfirmation":
      return "Chờ người bán xác nhận";
    case "2":
    case "accepted":
      return "Đã xác nhận";
    case "3":
    case "rejected":
      return "Đã từ chối";
    default:
      return "Chưa xác định";
  }
};

export const translateOperatingStatus = (value: unknown) => {
  switch (normalizeEnumKey(value)) {
    case "1":
    case "workingwell":
      return "Hoạt động tốt";
    case "2":
    case "workingwithminorissue":
      return "Hoạt động, có lỗi nhỏ";
    case "3":
    case "unstable":
      return "Hoạt động không ổn định";
    case "4":
    case "notworking":
      return "Không hoạt động";
    case "5":
    case "unabletotest":
      return "Không thể kiểm tra";
    default:
      return null;
  }
};

export const translateAppearanceStatus = (value: unknown) => {
  switch (normalizeEnumKey(value)) {
    case "1":
    case "intact":
      return "Nguyên vẹn";
    case "2":
    case "minorscratches":
      return "Trầy xước nhẹ";
    case "3":
    case "heavyscratches":
      return "Trầy xước nặng";
    case "4":
    case "deformedorcracked":
      return "Biến dạng hoặc nứt vỡ";
    case "5":
    case "previouslyrepaired":
      return "Đã từng sửa chữa";
    default:
      return null;
  }
};

export const translatePartsStatus = (value: unknown) => {
  switch (normalizeEnumKey(value)) {
    case "1":
    case "complete":
      return "Đầy đủ phụ kiện";
    case "2":
    case "missingparts":
      return "Thiếu phụ kiện";
    default:
      return null;
  }
};

export const translateMatchStatus = (value: unknown) => {
  switch (normalizeEnumKey(value)) {
    case "1":
    case "matchesdescription":
      return "Đúng với mô tả";
    case "2":
    case "minordifference":
      return "Khác biệt nhỏ so với mô tả";
    case "3":
    case "significantdifference":
      return "Khác biệt đáng kể so với mô tả";
    case "4":
    case "doesnotmatch":
      return "Không đúng với mô tả";
    default:
      return null;
  }
};

export const translateConclusion = (value: unknown) => {
  switch (normalizeEnumKey(value)) {
    case "1":
    case "passed":
      return "Đạt yêu cầu";
    case "2":
    case "priceadjustment":
      return "Đạt, đề xuất điều chỉnh giá";
    case "3":
    case "failed":
      return "Không đạt yêu cầu";
    default:
      return null;
  }
};

export const isPriceAdjustmentConclusion = (value: unknown) =>
  normalizeEnumKey(value) === "2" || normalizeEnumKey(value) === "priceadjustment";

/**
 * Parses an authoritative enum value (Backend serializes enums as their
 * name string, e.g. "WorkingWell") back into the plain numeric value this
 * screen's pickers use as local edit state. Accepts a numeric string too,
 * defensively, matching the normalize convention used elsewhere in the app.
 */
export const parseOperatingStatus = (value: unknown): number | null => {
  switch (normalizeEnumKey(value)) {
    case "1":
    case "workingwell":
      return 1;
    case "2":
    case "workingwithminorissue":
      return 2;
    case "3":
    case "unstable":
      return 3;
    case "4":
    case "notworking":
      return 4;
    case "5":
    case "unabletotest":
      return 5;
    default:
      return null;
  }
};

export const parseAppearanceStatus = (value: unknown): number | null => {
  switch (normalizeEnumKey(value)) {
    case "1":
    case "intact":
      return 1;
    case "2":
    case "minorscratches":
      return 2;
    case "3":
    case "heavyscratches":
      return 3;
    case "4":
    case "deformedorcracked":
      return 4;
    case "5":
    case "previouslyrepaired":
      return 5;
    default:
      return null;
  }
};

export const parsePartsStatus = (value: unknown): number | null => {
  switch (normalizeEnumKey(value)) {
    case "1":
    case "complete":
      return 1;
    case "2":
    case "missingparts":
      return 2;
    default:
      return null;
  }
};

export const parseMatchStatus = (value: unknown): number | null => {
  switch (normalizeEnumKey(value)) {
    case "1":
    case "matchesdescription":
      return 1;
    case "2":
    case "minordifference":
      return 2;
    case "3":
    case "significantdifference":
      return 3;
    case "4":
    case "doesnotmatch":
      return 4;
    default:
      return null;
  }
};

export const parseConclusion = (value: unknown): number | null => {
  switch (normalizeEnumKey(value)) {
    case "1":
    case "passed":
      return 1;
    case "2":
    case "priceadjustment":
      return 2;
    case "3":
    case "failed":
      return 3;
    default:
      return null;
  }
};

export const OPERATING_STATUS_OPTIONS = [1, 2, 3, 4, 5] as const;
export const APPEARANCE_STATUS_OPTIONS = [1, 2, 3, 4, 5] as const;
export const PARTS_STATUS_OPTIONS = [1, 2] as const;
export const MATCH_STATUS_OPTIONS = [1, 2, 3, 4] as const;
export const CONCLUSION_OPTIONS = [1, 2, 3] as const;

export type ScheduleInspectionCollectionRequest = {
  expectedRevision: number;
  collectionDate: string;
  pickupAddress?: string | null;
  deliveryAddress?: string | null;
  deliveryMethod: CollectionDeliveryMethod;

  /**
   * GHN: phải là null / omitted.
   * SellerDelivers / BuyerPickUp: cho phép >= 0, bao gồm 0.
   */
  estimatedShippingFee?: number | null;

  /**
   * GHN: bắt buộc.
   * SellerDelivers / BuyerPickUp: phải null / omitted.
   */
  ghnInfo?: CollectionGhnInfoInput | null;
};

export type ScheduleInspectionCollectionResponse = {
  inspectionFormId: string;
  revision: number;
  orderId: string;
  appointmentId: string;
  collectionAppointmentId: string;
  shipmentId: string;
  deliveryMethod: number | string;
  estimatedShippingFee: number;
  collectionDate: string;
};

const unwrap = <T>(value: any): T =>
  (value?.data?.data ?? value?.data ?? value) as T;

const appendImageAsset = async (
  formData: FormData,
  asset: InspectionImageAsset,
  index: number,
  fieldName: string,
) => {
  const fallbackName = `inspection-evidence-${index + 1}.jpg`;

  if (Platform.OS === "web") {
    const response = await fetch(asset.uri);
    const blob = await response.blob();
    formData.append(fieldName, blob, asset.name || fallbackName);
    return;
  }

  formData.append(fieldName, {
    uri: asset.uri,
    name: asset.name || fallbackName,
    type: asset.type || "image/jpeg",
  } as any);
};

const appendChecklistFields = (
  formData: FormData,
  checklist: InspectionFormChecklist,
) => {
  if (checklist.operatingStatus != null) {
    formData.append("OperatingStatus", String(checklist.operatingStatus));
  }
  if (checklist.appearanceStatus != null) {
    formData.append("AppearanceStatus", String(checklist.appearanceStatus));
  }
  if (checklist.partsStatus != null) {
    formData.append("PartsStatus", String(checklist.partsStatus));
  }
  if (checklist.matchStatus != null) {
    formData.append("MatchStatus", String(checklist.matchStatus));
  }
  if (checklist.inspectorNotes != null) {
    formData.append("InspectorNotes", checklist.inspectorNotes);
  }
  if (checklist.conclusion != null) {
    formData.append("Conclusion", String(checklist.conclusion));

    if (
      isPriceAdjustmentConclusion(checklist.conclusion) &&
      checklist.suggestedPrice != null
    ) {
      formData.append("SuggestedPrice", String(checklist.suggestedPrice));
    }
  }
};

const inspectionFormApi = {
  getByAppointment: async (
    appointmentId: string,
  ): Promise<InspectionFormSummary> => {
    const response = await apiClient.get(
      `/inspection-forms/appointment/${appointmentId}`,
    );

    return unwrap<InspectionFormSummary>(response);
  },

  createDraft: async (
    appointmentId: string,
    checklist: InspectionFormChecklist,
    images: InspectionImageAsset[],
  ): Promise<InspectionFormSummary> => {
    const formData = new FormData();
    appendChecklistFields(formData, checklist);

    for (let index = 0; index < images.length; index += 1) {
      await appendImageAsset(formData, images[index], index, "Images");
    }

    const response = await apiClient.post(
      `/inspection-forms/appointment/${appointmentId}`,
      formData,
      { timeout: 60000 },
    );

    return unwrap<InspectionFormSummary>(response);
  },

  updateDraft: async (
    inspectionFormId: string,
    expectedRevision: number,
    checklist: InspectionFormChecklist,
    replaceImages: boolean,
    images: InspectionImageAsset[],
  ): Promise<InspectionFormSummary> => {
    const formData = new FormData();
    formData.append("ExpectedRevision", String(expectedRevision));
    appendChecklistFields(formData, checklist);
    formData.append("ReplaceImages", replaceImages ? "true" : "false");

    if (replaceImages) {
      for (let index = 0; index < images.length; index += 1) {
        await appendImageAsset(formData, images[index], index, "Images");
      }
    }

    const response = await apiClient.put(
      `/inspection-forms/${inspectionFormId}`,
      formData,
      { timeout: 60000 },
    );

    return unwrap<InspectionFormSummary>(response);
  },

  submit: async (
    inspectionFormId: string,
    expectedRevision: number,
  ): Promise<InspectionFormSummary> => {
    const response = await apiClient.post(
      `/inspection-forms/${inspectionFormId}/submit`,
      { expectedRevision },
    );

    return unwrap<InspectionFormSummary>(response);
  },

  sellerConfirm: async (
    inspectionFormId: string,
    expectedRevision: number,
  ): Promise<InspectionFormSummary> => {
    const response = await apiClient.post(
      `/inspection-forms/${inspectionFormId}/confirm`,
      { expectedRevision },
    );

    return unwrap<InspectionFormSummary>(response);
  },

  sellerReject: async (
    inspectionFormId: string,
    expectedRevision: number,
    reason: string,
  ): Promise<InspectionFormSummary> => {
    const response = await apiClient.post(
      `/inspection-forms/${inspectionFormId}/reject`,
      { expectedRevision, reason },
    );

    return unwrap<InspectionFormSummary>(response);
  },

  collectNow: async (
    inspectionFormId: string,
    expectedRevision: number,
  ): Promise<InspectionFormSummary> => {
    const response = await apiClient.post(
      `/inspection-forms/${inspectionFormId}/collect-now`,
      {
        expectedRevision,
      },
    );

    return unwrap<InspectionFormSummary>(response);
  },

  scheduleCollection: async (
    inspectionFormId: string,
    payload: ScheduleInspectionCollectionRequest,
  ): Promise<ScheduleInspectionCollectionResponse> => {
    const response = await apiClient.post(
      `/inspection-forms/${inspectionFormId}/collection-appointments`,
      payload,
    );

    return unwrap<ScheduleInspectionCollectionResponse>(response);
  },
};

export default inspectionFormApi;