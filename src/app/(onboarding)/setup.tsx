import { useRouter } from "expo-router";
import { ArrowLeft, Check, ShieldCheck } from "lucide-react-native";
import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StatusBar, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { Circle, Svg } from "react-native-svg";
import { ContinueButton } from "../../components/ui/ContinueButton";
import { colors } from "../../theme/colors";

const TOTAL_STEPS = 12;
const CURRENT_STEP = 10;

const RADIUS = 88;
const STROKE_WIDTH = 10;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const SIZE = (RADIUS + STROKE_WIDTH) * 2;

type StepStatus = "pending" | "active" | "done";

type SetupItem = {
  id: string;
  label: string;
  techLabel: string;
  durationMs: number;
};

const SETUP_ITEMS: SetupItem[] = [
  {
    id: "contact",
    label: "Emergency contact saved",
    techLabel: "SECURE_SYNC_COMPLETE",
    durationMs: 900,
  },
  {
    id: "interval",
    label: "Monitoring interval configured",
    techLabel: "POLLING_RATE: 0.5s",
    durationMs: 800,
  },
  {
    id: "alerts",
    label: "Alert channels ready",
    techLabel: "ENCRYPTED_UDP_ACTIVE",
    durationMs: 1000,
  },
  {
    id: "neural",
    label: "Finalizing AI Guardian Neural Map",
    techLabel: "NEURAL_MAP_ACTIVE",
    durationMs: 1400,
  },
];

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export default function SetupScreen() {
  const router = useRouter();
  // Track which step is active and which are done
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>(
    Object.fromEntries(SETUP_ITEMS.map((item) => [item.id, "pending"])),
  );
  const [isComplete, setIsComplete] = useState(false);

  // Circular progress: 0 → 1
  const progress = useSharedValue(0);

  // Run the animated setup sequence once on mount
  const hasStarted = useRef(false);
  useEffect(() => {
    if (hasStarted.current) return;
    hasStarted.current = true;
    runSequence();
  }, []);

  async function runSequence() {
    const perItemProgress = 1 / SETUP_ITEMS.length;

    for (let i = 0; i < SETUP_ITEMS.length; i++) {
      const item = SETUP_ITEMS[i];

      // Mark active
      setStepStatuses((prev) => ({ ...prev, [item.id]: "active" }));

      // Animate progress ring to next milestone
      const targetProgress = (i + 1) * perItemProgress;
      progress.value = withTiming(targetProgress, {
        duration: item.durationMs,
        easing: Easing.out(Easing.cubic),
      });

      await delay(item.durationMs);

      // Mark done
      setStepStatuses((prev) => ({ ...prev, [item.id]: "done" }));
      await delay(200);
    }

    setIsComplete(true);
  }

  const animatedCircleProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  // Percentage label derived from progress (0–100)
  const [displayPercent, setDisplayPercent] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => {
      const currentProgress = progress.value;
      setDisplayPercent(Math.round(currentProgress * 100));
    }, 50);
    return () => clearInterval(interval);
  }, []);

  const doneCount = Object.values(stepStatuses).filter(
    (s) => s === "done",
  ).length;
  const statusLabel =
    doneCount === SETUP_ITEMS.length
      ? "PROTECTION ACTIVE"
      : (SETUP_ITEMS.find((item) => stepStatuses[item.id] === "active")
          ?.techLabel ?? "INITIALIZING");

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
        {/* Circular progress */}
        <View className="items-center mt-10 mb-2">
          <View style={{ width: SIZE, height: SIZE }}>
            <Svg width={SIZE} height={SIZE}>
              {/* Track ring */}
              <Circle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={STROKE_WIDTH}
                fill="none"
              />
              {/* Filled progress ring */}
              <AnimatedCircle
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                stroke={colors.accent}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={CIRCUMFERENCE}
                strokeLinecap="round"
                animatedProps={animatedCircleProps}
                // rotate so progress starts at top
                transform={`rotate(-90, ${SIZE / 2}, ${SIZE / 2})`}
              />
            </Svg>

            {/* Centre label */}
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: SIZE,
                height: SIZE,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "Outfit_700Bold",
                  fontSize: 36,
                  color: colors.accent,
                  lineHeight: 44,
                  letterSpacing: -0.5,
                }}
              >
                {displayPercent}%
              </Text>
              <Text
                style={{
                  fontFamily: "JetBrainsMono_400Regular",
                  fontSize: 9,
                  color: colors.text.secondary,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                  marginTop: 2,
                }}
              >
                {statusLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Headline */}
        <Text
          style={{
            fontFamily: "Outfit_700Bold",
            fontSize: 20,
            color: colors.text.primary,
            textAlign: "center",
            letterSpacing: -0.3,
            marginTop: 20,
            marginBottom: 32,
            paddingHorizontal: 24,
          }}
        >
          Setting up your protection profile...
        </Text>

        {/* Checklist */}
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
          {SETUP_ITEMS.map((item, index) => (
            <ChecklistItem
              key={item.id}
              item={item}
              status={stepStatuses[item.id]}
              index={index}
            />
          ))}
        </View>
      </ScrollView>

      {/* Bottom nav */}
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: colors.border.subtle,
          backgroundColor: colors.bg.primary,
        }}
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
            <Text
              style={{
                fontFamily: "JetBrainsMono_400Regular",
                fontSize: 10,
                color: colors.text.secondary,
                letterSpacing: 0.5,
              }}
            >
              BACK
            </Text>
          </Pressable>

          <ContinueButton
            onPress={() => router.push("/(onboarding)/plan-reveal" as never)}
            enabled={isComplete}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Checklist item ───────────────────────────────────────────────────────────

function ChecklistItem({
  item,
  status,
  index,
}: {
  item: SetupItem;
  status: StepStatus;
  index: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(12);

  useEffect(() => {
    opacity.value = withDelay(
      index * 80,
      withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
    translateY.value = withDelay(
      index * 80,
      withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const isDone = status === "done";
  const isActive = status === "active";

  const borderColor = isDone
    ? "rgba(0,230,118,0.25)"
    : isActive
      ? `${colors.accent}40`
      : "rgba(255,255,255,0.08)";

  const bgColor = isDone
    ? "rgba(0,230,118,0.05)"
    : isActive
      ? "rgba(0,229,255,0.04)"
      : "rgba(255,255,255,0.03)";

  return (
    <Animated.View
      style={[
        containerStyle,
        {
          borderRadius: 16,
          borderWidth: 1,
          borderColor,
          backgroundColor: bgColor,
          padding: 18,
          flexDirection: "row",
          alignItems: "center",
          gap: 14,
        },
      ]}
    >
      {/* Status icon */}
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: isDone
            ? "rgba(0,230,118,0.12)"
            : isActive
              ? "rgba(0,229,255,0.10)"
              : "rgba(255,255,255,0.04)",
          borderWidth: 1,
          borderColor: isDone
            ? "rgba(0,230,118,0.35)"
            : isActive
              ? `${colors.accent}40`
              : "rgba(255,255,255,0.08)",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isDone ? (
          <CheckIcon />
        ) : isActive ? (
          <SpinnerDot />
        ) : (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: "rgba(255,255,255,0.12)",
            }}
          />
        )}
      </View>

      {/* Text */}
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: isDone ? "DMSans_500Medium" : "DMSans_400Regular",
            fontSize: 15,
            color: isDone
              ? colors.risk.low
              : isActive
                ? colors.accent
                : colors.text.secondary,
            lineHeight: 22,
            marginBottom: 3,
          }}
        >
          {item.label}
        </Text>

        {isDone ? (
          <Text
            style={{
              fontFamily: "JetBrainsMono_400Regular",
              fontSize: 10,
              color: "rgba(0,230,118,0.55)",
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            {item.techLabel}
          </Text>
        ) : isActive ? (
          <ActiveProgressBar />
        ) : (
          <Text
            style={{
              fontFamily: "JetBrainsMono_400Regular",
              fontSize: 10,
              color: colors.text.tertiary,
              letterSpacing: 0.8,
              textTransform: "uppercase",
            }}
          >
            QUEUED
          </Text>
        )}
      </View>
    </Animated.View>
  );
}

// ─── Animated check icon ──────────────────────────────────────────────────────

function CheckIcon() {
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withTiming(1, {
      duration: 240,
      easing: Easing.out(Easing.back(1.8)),
    });
    opacity.value = withTiming(1, { duration: 180 });
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={style}>
      <Check size={16} color={colors.risk.low} strokeWidth={2.5} />
    </Animated.View>
  );
}

// ─── Spinner dot (active state) ───────────────────────────────────────────────

function SpinnerDot() {
  const rotation = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 900, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          width: 16,
          height: 16,
          borderRadius: 8,
          borderWidth: 2,
          borderColor: colors.accent,
          borderTopColor: "transparent",
        },
      ]}
    />
  );
}

// ─── Active progress bar ──────────────────────────────────────────────────────

function ActiveProgressBar() {
  const translateX = useSharedValue(-100);

  useEffect(() => {
    translateX.value = withRepeat(
      withSequence(
        withTiming(300, { duration: 1200, easing: Easing.inOut(Easing.ease) }),
        withTiming(-100, { duration: 0 }),
      ),
      -1,
      false,
    );
  }, []);

  const shimStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  return (
    <View
      style={{
        height: 3,
        borderRadius: 9999,
        backgroundColor: "rgba(255,255,255,0.06)",
        marginTop: 6,
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={[
          shimStyle,
          {
            position: "absolute",
            height: "100%",
            width: "40%",
            borderRadius: 9999,
            backgroundColor: colors.accent,
          },
        ]}
      />
    </View>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
