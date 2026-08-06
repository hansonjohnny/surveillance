import { useRouter } from "expo-router";
import { Eye, Network, ShieldCheck } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StatusBar, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { ContinueButton } from "../components/ui/ContinueButton";
import { useOnboardingStore } from "../store/useOnboardingStore";
import { colors } from "../theme/colors";

export default function IndexScreen() {
  const router = useRouter();
  const { isComplete, hydrate } = useOnboardingStore();
  const [hydrated, setHydrated] = useState(false);

  const ring1Scale = useSharedValue(1);
  const ring1Opacity = useSharedValue(0.8);
  const ring2Scale = useSharedValue(1);
  const ring2Opacity = useSharedValue(0.5);
  const dotOpacity = useSharedValue(1);

  useEffect(() => {
    hydrate().then(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (hydrated && isComplete) {
      router.replace("/(tabs)/home");
    }
  }, [hydrated, isComplete]);

  useEffect(() => {
    if (!hydrated || isComplete) return;
    const cfg = { duration: 2000, easing: Easing.inOut(Easing.ease) };

    ring1Scale.value = withRepeat(
      withSequence(withTiming(1.15, cfg), withTiming(1, cfg)),
      -1,
      false,
    );
    ring1Opacity.value = withRepeat(
      withSequence(withTiming(0.3, cfg), withTiming(0.8, cfg)),
      -1,
      false,
    );

    ring2Scale.value = withDelay(
      500,
      withRepeat(
        withSequence(withTiming(1.15, cfg), withTiming(1, cfg)),
        -1,
        false,
      ),
    );
    ring2Opacity.value = withDelay(
      500,
      withRepeat(
        withSequence(withTiming(0.2, cfg), withTiming(0.5, cfg)),
        -1,
        false,
      ),
    );

    dotOpacity.value = withRepeat(
      withTiming(0.3, { duration: 900, easing: Easing.inOut(Easing.sin) }),
      -1,
      true,
    );
  }, []);

  const ring1Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring1Scale.value }],
    opacity: ring1Opacity.value,
  }));

  const ring2Style = useAnimatedStyle(() => ({
    transform: [{ scale: ring2Scale.value }],
    opacity: ring2Opacity.value,
  }));

  const dotStyle = useAnimatedStyle(() => ({ opacity: dotOpacity.value }));

  if (!hydrated || isComplete) return null;

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
          {/* Skip placeholder — retarget when post-onboarding route exists */}
        </View>
      </SafeAreaView>

      {/* Scrollable body */}
      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          flexGrow: 1,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 24,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Shield pulse */}
        <View className="w-64 h-64 items-center justify-center mb-10">
          <Animated.View
            style={[
              ring2Style,
              {
                position: "absolute",
                width: 256,
                height: 256,
                borderRadius: 128,
                borderWidth: 1,
                borderColor: `${colors.accent}1A`,
              },
            ]}
          />
          <Animated.View
            style={[
              ring1Style,
              {
                position: "absolute",
                width: 192,
                height: 192,
                borderRadius: 96,
                borderWidth: 1,
                borderColor: `${colors.accent}33`,
              },
            ]}
          />
          <View
            style={{
              width: 128,
              height: 128,
              borderRadius: 64,
              backgroundColor: `${colors.accent}18`,
              borderWidth: 1,
              borderColor: `${colors.accent}4D`,
              alignItems: "center",
              justifyContent: "center",
              shadowColor: colors.accent,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.4,
              shadowRadius: 24,
              elevation: 12,
            }}
          >
            <ShieldCheck
              size={52}
              color={colors.accent}
              strokeWidth={1.5}
              fill={`${colors.accent}22`}
            />
          </View>
        </View>

        {/* Headline */}
        <Text
          className="font-display-bold text-[32px] leading-[40px] text-center mb-4"
          style={{ letterSpacing: -0.5 }}
        >
          <Text className="text-text-primary">Your safety, </Text>
          <Text className="text-accent">always on.</Text>
        </Text>

        {/* Subtext */}
        <Text className="font-body text-body-lg text-text-secondary text-center px-4 mb-10">
          Surveillance AI watches over you so the people who love you do not
          have to worry. Hyper-modern protection for the high-performance life.
        </Text>

        {/* Feature cards */}
        <View className="w-full gap-3">
          <FeatureCard
            icon={<Eye size={20} color={colors.risk.low} strokeWidth={2} />}
            iconBg={colors.risk.lowGlow}
            iconBorder={colors.risk.lowBorder}
            label="REAL-TIME MONITORING"
            description="24/7 AI-driven sentinel mode."
          />
          <FeatureCard
            icon={<Network size={20} color={colors.accent} strokeWidth={2} />}
            iconBg={colors.accentGlow}
            iconBorder={`${colors.accent}44`}
            label="NETWORKED SAFETY"
            description="Immediate emergency broadcasts."
          />
        </View>
      </ScrollView>

      {/* Bottom — fixed CTA + status chips */}
      <SafeAreaView edges={["bottom"]} className="bg-bg-primary">
        <View className="px-5 pt-3 pb-2 items-center">
          {/* Get Started button */}
          <ContinueButton
            onPress={() => router.push("/(onboarding)/when")}
            label="GET STARTED"
          />

          {/* Returning user escape hatch */}
          <Pressable
            onPress={() => router.push("/(auth)/sign-in")}
            className="mt-4 py-2"
            hitSlop={12}
          >
            <Text className="font-body text-body-sm text-text-secondary text-center">
              Already have an account?{" "}
              <Text className="text-accent font-body-medium">Sign in</Text>
            </Text>
          </Pressable>

          {/* Status chips */}
          <View className="flex-row gap-3 mt-4 mb-1">
            <View className="flex-row items-center gap-1.5 px-3 py-1 rounded-full border border-risk-low/25 bg-risk-low/5">
              <Animated.View
                style={[
                  dotStyle,
                  {
                    width: 6,
                    height: 6,
                    borderRadius: 3,
                    backgroundColor: colors.risk.low,
                  },
                ]}
              />
              <Text
                style={{
                  fontFamily: "JetBrainsMono_400Regular",
                  fontSize: 10,
                  color: colors.risk.low,
                  letterSpacing: 0.5,
                }}
              >
                SYSTEM ONLINE
              </Text>
            </View>

            <View className="flex-row items-center px-3 py-1 rounded-full border border-border-subtle bg-bg-glass">
              <Text
                style={{
                  fontFamily: "JetBrainsMono_400Regular",
                  fontSize: 10,
                  color: colors.text.secondary,
                  letterSpacing: 0.5,
                }}
              >
                V2.4.0 STABLE
              </Text>
            </View>
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
}

function FeatureCard({
  icon,
  iconBg,
  iconBorder,
  label,
  description,
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconBorder: string;
  label: string;
  description: string;
}) {
  return (
    <View className="flex-row items-center gap-4 p-4 rounded-xl border border-border-default bg-bg-glass">
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 10,
          backgroundColor: iconBg,
          borderWidth: 1,
          borderColor: iconBorder,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </View>
      <View className="flex-1">
        <Text
          style={{
            fontFamily: "JetBrainsMono_400Regular",
            fontSize: 10,
            color: colors.text.secondary,
            letterSpacing: 0.8,
            marginBottom: 2,
          }}
        >
          {label}
        </Text>
        <Text className="font-body-medium text-body-md text-text-primary">
          {description}
        </Text>
      </View>
    </View>
  );
}
