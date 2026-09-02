import { AlertCard } from "@/components/alerts/AlertCard";
import { EventCard } from "@/components/log/EventCard";
import { ExpandedEventCard } from "@/components/log/ExpandedEventCard";
import { LiveMap } from "@/components/map/LiveMap";
import {
  fetchWardAlertHistoryDays,
  fetchWardAlertsForDate,
  fetchWardEventHistoryDays,
  fetchWardEventsForDate,
  fetchWardLocationHistoryDays,
  fetchWardLocationHistoryForDate,
  fetchWardSnapshot,
  remoteStartWardSession,
  remoteStopWardSession,
  type WardSnapshot,
} from "@/lib/guardian";
import type { Alert, Event } from "@/types";
import { getDirectionsUrl } from "@/lib/location";
import {
  fetchSettings,
  upsertSettings,
  type RemoteSettings,
} from "@/lib/settingsSync";
import { formatTime12h, parseTimeInput } from "@/lib/wellness";
import { showAlert } from "@/lib/platformAlert";
import { MonitoringIntervalPicker, type Interval } from "@/components/ui/MonitoringIntervalPicker";
import { ShakeSensitivityPicker, type Sensitivity } from "@/components/ui/ShakeSensitivityPicker";
import type { RiskLevel } from "@/types";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import {
  ArrowLeft,
  BellRing,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  History,
  Map,
  Navigation,
  Play,
  RefreshCw,
  ScrollText,
  Shield,
  Square,
} from "lucide-react-native";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  ScrollView,
  StatusBar,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const SENS_TO_NUMERIC: Record<RemoteSettings["shakeSensitivity"], Sensitivity> = {
  low: 0,
  medium: 1,
  high: 2,
};
const SENS_TO_STRING: Record<Sensitivity, RemoteSettings["shakeSensitivity"]> = {
  0: "low",
  1: "medium",
  2: "high",
};

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => n.toString().padStart(2, "0"))
    .join(":");
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function startOfNextMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 1);
}

function isSameDay(a: Date, b: Date): boolean {
  return isoDate(a) === isoDate(b);
}

const BG = "#0A0A0F";
const CYAN = "#00E5FF";
const MUTED = "#8888A0";
const RISK_STYLES: Record<
  RiskLevel,
  { color: string; bg: string; border: string }
> = {
  low: {
    color: "#00E676",
    bg: "rgba(0, 230, 118, 0.10)",
    border: "rgba(0, 230, 118, 0.30)",
  },
  medium: {
    color: "#FFD740",
    bg: "rgba(255, 215, 64, 0.10)",
    border: "rgba(255, 215, 64, 0.30)",
  },
  high: {
    color: "#FF3D3D",
    bg: "rgba(255, 61, 61, 0.10)",
    border: "rgba(255, 61, 61, 0.30)",
  },
};

// There's no real presence/heartbeat signal from the ward's device —
// this is a heuristic off how recently a location ping landed (pings
// fire ~every 12s during an active session, see lib/location.ts's
// maybePushLocationPing). It can't tell "lost signal" apart from "denied
// location permission" apart from "closed the app" — just "something's
// stale, don't trust this pin blindly."
const LIVE_THRESHOLD_MS = 90000;

function getWardLiveStatus(
  session: WardSnapshot["session"],
  lastLocationAt: number | null,
): { label: string; color: string } {
  if (!session) return { label: "Never started monitoring", color: MUTED };
  if (!session.active) return { label: "Session ended", color: MUTED };
  if (lastLocationAt && Date.now() - lastLocationAt < LIVE_THRESHOLD_MS) {
    return { label: "LIVE", color: "#00E676" };
  }
  return {
    label: lastLocationAt
      ? `Possibly offline — last seen ${relativeTime(lastLocationAt)}`
      : "Possibly offline — no location yet",
    color: "#FFD740",
  };
}

// Read-only, polling-based — same pattern as the public Live Share page
// (share.html), not a Supabase Realtime subscription. Stops while the
// screen isn't focused. The Live Map tab's refresh button re-runs this
// same poll on demand, for whenever a guardian doesn't want to wait out
// the interval (e.g. after a network hiccup).
const POLL_MS = 10000;

type Tab = "session" | "map" | "history" | "log" | "alerts";

function relativeTime(ts: number | null): string {
  if (!ts) return "never";
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function TabBar({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  const insets = useSafeAreaInsets();
  const TABS: { key: Tab; label: string; Icon: typeof Map }[] = [
    { key: "session", label: "SESSION", Icon: Shield },
    { key: "map", label: "LIVE MAP", Icon: Map },
    { key: "history", label: "LOCATION", Icon: History },
    { key: "log", label: "EVENT LOG", Icon: ScrollText },
    { key: "alerts", label: "ALERTS", Icon: BellRing },
  ];
  return (
    <View
      style={{
        flexDirection: "row",
        height: 64 + insets.bottom,
        paddingBottom: 10 + insets.bottom,
        paddingTop: 8,
        backgroundColor: "#111118",
        borderTopWidth: 1,
        borderTopColor: "rgba(255, 255, 255, 0.10)",
      }}
    >
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <TouchableOpacity
            key={tab.key}
            onPress={() => onChange(tab.key)}
            activeOpacity={0.8}
            style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 2 }}
          >
            <tab.Icon size={22} color={isActive ? CYAN : "#555568"} strokeWidth={1.5} />
            <Text
              style={{
                fontFamily: "JetBrainsMono_400Regular",
                fontSize: 10,
                letterSpacing: 0.5,
                marginTop: 2,
                color: isActive ? CYAN : "#555568",
              }}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function CalendarModal({
  visible,
  onClose,
  viewMonth,
  onChangeMonth,
  selectedDate,
  onSelectDate,
  daysWithData,
}: {
  visible: boolean;
  onClose: () => void;
  viewMonth: Date;
  onChangeMonth: (d: Date) => void;
  selectedDate: Date;
  onSelectDate: (d: Date) => void;
  daysWithData: Set<string>;
}) {
  const today = new Date();
  const monthStart = startOfMonth(viewMonth);
  const firstWeekday = monthStart.getDay(); // 0 = Sunday
  const daysInMonth = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    0,
  ).getDate();

  const cells: (Date | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from(
      { length: daysInMonth },
      (_, i) => new Date(monthStart.getFullYear(), monthStart.getMonth(), i + 1),
    ),
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0, 0, 0, 0.6)",
        }}
      >
        <View
          style={{
            backgroundColor: "#111118",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 40,
          }}
        >
          {/* Month header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <TouchableOpacity
              onPress={() =>
                onChangeMonth(new Date(monthStart.getFullYear(), monthStart.getMonth() - 1, 1))
              }
              style={{ padding: 8 }}
            >
              <ChevronLeft size={20} color={CYAN} strokeWidth={1.5} />
            </TouchableOpacity>
            <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 16, color: "#F0F0F5" }}>
              {monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </Text>
            <TouchableOpacity
              onPress={() =>
                onChangeMonth(new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 1))
              }
              style={{ padding: 8 }}
            >
              <ChevronRight size={20} color={CYAN} strokeWidth={1.5} />
            </TouchableOpacity>
          </View>

          {/* Weekday header */}
          <View style={{ flexDirection: "row" }}>
            {WEEKDAY_LABELS.map((label, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center", paddingVertical: 6 }}>
                <Text style={{ fontFamily: "DMSans_500Medium", fontSize: 11, color: MUTED }}>
                  {label}
                </Text>
              </View>
            ))}
          </View>

          {/* Day grid */}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {cells.map((day, i) => {
              if (!day) {
                return <View key={i} style={{ width: "14.28%", height: 44 }} />;
              }
              const isFuture = day > today;
              const hasData = daysWithData.has(isoDate(day));
              const isSelected = isSameDay(day, selectedDate);
              return (
                <TouchableOpacity
                  key={i}
                  disabled={isFuture}
                  onPress={() => onSelectDate(day)}
                  style={{
                    width: "14.28%",
                    height: 44,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 16,
                      alignItems: "center",
                      justifyContent: "center",
                      backgroundColor: isSelected ? "rgba(0, 229, 255, 0.15)" : "transparent",
                      borderWidth: isSelected ? 1 : 0,
                      borderColor: "rgba(0, 229, 255, 0.50)",
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "DMSans_400Regular",
                        fontSize: 13,
                        color: isFuture ? "#3A3A46" : isSelected ? CYAN : "#F0F0F5",
                      }}
                    >
                      {day.getDate()}
                    </Text>
                  </View>
                  <View
                    style={{
                      width: 4,
                      height: 4,
                      borderRadius: 2,
                      marginTop: 2,
                      backgroundColor: hasData ? CYAN : "transparent",
                    }}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default function WardDetailScreen() {
  const router = useRouter();
  const { wardId, email } = useLocalSearchParams<{
    wardId: string;
    email?: string;
  }>();
  const [snapshot, setSnapshot] = useState<WardSnapshot | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("session");
  const [refreshing, setRefreshing] = useState(false);
  const [remoteStarting, setRemoteStarting] = useState(false);
  const [remoteStopping, setRemoteStopping] = useState(false);
  const [now, setNow] = useState(Date.now());

  // Location History tab — calendar-scoped, defaults to today.
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [dayHistory, setDayHistory] = useState<
    { lat: number; lng: number; timestamp: number }[]
  >([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(new Date());
  const [daysWithData, setDaysWithData] = useState<Set<string>>(new Set());

  // Event Log tab — same calendar-scoped pattern, its own independent date.
  const [logSelectedDate, setLogSelectedDate] = useState(new Date());
  const [logDayEvents, setLogDayEvents] = useState<Event[]>([]);
  const [logCalendarOpen, setLogCalendarOpen] = useState(false);
  const [logViewMonth, setLogViewMonth] = useState(new Date());
  const [logDaysWithData, setLogDaysWithData] = useState<Set<string>>(new Set());

  // Alerts tab — same pattern again, its own independent date.
  const [alertsSelectedDate, setAlertsSelectedDate] = useState(new Date());
  const [alertsDayAlerts, setAlertsDayAlerts] = useState<Alert[]>([]);
  const [alertsCalendarOpen, setAlertsCalendarOpen] = useState(false);
  const [alertsViewMonth, setAlertsViewMonth] = useState(new Date());
  const [alertsDaysWithData, setAlertsDaysWithData] = useState<Set<string>>(new Set());

  // Monitoring settings — guardian-controlled (see lib/settingsSync.ts).
  // Null while loading; the pickers only render once it's known so they
  // never briefly show a default that isn't the ward's real value.
  const [wardSettings, setWardSettings] = useState<RemoteSettings | null>(null);
  const [savingSettings, setSavingSettings] = useState(false);
  const [wellnessTimeInput, setWellnessTimeInput] = useState("");
  const [wellnessTimeError, setWellnessTimeError] = useState(false);

  const poll = useCallback(async () => {
    if (!wardId) return;
    const data = await fetchWardSnapshot(wardId);
    setSnapshot(data);
  }, [wardId]);

  useFocusEffect(
    useCallback(() => {
      poll();
      const interval = setInterval(poll, POLL_MS);
      return () => clearInterval(interval);
    }, [poll]),
  );

  useEffect(() => {
    if (!wardId) return;
    fetchWardLocationHistoryForDate(wardId, selectedDate).then(setDayHistory);
  }, [wardId, selectedDate]);

  useEffect(() => {
    if (!wardId) return;
    fetchWardLocationHistoryDays(wardId, startOfMonth(viewMonth), startOfNextMonth(viewMonth)).then(
      setDaysWithData,
    );
  }, [wardId, viewMonth]);

  useEffect(() => {
    if (!wardId) return;
    fetchWardEventsForDate(wardId, logSelectedDate).then(setLogDayEvents);
  }, [wardId, logSelectedDate]);

  useEffect(() => {
    if (!wardId) return;
    fetchWardEventHistoryDays(wardId, startOfMonth(logViewMonth), startOfNextMonth(logViewMonth)).then(
      setLogDaysWithData,
    );
  }, [wardId, logViewMonth]);

  useEffect(() => {
    if (!wardId) return;
    fetchWardAlertsForDate(wardId, alertsSelectedDate).then(setAlertsDayAlerts);
  }, [wardId, alertsSelectedDate]);

  useEffect(() => {
    if (!wardId) return;
    fetchWardAlertHistoryDays(
      wardId,
      startOfMonth(alertsViewMonth),
      startOfNextMonth(alertsViewMonth),
    ).then(setAlertsDaysWithData);
  }, [wardId, alertsViewMonth]);

  useEffect(() => {
    if (!wardId) return;
    fetchSettings(wardId).then((s) => {
      // Falls back to the same defaults the ward's own store starts with —
      // covers a ward who has never opened Settings, so no row exists yet.
      const resolved =
        s ?? { monitoringInterval: 30, shakeSensitivity: "medium", wellnessCheckInTime: null };
      setWardSettings(resolved);
      if (resolved.wellnessCheckInTime) {
        setWellnessTimeInput(formatTime12h(resolved.wellnessCheckInTime));
      }
    });
  }, [wardId]);

  async function handleWardWellnessToggle(enabled: boolean) {
    if (!wardId) return;
    if (!enabled) {
      setWardSettings((prev) => (prev ? { ...prev, wellnessCheckInTime: null } : prev));
      setSavingSettings(true);
      await upsertSettings(wardId, { wellnessCheckInTime: null });
      setSavingSettings(false);
      return;
    }
    // Turning on with no time set yet — default to 10 PM, same as a
    // sensible starting point; the guardian can change it right after.
    const parsed = parseTimeInput(wellnessTimeInput) ?? "22:00";
    setWellnessTimeInput(formatTime12h(parsed));
    setWardSettings((prev) => (prev ? { ...prev, wellnessCheckInTime: parsed } : prev));
    setSavingSettings(true);
    await upsertSettings(wardId, { wellnessCheckInTime: parsed });
    setSavingSettings(false);
  }

  async function handleWardWellnessTimeSubmit() {
    if (!wardId) return;
    const parsed = parseTimeInput(wellnessTimeInput);
    if (!parsed) {
      setWellnessTimeError(true);
      return;
    }
    setWellnessTimeError(false);
    setWardSettings((prev) => (prev ? { ...prev, wellnessCheckInTime: parsed } : prev));
    setSavingSettings(true);
    await upsertSettings(wardId, { wellnessCheckInTime: parsed });
    setSavingSettings(false);
  }

  async function handleWardIntervalChange(v: Interval) {
    if (!wardId) return;
    setWardSettings((prev) => (prev ? { ...prev, monitoringInterval: v } : prev));
    setSavingSettings(true);
    await upsertSettings(wardId, { monitoringInterval: v });
    setSavingSettings(false);
  }

  async function handleWardSensitivityChange(v: Sensitivity) {
    if (!wardId) return;
    const shakeSensitivity = SENS_TO_STRING[v];
    setWardSettings((prev) => (prev ? { ...prev, shakeSensitivity } : prev));
    setSavingSettings(true);
    await upsertSettings(wardId, { shakeSensitivity });
    setSavingSettings(false);
  }

  // Ticks the session timer every second while the ward's session is
  // active — same fmt()/interval pattern as the ward's own Home screen.
  useEffect(() => {
    if (!snapshot?.session?.active) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [snapshot?.session?.active]);

  async function handleManualRefresh() {
    setRefreshing(true);
    await poll();
    setRefreshing(false);
  }

  function handleGetDirections() {
    const loc = snapshot?.session?.lastLocation;
    if (!loc) return;
    Linking.openURL(getDirectionsUrl(loc.lat, loc.lng));
  }

  async function handleRemoteStart() {
    if (!wardId) return;
    setRemoteStarting(true);
    const result = await remoteStartWardSession(wardId);
    setRemoteStarting(false);
    showAlert(
      result.success ? "Start request sent" : "Couldn't start monitoring",
      result.success
        ? "Monitoring will begin on their phone shortly, no action needed on their end."
        : result.error ?? "Something went wrong. Please try again.",
    );
  }

  async function handleRemoteStop() {
    if (!wardId) return;
    setRemoteStopping(true);
    const result = await remoteStopWardSession(wardId);
    setRemoteStopping(false);
    showAlert(
      result.success ? "Stop request sent" : "Couldn't stop monitoring",
      result.success
        ? "Monitoring will end on their phone shortly."
        : result.error ?? "Something went wrong. Please try again.",
    );
  }

  const latestEvent = snapshot?.events[0] ?? null;
  const risk = RISK_STYLES[latestEvent?.riskLevel ?? "low"];
  const lastSeenAt = snapshot?.session?.lastLocationAt ?? latestEvent?.timestamp ?? null;
  const wardStatus = getWardLiveStatus(
    snapshot?.session ?? null,
    snapshot?.session?.lastLocationAt ?? null,
  );
  const sessionActive = snapshot?.session?.active ?? false;
  const elapsed =
    sessionActive && snapshot?.session?.startedAt
      ? now - snapshot.session.startedAt
      : 0;

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <SafeAreaView edges={["top"]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            height: 64,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255, 255, 255, 0.10)",
          }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <ArrowLeft size={20} color={CYAN} strokeWidth={1.5} />
          </TouchableOpacity>
          <Text
            numberOfLines={1}
            style={{
              fontFamily: "Outfit_700Bold",
              fontSize: 16,
              color: "#F0F0F5",
              marginLeft: 4,
              flex: 1,
            }}
          >
            {email || "Ward"}
          </Text>
        </View>

        {/* Status row */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingTop: 16,
          }}
        >
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 9999,
              backgroundColor: risk.bg,
              borderWidth: 1,
              borderColor: risk.border,
            }}
          >
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 11,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                color: risk.color,
              }}
            >
              {latestEvent ? latestEvent.riskLevel : "no data yet"}
            </Text>
          </View>
          <Text
            style={{
              fontFamily: "JetBrainsMono_400Regular",
              fontSize: 11,
              color: MUTED,
            }}
          >
            {snapshot?.session && !snapshot.session.active ? "Session ended · " : ""}
            Updated {relativeTime(lastSeenAt)}
          </Text>
        </View>
      </SafeAreaView>

      {activeTab === "session" && (
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
        >
          <View
            style={{
              alignItems: "center",
              paddingVertical: 32,
              borderRadius: 24,
              backgroundColor: "rgba(255, 255, 255, 0.04)",
              borderWidth: 1,
              borderColor: sessionActive
                ? "rgba(0, 229, 255, 0.30)"
                : "rgba(255, 255, 255, 0.10)",
            }}
          >
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: sessionActive
                  ? "rgba(0, 229, 255, 0.10)"
                  : "rgba(255, 255, 255, 0.04)",
                borderWidth: 1.5,
                borderColor: sessionActive
                  ? "rgba(0, 229, 255, 0.40)"
                  : "rgba(255, 255, 255, 0.10)",
                marginBottom: 20,
              }}
            >
              <Shield
                size={40}
                color={sessionActive ? CYAN : "#555568"}
                strokeWidth={1.5}
              />
            </View>

            <Text
              style={{
                fontFamily: "JetBrainsMono_400Regular",
                fontSize: 12,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: sessionActive ? CYAN : MUTED,
                marginBottom: 8,
              }}
            >
              {sessionActive ? "Active" : "Inactive"}
            </Text>

            <Text
              style={{
                fontFamily: "JetBrainsMono_400Regular",
                fontSize: 32,
                color: sessionActive ? "#F0F0F5" : "#555568",
                marginBottom: 24,
              }}
            >
              {sessionActive ? fmt(elapsed) : "00:00:00"}
            </Text>

            {sessionActive ? (
              <TouchableOpacity
                onPress={handleRemoteStop}
                disabled={remoteStopping}
                activeOpacity={0.85}
                style={{
                  flexDirection: "row",
                  gap: 8,
                  height: 48,
                  borderRadius: 9999,
                  backgroundColor: "#FF3D3D",
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 28,
                  opacity: remoteStopping ? 0.6 : 1,
                }}
              >
                {remoteStopping ? (
                  <ActivityIndicator color="#F0F0F5" />
                ) : (
                  <>
                    <Square size={16} color="#F0F0F5" strokeWidth={2} fill="#F0F0F5" />
                    <Text
                      style={{ fontFamily: "DMSans_500Medium", fontSize: 14, color: "#F0F0F5" }}
                    >
                      Stop Monitoring
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={handleRemoteStart}
                disabled={remoteStarting}
                activeOpacity={0.85}
                style={{
                  flexDirection: "row",
                  gap: 8,
                  height: 48,
                  borderRadius: 9999,
                  backgroundColor: CYAN,
                  alignItems: "center",
                  justifyContent: "center",
                  paddingHorizontal: 28,
                  opacity: remoteStarting ? 0.6 : 1,
                }}
              >
                {remoteStarting ? (
                  <ActivityIndicator color="#001F24" />
                ) : (
                  <>
                    <Play size={16} color="#001F24" strokeWidth={2} />
                    <Text
                      style={{ fontFamily: "DMSans_500Medium", fontSize: 14, color: "#001F24" }}
                    >
                      Start Monitoring
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </View>

          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 12,
              color: MUTED,
              textAlign: "center",
              marginTop: 16,
              lineHeight: 18,
            }}
          >
            {sessionActive
              ? "This is a request sent to their phone — it may take a few seconds to take effect."
              : "Starts monitoring on their phone without any action needed on their end."}
          </Text>

          {/* Monitoring settings — guardian-controlled, see lib/settingsSync.ts.
              Takes effect the next time their session (re)starts, not live
              mid-cycle — pair a change with Stop + Start above for that. */}
          <View style={{ marginTop: 32 }}>
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 11,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "#555568",
                marginBottom: 12,
              }}
            >
              Monitoring Settings {savingSettings ? "· Saving…" : ""}
            </Text>
            {wardSettings ? (
              <View style={{ gap: 16 }}>
                <View
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.04)",
                    borderRadius: 14,
                    padding: 20,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <MonitoringIntervalPicker
                    value={wardSettings.monitoringInterval}
                    onChange={handleWardIntervalChange}
                  />
                </View>
                <View
                  style={{
                    backgroundColor: "rgba(255, 255, 255, 0.04)",
                    borderRadius: 14,
                    padding: 20,
                    borderWidth: 1,
                    borderColor: "rgba(255, 255, 255, 0.08)",
                  }}
                >
                  <ShakeSensitivityPicker
                    value={SENS_TO_NUMERIC[wardSettings.shakeSensitivity]}
                    onChange={handleWardSensitivityChange}
                  />
                </View>
              </View>
            ) : (
              <ActivityIndicator size="small" color={CYAN} />
            )}
          </View>

          {/* Daily Check-In — guardian-controlled. Actually reschedules
              (or cancels) the local notification on the ward's phone the
              moment they next sync (app launch, or next monitoring start)
              — see lib/settingsSync.ts. */}
          <View style={{ marginTop: 32, marginBottom: 8 }}>
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 11,
                letterSpacing: 1,
                textTransform: "uppercase",
                color: "#555568",
                marginBottom: 12,
              }}
            >
              Daily Check-In
            </Text>
            {wardSettings ? (
              <View
                style={{
                  backgroundColor: "rgba(255, 255, 255, 0.04)",
                  borderRadius: 14,
                  padding: 20,
                  borderWidth: 1,
                  borderColor: wardSettings.wellnessCheckInTime
                    ? "rgba(0, 229, 255, 0.20)"
                    : "rgba(255, 255, 255, 0.08)",
                }}
              >
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                  <View style={{ flex: 1, paddingRight: 16 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <Clock size={14} color={wardSettings.wellnessCheckInTime ? CYAN : MUTED} strokeWidth={1.5} />
                      <Text style={{ fontFamily: "DMSans_500Medium", fontSize: 15, color: "#F0F0F5" }}>
                        Daily Check-In
                      </Text>
                    </View>
                    <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 13, color: MUTED }}>
                      {wardSettings.wellnessCheckInTime
                        ? `We're alerted if they miss check-in at ${formatTime12h(wardSettings.wellnessCheckInTime)}`
                        : "Alert you if they miss a daily safety check-in."}
                    </Text>
                  </View>
                  <Switch
                    value={!!wardSettings.wellnessCheckInTime}
                    onValueChange={handleWardWellnessToggle}
                    trackColor={{ false: "rgba(255,255,255,0.10)", true: "rgba(0,229,255,0.35)" }}
                    thumbColor={wardSettings.wellnessCheckInTime ? CYAN : "#555568"}
                    ios_backgroundColor="rgba(255,255,255,0.10)"
                  />
                </View>
                {wardSettings.wellnessCheckInTime && (
                  <View style={{ marginTop: 16 }}>
                    <View style={{ flexDirection: "row", gap: 12 }}>
                      <TextInput
                        value={wellnessTimeInput}
                        onChangeText={(v) => {
                          setWellnessTimeInput(v);
                          setWellnessTimeError(false);
                        }}
                        onBlur={handleWardWellnessTimeSubmit}
                        onSubmitEditing={handleWardWellnessTimeSubmit}
                        placeholder="10:00 PM or 22:00"
                        placeholderTextColor="#555568"
                        returnKeyType="done"
                        style={{
                          flex: 1,
                          height: 50,
                          borderRadius: 12,
                          backgroundColor: wellnessTimeError ? "rgba(255,61,61,0.06)" : "rgba(255,255,255,0.05)",
                          borderWidth: 1,
                          borderColor: wellnessTimeError ? "rgba(255,61,61,0.40)" : "rgba(255,255,255,0.10)",
                          paddingHorizontal: 16,
                          fontFamily: "JetBrainsMono_400Regular",
                          fontSize: 15,
                          color: "#F0F0F5",
                        }}
                      />
                      <TouchableOpacity
                        onPress={handleWardWellnessTimeSubmit}
                        activeOpacity={0.8}
                        style={{
                          height: 50,
                          paddingHorizontal: 20,
                          borderRadius: 12,
                          backgroundColor: CYAN,
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Text style={{ fontFamily: "DMSans_500Medium", fontSize: 14, color: "#001F24" }}>
                          Set
                        </Text>
                      </TouchableOpacity>
                    </View>
                    {wellnessTimeError && (
                      <Text
                        style={{
                          fontFamily: "JetBrainsMono_400Regular",
                          fontSize: 11,
                          color: "#FF3D3D",
                          letterSpacing: 0.5,
                          marginTop: 6,
                        }}
                      >
                        Use a format like 10:00 PM or 22:00.
                      </Text>
                    )}
                  </View>
                )}
              </View>
            ) : (
              <ActivityIndicator size="small" color={CYAN} />
            )}
          </View>
        </ScrollView>
      )}

      {activeTab === "map" && (
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            <View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#F0F0F5" }}>
                Live Location
              </Text>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 }}>
                <View
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 3.5,
                    backgroundColor: wardStatus.color,
                  }}
                />
                <Text
                  style={{ fontFamily: "DMSans_500Medium", fontSize: 12, color: wardStatus.color }}
                >
                  {wardStatus.label}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {snapshot?.session?.lastLocation ? (
                <TouchableOpacity
                  onPress={handleGetDirections}
                  activeOpacity={0.8}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: "rgba(0, 229, 255, 0.10)",
                    borderWidth: 1,
                    borderColor: "rgba(0, 229, 255, 0.30)",
                  }}
                  accessibilityRole="button"
                  accessibilityLabel="Get directions"
                >
                  <Navigation size={15} color={CYAN} strokeWidth={2} />
                </TouchableOpacity>
              ) : null}
              <TouchableOpacity
                onPress={handleManualRefresh}
                disabled={refreshing}
                activeOpacity={0.8}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "rgba(0, 229, 255, 0.10)",
                  borderWidth: 1,
                  borderColor: "rgba(0, 229, 255, 0.30)",
                }}
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color={CYAN} />
                ) : (
                  <RefreshCw size={15} color={CYAN} strokeWidth={2} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flex: 1, marginHorizontal: 20, marginBottom: 20, borderRadius: 16, overflow: "hidden" }}>
            <LiveMap location={snapshot?.session?.lastLocation ?? null} />
          </View>
        </View>
      )}

      {activeTab === "history" && (
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            <View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#F0F0F5" }}>
                {selectedDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
              <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 12, color: MUTED, marginTop: 2 }}>
                {dayHistory.length ? `${dayHistory.length} points` : "No location history for this day"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setViewMonth(selectedDate);
                setCalendarOpen(true);
              }}
              activeOpacity={0.8}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0, 229, 255, 0.10)",
                borderWidth: 1,
                borderColor: "rgba(0, 229, 255, 0.30)",
              }}
            >
              <CalendarIcon size={15} color={CYAN} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <View style={{ flex: 1, marginHorizontal: 20, marginBottom: 20, borderRadius: 16, overflow: "hidden" }}>
            <LiveMap
              location={dayHistory.length ? dayHistory[dayHistory.length - 1] : null}
              path={dayHistory}
            />
          </View>
        </View>
      )}

      {activeTab === "log" && (
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            <View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#F0F0F5" }}>
                {logSelectedDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
              <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 12, color: MUTED, marginTop: 2 }}>
                {logDayEvents.length ? `${logDayEvents.length} events` : "No events for this day"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setLogViewMonth(logSelectedDate);
                setLogCalendarOpen(true);
              }}
              activeOpacity={0.8}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0, 229, 255, 0.10)",
                borderWidth: 1,
                borderColor: "rgba(0, 229, 255, 0.30)",
              }}
            >
              <CalendarIcon size={15} color={CYAN} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {logDayEvents.length === 0 ? (
              <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 13, color: MUTED }}>
                No events for this day.
              </Text>
            ) : (
              logDayEvents.map((event) =>
                event.id === expandedId ? (
                  <ExpandedEventCard
                    key={event.id}
                    event={event}
                    onCollapse={() => setExpandedId(null)}
                  />
                ) : (
                  <EventCard
                    key={event.id}
                    event={event}
                    onPress={() => setExpandedId(event.id)}
                  />
                ),
              )
            )}
          </ScrollView>
        </View>
      )}

      {activeTab === "alerts" && (
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 20,
              paddingTop: 16,
              paddingBottom: 8,
            }}
          >
            <View>
              <Text style={{ fontFamily: "Outfit_600SemiBold", fontSize: 15, color: "#F0F0F5" }}>
                {alertsSelectedDate.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </Text>
              <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 12, color: MUTED, marginTop: 2 }}>
                {alertsDayAlerts.length ? `${alertsDayAlerts.length} alerts` : "No alerts for this day"}
              </Text>
            </View>
            <TouchableOpacity
              onPress={() => {
                setAlertsViewMonth(alertsSelectedDate);
                setAlertsCalendarOpen(true);
              }}
              activeOpacity={0.8}
              style={{
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0, 229, 255, 0.10)",
                borderWidth: 1,
                borderColor: "rgba(0, 229, 255, 0.30)",
              }}
            >
              <CalendarIcon size={15} color={CYAN} strokeWidth={2} />
            </TouchableOpacity>
          </View>
          <ScrollView
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          >
            {alertsDayAlerts.length === 0 ? (
              <Text style={{ fontFamily: "DMSans_400Regular", fontSize: 13, color: MUTED }}>
                No alerts for this day.
              </Text>
            ) : (
              alertsDayAlerts.map((alert) => <AlertCard key={alert.id} alert={alert} />)
            )}
          </ScrollView>
        </View>
      )}

      <TabBar active={activeTab} onChange={setActiveTab} />

      <CalendarModal
        visible={calendarOpen}
        onClose={() => setCalendarOpen(false)}
        viewMonth={viewMonth}
        onChangeMonth={setViewMonth}
        selectedDate={selectedDate}
        onSelectDate={(d) => {
          setSelectedDate(d);
          setCalendarOpen(false);
        }}
        daysWithData={daysWithData}
      />

      <CalendarModal
        visible={logCalendarOpen}
        onClose={() => setLogCalendarOpen(false)}
        viewMonth={logViewMonth}
        onChangeMonth={setLogViewMonth}
        selectedDate={logSelectedDate}
        onSelectDate={(d) => {
          setLogSelectedDate(d);
          setLogCalendarOpen(false);
        }}
        daysWithData={logDaysWithData}
      />

      <CalendarModal
        visible={alertsCalendarOpen}
        onClose={() => setAlertsCalendarOpen(false)}
        viewMonth={alertsViewMonth}
        onChangeMonth={setAlertsViewMonth}
        selectedDate={alertsSelectedDate}
        onSelectDate={(d) => {
          setAlertsSelectedDate(d);
          setAlertsCalendarOpen(false);
        }}
        daysWithData={alertsDaysWithData}
      />
    </View>
  );
}
