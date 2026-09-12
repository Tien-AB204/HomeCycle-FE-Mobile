import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
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
import { ModalBackdrop, ModalSurface } from "../../src/components/shared/ModalBackdrop";
import MainHeader from "../../src/components/shared/MainHeader";
import { COLORS } from "../../src/constants/theme";
import { useAuth } from "../../src/contexts/AuthContext";
import apiClient from "../../src/services/apis/axiosClient";

// Data-level type — every fetched AppointmentItem is exactly one of these.
type AppointmentTab = "inspection" | "collection";
// Top-level type navigation. "all" combines both feeds — this never touches
// item.typeKey, only what the user has chosen to view.
type AppointmentTypeFilter = "all" | AppointmentTab;
type AppointmentRoleFilter = "all" | "buyer" | "seller";
type CalendarMode = "month" | "week";
// Secondary status filter. Only the two states the product explicitly asked
// for are selectable; every other Backend status still shows under "Tất cả"
// rather than being force-mapped into one of these two buckets.
type AppointmentStatusFilter = "all" | "scheduled" | "completed";

// Same options/labels the two former permanent chip rows already used —
// only the container (funnel modal) changed.
const APPOINTMENT_ROLE_FILTER_OPTIONS: Array<{
  key: AppointmentRoleFilter;
  label: string;
}> = [
  { key: "all", label: "Tất cả" },
  { key: "buyer", label: "Đơn mua" },
  { key: "seller", label: "Đơn bán" },
];

const APPOINTMENT_STATUS_FILTER_OPTIONS: Array<{
  key: AppointmentStatusFilter;
  label: string;
}> = [
  { key: "all", label: "Tất cả" },
  { key: "scheduled", label: "Đã lên lịch" },
  { key: "completed", label: "Đã hoàn thành" },
];

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
  // Raw normalized Backend status (see normalizeAppointmentStatus), kept
  // alongside the display-ready `status` text so filtering never has to
  // pattern-match translated Vietnamese labels.
  statusKey: string;
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

const CALENDAR_WEEK_DAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const APPOINTMENT_PAGE_SIZE = 100;
const MAX_APPOINTMENT_PAGES_PER_FEED = 50;

const unwrapAppointmentPage = (response: any) => {
  const candidates = [
    response,
    response?.data,
    response?.message?.data,
    response?.data?.message?.data,
  ];

  return (
    candidates.find(
      (candidate) =>
        Array.isArray(candidate) ||
        Array.isArray(candidate?.items) ||
        Array.isArray(candidate?.Items),
    ) || {}
  );
};

const getAppointmentPageItems = (response: any): any[] => {
  const page = unwrapAppointmentPage(response);
  if (Array.isArray(page)) return page;
  const items = page?.items ?? page?.Items ?? [];
  return Array.isArray(items) ? items : [];
};

const getAppointmentTotalCount = (response: any): number | null => {
  const page = unwrapAppointmentPage(response);
  if (Array.isArray(page)) return null;
  const value = Number(page?.totalCount ?? page?.TotalCount);
  return Number.isFinite(value) && value >= 0 ? value : null;
};

const fetchAllAppointmentPages = async (
  fetchPage: (params: { PageSize: number; PageNumber: number }) => Promise<any>,
) => {
  const firstResponse = await fetchPage({
    PageSize: APPOINTMENT_PAGE_SIZE,
    PageNumber: 1,
  });
  const items = [...getAppointmentPageItems(firstResponse)];
  const totalCount = getAppointmentTotalCount(firstResponse);
  const requestedPages =
    totalCount === null
      ? 1
      : Math.max(1, Math.ceil(totalCount / APPOINTMENT_PAGE_SIZE));
  const pageCount = Math.min(
    requestedPages,
    MAX_APPOINTMENT_PAGES_PER_FEED,
  );

  for (let pageNumber = 2; pageNumber <= pageCount; pageNumber += 1) {
    const response = await fetchPage({
      PageSize: APPOINTMENT_PAGE_SIZE,
      PageNumber: pageNumber,
    });
    items.push(...getAppointmentPageItems(response));
  }

  return {
    items,
    wasLimited: requestedPages > MAX_APPOINTMENT_PAGES_PER_FEED,
  };
};

const parseScheduledDate = (value: unknown): Date | null => {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const dateOnlyMatch = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const localDate = new Date(Number(year), Number(month) - 1, Number(day), 12);
    return Number.isNaN(localDate.getTime()) ? null : localDate;
  }

  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getLocalDayKey = (value: unknown) => {
  const date = value instanceof Date ? value : parseScheduledDate(value);
  if (!date || Number.isNaN(date.getTime())) return "";

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const getDateFromLocalDayKey = (dayKey: string) => {
  const match = dayKey.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day), 12);
  return Number.isNaN(date.getTime()) ? null : date;
};

const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1, 12);

const addMonths = (date: Date, amount: number) =>
  new Date(date.getFullYear(), date.getMonth() + amount, 1, 12);

const getMonthCalendarDays = (month: Date) => {
  const firstDay = startOfMonth(month);
  const mondayOffset = (firstDay.getDay() + 6) % 7;
  const gridStart = new Date(
    firstDay.getFullYear(),
    firstDay.getMonth(),
    firstDay.getDate() - mondayOffset,
    12,
  );

  return Array.from({ length: 42 }, (_, index) =>
    new Date(
      gridStart.getFullYear(),
      gridStart.getMonth(),
      gridStart.getDate() + index,
      12,
    ),
  );
};

const getWeekCalendarDays = (selectedDate: Date) => {
  const mondayOffset = (selectedDate.getDay() + 6) % 7;
  const monday = new Date(
    selectedDate.getFullYear(),
    selectedDate.getMonth(),
    selectedDate.getDate() - mondayOffset,
    12,
  );

  return Array.from({ length: 7 }, (_, index) =>
    new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + index,
      12,
    ),
  );
};

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
  const currentUserId = String(user?.userId || user?.id || "")
    .trim()
    .toLowerCase();
  const isBusiness = user?.role?.toLowerCase() === "business";

  // Default "all" so Business users see their full operational picture
  // (both Inspection and Collection) the moment the screen opens.
  const [typeFilter, setTypeFilter] = useState<AppointmentTypeFilter>("all");
  // Applied role/status filters — single source of truth the list and the
  // calendar both derive from. The funnel modal edits draft copies below so
  // "Đặt lại"/"Áp dụng" and backdrop-cancel behave like the Orders funnel.
  const [roleFilter, setRoleFilter] =
    useState<AppointmentRoleFilter>("all");
  const [statusFilter, setStatusFilter] =
    useState<AppointmentStatusFilter>("all");
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [draftRoleFilter, setDraftRoleFilter] =
    useState<AppointmentRoleFilter>("all");
  const [draftStatusFilter, setDraftStatusFilter] =
    useState<AppointmentStatusFilter>("all");
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [calendarMode, setCalendarMode] = useState<CalendarMode>("month");
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [selectedDateKey, setSelectedDateKey] = useState<string | null>(null);
  const appointmentLoadVersion = useRef(0);

  const formatDateTime = (dateString: string) => {
    if (!dateString) return "Chưa cập nhật";
    const date = parseScheduledDate(dateString);
    if (!date) return "Chưa cập nhật";
    return date.toLocaleString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const normalizeAppointmentStatus = (status: unknown) =>
    String(status ?? "")
      .replace(/[\s_-]/g, "")
      .toLowerCase();

  const translateAppointmentStatus = (
    status: number | string | null | undefined,
  ) => {
    switch (normalizeAppointmentStatus(status)) {
      case "0":
      case "proposed":
        return "Chờ xác nhận";
      case "1":
      case "scheduled":
        return "Đã lên lịch";
      case "5":
      case "inprogress":
        return "Đang diễn ra";
      case "2":
      case "completed":
        return "Đã hoàn thành";
      case "3":
      case "cancelled":
      case "canceled":
        return "Đã hủy";
      case "4":
      case "expired":
        return "Quá hạn";
      default:
        return "Chưa xác định";
    }
  };

  const getStatusColor = (status: number | string) => {
    const normalized = normalizeAppointmentStatus(status);
    if (normalized === "2" || normalized === "completed") return "#2F765D";
    if (
      normalized === "3" ||
      normalized === "cancelled" ||
      normalized === "canceled" ||
      normalized === "4" ||
      normalized === "expired"
    ) {
      return "#7A1012";
    }
    if (
      normalized === "1" ||
      normalized === "scheduled" ||
      normalized === "5" ||
      normalized === "inprogress"
    ) {
      return "#2B5659";
    }
    return "#9A6418";
  };

  // Restrained accent per appointment TYPE (not status) so "Lịch kiểm định"
  // and "Lịch thu gom" stay visually distinguishable at a glance. This is a
  // fixed accent, never derived from appointment status.
  const getTypeAccent = (typeKey: AppointmentTab) =>
    typeKey === "collection"
      ? {
          background: "rgba(154, 100, 24, 0.10)",
          color: "#9A6418",
          icon: "cube-outline" as const,
        }
      : {
          background: "rgba(43, 86, 89, 0.10)",
          color: COLORS.primary,
          icon: "clipboard-outline" as const,
        };

  const fetchAppointments = useCallback(
    async (isRefresh = false) => {
      const loadVersion = ++appointmentLoadVersion.current;
      if (!currentUserId) {
        setAppointments([]);
        setIsLoading(false);
        setIsRefreshing(false);
        return;
      }

      try {
        if (!isRefresh) setIsLoading(true);

        const feeds = [
          {
            fetchPage: appointmentApi.getBuyerInspections,
            type: "Lịch kiểm định",
            typeKey: "inspection" as const,
            role: "Đơn mua",
            roleKey: "buyer" as const,
          },
          {
            fetchPage: appointmentApi.getSellerInspections,
            type: "Lịch kiểm định",
            typeKey: "inspection" as const,
            role: "Đơn bán",
            roleKey: "seller" as const,
          },
          {
            fetchPage: appointmentApi.getBuyerCollections,
            type: "Lịch thu gom",
            typeKey: "collection" as const,
            role: "Đơn mua",
            roleKey: "buyer" as const,
          },
          {
            fetchPage: appointmentApi.getSellerCollections,
            type: "Lịch thu gom",
            typeKey: "collection" as const,
            role: "Đơn bán",
            roleKey: "seller" as const,
          },
        ];

        const feedResults = await Promise.allSettled(
          feeds.map(async (feed) => ({
            ...feed,
            ...(await fetchAllAppointmentPages(feed.fetchPage)),
          })),
        );

        if (appointmentLoadVersion.current !== loadVersion) return;

        let allRaw: AppointmentItem[] = [];

        const processData = (
          items: any[],
          type: string,
          typeKey: AppointmentTab,
          role: string,
          roleKey: "buyer" | "seller",
        ) => {
          const mapped = items.map((a: any) => {
            const rawDate =
              typeKey === "collection"
                ? a.collectionDate ?? a.CollectionDate ?? ""
                : a.inspectionDate ?? a.InspectionDate ?? "";

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
              statusKey: normalizeAppointmentStatus(
                a.appointmentStatus ?? a.status,
              ),
              createdAt: String(a.createdAt || ""),
            };
          });

          allRaw = [...allRaw, ...mapped];
        };

        let successfulFeeds = 0;
        feedResults.forEach((result, index) => {
          if (result.status !== "fulfilled") {
            console.error(
              `Không thể tải nguồn lịch hẹn ${feeds[index].typeKey}/${feeds[index].roleKey}:`,
              result.reason,
            );
            return;
          }

          successfulFeeds += 1;
          if (result.value.wasLimited) {
            console.warn(
              `Nguồn lịch hẹn ${result.value.typeKey}/${result.value.roleKey} vượt giới hạn an toàn ${MAX_APPOINTMENT_PAGES_PER_FEED} trang.`,
            );
          }
          processData(
            result.value.items,
            result.value.type,
            result.value.typeKey,
            result.value.role,
            result.value.roleKey,
          );
        });

        if (successfulFeeds === 0) {
          throw new Error("Không tải được dữ liệu từ các nguồn lịch hẹn.");
        }

        const appointmentMap = new Map<string, AppointmentItem>();
        allRaw.forEach((item) => {
          if (item.id && !appointmentMap.has(item.id)) {
            appointmentMap.set(item.id, item);
          }
        });
        const uniqueAppointments = Array.from(appointmentMap.values());

        uniqueAppointments.sort(
          (a, b) =>
            (parseScheduledDate(a.rawDate)?.getTime() ?? Number.MAX_SAFE_INTEGER) -
            (parseScheduledDate(b.rawDate)?.getTime() ?? Number.MAX_SAFE_INTEGER),
        );
        setAppointments(uniqueAppointments);
      } catch (error) {
        if (appointmentLoadVersion.current === loadVersion) {
          console.error("Lỗi tải lịch hẹn:", error);
        }
      } finally {
        if (appointmentLoadVersion.current === loadVersion) {
          setIsLoading(false);
          setIsRefreshing(false);
        }
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

  const matchesRoleAndStatus = (item: AppointmentItem) => {
    if (roleFilter === "buyer" && item.roleKey !== "buyer") return false;
    if (roleFilter === "seller" && item.roleKey !== "seller") return false;

    if (statusFilter === "scheduled") {
      return item.statusKey === "1" || item.statusKey === "scheduled";
    }
    if (statusFilter === "completed") {
      return item.statusKey === "2" || item.statusKey === "completed";
    }
    return true;
  };

  // Role/status filtered, but NOT type filtered — the source the calendar
  // dots read from, so a day keeps showing its Collection dot while the
  // Inspection tab is active elsewhere in the composition below, and "Tất
  // cả" can show both types on the same day without either hiding the other.
  const roleStatusFilteredAppointments = appointments.filter(matchesRoleAndStatus);

  const filteredAppointments = roleStatusFilteredAppointments.filter(
    (item) => typeFilter === "all" || item.typeKey === typeFilter,
  );

  const isFunnelActive = roleFilter !== "all" || statusFilter !== "all";

  const openFilterModal = () => {
    setDraftRoleFilter(roleFilter);
    setDraftStatusFilter(statusFilter);
    setShowFilterModal(true);
  };

  const closeFilterModal = () => setShowFilterModal(false);

  const handleResetFilter = () => {
    setDraftRoleFilter("all");
    setDraftStatusFilter("all");
    setRoleFilter("all");
    setStatusFilter("all");
    setShowFilterModal(false);
  };

  const handleApplyFilter = () => {
    setRoleFilter(draftRoleFilter);
    setStatusFilter(draftStatusFilter);
    setShowFilterModal(false);
  };

  const renderAppointmentControls = () => (
    <View style={styles.tabRow}>
      <View style={styles.tabContainer}>
        {(
          [
            { key: "all", label: "Tất cả" },
            { key: "inspection", label: "Kiểm định" },
            { key: "collection", label: "Thu gom" },
          ] as const
        ).map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabBtn,
              typeFilter === tab.key ? styles.tabBtnActive : undefined,
            ]}
            onPress={() => setTypeFilter(tab.key)}
          >
            <Text
              style={[
                styles.tabText,
                typeFilter === tab.key ? styles.tabTextActive : undefined,
              ]}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.filterIconBtn}
        onPress={openFilterModal}
        hitSlop={8}
      >
        <Ionicons name="filter-outline" size={20} color={COLORS.text} />
        {isFunnelActive ? <View style={styles.filterActiveDot} /> : null}
      </TouchableOpacity>
    </View>
  );

  // Per-day type composition for calendar dots, built from the role/status
  // filtered (but NOT type filtered) set — see roleStatusFilteredAppointments
  // above. "Tất cả" can then show both an Inspection and a Collection dot on
  // the same day; a specific type tab narrows back down to a single dot,
  // identical to the previous single-type behavior.
  const appointmentDayTypes = new Map<
    string,
    { inspection: boolean; collection: boolean }
  >();
  roleStatusFilteredAppointments.forEach((item) => {
    const dayKey = getLocalDayKey(item.rawDate);
    if (!dayKey) return;
    const entry = appointmentDayTypes.get(dayKey) || {
      inspection: false,
      collection: false,
    };
    if (item.typeKey === "inspection") entry.inspection = true;
    else entry.collection = true;
    appointmentDayTypes.set(dayKey, entry);
  });
  const todayKey = getLocalDayKey(new Date());
  const selectedDate = selectedDateKey
    ? getDateFromLocalDayKey(selectedDateKey)
    : null;
  const monthCalendarDays = getMonthCalendarDays(visibleMonth);
  const weekCalendarDays = getWeekCalendarDays(selectedDate || new Date());
  const selectedDayAppointments = selectedDateKey
    ? filteredAppointments.filter(
        (item) => getLocalDayKey(item.rawDate) === selectedDateKey,
      )
    : [];

  const selectCalendarDate = (date: Date) => {
    setSelectedDateKey(getLocalDayKey(date));
    setVisibleMonth(startOfMonth(date));
    setCalendarMode("week");
  };

  const navigateMonth = (amount: number) => {
    const nextMonth = addMonths(visibleMonth, amount);
    setVisibleMonth(nextMonth);
    if (
      selectedDate &&
      (selectedDate.getFullYear() !== nextMonth.getFullYear() ||
        selectedDate.getMonth() !== nextMonth.getMonth())
    ) {
      setSelectedDateKey(null);
    }
  };

  const renderAppointmentCard = (item: AppointmentItem) => {
    const checkedInCount =
      Number(item.buyerCheckedIn) + Number(item.sellerCheckedIn);
    const typeAccent = getTypeAccent(item.typeKey);

    return (
      <View key={item.id} style={styles.card}>
        <View style={styles.cardHeader}>
          <View
            style={[styles.badge, { backgroundColor: typeAccent.background }]}
          >
            <Ionicons
              name={typeAccent.icon}
              size={12}
              color={typeAccent.color}
            />
            <Text style={[styles.badgeText, { color: typeAccent.color }]}>
              {item.type}
            </Text>
          </View>
          <Text style={[styles.status, { color: item.statusColor }]}>
            {item.status}
          </Text>
        </View>

        <Text style={styles.productName}>{item.product}</Text>
        <Text style={styles.partnerName}>
          {item.role}: <Text style={styles.partnerValue}>{item.partner}</Text>
        </Text>

        <InfoLine label="Lịch hẹn" value={item.date} />

        {item.typeKey === "inspection" ? (
          <InfoLine
            label="Địa điểm"
            value={item.inspectionAddress || "Chưa cập nhật địa điểm"}
          />
        ) : (
          <>
            <InfoLine label="Phương thức" value={item.deliveryMethod} />
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
            onPress={() => router.push(`/appointments/${item.id}` as any)}
          >
            <Text style={styles.primaryBtnText}>Chi tiết lịch hẹn</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderCalendarDate = (date: Date, isMonthCell: boolean) => {
    const dayKey = getLocalDayKey(date);
    const isSelected = dayKey === selectedDateKey;
    const isToday = dayKey === todayKey;
    const dayTypes = appointmentDayTypes.get(dayKey);
    // A specific type tab narrows the dot to that type only; "Tất cả" can
    // show both. Never let one type's dot suppress the other's.
    const showInspectionDot =
      typeFilter !== "collection" && Boolean(dayTypes?.inspection);
    const showCollectionDot =
      typeFilter !== "inspection" && Boolean(dayTypes?.collection);
    const hasAppointment = showInspectionDot || showCollectionDot;
    const isOutsideMonth =
      isMonthCell &&
      (date.getFullYear() !== visibleMonth.getFullYear() ||
        date.getMonth() !== visibleMonth.getMonth());

    return (
      <TouchableOpacity
        key={dayKey}
        style={[
          isMonthCell ? styles.monthDayCell : styles.weekDayCell,
          isToday ? styles.todayCell : undefined,
          isSelected ? styles.selectedDayCell : undefined,
        ]}
        onPress={() => selectCalendarDate(date)}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityLabel={`${date.toLocaleDateString("vi-VN")}${
          hasAppointment ? ", có lịch hẹn" : ""
        }`}
      >
        {!isMonthCell ? (
          <Text
            style={[
              styles.weekDayLabel,
              isSelected ? styles.selectedDayText : undefined,
            ]}
          >
            {CALENDAR_WEEK_DAYS[(date.getDay() + 6) % 7]}
          </Text>
        ) : null}
        <Text
          style={[
            styles.calendarDayNumber,
            isOutsideMonth ? styles.outsideMonthText : undefined,
            isToday && !isSelected ? styles.todayText : undefined,
            isSelected ? styles.selectedDayText : undefined,
          ]}
        >
          {date.getDate()}
        </Text>
        {hasAppointment ? (
          <View style={styles.dayDotsRow}>
            {showInspectionDot ? (
              <View
                style={[
                  styles.appointmentDot,
                  { backgroundColor: getTypeAccent("inspection").color },
                  isSelected ? styles.selectedAppointmentDot : undefined,
                ]}
              />
            ) : null}
            {showCollectionDot ? (
              <View
                style={[
                  styles.appointmentDot,
                  { backgroundColor: getTypeAccent("collection").color },
                  isSelected ? styles.selectedAppointmentDot : undefined,
                ]}
              />
            ) : null}
          </View>
        ) : (
          <View style={styles.dotSpacer} />
        )}
      </TouchableOpacity>
    );
  };

  const renderBusinessCalendar = () => (
    <ScrollView
      showsVerticalScrollIndicator={false}
      contentContainerStyle={styles.businessCalendarContent}
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={onRefresh}
          colors={[COLORS.primary]}
        />
      }
    >
      <View style={styles.calendarCard}>
        {calendarMode === "month" ? (
          <View style={styles.calendarHeader}>
            <TouchableOpacity
              style={styles.calendarHeaderButton}
              onPress={() => navigateMonth(-1)}
              accessibilityRole="button"
              accessibilityLabel="Tháng trước"
            >
              <Ionicons name="chevron-back" size={20} color={COLORS.text} />
            </TouchableOpacity>
            <Text style={styles.calendarTitle}>
              {visibleMonth.toLocaleDateString("vi-VN", {
                month: "long",
                year: "numeric",
              })}
            </Text>
            <TouchableOpacity
              style={styles.calendarHeaderButton}
              onPress={() => navigateMonth(1)}
              accessibilityRole="button"
              accessibilityLabel="Tháng sau"
            >
              <Ionicons name="chevron-forward" size={20} color={COLORS.text} />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.weekHeader}>
            <View>
              <Text style={styles.weekHeaderEyebrow}>LỊCH THEO TUẦN</Text>
              <Text style={styles.weekHeaderTitle}>
                {selectedDate?.toLocaleDateString("vi-VN", {
                  month: "long",
                  year: "numeric",
                })}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.expandMonthButton}
              onPress={() => {
                if (selectedDate) setVisibleMonth(startOfMonth(selectedDate));
                setCalendarMode("month");
              }}
              accessibilityRole="button"
              accessibilityLabel="Mở lịch tháng"
            >
              <Ionicons name="calendar-outline" size={16} color={COLORS.primary} />
              <Text style={styles.expandMonthText}>Xem tháng</Text>
            </TouchableOpacity>
          </View>
        )}

        {calendarMode === "month" ? (
          <>
            <View style={styles.monthWeekHeader}>
              {CALENDAR_WEEK_DAYS.map((day) => (
                <Text key={day} style={styles.monthWeekDayText}>
                  {day}
                </Text>
              ))}
            </View>
            <View style={styles.monthGrid}>
              {monthCalendarDays.map((date) => renderCalendarDate(date, true))}
            </View>
          </>
        ) : (
          <View style={styles.weekStrip}>
            {weekCalendarDays.map((date) => renderCalendarDate(date, false))}
          </View>
        )}
      </View>

      {calendarMode === "month" ? (
        <View style={styles.calendarHint}>
          <Ionicons name="information-circle-outline" size={18} color={COLORS.primary} />
          <Text style={styles.calendarHintText}>
            Chọn một ngày để xem lịch hẹn. Dấu chấm cho biết ngày có lịch theo bộ lọc hiện tại.
          </Text>
        </View>
      ) : (
        <View style={styles.selectedDaySection}>
          <Text style={styles.selectedDayTitle}>
            {selectedDate?.toLocaleDateString("vi-VN", {
              weekday: "long",
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            })}
          </Text>
          <Text style={styles.selectedDayCount}>
            {selectedDayAppointments.length} lịch hẹn
          </Text>
          {selectedDayAppointments.length > 0 ? (
            <View style={styles.selectedDayList}>
              {selectedDayAppointments.map(renderAppointmentCard)}
            </View>
          ) : (
            <Text style={styles.selectedDayEmpty}>
              Không có lịch hẹn phù hợp bộ lọc trong ngày này.
            </Text>
          )}
        </View>
      )}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );

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
        filteredAppointments.map(renderAppointmentCard)
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
          renderBusinessCalendar()
        ) : (
          renderNormalList()
        )}
      </View>

      <Modal
        visible={showFilterModal}
        transparent
        animationType="fade"
        onRequestClose={closeFilterModal}
      >
        <ModalBackdrop style={styles.filterModalBackdrop} onPress={closeFilterModal}>
          <ModalSurface style={styles.filterModalCard}>
            <Text style={styles.filterModalTitle}>Bộ lọc lịch hẹn</Text>

            <Text style={styles.filterSectionLabel}>Vai trò</Text>
            <View style={styles.filterOptionList}>
              {APPOINTMENT_ROLE_FILTER_OPTIONS.map((option) => {
                const selected = draftRoleFilter === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.filterOptionRow,
                      selected ? styles.filterOptionRowActive : undefined,
                    ]}
                    onPress={() => setDraftRoleFilter(option.key)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selected ? styles.filterOptionTextActive : undefined,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.filterSectionLabel}>Trạng thái</Text>
            <View style={styles.filterOptionList}>
              {APPOINTMENT_STATUS_FILTER_OPTIONS.map((option) => {
                const selected = draftStatusFilter === option.key;
                return (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.filterOptionRow,
                      selected ? styles.filterOptionRowActive : undefined,
                    ]}
                    onPress={() => setDraftStatusFilter(option.key)}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        selected ? styles.filterOptionTextActive : undefined,
                      ]}
                    >
                      {option.label}
                    </Text>
                    {selected ? (
                      <Ionicons name="checkmark" size={18} color={COLORS.primary} />
                    ) : null}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View style={styles.filterModalActions}>
              <TouchableOpacity
                style={styles.filterResetButton}
                onPress={handleResetFilter}
              >
                <Text style={styles.filterResetButtonText}>Đặt lại</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.filterApplyButton}
                onPress={handleApplyFilter}
              >
                <Text style={styles.filterApplyButtonText}>Áp dụng</Text>
              </TouchableOpacity>
            </View>
          </ModalSurface>
        </ModalBackdrop>
      </Modal>
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

  tabRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  tabContainer: {
    flex: 1,
    flexDirection: "row",
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
  filterIconBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  filterActiveDot: {
    position: "absolute",
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
  },
  filterModalBackdrop: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  filterModalCard: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: Platform.OS === "ios" ? 36 : 22,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: COLORS.white,
  },
  filterModalTitle: {
    marginBottom: 14,
    color: COLORS.text,
    fontSize: 17,
    fontWeight: "800",
  },
  filterSectionLabel: {
    marginBottom: 6,
    color: COLORS.textLight,
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  filterOptionList: { gap: 2, marginBottom: 16 },
  filterOptionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
    paddingHorizontal: 4,
    borderRadius: 8,
  },
  filterOptionRowActive: { backgroundColor: "rgba(43, 86, 89, 0.06)" },
  filterOptionText: { color: COLORS.text, fontSize: 15, fontWeight: "600" },
  filterOptionTextActive: { color: COLORS.primary, fontWeight: "800" },
  filterModalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  filterResetButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  filterResetButtonText: { color: COLORS.text, fontSize: 14, fontWeight: "700" },
  filterApplyButton: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 46,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
  },
  filterApplyButtonText: { color: COLORS.white, fontSize: 14, fontWeight: "800" },

  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center" },
  loadingText: { marginTop: 10, color: COLORS.textLight, fontSize: 13 },
  emptyText: {
    marginTop: 40,
    color: COLORS.textLight,
    fontSize: 14,
    textAlign: "center",
  },

  businessCalendarContent: {
    padding: 12,
    paddingBottom: 0,
  },
  calendarCard: {
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    backgroundColor: COLORS.white,
  },
  calendarHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  calendarHeaderButton: {
    width: 38,
    height: 38,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 19,
    backgroundColor: "#F8F9FA",
  },
  calendarTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.text,
    textTransform: "capitalize",
  },
  weekHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  weekHeaderEyebrow: {
    color: COLORS.textLight,
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  weekHeaderTitle: {
    marginTop: 2,
    color: COLORS.text,
    fontSize: 15,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  expandMonthButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: "rgba(84, 123, 125, 0.10)",
  },
  expandMonthText: {
    color: COLORS.primary,
    fontSize: 11,
    fontWeight: "700",
  },
  monthWeekHeader: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingTop: 10,
    paddingBottom: 4,
  },
  monthWeekDayText: {
    width: "14.285714%",
    color: COLORS.textLight,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 6,
    paddingBottom: 10,
  },
  monthDayCell: {
    width: "14.285714%",
    minHeight: 43,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  weekStrip: {
    flexDirection: "row",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  weekDayCell: {
    flex: 1,
    minHeight: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
  todayCell: {
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  selectedDayCell: {
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primary,
  },
  weekDayLabel: {
    marginBottom: 4,
    color: COLORS.textLight,
    fontSize: 10,
    fontWeight: "700",
  },
  calendarDayNumber: {
    color: COLORS.text,
    fontSize: 13,
    fontWeight: "700",
  },
  outsideMonthText: { color: "#AAB2B1" },
  todayText: { color: COLORS.primary, fontWeight: "900" },
  selectedDayText: { color: COLORS.white },
  dayDotsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    height: 5,
    marginTop: 4,
  },
  appointmentDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#9A6418",
  },
  selectedAppointmentDot: { backgroundColor: COLORS.white },
  dotSpacer: { height: 5, marginTop: 4 },
  calendarHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 10,
    paddingHorizontal: 4,
  },
  calendarHintText: {
    flex: 1,
    color: COLORS.textLight,
    fontSize: 12,
    lineHeight: 17,
  },
  selectedDaySection: { marginTop: 14 },
  selectedDayTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: "800",
    textTransform: "capitalize",
  },
  selectedDayCount: {
    marginTop: 3,
    marginBottom: 10,
    color: COLORS.textLight,
    fontSize: 12,
  },
  selectedDayList: { gap: 12 },
  selectedDayEmpty: {
    paddingVertical: 28,
    color: COLORS.textLight,
    fontSize: 13,
    textAlign: "center",
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
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
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
