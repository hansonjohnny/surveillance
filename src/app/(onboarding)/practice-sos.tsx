// Practice/dry-run SOS — idea #5 from the retention-hook brainstorm.
// Lets the user see exactly what a real High-risk alert looks like
// (SMS → Email → Call, one after another) before they ever need it, with
// zero real cost or risk: purely a client-side animation, no Arkesel/
// SendGrid/edge-function calls at all. See lib/alerts.ts's triggerAlert
// for what the REAL sequence actually does — this screen exists so the
// user has already seen that shape once, calmly, during onboarding.
//
// Sits between speed.tsx (the "11 min vs 30 sec" stat) and
// preferences.tsx — speed.tsx makes the abstract claim, this screen
// proves it. No progress bar, same treatment as speed.tsx: this is an
// interactive demo moment, not a data-collection step, so it isn't
// counted as one of the numbered 12.

import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Check,
  Mail,
  MessageSquare,
  Phone,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StatusBar, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { ContinueButton } from "../../components/ui/ContinueButton";
import { useOnboardingStore } from "../../store/useOnboardingStore";
import { colors } from "../../theme/colors";

type ChannelStatus = "pending" | "active" | "done";

type Channel = {
  id: "sms" | "email" | "call";
  label: string;
  icon: typeof MessageSquare;
  durationMs: number;
};

const CHANNELS: Channel[] = [
  { id: "sms", label: "Text message", icon: MessageSquare, durationMs: 700 },
  { id: "email", label: "Email report", icon: Mail, durationMs: 900 },
  { id: "call", label: "Phone call", icon: Phone, durationMs: 1100 },
];

export default function PracticeSOSScreen() {
  const router = useRouter();
  const contactName = useOnboardingStore((s) => s.data.contactName);
  const displayName = contactName?.trim() || "your contact";

  const [phase, setPhase] = useState<"idle" | "running" | "done">("idle");
  const [statuses, setStatuses] = useState<Record<string, ChannelStatus>>(
    Object.fromEntries(CHANNELS.map((c) => [c.id, "pending"])) as Record<
      string,
      ChannelStatus
    >,
  );

  async function runSimulation() {
    if (phase !== "idle") return;
    setPhase("running");
    for (const channel of CHANNELS) {
      setStatuses((prev) => ({ ...prev, [channel.id]: "active" }));
      await delay(channel.durationMs);
      setStatuses((prev) => ({ ...prev, [channel.id]: "done" }));
      await delay(200);
    }
    setPhase("done");
  }

  return (
    <View className="flex-1 bg-bg-primary">
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />

      {/* Header — no progress bar, same treatment as speed.tsx */}
      <SafeAreaView edges={["top"]}>
        <View className="flex-row items-center justify-between px-5 h-14">
          <View className="flex-row items-center gap-2">
            <ShieldCheck size={20} color={colors.accent} strokeWidth={2} />
            <Text
              className="font-display-bold text-[18px] text-accent"
              style={{ letterSpacing: -0.3 }}
            >
              Surveillance AI
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/")}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text className="font-body-medium text-body-md text-text-secondary">
              Skip
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Headline */}
        <View className="px-5 mt-9 mb-8">
          <Text
            className="font-display-bold text-[32px] leading-[40px] text-text-primary mb-2.5"
            style={{ letterSpacing: -0.5 }}
          >
            See it in action.
          </Text>
          <Text className="font-body text-body-lg text-text-secondary">
            A practice run — nothing is actually sent to {displayName}. This
            is exactly what happens the moment real danger is detected.
          </Text>
        </View>

        {phase === "idle" ? (
          <View className="px-5">
            <Pressable
              onPress={runSimulation}
              style={({ pressed }) => ({
                height: 56,
                borderRadius: 9999,
                backgroundColor: colors.risk.high,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 10,
                opacity: pressed ? 0.85 : 1,
                shadowColor: colors.risk.high,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.45,
                shadowRadius: 18,
              })}
            >
              <ShieldAlert size={20} color="#0A0A0F" strokeWidth={2} />
              <Text
                style={{
                  fontFamily: "DMSans_500Medium",
                  fontSize: 16,
                  letterSpacing: 0.3,
                  color: "#0A0A0F",
                }}
              >
                Simulate Emergency
              </Text>
            </Pressable>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, gap: 12 }}>
            {CHANNELS.map((channel, index) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                status={statuses[channel.id]}
                index={index}
              />
            ))}
          </View>
        )}

        {phase === "done" && (
          <View
            style={{
              marginTop: 20,
              marginHorizontal: 20,
              padding: 16,
              borderRadius: 14,
              backgroundColor: "rgba(0,230,118,0.06)",
              borderWidth: 1,
              borderColor: "rgba(0,230,118,0.25)",
            }}
          >
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 14,
                color: colors.risk.low,
                marginBottom: 4,
              }}
            >
              {displayName} would have been notified.
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 12,
                color: colors.text.secondary,
                lineHeight: 18,
              }}
            >
              This was a practice run — nothing was actually sent. In a real
              High risk event, this happens automatically in under 30
              seconds.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Bottom nav — Continue always enabled, practice run is optional */}
      <SafeAreaView
        edges={["bottom"]}
        className="bg-bg-primary border-t border-border-subtle"
      >
        <View className="flex-row items-center justify-between px-5 py-4">
          <Pressable
            onPress={() => router.back()}
            className="items-center gap-0.5"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <ArrowLeft size={20} color={colors.text.secondary} strokeWidth={2} />
            <Text className="font-mono text-[10px] text-text-secondary tracking-[0.5px]">
              BACK
            </Text>
          </Pressable>

          <ContinueButton
            onPress={() => router.push("/(onboarding)/preferences" as any)}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Channel row ────────────────────────────────────────────────────────────

function ChannelRow({
  channel,
  status,
  index,
}: {
  channel: Channel;
  status: ChannelStatus;
  index: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(
      index * 80,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
    translateY.value = withDelay(
      index * 80,
      withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const isDone = status === "done";
  const isActive = status === "active";
  const Icon = channel.icon;

  const borderColor = isDone
    ? "rgba(0,230,118,0.25)"
    : isActive
      ? `${colors.risk.high}40`
      : "rgba(255,255,255,0.08)";

  const bgColor = isDone
    ? "rgba(0,230,118,0.05)"
    : isActive
      ? "rgba(255,61,61,0.06)"
      : "rgba(255,255,255,0.03)";

  return (
    <Animated.View
      style={[
        containerStyle,
        {
          borderRadius: 16,
          borderWidth: 1,
          borderColor,
          backgroundColor: bgColor,
          padding: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        },
      ]}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: isDone
            ? "rgba(0,230,118,0.12)"
            : isActive
              ? "rgba(255,61,61,0.10)"
              : "rgba(255,255,255,0.04)",
          borderWidth: 1,
          borderColor: isDone
            ? "rgba(0,230,118,0.35)"
            : isActive
              ? `${colors.risk.high}40`
              : "rgba(255,255,255,0.08)",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isDone ? (
          <CheckPop />
        ) : isActive ? (
          <PulseDot />
        ) : (
          <Icon size={16} color="rgba(255,255,255,0.3)" strokeWidth={1.5} />
        )}
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: isDone ? "DMSans_500Medium" : "DMSans_400Regular",
            fontSize: 15,
            color: isDone
              ? colors.risk.low
              : isActive
                ? colors.risk.high
                : colors.text.secondary,
            marginBottom: 3,
          }}
        >
          {channel.label}
        </Text>
        <Text
          style={{
            fontFamily: "JetBrainsMono_400Regular",
            fontSize: 10,
            color: isDone
              ? "rgba(0,230,118,0.55)"
              : isActive
                ? "rgba(255,61,61,0.7)"
                : colors.text.tertiary,
            letterSpacing: 0.8,
            textTransform: "uppercase",
          }}
        >
          {isDone ? "SENT" : isActive ? "SENDING..." : "QUEUED"}
        </Text>
      </View>
    </Animated.View>
  );
}

function CheckPop() {
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, {
      duration: 240,
      easing: Easing.out(Easing.back(1.8)),
    });
    opacity.value = withTiming(1, { duration: 180 });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={style}>
      <Check size={16} color={colors.risk.low} strokeWidth={2.5} />
    </Animated.View>
  );
}

function PulseDot() {
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(1, { duration: 500, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, []);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        style,
        {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.risk.high,
        },
      ]}
    />
  );
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
