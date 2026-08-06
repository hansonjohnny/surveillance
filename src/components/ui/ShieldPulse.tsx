import { Shield, ShieldAlert, ShieldCheck } from 'lucide-react-native';
import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

interface Props {
  active?: boolean;
  riskLevel?: 'low' | 'medium' | 'high' | null;
}

const CYAN = '#00E5FF';
const RED  = '#FF3D3D';

export function ShieldPulse({ active = false, riskLevel = 'low' }: Props) {
  const isHighRisk = riskLevel === 'high';
  const accent = isHighRisk ? RED : CYAN;

  const r1Scale   = useSharedValue(0.95);
  const r1Opacity = useSharedValue(0);
  const r2Scale   = useSharedValue(0.95);
  const r2Opacity = useSharedValue(0);
  const r3Scale   = useSharedValue(0.95);
  const r3Opacity = useSharedValue(0);

  useEffect(() => {
    if (!active) {
      r1Opacity.value = withTiming(0, { duration: 300 });
      r2Opacity.value = withTiming(0, { duration: 300 });
      r3Opacity.value = withTiming(0, { duration: 300 });
      return;
    }

    // HTML: cubic-bezier(0.4, 0, 0.6, 1), 3s, staggered 0 / 1s / 2s
    const ease = Easing.bezier(0.4, 0, 0.6, 1);
    const dur  = 3000;

    const ringAnim = (
      scale:   typeof r1Scale,
      opacity: typeof r1Opacity,
      delay:   number,
    ) => {
      scale.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(0.95, { duration: 1 }),
            withTiming(1.25, { duration: dur, easing: ease }),
          ),
          -1,
          false,
        ),
      );
      opacity.value = withDelay(
        delay,
        withRepeat(
          withSequence(
            withTiming(0.8, { duration: 1 }),
            withTiming(0,   { duration: dur, easing: ease }),
          ),
          -1,
          false,
        ),
      );
    };

    ringAnim(r1Scale, r1Opacity, 0);
    ringAnim(r2Scale, r2Opacity, 1000);
    ringAnim(r3Scale, r3Opacity, 2000);
  }, [active, isHighRisk]);

  const r1Style = useAnimatedStyle(() => ({
    transform: [{ scale: r1Scale.value }],
    opacity:   r1Opacity.value,
  }));
  const r2Style = useAnimatedStyle(() => ({
    transform: [{ scale: r2Scale.value }],
    opacity:   r2Opacity.value,
  }));
  const r3Style = useAnimatedStyle(() => ({
    transform: [{ scale: r3Scale.value }],
    opacity:   r3Opacity.value,
  }));

  const ringBase = {
    position:     'absolute' as const,
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 9999,
    borderWidth:  1.5,
  };

  const IconComponent = isHighRisk ? ShieldAlert : active ? ShieldCheck : Shield;

  return (
    <View style={{ width: 256, height: 256, alignItems: 'center', justifyContent: 'center' }}>

      {/* Animated rings (active) or static ghost rings (inactive) */}
      {active ? (
        <>
          <Animated.View style={[r1Style, { ...ringBase, borderColor: `${accent}59` }]} />
          <Animated.View style={[r2Style, { ...ringBase, borderColor: `${accent}40` }]} />
          <Animated.View style={[r3Style, { ...ringBase, borderColor: `${accent}26` }]} />
        </>
      ) : (
        <>
          <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 9999, borderWidth: 1, borderColor: `${CYAN}1A` }} />
          <View style={{ position: 'absolute', width: 200, height: 200, borderRadius: 9999, borderWidth: 1, borderColor: `${CYAN}12` }} />
        </>
      )}

      {/* Radial glow layers — simulate CSS box-shadow: 0 0 60px 10px (active only) */}
      {active && (
        <>
          <View style={{ position: 'absolute', width: 230, height: 230, borderRadius: 115, backgroundColor: `${accent}08` }} />
          <View style={{ position: 'absolute', width: 192, height: 192, borderRadius:  96, backgroundColor: `${accent}0D` }} />
          <View style={{ position: 'absolute', width: 158, height: 158, borderRadius:  79, backgroundColor: `${accent}14` }} />
        </>
      )}

      {/* Central shield circle */}
      <View
        style={{
          width:           128,
          height:          128,
          borderRadius:    64,
          backgroundColor: active ? accent : 'rgba(0,229,255,0.08)',
          borderWidth:     active ? 0 : 1,
          borderColor:     `${CYAN}20`,
          alignItems:      'center',
          justifyContent:  'center',
          shadowColor:     accent,
          shadowOffset:    { width: 0, height: 0 },
          shadowOpacity:   active ? 0.7 : 0.12,
          shadowRadius:    24,
          elevation:       active ? 20 : 3,
        }}
      >
        <IconComponent
          size={64}
          color={active ? '#0A0A0F' : CYAN}
          strokeWidth={1.5}
          fill={active ? '#0A0A0F' : 'transparent'}
        />
      </View>
    </View>
  );
}
