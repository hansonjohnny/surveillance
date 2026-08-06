import { useRouter } from "expo-router";
import {
  ArrowLeft,
  HelpCircle,
  MapPinOff,
  PhoneOff,
  ShieldAlert,
  ShieldCheck,
  TrendingUp,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StatusBar, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { ContinueButton } from "../../components/ui/ContinueButton";
import { OptionCard, useStaggeredCards } from "../../components/ui/OptionCard";
import { useOnboardingStore } from "../../store/useOnboardingStore";
import { colors } from "../../theme/colors";

const TOTAL_STEPS = 12;
const CURRENT_STEP = 5;

const OPTIONS = [
  {
    value: "no_call",
    label: "Not being able to call for help",
    icon: PhoneOff,
  },
  { value: "location", label: "No one knowing my location", icon: MapPinOff },
  { value: "unsafe", label: "Feeling unsafe in public", icon: ShieldAlert },
  {
    value: "uncertainty",
    label: "Not knowing if something is really wrong",
    icon: HelpCircle,
  },
] as const;

type OptionValue = (typeof OPTIONS)[number]["value"];

export default function ConcernScreen() {
  const router = useRouter();
  const setOnboarding = useOnboardingStore((s) => s.set);
  const [selected, setSelected] = useState<OptionValue | null>(null);
  const { opacities, translates } = useStaggeredCards(OPTIONS.length);

  return (
    <View className="flex-1 bg-bg-primary">
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />

      {/* Header */}
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

        {/* Progress bar */}
        <View className="h-0.5 bg-white/[0.08] mx-5 rounded-full overflow-hidden">
          <View
            className="h-full bg-accent rounded-full"
            style={{ width: `${(CURRENT_STEP / TOTAL_STEPS) * 100}%` }}
          />
        </View>
      </SafeAreaView>

      {/* Scrollable content */}
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
            What worries you most?
          </Text>
          <Text className="font-body text-body-lg text-text-secondary">
            Tailoring your AI guardian to focus on your specific safety
            concerns.
          </Text>
        </View>

        {/* Option cards — single select */}
        <View className="px-5 gap-3">
          {OPTIONS.map((option, i) => (
            <OptionCard
              key={option.value}
              option={option}
              selected={selected === option.value}
              onPress={() => setSelected(option.value)}
              opacity={opacities[i]}
              translateY={translates[i]}
            />
          ))}
        </View>

        {/* AI Insight panel */}
        <AIInsightPanel concern={selected} />
      </ScrollView>

      {/* Bottom nav */}
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
            <ArrowLeft
              size={20}
              color={colors.text.secondary}
              strokeWidth={2}
            />
            <Text className="font-mono text-[10px] text-text-secondary tracking-[0.5px]">
              BACK
            </Text>
          </Pressable>

          <ContinueButton
            onPress={() => {
              if (!selected) return;
              setOnboarding({ concern: selected });
              router.push("/(onboarding)/contact" as any);
            }}
            enabled={!!selected}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

const INSIGHT_MAP: Record<OptionValue, string> = {
  no_call:
    "Guardian Eye will prioritise silent SOS triggers and one-tap emergency calling at every monitoring cycle.",
  location:
    "Guardian Eye will broadcast your live GPS coordinates to your emergency contact the moment risk is detected.",
  unsafe:
    "Guardian Eye will use camera and audio to scan for behavioural threats and flag anomalies in real time.",
  uncertainty:
    "Guardian Eye will consolidate every sensor signal into a single clear risk score so you always know where you stand.",
};

function AIInsightPanel({ concern }: { concern: OptionValue | null }) {
  const dotOpacity = useSharedValue(1);
  const panelOpacity = useSharedValue(0);
  const panelTranslate = useSharedValue(8);

  useEffect(() => {
    dotOpacity.value = withRepeat(
      withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);

  useEffect(() => {
    if (concern) {
      panelOpacity.value = withTiming(1, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
      panelTranslate.value = withTiming(0, {
        duration: 260,
        easing: Easing.out(Easing.cubic),
      });
    } else {
      panelOpacity.value = withTiming(0, { duration: 180 });
    }
  }, [concern]);

  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));
  const panelStyle = useAnimatedStyle(() => ({
    opacity: panelOpacity.value,
    transform: [{ translateY: panelTranslate.value }],
  }));

  return (
    <Animated.View
      style={[panelStyle, { marginHorizontal: 20, marginTop: 28 }]}
    >
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor: `${colors.accent}33`,
          backgroundColor: "rgba(0,229,255,0.05)",
          padding: 20,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        {/* Icon container */}
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            backgroundColor: colors.accentGlow,
            borderWidth: 1,
            borderColor: `${colors.accent}44`,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <TrendingUp size={20} color={colors.accent} strokeWidth={2} />
        </View>

        <View className="flex-1">
          {/* Label row */}
          <View className="flex-row items-center gap-2 mb-2">
            <Animated.View
              style={[
                dotStyle,
                {
                  width: 6,
                  height: 6,
                  borderRadius: 3,
                  backgroundColor: colors.accent,
                },
              ]}
            />
            <Text
              style={{
                fontFamily: "JetBrainsMono_400Regular",
                fontSize: 10,
                color: colors.accent,
                letterSpacing: 1.2,
              }}
            >
              AI INSIGHT
            </Text>
          </View>

          <Text
            className="font-body text-body-md text-text-secondary"
            style={{ lineHeight: 20 }}
          >
            {concern ? INSIGHT_MAP[concern] : ""}
          </Text>
        </View>
      </View>
    </Animated.View>
  );
}
