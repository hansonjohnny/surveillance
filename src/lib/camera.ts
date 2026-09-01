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
import { getColors } from "react-native-image-colors";

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

// A covered lens (pocket, hand over camera) or otherwise blocked frame
// gives two independent, cheap-to-check signals before ever calling
// GPT-4o: the JPEG compresses far smaller than a normal scene (uniform
// regions compress extremely well), and the frame's average color is
// near-black. Either signal alone is enough to skip the cycle's vision
// call rather than pay for analysing a frame with nothing to see -- the
// prompt already treats an unclear scene as low risk, this just avoids
// spending an API call to reach that same conclusion.
//
// Both thresholds are heuristic starting points (quality: 0.6 JPEG,
// skipProcessing: true, from takeSnapshot above) -- tune if real-world
// testing shows false positives (a very dark but detailed room) or false
// negatives (a covered lens that still reads as "bright enough").
const MIN_PHOTO_BYTES = 15000;
const LOW_LUMINANCE_THRESHOLD = 25; // 0-255 scale, roughly 10% brightness

function hexToLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  // Android's Palette API can return #AARRGGBB -- drop the alpha pair if present.
  const rgb = clean.length === 8 ? clean.slice(2) : clean;
  const r = parseInt(rgb.slice(0, 2), 16);
  const g = parseInt(rgb.slice(2, 4), 16);
  const b = parseInt(rgb.slice(4, 6), 16);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

export async function isFrameLikelyCovered(uri: string): Promise<boolean> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    const size = (info as { size?: number }).size;
    if (info.exists && typeof size === "number" && size < MIN_PHOTO_BYTES) {
      return true;
    }

    const colors = await getColors(uri, { cache: false, quality: "low" });
    const hex =
      colors.platform === "ios"
        ? colors.background
        : colors.platform === "android"
          ? colors.average
          : null;
    if (!hex) return false;

    return hexToLuminance(hex) < LOW_LUMINANCE_THRESHOLD;
  } catch (err) {
    console.error("[camera] isFrameLikelyCovered failed:", err);
    return false; // fail open -- never block real analysis over a broken check
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
