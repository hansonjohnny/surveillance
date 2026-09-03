// Pushes a fresh render to any placed home-screen widgets from the
// running app -- useSessionStore.ts calls this on start/stop and on
// every risk-level change (including a shake-triggered High alert,
// which bypasses the normal monitoring cycle entirely) so the widget
// doesn't just sit frozen at whatever it last showed. The
// widgetTaskHandler.tsx path (the widget's own Start/Stop button)
// re-renders itself directly and doesn't need this -- this is only for
// state changes that originate elsewhere (the in-app Start/Stop button,
// a remote-start push, a risk-level update).
//
// Android only -- react-native-android-widget has no iOS implementation.
// Guarded here so every call site can stay platform-agnostic.

import { Platform } from "react-native";
import { requestWidgetUpdate } from "react-native-android-widget";
import { SurveillanceWidget } from "./SurveillanceWidget";
import { WIDGET_NAME } from "./widgetTaskHandler";
import { readWidgetSessionState } from "./widgetState";

export async function syncSurveillanceWidget(): Promise<void> {
  if (Platform.OS !== "android") return;
  try {
    const state = await readWidgetSessionState();
    await requestWidgetUpdate({
      widgetName: WIDGET_NAME,
      renderWidget: () => (
        <SurveillanceWidget
          isActive={state.isActive}
          riskLevel={state.riskLevel}
          elapsedLabel={state.elapsedLabel}
        />
      ),
    });
  } catch (err) {
    console.error("[widget] syncSurveillanceWidget failed:", err);
  }
}
