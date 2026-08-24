import { LiveMap } from "@/components/map/LiveMap";
import { buildDirectionsUrl } from "@/lib/maps";
import { useSessionHistoryStore } from "@/store/useSessionHistoryStore";
import { useLocalSearchParams, useRouter } from "expo-router";
import { ArrowLeft, Navigation } from "lucide-react-native";
import { Linking, StatusBar, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

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

export default function SessionDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const session = useSessionHistoryStore((s) =>
    s.sessions.find((r) => r.id === id),
  );

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
    </View>
  );
}
