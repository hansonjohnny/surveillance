// Full-width banner shown while an AI-only High-risk alert is counting down
// (see lib/pendingAlert.ts). Mounted once at the root layout so it appears
// over whatever screen the user is on.

import {
  CANCEL_WINDOW_SECONDS,
  cancelPendingAlert,
  sendPendingAlertNow,
} from "@/lib/pendingAlert";
import { usePendingAlertStore } from "@/store/usePendingAlertStore";
import { ShieldAlert } from "lucide-react-native";
import { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const RISK_HIGH = "#FF3D3D";
const TEXT_PRIMARY = "#F0F0F5";

export function PendingAlertBanner() {
  const pending = usePendingAlertStore((s) => s.pending);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!pending) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [pending]);

  if (!pending) return null;

  const remainingMs = Math.max(0, pending.deadline - now);
  const secondsLeft = Math.ceil(remainingMs / 1000);
  const progress = Math.min(
    1,
    Math.max(0, remainingMs / (CANCEL_WINDOW_SECONDS * 1000)),
  );

  return (
    <SafeAreaView
      edges={["top"]}
      style={{ position: "absolute", top: 0, left: 0, right: 0, zIndex: 1000 }}
    >
      <View
        style={{
          margin: 12,
          borderRadius: 16,
          backgroundColor: "rgba(20, 8, 8, 0.96)",
          borderWidth: 1,
          borderColor: "rgba(255, 61, 61, 0.45)",
          padding: 16,
          shadowColor: RISK_HIGH,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.45,
          shadowRadius: 18,
          elevation: 8,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <ShieldAlert size={20} color={RISK_HIGH} strokeWidth={1.5} />
          <Text
            style={{
              fontFamily: "Outfit_600SemiBold",
              fontSize: 15,
              color: TEXT_PRIMARY,
              flex: 1,
            }}
          >
            Possible risk detected
          </Text>
          <Text
            style={{
              fontFamily: "JetBrainsMono_400Regular",
              fontSize: 15,
              color: RISK_HIGH,
            }}
          >
            {secondsLeft}s
          </Text>
        </View>

        <Text
          style={{
            fontFamily: "DMSans_400Regular",
            fontSize: 13,
            color: "#C9A0A0",
            marginTop: 6,
          }}
        >
          Alerting {pending.contact.name} unless you cancel.
        </Text>

        {/* Countdown progress bar */}
        <View
          style={{
            height: 3,
            borderRadius: 9999,
            backgroundColor: "rgba(255, 61, 61, 0.15)",
            marginTop: 12,
            overflow: "hidden",
          }}
        >
          <View
            style={{
              height: "100%",
              width: `${progress * 100}%`,
              backgroundColor: RISK_HIGH,
              borderRadius: 9999,
            }}
          />
        </View>

        <View style={{ flexDirection: "row", gap: 10, marginTop: 14 }}>
          <TouchableOpacity
            onPress={cancelPendingAlert}
            activeOpacity={0.8}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 9999,
              borderWidth: 1,
              borderColor: "rgba(255, 255, 255, 0.2)",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 14,
                letterSpacing: 0.3,
                color: TEXT_PRIMARY,
              }}
            >
              I'm safe — Cancel
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={sendPendingAlertNow}
            activeOpacity={0.8}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 9999,
              backgroundColor: RISK_HIGH,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Text
              style={{
                fontFamily: "DMSans_500Medium",
                fontSize: 14,
                letterSpacing: 0.3,
                color: "#0A0A0F",
              }}
            >
              Send Now
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
