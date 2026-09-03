// The visual "protected" card shared out from a session's summary screen —
// idea #3 from the retention-hook brainstorm. Rendered off-screen (see
// session/[id].tsx) and captured to a PNG via react-native-view-shot, then
// handed to expo-sharing's native share sheet.
//
// A static image, not the animated shield pulse from Home — the glow rings
// here are just layered semi-transparent circles (no Animated needed) so the
// capture looks right on the very first frame.

import { Shield } from "lucide-react-native";
import { forwardRef } from "react";
import { Text, View } from "react-native";
import ViewShot, { type ViewShotRef } from "react-native-view-shot";

const BG = "#0A0A0F";
const MUTED = "#8888A0";
const CYAN = "#00E5FF";
const RISK_LOW = "#00E676";
const RISK_MEDIUM = "#FFD740";
const RISK_HIGH = "#FF3D3D";

export type ShareCardProps = {
  durationLabel: string;
  outcomeLabel: string;
  riskCounts: { low: number; medium: number; high: number };
};

const CARD_WIDTH = 320;
const CARD_HEIGHT = 480;

export const ShareCard = forwardRef<ViewShotRef, ShareCardProps>(
  function ShareCard({ durationLabel, outcomeLabel, riskCounts }, ref) {
    const outcomeColor =
      riskCounts.high > 0 ? RISK_HIGH : riskCounts.medium > 0 ? RISK_MEDIUM : RISK_LOW;

    return (
      <ViewShot ref={ref} options={{ format: "png", quality: 1 }}>
        <View
          style={{
            width: CARD_WIDTH,
            height: CARD_HEIGHT,
            backgroundColor: BG,
            borderRadius: 28,
            padding: 28,
            justifyContent: "space-between",
          }}
        >
          {/* Wordmark */}
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Shield size={16} color={CYAN} strokeWidth={1.5} />
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 12,
                letterSpacing: 1.5,
                color: MUTED,
              }}
            >
              SURVEILLANCE AI
            </Text>
          </View>

          {/* Centrepiece */}
          <View style={{ alignItems: "center" }}>
            <View
              style={{
                width: 160,
                height: 160,
                borderRadius: 80,
                backgroundColor: "rgba(0, 229, 255, 0.06)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <View
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  backgroundColor: "rgba(0, 229, 255, 0.10)",
                  borderWidth: 1.5,
                  borderColor: "rgba(0, 229, 255, 0.40)",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Shield size={52} color={CYAN} strokeWidth={1.5} />
              </View>
            </View>

            <Text
              style={{
                fontFamily: "JetBrainsMono_400Regular",
                fontSize: 13,
                letterSpacing: 3,
                color: CYAN,
                marginTop: 24,
              }}
            >
              PROTECTED
            </Text>
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 28,
                lineHeight: 34,
                color: "#F0F0F5",
                marginTop: 10,
                textAlign: "center",
              }}
            >
              {durationLabel} monitored
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 14,
                letterSpacing: 0.3,
                color: outcomeColor,
                marginTop: 6,
              }}
            >
              {outcomeLabel}
            </Text>
          </View>

          {/* Tagline — Screen 1 of onboarding, surveillance_ai_plan.md */}
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 12,
              color: MUTED,
              textAlign: "center",
            }}
          >
            Your safety, always on.
          </Text>
        </View>
      </ViewShot>
    );
  },
);
