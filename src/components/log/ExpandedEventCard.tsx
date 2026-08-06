import type { Event, RiskLevel } from '@/types'
import { Image, Linking, Text, TouchableOpacity, View } from 'react-native'
import { ChevronUp, MapPin, Pause, Play } from 'lucide-react-native'
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio'

// ─── Risk config ──────────────────────────────────────────────────────────────
const RISK: Record<RiskLevel, { color: string; bg: string; border: string; label: string }> = {
  low:    { color: '#00E676', bg: 'rgba(0, 230, 118, 0.12)',  border: 'rgba(0, 230, 118, 0.30)',  label: 'LOW'    },
  medium: { color: '#FFD740', bg: 'rgba(255, 215, 64, 0.12)', border: 'rgba(255, 215, 64, 0.30)', label: 'MEDIUM' },
  high:   { color: '#FF3D3D', bg: 'rgba(255, 61, 61, 0.12)',  border: 'rgba(255, 61, 61, 0.30)',  label: 'HIGH'   },
}

function formatFull(ms: number): string {
  return new Date(ms).toLocaleString('en-US', {
    weekday: 'short',
    year:    'numeric',
    month:   'long',
    day:     'numeric',
    hour:    '2-digit',
    minute:  '2-digit',
    second:  '2-digit',
  })
}

function openMaps(lat: number, lng: number) {
  Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`)
}

// ─── Section label ────────────────────────────────────────────────────────────
function SectionLabel({ text }: { text: string }) {
  return (
    <Text
      style={{
        fontFamily: 'DMSans_500Medium',
        fontSize: 11,
        letterSpacing: 1.2,
        textTransform: 'uppercase',
        color: '#555568',
        marginBottom: 8,
        marginTop: 20,
      }}
    >
      {text}
    </Text>
  )
}

// ─── Audio clip player ────────────────────────────────────────────────────────
function AudioClipPlayer({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri)
  const status = useAudioPlayerStatus(player)
  const isPlaying = status.playing

  function toggle() {
    if (isPlaying) {
      player.pause()
    } else {
      if (status.didJustFinish) player.seekTo(0)
      player.play()
    }
  }

  const elapsed = Math.floor((status.currentTime ?? 0))
  const duration = Math.floor((status.duration ?? 0))
  const mm = (s: number) => String(Math.floor(s / 60)).padStart(2, '0')
  const ss = (s: number) => String(s % 60).padStart(2, '0')

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(0, 229, 255, 0.06)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(0, 229, 255, 0.20)',
        paddingVertical: 10,
        paddingHorizontal: 14,
      }}
    >
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.7}
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: '#00E5FF',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {isPlaying
          ? <Pause size={16} color="#0A0A0F" strokeWidth={2} />
          : <Play  size={16} color="#0A0A0F" strokeWidth={2} />
        }
      </TouchableOpacity>

      <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, color: '#00E5FF' }}>
        {`${mm(elapsed)}:${ss(elapsed)}`}
        {duration > 0 ? ` / ${mm(duration)}:${ss(duration)}` : ''}
      </Text>
    </View>
  )
}

// ─── Props ────────────────────────────────────────────────────────────────────
type Props = {
  event: Event
  onCollapse: () => void
}

// ─── ExpandedEventCard ────────────────────────────────────────────────────────
export function ExpandedEventCard({ event, onCollapse }: Props) {
  const r = RISK[event.riskLevel]

  return (
    <View
      style={{
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.10)',
        borderRadius: 16,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      {/* 3px left risk edge bar */}
      <View
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 3,
          backgroundColor: r.color,
          shadowColor: r.color,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 6,
          zIndex: 1,
        }}
      />

      {/* Full-width photo */}
      {event.photoUri ? (
        <Image
          source={{ uri: event.photoUri }}
          style={{ width: '100%', height: 200, borderRadius: 12 }}
          resizeMode="cover"
        />
      ) : null}

      <View style={{ padding: 20 }}>
        {/* Header row: risk badge + timestamp */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View
            style={{
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 9999,
              backgroundColor: r.bg,
              borderWidth: 1,
              borderColor: r.border,
            }}
          >
            <Text
              style={{
                fontFamily: 'DMSans_500Medium',
                fontSize: 11,
                letterSpacing: 0.8,
                textTransform: 'uppercase',
                color: r.color,
              }}
            >
              {r.label} RISK
            </Text>
          </View>
        </View>

        {/* Timestamp */}
        <SectionLabel text="Detected at" />
        <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, color: '#8888A0', lineHeight: 20 }}>
          {formatFull(event.timestamp)}
        </Text>

        {/* AI summary */}
        <SectionLabel text="AI Analysis" />
        <Text
          style={{
            fontFamily: 'DMSans_400Regular',
            fontSize: 14,
            lineHeight: 22,
            color: '#F0F0F5',
          }}
        >
          {event.aiSummary}
        </Text>

        {/* Audio Analysis */}
        {event.audioSummary || event.transcript !== undefined ? (
          <>
            <SectionLabel text="Audio Analysis" />
            <Text
              style={{
                fontFamily: 'DMSans_400Regular',
                fontSize: 14,
                lineHeight: 22,
                color: event.audioSummary ? '#F0F0F5' : '#555568',
                fontStyle: event.audioSummary ? 'normal' : 'italic',
              }}
            >
              {event.audioSummary ?? (event.transcript === null ? 'No audio recorded this cycle.' : 'Analysing audio...')}
            </Text>
          </>
        ) : null}

        {/* Audio clip playback */}
        {event.audioUri ? (
          <>
            <SectionLabel text="Audio Clip" />
            <AudioClipPlayer uri={event.audioUri} />
          </>
        ) : null}

        {/* Transcript */}
        {event.transcript ? (
          <>
            <SectionLabel text="Audio Transcript" />
            <View
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.06)',
                padding: 14,
              }}
            >
              <Text
                style={{
                  fontFamily: 'DMSans_400Regular',
                  fontSize: 13,
                  lineHeight: 21,
                  fontStyle: 'italic',
                  color: '#8888A0',
                }}
              >
                "{event.transcript}"
              </Text>
            </View>
          </>
        ) : null}

        {/* Location */}
        {event.location ? (
          <>
            <SectionLabel text="Location" />

            {/* Human-readable address */}
            {event.location.address ? (
              <View
                style={{
                  backgroundColor: 'rgba(255, 255, 255, 0.03)',
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: 'rgba(255, 255, 255, 0.06)',
                  padding: 14,
                  marginBottom: 8,
                  gap: 6,
                }}
              >
                {[
                  { label: 'Name',        value: event.location.address.name },
                  { label: 'Street',      value: [event.location.address.streetNumber, event.location.address.street].filter(Boolean).join(' ') || null },
                  { label: 'District',    value: event.location.address.district },
                  { label: 'City',        value: event.location.address.city },
                  { label: 'Subregion',   value: event.location.address.subregion },
                  { label: 'Region',      value: event.location.address.region },
                  { label: 'Postal Code', value: event.location.address.postalCode },
                  { label: 'Country',     value: event.location.address.country
                      ? `${event.location.address.country}${event.location.address.isoCountryCode ? ` (${event.location.address.isoCountryCode})` : ''}`
                      : null },
                ]
                  .filter((row) => row.value)
                  .map((row) => (
                    <View key={row.label} style={{ flexDirection: 'row', gap: 8 }}>
                      <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#555568', width: 80 }}>
                        {row.label}
                      </Text>
                      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#8888A0', flex: 1 }}>
                        {row.value}
                      </Text>
                    </View>
                  ))}
              </View>
            ) : null}

            {/* Open Maps button with coordinates */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={() => openMaps(event.location!.lat, event.location!.lng)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 8,
                paddingVertical: 10,
                paddingHorizontal: 14,
                backgroundColor: 'rgba(0, 229, 255, 0.06)',
                borderRadius: 10,
                borderWidth: 1,
                borderColor: 'rgba(0, 229, 255, 0.20)',
              }}
            >
              <MapPin size={14} color="#00E5FF" strokeWidth={1.5} />
              <Text style={{ fontFamily: 'JetBrainsMono_400Regular', fontSize: 12, color: '#00E5FF', flex: 1 }}>
                {event.location.lat.toFixed(6)}, {event.location.lng.toFixed(6)}
              </Text>
              <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 11, color: '#00B8CC' }}>
                Open Maps
              </Text>
            </TouchableOpacity>
          </>
        ) : null}

        {/* Source tag */}
        {event.source ? (
          <>
            <SectionLabel text="Trigger" />
            <Text
              style={{
                fontFamily: 'JetBrainsMono_400Regular',
                fontSize: 12,
                color: '#555568',
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {event.source}
            </Text>
          </>
        ) : null}

        {/* Collapse button */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onCollapse}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginTop: 24,
            paddingVertical: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)',
            backgroundColor: 'rgba(255, 255, 255, 0.04)',
          }}
        >
          <ChevronUp size={16} color="#555568" strokeWidth={1.5} />
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 13, color: '#555568' }}>
            Collapse
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  )
}
