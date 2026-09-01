import { useEffect, useState } from 'react';
import { Pressable, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { colors } from '../../theme/colors';

export type Sensitivity = 0 | 1 | 2;

const LABELS = ['LOW', 'MEDIUM', 'HIGH'] as const;

const TINTS: Record<Sensitivity, string> = {
  0: colors.risk.low,
  1: colors.risk.medium,
  2: colors.accent,
};

const DESCRIPTIONS: Record<Sensitivity, string> = {
  0: 'Detects only strong impacts. Best for active environments with lots of movement.',
  1: 'Medium sensitivity is recommended for standard walking. It prevents false triggers from minor device bumps.',
  2: 'Detects subtle motion changes. Best for high-risk situations but may trigger more frequently.',
};

export function ShakeSensitivityPicker({
  value,
  onChange,
  showDescription = false,
  hideHeader = false,
  disabled = false,
}: {
  value: Sensitivity;
  onChange: (v: Sensitivity) => void;
  showDescription?: boolean;
  hideHeader?: boolean;
  disabled?: boolean;
}) {
  const [trackWidth, setTrackWidth] = useState(0);
  const dotX = useSharedValue(0);
  const tint = TINTS[value];

  useEffect(() => {
    if (trackWidth <= 0) return;
    dotX.value = withTiming((value / 2) * (trackWidth - 20), {
      duration: 220,
      easing: Easing.out(Easing.cubic),
    });
  }, [value, trackWidth]);

  const dotStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: dotX.value }],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: Math.max(0, dotX.value + 10),
  }));

  function handleTrackPress(e: any) {
    if (disabled || trackWidth <= 0) return;
    const ratio = e.nativeEvent.locationX / trackWidth;
    onChange(Math.min(2, Math.max(0, Math.round(ratio * 2))) as Sensitivity);
  }

  return (
    <View style={{ opacity: disabled ? 0.5 : 1 }}>
      {/* Header: label + current value badge */}
      {!hideHeader && (
        <View className="flex-row justify-between items-center mb-4">
          <Text className="font-body text-body-lg text-text-primary">Shake Sensitivity</Text>
          <View className="px-2 py-1 rounded-sm" style={{ backgroundColor: `${tint}18` }}>
            <Text className="font-mono text-data-md" style={{ color: tint }}>
              {LABELS[value]}
            </Text>
          </View>
        </View>
      )}

      {/* Slider track — tap anywhere to snap to nearest step */}
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleTrackPress}
        onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
        className="h-8 justify-center mb-3"
      >
        <View className="h-1 rounded-full bg-white/10" />

        <Animated.View
          style={[
            fillStyle,
            {
              position: 'absolute',
              height: 4,
              borderRadius: 9999,
              backgroundColor: tint,
              left: 0,
            },
          ]}
        />

        <Animated.View
          style={[
            dotStyle,
            {
              position: 'absolute',
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: tint,
              shadowColor: tint,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.7,
              shadowRadius: 8,
            },
          ]}
        />
      </TouchableOpacity>

      {/* LOW / MEDIUM / HIGH tap buttons */}
      <View className="flex-row gap-2">
        {LABELS.map((label, idx) => {
          const active = value === idx;
          return (
            <Pressable
              key={label}
              onPress={() => onChange(idx as Sensitivity)}
              disabled={disabled}
              className={`flex-1 h-11 items-center justify-center rounded-sm border ${
                active
                  ? 'border-accent bg-accent/[0.08]'
                  : 'border-border-default bg-transparent'
              }`}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Text
                className="font-mono text-[11px]"
                style={{
                  letterSpacing: 0.8,
                  color: active ? tint : colors.text.tertiary,
                }}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Optional description box */}
      {showDescription && (
        <View className="mt-3.5 rounded-[10px] bg-bg-primary border border-border-subtle p-[14px]">
          <Text className="font-body text-data-md text-text-secondary leading-5">
            {DESCRIPTIONS[value]}
          </Text>
        </View>
      )}
    </View>
  );
}
