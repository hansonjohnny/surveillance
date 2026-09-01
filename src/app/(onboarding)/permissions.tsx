import { useRouter } from "expo-router";
import {
  ArrowLeft,
  Bell,
  Camera,
  CheckCircle2,
  Circle,
  MapPin,
  Mic,
  Shield,
  ShieldCheck,
  XCircle,
  type LucideIcon,
} from "lucide-react-native";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StatusBar, Text, View } from "react-native";
import { requestMicrophonePermission } from "../../lib/audio";
import { requestCameraPermission } from "../../lib/camera";
import { requestLocationPermission } from "../../lib/location";
import { useSettingsStore } from "../../store/useSettingsStore";
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

type PermissionStatus = "idle" | "requesting" | "granted" | "denied";

// Whether location was denied — shown as a degraded-mode banner below the cards.
type LocationBannerState = "hidden" | "denied";

type PermissionItem = {
  id: string;
  Icon: LucideIcon;
  title: string;
  description: string;
};

const PERMISSIONS: PermissionItem[] = [
  {
    id: "camera",
    Icon: Camera,
    title: "Camera Access",
    description:
      "Used for live AI visual analysis of your surroundings during high-risk alerts.",
  },
  {
    id: "microphone",
    Icon: Mic,
    title: "Microphone",
    description:
      "Enables acoustic threat detection to identify glass breaks or distress calls automatically.",
  },
  {
    id: "location",
    Icon: MapPin,
    title: "Location Services",
    description:
      "Allows dispatching precise coordinates to emergency responders if an incident occurs.",
  },
  {
    id: "notifications",
    Icon: Bell,
    title: "Critical Notifications",
    description:
      "Sends urgent safety check-ins and system status updates even in focus mode.",
  },
];

export default function PermissionsScreen() {
  const router = useRouter();
  // A ward reaches this screen directly from sign-in.tsx (their first
  // sign-in), skipping the rest of the survey entirely — they exit to
  // Home instead of the next survey step.
  const isWard = useSettingsStore((s) => s.isWard);
  const [statuses, setStatuses] = useState<Record<string, PermissionStatus>>({
    camera: "idle",
    microphone: "idle",
    location: "idle",
    notifications: "idle",
  });
  const [isGranting, setIsGranting] = useState(false);
  const [cameraBanner, setCameraBanner] = useState<LocationBannerState>("hidden");
  const [locationBanner, setLocationBanner] =
    useState<LocationBannerState>("hidden");

  // Persist this screen's route so an Android Activity restart caused by
  // the permission dialogs routes back here instead of the landing page.
  useEffect(() => {
    useSettingsStore.getState().updateSettings({
      onboardingResumePath: "/(onboarding)/permissions",
    });
  }, []);

  const allHandled = Object.values(statuses).every(
    (s) => s === "granted" || s === "denied",
  );

  async function handleGrantPermissions() {
    if (isGranting) return;
    setIsGranting(true);

    for (const p of PERMISSIONS) {
      setStatuses((prev) => ({ ...prev, [p.id]: "requesting" }));

      try {
        if (p.id === "location") {
          const locStatus = await requestLocationPermission();
          setStatuses((prev) => ({
            ...prev,
            location: locStatus === "denied" ? "denied" : "granted",
          }));
          if (locStatus === "denied") setLocationBanner("denied");
        } else if (p.id === "camera") {
          const granted = await requestCameraPermission();
          setStatuses((prev) => ({
            ...prev,
            camera: granted ? "granted" : "denied",
          }));
          if (!granted) setCameraBanner("denied");
        } else if (p.id === "microphone") {
          const granted = await requestMicrophonePermission();
          setStatuses((prev) => ({
            ...prev,
            microphone: granted ? "granted" : "denied",
          }));
        } else if (p.id === "notifications") {
          const Notifications = await import("expo-notifications");
          const { status } = await Notifications.requestPermissionsAsync();
          const granted = status === "granted";
          setStatuses((prev) => ({
            ...prev,
            notifications: granted ? "granted" : "denied",
          }));
          if (granted) {
            const { registerForPushNotifications } = await import("../../lib/notifications");
            await registerForPushNotifications();
          }
        }
      } catch (err) {
        console.error(`[permissions] Failed to request ${p.id}:`, err);
        setStatuses((prev) => ({ ...prev, [p.id]: "denied" }));
      }

      await new Promise<void>((resolve) => setTimeout(resolve, 200));
    }

    setIsGranting(false);
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
          onPress={() => {
            if (isWard) {
              useSettingsStore.getState().markOnboardingComplete();
              router.replace("/(tabs)/home" as never);
              return;
            }
            router.push("/");
          }}
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
        <View className="px-5 mt-9 mb-6">
          <Text
            className="font-display-bold text-[32px] leading-10 text-text-primary mb-5"
            style={{ letterSpacing: -0.5 }}
          >
            Surveillance AI needs a few permissions to protect you.
          </Text>

          {/* Privacy badge */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              alignSelf: "flex-start",
              paddingHorizontal: 16,
              paddingVertical: 8,
              borderRadius: 9999,
              backgroundColor: `${colors.risk.low}14`,
              borderWidth: 1,
              borderColor: `${colors.risk.low}33`,
            }}
          >
            <ShieldCheck size={14} color={colors.risk.low} strokeWidth={2} />
            <Text
              style={{
                fontFamily: "JetBrainsMono_400Regular",
                fontSize: 11,
                color: colors.risk.low,
                letterSpacing: 1.2,
                textTransform: "uppercase",
              }}
            >
              We never share your data.
            </Text>
          </View>
        </View>

        {/* Permission cards */}
        <View className="px-5 gap-3">
          {PERMISSIONS.map((item, index) => (
            <PermissionCard
              key={item.id}
              item={item}
              status={statuses[item.id]}
              index={index}
            />
          ))}
        </View>

        {/* Degraded-mode banner — shown when camera is denied */}
        {cameraBanner === "denied" && (
          <View
            style={{
              marginHorizontal: 20,
              marginTop: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: `${colors.risk.medium}40`,
              backgroundColor: `${colors.risk.medium}0A`,
              padding: 16,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <Camera
              size={18}
              color={colors.risk.medium}
              strokeWidth={1.5}
              style={{ marginTop: 1 }}
            />
            <Text
              style={{
                flex: 1,
                fontFamily: "DMSans_400Regular",
                fontSize: 13,
                lineHeight: 20,
                color: colors.risk.medium,
              }}
            >
              Camera access was denied. Visual snapshots will not be captured
              during surveillance. You can enable it later in Settings.
            </Text>
          </View>
        )}

        {/* Degraded-mode banner — shown when location is denied */}
        {locationBanner === "denied" && (
          <View
            style={{
              marginHorizontal: 20,
              marginTop: 16,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: `${colors.risk.medium}40`,
              backgroundColor: `${colors.risk.medium}0A`,
              padding: 16,
              flexDirection: "row",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <MapPin
              size={18}
              color={colors.risk.medium}
              strokeWidth={1.5}
              style={{ marginTop: 1 }}
            />
            <Text
              style={{
                flex: 1,
                fontFamily: "DMSans_400Regular",
                fontSize: 13,
                lineHeight: 20,
                color: colors.risk.medium,
              }}
            >
              Location access was denied. GPS coordinates will not be included
              in alerts. You can enable it later in Settings.
            </Text>
          </View>
        )}

        {/* Shield visual */}
        <View className="px-5 mt-8">
          <ShieldVisual />
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
              className="font-mono text-[10px] text-text-secondary"
              style={{ letterSpacing: 0.5 }}
            >
              BACK
            </Text>
          </Pressable>

          <ContinueButton
            onPress={
              allHandled
                ? () => {
                    if (isWard) {
                      useSettingsStore.getState().markOnboardingComplete();
                      router.replace("/(tabs)/home" as never);
                      return;
                    }
                    router.push("/(onboarding)/setup" as never);
                  }
                : handleGrantPermissions
            }
            enabled={!isGranting}
            label={
              allHandled
                ? "CONTINUE"
                : isGranting
                  ? "REQUESTING..."
                  : "GRANT PERMISSIONS"
            }
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

// ─── Permission card ──────────────────────────────────────────────────────────

function PermissionCard({
  item,
  status,
  index,
}: {
  item: PermissionItem;
  status: PermissionStatus;
  index: number;
}) {
  const cardOpacity = useSharedValue(0);
  const cardY = useSharedValue(16);
  const checkScale = useSharedValue(0.4);
  const checkOpacity = useSharedValue(0);

  useEffect(() => {
    cardOpacity.value = withDelay(
      index * 90,
      withTiming(1, { duration: 320, easing: Easing.out(Easing.cubic) }),
    );
    cardY.value = withDelay(
      index * 90,
      withTiming(0, { duration: 320, easing: Easing.out(Easing.cubic) }),
    );
  }, []);

  useEffect(() => {
    if (status === "granted") {
      checkScale.value = withTiming(1, {
        duration: 240,
        easing: Easing.out(Easing.back(1.8)),
      });
      checkOpacity.value = withTiming(1, { duration: 180 });
    } else {
      checkScale.value = withTiming(0.4, { duration: 160 });
      checkOpacity.value = withTiming(0, { duration: 160 });
    }
  }, [status]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardOpacity.value,
    transform: [{ translateY: cardY.value }],
  }));

  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }],
    opacity: checkOpacity.value,
  }));

  const isGranted = status === "granted";
  const isRequesting = status === "requesting";
  const isDenied = status === "denied";

  const borderColor = isGranted
    ? `${colors.risk.low}40`
    : isDenied
      ? `${colors.risk.high}40`
      : isRequesting
        ? `${colors.accent}44`
        : "rgba(255,255,255,0.08)";

  const bgColor = isGranted
    ? `${colors.risk.low}08`
    : isDenied
      ? `${colors.risk.high}08`
      : isRequesting
        ? "rgba(0,229,255,0.04)"
        : "rgba(255,255,255,0.04)";

  const iconBg = isGranted
    ? `${colors.risk.low}14`
    : isDenied
      ? `${colors.risk.high}14`
      : "rgba(0,229,255,0.10)";
  const iconBorder = isGranted
    ? `${colors.risk.low}33`
    : isDenied
      ? `${colors.risk.high}33`
      : `${colors.accent}33`;
  const iconColor = isGranted
    ? colors.risk.low
    : isDenied
      ? colors.risk.high
      : colors.accent;

  return (
    <Animated.View style={cardStyle}>
      <View
        style={{
          borderRadius: 16,
          borderWidth: 1,
          borderColor,
          backgroundColor: bgColor,
          padding: 20,
          flexDirection: "row",
          alignItems: "flex-start",
          gap: 16,
        }}
      >
        {/* Icon */}
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: iconBg,
            borderWidth: 1,
            borderColor: iconBorder,
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <item.Icon size={22} color={iconColor} strokeWidth={1.5} />
        </View>

        {/* Text */}
        <View style={{ flex: 1 }}>
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 16,
              color: isGranted
                ? colors.risk.low
                : isDenied
                  ? colors.risk.high
                  : colors.text.primary,
              marginBottom: 4,
              lineHeight: 22,
            }}
          >
            {item.title}
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 13,
              color: colors.text.secondary,
              lineHeight: 20,
            }}
          >
            {item.description}
          </Text>
        </View>

        {/* Status indicator */}
        <View
          style={{
            width: 24,
            height: 24,
            alignItems: "center",
            justifyContent: "center",
            marginTop: 2,
            flexShrink: 0,
          }}
        >
          {isGranted ? (
            <Animated.View style={checkStyle}>
              <CheckCircle2 size={22} color={colors.risk.low} strokeWidth={2} />
            </Animated.View>
          ) : isDenied ? (
            <XCircle size={22} color={colors.risk.high} strokeWidth={2} />
          ) : isRequesting ? (
            <PulsingDot />
          ) : (
            <Circle
              size={22}
              color="rgba(255,255,255,0.18)"
              strokeWidth={1.5}
            />
          )}
        </View>
      </View>
    </Animated.View>
  );
}

// ─── Pulsing dot (requesting state) ──────────────────────────────────────────

function PulsingDot() {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(1);

  useEffect(() => {
    const cfg = { duration: 480, easing: Easing.inOut(Easing.ease) };
    scale.value = withRepeat(
      withSequence(withTiming(1.5, cfg), withTiming(1, cfg)),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(withTiming(0.25, cfg), withTiming(1, cfg)),
      -1,
      false,
    );
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        style,
        {
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: colors.accent,
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 6,
        },
      ]}
    />
  );
}

// ─── Shield visual ────────────────────────────────────────────────────────────

function ShieldVisual() {
  const r1Scale = useSharedValue(1);
  const r1Opacity = useSharedValue(0.35);
  const r2Scale = useSharedValue(1);
  const r2Opacity = useSharedValue(0.2);

  useEffect(() => {
    const cfg = { duration: 2600, easing: Easing.inOut(Easing.ease) };
    r1Scale.value = withRepeat(
      withSequence(withTiming(1.14, cfg), withTiming(1, cfg)),
      -1,
      false,
    );
    r1Opacity.value = withRepeat(
      withSequence(withTiming(0.12, cfg), withTiming(0.35, cfg)),
      -1,
      false,
    );
    r2Scale.value = withDelay(
      700,
      withRepeat(
        withSequence(withTiming(1.1, cfg), withTiming(1, cfg)),
        -1,
        false,
      ),
    );
    r2Opacity.value = withDelay(
      700,
      withRepeat(
        withSequence(withTiming(0.08, cfg), withTiming(0.2, cfg)),
        -1,
        false,
      ),
    );
  }, []);

  const r1Style = useAnimatedStyle(() => ({
    transform: [{ scale: r1Scale.value }],
    opacity: r1Opacity.value,
  }));
  const r2Style = useAnimatedStyle(() => ({
    transform: [{ scale: r2Scale.value }],
    opacity: r2Opacity.value,
  }));

  return (
    <View
      style={{
        borderRadius: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.06)",
        backgroundColor: "rgba(255,255,255,0.02)",
        paddingVertical: 44,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Animated.View
        style={[
          r2Style,
          {
            position: "absolute",
            width: 200,
            height: 200,
            borderRadius: 100,
            borderWidth: 1,
            borderColor: `${colors.accent}22`,
          },
        ]}
      />
      <Animated.View
        style={[
          r1Style,
          {
            position: "absolute",
            width: 140,
            height: 140,
            borderRadius: 70,
            borderWidth: 1,
            borderColor: `${colors.accent}44`,
          },
        ]}
      />
      <View
        style={{
          width: 84,
          height: 84,
          borderRadius: 42,
          backgroundColor: "rgba(0,229,255,0.08)",
          borderWidth: 1,
          borderColor: `${colors.accent}44`,
          alignItems: "center",
          justifyContent: "center",
          shadowColor: colors.accent,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.4,
          shadowRadius: 22,
        }}
      >
        <Shield
          size={38}
          color={colors.accent}
          strokeWidth={1.5}
          fill={`${colors.accent}18`}
        />
      </View>
    </View>
  );
}
