import { useRouter } from "expo-router";
import { ArrowLeft, Baby, ShieldCheck, Users } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StatusBar, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ContinueButton } from "../../components/ui/ContinueButton";
import { OptionCard, useStaggeredCards } from "../../components/ui/OptionCard";
import { useOnboardingStore } from "../../store/useOnboardingStore";
import { colors } from "../../theme/colors";

// Guardian-only branch of onboarding, reached from account-type.tsx when
// "For someone I care about" is chosen. Purely descriptive — unlike the
// old who.tsx branch this replaces, this never decides account type
// (accountType is already set by account-type.tsx by the time this
// screen is reached). No "myself" option, and no progress bar — this
// mini-flow isn't part of the 12-step self-monitoring survey.

const OPTIONS = [
  { value: "child", label: "My son / daughter", icon: Baby },
  { value: "other", label: "Someone else", icon: Users },
] as const;

type OptionValue = (typeof OPTIONS)[number]["value"];

export default function GuardianWhoScreen() {
  const router = useRouter();
  const setOnboarding = useOnboardingStore((s) => s.set);
  const [selected, setSelected] = useState<OptionValue | null>(null);
  const { opacities, translates } = useStaggeredCards(OPTIONS.length);

  return (
    <View className="flex-1 bg-bg-primary">
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />

      {/* Header */}
      <SafeAreaView edges={["top"]}>
        <View className="flex-row items-center px-5 h-14">
          <ShieldCheck size={20} color={colors.accent} strokeWidth={2} />
          <Text
            className="font-display-bold text-[18px] text-accent ml-2"
            style={{ letterSpacing: -0.3 }}
          >
            Surveillance AI
          </Text>
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
            Who do you want to monitor?
          </Text>
          <Text className="font-body text-body-lg text-text-secondary">
            You'll add their details after setting up your own account.
          </Text>
        </View>

        {/* Option cards */}
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
      </ScrollView>

      {/* Bottom nav — always visible */}
      <SafeAreaView
        edges={["bottom"]}
        className="bg-bg-primary border-t border-border-subtle"
      >
        <View className="flex-row items-center justify-between px-5 py-4">
          {/* Back */}
          <Pressable
            onPress={() => router.push("/(onboarding)/account-type" as any)}
            className="items-center gap-0.5"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <ArrowLeft size={20} color={colors.text.secondary} strokeWidth={2} />
            <Text className="font-mono text-[10px] text-text-secondary tracking-[0.5px]">
              BACK
            </Text>
          </Pressable>

          {/* Continue */}
          <ContinueButton
            onPress={() => {
              if (!selected) return;
              setOnboarding({ wardRelation: selected });
              router.push("/(onboarding)/guardian-setup" as any);
            }}
            enabled={!!selected}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
