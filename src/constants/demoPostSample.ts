// Dữ liệu mẫu cho tin bán khi demo (nút "Điền dữ liệu mẫu" trên màn Đăng tin mới).
// Mã danh mục, loại sản phẩm, thương hiệu và thuộc tính lấy từ dữ liệu thật trên hệ thống.
// Thuộc tính có lựa chọn dùng optionId; thuộc tính nhập tay dùng valueText / valueNumber.
type DemoAttributeValue = {
  attributeId: string;
  optionId?: string;
  valueText?: string;
  valueNumber?: number;
};

export type DemoSellPostSample = {
  key: string;
  label: string;
  productName: string;
  description: string;
  detailDescription: string;
  categoryId: string;
  productTypeId: string;
  brandId: string;
  modelNumber: string;
  spaceUsage: string;
  originalPrice: string;
  basePrice: string;
  quantity: string;
  functionalityStatus: string;
  damageLevel: string;
  usageDuration: string;
  length: string;
  width: string;
  height: string;
  weight: string;
  deliveryMethod: string;
  streetAddress: string;
  ward: string;
  city: string;
  attributeValues: DemoAttributeValue[];
};

const CATEGORY = {
  electronics: "b8086ea1-9805-41a9-9a0c-d1d46c803dd0",
  furniture: "939add58-d5f5-483d-b390-6328a20fbd9b",
  household: "3d2ce14c-8d3a-489c-9fd1-4816ede12cbb",
};

const BRAND = {
  samsung: "a84e9e66-aed1-4c05-9095-c1befe4cdc33",
  toshiba: "d9e4c00d-04fa-4746-af1f-fcb8b9b10904",
  panasonic: "cc009524-c1f8-4253-b502-7759833a479b",
  xiaomi: "1dc0c6b0-bbcf-4eb3-87dd-488779559665",
  hermanMiller: "c2ca5436-3018-4b8b-a533-2102c5161a36",
  ikea: "c6a70f06-ef7d-4d3f-9969-b1e7407034ce",
  lockAndLock: "cb81b837-b371-4ea0-a32b-be1cb81a54b3",
};

const DEMO_ADDRESS = {
  streetAddress: "107 Đường 37",
  ward: "Xã An Lạc Thôn",
  city: "Thành phố Cần Thơ",
};

export const DEMO_SELL_POST_SAMPLES: DemoSellPostSample[] = [
  {
    key: "washer-samsung",
    label: "Máy giặt Samsung 9.5kg · 2.800.000 đ",
    productName: "Máy giặt Samsung Inverter 9.5kg WW95TA046AX",
    description: "Máy giặt cửa trước Samsung 9.5kg, dùng 2 năm, chạy êm, cần pass gấp",
    detailDescription:
      "Máy giặt Samsung Inverter 9.5kg, model WW95TA046AX/SV, mua chính hãng năm 2024. Máy hoạt động bình thường, vắt êm, không rò nước, không báo lỗi. Vỏ có vài vết trầy nhẹ ở cạnh trên, không ảnh hưởng sử dụng. Đã vệ sinh lồng giặt, tặng kèm ống cấp và ống xả.",
    categoryId: CATEGORY.electronics,
    productTypeId: "eb16017a-0bc0-464a-8903-deb2e030ce71",
    brandId: BRAND.samsung,
    modelNumber: "WW95TA046AX/SV",
    spaceUsage: "Laundry_room",
    originalPrice: "9490000",
    basePrice: "2800000",
    quantity: "1",
    functionalityStatus: "FullyFunctional",
    damageLevel: "Cosmetic_Damage",
    usageDuration: "2",
    length: "50",
    width: "45",
    height: "45",
    weight: "21",
    deliveryMethod: "GhnDelivery",
    ...DEMO_ADDRESS,
    attributeValues: [
      { attributeId: "15794dd3-1325-4f8d-9e12-afcf74db46d3", optionId: "37a275ed-e4b2-41c3-a857-85e93ec8f759" },
      { attributeId: "3c70651b-b295-4011-81f1-4917bd5845f2", optionId: "bae068ee-2545-418e-91fe-48d2acf6cace" },
      { attributeId: "4b2d9d5c-57b3-488f-843b-ace2bba27809", optionId: "6983b01e-de39-4b4b-902d-ab8480d56241" },
      { attributeId: "4b7fabf9-f72c-4b95-acf5-2c8ce2b03036", optionId: "6a5ee16d-4c5f-4645-af82-1433d91531a3" },
      { attributeId: "720eab8c-24ae-4b2d-b6a0-8d583ff6ad26", optionId: "8d2c103e-4cc9-490c-90fc-936dd9fbb32e" },
      { attributeId: "da12d7b1-0f96-4fc3-87a9-aec600fe02ba", optionId: "1a210355-e007-4124-96f0-e9eb7db0d2c7" },
    ],
  },
  {
    key: "fridge-toshiba",
    label: "Tủ lạnh Toshiba 180 lít · 2.600.000 đ",
    productName: "Tủ lạnh Toshiba Inverter 180 lít GR-B22VU",
    description: "Tủ lạnh Toshiba Inverter 180 lít, dùng 3 năm, làm lạnh tốt, tiết kiệm điện",
    detailDescription:
      "Tủ lạnh Toshiba Inverter 180 lít, 2 cánh, mặt gương. Máy làm lạnh nhanh, ngăn đá đông tốt, không đọng nước, không kêu to. Gioăng cửa còn kín, khay kính đầy đủ. Mặt gương có vài vết xước nhỏ khi dọn nhà. Bán vì chuyển sang tủ lớn hơn.",
    categoryId: CATEGORY.electronics,
    productTypeId: "24c1497e-7aba-4001-b5df-7e9053042f4c",
    brandId: BRAND.toshiba,
    modelNumber: "GR-B22VU",
    spaceUsage: "Kitchen",
    originalPrice: "5490000",
    basePrice: "2600000",
    quantity: "1",
    functionalityStatus: "FullyFunctional",
    damageLevel: "Cosmetic_Damage",
    usageDuration: "3",
    length: "55",
    width: "55",
    height: "130",
    weight: "38",
    deliveryMethod: "GhnDelivery",
    ...DEMO_ADDRESS,
    attributeValues: [
      // Chất liệu cửa: mặt gương
      { attributeId: "8b3ad893-5218-4f03-a4f4-0dfc376d1717", optionId: "5e6397c9-cfd9-4a71-98b8-fc7be05c8d26" },
      // Dung tích tổng: 180 lít (nhập tay)
      { attributeId: "61086939-cc88-4931-b1e9-e1c6a70b0c60", valueNumber: 180 },
      // Công nghệ Inverter: Có
      { attributeId: "56019122-ecfa-439b-b99a-2af7244bbe70", optionId: "7aeaba6c-44c6-4681-8c88-0b5d08e0c6b5" },
    ],
  },
  {
    key: "aircon-panasonic",
    label: "Máy lạnh Panasonic 1HP · 5.500.000 đ",
    productName: "Máy lạnh Panasonic Inverter 1HP CU/CS-XU9ZKH-8",
    description: "Máy lạnh Panasonic Inverter 1HP, dùng 2 năm, lạnh sâu, chạy êm",
    detailDescription:
      "Máy lạnh Panasonic Inverter 1HP, phù hợp phòng dưới 15m2. Máy lạnh nhanh, không chảy nước, không có mùi, vừa vệ sinh bảo dưỡng tháng trước. Dàn nóng ống đồng, remote đầy đủ. Bán kèm giá đỡ dàn nóng, người mua tự lo phần tháo lắp.",
    categoryId: CATEGORY.electronics,
    productTypeId: "409c2839-191f-4f9d-ae8a-f57e137d0745",
    brandId: BRAND.panasonic,
    modelNumber: "CU/CS-XU9ZKH-8",
    spaceUsage: "Bedroom",
    originalPrice: "11990000",
    basePrice: "5500000",
    quantity: "1",
    functionalityStatus: "FullyFunctional",
    damageLevel: "None",
    usageDuration: "2",
    length: "87",
    width: "30",
    height: "29",
    weight: "29",
    deliveryMethod: "SellerDelivers",
    ...DEMO_ADDRESS,
    attributeValues: [
      // Công nghệ Inverter: Có
      { attributeId: "46924a07-acae-444d-9e9f-02519720baa6", optionId: "c23d0c4e-de93-4578-b5b6-84f411538f8e" },
      // Công suất làm lạnh: 1 HP (nhập tay)
      { attributeId: "4a47c92f-93a3-4ead-b9e9-e5b1e56c05eb", valueNumber: 1 },
      // Chất liệu dàn tản nhiệt: ống đồng
      { attributeId: "c23ec2d7-3b7b-4f63-a5d9-0dc229d60b29", optionId: "fbffe5d1-0b59-4c8b-bf7e-5c94807cf3c9" },
      // Khả năng lọc: màng lọc diệt khuẩn
      { attributeId: "4435f0f9-9171-4e0c-8deb-ff0c22dc4f3c", optionId: "189e3d79-313f-46e9-b20a-114cb21a4f37" },
    ],
  },
  {
    key: "purifier-xiaomi",
    label: "Máy lọc không khí Xiaomi 4 Lite · 1.300.000 đ",
    productName: "Máy lọc không khí Xiaomi Smart Air Purifier 4 Lite",
    description: "Máy lọc không khí Xiaomi 4 Lite, dùng 1 năm, lọc tốt, điều khiển qua app",
    detailDescription:
      "Máy lọc không khí Xiaomi Smart Air Purifier 4 Lite, phù hợp phòng 25-40m2. Máy chạy êm, cảm biến bụi hoạt động bình thường, kết nối app Mi Home ổn định. Bộ lọc HEPA còn khoảng 60%. Thân máy sạch, không trầy. Còn hộp và sách hướng dẫn.",
    categoryId: CATEGORY.electronics,
    productTypeId: "eb9a8888-3049-4809-b35d-49d52df0d158",
    brandId: BRAND.xiaomi,
    modelNumber: "AC-M17-SC",
    spaceUsage: "Living_room",
    originalPrice: "2990000",
    basePrice: "1300000",
    quantity: "1",
    functionalityStatus: "FullyFunctional",
    damageLevel: "None",
    usageDuration: "1",
    length: "26",
    width: "26",
    height: "54",
    weight: "5",
    deliveryMethod: "GhnDelivery",
    ...DEMO_ADDRESS,
    attributeValues: [
      { attributeId: "c45f0f15-442d-4a7e-aa78-4f4300745ec4", valueText: "Màng lọc HEPA H13 3 lớp" },
      { attributeId: "4968c284-7643-4b31-bdde-2d1a095002b7", valueText: "Còn khoảng 60%" },
      { attributeId: "ca47089e-ca1f-4a1e-a3e9-d3118f71538a", valueText: "Wi-Fi, app Mi Home" },
    ],
  },
  {
    key: "chair-herman-miller",
    label: "Ghế Herman Miller Aeron · 12.000.000 đ",
    productName: "Ghế công thái học Herman Miller Aeron size B",
    description: "Ghế Herman Miller Aeron size B, dùng 3 năm, lưới còn căng, ngả lưng êm",
    detailDescription:
      "Ghế công thái học Herman Miller Aeron size B, lưng và đệm lưới thoáng khí. Ngả lưng, khóa ngả, chỉnh chiều cao và tay vịn hoạt động bình thường. Lưới không rách, không chùng. Tay vịn có vài vết mòn nhẹ do sử dụng. Bán vì chuyển chỗ làm.",
    categoryId: CATEGORY.furniture,
    productTypeId: "2f8b0696-f299-47d7-b2e5-abf7e219ec8e",
    brandId: BRAND.hermanMiller,
    modelNumber: "Aeron B",
    spaceUsage: "Bedroom",
    originalPrice: "35000000",
    basePrice: "12000000",
    quantity: "1",
    functionalityStatus: "FullyFunctional",
    damageLevel: "Cosmetic_Damage",
    usageDuration: "3",
    length: "70",
    width: "68",
    height: "110",
    weight: "19",
    deliveryMethod: "GhnDelivery",
    ...DEMO_ADDRESS,
    attributeValues: [
      // Chiều cao đệm ngồi điều chỉnh: 10 cm
      { attributeId: "05b13d22-4951-410c-86c1-db241ac70ab5", optionId: "2a95c332-8b32-43ea-a3ab-7cc7cf669de3" },
      // Góc ngả lưng tối đa: 45°
      { attributeId: "f6db44c4-03b1-49cb-bc60-07663970ceaa", optionId: "a70a1802-d33a-4acc-b38a-9aade3fc537f" },
      // Tải trọng tối đa: 120 kg
      { attributeId: "ef99dd31-8247-492e-95bd-736b7102f32e", optionId: "ba880d71-fd6b-42ce-893a-082fc66a0c4a" },
      // Chất liệu đệm/lưng ghế: vải lưới thoáng khí
      { attributeId: "0f003cf6-b920-48b7-96a0-dcdaecaea8e1", optionId: "0de02321-ba84-431d-aff5-9cadf110d6d4" },
    ],
  },
  {
    key: "wardrobe-ikea",
    label: "Tủ quần áo IKEA 2 cánh · 1.200.000 đ",
    productName: "Tủ quần áo IKEA KLEPPSTAD 2 cánh",
    description: "Tủ quần áo IKEA 2 cánh màu trắng, dùng 1 năm, còn chắc chắn",
    detailDescription:
      "Tủ quần áo IKEA KLEPPSTAD 2 cánh mở, gỗ MDF phủ melamine màu trắng, kích thước khoảng 79 x 55 x 176 cm. Bên trong có 1 thanh treo và 1 kệ. Cánh đóng mở êm, bản lề không xệ. Có vài vết xước nhỏ ở mặt bên. Người mua tự đến lấy hoặc người bán chở trong nội thành.",
    categoryId: CATEGORY.furniture,
    productTypeId: "43af1c58-c5ef-499c-8236-7883a16fb3f6",
    brandId: BRAND.ikea,
    modelNumber: "KLEPPSTAD",
    spaceUsage: "Bedroom",
    originalPrice: "2499000",
    basePrice: "1200000",
    quantity: "1",
    functionalityStatus: "FullyFunctional",
    damageLevel: "Cosmetic_Damage",
    usageDuration: "1",
    length: "79",
    width: "55",
    height: "176",
    weight: "40",
    deliveryMethod: "SellerDelivers",
    ...DEMO_ADDRESS,
    attributeValues: [
      // Chiều cao tổng thể: 1.8 m
      { attributeId: "b210f18c-8d18-4541-8306-5c1ece371db2", optionId: "16a07bcc-10ae-4aba-af7a-348372a603f8" },
      // Số lượng cánh cửa: 2
      { attributeId: "2d130d2e-55de-4ed3-a1c3-919c2c15b668", optionId: "df906244-ae9b-4918-9853-ae56f01abfd9" },
      // Trọng lượng tủ: 20 kg
      { attributeId: "56a3f3d6-7e04-4086-81a0-47a5ec8168ce", optionId: "6d506016-1369-4ca1-9eda-d0e41612459d" },
      // Chất liệu: gỗ MDF phủ melamine
      { attributeId: "483dc4b9-c282-438d-bd77-af5897371f1c", optionId: "6ea1f6be-1f32-4c05-8e10-7a5db553877a" },
      // Kiểu cánh tủ: cánh mở
      { attributeId: "18a027f3-112a-4ba1-9a37-da43370709e8", optionId: "118dbd86-200b-4c2b-a0a4-a46a11e72114" },
    ],
  },
  {
    key: "desk-ikea",
    label: "Bàn nâng hạ IKEA TROTTEN · 3.000.000 đ",
    productName: "Bàn làm việc nâng hạ IKEA TROTTEN 120x70",
    description: "Bàn làm việc đứng/ngồi IKEA TROTTEN 120x70, quay tay nâng hạ, dùng 1 năm",
    detailDescription:
      "Bàn làm việc IKEA TROTTEN 120 x 70 cm, chỉnh độ cao bằng tay quay, chuyển đứng/ngồi nhẹ nhàng. Mặt bàn gỗ công nghiệp màu trắng, chân thép sơn tĩnh điện, không rung lắc. Mặt bàn có vài vết xước nhỏ. Đã tháo rời gọn để vận chuyển.",
    categoryId: CATEGORY.furniture,
    productTypeId: "99087dfd-e7ab-49ff-a14b-1ef9e5a42330",
    brandId: BRAND.ikea,
    modelNumber: "TROTTEN",
    spaceUsage: "Bedroom",
    originalPrice: "5990000",
    basePrice: "3000000",
    quantity: "1",
    functionalityStatus: "FullyFunctional",
    damageLevel: "Cosmetic_Damage",
    usageDuration: "1",
    length: "120",
    width: "70",
    height: "15",
    weight: "35",
    deliveryMethod: "BuyerPickUp",
    ...DEMO_ADDRESS,
    attributeValues: [
      // Kiểu dáng: chữ nhật truyền thống
      { attributeId: "4f346e06-6544-479d-8487-c6c004a936a8", optionId: "b80ebcdc-95a7-488e-b2db-7d0de88d97c0" },
      // Tính năng: nâng hạ
      { attributeId: "98ae9b59-f60e-4920-8d22-36d658bd47e1", optionId: "cd159a45-563e-477c-9d0c-353bce54ec90" },
      // Mặt bàn: gỗ công nghiệp
      { attributeId: "6d00a5e0-4e20-4cfd-b145-b2e81644f165", optionId: "e4a7989b-af93-4771-bd69-10badca7570a" },
      // Chân bàn: sắt sơn tĩnh điện
      { attributeId: "d3829bd5-7179-4655-866f-1fe838b25f15", optionId: "b67cefc6-4cc7-4f61-bd25-61c8699ac4cf" },
    ],
  },
  {
    key: "thermos-locknlock",
    label: "Bình giữ nhiệt Lock&Lock 500ml · 150.000 đ",
    productName: "Bình giữ nhiệt Lock&Lock 500ml",
    description: "Bình giữ nhiệt Lock&Lock inox 500ml, dùng 1 năm, giữ nhiệt tốt",
    detailDescription:
      "Bình giữ nhiệt Lock&Lock lõi inox, dung tích 500ml. Giữ nóng và lạnh tốt khoảng 12 tiếng, nắp kín không rò nước. Thân bình có vết trầy nhỏ ở đáy. Đã rửa sạch, còn gioăng cao su mới.",
    categoryId: CATEGORY.household,
    productTypeId: "b2257e74-c534-4b8a-b4d7-25629d714c82",
    brandId: BRAND.lockAndLock,
    modelNumber: "",
    spaceUsage: "Kitchen",
    originalPrice: "390000",
    basePrice: "150000",
    quantity: "1",
    functionalityStatus: "FullyFunctional",
    damageLevel: "Cosmetic_Damage",
    usageDuration: "1",
    length: "8",
    width: "8",
    height: "24",
    weight: "0.4",
    deliveryMethod: "GhnDelivery",
    ...DEMO_ADDRESS,
    attributeValues: [
      // Dung tích vừa (400ml – 600ml)
      { attributeId: "d37d05d7-70f2-4af4-8fea-86be87b33435", optionId: "acfb4719-c37f-4aa2-bc64-e31911af282e" },
      // Thời gian giữ nhiệt: tiêu chuẩn (8 – 24 tiếng)
      { attributeId: "a2dedb8b-fd16-4108-bd63-46815834e934", optionId: "bcc2f51b-3209-44e0-bb46-b7df2ffde782" },
      // Chất liệu lõi: inox
      { attributeId: "fff5c16b-252c-4cde-a7e7-fff015350a08", optionId: "963f2486-d50b-4a09-bff0-8e453f481006" },
    ],
  },
];

// Mẫu cho tin thu mua (màn "Đăng tin thu mua"). Tin thu mua không có ảnh, kích thước hay giá gốc;
// mức hư hại và thời gian sử dụng là mức tối đa người mua chấp nhận. Giá đến dùng chung state basePrice.
export type DemoBuyPostSample = {
  key: string;
  label: string;
  productName: string;
  description: string;
  categoryId: string;
  productTypeId: string;
  brandId: string;
  quantity: string;
  functionalityStatus: string;
  damageLevel: string;
  usageDuration: string;
  priceFrom: string;
  priceTo: string;
  streetAddress: string;
  ward: string;
  city: string;
};

export const DEMO_BUY_POST_SAMPLES: DemoBuyPostSample[] = [
  {
    key: "buy-washer",
    label: "Thu mua máy giặt cửa trước · 10 chiếc",
    productName: "Cần mua máy giặt cửa trước 8–10kg",
    description:
      "Thu mua số lượng 10 máy giặt cửa trước 8–10kg, còn hoạt động tốt, ưu tiên máy Inverter. Nhận máy trầy xước nhẹ, không nhận máy rò nước hoặc báo lỗi bo mạch. Hỗ trợ tới lấy hàng tại nhà trong nội thành.",
    categoryId: CATEGORY.electronics,
    productTypeId: "eb16017a-0bc0-464a-8903-deb2e030ce71",
    brandId: "",
    quantity: "10",
    functionalityStatus: "FullyFunctional",
    damageLevel: "Cosmetic_Damage",
    usageDuration: "5",
    priceFrom: "1500000",
    priceTo: "3500000",
    streetAddress: "125 Xô Viết Nghệ Tĩnh",
    ward: "Phường Bình Thạnh",
    city: "Thành phố Hồ Chí Minh",
  },
  {
    key: "buy-fridge",
    label: "Thu mua tủ lạnh 150–250 lít · 5 chiếc",
    productName: "Cần mua tủ lạnh Inverter 150–250 lít",
    description:
      "Cần mua 5 tủ lạnh 2 cánh dung tích 150–250 lít cho phòng trọ cho thuê. Yêu cầu làm lạnh tốt, gioăng cửa còn kín, không đọng nước. Ưu tiên Toshiba, Panasonic, Samsung. Thanh toán ngay khi nhận hàng.",
    categoryId: CATEGORY.electronics,
    productTypeId: "24c1497e-7aba-4001-b5df-7e9053042f4c",
    brandId: "",
    quantity: "5",
    functionalityStatus: "FullyFunctional",
    damageLevel: "Cosmetic_Damage",
    usageDuration: "4",
    priceFrom: "1500000",
    priceTo: "4000000",
    streetAddress: "18 Trần Duy Hưng",
    ward: "Phường Cầu Giấy",
    city: "Thành phố Hà Nội",
  },
  {
    key: "buy-aircon",
    label: "Thu mua máy lạnh Panasonic 1–1.5HP · 8 bộ",
    productName: "Cần mua máy lạnh Panasonic Inverter 1–1.5HP",
    description:
      "Thu mua 8 bộ máy lạnh Panasonic Inverter công suất 1–1.5HP, đủ dàn nóng và dàn lạnh, còn chạy êm, lạnh sâu. Bên mua tự tháo dỡ và vận chuyển, ưu tiên khu vực trung tâm thành phố.",
    categoryId: CATEGORY.electronics,
    productTypeId: "409c2839-191f-4f9d-ae8a-f57e137d0745",
    brandId: BRAND.panasonic,
    quantity: "8",
    functionalityStatus: "FullyFunctional",
    damageLevel: "Minor_Damage",
    usageDuration: "5",
    priceFrom: "2500000",
    priceTo: "6000000",
    streetAddress: "210 Hùng Vương",
    ward: "Phường Hải Châu",
    city: "Thành phố Đà Nẵng",
  },
  {
    key: "buy-tv",
    label: "Thu mua tivi Samsung 43–55 inch · 6 chiếc",
    productName: "Cần mua tivi Samsung Smart TV 43–55 inch",
    description:
      "Cần mua 6 tivi Samsung Smart TV 43–55 inch, màn hình không sọc, không điểm chết, còn remote. Nhận máy có vết trầy nhẹ ở viền. Ưu tiên đời 2020 trở lại đây.",
    categoryId: CATEGORY.electronics,
    productTypeId: "8e2a8837-a88d-49b3-9c4e-6732d47a8957",
    brandId: BRAND.samsung,
    quantity: "6",
    functionalityStatus: "FullyFunctional",
    damageLevel: "Cosmetic_Damage",
    usageDuration: "5",
    priceFrom: "2000000",
    priceTo: "6000000",
    streetAddress: "72 Đường 30 Tháng 4",
    ward: "Phường Ninh Kiều",
    city: "Thành phố Cần Thơ",
  },
  {
    key: "buy-office-chair",
    label: "Thu mua ghế công thái học · 20 chiếc",
    productName: "Cần mua ghế văn phòng công thái học",
    description:
      "Thu mua 20 ghế văn phòng công thái học cho văn phòng mới. Yêu cầu chỉnh được độ cao, ngả lưng, lưng lưới hoặc đệm còn tốt, không gãy chân hay tay vịn. Nhận nhiều thương hiệu.",
    categoryId: CATEGORY.furniture,
    productTypeId: "2f8b0696-f299-47d7-b2e5-abf7e219ec8e",
    brandId: "",
    quantity: "20",
    functionalityStatus: "FullyFunctional",
    damageLevel: "Cosmetic_Damage",
    usageDuration: "3",
    priceFrom: "500000",
    priceTo: "2500000",
    streetAddress: "88 Lê Lợi",
    ward: "Phường Bến Thành",
    city: "Thành phố Hồ Chí Minh",
  },
  {
    key: "buy-thermos",
    label: "Thu mua bình giữ nhiệt Lock&Lock · 100 chiếc",
    productName: "Cần mua bình giữ nhiệt Lock&Lock 500ml",
    description:
      "Thu mua số lượng lớn 100 bình giữ nhiệt Lock&Lock lõi inox 400–600ml, nắp còn kín, không móp méo. Dùng làm quà tặng cho chương trình tái sử dụng, ưu tiên còn hộp.",
    categoryId: CATEGORY.household,
    productTypeId: "b2257e74-c534-4b8a-b4d7-25629d714c82",
    brandId: BRAND.lockAndLock,
    quantity: "100",
    functionalityStatus: "FullyFunctional",
    damageLevel: "Cosmetic_Damage",
    usageDuration: "2",
    priceFrom: "30000",
    priceTo: "80000",
    streetAddress: "9 Võ Văn Ngân",
    ward: "Phường Thủ Đức",
    city: "Thành phố Hồ Chí Minh",
  },
];
