import { useRouter } from "expo-router";
import { ArrowLeft, EyeOff, ShieldCheck, Timer, Vibrate } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, StatusBar, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ContinueButton } from "../../components/ui/ContinueButton";
import {
  Interval,
  MonitoringIntervalPicker,
} from "../../components/ui/MonitoringIntervalPicker";
import {
  Sensitivity,
  ShakeSensitivityPicker,
} from "../../components/ui/ShakeSensitivityPicker";
import { useOnboardingStore } from "../../store/useOnboardingStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { colors } from "../../theme/colors";

const SENS_MAP = { 0: "low", 1: "medium", 2: "high" } as const;

const TOTAL_STEPS = 12;
const CURRENT_STEP = 7;

export default function PreferencesScreen() {
  const router = useRouter();
  const setOnboarding = useOnboardingStore((s) => s.set);

  const [monitoringInterval, setMonitoringInterval] = useState<Interval>(20);
  const [sensitivity, setSensitivity] = useState<Sensitivity>(1);
  const [stealthMode, setStealthMode] = useState(true);

  function handleContinue() {
    setOnboarding({ interval: monitoringInterval, sensitivity, stealthMode });
    useSettingsStore.getState().updateSettings({
      monitoringInterval,
      shakeSensitivity: SENS_MAP[sensitivity],
      stealthMode,
    });
    router.push("/(onboarding)/social-proof" as any);
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-primary" edges={["top", "bottom"]}>
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />

      {/* Header */}
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
      <View className="h-0.5 mx-5 rounded-full overflow-hidden bg-white/[0.08]">
        <View
          className="h-0.5 rounded-full bg-accent"
          style={{ width: `${(CURRENT_STEP / TOTAL_STEPS) * 100}%` }}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Headline */}
        <View className="px-5 mt-9 mb-7">
          <Text
            className="font-display-bold text-[32px] leading-10 text-text-primary mb-2.5"
            style={{ letterSpacing: -0.5 }}
          >
            How should the app monitor you?
          </Text>
          <Text className="font-body text-body-lg text-text-secondary">
            Configure the AI's detection parameters to balance battery life and
            responsiveness.
          </Text>
        </View>

        <View className="px-5 gap-4">
          {/* Monitoring Interval */}
          <View className="rounded-lg border border-border-default bg-bg-glass p-5">
            <View className="flex-row items-center gap-2.5 mb-[18px]">
              <Timer size={20} color={colors.accent} strokeWidth={1.5} />
              <Text className="font-display-semi text-[17px] text-text-primary">
                Monitoring interval
              </Text>
            </View>
            <MonitoringIntervalPicker
              value={monitoringInterval}
              onChange={setMonitoringInterval}
              hideHeader
            />
            <Text className="font-body text-data-md text-text-secondary italic text-center mt-3.5">
              Lower intervals provide faster response times at higher battery usage.
            </Text>
          </View>

          {/* Shake Sensitivity */}
          <View className="rounded-lg border border-border-default bg-bg-glass p-5">
            <View className="flex-row items-center gap-2.5 mb-[18px]">
              <Vibrate size={20} color={colors.accent} strokeWidth={1.5} />
              <Text className="font-display-semi text-[17px] text-text-primary">
                Shake sensitivity
              </Text>
            </View>
            <ShakeSensitivityPicker
              value={sensitivity}
              onChange={setSensitivity}
              showDescription
              hideHeader
            />
          </View>

          {/* Stealth Mode */}
          <View className="rounded-lg border border-border-default bg-bg-glass p-5">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1 gap-3.5">
                <View
                  className="w-10 h-10 rounded-[10px] items-center justify-center border"
                  style={{
                    backgroundColor: "rgba(0,229,255,0.10)",
                    borderColor: `${colors.accent}33`,
                  }}
                >
                  <EyeOff size={18} color={colors.accent} strokeWidth={1.5} />
                </View>
                <View className="flex-1">
                  <Text className="font-display-semi text-[17px] leading-[22px] text-text-primary">
                    Stealth mode
                  </Text>
                  <Text className="font-body text-data-md text-text-secondary mt-0.5">
                    Discreet UI and no audible alerts
                  </Text>
                </View>
              </View>
              <Switch
                value={stealthMode}
                onValueChange={setStealthMode}
                trackColor={{
                  false: "rgba(255,255,255,0.10)",
                  true: `${colors.accent}55`,
                }}
                thumbColor={stealthMode ? colors.accent : colors.text.tertiary}
                ios_backgroundColor="rgba(255,255,255,0.10)"
              />
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Bottom nav */}
      <View className="border-t border-border-subtle bg-bg-primary">
        <View className="flex-row items-center justify-between px-5 py-4">
          <Pressable
            onPress={() => router.back()}
            className="items-center gap-0.5"
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <ArrowLeft size={20} color={colors.text.secondary} strokeWidth={2} />
            <Text
              className="font-mono text-[10px] text-text-secondary"
              style={{ letterSpacing: 0.5 }}
            >
              BACK
            </Text>
          </Pressable>
          <ContinueButton onPress={handleContinue} />
        </View>
      </View>
    </SafeAreaView>
  );
}
