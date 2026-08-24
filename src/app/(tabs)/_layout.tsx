import { Tabs } from "expo-router";
import {
  BellRing,
  History,
  Home,
  Map,
  ScrollText,
  Settings2,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.bg.secondary,
          borderTopColor: colors.border.subtle,
          borderTopWidth: 1,
          height: 64 + insets.bottom,
          paddingBottom: 10 + insets.bottom,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.text.tertiary,
        tabBarLabelStyle: {
          fontFamily: "JetBrainsMono_400Regular",
          fontSize: 10,
          letterSpacing: 0.5,
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "HOME",
          tabBarIcon: ({ color }) => (
            <Home size={22} color={color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="log"
        options={{
          title: "EVENT LOG",
          tabBarIcon: ({ color }) => (
            <ScrollText size={22} color={color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="live"
        options={{
          title: "LIVE MAP",
          tabBarIcon: ({ color }) => (
            <Map size={22} color={color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "HISTORY",
          tabBarIcon: ({ color }) => (
            <History size={22} color={color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="alerts"
        options={{
          title: "ALERTS",
          tabBarIcon: ({ color }) => (
            <BellRing size={22} color={color} strokeWidth={1.5} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "SETTINGS",
          tabBarIcon: ({ color }) => (
            <Settings2 size={22} color={color} strokeWidth={1.5} />
          ),
        }}
      />
    </Tabs>
  );
}
