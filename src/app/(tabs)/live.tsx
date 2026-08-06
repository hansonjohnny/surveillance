import { LiveMap } from '@/components/map/LiveMap'
import { useSessionStore } from '@/store/useSessionStore'
import * as Location from 'expo-location'
import { MapPin } from 'lucide-react-native'
import { useEffect, useState } from 'react'
import { StatusBar, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const BG    = '#0A0A0F'
const MUTED = '#8888A0'
const CYAN  = '#00E5FF'

export default function LiveScreen() {
  // Use the session store location when a session is active;
  // fall back to a one-shot device location so the map always has a pin.
  const lastLocation = useSessionStore((s) => s.lastLocation)
  const [deviceLocation, setDeviceLocation] = useState<{ lat: number; lng: number } | null>(null)

  useEffect(() => {
    if (lastLocation) return // session location takes priority
    Location.getForegroundPermissionsAsync().then(({ status }) => {
      if (status !== 'granted') return
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then((pos) => {
        setDeviceLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude })
      }).catch(() => {})
    }).catch(() => {})
  }, [lastLocation])

  const location = lastLocation ?? deviceLocation

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      <LiveMap location={location} />

      {/* GPS coordinates chip — floats top-right */}
      <SafeAreaView
        edges={['top']}
        style={{ position: 'absolute', top: 0, right: 0, left: 0, pointerEvents: 'none' }}
      >
        <View style={{ alignItems: 'flex-end', paddingHorizontal: 16, paddingTop: 8 }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 9999,
              backgroundColor: 'rgba(10, 10, 15, 0.85)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.12)',
            }}
          >
            <MapPin size={11} color={CYAN} strokeWidth={1.5} />
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 11,
                letterSpacing: 0.5,
                color: location ? CYAN : MUTED,
              }}
            >
              {location
                ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                : 'Acquiring GPS...'}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    </View>
  )
}
