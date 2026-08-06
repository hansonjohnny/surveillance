import { EventCard } from "@/components/log/EventCard";
import { ExpandedEventCard } from "@/components/log/ExpandedEventCard";
import { useAlertStore } from "@/store/useAlertStore";
import type { Event } from "@/types";
import { useRouter } from "expo-router";
import { BellRing, ScrollText, Shield } from "lucide-react-native";
import { useState } from "react";
import {
  FlatList,
  LayoutAnimation,
  Platform,
  StatusBar,
  Text,
  TouchableOpacity,
  UIManager,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// Enable LayoutAnimation on Android
if (Platform.OS === "android") {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}

const CYAN = "#00E5FF";

// ─── EmptyState ───────────────────────────────────────────────────────────────
function EmptyState() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        paddingTop: 80,
      }}
    >
      <View
        style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: "rgba(0, 229, 255, 0.08)",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 20,
        }}
      >
        <ScrollText size={32} color="#555568" strokeWidth={1.5} />
      </View>
      <Text
        style={{
          fontFamily: "Outfit_600SemiBold",
          fontSize: 18,
          color: "#F0F0F5",
          marginBottom: 8,
          textAlign: "center",
        }}
      >
        No events yet
      </Text>
      <Text
        style={{
          fontFamily: "DMSans_400Regular",
          fontSize: 14,
          lineHeight: 22,
          color: "#8888A0",
          textAlign: "center",
          paddingHorizontal: 40,
        }}
      >
        Start a session to begin monitoring. Events will appear here as they are
        detected.
      </Text>
    </View>
  );
}

// ─── LogScreen ────────────────────────────────────────────────────────────────
export default function LogScreen() {
  const router = useRouter();
  const events = useAlertStore((s) => s.events);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function handlePress(id: string) {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId((prev) => (prev === id ? null : id));
  }

  function handleCollapse() {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(null);
  }

  function renderItem({ item }: { item: Event }) {
    if (item.id === expandedId) {
      return <ExpandedEventCard event={item} onCollapse={handleCollapse} />;
    }
    return <EventCard event={item} onPress={() => handlePress(item.id)} />;
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0A0A0F" }}>
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <SafeAreaView edges={["top"]}>
        <View
          style={{
            height: 64,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 20,
            borderBottomWidth: 1,
            borderBottomColor: "rgba(255, 255, 255, 0.10)",
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Shield size={20} color={CYAN} strokeWidth={1.5} />
            <Text
              style={{
                fontFamily: "Outfit_700Bold",
                fontSize: 17,
                color: CYAN,
              }}
            >
              Surveillance AI
            </Text>
          </View>
          <TouchableOpacity
            style={{ padding: 8 }}
            onPress={() => router.push("/alerts")}
          >
            <BellRing size={24} color={CYAN} strokeWidth={1.5} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <FlatList
        data={events}
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
                fontFamily: "Outfit_700Bold",
                fontSize: 28,
                lineHeight: 36,
                letterSpacing: -0.5,
                color: "#F0F0F5",
                marginBottom: 6,
              }}
            >
              Event Log
            </Text>
            <Text
              style={{
                fontFamily: "DMSans_400Regular",
                fontSize: 14,
                lineHeight: 22,
                color: "#8888A0",
              }}
            >
              {events.length > 0
                ? `${events.length >= 100 ? "Last 100" : `${events.length} event${events.length === 1 ? "" : "s"}`} recorded — newest first`
                : "No events recorded yet"}
            </Text>
          </View>
        }
        ListEmptyComponent={<EmptyState />}
      />

      {/* Decorative bottom glow */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          bottom: -100,
          left: "50%",
          marginLeft: -150,
          width: 300,
          height: 300,
          borderRadius: 150,
          backgroundColor: "rgba(0, 97, 109, 0.10)",
        }}
      />
    </View>
  );
}
