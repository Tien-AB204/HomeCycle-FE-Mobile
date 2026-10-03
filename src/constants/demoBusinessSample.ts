// Dữ liệu mẫu cho form đăng ký doanh nghiệp / hộ kinh doanh khi demo.
// Toàn bộ là dữ liệu giả lập (tên, mã số thuế, CCCD, số tài khoản không thuộc về ai).
// Tỉnh/thành và phường/xã khớp danh sách 34 tỉnh mà AddressPickerField dùng;
// mã ngân hàng là BIN theo danh sách VietQR mà BankPickerField dùng. Ảnh giấy tờ vẫn do người dùng tải lên.
type DemoAddress = {
  street: string;
  ward: string;
  city: string;
};

export type DemoBusinessSample = {
  key: string;
  label: string;
  model: "household" | "enterprise";
  businessName: string;
  businessDescription: string;
  taxCode: string;
  businessAddress: DemoAddress;
  operatingScope: string;
  warehouseAddress: DemoAddress | null;
  fullName: string;
  identityNumber: string;
  identityDob: string;
  identityAddress: DemoAddress;
  bankCode: string;
  bankName: string;
  accountNumber: string;
};

export const formatDemoAddress = (address: DemoAddress) =>
  [address.street, address.ward, address.city].join(", ");

const HCM = "Thành phố Hồ Chí Minh";
const HANOI = "Thành phố Hà Nội";
const DANANG = "Thành phố Đà Nẵng";
const CANTHO = "Thành phố Cần Thơ";
const HAIPHONG = "Thành phố Hải Phòng";

export const DEMO_BUSINESS_SAMPLES: DemoBusinessSample[] = [
  {
    key: "household-binh-thanh",
    label: "Hộ KD Đồ Cũ Minh Phát · TP.HCM",
    model: "household",
    businessName: "Hộ kinh doanh Đồ Cũ Minh Phát",
    businessDescription: "Thu mua và thanh lý đồ điện máy, đồ gia dụng đã qua sử dụng tại khu vực Bình Thạnh.",
    taxCode: "8123456701",
    businessAddress: { street: "125 Xô Viết Nghệ Tĩnh", ward: "Phường Bình Thạnh", city: HCM },
    operatingScope: "Khu vực miền Nam",
    warehouseAddress: null,
    fullName: "Nguyễn Văn Minh",
    identityNumber: "079088012345",
    identityDob: "1988-04-12",
    identityAddress: { street: "45 Nguyễn Xí", ward: "Phường Bình Thạnh", city: HCM },
    bankCode: "970436",
    bankName: "Vietcombank",
    accountNumber: "1023456789",
  },
  {
    key: "enterprise-sai-gon-xanh",
    label: "Cty TNHH Điện Máy Sài Gòn Xanh · TP.HCM",
    model: "enterprise",
    businessName: "Công ty TNHH Thu Mua Điện Máy Sài Gòn Xanh",
    businessDescription: "Thu mua điện máy cũ số lượng lớn, kiểm định, sửa chữa và phân phối lại cho các cửa hàng đồ cũ.",
    taxCode: "0318765432",
    businessAddress: { street: "88 Lê Lợi", ward: "Phường Bến Thành", city: HCM },
    operatingScope: "Toàn quốc",
    warehouseAddress: { street: "Lô B12 Đường Số 3", ward: "Xã Bình Chánh", city: HCM },
    fullName: "Trần Thị Thu Hà",
    identityNumber: "079185023456",
    identityDob: "1985-09-23",
    identityAddress: { street: "12 Đinh Tiên Hoàng", ward: "Phường Tân Định", city: HCM },
    bankCode: "970407",
    bankName: "Techcombank",
    accountNumber: "19034567890123",
  },
  {
    key: "household-long-bien",
    label: "Hộ KD Nội Thất Cũ Thanh Tâm · Hà Nội",
    model: "household",
    businessName: "Hộ kinh doanh Nội Thất Cũ Thanh Tâm",
    businessDescription: "Mua bán bàn ghế, tủ, giường và nội thất văn phòng đã qua sử dụng.",
    taxCode: "8012345678",
    businessAddress: { street: "56 Nguyễn Văn Cừ", ward: "Phường Long Biên", city: HANOI },
    operatingScope: "Khu vực miền Bắc",
    warehouseAddress: null,
    fullName: "Lê Thanh Tâm",
    identityNumber: "001090034567",
    identityDob: "1990-02-05",
    identityAddress: { street: "23 Ngọc Lâm", ward: "Phường Long Biên", city: HANOI },
    bankCode: "970422",
    bankName: "MBBank",
    accountNumber: "0901234567890",
  },
  {
    key: "enterprise-ha-thanh",
    label: "Cty CP Tái Chế Gia Dụng Hà Thành · Hà Nội",
    model: "enterprise",
    businessName: "Công ty Cổ phần Tái Chế Gia Dụng Hà Thành",
    businessDescription: "Thu gom, phân loại và tái chế đồ gia dụng, điện máy cũ cho các hộ gia đình và văn phòng.",
    taxCode: "0109876543",
    businessAddress: { street: "18 Trần Duy Hưng", ward: "Phường Cầu Giấy", city: HANOI },
    operatingScope: "Khu vực miền Bắc",
    warehouseAddress: { street: "Kho số 5 Đường Cổ Bi", ward: "Xã Gia Lâm", city: HANOI },
    fullName: "Phạm Quốc Bảo",
    identityNumber: "001082045678",
    identityDob: "1982-11-30",
    identityAddress: { street: "7 Thái Hà", ward: "Phường Đống Đa", city: HANOI },
    bankCode: "970418",
    bankName: "BIDV",
    accountNumber: "21510001234567",
  },
  {
    key: "household-hai-chau",
    label: "Hộ KD Điện Lạnh Cũ Hải Châu · Đà Nẵng",
    model: "household",
    businessName: "Hộ kinh doanh Điện Lạnh Cũ Hải Châu",
    businessDescription: "Thu mua, vệ sinh và bán lại máy lạnh, tủ lạnh, máy giặt cũ.",
    taxCode: "8045678912",
    businessAddress: { street: "210 Hùng Vương", ward: "Phường Hải Châu", city: DANANG },
    operatingScope: "Khu vực miền Trung",
    warehouseAddress: null,
    fullName: "Võ Văn Hùng",
    identityNumber: "048087056789",
    identityDob: "1987-07-17",
    identityAddress: { street: "41 Ông Ích Khiêm", ward: "Phường Hải Châu", city: DANANG },
    bankCode: "970415",
    bankName: "VietinBank",
    accountNumber: "101876543210",
  },
  {
    key: "enterprise-mien-trung",
    label: "Cty TNHH Đồ Cũ Miền Trung Xanh · Đà Nẵng",
    model: "enterprise",
    businessName: "Công ty TNHH Đồ Cũ Miền Trung Xanh",
    businessDescription: "Thu mua đồ cũ từ hộ gia đình, khách sạn và văn phòng tại các tỉnh miền Trung.",
    taxCode: "0402345678",
    businessAddress: { street: "35 Nguyễn Văn Linh", ward: "Phường Thanh Khê", city: DANANG },
    operatingScope: "Khu vực miền Trung",
    warehouseAddress: { street: "Lô 7 Đường Hồ Quý Ly", ward: "Phường Liên Chiểu", city: DANANG },
    fullName: "Nguyễn Thị Mai Anh",
    identityNumber: "048192067890",
    identityDob: "1992-03-08",
    identityAddress: { street: "16 Hoàng Sa", ward: "Phường Sơn Trà", city: DANANG },
    bankCode: "970416",
    bankName: "ACB",
    accountNumber: "23456789",
  },
  {
    key: "household-ninh-kieu",
    label: "Hộ KD Đồ Gia Dụng Cũ Ninh Kiều · Cần Thơ",
    model: "household",
    businessName: "Hộ kinh doanh Đồ Gia Dụng Cũ Ninh Kiều",
    businessDescription: "Mua bán đồ gia dụng, đồ bếp và thiết bị điện gia đình đã qua sử dụng.",
    taxCode: "8067891234",
    businessAddress: { street: "72 Đường 30 Tháng 4", ward: "Phường Ninh Kiều", city: CANTHO },
    operatingScope: "Khu vực miền Nam",
    warehouseAddress: null,
    fullName: "Trương Văn Lợi",
    identityNumber: "092085078901",
    identityDob: "1985-12-01",
    identityAddress: { street: "15 Trần Hưng Đạo", ward: "Phường Cái Khế", city: CANTHO },
    bankCode: "970405",
    bankName: "Agribank",
    accountNumber: "7300205123456",
  },
  {
    key: "enterprise-cang-bien",
    label: "Cty TNHH Thiết Bị Cũ Cảng Biển · Hải Phòng",
    model: "enterprise",
    businessName: "Công ty TNHH Thu Mua Thiết Bị Cũ Cảng Biển",
    businessDescription: "Thu mua thiết bị điện máy, nội thất văn phòng cũ số lượng lớn và xuất đi các tỉnh.",
    taxCode: "0201234567",
    businessAddress: { street: "15 Lạch Tray", ward: "Phường Lê Chân", city: HAIPHONG },
    operatingScope: "Toàn quốc",
    warehouseAddress: { street: "Kho 3 Đường Hà Nội", ward: "Phường Hồng Bàng", city: HAIPHONG },
    fullName: "Đỗ Minh Khang",
    identityNumber: "031080089012",
    identityDob: "1980-06-15",
    identityAddress: { street: "28 Lê Lợi", ward: "Phường Ngô Quyền", city: HAIPHONG },
    bankCode: "970432",
    bankName: "VPBank",
    accountNumber: "123456789",
  },
  {
    key: "household-thu-duc",
    label: "Hộ KD Tủ Lạnh Máy Giặt Cũ Thủ Đức · TP.HCM",
    model: "household",
    businessName: "Hộ kinh doanh Tủ Lạnh Máy Giặt Cũ Thủ Đức",
    businessDescription: "Chuyên thu mua tủ lạnh, máy giặt cũ của sinh viên và hộ gia đình khu vực Thủ Đức.",
    taxCode: "8089012345",
    businessAddress: { street: "9 Võ Văn Ngân", ward: "Phường Thủ Đức", city: HCM },
    operatingScope: "",
    warehouseAddress: null,
    fullName: "Huỳnh Thị Ngọc Hân",
    identityNumber: "079195090123",
    identityDob: "1995-10-20",
    identityAddress: { street: "34 Đường Số 8", ward: "Phường Linh Xuân", city: HCM },
    bankCode: "970423",
    bankName: "TPBank",
    accountNumber: "03812345601",
  },
  {
    key: "enterprise-vong-doi-xanh",
    label: "Cty CP Vòng Đời Xanh · TP.HCM",
    model: "enterprise",
    businessName: "Công ty Cổ phần Vòng Đời Xanh",
    businessDescription: "Nền tảng thu mua, tân trang và bán lại đồ điện máy, nội thất cũ theo mô hình kinh tế tuần hoàn.",
    taxCode: "0317654321",
    businessAddress: { street: "201 Nguyễn Văn Trỗi", ward: "Phường Phú Nhuận", city: HCM },
    operatingScope: "Toàn quốc",
    warehouseAddress: { street: "Kho C2, 120 Quốc Lộ 1A", ward: "Phường Linh Xuân", city: HCM },
    fullName: "Bùi Hoàng Long",
    identityNumber: "079083101234",
    identityDob: "1983-01-25",
    identityAddress: { street: "56 Phan Đăng Lưu", ward: "Phường Gò Vấp", city: HCM },
    bankCode: "970403",
    bankName: "Sacombank",
    accountNumber: "060123456789",
  },
];
