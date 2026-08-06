import { useEffect } from 'react'
import { View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated'

const CYAN = '#00E5FF'

export function UserMarker() {
  const scale = useSharedValue(1)
  const opacity = useSharedValue(1)

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(2.0, { duration: 2000, easing: Easing.out(Easing.cubic) }),
        withTiming(1.0, { duration: 0 }),
      ),
      -1,
      false,
    )
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 2000, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 0 }),
      ),
      -1,
      false,
    )
  }, [])

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }))

  return (
    <View style={{ width: 48, height: 48, alignItems: 'center', justifyContent: 'center' }}>
      {/* Pulse ring — expands from 1.0 to 2.0, fades out over 2 seconds */}
      <Animated.View
        style={[
          ringStyle,
          {
            position: 'absolute',
            width: 48,
            height: 48,
            borderRadius: 24,
            backgroundColor: `${CYAN}40`,
          },
        ]}
      />
      {/* Core dot — 8px radius = 16px diameter */}
      <View
        style={{
          width: 16,
          height: 16,
          borderRadius: 8,
          backgroundColor: CYAN,
          shadowColor: CYAN,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.9,
          shadowRadius: 8,
          elevation: 8,
        }}
      />
    </View>
  )
}
