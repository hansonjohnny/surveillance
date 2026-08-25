import { AlertCard } from "@/components/alerts/AlertCard";
import { EventCard } from "@/components/log/EventCard";
import { ExpandedEventCard } from "@/components/log/ExpandedEventCard";
import { LiveMap } from "@/components/map/LiveMap";
import { fetchWardSnapshot, type WardSnapshot } from "@/lib/guardian";
import type { RiskLevel } from "@/types";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useCallback, useRef, useState } from "react";
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

// Read-only, polling-based — same pattern as the public Live Share page
// (share.html), not a Supabase Realtime subscription. Stops while the
// screen isn't focused.
const POLL_MS = 10000;

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

export default function WardDetailScreen() {
  const router = useRouter();
  const { wardId, email } = useLocalSearchParams<{
    wardId: string;
    email?: string;
  }>();
  const [snapshot, setSnapshot] = useState<WardSnapshot | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

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

  const latestEvent = snapshot?.events[0] ?? null;
  const risk = RISK_STYLES[latestEvent?.riskLevel ?? "low"];
  const lastSeenAt = snapshot?.session?.lastLocationAt ?? latestEvent?.timestamp ?? null;

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
      </SafeAreaView>

      <ScrollView
        contentContainerStyle={{ paddingBottom: 60 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={{ height: 260 }}>
          <LiveMap location={snapshot?.session?.lastLocation ?? null} />
        </View>

        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>
          {/* Status row */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 24,
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
              {snapshot?.session && !snapshot.session.active
                ? "Session ended · "
                : ""}
              Updated {relativeTime(lastSeenAt)}
            </Text>
          </View>

          {/* Event log */}
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 15,
              color: "#F0F0F5",
              marginBottom: 12,
            }}
          >
            Event Log
          </Text>
          {snapshot === null ? (
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 13,
                color: MUTED,
                marginBottom: 24,
              }}
            >
              Loading...
            </Text>
          ) : snapshot.events.length === 0 ? (
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 13,
                color: MUTED,
                marginBottom: 24,
              }}
            >
              No events yet.
            </Text>
          ) : (
            snapshot.events.map((event) =>
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

          {/* Alert history */}
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 15,
              color: "#F0F0F5",
              marginTop: 12,
              marginBottom: 12,
            }}
          >
            Alert History
          </Text>
          {snapshot === null ? null : snapshot.alerts.length === 0 ? (
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 13,
                color: MUTED,
              }}
            >
              No alerts fired.
            </Text>
          ) : (
            snapshot.alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}
