import { useRouter } from "expo-router";
import { ArrowLeft, Users } from "lucide-react-native";
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
import { useOnboardingStore } from "../../store/useOnboardingStore";
import { useSettingsStore } from "../../store/useSettingsStore";
import { colors } from "../../theme/colors";

// The guardian branch of onboarding — reached from who.tsx when the answer
// isn't "myself". Deliberately skips every self-monitoring-specific screen
// (emergency contact, monitoring interval/shake sensitivity, camera/mic/
// location permissions) since none of those apply to a phone that isn't
// the one being monitored. Ends the same way plan-reveal.tsx does for the
// self path — mark onboarding complete, then to sign-up — but lands on
// the Guardian dashboard afterward instead of Home (see sign-up.tsx and
// app/_layout.tsx's role-aware routing).
export default function GuardianSetupScreen() {
  const router = useRouter();
  const { complete } = useOnboardingStore();

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

  async function handleContinue() {
    // Mark onboarding done before navigating to registration, same as
    // plan-reveal.tsx, so a lost session shows sign-in rather than
    // re-running onboarding. syncToSupabase (contact/settings) is NOT
    // called for this path — see sign-up.tsx, which branches on role and
    // skips it, since a guardian has no monitoring preferences to sync.
    await complete();
    useSettingsStore.getState().markOnboardingComplete();
    router.replace("/(auth)/sign-up" as never);
  }

  return (
    <View className="flex-1 bg-bg-primary">
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />

      <SafeAreaView edges={["top"]}>
        <View className="flex-row items-center px-5 h-14">
          <Pressable
            onPress={() => router.back()}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <ArrowLeft size={20} color={colors.text.secondary} strokeWidth={2} />
          </Pressable>
        </View>
      </SafeAreaView>

      <View className="flex-1 items-center justify-center px-6">
        <View
          className="items-center justify-center mb-10"
          style={{ width: 160, height: 160 }}
        >
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
            <Users size={48} color={colors.accent} strokeWidth={1.5} />
          </View>
        </View>

        <Text
          className="font-display-bold text-center text-text-primary mb-5"
          style={{ fontSize: 32, lineHeight: 40, letterSpacing: -0.5 }}
        >
          You're setting up to monitor someone else
        </Text>

        <Text
          className="font-body text-body-lg text-text-secondary text-center mb-10"
          style={{ lineHeight: 26 }}
        >
          Your account becomes a{" "}
          <Text className="text-accent font-body-medium">guardian</Text> —
          you'll see their live status, event log, and alerts, not run
          monitoring on this phone yourself. Create your account, then add
          the person you're protecting.
        </Text>
      </View>

      <SafeAreaView
        edges={["bottom"]}
        className="bg-bg-primary border-t border-border-subtle"
      >
        <View className="flex-row items-center justify-end px-5 py-4">
          <ContinueButton onPress={handleContinue} />
        </View>
      </SafeAreaView>
    </View>
  );
}
