import { Check } from "lucide-react-native";
import { useEffect } from "react";
import { Pressable, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
  type SharedValue,
} from "react-native-reanimated";
import { colors } from "../../theme/colors";

export type OptionItem = {
  label: string;
  icon: React.ComponentType<{
    size?: number;
    color?: string;
    strokeWidth?: number;
  }>;
};

type Props = {
  option: OptionItem;
  selected: boolean;
  onPress: () => void;
  multiSelect?: boolean;
  opacity: SharedValue<number>;
  translateY: SharedValue<number>;
};

export function OptionCard({
  option,
  selected,
  onPress,
  multiSelect = false,
  opacity,
  translateY,
}: Props) {
  const Icon = option.icon;

  const animStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={onPress}
        className={`flex-row items-center justify-between px-5 h-[68px] rounded-lg border ${
          selected
            ? "bg-accent/[0.08] border-accent/40"
            : "bg-bg-glass border-white/[0.08]"
        }`}
        style={({ pressed }) => ({
          opacity: pressed ? 0.85 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <View className="flex-row items-center gap-4 flex-1">
          <View
            className="w-[42px] h-[42px] rounded-md items-center justify-center flex-shrink-0"
            style={{
              backgroundColor: selected
                ? "rgba(0,229,255,0.12)"
                : "rgba(255,255,255,0.05)",
            }}
          >
            <Icon
              size={20}
              color={selected ? colors.accent : colors.text.secondary}
              strokeWidth={1.8}
            />
          </View>
          <Text
            className={`text-[15px] flex-shrink flex-1 ${selected ? "font-body-medium text-accent" : "font-body text-text-primary"}`}
            numberOfLines={2}
          >
            {option.label}
          </Text>
        </View>

        {multiSelect ? (
          <View
            className="w-6 h-6 rounded-md items-center justify-center ml-3 flex-shrink-0"
            style={{
              borderWidth: selected ? 0 : 2,
              borderColor: "rgba(255,255,255,0.20)",
              backgroundColor: selected ? colors.accent : "transparent",
            }}
          >
            {selected && (
              <Check size={14} color={colors.bg.primary} strokeWidth={3} />
            )}
          </View>
        ) : (
          <View
            className="w-6 h-6 rounded-full items-center justify-center ml-3 flex-shrink-0"
            style={{
              borderWidth: selected ? 0 : 2,
              borderColor: "rgba(255,255,255,0.20)",
              backgroundColor: selected ? colors.accent : "transparent",
            }}
          >
            {selected && (
              <View className="w-2.5 h-2.5 rounded-full bg-bg-primary" />
            )}
          </View>
        )}
      </Pressable>
    </Animated.View>
  );
}

// Stagger animation hook for a list of OptionCards.
// Declares a fixed pool of 8 shared values to satisfy the Rules of Hooks,
// then slices to the actual count at runtime.
export function useStaggeredCards(count: number) {
  const op0 = useSharedValue(0),
    op1 = useSharedValue(0),
    op2 = useSharedValue(0),
    op3 = useSharedValue(0),
    op4 = useSharedValue(0),
    op5 = useSharedValue(0),
    op6 = useSharedValue(0),
    op7 = useSharedValue(0);
  const tr0 = useSharedValue(16),
    tr1 = useSharedValue(16),
    tr2 = useSharedValue(16),
    tr3 = useSharedValue(16),
    tr4 = useSharedValue(16),
    tr5 = useSharedValue(16),
    tr6 = useSharedValue(16),
    tr7 = useSharedValue(16);

  const opacities = [op0, op1, op2, op3, op4, op5, op6, op7];
  const translates = [tr0, tr1, tr2, tr3, tr4, tr5, tr6, tr7];

  const cappedCount = Math.max(0, Math.min(count, opacities.length));

  useEffect(() => {
    for (let i = 0; i < cappedCount; i++) {
      const delay = i * 70;
      opacities[i].value = withDelay(
        delay,
        withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) }),
      );
      translates[i].value = withDelay(
        delay,
        withTiming(0, { duration: 300, easing: Easing.out(Easing.cubic) }),
      );
    }
  }, []);

  return {
    opacities: opacities.slice(0, cappedCount),
    translates: translates.slice(0, cappedCount),
  };
}
