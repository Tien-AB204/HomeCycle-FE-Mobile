import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";

type AppointmentFilter =
  | "all"
  | "inspection"
  | "collection"
  | "buyer"
  | "seller";

type AppointmentItem = {
  id: string;
  type: string;
  typeKey: "inspection" | "collection";
  role: string;
  roleKey: "buyer" | "seller";
  product: string;
  partner: string;
  date: string;
  rawDate: string; // Lưu ngày gốc để group Timeline
  location: string;
  status: string;
  statusColor: string;
  createdAt: string;
};

const appointmentApi = {
  getBuyerInspections: (params?: any) =>
    apiClient
      .get("/appointments/buyer/inspections", { params })
      .then((res) => res.data),
  getSellerInspections: (params?: any) =>
    apiClient
      .get("/appointments/seller/inspections", { params })
      .then((res) => res.data),
  getBuyerCollections: (params?: any) =>
    apiClient
      .get("/appointments/buyer/collections", { params })
      .then((res) => res.data),
  getSellerCollections: (params?: any) =>
    apiClient
      .get("/appointments/seller/collections", { params })
      .then((res) => res.data),
};

const WEEK_DAYS = ["CN", "Th 2", "Th 3", "Th 4", "Th 5", "Th 6", "Th 7"];

export default function ScheduleScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web" && width > 480;

  const { user } = useAuth();
  const currentUserId = user?.userId || user?.id;

  // Xác định Role Business (Sửa lại điều kiện string nếu Backend quy định khác)
  const isBusiness = user?.role?.toLowerCase() === "business";

  const [activeFilter, setActiveFilter] = useState<AppointmentFilter>("all");
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "N/A";
    return date.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatTimeOnly = (dateString: string) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "N/A";
    // Định dạng giờ giống thiết kế UI (VD: 10:00 AM)
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const translateAppointmentStatus = (
    status: number | string | null | undefined,
  ) => {
    const s = String(status);
    switch (s) {
      case "0":
        return "Chờ xác nhận";
      case "1":
        return "Đã xác nhận";
      case "2":
        return "Đã hoàn thành";
      case "3":
        return "Đã hủy";
      case "4":
        return "Bỏ lỡ";
      default:
        return "Chờ xác nhận";
    }
  };

  const getStatusColor = (status: number | string) => {
    const s = String(status);
    if (s === "2") return "#10B981"; // Xanh lá
    if (s === "3" || s === "4") return "#EF4444"; // Đỏ
    if (s === "1") return "#3B82F6"; // Xanh dương
    return "#F59E0B"; // Cam/Vàng (Pending)
  };

  const fetchAppointments = useCallback(
    async (isRefresh = false) => {
      if (!currentUserId) {
        setAppointments([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      try {
        if (!isRefresh) setIsLoading(true);

        const queryParams = { PageSize: 50, PageNumber: 1 };
        const [bInspRes, sInspRes, bCollRes, sCollRes] =
          await Promise.allSettled([
            appointmentApi.getBuyerInspections(queryParams),
            appointmentApi.getSellerInspections(queryParams),
            appointmentApi.getBuyerCollections(queryParams),
            appointmentApi.getSellerCollections(queryParams),
          ]);

        let allRaw: AppointmentItem[] = [];

        const processData = (
          res: any,
          type: string,
          typeKey: "inspection" | "collection",
          role: string,
          roleKey: "buyer" | "seller",
        ) => {
          if (res.status === "fulfilled") {
            const items =
              res.value?.items ||
              res.value?.data?.items ||
              res.value?.data ||
              [];
            const mapped = items.map((a: any) => {
              const rawDate =
                a.collectionDate || a.inspectionDate || a.createdAt;
              const address =
                a.pickupAddress ||
                a.deliveryAddress ||
                "Chưa cập nhật địa điểm";

              return {
                id: String(a.appointmentId || a.id || ""),
                type: type,
                typeKey: typeKey,
                role: role,
                roleKey: roleKey,
                product: String(a.productName || "Sản phẩm giao dịch"),
                partner: String(a.counterpartyName || "Đối tác"),
                date: formatDateTime(rawDate),
                rawDate: rawDate,
                location: String(address),
                status: translateAppointmentStatus(
                  a.appointmentStatus ?? a.status,
                ),
                statusColor: getStatusColor(a.appointmentStatus ?? a.status),
                createdAt: String(a.createdAt || new Date().toISOString()),
              };
            });
            allRaw = [...allRaw, ...mapped];
          }
        };

        processData(
          bInspRes,
          "Lịch kiểm định",
          "inspection",
          "Đơn mua",
          "buyer",
        );
        processData(
          sInspRes,
          "Lịch kiểm định",
          "inspection",
          "Đơn bán",
          "seller",
        );
        processData(bCollRes, "Lịch thu gom", "collection", "Đơn mua", "buyer");
        processData(
          sCollRes,
          "Lịch thu gom",
          "collection",
          "Đơn bán",
          "seller",
        );

        const uniqueAppointments = Array.from(
          new Map(allRaw.map((item) => [item.id, item])).values(),
        );

        uniqueAppointments.sort(
          (a, b) =>
            new Date(a.rawDate).getTime() - new Date(b.rawDate).getTime(),
        );
        setAppointments(uniqueAppointments);
      } catch (error) {
        console.error("Lỗi tải lịch hẹn:", error);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [currentUserId],
  );

  useFocusEffect(
    useCallback(() => {
      void fetchAppointments(false);
    }, [fetchAppointments]),
  );

  const onRefresh = () => {
    setIsRefreshing(true);
    void fetchAppointments(true);
  };

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View
          style={[styles.mobileWrapper, isWeb ? styles.webWrapper : undefined]}
        >
          <MainHeader title="Quản lý Lịch hẹn" />
          <View style={styles.unauthContainer}>
            <Ionicons
              name="calendar-outline"
              size={80}
              color="#CBD5E1"
              style={styles.unauthIcon}
            />
            <Text style={styles.unauthTitle}>Bạn chưa đăng nhập</Text>
            <Text style={styles.unauthDesc}>
              Vui lòng đăng nhập để theo dõi và quản lý các lịch hẹn kiểm định,
              thu gom của bạn.
            </Text>
            <TouchableOpacity
              style={styles.loginBtn}
              onPress={() =>
                router.push({
                  pathname: "/(auth)/login",
                  params: { returnUrl: "/(tabs)/appointments" },
                })
              }
            >
              <Text style={styles.loginBtnText}>Đăng nhập ngay</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  // Lọc dữ liệu chung
  const filteredAppointments = appointments.filter((s) => {
    if (activeFilter === "inspection") return s.typeKey === "inspection";
    if (activeFilter === "collection") return s.typeKey === "collection";
    if (activeFilter === "buyer") return s.roleKey === "buyer";
    if (activeFilter === "seller") return s.roleKey === "seller";
    return true;
  });

  // --- RENDER DÀNH CHO ROLE BUSINESS (TIMELINE AGENDA) ---
  const renderBusinessTimeline = () => {
    if (filteredAppointments.length === 0) {
      return (
        <Text style={styles.emptyText}>Chưa có lịch hẹn nào sắp tới.</Text>
      );
    }

    // Nhóm lịch hẹn theo ngày
    const groupedData = filteredAppointments.reduce(
      (acc, appt) => {
        const d = new Date(appt.rawDate);
        if (isNaN(d.getTime())) return acc;
        // Key format: YYYY-MM-DD
        const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(appt);
        return acc;
      },
      {} as Record<string, AppointmentItem[]>,
    );

    const sortedDates = Object.keys(groupedData).sort();

    return (
      <View style={styles.agendaContainer}>
        {/* Header Tháng */}
        <View style={styles.agendaMonthHeader}>
          <Ionicons name="chevron-back" size={20} color={COLORS.text} />
          <Text style={styles.agendaMonthText}>
            THÁNG {new Date().getMonth() + 1} {new Date().getFullYear()}
          </Text>
          <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 40 }}
        >
          {sortedDates.map((dateKey) => {
            const events = groupedData[dateKey];
            const d = new Date(dateKey);
            const dayNum = d.getDate();
            const dayName = WEEK_DAYS[d.getDay()];

            return (
              <View key={dateKey} style={styles.timelineRow}>
                {/* Trục ngày tháng */}
                <View style={styles.timelineLeft}>
                  <Text style={styles.timelineDayNum}>{dayNum}</Text>
                  <Text style={styles.timelineDayName}>{dayName}</Text>
                </View>

                {/* Trục kẻ sọc dọc */}
                <View style={styles.timelineCenter}>
                  <View style={styles.timelineLine} />
                  <View style={styles.timelineDot} />
                </View>

                {/* Các block sự kiện */}
                <View style={styles.timelineRight}>
                  {events.map((event) => (
                    <TouchableOpacity
                      key={event.id}
                      style={[
                        styles.agendaCard,
                        { backgroundColor: event.statusColor },
                      ]}
                      activeOpacity={0.8}
                      onPress={() =>
                        router.push(`/appointments/${event.id}` as any)
                      }
                    >
                      <View style={styles.agendaCardTop}>
                        <Text style={styles.agendaCardTitle} numberOfLines={1}>
                          {event.type}
                        </Text>
                        <Text style={styles.agendaCardTime}>
                          {formatTimeOnly(event.rawDate)}
                        </Text>
                      </View>
                      <Text style={styles.agendaCardSub} numberOfLines={1}>
                        {event.partner} - {event.product}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      </View>
    );
  };

  // --- RENDER DÀNH CHO ROLE BÌNH THƯỜNG (MUA/BÁN) ---
  const renderNormalList = () => (
    <>
      <View style={styles.filterBarWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterContainer}
        >
          {[
            { key: "all", label: "Tất cả" },
            { key: "inspection", label: "Kiểm định" },
            { key: "collection", label: "Thu gom" },
            { key: "buyer", label: "Đơn mua" },
            { key: "seller", label: "Đơn bán" },
          ].map((filter) => (
            <TouchableOpacity
              key={filter.key}
              style={[
                styles.filterChip,
                activeFilter === filter.key && styles.filterChipActive,
              ]}
              onPress={() => setActiveFilter(filter.key as AppointmentFilter)}
            >
              <Text
                style={[
                  styles.filterChipText,
                  activeFilter === filter.key && styles.filterChipTextActive,
                ]}
              >
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={onRefresh}
            colors={[COLORS.primary]}
          />
        }
      >
        {filteredAppointments.length > 0 ? (
          filteredAppointments.map((item) => (
            <View key={item.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.type}</Text>
                </View>
                <Text style={[styles.status, { color: item.statusColor }]}>
                  {item.status}
                </Text>
              </View>

              <Text style={styles.productName}>{item.product}</Text>
              <Text style={styles.partnerName}>
                {item.role}:{" "}
                <Text style={{ fontWeight: "bold", color: COLORS.text }}>
                  {item.partner}
                </Text>
              </Text>

              <View style={styles.infoRow}>
                <Text style={styles.infoText}>{item.date}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoText} numberOfLines={2}>
                  {item.location}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => {
                    router.push(`/appointments/${item.id}` as any);
                  }}
                >
                  <Text style={styles.primaryBtnText}>Chi tiết lịch hẹn</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        ) : (
          <Text style={styles.emptyText}>Chưa có lịch hẹn nào.</Text>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View
        style={[styles.mobileWrapper, isWeb ? styles.webWrapper : undefined]}
      >
        <MainHeader title="Quản lý Lịch hẹn" />

        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={COLORS.primary} />
            <Text style={styles.loadingText}>Đang tải lịch hẹn...</Text>
          </View>
        ) : isBusiness ? (
          renderBusinessTimeline()
        ) : (
          renderNormalList()
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.border },
  mobileWrapper: { flex: 1, backgroundColor: "#F1F5F9" },
  webWrapper: { width: 480, alignSelf: "center" },

  unauthContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: COLORS.white,
  },
  unauthIcon: { marginBottom: 16 },
  unauthTitle: {
    marginBottom: 12,
    color: COLORS.text,
    fontSize: 20,
    fontWeight: "bold",
  },
  unauthDesc: {
    marginBottom: 32,
    color: COLORS.textLight,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
  },
  loginBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  loginBtnText: { color: COLORS.white, fontSize: 16, fontWeight: "bold" },

  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: COLORS.textLight, fontSize: 13 },
  emptyText: {
    marginTop: 40,
    color: COLORS.textLight,
    fontSize: 14,
    textAlign: "center",
  },

  // --- STYLES DÀNH CHO ROLE BUSINESS (TIMELINE) ---
  agendaContainer: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  agendaMonthHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderColor: "#E2E8F0",
    marginBottom: 8,
  },
  agendaMonthText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#0F172A",
    letterSpacing: 0.5,
  },
  timelineRow: {
    flexDirection: "row",
    minHeight: 80,
  },
  timelineLeft: {
    width: 60,
    alignItems: "center",
    paddingTop: 12,
  },
  timelineDayNum: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#0F172A",
  },
  timelineDayName: {
    fontSize: 12,
    color: "#64748B",
    marginTop: 2,
    fontWeight: "500",
  },
  timelineCenter: {
    width: 24,
    alignItems: "center",
  },
  timelineLine: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 1.5,
    backgroundColor: "#E2E8F0",
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    marginTop: 22,
    zIndex: 1,
  },
  timelineRight: {
    flex: 1,
    paddingRight: 16,
    paddingBottom: 20,
    paddingTop: 12,
  },
  agendaCard: {
    padding: 14,
    borderRadius: 6,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  agendaCardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  agendaCardTitle: {
    color: COLORS.white,
    fontWeight: "bold",
    fontSize: 14,
    flex: 1,
    paddingRight: 8,
  },
  agendaCardTime: {
    color: COLORS.white,
    fontSize: 11,
    fontWeight: "bold",
  },
  agendaCardSub: {
    color: COLORS.white,
    fontSize: 13,
    opacity: 0.9,
  },

  // --- STYLES DÀNH CHO ROLE USER THƯỜNG ---
  filterBarWrapper: {
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: "#E2E8F0",
  },
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    alignItems: "center",
  },
  filterChip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    borderWidth: 1,
    borderColor: "#CBD5E1",
  },
  filterChipActive: {
    backgroundColor: "#0F172A",
    borderColor: "#0F172A",
  },
  filterChipText: { fontSize: 13, color: "#475569", fontWeight: "600" },
  filterChipTextActive: { color: "#FFF" },

  list: { padding: 16, gap: 16 },
  card: {
    backgroundColor: "#FFF",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  badge: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { color: "#0284C7", fontSize: 12, fontWeight: "bold" },
  status: { fontSize: 13, fontWeight: "bold" },
  productName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 6,
  },
  partnerName: { fontSize: 14, color: "#475569", marginBottom: 12 },
  infoRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  infoText: { fontSize: 13, color: "#475569", flex: 1, lineHeight: 20 },
  divider: { height: 1, marginVertical: 12, backgroundColor: "#F1F5F9" },
  cardFooter: { flexDirection: "row", marginTop: 4 },
  primaryBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: "#334155",
  },
  primaryBtnText: { color: COLORS.white, fontSize: 14, fontWeight: "bold" },
});
