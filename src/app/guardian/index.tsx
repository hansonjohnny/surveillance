import {
  fetchWardSnapshot,
  inviteWard,
  listWards,
  revokeWardLink,
  type WardLink,
} from "@/lib/guardian";
import type { RiskLevel } from "@/types";
import { useFocusEffect, useRouter } from "expo-router";
import { ArrowLeft, ChevronRight, Shield, UserPlus, X } from "lucide-react-native";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert as RNAlert,
  Modal,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BG = "#0A0A0F";
const CYAN = "#00E5FF";
const MUTED = "#8888A0";
const RISK_COLORS: Record<RiskLevel, string> = {
  low: "#00E676",
  medium: "#FFD740",
  high: "#FF3D3D",
};

function relativeTime(ts: number | null): string {
  if (!ts) return "Never";
  const secs = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

type WardRowState = WardLink & {
  riskLevel: RiskLevel | null;
  lastSeenAt: number | null;
  loadingSnapshot: boolean;
};

// ─── EmptyWards ───────────────────────────────────────────────────────────────
function EmptyWards() {
  return (
    <View style={{ alignItems: "center", paddingTop: 60 }}>
      <Shield size={40} color="#555568" strokeWidth={1.5} />
      <Text
        style={{
          fontFamily: "Outfit_600SemiBold",
          fontSize: 16,
          color: "#F0F0F5",
          marginTop: 16,
        }}
      >
        No one linked yet
      </Text>
      <Text
        style={{
          fontFamily: "DMSans_400Regular",
          fontSize: 13,
          color: MUTED,
          textAlign: "center",
          marginTop: 6,
          paddingHorizontal: 20,
        }}
      >
        Invite someone by their account email to see their live status, event
        log, and alerts here.
      </Text>
    </View>
  );
}

// ─── WardRow ──────────────────────────────────────────────────────────────────
function WardRow({
  ward,
  onPress,
  onRevoke,
}: {
  ward: WardRowState;
  onPress: () => void;
  onRevoke: () => void;
}) {
  const dotColor = ward.riskLevel ? RISK_COLORS[ward.riskLevel] : "#555568";
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={{
        flexDirection: "row",
        alignItems: "center",
        padding: 16,
        borderRadius: 14,
        backgroundColor: "rgba(255, 255, 255, 0.04)",
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.08)",
        marginBottom: 10,
      }}
    >
      <View
        style={{
          width: 10,
          height: 10,
          borderRadius: 5,
          backgroundColor: dotColor,
          marginRight: 12,
        }}
      />
      <View style={{ flex: 1 }}>
        <Text
          style={{
            fontFamily: "DMSans_500Medium",
            fontSize: 14,
            color: "#F0F0F5",
          }}
        >
          {ward.wardEmail ?? "Unknown"}
        </Text>
        <Text
          style={{
            fontFamily: "JetBrainsMono_400Regular",
            fontSize: 11,
            color: MUTED,
            marginTop: 2,
          }}
        >
          {ward.loadingSnapshot
            ? "Loading..."
            : `Last seen ${relativeTime(ward.lastSeenAt)}`}
        </Text>
      </View>
      <TouchableOpacity
        onPress={onRevoke}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={{ padding: 6, marginRight: 4 }}
      >
        <X size={16} color={MUTED} strokeWidth={1.5} />
      </TouchableOpacity>
      <ChevronRight size={18} color={MUTED} strokeWidth={1.5} />
    </TouchableOpacity>
  );
}

// ─── InviteModal ──────────────────────────────────────────────────────────────
function InviteModal({
  visible,
  onClose,
  onInvited,
}: {
  visible: boolean;
  onClose: () => void;
  onInvited: () => void;
}) {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const result = await inviteWard(email);
    setSubmitting(false);
    if (!result.success) {
      setError(result.error ?? "Something went wrong.");
      return;
    }
    setEmail("");
    onInvited();
    onClose();
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View
        style={{
          flex: 1,
          justifyContent: "flex-end",
          backgroundColor: "rgba(0, 0, 0, 0.6)",
        }}
      >
        <View
          style={{
            backgroundColor: "#111118",
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            padding: 24,
            paddingBottom: 40,
          }}
        >
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 18,
              color: "#F0F0F5",
              marginBottom: 8,
            }}
          >
            Invite a Ward
          </Text>
          <Text
            style={{
              fontFamily: "DMSans_400Regular",
              fontSize: 13,
              color: MUTED,
              marginBottom: 16,
            }}
          >
            Enter the email address they used to sign up for Surveillance AI.
            The link activates immediately, no action needed on their side.
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="ward@example.com"
            placeholderTextColor="#555568"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              height: 52,
              borderRadius: 12,
              backgroundColor: "rgba(255, 255, 255, 0.05)",
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.10)",
              paddingHorizontal: 16,
              color: "#F0F0F5",
              fontFamily: "DMSans_400Regular",
              fontSize: 15,
            }}
          />
          {error ? (
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 12,
                color: "#FF3D3D",
                marginTop: 8,
              }}
            >
              {error}
            </Text>
          ) : null}
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.85}
            style={{
              height: 52,
              borderRadius: 9999,
              backgroundColor: CYAN,
              alignItems: "center",
              justifyContent: "center",
              marginTop: 20,
              opacity: submitting ? 0.6 : 1,
            }}
          >
            {submitting ? (
              <ActivityIndicator color="#001F24" />
            ) : (
              <Text
                style={{
                  fontFamily: "DMSans_500Medium",
                  fontSize: 15,
                  color: "#001F24",
                }}
              >
                Send Invite
              </Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            style={{ alignItems: "center", marginTop: 14 }}
          >
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 14,
                color: MUTED,
              }}
            >
              Cancel
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── GuardianListScreen ───────────────────────────────────────────────────────
export default function GuardianListScreen() {
  const router = useRouter();
  const [wards, setWards] = useState<WardRowState[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const links = await listWards();
    setWards(
      links.map((l) => ({
        ...l,
        riskLevel: null,
        lastSeenAt: null,
        loadingSnapshot: true,
      })),
    );
    setLoading(false);

    // Fetch each ward's latest snapshot for the risk dot / last-seen time —
    // acceptable as N small fetches given a guardian typically links a
    // handful of wards, not hundreds.
    links.forEach(async (link) => {
      const snapshot = await fetchWardSnapshot(link.wardId);
      const latestEvent = snapshot.events[0] ?? null;
      setWards((prev) =>
        prev.map((w) =>
          w.id === link.id
            ? {
                ...w,
                riskLevel: latestEvent?.riskLevel ?? null,
                lastSeenAt:
                  snapshot.session?.lastLocationAt ??
                  latestEvent?.timestamp ??
                  null,
                loadingSnapshot: false,
              }
            : w,
        ),
      );
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  function handleRevoke(ward: WardRowState) {
    RNAlert.alert(
      "Stop monitoring?",
      `You'll no longer be able to see ${ward.wardEmail ?? "this person"}'s status.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Stop Monitoring",
          style: "destructive",
          onPress: async () => {
            await revokeWardLink(ward.id);
            refresh();
          },
        },
      ],
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <SafeAreaView edges={["top"]}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            height: 64,
            paddingHorizontal: 16,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255, 255, 255, 0.10)",
          }}
        >
          <TouchableOpacity onPress={() => router.back()} style={{ padding: 8 }}>
            <ArrowLeft size={20} color={CYAN} strokeWidth={1.5} />
          </TouchableOpacity>
          <Text
            style={{
              fontFamily: "Outfit_700Bold",
              fontSize: 17,
              color: "#F0F0F5",
              marginLeft: 4,
            }}
          >
            Guardian
          </Text>
        </View>
      </SafeAreaView>

      <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 20 }}>
        {wards.length === 0 && !loading ? (
          <EmptyWards />
        ) : (
          wards.map((w) => (
            <WardRow
              key={w.id}
              ward={w}
              onPress={() =>
                router.push(
                  `/guardian/${w.wardId}?email=${encodeURIComponent(w.wardEmail ?? "")}`,
                )
              }
              onRevoke={() => handleRevoke(w)}
            />
          ))
        )}

        <TouchableOpacity
          onPress={() => setInviteOpen(true)}
          activeOpacity={0.85}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            height: 52,
            borderRadius: 9999,
            backgroundColor: CYAN,
            marginTop: 12,
          }}
        >
          <UserPlus size={18} color="#001F24" strokeWidth={2} />
          <Text
            style={{
              fontFamily: "DMSans_500Medium",
              fontSize: 15,
              color: "#001F24",
            }}
          >
            Invite a Ward
          </Text>
        </TouchableOpacity>
      </View>

      <InviteModal
        visible={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onInvited={refresh}
      />
    </View>
  );
}
