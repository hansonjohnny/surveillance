import { useRouter } from 'expo-router';
import { ArrowLeft, BellRing, Mail, MessageSquare, Phone, Shield, User } from 'lucide-react-native';
import { useEffect } from 'react';
import { ScrollView, StatusBar, Text, TouchableOpacity, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

// Icon color props — cannot be className
const CYAN = '#00DAF3';
const RISK_HIGH = '#FF3D3D';

// ─── Types ─────────────────────────────────────────────────────────────────────
type Channel = 'sms' | 'email' | 'call';

type AlertEvent = {
  id: string;
  contact: string;
  time: string;
  date: string;
  summary: string;
  channels: Channel[];
};

// ─── Mock data ─────────────────────────────────────────────────────────────────
const ALERTS: AlertEvent[] = [
  {
    id: '1',
    contact: 'Marcus Thorne',
    time: '10:42 PM',
    date: '2023.10.27',
    summary:
      'Irregular gait detected followed by high-velocity impact. Acoustic analysis confirmed a distress vocalization (92% confidence).',
    channels: ['sms', 'email', 'call'],
  },
  {
    id: '2',
    contact: 'Elena Rodriguez',
    time: '08:15 PM',
    date: '2023.10.27',
    summary:
      'Sudden deviation from habitual route in high-risk zone. Heart rate spike detected via wearable integration (145 BPM).',
    channels: ['sms', 'email'],
  },
  {
    id: '3',
    contact: 'Sarah Chen',
    time: '02:30 AM',
    date: '2023.10.28',
    summary:
      'Device impact detected followed by prolonged period of non-responsiveness. Location tracking indicates "Low Signal Area".',
    channels: ['sms', 'call'],
  },
];

// ─── Channel chip config ────────────────────────────────────────────────────────
const CHANNEL_META: Record<Channel, { label: string; Icon: typeof Mail }> = {
  sms:   { label: 'SMS',   Icon: MessageSquare },
  email: { label: 'EMAIL', Icon: Mail },
  call:  { label: 'CALL',  Icon: Phone },
};

// ─── PulsingDot ────────────────────────────────────────────────────────────────
function PulsingDot() {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.3, { duration: 1000 }),
        withTiming(1.0, { duration: 1000 }),
      ),
      -1,
      false,
    );
  }, []);

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View className="w-2 h-2 rounded-full bg-risk-high" style={animStyle} />
  );
}

// ─── AlertCard ─────────────────────────────────────────────────────────────────
function AlertCard({ item }: { item: AlertEvent }) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      className="bg-bg-glass border border-border-default rounded-lg p-screen mb-md overflow-hidden"
    >
      {/* Corner glow — negative position values must stay inline */}
      <View
        pointerEvents="none"
        className="absolute w-32 h-32 rounded-full bg-risk-high/[7%]"
        style={{ top: -64, right: -64 }}
      />

      {/* Row 1: SOS badge + contact name | timestamp */}
      <View className="flex-row justify-between items-start mb-md">
        <View className="gap-sm">
          {/* SOS TRIGGERED pill */}
          <View className="self-start px-[10px] py-[3px] rounded-full bg-risk-high/10 border border-risk-high/30">
            <Text
              className="font-mono text-data-sm text-risk-high uppercase"
              style={{ letterSpacing: 0.8 }}
            >
              SOS TRIGGERED
            </Text>
          </View>

          {/* Contact name */}
          <View className="flex-row items-center gap-sm">
            <User size={16} color="#F0F0F5" strokeWidth={1.5} />
            <Text className="font-display-semi text-heading-lg text-text-primary">
              {item.contact}
            </Text>
          </View>
        </View>

        {/* Timestamp + date */}
        <View className="items-end gap-[2px]">
          <Text className="font-mono text-data-md text-text-secondary">{item.time}</Text>
          <Text className="font-mono text-data-sm text-text-secondary opacity-60">{item.date}</Text>
        </View>
      </View>

      {/* AI Detection Summary */}
      <View className="mb-md">
        <Text
          className="font-mono text-data-sm text-text-secondary uppercase opacity-70 mb-sm"
          style={{ letterSpacing: 0.8 }}
        >
          AI Detection Summary
        </Text>
        <Text className="font-body text-body-md text-text-primary">{item.summary}</Text>
      </View>

      {/* Divider */}
      <View className="h-px bg-border-subtle mb-md" />

      {/* What was sent */}
      <View>
        <Text
          className="font-mono text-data-sm text-text-secondary uppercase opacity-70 mb-[10px]"
          style={{ letterSpacing: 0.8 }}
        >
          What was sent
        </Text>
        <View className="flex-row flex-wrap gap-sm">
          {item.channels.map((ch) => {
            const { label, Icon } = CHANNEL_META[ch];
            return (
              <View
                key={ch}
                className="flex-row items-center gap-[6px] px-3 py-[5px] rounded-full border border-risk-high/30 bg-risk-high/[8%]"
              >
                <Icon size={12} color={RISK_HIGH} strokeWidth={1.5} />
                <Text
                  className="font-mono text-data-sm text-risk-high uppercase"
                  style={{ letterSpacing: 0.8 }}
                >
                  {label}
                </Text>
              </View>
            );
          })}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── AlertsScreen ──────────────────────────────────────────────────────────────
export default function AlertsScreen() {
  const router = useRouter();

  return (
    <View className="flex-1 bg-bg-primary">
      <StatusBar barStyle="light-content" />

      {/* Header — back arrow replaces bell icon since this is a push screen */}
      <SafeAreaView edges={['top']}>
        <View className="h-16 flex-row items-center justify-between px-screen border-b border-border-default">
          <TouchableOpacity
            onPress={() => router.back()}
            className="flex-row items-center gap-sm"
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <ArrowLeft size={20} color={CYAN} strokeWidth={1.5} />
            <Text
              className="font-display-bold text-heading-lg text-accent"
              style={{ letterSpacing: -0.3 }}
            >
              Critical Alerts
            </Text>
          </TouchableOpacity>

          <BellRing size={22} color={RISK_HIGH} strokeWidth={1.5} />
        </View>
      </SafeAreaView>

      {/* Scrollable body */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-screen pt-xl pb-[100px]"
        showsVerticalScrollIndicator={false}
      >
        {/* Page heading */}
        <View className="mb-xl">
          <View className="flex-row items-center gap-sm mb-sm">
            <PulsingDot />
            <Text
              className="font-mono text-data-sm text-risk-high uppercase"
              style={{ letterSpacing: 2 }}
            >
              Incident History
            </Text>
          </View>

          <Text className="font-display-bold text-display-lg text-text-primary mb-sm">
            Critical Alerts
          </Text>

          <Text className="font-body text-body-md text-text-secondary">
            Summary of all High-risk triggers that initiated automated emergency protocols.
          </Text>
        </View>

        {ALERTS.map((item) => (
          <AlertCard key={item.id} item={item} />
        ))}
      </ScrollView>

      {/* Atmospheric red bottom glow */}
      <View
        pointerEvents="none"
        className="absolute bottom-0 left-0 right-0 h-[300px] opacity-20"
        style={{
          shadowColor: RISK_HIGH,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 1,
          shadowRadius: 120,
        }}
      />
    </View>
  );
}
