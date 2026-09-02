// react-native-web's Alert.alert() is a literal no-op (verified by
// reading node_modules/react-native-web/src/exports/Alert/index.js:
// `class Alert { static alert() {} }`) -- every Alert.alert() call on
// web silently does nothing at all: no dialog appears, and critically
// no callback ever fires either, since a callback only runs when a
// (never-shown) button is tapped. That silently broke every confirm
// action (sign out, revoke a ward) and every plain feedback alert
// (remote start/stop result) on the guardian web dashboard.
//
// These wrappers keep the exact same native Alert.alert behavior on
// native, and give web a real (if plainer) implementation via the
// browser's built-in window.alert/window.confirm.

import { Alert, Platform } from "react-native";

export function showAlert(title: string, message?: string): void {
  if (Platform.OS === "web") {
    window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

// confirmLabel's button always uses the native "destructive" style —
// every current call site (sign out, stop monitoring a ward) is a
// destructive-ish action; add a style param here if a non-destructive
// confirm is ever needed.
export function showConfirm(
  title: string,
  message: string,
  confirmLabel: string,
  onConfirm: () => void,
): void {
  if (Platform.OS === "web") {
    if (window.confirm(`${title}\n\n${message}`)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: "Cancel", style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}
