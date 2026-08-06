import { Pressable, Text, View } from 'react-native';
import { colors } from '../../theme/colors';

export type Interval = 20 | 30 | 60;

const OPTIONS: { value: Interval; label: string; sublabel: string }[] = [
  { value: 20, label: '20s', sublabel: 'HYPER-VIGILANT' },
  { value: 30, label: '30s', sublabel: 'BALANCED' },
  { value: 60, label: '60s', sublabel: 'ECO-MODE' },
];

export function MonitoringIntervalPicker({
  value,
  onChange,
  hideHeader = false,
}: {
  value: Interval;
  onChange: (v: Interval) => void;
  hideHeader?: boolean;
}) {
  return (
    <View>
      {!hideHeader && (
        <View className="flex-row justify-between items-center mb-4">
          <Text className="font-body text-body-lg text-text-primary">Monitoring Interval</Text>
          <Text className="font-mono text-data-md text-text-secondary">
            Every {value}s
          </Text>
        </View>
      )}

      <View className="flex-row gap-2.5">
        {OPTIONS.map((opt) => {
          const active = value === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => onChange(opt.value)}
              className={`flex-1 py-3.5 px-1.5 rounded-md border items-center ${
                active
                  ? 'border-accent/40 bg-accent/[0.08]'
                  : 'border-border-default bg-bg-secondary'
              }`}
              style={({ pressed }) => ({
                opacity: pressed ? 0.75 : 1,
                shadowColor: active ? colors.accent : 'transparent',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: active ? 0.35 : 0,
                shadowRadius: 12,
              })}
            >
              <Text
                className={`font-mono text-[18px] mb-1 ${
                  active ? 'text-accent' : 'text-text-secondary'
                }`}
              >
                {opt.label}
              </Text>
              <Text
                className={`font-mono text-[9px] ${
                  active ? 'text-accent' : 'text-text-tertiary'
                }`}
                style={{ letterSpacing: 0.6 }}
              >
                {opt.sublabel}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
