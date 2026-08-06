import { Image } from "expo-image";
import { useRouter } from "expo-router";
import {
  ArrowLeft,
  ShieldCheck,
  Star,
  Zap,
} from "lucide-react-native";
import { useEffect } from "react";
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
import { ContinueButton } from "../../components/ui/ContinueButton";
import { colors } from "../../theme/colors";

const TOTAL_STEPS = 12;
const CURRENT_STEP = 9;

const TESTIMONIAL_URI =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDsZY7s5OzQn1771qpXdkEXwimXOpJwR2JDxbHg85H_NbPE9g_OUwyNn04A18c_Htwf3t0ZyLYE1MjfasC1_OOAQMp33vCKfFtTe_yA4JsyPrl-onyKSZ7wmgkUuJB6UUvlS0mJkpYutIIF6_GlyTQEMC6toknzQtuvoJ9Oet5pKc_Bnjm_9RGbuOEqpzSvdgN1jiqDcX_cWU0D0vI8SyVyHFZVDCdNs7hOv6Xdrg8A9w7JuvZqDob0IGvbO8UDkZS8UMLx2rbJVCs";

const AVATARS = [
  "https://lh3.googleusercontent.com/aida-public/AB6AXuDMBRh_GoD_7XcRyDtNWt4kDPy--mAydEi8RVHl9IdNTvMT2jsZFVnxidnp_5WFBfukU2-txQzm-zGIepvHYlxNufw77oqmB4MSB_jDBVxAjtTnqNo7UakjOoiCZ7zrRZjg-HL9oRpEI3KcXSk-zWBALDx2MJ-KvzE8_1k9XBHOHZUC2fx7gvo2dShZusF1TPna5kXO9MS0hnDT8tcJTCEPUIX_lIyvDIjg1XPxPPTUgPXKXLPc5bEyJZ2NI7C99kiFn5e5fKomew4",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuA5SyTz9j_pxY9s80R2IMcX6UKCiCC2eqccmWvIb7katoTA00wU6aOHvLDlCr2rQG3yAy7OaasUj-qHE1z9Jd72OGN0Ay3P6_D-c-4Aw1TJPTEZjSxcIufFb2WLfkNdK-Ipz9tnMddqp73RYoZbs3Uon_ybkBliuXPMJ0UEy8kR9P4jyJLSoMYmz6aD7fBUYpeiCb6lSkfM9O3rJlU_2J-vE_f-bVkGOJYKliIVcoBip0HIN2-s-A2Hc-4q-uhbYJW19siD3vMpHgQ",
  "https://lh3.googleusercontent.com/aida-public/AB6AXuB7nU9MCXwz0LRHx-zforDi7O_ay0ZWr9Cwcc4NcfNmLpR5Jk2N49ASd5TzegEZVxCpfR4gH8TJ851Uo1XzbKgRCbxJd0HvPIgflW3YiiFoxSs-6kPPdgJfwr9Qk14fFESczGvJjrpjkdPJwDvCgfhZ8XLIsp_pBcpHtVoSTERO0zcZqYSFnnjMtChHUswAr1585okRzyUTBHinqchhrs7e85TmT-TRnmnflrQeqybkLImHcUAxpj4z2Bktdyn1GX-WGqEZKa6OhOw",
];

export default function SocialProofScreen() {
  const router = useRouter();

  // Staggered entrance animations
  const badgeOpacity = useSharedValue(0);
  const badgeY = useSharedValue(16);
  const headlineOpacity = useSharedValue(0);
  const headlineY = useSharedValue(16);
  const cardOpacity = useSharedValue(0);
  const cardY = useSharedValue(24);
  const metricsOpacity = useSharedValue(0);
  const metricsY = useSharedValue(16);
  const avatarsOpacity = useSharedValue(0);

  // Background glow pulse
  const glowOpacity = useSharedValue(0.3);
  const glowScale = useSharedValue(1);

  useEffect(() => {
    badgeOpacity.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    badgeY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) });

    headlineOpacity.value = withDelay(80, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
    headlineY.value = withDelay(80, withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) }));

    cardOpacity.value = withDelay(180, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
    cardY.value = withDelay(180, withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) }));

    metricsOpacity.value = withDelay(300, withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }));
    metricsY.value = withDelay(300, withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) }));

    avatarsOpacity.value = withDelay(420, withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }));

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.2, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
    glowScale.value = withRepeat(
      withSequence(
        withTiming(1.15, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
        withTiming(1.0, { duration: 2200, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const badgeStyle = useAnimatedStyle(() => ({
    opacity: badgeOpacity.value,
    transform: [{ translateY: badgeY.value }],
  }));
  const headlineStyle = useAnimatedStyle(() => ({
    opacity: headlineOpacity.value,
    transform: [{ translateY: headlineY.value }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }],
  }));
  const metricsStyle = useAnimatedStyle(() => ({
    opacity: metricsOpacity.value,
    transform: [{ translateY: metricsY.value }],
  }));
  const avatarsStyle = useAnimatedStyle(() => ({ opacity: avatarsOpacity.value }));
  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

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

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Stars badge */}
        <View className="items-center mt-10 mb-6 px-5">
          <Animated.View style={badgeStyle}>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 8,
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 9999,
                borderWidth: 1,
                borderColor: colors.border.default,
                backgroundColor: colors.bg.glass,
              }}
            >
              {/* 4 full stars */}
              {[0, 1, 2, 3].map((i) => (
                <Star
                  key={i}
                  size={14}
                  color={colors.accent}
                  fill={colors.accent}
                  strokeWidth={1.5}
                />
              ))}
              {/* 5th star — dimmed to show 4.8 */}
              <Star
                size={14}
                color={colors.accentDim}
                fill={colors.accentDim}
                strokeWidth={1.5}
                style={{ opacity: 0.45 }}
              />
              <Text
                style={{
                  fontFamily: "JetBrainsMono_400Regular",
                  fontSize: 11,
                  color: colors.accent,
                  letterSpacing: 1,
                  textTransform: "uppercase",
                  marginLeft: 4,
                }}
              >
                50,000+ Users Protected
              </Text>
            </View>
          </Animated.View>
        </View>

        {/* Headline */}
        <Animated.View style={[headlineStyle, { paddingHorizontal: 20, marginBottom: 28 }]}>
          <Text
            className="font-display-bold text-[32px] leading-[40px] text-text-primary"
            style={{ letterSpacing: -0.5 }}
          >
            Trusted by people{"\n"}
            <Text style={{ color: colors.accent }}>who travel alone</Text>
          </Text>
        </Animated.View>

        {/* Testimonial card + glow */}
        <View className="px-5 mb-4">
          <Animated.View style={cardStyle}>
            <View style={{ position: "relative" }}>
              {/* Background glow blob */}
              <Animated.View
                style={[
                  glowStyle,
                  {
                    position: "absolute",
                    top: -40,
                    alignSelf: "center",
                    width: 240,
                    height: 240,
                    borderRadius: 120,
                    backgroundColor: "rgba(0,229,255,0.07)",
                  },
                ]}
                pointerEvents="none"
              />

              {/* Glass card */}
              <View
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: colors.border.default,
                  backgroundColor: colors.bg.glass,
                  padding: 20,
                  overflow: "hidden",
                }}
              >
                {/* Decorative quote mark */}
                <Text
                  style={{
                    position: "absolute",
                    top: -8,
                    right: 12,
                    fontFamily: "Outfit_700Bold",
                    fontSize: 96,
                    color: `${colors.accent}18`,
                    lineHeight: 100,
                    userSelect: "none",
                  }}
                >
                  "
                </Text>

                {/* Quote text */}
                <Text
                  style={{
                    fontFamily: "DMSans_400Regular",
                    fontSize: 16,
                    lineHeight: 26,
                    color: colors.text.primary,
                    fontStyle: "italic",
                    marginBottom: 20,
                    paddingRight: 32,
                  }}
                >
                  "My daughter travels for work every week. This app is the only
                  reason I sleep at night."
                </Text>

                {/* Author row */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 24,
                      overflow: "hidden",
                      borderWidth: 1,
                      borderColor: colors.border.default,
                    }}
                  >
                    <Image
                      source={{ uri: TESTIMONIAL_URI }}
                      style={{ width: 48, height: 48 }}
                      contentFit="cover"
                    />
                  </View>
                  <View>
                    <Text
                      style={{
                        fontFamily: "Outfit_600SemiBold",
                        fontSize: 15,
                        color: colors.text.primary,
                        marginBottom: 2,
                      }}
                    >
                      Margaret A.
                    </Text>
                    <Text
                      style={{
                        fontFamily: "JetBrainsMono_400Regular",
                        fontSize: 10,
                        color: colors.text.secondary,
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                      }}
                    >
                      Verified Parent & User
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </Animated.View>
        </View>

        {/* Metric cards — 2 columns */}
        <Animated.View
          style={[
            metricsStyle,
            { flexDirection: "row", gap: 12, paddingHorizontal: 20, marginBottom: 24 },
          ]}
        >
          {/* App Store rating */}
          <View
            style={{
              flex: 1,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: colors.border.default,
              backgroundColor: colors.bg.glass,
              padding: 18,
              alignItems: "center",
              gap: 6,
            }}
          >
            <ShieldCheck size={22} color={colors.accent} strokeWidth={1.5} />
            <Text
              style={{
                fontFamily: "JetBrainsMono_400Regular",
                fontSize: 24,
                color: colors.accent,
                letterSpacing: -0.5,
                shadowColor: colors.accent,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 8,
              }}
            >
              4.8
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 10,
                color: colors.text.secondary,
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
              App Store
            </Text>
          </View>

          {/* Response time */}
          <View
            style={{
              flex: 1,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: `${colors.risk.low}28`,
              backgroundColor: `${colors.risk.low}06`,
              padding: 18,
              alignItems: "center",
              gap: 6,
            }}
          >
            <Zap size={22} color={colors.risk.low} strokeWidth={1.5} />
            <Text
              style={{
                fontFamily: "JetBrainsMono_400Regular",
                fontSize: 24,
                color: colors.risk.low,
                letterSpacing: -0.5,
                shadowColor: colors.risk.low,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.6,
                shadowRadius: 8,
              }}
            >
              2s
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 10,
                color: colors.text.secondary,
                letterSpacing: 0.8,
                textTransform: "uppercase",
              }}
            >
              Response Time
            </Text>
          </View>
        </Animated.View>

        {/* Avatar stack */}
        <Animated.View style={[avatarsStyle, { alignItems: "center" }]}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {AVATARS.map((uri, i) => (
              <View
                key={i}
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 20,
                  overflow: "hidden",
                  borderWidth: 2,
                  borderColor: colors.bg.primary,
                  marginLeft: i === 0 ? 0 : -12,
                  zIndex: AVATARS.length - i,
                }}
              >
                <Image
                  source={{ uri }}
                  style={{ width: 40, height: 40 }}
                  contentFit="cover"
                />
              </View>
            ))}
            {/* +50k badge */}
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                borderWidth: 2,
                borderColor: colors.bg.primary,
                backgroundColor: colors.accent,
                alignItems: "center",
                justifyContent: "center",
                marginLeft: -12,
                zIndex: 0,
              }}
            >
              <Text
                style={{
                  fontFamily: "DMSans_500Medium",
                  fontSize: 9,
                  color: colors.bg.primary,
                  letterSpacing: 0.3,
                  fontWeight: "700",
                }}
              >
                +50k
              </Text>
            </View>
          </View>
        </Animated.View>
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
            <ArrowLeft size={20} color={colors.text.secondary} strokeWidth={2} />
            <Text className="font-mono text-[10px] text-text-secondary tracking-[0.5px]">
              BACK
            </Text>
          </Pressable>

          <ContinueButton
            onPress={() => router.push("/(onboarding)/permissions" as any)}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
