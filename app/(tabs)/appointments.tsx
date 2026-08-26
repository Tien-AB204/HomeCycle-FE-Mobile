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

type AppointmentTab = "inspection" | "collection";
type AppointmentRoleFilter = "all" | "buyer" | "seller";

type AppointmentItem = {
  id: string;
  type: string;
  typeKey: AppointmentTab;
  role: string;
  roleKey: "buyer" | "seller";
  product: string;
  partner: string;
  date: string;
  rawDate: string;
  inspectionAddress: string;
  pickupAddress: string;
  deliveryAddress: string;
  deliveryMethod: string;
  buyerCheckedIn: boolean;
  sellerCheckedIn: boolean;
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

const translateDeliveryMethod = (value: unknown) => {
  switch (String(value || "").toLowerCase()) {
    case "ghndelivery":
    case "1":
      return "Giao hàng GHN";
    case "sellerdelivers":
    case "2":
      return "Bên bán tự giao";
    case "buyerpickup":
    case "3":
      return "Bên mua tự lấy";
    default:
      return "Chưa cập nhật";
  }
};

export default function ScheduleScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web" && width > 480;

  const { user } = useAuth();
  const currentUserId = user?.userId || user?.id;
  const isBusiness = user?.role?.toLowerCase() === "business";

  const [activeTab, setActiveTab] = useState<AppointmentTab>("inspection");
  const [roleFilter, setRoleFilter] =
    useState<AppointmentRoleFilter>("all");
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "Chưa cập nhật";
    const date = new Date(dateString);
    if (Number.isNaN(date.getTime())) return "Chưa cập nhật";
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
    return date.toLocaleTimeString("vi-VN", {
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
    if (s === "2") return "#2F765D";
    if (s === "3" || s === "4") return "#7A1012";
    if (s === "1") return "#2B5659";
    return "#9A6418";
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
          typeKey: AppointmentTab,
          role: string,
          roleKey: "buyer" | "seller",
        ) => {
          if (res.status !== "fulfilled") return;

          const items =
            res.value?.items ||
            res.value?.data?.items ||
            res.value?.data ||
            [];

          const mapped = items.map((a: any) => {
            const rawDate =
              a.collectionDate || a.inspectionDate || a.createdAt || "";

            return {
              id: String(a.appointmentId || a.id || ""),
              type,
              typeKey,
              role,
              roleKey,
              product: String(a.productName || "Sản phẩm giao dịch"),
              partner: String(a.counterpartyName || "Đối tác"),
              date: formatDateTime(rawDate),
              rawDate,
              inspectionAddress: String(a.inspectionAddress || ""),
              pickupAddress: String(a.pickupAddress || ""),
              deliveryAddress: String(a.deliveryAddress || ""),
              deliveryMethod: translateDeliveryMethod(a.deliveryMethod),
              buyerCheckedIn: Boolean(a.buyerCheckedIn || a.buyerCheckAt),
              sellerCheckedIn: Boolean(a.sellerCheckedIn || a.sellerCheckAt),
              status: translateAppointmentStatus(
                a.appointmentStatus ?? a.status,
              ),
              statusColor: getStatusColor(a.appointmentStatus ?? a.status),
              createdAt: String(a.createdAt || ""),
            };
          });

          allRaw = [...allRaw, ...mapped];
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
        processData(
          bCollRes,
          "Lịch thu gom",
          "collection",
          "Đơn mua",
          "buyer",
        );
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
              color={COLORS.border}
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

  const filteredAppointments = appointments.filter((item) => {
    if (item.typeKey !== activeTab) return false;
    if (roleFilter === "buyer") return item.roleKey === "buyer";
    if (roleFilter === "seller") return item.roleKey === "seller";
    return true;
  });

  const renderAppointmentControls = () => (
    <>
      <View style={styles.tabContainer}>
        {[
          { key: "inspection", label: "Kiểm định" },
          { key: "collection", label: "Thu gom" },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabBtn,
              activeTab === tab.key ? styles.tabBtnActive : undefined,
            ]}
            onPress={() => setActiveTab(tab.key as AppointmentTab)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === tab.key ? styles.tabTextActive : undefined,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.filterContainer}>
        {[
          { key: "all", label: "Tất cả" },
          { key: "buyer", label: "Đơn mua" },
          { key: "seller", label: "Đơn bán" },
        ].map((filter) => (
          <TouchableOpacity
            key={filter.key}
            style={[
              styles.filterChip,
              roleFilter === filter.key ? styles.filterChipActive : undefined,
            ]}
            onPress={() =>
              setRoleFilter(filter.key as AppointmentRoleFilter)
            }
          >
            <Text
              style={[
                styles.filterChipText,
                roleFilter === filter.key
                  ? styles.filterChipTextActive
                  : undefined,
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );

  const renderBusinessTimeline = () => {
    if (filteredAppointments.length === 0) {
      return (
        <Text style={styles.emptyText}>Chưa có lịch hẹn nào cho mục này.</Text>
      );
    }

    const groupedData = filteredAppointments.reduce(
      (acc, appt) => {
        const d = new Date(appt.rawDate);
        if (Number.isNaN(d.getTime())) return acc;
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
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
        >
          {sortedDates.map((dateKey) => {
            const events = groupedData[dateKey];
            const d = new Date(dateKey);
            const dayNum = d.getDate();
            const dayName = WEEK_DAYS[d.getDay()];

            return (
              <View key={dateKey} style={styles.timelineRow}>
                <View style={styles.timelineLeft}>
                  <Text style={styles.timelineDayNum}>{dayNum}</Text>
                  <Text style={styles.timelineDayName}>{dayName}</Text>
                </View>

                <View style={styles.timelineCenter}>
                  <View style={styles.timelineLine} />
                  <View style={styles.timelineDot} />
                </View>

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
                        {event.role}: {event.partner}
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

  const renderNormalList = () => (
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
        filteredAppointments.map((item) => {
          const checkedInCount =
            Number(item.buyerCheckedIn) + Number(item.sellerCheckedIn);

          return (
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
                <Text style={styles.partnerValue}>{item.partner}</Text>
              </Text>

              <InfoLine label="Lịch hẹn" value={item.date} />

              {item.typeKey === "inspection" ? (
                <InfoLine
                  label="Địa điểm"
                  value={item.inspectionAddress || "Chưa cập nhật địa điểm"}
                />
              ) : (
                <>
                  <InfoLine
                    label="Phương thức"
                    value={item.deliveryMethod}
                  />
                  <InfoLine
                    label="Điểm lấy"
                    value={item.pickupAddress || "Chưa cập nhật"}
                  />
                  <InfoLine
                    label="Điểm giao"
                    value={item.deliveryAddress || "Chưa cập nhật"}
                  />
                </>
              )}

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>
                  Tạo lịch: {formatDateTime(item.createdAt)}
                </Text>
                <Text style={styles.metaText}>Check-in: {checkedInCount}/2</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.cardFooter}>
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() =>
                    router.push(`/appointments/${item.id}` as any)
                  }
                >
                  <Text style={styles.primaryBtnText}>Chi tiết lịch hẹn</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })
      ) : (
        <Text style={styles.emptyText}>Chưa có lịch hẹn nào cho mục này.</Text>
      )}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View
        style={[styles.mobileWrapper, isWeb ? styles.webWrapper : undefined]}
      >
        <MainHeader title="Quản lý Lịch hẹn" />
        {renderAppointmentControls()}

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

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoText}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.border },
  mobileWrapper: { flex: 1, backgroundColor: "#F8F9FA" },
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

  tabContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  tabBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabBtnActive: { borderBottomColor: COLORS.primary },
  tabText: { color: COLORS.textLight, fontSize: 14, fontWeight: "600" },
  tabTextActive: { color: COLORS.primary },

  filterContainer: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#BAC2C1",
  },
  filterChip: {
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 18,
    backgroundColor: "#F8F9FA",
    borderWidth: 1,
    borderColor: "#BAC2C1",
  },
  filterChipActive: {
    backgroundColor: "#172830",
    borderColor: "#172830",
  },
  filterChipText: { fontSize: 13, color: "#547B7D", fontWeight: "600" },
  filterChipTextActive: { color: "#FFF" },

  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: COLORS.textLight, fontSize: 13 },
  emptyText: {
    marginTop: 40,
    color: COLORS.textLight,
    fontSize: 14,
    textAlign: "center",
  },

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
    borderColor: "#BAC2C1",
    marginBottom: 8,
  },
  agendaMonthText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#172830",
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
    color: "#172830",
  },
  timelineDayName: {
    fontSize: 12,
    color: "#547B7D",
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
    backgroundColor: "#F8F9FA",
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: "#BAC2C1",
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

  list: { padding: 16, gap: 16 },
  card: {
    backgroundColor: COLORS.white,
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
    alignItems: "center",
    marginBottom: 12,
  },
  badge: {
    backgroundColor: "rgba(84, 123, 125, 0.10)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: { color: "#2B5659", fontSize: 12, fontWeight: "bold" },
  status: { fontSize: 13, fontWeight: "bold" },
  productName: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.text,
    marginBottom: 6,
  },
  partnerName: { fontSize: 14, color: COLORS.textLight, marginBottom: 12 },
  partnerValue: { fontWeight: "bold", color: COLORS.text },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 7,
  },
  infoLabel: {
    width: 82,
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: "600",
  },
  infoText: {
    flex: 1,
    color: "#547B7D",
    fontSize: 13,
    lineHeight: 19,
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 7,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#BAC2C1",
  },
  metaText: {
    flex: 1,
    color: "#547B7D",
    fontSize: 11,
    lineHeight: 16,
  },
  divider: { height: 1, marginVertical: 12, backgroundColor: "#F8F9FA" },
  cardFooter: { flexDirection: "row", marginTop: 4 },
  primaryBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: COLORS.primary,
  },
  primaryBtnText: { color: COLORS.white, fontSize: 14, fontWeight: "bold" },
  bottomSpacer: { height: 40 },
});
