import { AlertCard } from '@/components/alerts/AlertCard'
import { useAlertStore } from '@/store/useAlertStore'
import type { Alert } from '@/types'
import { BellRing, CheckCircle2 } from 'lucide-react-native'
import { FlatList, StatusBar, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

const CYAN = '#00E5FF'
const RED  = '#FF3D3D'

// ─── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 }}>
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: 'rgba(0, 230, 118, 0.08)',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 20,
        }}
      >
        <CheckCircle2 size={32} color="#00E676" strokeWidth={1.5} />
      </View>
      <Text
        style={{
          fontFamily: 'Outfit_600SemiBold',
          fontSize: 18,
          color: '#F0F0F5',
          marginBottom: 8,
          textAlign: 'center',
        }}
      >
        No SOS alerts fired.
      </Text>
      <Text
        style={{
          fontFamily: 'DMSans_400Regular',
          fontSize: 14,
          lineHeight: 22,
          color: '#8888A0',
          textAlign: 'center',
          paddingHorizontal: 40,
        }}
      >
        Stay safe out there.
      </Text>
    </View>
  )
}

// ─── AlertsTabScreen ──────────────────────────────────────────────────────────
export default function AlertsTabScreen() {
  const alerts = useAlertStore((s) => s.alerts)
  const sorted = [...alerts].sort((a, b) => b.timestamp - a.timestamp)

  function renderItem({ item }: { item: Alert }) {
    return <AlertCard alert={item} />
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#0A0A0F' }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <SafeAreaView edges={['top']}>
        <View
          style={{
            height: 64,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            borderBottomWidth: 1,
            borderBottomColor: 'rgba(255, 255, 255, 0.10)',
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <BellRing size={20} color={RED} strokeWidth={1.5} />
            <Text style={{ fontFamily: 'Outfit_700Bold', fontSize: 17, color: CYAN }}>
              Surveillance AI
            </Text>
          </View>
          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 11,
              color: '#555568',
              letterSpacing: 0.3,
            }}
          >
            {sorted.length} SOS alert{sorted.length === 1 ? '' : 's'} total
          </Text>
        </View>
      </SafeAreaView>

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{
          paddingHorizontal: 20,
          paddingTop: 28,
          paddingBottom: 100,
          flexGrow: 1,
        }}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={{ marginBottom: 24 }}>
            <Text
              style={{
                fontFamily: 'Outfit_700Bold',
                fontSize: 28,
                lineHeight: 36,
                letterSpacing: -0.5,
                color: '#F0F0F5',
                marginBottom: 6,
              }}
            >
              SOS Alerts
            </Text>
            <Text
              style={{
                fontFamily: 'DMSans_400Regular',
                fontSize: 14,
                lineHeight: 22,
                color: '#8888A0',
              }}
            >
              {sorted.length > 0
                ? `${sorted.length} SOS alert${sorted.length === 1 ? '' : 's'} total — newest first`
                : 'No high-risk events have triggered an alert'}
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyState />}
      />

      {/* Atmospheric red bottom glow */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          bottom: -100,
          left: '50%',
          marginLeft: -150,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: 'rgba(100, 20, 20, 0.12)',
        }}
      />
    </View>
  )
}
