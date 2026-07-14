// src/mocks/homeData.ts
export const categories = [
  { id: "1", name: "Điện máy", icon: "tv-outline" },
  { id: "2", name: "Nội thất", icon: "bed-outline" },
  {
    id: "3",
    name: "Gia dụng",
    icon: "basket-outline", // Bạn có thể dùng 'basket-outline', 'cafe-outline' hoặc 'home-outline'
  },
];

export const buyingRequests = [
  {
    id: "1",
    title: "Thu mua tủ lạnh hư hỏng, xác điều hòa",
    company: "Cơ điện lạnh ABC",
    avatar:
      "https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=100&q=80",
    image: "https://picsum.photos/400/400?random=31", // LINK ẢNH SẢN PHẨM
    time: "1 ngày trước",
    priceRange: "500k - 2tr/cái",
    condition: "Cũ (dưới 1 tháng)", // ĐỘ MỚI
    collectionMethod: "Thu mua tận nơi", // TAG THU MUA
    location: "Quận 1, TP.HCM",
  },
  {
    id: "2",
    title: "Cần mua bàn ghế văn phòng thanh lý giá cao",
    company: "Nội thất Hòa Phát",
    avatar:
      "https://images.unsplash.com/photo-1497366216548-37526070297c?w=100&q=80",
    image: "https://picsum.photos/400/400?random=32",
    time: "5 giờ trước",
    priceRange: "Thỏa thuận",
    condition: "Sử dụng tốt",
    collectionMethod: "Tự đến lấy",
    location: "Bình Thạnh, TP.HCM",
  },
];

export const sellingPosts = [
  {
    id: "1",
    name: "Tủ lạnh Samsung Inverter 236L",
    price: "3.500.000 đ",
    image: "https://picsum.photos/400/400?random=11",
    location: "Đống Đa, Hà Nội",
    time: "3 giờ trước",
    condition: "Hoạt động tốt",
    sellerName: "Nguyễn Văn A",
    sellerAvatar: "https://randomuser.me/api/portraits/men/32.jpg",
  },
  {
    id: "2",
    name: "Sofa góc bọc da cao cấp màu xám nhạt",
    price: "2.100.000 đ",
    image: "https://picsum.photos/400/400?random=12",
    location: "Bình Thạnh, TP.HCM",
    time: "5 giờ trước",
    condition: "Hư nhẹ",
    sellerName: "Trần Thị B",
    sellerAvatar: "https://randomuser.me/api/portraits/women/44.jpg",
  },
];

export const suggestedProducts = [
  {
    id: "3",
    name: "Máy giặt LG 8kg cửa ngang chạy êm",
    price: "1.800.000 đ",
    image: "https://picsum.photos/400/400?random=13",
    location: "Quận 1, TP.HCM",
    time: "1 ngày trước",
    condition: "Hoạt động tốt",
    sellerName: "Lê Văn C",
    sellerAvatar: "https://randomuser.me/api/portraits/men/46.jpg",
  },
  {
    id: "4",
    name: "Bàn làm việc gỗ sồi nguyên khối chân sắt",
    price: "850.000 đ",
    image: "https://picsum.photos/400/400?random=14",
    location: "Quận 9, TP.HCM",
    time: "2 ngày trước",
    condition: "Hoạt động tốt",
    sellerName: "Phạm D",
    sellerAvatar: "https://randomuser.me/api/portraits/men/22.jpg",
  },
];
