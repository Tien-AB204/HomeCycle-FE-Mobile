import { useRouter } from "expo-router";
import React from "react";
import { SafeAreaView, ScrollView, StyleSheet, Text, View } from "react-native";
import Header from "../src/components/shared/Header";
import { COLORS } from "../src/constants/theme";

export default function PolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea}>
      <Header title="Quy định & Chính sách" showBack={true} />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <Text style={styles.mainTitle}>
          Quy định & Chính sách Nền tảng HomeCycle
        </Text>
        <Text style={styles.introText}>
          Chào mừng bạn đến với HomeCycle - Nền tảng kết nối giao dịch và thu
          mua đồ gia dụng cũ uy tín. Để đảm bảo môi trường giao dịch an toàn,
          minh bạch và công bằng cho tất cả người dùng, vui lòng đọc kỹ và tuân
          thủ các quy định dưới đây.
        </Text>

        {/* SECTION 1 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            1. Quy định về Tài khoản và Xác thực danh tính
          </Text>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Thông tin chính chủ: </Text>
              Người dùng (Cá nhân/Doanh nghiệp) phải cung cấp thông tin chính
              xác. Tên chủ tài khoản ngân hàng bắt buộc phải trùng khớp với họ
              tên trên Căn cước công dân (CCCD) hoặc Giấy phép kinh doanh (đối
              với Doanh nghiệp) để phòng chống gian lận và rửa tiền.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Bảo mật thông tin: </Text>
              Hệ thống không bắt buộc hiển thị địa chỉ chi tiết (số nhà, tên
              đường) công khai để bảo vệ quyền riêng tư cá nhân. Số CCCD/CMND và
              Số tài khoản ngân hàng sẽ được mã hóa và ẩn bớt các ký tự (ví dụ:
              001202******).
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Tài khoản Doanh nghiệp: </Text>
              Yêu cầu cung cấp đầy đủ và chính xác Giấy phép kinh doanh, CCCD
              người đại diện pháp luật. Mọi thay đổi về thông tin pháp lý đều
              phải thông qua sự xét duyệt của Ban quản trị (Moderator).
            </Text>
          </View>
        </View>

        {/* SECTION 2 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            2. Quy định Đăng tin và Hàng hóa
          </Text>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Tính trung thực: </Text>
              Hình ảnh sản phẩm (từ 2-5 ảnh) phải là ảnh tự chụp thực tế. Tình
              trạng hàng hóa, mức độ hư hại và thời gian sử dụng phải được khai
              báo trung thực đúng với thực tế.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Kiểm duyệt nội dung: </Text>
              Bài đăng vi phạm tiêu chuẩn cộng đồng, chứa nội dung phản cảm, sai
              sự thật hoặc hàng hóa cấm giao dịch sẽ bị gỡ bỏ mà không cần báo
              trước.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Đóng bài tự động: </Text>
              Hệ thống sẽ tự động đóng bài đăng nếu số lượng hàng tồn kho bằng 0
              sau khi hoàn tất giao dịch.
            </Text>
          </View>
        </View>

        {/* SECTION 3 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            3. Quy định Thương lượng và Lịch hẹn
          </Text>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Tạo lịch hẹn: </Text>
              Khi giao dịch được xác nhận, hệ thống sẽ tạo Lịch kiểm định hoặc
              Lịch thu gom. Hai bên có trách nhiệm tuân thủ thời gian và địa
              điểm đã chốt.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Thay đổi lịch hẹn: </Text>
              Việc thay đổi thời gian/địa điểm phải được thực hiện trước ít nhất
              24 giờ và phải được sự đồng ý của đối tác. Nếu một bên từ chối,
              lịch cũ được giữ nguyên.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Hủy lịch hẹn: </Text>
              Cho phép hủy lịch trước ít nhất 12 giờ. Hủy lịch sát giờ có thể bị
              ghi nhận vi phạm và trừ Điểm uy tín.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>
                Quá hạn lịch hẹn (&quot;Bùng&quot; hẹn):{" "}
              </Text>
              Nếu quá thời gian hẹn 2 tiếng mà không có bên nào tương tác xác
              nhận trên hệ thống, lịch hẹn sẽ tự động chuyển sang trạng thái
              &quot;Quá hạn&quot; (Expired) và đóng băng giao dịch để chờ xử lý.
            </Text>
          </View>
        </View>

        {/* SECTION 4 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            4. Chính sách Vận chuyển (Giao Hàng Nhanh - GHN)
          </Text>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Khóa địa chỉ: </Text>
              Đối với các giao dịch chọn đơn vị vận chuyển GHN, hệ thống sẽ khóa
              hoàn toàn địa chỉ lấy hàng và địa chỉ giao hàng sau khi chốt đơn.
              Không hỗ trợ đổi địa chỉ để đảm bảo tính phí ship và tạo mã vận
              đơn chính xác.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              Nếu bắt buộc phải đổi địa chỉ, hai bên vui lòng tiến hành Hủy giao
              dịch hiện tại và thiết lập một giao dịch mới.
            </Text>
          </View>
        </View>

        {/* SECTION 5 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            5. Chính sách Thanh toán và Rút tiền
          </Text>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Giữ tiền đảm bảo (Escrow): </Text>
              Số tiền giao dịch sẽ được hệ thống HomeCycle tạm giữ để bảo vệ cả
              hai bên.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Thời gian giải ngân: </Text>
              Tiền sẽ được cộng vào Số dư khả dụng của Người bán sau 3 ngày (72
              giờ) kể từ khi đơn hàng chuyển sang trạng thái &quot;Thành công&quot;, với
              điều kiện không có khiếu nại/tranh chấp phát sinh.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Hạn mức rút tiền: </Text>
              Tối thiểu 100.000 VNĐ/lần. Tối đa 50.000.000 VNĐ/lần. Số lần rút
              tối đa: 3 lần/ngày.
            </Text>
          </View>
        </View>

        {/* SECTION 6 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            6. Hệ thống Điểm uy tín và Đánh giá
          </Text>
          <Text style={styles.paragraph}>
            Mỗi tài khoản khởi đầu với 100 Điểm uy tín. Điểm số sẽ thay đổi dựa
            trên các đánh giá sau giao dịch:
          </Text>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Đánh giá Tốt (4-5★): </Text>
              Khách hàng hài lòng, cộng thêm +2 điểm.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Đánh giá Trung bình (3★): </Text>
              Có thiếu sót nhỏ, không cộng/trừ điểm.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Đánh giá Kém (1-2★): </Text>
              Vi phạm cam kết, trừ từ -1 đến -5 điểm.
            </Text>
          </View>

          <Text
            style={[styles.paragraph, { marginTop: 12, fontWeight: "bold" }]}
          >
            Hình phạt dựa trên Điểm uy tín:
          </Text>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Dưới 60 điểm: </Text>
              Tài khoản bị Cảnh cáo. Giới hạn số lượng bài đăng bán / số lượng
              gửi báo giá. Thời gian giữ tiền giải ngân tăng từ 72 giờ lên 120
              giờ.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Dưới 20 điểm: </Text>
              Vi phạm nghiêm trọng. Tài khoản bị Khóa tự động, tước quyền đăng
              bài, gửi báo giá và đóng băng lệnh rút tiền. Cần quản trị viên xét
              duyệt thủ công.
            </Text>
          </View>
        </View>

        {/* SECTION 7 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            7. Chính sách Khiếu nại và Tranh chấp
          </Text>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Phát sinh tranh chấp: </Text>
              Người dùng có quyền gửi khiếu nại (kèm 3-5 ảnh bằng chứng rõ ràng)
              khi đối tác: Không đến điểm hẹn, không bàn giao hàng, hàng hóa
              khác xa mô tả, hoặc có hành vi gian lận.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Khiếu nại đánh giá: </Text>
              Nếu nhận thấy đánh giá có nội dung công kích cá nhân, sai sự thật
              hoặc quấy rối, bạn có thể gửi yêu cầu khiếu nại đánh giá để Kiểm
              duyệt viên (Moderator) xem xét ẩn/xóa.
            </Text>
          </View>
          <View style={styles.bulletItem}>
            <Text style={styles.bulletDot}>•</Text>
            <Text style={styles.bulletText}>
              <Text style={styles.boldText}>Quyết định cuối cùng: </Text>
              Ban quản trị HomeCycle sẽ dựa trên bằng chứng, lịch sử trò chuyện
              và form kiểm định để đưa ra quyết định xử lý: Giữ nguyên, Hủy giao
              dịch, Hoàn tiền cho Người mua hoặc Giải ngân cho Người bán. Quyết
              định của HomeCycle là quyết định cuối cùng.
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Cập nhật lần cuối: Tháng 08/2026
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    backgroundColor: COLORS.white,
  },
  mainTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: COLORS.primary,
    marginBottom: 16,
    textAlign: "center",
  },
  introText: {
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.text,
    marginBottom: 24,
    textAlign: "justify",
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 12,
    backgroundColor: "#F8F9FA",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    overflow: "hidden",
  },
  paragraph: {
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.text,
    marginBottom: 8,
  },
  bulletItem: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
    paddingRight: 10,
  },
  bulletDot: {
    fontSize: 18,
    color: COLORS.primary,
    marginRight: 8,
    lineHeight: 24,
  },
  bulletText: {
    flex: 1,
    fontSize: 15,
    lineHeight: 24,
    color: COLORS.text,
  },
  boldText: {
    fontWeight: "bold",
    color: COLORS.text,
  },
  footer: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    alignItems: "center",
  },
  footerText: {
    fontSize: 14,
    color: COLORS.textLight,
    fontStyle: "italic",
  },
});
