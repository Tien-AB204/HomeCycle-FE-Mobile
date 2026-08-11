export const MAIN_CATEGORIES = [
  { id: "dien_may", label: "Điện máy" },
  { id: "noi_that", label: "Nội thất" },
  { id: "sinh_hoat", label: "Sinh hoạt" },
];

export const GENERAL_FILTERS = {
  conditions: [
    "Mới 100%",
    "Hoạt động tốt",
    "Hư nhẹ",
    "Hư nặng",
    "Xác/Đồng nát",
  ],
  priceRanges: [
    "Dưới 500k",
    "500k - 2 Triệu",
    "2 Triệu - 5 Triệu",
    "Trên 5 Triệu",
  ],
  priorities: ["Bán gấp", "Thanh lý số lượng lớn"],
};

export const SPECIFIC_FILTERS = {
  dien_may: {
    types: [
      "Tủ lạnh",
      "Máy giặt",
      "Lò vi sóng",
      "Máy lạnh",
      "Tivi",
      "Quạt",
      "Máy hút bụi",
    ],
    brands: ["Samsung", "LG", "Panasonic", "Sony", "Toshiba", "Khác"],
    hasWarranty: ["Còn bảo hành", "Hết bảo hành"],
  },
  noi_that: {
    types: ["Phòng khách", "Phòng ngủ", "Phòng ăn/Bếp", "Làm việc & Khác"],
    brands: ["JYSK", "Nhà Xinh", "Index Living Mall", "Baya", "Liên Á", "Khác"],
    materials: [
      "Gỗ tự nhiên",
      "Gỗ công nghiệp",
      "Kim loại",
      "Nhựa",
      "Sofa/Nỉ",
      "Da",
    ],
  },
  sinh_hoat: {
    types: ["Dụng cụ nấu ăn", "Vệ sinh nhà cửa", "Đồ nhựa", "Chăm sóc cá nhân"],
    brands: ["Sunhouse", "Lock&Lock", "Tefal", "Inochi", "Philips", "Khác"],
    materials: ["Inox/Thép", "Nhựa cao cấp", "Thủy tinh", "Gốm sứ"],
  },
};
