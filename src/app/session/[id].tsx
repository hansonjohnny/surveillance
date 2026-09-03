import { LiveMap } from "@/components/map/LiveMap";
import { ShareCard } from "@/components/ShareCard";
import { buildDirectionsUrl } from "@/lib/maps";
import { useSessionHistoryStore } from "@/store/useSessionHistoryStore";
import * as Sharing from "expo-sharing";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Navigation, Share2 } from "lucide-react-native";
import { useRef, useState } from "react";
import { Alert, Linking, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { ViewShotRef } from "react-native-view-shot";

const BG = "#0A0A0F";
const MUTED = "#8888A0";
const CYAN = "#00E5FF";
const RISK_LOW = "#00E676";
const RISK_MEDIUM = "#FFD740";
const RISK_HIGH = "#FF3D3D";

function fmtDuration(ms: number) {
  const totalMinutes = Math.max(1, Math.round(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

function fmtTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

// The "2h 14m monitored · all clear" retention-hook line from
// surveillance_ai_plan.md — a friendly one-line outcome on top of the
// raw risk-count legend below it.
function summaryLine(riskCounts: { low: number; medium: number; high: number }): string {
  if (riskCounts.high > 0) {
    return `${riskCounts.high} high-risk alert${riskCounts.high > 1 ? "s" : ""} sent`;
  }
  if (riskCounts.medium > 0) {
    return `${riskCounts.medium} medium risk${riskCounts.medium > 1 ? "s" : ""} detected`;
  }
  return "All clear";
}

export default function SessionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSessionHistoryStore((s) =>
    s.sessions.find((r) => r.id === id),
  );
  const shareCardRef = useRef<ViewShotRef>(null);
  const [sharing, setSharing] = useState(false);

  if (!session) {
    return (
      <View style={{ flex: 1, backgroundColor: BG }}>
        <StatusBar barStyle="light-content" backgroundColor={BG} />
        <SafeAreaView edges={["top"]} style={{ flex: 1, padding: 20 }}>
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ marginBottom: 20 }}
          >
            <ArrowLeft size={22} color={CYAN} strokeWidth={1.5} />
          </TouchableOpacity>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 14,
              color: MUTED,
            }}
          >
            Session not found — it may have been cleared from history.
          </Text>
        </SafeAreaView>
      </View>
    );
  }

  // The map's marker sits at the last recorded point of this historical path.
  const endLocation = session.path[session.path.length - 1] ?? null;

  function handleGetDirections() {
    const url = buildDirectionsUrl(session.path);
    if (url) Linking.openURL(url).catch(() => {});
  }

  async function handleShare() {
    if (sharing) return;
    setSharing(true);
    try {
      const capture = shareCardRef.current?.capture;
      const uri = await capture?.();
      if (!uri) return;
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("Sharing unavailable", "Your device doesn't support sharing images.");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: "Share your protected session",
      });
    } catch (err) {
      console.error("[session detail] share failed:", err);
    } finally {
      setSharing(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <LiveMap location={endLocation} path={session.path} />

      <SafeAreaView
        edges={["top"]}
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          pointerEvents: "box-none",
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: 8,
          }}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(10, 10, 15, 0.85)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
            }}
          >
            <ArrowLeft size={18} color={CYAN} strokeWidth={1.5} />
          </TouchableOpacity>

          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 9999,
              backgroundColor: "rgba(10, 10, 15, 0.85)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
            }}
          >
            <Text
              style={{
                fontFamily: "JetBrainsMono_400Regular",
                fontSize: 11,
                color: "#F0F0F5",
              }}
            >
              {fmtTime(session.startTime)} → {fmtTime(session.endTime)} ·{" "}
              {fmtDuration(session.endTime - session.startTime)}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleShare}
            disabled={sharing}
            style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "rgba(10, 10, 15, 0.85)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
              opacity: sharing ? 0.5 : 1,
            }}
          >
            <Share2 size={18} color={CYAN} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>

        {/* Reward-moment headline — see summaryLine() above */}
        <View style={{ alignItems: "center", paddingHorizontal: 16, paddingTop: 20 }}>
          <View
            style={{
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderRadius: 20,
              backgroundColor: "rgba(10, 10, 15, 0.85)",
              borderWidth: 1,
              borderColor:
                session.riskCounts.high > 0
                  ? "rgba(255, 61, 61, 0.35)"
                  : session.riskCounts.medium > 0
                    ? "rgba(255, 215, 64, 0.35)"
                    : "rgba(0, 230, 118, 0.35)",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 20,
                color: "#F0F0F5",
                marginBottom: 4,
              }}
            >
              {fmtDuration(session.endTime - session.startTime)} monitored
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 13,
                letterSpacing: 0.3,
                color:
                  session.riskCounts.high > 0
                    ? RISK_HIGH
                    : session.riskCounts.medium > 0
                      ? RISK_MEDIUM
                      : RISK_LOW,
              }}
            >
              {summaryLine(session.riskCounts)}
            </Text>
          </View>
        </View>

        {/* Risk-along-route legend */}
        <View
          style={{
            alignItems: "flex-end",
            paddingHorizontal: 16,
            paddingTop: 8,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 9999,
              backgroundColor: "rgba(10, 10, 15, 0.85)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
            }}
          >
            {[
              { label: session.riskCounts.low, color: RISK_LOW },
              { label: session.riskCounts.medium, color: RISK_MEDIUM },
              { label: session.riskCounts.high, color: RISK_HIGH },
            ].map((item, i) => (
              <View
                key={i}
                style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: item.color,
                  }}
                />
                <Text
                  style={{
                    fontFamily: "JetBrainsMono_400Regular",
                    fontSize: 11,
                    color: "#F0F0F5",
                  }}
                >
                  {item.label}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </SafeAreaView>

      {/* Get Directions — opens the actual Google Maps app for a clearer,
          familiar view of the route from start to end point. */}
      <TouchableOpacity
        onPress={handleGetDirections}
        activeOpacity={0.8}
        style={{
          position: "absolute",
          bottom: 28,
          alignSelf: "center",
          flexDirection: "row",
          alignItems: "center",
          gap: 8,
          paddingHorizontal: 20,
          paddingVertical: 12,
          borderRadius: 9999,
          backgroundColor: "#00E5FF",
        }}
      >
        <Navigation size={16} color="#001F24" strokeWidth={2} />
        <Text
          style={{
            fontFamily: "JetBrainsMono_400Regular",
            fontSize: 13,
            letterSpacing: 0.5,
            color: "#001F24",
          }}
        >
          GET DIRECTIONS
        </Text>
      </TouchableOpacity>

      {/* Off-screen — never shown, only captured by handleShare() above.
          The OS share sheet's own thumbnail preview stands in for an
          on-screen preview, so there's no separate preview modal. */}
      <View style={{ position: "absolute", top: -9999, left: -9999 }}>
        <ShareCard
          ref={shareCardRef}
          durationLabel={fmtDuration(session.endTime - session.startTime)}
          outcomeLabel={summaryLine(session.riskCounts)}
          riskCounts={session.riskCounts}
        />
      </View>
    </View>
  );
}
