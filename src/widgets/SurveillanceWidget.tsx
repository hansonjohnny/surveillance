// The home-screen widget's actual UI -- idea #4 from the retention-hook
// brainstorm. NOT a normal React Native view tree: react-native-android-
// widget walks this JSX and maps it onto native Android RemoteViews, so
// only its FlexWidget/TextWidget/SvgWidget primitives and their (much
// more limited) style props are valid here -- see widgetState.ts for the
// data this renders, and widgetTaskHandler.tsx / syncWidget.ts for the
// two places that actually call it.

import { FlexWidget, SvgWidget, TextWidget } from "react-native-android-widget";
import type { RiskLevel } from "../types";

const BG = "#0A0A0F" as const;
const CYAN = "#00E5FF" as const;
const MUTED = "#8888A0" as const;
const RISK_LOW = "#00E676" as const;
const RISK_MEDIUM = "#FFD740" as const;
const RISK_HIGH = "#FF3D3D" as const;
const TEXT_PRIMARY = "#F0F0F5" as const;

// Lucide's Shield path (src/components/... elsewhere in the app uses the
// real <Shield> component; RemoteViews can't render that, so this is the
// same path data as a raw SVG string via SvgWidget instead of an emoji,
// keeping design.md's "no emojis" rule even on this native surface).
const shieldSvg = (color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>`;

function riskColor(level: RiskLevel | null): typeof RISK_LOW | typeof RISK_MEDIUM | typeof RISK_HIGH {
  if (level === "high") return RISK_HIGH;
  if (level === "medium") return RISK_MEDIUM;
  return RISK_LOW;
}

export type SurveillanceWidgetProps = {
  isActive: boolean;
  riskLevel: RiskLevel | null;
  elapsedLabel: string | null;
};

export function SurveillanceWidget({
  isActive,
  riskLevel,
  elapsedLabel,
}: SurveillanceWidgetProps) {
  const highRisk = isActive && riskLevel === "high";
  const statusColor = isActive ? (highRisk ? RISK_HIGH : CYAN) : MUTED;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        height: "match_parent",
        width: "match_parent",
        backgroundColor: BG,
        borderRadius: 20,
        borderWidth: highRisk ? 1.5 : 0,
        borderColor: highRisk ? RISK_HIGH : undefined,
        padding: 16,
        flexDirection: "column",
        justifyContent: "space-between",
      }}
    >
      {/* Header */}
      <FlexWidget
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          width: "match_parent",
        }}
      >
        <FlexWidget style={{ flexDirection: "row", alignItems: "center" }}>
          <SvgWidget
            svg={shieldSvg(statusColor)}
            style={{ width: 15, height: 15, marginRight: 6 }}
          />
          <TextWidget
            text="SURVEILLANCE AI"
            style={{ fontSize: 10, letterSpacing: 1, color: MUTED }}
          />
        </FlexWidget>
        <TextWidget
          text={isActive ? "ACTIVE" : "INACTIVE"}
          style={{
            fontSize: 10,
            letterSpacing: 1,
            color: statusColor,
            fontWeight: "bold",
          }}
        />
      </FlexWidget>

      {/* Status glance -- only while a session is actually running */}
      {isActive && (
        <FlexWidget style={{ flexDirection: "column", alignItems: "flex-start" }}>
          <TextWidget
            text={elapsedLabel ?? "00:00:00"}
            style={{ fontSize: 26, color: TEXT_PRIMARY, fontWeight: "bold" }}
          />
          <TextWidget
            text={`Risk: ${(riskLevel ?? "low").toUpperCase()}`}
            style={{ fontSize: 12, color: riskColor(riskLevel), marginTop: 2 }}
          />
        </FlexWidget>
      )}

      {/* Quick action */}
      <FlexWidget
        clickAction="TOGGLE_SESSION"
        style={{
          height: 40,
          width: "match_parent",
          borderRadius: 9999,
          backgroundColor: isActive ? RISK_HIGH : CYAN,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <TextWidget
          text={isActive ? "STOP SESSION" : "START SURVEILLANCE"}
          style={{
            fontSize: 12,
            letterSpacing: 0.5,
            color: "#0A0A0F",
            fontWeight: "bold",
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
