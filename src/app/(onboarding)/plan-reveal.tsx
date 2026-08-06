import { useRouter } from "expo-router";
import { ArrowRight, BarChart2, ShieldCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StatusBar, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { ShieldPulse } from "../../components/ui/ShieldPulse";
import { useOnboardingStore } from "../../store/useOnboardingStore";
import { useSettingsStore } from "../../store/useSettingsStore";

export default function PlanRevealScreen() {
  const router = useRouter();
  const { data, complete } = useOnboardingStore();

  const contactName = data.contactName?.trim() || "Emergency Contact";
  const interval = data.interval ?? 30;
  const who = data.who ?? "Myself";

  // Single entrance animation for all content
  const contentOpacity = useSharedValue(0);
  const contentY = useSharedValue(24);

  useEffect(() => {
    contentOpacity.value = withTiming(1, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
    contentY.value = withTiming(0, {
      duration: 500,
      easing: Easing.out(Easing.cubic),
    });
  }, []);

  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentY.value }],
  }));

  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleStart() {
    setSaveError(null);
    setSaving(true);
    try {
      await complete();
      // Mark onboarding done before navigating to registration so that
      // if the session is ever lost, the routing gate shows sign-in
      // rather than re-running the entire onboarding flow.
      useSettingsStore.getState().markOnboardingComplete();
      router.replace("/(auth)/sign-up" as never);
    } catch (err) {
      console.error("[PlanReveal] Failed to save onboarding data:", err);
      setSaveError(
        'Failed to save your settings. Tap "Get Started" to try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="flex-1 bg-[#0A0A0F]">
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />

      {/* Atmospheric glow blobs */}
      <View
        className="absolute rounded-full pointer-events-none"
        style={{
          top: "-10%",
          right: "-10%",
          width: "50%",
          height: "50%",
          backgroundColor: "rgba(0,229,255,0.06)",
        }}
      />
      <View
        className="absolute rounded-full pointer-events-none"
        style={{
          bottom: "-10%",
          left: "-10%",
          width: "50%",
          height: "50%",
          backgroundColor: "rgba(0,229,255,0.05)",
        }}
      />

      <SafeAreaView className="flex-1" edges={["top"]}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-5 h-16 border-b border-white/10">
          <View className="flex-row items-center gap-2">
            <ShieldCheck size={20} color="#00E5FF" strokeWidth={2} />
            <Text
              className="text-lg text-[#00E5FF]"
              style={{ fontFamily: "Outfit_700Bold" }}
            >
              Surveillance AI
            </Text>
          </View>
          <Pressable
            onPress={handleStart}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text
              className="text-sm text-[#8888A0]"
              style={{ fontFamily: "DMSans_400Regular" }}
            >
              Skip
            </Text>
          </Pressable>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{ paddingBottom: 120, paddingHorizontal: 20 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View style={contentStyle}>
            {/* Headline */}
            <View className="items-center mt-10 mb-8">
              <Text
                className="text-[34px] leading-[42px] text-[#F0F0F5] text-center mb-2"
                style={{ fontFamily: "Outfit_700Bold", letterSpacing: -0.5 }}
              >
                Surveillance AI is ready.
              </Text>
              <Text
                className="text-base leading-[26px] text-[#8888A0] text-center"
                style={{ fontFamily: "DMSans_400Regular" }}
              >
                Your high-performance guardian is calibrated and operational.
              </Text>
            </View>

            {/* Shield pulse */}
            <View className="items-center mb-8">
              <ShieldPulse />
            </View>

            {/* Protocol summary card */}
            <View
              className="rounded-2xl border border-white/10 p-5"
              style={{ backgroundColor: "rgba(255,255,255,0.04)" }}
            >
              {/* Card header */}
              <View className="flex-row items-center gap-3 pb-4 border-b border-white/[0.06] mb-2">
                <BarChart2 size={20} color="#00E5FF" strokeWidth={1.5} />
                <Text
                  className="text-[17px] text-[#F0F0F5]"
                  style={{ fontFamily: "Outfit_600SemiBold" }}
                >
                  System Protocol Summary
                </Text>
              </View>

              {/* Row: Protecting */}
              <SummaryRow
                label="PROTECTING"
                value={who}
                right={
                  <View className="px-3 py-1 rounded-full bg-[rgba(0,229,255,0.10)] border border-[rgba(0,229,255,0.20)]">
                    <Text
                      className="text-[11px] text-[#00E5FF] uppercase"
                      style={{
                        fontFamily: "JetBrainsMono_400Regular",
                        letterSpacing: 0.8,
                      }}
                    >
                      ACTIVE
                    </Text>
                  </View>
                }
              />

              <Divider />

              {/* Row: Emergency contact */}
              <SummaryRow
                label="EMERGENCY CONTACT"
                value={`${contactName} (Trusted)`}
                right={
                  <ShieldCheck size={20} color="#8888A0" strokeWidth={1.5} />
                }
              />

              <Divider />

              {/* Row: Monitoring interval */}
              <SummaryRow
                label="MONITORING INTERVAL"
                value="Real-time AI Analysis"
                right={
                  <Text
                    className="text-sm text-[#F0F0F5]"
                    style={{ fontFamily: "JetBrainsMono_400Regular" }}
                  >
                    {interval}s
                  </Text>
                }
              />

              {/* Neural link status */}
              <View className="mt-5 pt-4 border-t border-white/[0.06]">
                <View className="flex-row items-center gap-2 mb-2">
                  <PulsingDot />
                  <Text
                    className="text-[11px] text-[#00E676] uppercase"
                    style={{
                      fontFamily: "JetBrainsMono_400Regular",
                      letterSpacing: 1,
                    }}
                  >
                    Neural Link Established
                  </Text>
                </View>
                <View className="h-1 rounded-full bg-white/[0.05] overflow-hidden">
                  <View
                    className="h-full w-full bg-[#00E5FF] rounded-full"
                    style={{
                      shadowColor: "#00E5FF",
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.5,
                      shadowRadius: 8,
                    }}
                  />
                </View>
              </View>
            </View>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>

      {/* Fixed bottom CTA */}
      <SafeAreaView
        edges={["bottom"]}
        className="absolute bottom-0 left-0 right-0 border-t border-white/10 px-5 pt-4"
        style={{ backgroundColor: "rgba(10,10,15,0.92)" }}
      >
        {saveError ? (
          <Text
            className="text-[13px] text-[#ff4d4d] text-center mb-2.5"
            style={{ fontFamily: "DMSans_400Regular" }}
          >
            {saveError}
          </Text>
        ) : null}
        <Pressable
          onPress={handleStart}
          disabled={saving}
          className="h-14 rounded-full bg-[#00E5FF] flex-row items-center justify-center gap-2"
          style={({ pressed }) => ({
            opacity: saving ? 0.55 : pressed ? 0.88 : 1,
            shadowColor: "#00E5FF",
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.45,
            shadowRadius: 18,
          })}
        >
          <Text
            className="text-base text-[#0A0A0F]"
            style={{ fontFamily: "DMSans_500Medium", letterSpacing: 0.3 }}
          >
            {saving
              ? "Saving…"
              : saveError
                ? "Get Started"
                : "Start My First Session"}
          </Text>
          {!saving && <ArrowRight size={18} color="#0A0A0F" strokeWidth={2} />}
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

// ─── Summary row ──────────────────────────────────────────────────────────────

function SummaryRow({
  label,
  value,
  right,
}: {
  label: string;
  value: string;
  right: React.ReactNode;
}) {
  return (
    <View className="flex-row items-center justify-between py-3">
      <View className="flex-1">
        <Text
          className="text-[10px] text-[#8888A0] uppercase mb-0.5"
          style={{ fontFamily: "JetBrainsMono_400Regular", letterSpacing: 0.8 }}
        >
          {label}
        </Text>
        <Text
          className="text-base text-[#F0F0F5] leading-[22px]"
          style={{ fontFamily: "DMSans_400Regular" }}
        >
          {value}
        </Text>
      </View>
      <View className="ml-3">{right}</View>
    </View>
  );
}

// ─── Divider ──────────────────────────────────────────────────────────────────

function Divider() {
  return <View className="h-px bg-white/[0.05]" />;
}

// ─── Pulsing dot ──────────────────────────────────────────────────────────────

function PulsingDot() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const cfg = { duration: 700, easing: Easing.inOut(Easing.ease) };
    scale.value = withRepeat(
      withSequence(withTiming(1.6, cfg), withTiming(1, cfg)),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(withTiming(0.3, cfg), withTiming(1, cfg)),
      -1,
      false,
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      className="w-2 h-2 rounded-full bg-[#00E676]"
      style={style}
    />
  );
}
