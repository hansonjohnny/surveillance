// Custom app entry -- replaces the default "expo-router/entry" main so we
// also get a chance to register the home-screen widget's headless task
// handler (react-native-android-widget) before anything else runs. See
// src/widgets/widgetTaskHandler.tsx for what it actually does.

import "expo-router/entry";

import { Platform } from "react-native";
import { registerWidgetTaskHandler } from "react-native-android-widget";
import { widgetTaskHandler } from "./src/widgets/widgetTaskHandler";

// react-native-android-widget is Android-only. Registering the task
// handler is just AppRegistry.registerHeadlessTask under the hood (no
// native call happens here), so this would likely be harmless on iOS
// too -- but this runs at true entry time, before any of the app's own
// guards exist, so it's guarded explicitly rather than assumed safe.
if (Platform.OS === "android") {
  registerWidgetTaskHandler(widgetTaskHandler);
}
