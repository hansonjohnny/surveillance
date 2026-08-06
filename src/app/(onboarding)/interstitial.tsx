import { useRouter } from "expo-router";
import { ArrowLeft, Check, ShieldCheck, Sparkles } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, StatusBar, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { ContinueButton } from "../../components/ui/ContinueButton";
import { colors } from "../../theme/colors";

// No progress bar on motivational screens per design spec — let the user breathe

export default function InterstitialScreen() {
  const router = useRouter();

  const glowScale = useSharedValue(1);
  const glowOpacity = useSharedValue(0.5);

  useEffect(() => {
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.35, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.8, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.4, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const glowStyle = useAnimatedStyle(() => ({
    transform: [{ scale: glowScale.value }],
    opacity: glowOpacity.value,
  }));

  return (
    <View className="flex-1 bg-bg-primary">
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />

      {/* Header — no progress bar on motivational screens */}
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

      {/* Centred body */}
      <View className="flex-1 items-center justify-center px-6">
        {/* Shield illustration */}
        <View
          className="items-center justify-center mb-10"
          style={{ width: 160, height: 160 }}
        >
          {/* Breathing glow ring */}
          <Animated.View
            style={[
              glowStyle,
              {
                position: "absolute",
                width: 140,
                height: 140,
                borderRadius: 70,
                backgroundColor: "rgba(0,229,255,0.07)",
                shadowColor: colors.accent,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.45,
                shadowRadius: 40,
              },
            ]}
          />

          {/* Circle container */}
          <View
            style={{
              width: 104,
              height: 104,
              borderRadius: 52,
              backgroundColor: "rgba(255,255,255,0.04)",
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.10)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ShieldCheck size={48} color={colors.accent} strokeWidth={1.5} />
          </View>

          {/* Checkmark badge */}
          <View
            style={{
              position: "absolute",
              bottom: 14,
              right: 14,
              width: 30,
              height: 30,
              borderRadius: 15,
              backgroundColor: colors.accent,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 3,
              borderColor: colors.bg.primary,
              shadowColor: colors.accent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 8,
            }}
          >
            <Check size={14} color={colors.bg.primary} strokeWidth={3} />
          </View>
        </View>

        {/* Headline */}
        <Text
          className="font-display-bold text-center text-text-primary mb-5"
          style={{ fontSize: 34, lineHeight: 42, letterSpacing: -0.5 }}
        >
          You are already thinking ahead.
        </Text>

        {/* Body */}
        <Text
          className="font-body text-body-lg text-text-secondary text-center mb-10"
          style={{ lineHeight: 26 }}
        >
          Most safety incidents happen when no one knows where you are.
          Surveillance AI changes that —{" "}
          <Text className="text-accent font-body-medium">
            silently and automatically.
          </Text>
        </Text>

        {/* Advanced Guard card */}
        <View
          className="w-full flex-row items-center gap-4 rounded-xl border border-border-default bg-bg-secondary"
          style={{ padding: 20 }}
        >
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
            }}
          >
            <Sparkles size={20} color={colors.accent} strokeWidth={2} />
          </View>
          <View className="flex-1">
            <Text
              style={{
                fontFamily: "JetBrainsMono_400Regular",
                fontSize: 10,
                color: colors.accent,
                letterSpacing: 1.2,
                marginBottom: 4,
              }}
            >
              ADVANCED GUARD
            </Text>
            <Text className="font-body text-body-md text-text-secondary">
              The AI monitors your path without you ever needing to touch your
              phone.
            </Text>
          </View>
        </View>
      </View>

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
            onPress={() => router.push("/(onboarding)/concern" as any)}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
