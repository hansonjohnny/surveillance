import type { Alert } from '@/types'
import { Mail, MapPin, MessageSquare, Phone } from 'lucide-react-native'
import { Linking, Text, TouchableOpacity, View } from 'react-native'

const RED   = '#FF3D3D'
const GREEN = '#00E676'
const GREY  = '#555568'
const CYAN  = '#00E5FF'
const AMBER = '#FFD740'

function formatFull(ms: number): string {
  const d = new Date(ms)
  const days    = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months  = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const hh  = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  const ss  = String(d.getSeconds()).padStart(2, '0')
  return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()} ${d.getFullYear()} · ${hh}:${min}:${ss}`
}

type ChipDef = { label: string; Icon: typeof Mail; sent: boolean }

type Props = { alert: Alert }

export function AlertCard({ alert }: Props) {
  const chips: ChipDef[] = [
    { label: 'SMS',   Icon: MessageSquare, sent: alert.smsSent   },
    { label: 'EMAIL', Icon: Mail,          sent: alert.emailSent },
    { label: 'CALL',  Icon: Phone,         sent: alert.callMade  },
  ]

  function openMaps() {
    if (!alert.location) return
    const { lat, lng } = alert.location
    Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`)
  }

  return (
    <View
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 61, 61, 0.25)',
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
        shadowColor: RED,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
      }}
    >
      {/* Red left edge bar */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: RED,
          shadowColor: RED,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 6,
        }}
      />

      <View style={{ padding: 20 }}>
        {/* Row 1: SOS FIRED badge + timestamp */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 12,
          }}
        >
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 9999,
              backgroundColor: 'rgba(255, 61, 61, 0.10)',
              borderWidth: 1,
              borderColor: 'rgba(255, 61, 61, 0.30)',
            }}
          >
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 11,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: RED,
              }}
            >
              SOS FIRED
            </Text>
          </View>

          <Text
            style={{
              fontFamily: 'JetBrainsMono_400Regular',
              fontSize: 11,
              color: '#8888A0',
              textAlign: 'right',
              flexShrink: 1,
              marginLeft: 12,
            }}
          >
            {formatFull(alert.timestamp)}
          </Text>
        </View>

        {/* Acknowledgment / escalation status — see lib/escalation.ts */}
        {(alert.acknowledgedAt || alert.escalatedAt) && (
          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 9999,
              marginBottom: 12,
              backgroundColor: alert.acknowledgedAt
                ? 'rgba(0, 230, 118, 0.10)'
                : 'rgba(255, 215, 64, 0.10)',
              borderWidth: 1,
              borderColor: alert.acknowledgedAt
                ? 'rgba(0, 230, 118, 0.30)'
                : 'rgba(255, 215, 64, 0.30)',
            }}
          >
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 11,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: alert.acknowledgedAt ? GREEN : AMBER,
              }}
            >
              {alert.acknowledgedAt
                ? 'Acknowledged'
                : `Escalated to ${alert.backupContactName}`}
            </Text>
          </View>
        )}

        {/* Sent to [name] */}
        <Text
          style={{
            fontFamily: 'DMSans_500Medium',
            fontSize: 14,
            color: '#F0F0F5',
            marginBottom: 14,
          }}
        >
          Sent to{' '}
          <Text style={{ color: CYAN }}>{alert.contactName}</Text>
        </Text>

        {/* Channel chips */}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {chips.map(({ label, Icon, sent }) => (
            <View
              key={label}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 5,
                paddingHorizontal: 10,
                paddingVertical: 5,
                borderRadius: 9999,
                backgroundColor: sent
                  ? 'rgba(0, 230, 118, 0.10)'
                  : 'rgba(85, 85, 104, 0.15)',
                borderWidth: 1,
                borderColor: sent
                  ? 'rgba(0, 230, 118, 0.30)'
                  : 'rgba(85, 85, 104, 0.30)',
              }}
            >
              <Icon size={12} color={sent ? GREEN : GREY} strokeWidth={1.5} />
              <Text
                style={{
                  fontFamily: 'JetBrainsMono_400Regular',
                  fontSize: 11,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  color: sent ? GREEN : GREY,
                }}
              >
                {label}
              </Text>
            </View>
          ))}
        </View>

        {/* Divider */}
        <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', marginBottom: 14 }} />

        {/* AI summary section label */}
        <Text
          style={{
            fontFamily: 'JetBrainsMono_400Regular',
            fontSize: 11,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: '#8888A0',
            marginBottom: 6,
          }}
        >
          AI Detection Summary
        </Text>

        {/* AI summary body */}
        <Text
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 14,
            lineHeight: 22,
            color: '#F0F0F5',
            marginBottom: alert.location ? 14 : 0,
          }}
        >
          {alert.aiSummary}
        </Text>

        {/* GPS link — only rendered when coordinates are available */}
        {alert.location && (
          <>
            <View style={{ height: 1, backgroundColor: 'rgba(255, 255, 255, 0.06)', marginBottom: 12 }} />
            <TouchableOpacity
              onPress={openMaps}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MapPin size={14} color={CYAN} strokeWidth={1.5} />
              <Text
                style={{
                  fontFamily: 'JetBrainsMono_400Regular',
                  fontSize: 12,
                  color: CYAN,
                }}
              >
                {alert.location.lat.toFixed(5)}, {alert.location.lng.toFixed(5)}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </View>
  )
}
