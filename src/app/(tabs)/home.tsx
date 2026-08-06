import { getRecordingPermissionsAsync } from "expo-audio";
import { Camera } from "expo-camera";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { useRouter } from "expo-router";
import { BellRing, History, Shield, Zap } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Alert, StatusBar, Text, TouchableOpacity, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { DegradedModeBanner } from "../../components/ui/DegradedModeBanner";
import { isCapReached } from "../../lib/plans";
import { ShieldPulse } from "../../components/ui/ShieldPulse";
import { SilentCamera } from "../../components/ui/SilentCamera";
import { StealthOverlay } from "../../components/ui/StealthOverlay";
import { runMonitoringCycle } from "../../lib/monitoring";
import { useSessionStore } from "../../store/useSessionStore";
import { useSettingsStore } from "../../store/useSettingsStore";

// ─── Design tokens (taken directly from code.html) ────────────────────────────
const CYAN = "#00DAF3"; // secondary-fixed-dim
const CYAN_BG = "#00E3FD"; // secondary-container — CTA button fill
const DARK_TEXT = "#001F24"; // on-secondary-fixed  — CTA button label
const BG = "#0A0A0F";
const MUTED = "#8888A0"; // on-surface-variant
const RISK_LOW = "#00E676";
const RISK_HIGH = "#FF3D3D";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(ms: number) {
  const s = Math.floor(ms / 1000);
  return [Math.floor(s / 3600), Math.floor((s % 3600) / 60), s % 60]
    .map((n) => n.toString().padStart(2, "0"))
    .join(":");
}

// ─── PulsingDot ───────────────────────────────────────────────────────────────
// Matches Tailwind's `animate-pulse` (opacity 1 ↔ 0.3 over 2s)

function PulsingDot() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 1000 }),
        withTiming(1.0, { duration: 1000 }),
      ),
      -1,
      false,
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        style,
        { width: 8, height: 8, borderRadius: 4, backgroundColor: CYAN },
      ]}
    />
  );
}

// ─── HomeScreen ───────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const {
    isActive,
    lastRiskLevel,
    lastAISummary,
    sessionStartTime,
    startSession,
    stopSession,
  } = useSessionStore();
  const monitoringInterval = useSettingsStore((s) => s.monitoringInterval);
  const stealthMode = useSettingsStore((s) => s.stealthMode);
  const plan = useSettingsStore((s) => s.plan);
  const todayUsage = useSettingsStore((s) => s.todayUsage);
  const capReached = isCapReached(plan, todayUsage);
  const [elapsed, setElapsed] = useState(0);
  const [cameraGranted, setCameraGranted] = useState(true);
  const [micGranted, setMicGranted] = useState(true);

  // Check camera and microphone permissions on mount to show degraded-mode
  // banners. Default to true so no banner flashes before the check resolves.
  useEffect(() => {
    async function checkPermissions() {
      try {
        const [camPerm, micPerm] = await Promise.all([
          Camera.getCameraPermissionsAsync(),
          getRecordingPermissionsAsync(),
        ]);
        setCameraGranted(camPerm.status === "granted");
        setMicGranted(micPerm.granted);
      } catch (err) {
        console.error("[home] checkPermissions failed:", err);
      }
    }
    checkPermissions();
  }, []);

  // Keep screen awake while surveillance is active
  useEffect(() => {
    if (isActive) {
      activateKeepAwakeAsync();
      return () => {
        deactivateKeepAwake();
      };
    }
  }, [isActive]);

  // Monitoring cycle — waits 2 s on session start so SilentCamera can
  // initialise before the first snapshot attempt, then repeats every
  // monitoringInterval seconds. Restarts if the interval setting changes.
  useEffect(() => {
    if (!isActive) return;
    let intervalId: ReturnType<typeof setInterval>;
    const delayId = setTimeout(() => {
      runMonitoringCycle();
      intervalId = setInterval(runMonitoringCycle, monitoringInterval * 1000);
    }, 2000);
    return () => {
      clearTimeout(delayId);
      clearInterval(intervalId);
    };
  }, [isActive, monitoringInterval]);

  function handleManualSOS() {
    Alert.alert(
      "Manual SOS",
      "SOS alerts are not yet configured. Please set up your emergency contact in Settings.",
      [{ text: "OK" }],
    );
  }

  // Timer — ticks every second while active
  useEffect(() => {
    if (!isActive || !sessionStartTime) {
      setElapsed(0);
      return;
    }
    setElapsed(Date.now() - sessionStartTime);
    const id = setInterval(
      () => setElapsed(Date.now() - sessionStartTime!),
      1000,
    );
    return () => clearInterval(id);
  }, [isActive, sessionStartTime]);

  // Risk badge colors
  const badge =
    lastRiskLevel === "high"
      ? {
          bg: "rgba(255,61,61,0.10)",
          border: "rgba(255,61,61,0.30)",
          text: RISK_HIGH,
        }
      : lastRiskLevel === "medium"
        ? {
            bg: "rgba(255,215,64,0.10)",
            border: "rgba(255,215,64,0.30)",
            text: "#FFD740",
          }
        : {
            bg: "rgba(0,230,118,0.10)",
            border: "rgba(0,230,118,0.30)",
            text: RISK_LOW,
          };

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      {isActive && <SilentCamera />}

      {/* Cyan wash — approximates radial-gradient(circle at 50% 30%, rgba(0,218,243,0.08) 0%, transparent 60%) */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: "50%",
          backgroundColor: "rgba(0,218,243,0.06)",
          borderBottomLeftRadius: 999,
          borderBottomRightRadius: 999,
        }}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <SafeAreaView edges={["top"]}>
        <View
          style={{
            height: 64,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255,255,255,0.10)",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Shield size={20} color={CYAN} strokeWidth={1.5} />
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 20,
                color: CYAN,
                letterSpacing: -0.3,
              }}
            >
              Surveillance AI
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/alerts")}
            style={{ padding: 8 }}
          >
            <BellRing
              size={24}
              color={CYAN}
              strokeWidth={1.5}
              style={{
                shadowColor: CYAN,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.3,
                shadowRadius: 8,
              }}
            />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <DegradedModeBanner cameraGranted={cameraGranted} micGranted={micGranted} />

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 20,
          paddingTop: 40,
          paddingBottom: 32,
        }}
      >
        {/* ── Upper 55% — Shield pulse area ────────────────────────────────── */}
        <View
          style={{
            flex: 5.5,
            width: "100%",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <ShieldPulse active={isActive} riskLevel={lastRiskLevel ?? "low"} />

          {/* Status pill + timer */}
          <View style={{ alignItems: "center", marginTop: 32, gap: 8 }}>
            {/* ACTIVE / INACTIVE pill */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 16,
                paddingVertical: 4,
                borderRadius: 9999,
                backgroundColor: `${CYAN}1A`,
                borderWidth: 1,
                borderColor: `${CYAN}33`,
              }}
            >
              {isActive ? (
                <PulsingDot />
              ) : (
                <View
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: CYAN,
                    opacity: 0.35,
                  }}
                />
              )}
              <Text
                style={{
                  fontFamily: "JetBrainsMono_400Regular",
                  fontSize: 13,
                  color: CYAN,
                  letterSpacing: 3,
                }}
              >
                {isActive ? "ACTIVE" : "INACTIVE"}
              </Text>
            </View>

            {/* Session timer */}
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 36,
                lineHeight: 44,
                letterSpacing: -0.5,
                color: "#F0F0F5",
              }}
            >
              {isActive ? fmt(elapsed) : "00:00:00"}
            </Text>
          </View>
        </View>

        {/* ── Lower 45% — Info + actions ───────────────────────────────────── */}
        <View
          style={{
            flex: 4.5,
            width: "100%",
            justifyContent: "flex-end",
            gap: 24,
          }}
        >
          {/* Last Risk Assessment glass card */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: "rgba(255,255,255,0.04)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
            }}
          >
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
            >
              <History size={20} color={MUTED} strokeWidth={1.5} />
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 14,
                  lineHeight: 22,
                  color: MUTED,
                }}
              >
                Last Risk Assessment
              </Text>
            </View>
            <View
              style={{
                paddingHorizontal: 12,
                paddingVertical: 4,
                borderRadius: 9999,
                backgroundColor: badge.bg,
                borderWidth: 1,
                borderColor: badge.border,
              }}
            >
              <Text
                style={{
                  fontFamily: "JetBrainsMono_400Regular",
                  fontSize: 11,
                  letterSpacing: 0.8,
                  color: badge.text,
                  textTransform: "uppercase",
                }}
              >
                {lastRiskLevel ?? "LOW"}
              </Text>
            </View>
          </View>
          {lastAISummary ? (
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 12,
                lineHeight: 18,
                color: MUTED,
                marginTop: 8,
                paddingHorizontal: 4,
              }}
              numberOfLines={2}
            >
              {lastAISummary}
            </Text>
          ) : null}

          {/* Status rows — opacity-60 */}
          <View style={{ gap: 12, paddingHorizontal: 8, opacity: 0.6 }}>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text
                style={{
                  fontFamily: "JetBrainsMono_400Regular",
                  fontSize: 11,
                  color: MUTED,
                  letterSpacing: 0.5,
                }}
              >
                NETWORK ENCRYPTION
              </Text>
              <Text
                style={{
                  fontFamily: "JetBrainsMono_400Regular",
                  fontSize: 11,
                  color: CYAN,
                  letterSpacing: 0.5,
                }}
              >
                256-BIT AES
              </Text>
            </View>
            <View
              style={{ flexDirection: "row", justifyContent: "space-between" }}
            >
              <Text
                style={{
                  fontFamily: "JetBrainsMono_400Regular",
                  fontSize: 11,
                  color: MUTED,
                  letterSpacing: 0.5,
                }}
              >
                DEVICE TRUST SCORE
              </Text>
              <Text
                style={{
                  fontFamily: "JetBrainsMono_400Regular",
                  fontSize: 11,
                  color: RISK_LOW,
                  letterSpacing: 0.5,
                }}
              >
                98/100
              </Text>
            </View>
          </View>

          {/* Cap reached banner */}
          {capReached && (
            <TouchableOpacity
              onPress={() => router.push('/upgrade')}
              activeOpacity={0.8}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 14, backgroundColor: 'rgba(255,215,64,0.08)', borderWidth: 1, borderColor: 'rgba(255,215,64,0.30)' }}
            >
              <Zap size={16} color="#FFD740" strokeWidth={1.5} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#FFD740' }}>
                  Daily analysis limit reached
                </Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#8888A0', marginTop: 1 }}>
                  Upgrade for more coverage
                </Text>
              </View>
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 11, color: '#FFD740' }}>
                UPGRADE →
              </Text>
            </TouchableOpacity>
          )}

          {/* Buttons */}
          <View style={{ gap: 16 }}>
            {/* Manual SOS — ghost pill, red border + text, no icon (matching HTML) */}
            <TouchableOpacity
              onPress={handleManualSOS}
              accessibilityLabel="Manual SOS"
              testID="manual-sos-button"
              activeOpacity={0.75}
              style={{
                paddingVertical: 16,
                paddingHorizontal: 24,
                borderRadius: 9999,
                borderWidth: 1,
                borderColor: RISK_HIGH,
                alignItems: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "JetBrainsMono_400Regular",
                  fontSize: 13,
                  letterSpacing: 1,
                  color: RISK_HIGH,
                  textTransform: "uppercase",
                }}
              >
                MANUAL SOS
              </Text>
            </TouchableOpacity>

            {/* Start / Stop — bright cyan fill, dark text, glow (matching HTML) */}
            <TouchableOpacity
              onPress={isActive ? stopSession : startSession}
              activeOpacity={0.88}
              style={{
                paddingVertical: 16,
                paddingHorizontal: 24,
                borderRadius: 9999,
                backgroundColor: CYAN_BG,
                alignItems: "center",
                shadowColor: "rgba(0,218,243,1)",
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.3,
                shadowRadius: 30,
                elevation: 10,
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  fontSize: 18,
                  color: DARK_TEXT,
                }}
              >
                {isActive ? "Stop Surveillance" : "Start Surveillance"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Stealth overlay — renders on top of everything when stealth mode is
          active and a session is running. Appears black to a bystander.
          Tap anywhere to peek at the screen for 3 seconds. */}
      <StealthOverlay
        isVisible={stealthMode && isActive}
        onWake={() => {}}
      />
    </View>
  );
}
