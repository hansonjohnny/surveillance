// Camera utilities for silent background snapshot capture.
//
// Architecture note — why there is a SilentCamera component:
//
//   expo-camera has no headless API. You cannot call takePictureAsync()
//   without a CameraView mounted in the React tree. To keep captures
//   invisible to the user, SilentCamera (components/ui/SilentCamera.tsx)
//   renders a 1×1 transparent CameraView and registers its ref here via
//   registerCameraRef(). takeSnapshot() then calls takePictureAsync() on
//   that ref. Mount SilentCamera on the Home screen whenever surveillance
//   is active — unmounting it clears the ref, and takeSnapshot() returns
//   null safely.

import { Camera, type CameraView } from "expo-camera";
import * as FileSystem from "expo-file-system/legacy";
import type { RefObject } from "react";

let _ref: RefObject<CameraView | null> | null = null;
let _ready = false;
let _nextFacing: "front" | "back" = "back";
let _setFacing: ((f: "front" | "back") => void) | null = null;
let _remountCallback: (() => void) | null = null;
let _lastRemountTime = 0;
const REMOUNT_COOLDOWN_MS = 8000;

export function registerCameraRef(ref: RefObject<CameraView | null>) {
  _ref = ref;
  _ready = false;
}

export function setCameraReady() {
  _ready = true;
}

export function clearCameraRef() {
  _ref = null;
  _ready = false;
}

export function registerFacingSetter(setter: (f: "front" | "back") => void) {
  _setFacing = setter;
}

export function clearFacingSetter() {
  _setFacing = null;
}

// Called by SilentCamera to register a remount handler.
// When takeSnapshot() fails (e.g. phone call interrupts AVCaptureSession),
// we request a CameraView remount so it re-initialises once the call ends.
export function registerRemountCallback(cb: () => void) {
  _remountCallback = cb;
}

export function clearRemountCallback() {
  _remountCallback = null;
}

function requestRemount() {
  const now = Date.now();
  if (_remountCallback && now - _lastRemountTime > REMOUNT_COOLDOWN_MS) {
    _lastRemountTime = now;
    _ready = false;
    console.log("[camera] requesting CameraView remount — will recover when call ends");
    _remountCallback();
  }
}

export async function requestCameraPermission(): Promise<boolean> {
  const { status } = await Camera.requestCameraPermissionsAsync();
  return status === "granted";
}

export async function takeSnapshot(): Promise<string | null> {
  try {
    if (!_ref?.current) {
      console.warn(
        "[camera] takeSnapshot: CameraView not mounted — is SilentCamera rendered?",
      );
      return null;
    }
    if (!_ready) {
      console.warn("[camera] takeSnapshot: camera not ready yet, skipping");
      return null;
    }
    const photo = await _ref.current.takePictureAsync({
      quality: 0.6,
      skipProcessing: true,
    });

    // Alternate to the other camera for the next cycle.
    const nextFacing = _nextFacing === "back" ? "front" : "back";
    _nextFacing = nextFacing;
    _ready = false; // camera needs to reinitialise with the new facing
    if (_setFacing) _setFacing(nextFacing);

    return photo?.uri ?? null;
  } catch (err) {
    console.error("[camera] takeSnapshot failed:", err);
    // Signal SilentCamera to remount. If the failure was caused by a phone-call
    // interrupting AVCaptureSession, the remount will recover automatically once
    // the call ends and the system releases the audio session.
    requestRemount();
    return null;
  }
}

export async function photoToBase64(uri: string): Promise<string | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch (err) {
    console.error("[camera] photoToBase64 failed:", err);
    return null;
  }
}
