import { LiveMap } from "@/components/map/LiveMap";
import { createShareLink, revokeShareLink } from "@/lib/liveShare";
import { buildDirectionsUrl } from "@/lib/maps";
import { buildRiskTaggedPath, countRisks } from "@/lib/riskPath";
import { useAlertStore } from "@/store/useAlertStore";
import { useLiveShareStore } from "@/store/useLiveShareStore";
import { useSessionStore } from "@/store/useSessionStore";
import * as Location from "expo-location";
import { MapPin, Navigation, Share2 } from "lucide-react-native";
import { useEffect, useMemo, useState } from "react";
import {
  Linking,
  Share,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BG = "#0A0A0F";
const MUTED = "#8888A0";
const CYAN = "#00E5FF";
const RISK_LOW = "#00E676";
const RISK_MEDIUM = "#FFD740";
const RISK_HIGH = "#FF3D3D";

export default function LiveScreen() {
  // Use the session store location when a session is active;
  // fall back to a one-shot device location so the map always has a pin.
  const lastLocation = useSessionStore((s) => s.lastLocation);
  const locationHistory = useSessionStore((s) => s.locationHistory);
  const sessionId = useSessionStore((s) => s.sessionId);
  const userId = useSessionStore((s) => s.userId);
  const events = useAlertStore((s) => s.events);
  const activeLink = useLiveShareStore((s) => s.activeLink);
  const setActiveLink = useLiveShareStore((s) => s.setActiveLink);
  const clearActiveLink = useLiveShareStore((s) => s.clearActiveLink);
  const [sharing, setSharing] = useState(false);
  const [deviceLocation, setDeviceLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);

  // A stored link only counts as "active" if it belongs to the session
  // that's running right now — a link from a previous session should show
  // the idle "Share" button, not a stale "stop sharing" chip.
  const isSharingThisSession =
    !!activeLink && activeLink.sessionId === sessionId;

  async function handleSharePress() {
    if (isSharingThisSession && activeLink) {
      await revokeShareLink(activeLink.id);
      clearActiveLink();
      return;
    }

    if (!sessionId || !userId || sharing) return;
    setSharing(true);
    try {
      const link = await createShareLink(sessionId, userId);
      if (!link) return;
      setActiveLink(link);
      await Share.share({
        message: `I'm sharing my live location with you via Surveillance AI: ${link.url}`,
        url: link.url,
      });
    } finally {
      setSharing(false);
    }
  }

  useEffect(() => {
    if (lastLocation) return; // session location takes priority
    Location.getForegroundPermissionsAsync()
      .then(({ status }) => {
        if (status !== "granted") return;
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        })
          .then((pos) => {
            setDeviceLocation({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
            });
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, [lastLocation]);

  const location = lastLocation ?? deviceLocation;

  // Tag each breadcrumb with the risk level known at that point in time —
  // the monitoring cycle's AI risk score (from events) is much sparser than
  // the continuous GPS trail, so each point inherits the most recent score.
  const riskPath = useMemo(
    () => buildRiskTaggedPath(locationHistory, events, sessionId),
    [locationHistory, events, sessionId],
  );

  const riskCounts = useMemo(() => countRisks(riskPath), [riskPath]);

  function handleGetDirections() {
    const url = buildDirectionsUrl(locationHistory);
    if (url) Linking.openURL(url).catch(() => {});
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar
        barStyle="light-content"
        backgroundColor="transparent"
        translucent
      />

      <LiveMap location={location} path={riskPath} />

      {/* GPS coordinates chip — floats top-right */}
      <SafeAreaView
        edges={["top"]}
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          left: 0,
          pointerEvents: "none",
        }}
      >
        <View
          style={{
            alignItems: "flex-end",
            paddingHorizontal: 16,
            paddingTop: 8,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 12,
              paddingVertical: 7,
              borderRadius: 9999,
              backgroundColor: "rgba(10, 10, 15, 0.85)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.12)",
            }}
          >
            <MapPin size={11} color={CYAN} strokeWidth={1.5} />
            <Text
              style={{
                fontFamily: "JetBrainsMono_400Regular",
                fontSize: 11,
                letterSpacing: 0.5,
                color: location ? CYAN : MUTED,
              }}
            >
              {location
                ? `${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`
                : "Acquiring GPS..."}
            </Text>
          </View>

          {/* Risk-along-route legend — counts of recorded points at each risk level */}
          {(riskCounts.low > 0 ||
            riskCounts.medium > 0 ||
            riskCounts.high > 0) && (
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                marginTop: 8,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 9999,
                backgroundColor: "rgba(10, 10, 15, 0.85)",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.12)",
              }}
            >
              {[
                { label: riskCounts.low, color: RISK_LOW },
                { label: riskCounts.medium, color: RISK_MEDIUM },
                { label: riskCounts.high, color: RISK_HIGH },
              ].map((item, i) => (
                <View
                  key={i}
                  style={{ flexDirection: "row", alignItems: "center", gap: 5 }}
                >
                  <View
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: 4,
                      backgroundColor: item.color,
                    }}
                  />
                  <Text
                    style={{
                      fontFamily: "JetBrainsMono_400Regular",
                      fontSize: 11,
                      color: "#F0F0F5",
                    }}
                  >
                    {item.label}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Live Share — generates a link an emergency contact can open
              in any browser to watch this session's position, no app
              install required. Only available while a session is active. */}
          {sessionId && (
            <TouchableOpacity
              onPress={handleSharePress}
              disabled={sharing}
              activeOpacity={0.8}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 6,
                marginTop: 8,
                paddingHorizontal: 12,
                paddingVertical: 7,
                borderRadius: 9999,
                pointerEvents: "auto",
                backgroundColor: isSharingThisSession
                  ? "rgba(0, 229, 255, 0.10)"
                  : "rgba(10, 10, 15, 0.85)",
                borderWidth: 1,
                borderColor: isSharingThisSession
                  ? "rgba(0, 229, 255, 0.40)"
                  : "rgba(255, 255, 255, 0.12)",
              }}
            >
              <Share2
                size={11}
                color={isSharingThisSession ? CYAN : MUTED}
                strokeWidth={1.5}
              />
              <Text
                style={{
                  fontFamily: "JetBrainsMono_400Regular",
                  fontSize: 11,
                  letterSpacing: 0.5,
                  color: isSharingThisSession ? CYAN : MUTED,
                }}
              >
                {isSharingThisSession
                  ? "LIVE SHARING · TAP TO STOP"
                  : sharing
                    ? "CREATING LINK..."
                    : "SHARE LIVE LOCATION"}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>

      {/* Get Directions — opens the actual Google Maps app for a clearer,
          familiar view of the route from where monitoring started to the
          last recorded point. */}
      {locationHistory.length >= 2 && (
        <TouchableOpacity
          onPress={handleGetDirections}
          activeOpacity={0.8}
          style={{
            position: "absolute",
            bottom: 28,
            alignSelf: "center",
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderRadius: 9999,
            backgroundColor: "#00E5FF",
          }}
        >
          <Navigation size={16} color="#001F24" strokeWidth={2} />
          <Text
            style={{
              fontFamily: "JetBrainsMono_400Regular",
              fontSize: 13,
              letterSpacing: 0.5,
              color: "#001F24",
            }}
          >
            GET DIRECTIONS
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
