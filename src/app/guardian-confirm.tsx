import {
  acceptGuardianLink,
  getPendingLink,
  revokeWardLink,
} from "@/lib/guardian";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Shield, ShieldOff } from "lucide-react-native";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const BG = "#0A0A0F";
const CYAN = "#00E5FF";
const MUTED = "#8888A0";

// Reached via the surveillanceai://guardian-confirm?linkId=... deep link
// sent by lib/guardian.ts's inviteWard when a guardian tries to link an
// *existing* account (as opposed to createWardAccount, which provisions a
// brand-new one and needs no separate confirmation — see migration
// 011_guardian_role.sql for why the two paths differ).
export default function GuardianConfirmScreen() {
  const router = useRouter();
  const { linkId } = useLocalSearchParams<{ linkId: string }>();
  const [status, setStatus] = useState<
    "loading" | "pending" | "already-active" | "not-found" | "done"
  >("loading");
  const [guardianEmail, setGuardianEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!linkId) return;
    getPendingLink(linkId).then((link) => {
      if (!link) {
        setStatus("not-found");
        return;
      }
      setGuardianEmail(link.guardianEmail);
      setStatus(link.status === "active" ? "already-active" : "pending");
    });
  }, [linkId]);

  async function handleAccept() {
    if (!linkId) return;
    setBusy(true);
    const ok = await acceptGuardianLink(linkId);
    setBusy(false);
    if (ok) setStatus("done");
  }

  async function handleDecline() {
    if (!linkId) return;
    setBusy(true);
    await revokeWardLink(linkId);
    setBusy(false);
    router.replace("/(tabs)/home");
  }

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      <StatusBar barStyle="light-content" backgroundColor={BG} />
      <SafeAreaView
        edges={["top"]}
        style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 24 }}
      >
        {status === "loading" ? (
          <ActivityIndicator color={CYAN} />
        ) : status === "not-found" ? (
          <>
            <ShieldOff size={40} color="#555568" strokeWidth={1.5} />
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 18,
                color: "#F0F0F5",
                marginTop: 16,
                textAlign: "center",
              }}
            >
              This link is no longer valid
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 13,
                color: MUTED,
                marginTop: 6,
                textAlign: "center",
              }}
            >
              It may have already been used, or the request was withdrawn.
            </Text>
          </>
        ) : status === "already-active" ? (
          <>
            <Shield size={40} color="#00E676" strokeWidth={1.5} />
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 18,
                color: "#F0F0F5",
                marginTop: 16,
                textAlign: "center",
              }}
            >
              Already confirmed
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 13,
                color: MUTED,
                marginTop: 6,
                textAlign: "center",
              }}
            >
              {guardianEmail ?? "This guardian"} can already see your status.
            </Text>
          </>
        ) : status === "done" ? (
          <>
            <Shield size={40} color="#00E676" strokeWidth={1.5} />
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 18,
                color: "#F0F0F5",
                marginTop: 16,
                textAlign: "center",
              }}
            >
              Confirmed
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 13,
                color: MUTED,
                marginTop: 6,
                marginBottom: 24,
                textAlign: "center",
              }}
            >
              {guardianEmail ?? "This guardian"} can now see your live
              status, event log, and alerts.
            </Text>
            <TouchableOpacity
              onPress={() => router.replace("/(tabs)/home")}
              activeOpacity={0.85}
              style={{
                height: 52,
                paddingHorizontal: 32,
                borderRadius: 9999,
                backgroundColor: CYAN,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text
                style={{
                  fontFamily: "DMSans_500Medium",
                  fontSize: 15,
                  color: "#001F24",
                }}
              >
                Done
              </Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <Shield size={40} color={CYAN} strokeWidth={1.5} />
            <Text
              style={{
                fontFamily: "Outfit_600SemiBold",
                fontSize: 18,
                color: "#F0F0F5",
                marginTop: 16,
                textAlign: "center",
              }}
            >
              Monitoring request
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 14,
                lineHeight: 21,
                color: MUTED,
                marginTop: 8,
                marginBottom: 28,
                textAlign: "center",
              }}
            >
              {guardianEmail ?? "Someone"} wants to be able to see your live
              status, event log, and alerts. Nothing is shared until you
              confirm.
            </Text>
            <View style={{ flexDirection: "row", gap: 12, width: "100%" }}>
              <TouchableOpacity
                onPress={handleDecline}
                disabled={busy}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 9999,
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.2)",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                <Text
                  style={{
                    fontFamily: "DMSans_500Medium",
                    fontSize: 15,
                    color: "#F0F0F5",
                  }}
                >
                  Decline
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={handleAccept}
                disabled={busy}
                activeOpacity={0.85}
                style={{
                  flex: 1,
                  height: 52,
                  borderRadius: 9999,
                  backgroundColor: CYAN,
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: busy ? 0.6 : 1,
                }}
              >
                {busy ? (
                  <ActivityIndicator color="#001F24" />
                ) : (
                  <Text
                    style={{
                      fontFamily: "DMSans_500Medium",
                      fontSize: 15,
                      color: "#001F24",
                    }}
                  >
                    Accept
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
      </SafeAreaView>
    </View>
  );
}
