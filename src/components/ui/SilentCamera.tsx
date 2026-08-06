// SilentCamera — 1×1 transparent CameraView used for silent snapshot capture.
//
// expo-camera requires a mounted CameraView to call takePictureAsync().
// This component satisfies that requirement while remaining invisible to the
// user: it is positioned absolutely, sized to 1×1 px, and fully transparent.
// Mount it on the Home screen when surveillance is active. Unmounting it
// clears the camera ref in lib/camera.ts so takeSnapshot() fails gracefully.

import { CameraView } from "expo-camera";
import { useEffect, useRef, useState } from "react";
import {
  clearCameraRef,
  clearFacingSetter,
  clearRemountCallback,
  registerCameraRef,
  registerFacingSetter,
  registerRemountCallback,
  setCameraReady,
} from "../../lib/camera";
import { useSettingsStore } from "../../store/useSettingsStore";

// useRef inside the component — required for the New Architecture (Fabric).
// Module-level createRef returns a numeric native view tag on Fabric, which
// cannot be cast to ExpoCameraView. A component-scoped useRef gives the
// correct CameraView instance.

export function SilentCamera() {
  const cameraRef = useRef<CameraView>(null);
  const cameraSoundEnabled = useSettingsStore((s) => s.cameraSoundEnabled);
  const [facing, setFacing] = useState<"front" | "back">("back");
  // Incrementing this key forces CameraView to fully unmount and remount,
  // re-initialising AVCaptureSession after a phone-call interruption.
  const [mountKey, setMountKey] = useState(0);

  useEffect(() => {
    registerCameraRef(cameraRef);
    registerFacingSetter(setFacing);
    registerRemountCallback(() => setMountKey((k) => k + 1));
    return () => {
      clearCameraRef();
      clearFacingSetter();
      clearRemountCallback();
    };
  }, []);

  return (
    <CameraView
      key={mountKey}
      ref={cameraRef}
      facing={facing}
      pointerEvents="none"
      onCameraReady={setCameraReady}
      onMountError={(e) => {
        console.warn("[camera] CameraView mount error:", e.message);
        // clearCameraRef so takeSnapshot() returns null instead of throwing,
        // and its own failure path will call requestRemount() with cooldown.
      }}
      mute={!cameraSoundEnabled}
      style={{
        position: "absolute",
        width: 100,
        height: 100,
        top: -200,
        left: -200,
      }}
    />
  );
}
