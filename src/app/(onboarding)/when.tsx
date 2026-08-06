import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Luggage,
  Moon,
  PartyPopper,
  PersonStanding,
  Shield,
  ShieldCheck,
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
const CURRENT_STEP = 2;

const OPTIONS = [
  { value: "parties", label: "Parties and social events", icon: PartyPopper },
  { value: "travelling", label: "Travelling alone", icon: Luggage },
  { value: "late_nights", label: "Late nights out", icon: Moon },
  {
    value: "commuting",
    label: "Commuting or walking alone",
    icon: PersonStanding,
  },
  { value: "all_time", label: "All the time", icon: Shield },
] as const;

type OptionValue = (typeof OPTIONS)[number]["value"];

export default function WhenScreen() {
  const router = useRouter();
  const setOnboarding = useOnboardingStore((s) => s.set);
  const [selected, setSelected] = useState<Set<OptionValue>>(new Set());
  const { opacities, translates } = useStaggeredCards(OPTIONS.length);

  function toggle(value: OptionValue) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return next;
    });
  }

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
            When do you usually want protection?
          </Text>
          <Text className="font-body text-body-lg text-text-secondary">
            Select all that apply to help the AI guardian prioritise your
            security context.
          </Text>
        </View>

        {/* Option cards — multi-select */}
        <View className="px-5 gap-3">
          {OPTIONS.map((option, i) => (
            <OptionCard
              key={option.value}
              option={option}
              selected={selected.has(option.value)}
              onPress={() => toggle(option.value)}
              multiSelect
              opacity={opacities[i]}
              translateY={translates[i]}
            />
          ))}
        </View>

        {/* Atmospheric panel */}
        <AtmosphericPanel />
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
              setOnboarding({ when: Array.from(selected) });
              router.push("/(onboarding)/who" as any);
            }}
            enabled={selected.size > 0}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}

function AtmosphericPanel() {
  const dotOpacity = useSharedValue(1);

  useEffect(() => {
    dotOpacity.value = withRepeat(
      withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);

  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  return (
    <View
      className="mx-5 mt-7 rounded-xl overflow-hidden border border-border-subtle bg-bg-secondary"
      style={{ height: 140 }}
    >
      {/* Grid decoration */}
      <View className="absolute inset-0 opacity-[0.15]">
        {[0, 1, 2, 3].map((row) => (
          <View
            key={row}
            style={{
              position: "absolute",
              top: row * 35,
              left: 0,
              right: 0,
              height: 1,
              backgroundColor: colors.accent,
            }}
          />
        ))}
        {[0, 1, 2, 3, 4, 5].map((col) => (
          <View
            key={col}
            style={{
              position: "absolute",
              left: col * 70,
              top: 0,
              bottom: 0,
              width: 1,
              backgroundColor: colors.accent,
            }}
          />
        ))}
      </View>

      {/* Glow centre */}
      <View
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: 120,
          height: 120,
          marginTop: -60,
          marginLeft: -60,
          borderRadius: 60,
          backgroundColor: "rgba(0,229,255,0.06)",
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 40,
        }}
      />

      {/* Label */}
      <View className="absolute bottom-4 left-5 flex-row items-center gap-2">
        <Animated.View
          style={[
            dotStyle,
            {
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: colors.accent,
            },
          ]}
        />
        <Text className="font-mono text-[11px] text-accent tracking-[1.2px]">
          AI CONTEXT ENGINE ACTIVE
        </Text>
      </View>
    </View>
  );
}
