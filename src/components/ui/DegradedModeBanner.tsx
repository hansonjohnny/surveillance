import { Linking, Text, TouchableOpacity, View } from "react-native";

const AMBER = "#FFD740";

type Props = {
  cameraGranted: boolean;
  micGranted: boolean;
};

export function DegradedModeBanner({ cameraGranted, micGranted }: Props) {
  if (cameraGranted && micGranted) return null;

  return (
    <View>
      {!cameraGranted && (
        <Banner message="Camera disabled — visual analysis unavailable" />
      )}
      {!micGranted && (
        <Banner message="Microphone disabled — audio analysis unavailable" />
      )}
    </View>
  );
}

function Banner({ message }: { message: string }) {
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 16,
        paddingVertical: 10,
        backgroundColor: "rgba(255, 215, 64, 0.12)",
        borderWidth: 1,
        borderColor: "rgba(255, 215, 64, 0.30)",
      }}
    >
      <Text
        style={{
          fontFamily: "DMSans_400Regular",
          fontSize: 13,
          color: AMBER,
          flex: 1,
        }}
      >
        {message}
      </Text>
      <TouchableOpacity
        onPress={() => Linking.openSettings()}
        accessibilityLabel="Fix in Settings"
        style={{
          marginLeft: 12,
          paddingHorizontal: 10,
          paddingVertical: 5,
          borderRadius: 6,
          borderWidth: 1,
          borderColor: "rgba(255, 215, 64, 0.40)",
        }}
      >
        <Text
          style={{
            fontFamily: "DMSans_500Medium",
            fontSize: 12,
            color: AMBER,
          }}
        >
          Fix in Settings
        </Text>
      </TouchableOpacity>
    </View>
  );
}
