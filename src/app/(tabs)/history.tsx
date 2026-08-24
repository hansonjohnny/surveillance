import { useSessionHistoryStore } from "@/store/useSessionHistoryStore";
import { useRouter } from "expo-router";
import { ChevronRight, MapPinned } from "lucide-react-native";
import {
  FlatList,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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

function fmtDate(ts: number) {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function EmptyState() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 80,
        paddingHorizontal: 32,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: "rgba(0, 229, 255, 0.08)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <MapPinned size={32} color="#555568" strokeWidth={1.5} />
      </View>
      <Text
        style={{
          fontFamily: "Outfit_600SemiBold",
          fontSize: 18,
          color: "#F0F0F5",
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        No sessions yet
      </Text>
      <Text
        style={{
          fontFamily: "DMSans_400Regular",
          fontSize: 14,
          color: MUTED,
          textAlign: "center",
          lineHeight: 20,
        }}
      >
        Start and stop a surveillance session on Home to see its path and risk
        report here.
      </Text>
    </View>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const sessions = useSessionHistoryStore((s) => s.sessions);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
        <View
          style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 }}
        >
          <Text
            style={{
              fontFamily: "Outfit_700Bold",
              fontSize: 24,
              color: "#F0F0F5",
            }}
          >
            Session History
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 13,
              color: MUTED,
              marginTop: 2,
            }}
          >
            Tap a session to see the path taken and risk report
          </Text>
        </View>

        <FlatList
          data={sessions}
          keyExtractor={(item) => item.id}
          contentContainerStyle={
            sessions.length === 0
              ? { flex: 1 }
              : { paddingHorizontal: 16, paddingBottom: 24 }
          }
          ListEmptyComponent={EmptyState}
          renderItem={({ item }) => (
            <TouchableOpacity
              onPress={() => router.push(`/session/${item.id}`)}
              activeOpacity={0.75}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                paddingHorizontal: 16,
                paddingVertical: 14,
                borderRadius: 14,
                backgroundColor: "rgba(255,255,255,0.04)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
                marginBottom: 10,
              }}
            >
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontFamily: "Outfit_600SemiBold",
                    fontSize: 15,
                    color: "#F0F0F5",
                  }}
                >
                  {fmtDate(item.startTime)}
                </Text>
                <Text
                  style={{
                    fontFamily: "JetBrainsMono_400Regular",
                    fontSize: 12,
                    color: MUTED,
                    marginTop: 3,
                  }}
                >
                  {fmtDuration(item.endTime - item.startTime)} ·{" "}
                  {item.path.length} points
                </Text>
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 10,
                    marginTop: 8,
                  }}
                >
                  {[
                    { count: item.riskCounts.low, color: RISK_LOW },
                    { count: item.riskCounts.medium, color: RISK_MEDIUM },
                    { count: item.riskCounts.high, color: RISK_HIGH },
                  ].map((r, i) => (
                    <View
                      key={i}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <View
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: 3.5,
                          backgroundColor: r.color,
                        }}
                      />
                      <Text
                        style={{
                          fontFamily: "JetBrainsMono_400Regular",
                          fontSize: 11,
                          color: "#F0F0F5",
                        }}
                      >
                        {r.count}
                      </Text>
                    </View>
                  ))}
                </View>
              </View>
              <ChevronRight size={18} color={CYAN} strokeWidth={1.5} />
            </TouchableOpacity>
          )}
        />
      </SafeAreaView>
    </View>
  );
}
