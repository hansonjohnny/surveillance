import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useEffect, useRef } from 'react';
import { TouchableWithoutFeedback } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  isVisible: boolean;
  onWake: () => void;
};

const FADE_IN_MS = 600;
const WAKE_DURATION_MS = 3000;

// The phone would normally turn off the screen after inactivity, which
// suspends background tasks. By keeping the screen on behind this black
// overlay, the monitoring loop continues running uninterrupted even
// though the display looks off to a bystander. A named tag is used so
// this keep-awake is independent of the session-level one in home.tsx.
const KEEP_AWAKE_TAG = 'stealth-overlay';

export function StealthOverlay({ isVisible, onWake }: Props) {
  const opacity = useSharedValue(0);
  const wakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fade to black when stealth activates; reset instantly when session stops.
  useEffect(() => {
    if (isVisible) {
      opacity.value = withTiming(1, { duration: FADE_IN_MS });
    } else {
      if (wakeTimer.current) {
        clearTimeout(wakeTimer.current);
        wakeTimer.current = null;
      }
      opacity.value = 0;
    }
  }, [isVisible]);

  useEffect(() => {
    if (!isVisible) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG);
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG);
    };
  }, [isVisible]);

  useEffect(() => {
    return () => {
      if (wakeTimer.current) clearTimeout(wakeTimer.current);
    };
  }, []);

  function handleTap() {
    onWake();

    // Reset the timer so the 3s window always starts fresh on each tap.
    if (wakeTimer.current) {
      clearTimeout(wakeTimer.current);
    }

    opacity.value = withTiming(0, { duration: 200 });

    wakeTimer.current = setTimeout(() => {
      opacity.value = withTiming(1, { duration: FADE_IN_MS });
      wakeTimer.current = null;
    }, WAKE_DURATION_MS);
  }

  const animStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!isVisible) return null;

  return (
    <TouchableWithoutFeedback onPress={handleTap} accessible={false}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: '#000',
            zIndex: 999,
          },
          animStyle,
        ]}
      />
    </TouchableWithoutFeedback>
  );
}
