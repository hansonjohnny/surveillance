import type { Event, RiskLevel } from "@/types";
import { formatAddress } from "@/lib/location";
import { MapPin, Mic } from "lucide-react-native";
import { Image, Text, TouchableOpacity, View } from "react-native";

// ─── Risk config ──────────────────────────────────────────────────────────────
const RISK: Record<
  RiskLevel,
  { color: string; bg: string; border: string; label: string }
> = {
  low: {
    color: "#00E676",
    bg: "rgba(0, 230, 118, 0.12)",
    border: "rgba(0, 230, 118, 0.30)",
    label: "LOW",
  },
  medium: {
    color: "#FFD740",
    bg: "rgba(255, 215, 64, 0.12)",
    border: "rgba(255, 215, 64, 0.30)",
    label: "MEDIUM",
  },
  high: {
    color: "#FF3D3D",
    bg: "rgba(255, 61, 61, 0.12)",
    border: "rgba(255, 61, 61, 0.30)",
    label: "HIGH",
  },
};

function formatShort(ms: number): string {
  const d = new Date(ms);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${yyyy}.${mm}.${dd} | ${hh}:${min}:${ss}`;
}

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  event: Event;
  onPress: () => void;
};

// ─── EventCard ────────────────────────────────────────────────────────────────
export function EventCard({ event, onPress }: Props) {
  const r = RISK[event.riskLevel];
  const hasFooter = !!(event.photoUri || event.transcript || event.location);

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      style={{
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.10)",
        borderRadius: 16,
        marginBottom: 12,
        overflow: "hidden",
      }}
    >
      {/* 3px left risk edge bar */}
      <View
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: r.color,
          shadowColor: r.color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 6,
        }}
      />

      <View style={{ padding: 20, paddingLeft: 20 }}>
        {/* Top row: risk badge + timestamp */}
        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
          }}
        >
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 9999,
              backgroundColor: r.bg,
              borderWidth: 1,
              borderColor: r.border,
            }}
          >
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 11,
                letterSpacing: 0.8,
                textTransform: "uppercase",
                color: r.color,
              }}
            >
              {r.label}
            </Text>
          </View>

          <Text
            style={{
              fontFamily: "JetBrainsMono_400Regular",
              fontSize: 11,
              color: "#8888A0",
            }}
          >
            {formatShort(event.timestamp)}
          </Text>
        </View>

        {/* AI summary — capped at 3 lines in collapsed view */}
        <Text
          numberOfLines={3}
          style={{
            fontFamily: "DMSans_400Regular",
            fontSize: 14,
            lineHeight: 22,
            color: "#8888A0",
            marginBottom: hasFooter ? 14 : 0,
          }}
        >
          {event.aiSummary}
        </Text>

        {/* Footer: location + thumbnail + transcript excerpt */}
        {hasFooter && (
          <View
            style={{
              gap: 8,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: "rgba(255, 255, 255, 0.06)",
            }}
          >
            {/* Location row — address if available, coordinates as fallback */}
            {event.location ? (
              <View
                style={{ flexDirection: "row", alignItems: "flex-start", gap: 6 }}
              >
                <MapPin size={12} color="#00E5FF" strokeWidth={1.5} style={{ marginTop: 2, flexShrink: 0 }} />
                <Text
                  numberOfLines={2}
                  style={{
                    fontFamily: "JetBrainsMono_400Regular",
                    fontSize: 11,
                    color: "#00B8CC",
                    flex: 1,
                  }}
                >
                  {event.location.address
                    ? formatAddress(event.location.address)
                    : `${event.location.lat.toFixed(5)}, ${event.location.lng.toFixed(5)}`}
                </Text>
              </View>
            ) : null}

            {/* Photo thumbnail + transcript excerpt */}
            {event.photoUri || event.transcript ? (
              <View
                style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
              >
                {event.photoUri ? (
                  <View
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 8,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: "rgba(255, 255, 255, 0.10)",
                      flexShrink: 0,
                    }}
                  >
                    <Image
                      source={{ uri: event.photoUri }}
                      style={{ width: 40, height: 40 }}
                      resizeMode="cover"
                    />
                  </View>
                ) : null}

                {event.transcript ? (
                  <View
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      alignItems: "flex-start",
                      gap: 5,
                    }}
                  >
                    <Mic
                      size={12}
                      color="#8888A0"
                      strokeWidth={1.5}
                      style={{ marginTop: 2, flexShrink: 0 }}
                    />
                    <Text
                      numberOfLines={1}
                      style={{
                        flex: 1,
                        fontFamily: "DMSans_400Regular",
                        fontSize: 13,
                        fontStyle: "italic",
                        color: "#555568",
                      }}
                    >
                      "{event.transcript}"
                    </Text>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}
