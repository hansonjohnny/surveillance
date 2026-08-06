import { useRouter } from "expo-router";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  ShieldCheck,
  Timer,
  TrendingUp,
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

// No progress bar on motivational screens per design spec

export default function SpeedScreen() {
  const router = useRouter();

  const card1Opacity = useSharedValue(0);
  const card1Translate = useSharedValue(20);
  const card2Opacity = useSharedValue(0);
  const card2Translate = useSharedValue(20);
  const noteOpacity = useSharedValue(0);
  const noteTranslate = useSharedValue(12);

  // Fills to ~5% — proportionally represents < 30 sec vs 11 min
  const barWidth = useSharedValue(0);

  // Slow glow pulse on the "With AI" card
  const glowOpacity = useSharedValue(0.2);

  useEffect(() => {
    card1Opacity.value = withTiming(1, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });
    card1Translate.value = withTiming(0, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });

    card2Opacity.value = withDelay(
      150,
      withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }),
    );
    card2Translate.value = withDelay(
      150,
      withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) }),
    );

    noteOpacity.value = withDelay(
      300,
      withTiming(1, { duration: 350, easing: Easing.out(Easing.cubic) }),
    );
    noteTranslate.value = withDelay(
      300,
      withTiming(0, { duration: 350, easing: Easing.out(Easing.cubic) }),
    );

    barWidth.value = withDelay(
      600,
      withTiming(5, { duration: 1400, easing: Easing.out(Easing.cubic) }),
    );

    glowOpacity.value = withRepeat(
      withSequence(
        withTiming(0.55, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        withTiming(0.18, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, []);

  const card1Style = useAnimatedStyle(() => ({
    opacity: card1Opacity.value,
    transform: [{ translateY: card1Translate.value }],
  }));

  const card2Style = useAnimatedStyle(() => ({
    opacity: card2Opacity.value,
    transform: [{ translateY: card2Translate.value }],
  }));

  const noteStyle = useAnimatedStyle(() => ({
    opacity: noteOpacity.value,
    transform: [{ translateY: noteTranslate.value }],
  }));

  const barStyle = useAnimatedStyle(() => ({
    width: `${barWidth.value}%` as any,
  }));

  const glowStyle = useAnimatedStyle(() => ({ opacity: glowOpacity.value }));

  return (
    <View className="flex-1 bg-bg-primary">
      <StatusBar barStyle="light-content" backgroundColor={colors.bg.primary} />

      {/* Header — no progress bar */}
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
            In an emergency, every second counts.
          </Text>
          <Text className="font-body text-body-lg text-text-secondary">
            Minutes can be the difference between safety and catastrophe. Our AI
            guardian ensures immediate response.
          </Text>
        </View>

        <View className="px-5">
          {/* Without Surveillance AI */}
          <Animated.View style={card1Style}>
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: colors.border.default,
                backgroundColor: colors.bg.secondary,
                padding: 20,
                opacity: 0.55,
              }}
            >
              <View className="flex-row items-start justify-between mb-5">
                <View style={{ flex: 1, marginRight: 12 }}>
                  <Text
                    style={{
                      fontFamily: "JetBrainsMono_400Regular",
                      fontSize: 10,
                      color: colors.text.tertiary,
                      letterSpacing: 1.2,
                      textTransform: "uppercase",
                      marginBottom: 6,
                    }}
                  >
                    Traditional Response
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 18,
                      color: colors.text.primary,
                      lineHeight: 24,
                    }}
                  >
                    Without Surveillance AI
                  </Text>
                </View>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: "rgba(255,255,255,0.04)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.08)",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Timer
                    size={18}
                    color={colors.text.tertiary}
                    strokeWidth={1.5}
                  />
                </View>
              </View>

              <View className="flex-row items-end justify-between mb-3">
                <Text
                  style={{
                    fontFamily: "JetBrainsMono_400Regular",
                    fontSize: 12,
                    color: colors.text.tertiary,
                  }}
                >
                  Average Response Time
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    fontSize: 22,
                    color: colors.text.tertiary,
                    letterSpacing: -0.5,
                  }}
                >
                  11 min
                </Text>
              </View>

              {/* Full bar — represents 11 min */}
              <View
                style={{
                  height: 6,
                  borderRadius: 9999,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  marginBottom: 16,
                  overflow: "hidden",
                }}
              >
                <View
                  style={{
                    height: 6,
                    borderRadius: 9999,
                    width: "100%",
                    backgroundColor: colors.text.tertiary,
                    opacity: 0.35,
                  }}
                />
              </View>

              <View className="flex-row items-start gap-2">
                <AlertTriangle
                  size={13}
                  color={colors.text.tertiary}
                  strokeWidth={1.5}
                  style={{ marginTop: 2 }}
                />
                <Text
                  style={{
                    fontFamily: "DMSans_400Regular",
                    fontSize: 12,
                    color: colors.text.tertiary,
                    fontStyle: "italic",
                    flex: 1,
                    lineHeight: 18,
                  }}
                >
                  Requires manual dialing and verbal location description.
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* VS divider */}
          <View className="flex-row items-center my-3">
            <View
              style={{
                flex: 1,
                height: 1,
                backgroundColor: "rgba(255,255,255,0.06)",
              }}
            />
            <View
              style={{
                paddingHorizontal: 14,
                paddingVertical: 5,
                borderRadius: 9999,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.10)",
                backgroundColor: colors.bg.primary,
                marginHorizontal: 12,
              }}
            >
              <Text
                style={{
                  fontFamily: "JetBrainsMono_400Regular",
                  fontSize: 11,
                  color: colors.text.secondary,
                  letterSpacing: 1,
                }}
              >
                VS
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                height: 1,
                backgroundColor: "rgba(255,255,255,0.06)",
              }}
            />
          </View>

          {/* With Surveillance AI */}
          <Animated.View style={card2Style}>
            <View
              style={{
                borderRadius: 16,
                borderWidth: 1,
                borderColor: `${colors.accent}44`,
                backgroundColor: "rgba(0,229,255,0.04)",
                padding: 40,
                overflow: "hidden",
                shadowColor: colors.accent,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.25,
                shadowRadius: 20,
                elevation: 8,
              }}
            >
              {/* Breathing glow behind the card content */}
              <Animated.View
                style={[
                  glowStyle,
                  {
                    position: "absolute",
                    top: -80,
                    left: -80,
                    right: -80,
                    height: 200,
                    borderRadius: 100,
                    backgroundColor: "rgba(0,229,255,0.08)",
                  },
                ]}
              />

              <View className="flex-row items-start justify-between mb-5">
                <View style={{ flex: 1, marginRight: 12 }}>
                  <View
                    style={{
                      alignSelf: "flex-start",
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 9999,
                      backgroundColor: "rgba(0,229,255,0.10)",
                      borderWidth: 1,
                      borderColor: `${colors.accent}44`,
                      marginBottom: 8,
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: "JetBrainsMono_400Regular",
                        fontSize: 10,
                        color: colors.accent,
                        letterSpacing: 0.8,
                        textTransform: "uppercase",
                      }}
                    >
                      AI Powered
                    </Text>
                  </View>
                  <Text
                    style={{
                      fontFamily: "Outfit_600SemiBold",
                      fontSize: 18,
                      color: colors.text.primary,
                      lineHeight: 24,
                    }}
                  >
                    With Surveillance AI
                  </Text>
                </View>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 10,
                    backgroundColor: "rgba(0,229,255,0.10)",
                    borderWidth: 1,
                    borderColor: `${colors.accent}44`,
                    alignItems: "center",
                    justifyContent: "center",
                    shadowColor: colors.accent,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.5,
                    shadowRadius: 10,
                  }}
                >
                  <Zap
                    size={18}
                    color={colors.accent}
                    strokeWidth={1.5}
                    fill={`${colors.accent}22`}
                  />
                </View>
              </View>

              <View className="flex-row items-end justify-between mb-3">
                <Text
                  style={{
                    fontFamily: "JetBrainsMono_400Regular",
                    fontSize: 12,
                    color: colors.accent,
                  }}
                >
                  Autonomous Alert Speed
                </Text>
                <Text
                  style={{
                    fontFamily: "Outfit_700Bold",
                    fontSize: 22,
                    color: colors.accent,
                    letterSpacing: -0.5,
                    shadowColor: colors.accent,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.7,
                    shadowRadius: 8,
                  }}
                >
                  {"< 30 sec"}
                </Text>
              </View>

              {/* Tiny bar — proportionally represents < 30 sec, animates in on mount */}
              <View
                style={{
                  height: 6,
                  borderRadius: 9999,
                  backgroundColor: "rgba(255,255,255,0.06)",
                  marginBottom: 16,
                  overflow: "hidden",
                }}
              >
                <Animated.View
                  style={[
                    barStyle,
                    {
                      height: 6,
                      borderRadius: 9999,
                      backgroundColor: colors.accent,
                      shadowColor: colors.accent,
                      shadowOffset: { width: 0, height: 0 },
                      shadowOpacity: 0.9,
                      shadowRadius: 6,
                    },
                  ]}
                />
              </View>

              <View className="flex-row items-start gap-2">
                <CheckCircle
                  size={14}
                  color={colors.risk.low}
                  strokeWidth={1.5}
                  style={{ marginTop: 1 }}
                />
                <Text
                  style={{
                    fontFamily: "DMSans_500Medium",
                    fontSize: 12,
                    color: colors.text.primary,
                    flex: 1,
                    lineHeight: 18,
                  }}
                >
                  Immediate digital transmission including GPS & Live Audio.
                </Text>
              </View>
            </View>
          </Animated.View>

          {/* Technical insight note */}
          <Animated.View style={[noteStyle, { marginTop: 20 }]}>
            <View
              style={{
                borderRadius: 14,
                borderWidth: 1,
                borderStyle: "dashed",
                borderColor: "rgba(255,255,255,0.10)",
                padding: 18,
                flexDirection: "row",
                alignItems: "flex-start",
                gap: 14,
              }}
            >
              <TrendingUp
                size={18}
                color={colors.accent}
                strokeWidth={1.5}
                style={{ marginTop: 1, flexShrink: 0 }}
              />
              <Text
                style={{
                  fontFamily: "DMSans_400Regular",
                  fontSize: 13,
                  color: colors.text.secondary,
                  fontStyle: "italic",
                  flex: 1,
                  lineHeight: 20,
                }}
              >
                AI analysis bypasses the standard dispatcher queue by providing
                pre-verified risk levels directly to your emergency contact.
              </Text>
            </View>
          </Animated.View>
        </View>
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
            onPress={() => router.push("/(onboarding)/preferences" as any)}
          />
        </View>
      </SafeAreaView>
    </View>
  );
}
