export type ShakeSensitivity = 'low' | 'medium' | 'high';

// Lazy getter so expo-sensors native modules are not initialised at import
// time. The iOS simulator has no Pedometer hardware — eager initialisation of
// the whole expo-sensors package throws 'ExponentPedometer not found' before
// the app can start, even though we only use Accelerometer.
function getAccelerometer() {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('expo-sensors').Accelerometer as typeof import('expo-sensors').Accelerometer;
}

// Shake detection runs its own continuous listener completely separate from
// the timed monitoring cycle. This is intentional: a violent impact demands
// an immediate response (sub-second), not a 20-30 second wait for the next
// cycle. The 5-second cooldown prevents a single fall or struggle from
// firing multiple alerts as the phone keeps bouncing after impact.

export function getShakeThreshold(sensitivity: ShakeSensitivity): number {
  const thresholds: Record<ShakeSensitivity, number> = {
    low: 4.0,    // only very violent impacts
    medium: 3.0, // default — falls, struggles
    high: 2.0,   // more sensitive — aggressive movement
  };
  return thresholds[sensitivity];
}

export function startShakeDetection(
  sensitivity: ShakeSensitivity,
  onShake: () => void
): () => void {
  try {
    const Accelerometer = getAccelerometer();
    const threshold = getShakeThreshold(sensitivity);
    let thresholdExceededAt: number | null = null;
    let lastShakeAt = 0;

    Accelerometer.setUpdateInterval(100);

    const subscription = Accelerometer.addListener(({ x, y, z }) => {
      const magnitude = Math.sqrt(x * x + y * y + z * z);

      if (magnitude > threshold) {
        if (thresholdExceededAt === null) {
          thresholdExceededAt = Date.now();
        }

        const sustainedFor = Date.now() - thresholdExceededAt;
        const cooldownPassed = Date.now() - lastShakeAt > 5000;

        if (sustainedFor >= 500 && cooldownPassed) {
          console.log('[sensors] shake detected');
          lastShakeAt = Date.now();
          thresholdExceededAt = null;
          onShake();
        }
      } else {
        // Reset the timer the moment magnitude drops below threshold.
        // The impact must be sustained for 500ms continuously, not cumulative.
        thresholdExceededAt = null;
      }
    });

    return () => subscription.remove();
  } catch (err) {
    console.error("[sensors] startShakeDetection failed:", err);
    return () => {};
  }
}

export function stopShakeDetection(cleanup: () => void): void {
  cleanup();
}
