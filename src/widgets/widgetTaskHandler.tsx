// Native widget lifecycle handler -- registered once at true app-entry
// time (see index.ts) via react-native-android-widget's
// registerWidgetTaskHandler, same "headless task, looked up by name"
// shape as every other background task in tasks/. Handles the widget
// being added/resized/updated (just re-render from the latest saved
// state) and the widget's own Start/Stop button being tapped (actually
// change the session, then re-render).
//
// Reuses lib/location.ts's beginMonitoringSession/endMonitoringSession --
// the same headless-safe start/stop already built for remote-start-
// session pushes (tasks/remoteSessionTask.ts) -- with notify:false since
// the ward just tapped this themselves; a "Monitoring Started"
// notification would be redundant.

import type { WidgetTaskHandler, WidgetTaskHandlerProps } from "react-native-android-widget";
import { beginMonitoringSession, endMonitoringSession } from "../lib/location";
import { SurveillanceWidget } from "./SurveillanceWidget";
import { readWidgetSessionState } from "./widgetState";

export const WIDGET_NAME = "SurveillanceStatus";

export const widgetTaskHandler: WidgetTaskHandler = async (
  props: WidgetTaskHandlerProps,
) => {
  if (props.widgetInfo.widgetName !== WIDGET_NAME) return;

  if (props.widgetAction === "WIDGET_CLICK" && props.clickAction === "TOGGLE_SESSION") {
    const { isActive } = await readWidgetSessionState();
    if (isActive) {
      await endMonitoringSession({ notify: false });
    } else {
      await beginMonitoringSession({ notify: false });
    }
  }

  const state = await readWidgetSessionState();
  props.renderWidget(
    <SurveillanceWidget
      isActive={state.isActive}
      riskLevel={state.riskLevel}
      elapsedLabel={state.elapsedLabel}
    />,
  );
};
