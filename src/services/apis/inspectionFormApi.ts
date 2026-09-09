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

export type InspectionFormSummary = {
  inspectionFormId: string;
  appointmentId?: string;
  inspectionAppointmentId?: string;
  orderId: string;
  revision: number;
  inspectionStatus?: number | string;
  conclusion?: number | string | null;
  collectAction?: number | string | null;
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

const inspectionFormApi = {
  getByAppointment: async (
    appointmentId: string,
  ): Promise<InspectionFormSummary> => {
    const response = await apiClient.get(
      `/inspection-forms/appointment/${appointmentId}`,
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