// One monitoring cycle: capture snapshot + GPS, log the event immediately,
// then update it asynchronously as AI analysis and audio transcription return.
//
// The event appears in the log right after snapshot + GPS — no waiting for
// GPT-4o or Whisper. Both AI calls patch the existing event when they resolve.

import { useAlertStore } from "../store/useAlertStore";
import { useLiveShareStore } from "../store/useLiveShareStore";
import { useSessionStore } from "../store/useSessionStore";
import { useSettingsStore } from "../store/useSettingsStore";
import type { Contact, Event, RiskLevel } from "../types";
import { triggerAlert } from "./alerts";
import {
  analyseAudioTranscript,
  recordAudioClip,
  transcribeAudio,
} from "./audio";
import { photoToBase64, takeSnapshot } from "./camera";
import { generateUUID } from "./id";
import { getCurrentLocation, reverseGeocode } from "./location";
import { pushLiveLocationUpdate } from "./liveShare";
import { sendLocalNotification } from "./notifications";
import { analyseImage } from "./vision";

function combineRisks(a: RiskLevel, b: RiskLevel | null): RiskLevel {
  if (!b) return a;
  const order: Record<RiskLevel, number> = { low: 0, medium: 1, high: 2 };
  return order[a] >= order[b] ? a : b;
}

export async function runMonitoringCycle(): Promise<void> {
  try {
    const {
      isActive,
      sessionId,
      updateRiskLevel,
      updateLocation,
      incrementCycle,
    } = useSessionStore.getState();

    if (!isActive || !sessionId) return;

    const { plan } = useSettingsStore.getState();
    // const audioEnabled = plan === 'pro' || plan === 'guardian';
    const audioEnabled = true; // TEMP: audio enabled for all plans while testing
    console.log(
      `[monitoring] cycle start — plan: ${plan}, audioEnabled: ${audioEnabled}`,
    );

    // Start audio recording immediately — runs concurrently with everything else.
    // Free plan skips audio entirely; only camera + GPS run.
    const audioPromise = audioEnabled
      ? recordAudioClip(8000)
      : Promise.resolve(null);

    // Snapshot and GPS in parallel.
    const [photoUri, location] = await Promise.all([
      takeSnapshot(),
      getCurrentLocation(),
    ]);

    if (location) updateLocation(location);

    // Only pushed to Supabase while an active, matching share link exists —
    // most sessions never generate one, so this stays a no-op for them.
    const activeLink = useLiveShareStore.getState().activeLink;
    if (location && activeLink && activeLink.sessionId === sessionId) {
      pushLiveLocationUpdate(sessionId, location.lat, location.lng).catch(
        (err) =>
          console.error("[monitoring] pushLiveLocationUpdate failed:", err),
      );
    }

    // Log the event immediately so it appears in the log without delay.
    // aiSummary and audio fields are placeholders — patched below as AI returns.
    const event: Event = {
      id: generateUUID(),
      sessionId,
      timestamp: Date.now(),
      riskLevel: "low",
      aiSummary: "Analysing scene...",
      audioSummary: undefined,
      audioUri: undefined,
      photoUri: photoUri ?? null,
      transcript: undefined,
      location: location ?? null,
      source: "ai",
    };

    useAlertStore.getState().addEvent(event);
    incrementCycle();

    // Reverse geocode asynchronously — patches location.address when ready.
    if (location) {
      reverseGeocode(location.lat, location.lng)
        .then((address) => {
          if (address) {
            useAlertStore.getState().updateEvent(event.id, {
              location: { ...location, address },
            });
          }
        })
        .catch(console.error);
    }

    // Kick off image analysis without awaiting — event is already in the log.
    const base64 = photoUri ? await photoToBase64(photoUri) : null;
    const imagePromise = base64
      ? analyseImage(base64, location)
      : Promise.resolve(null);

    // Update the event and fire alerts once image analysis returns.
    imagePromise
      .then((result) => {
        // Sync the daily usage count returned by the Edge Function.
        if (result?.todayUsage !== undefined) {
          useSettingsStore.getState().setTodayUsage(result.todayUsage);
        }

        const riskLevel = result?.riskLevel ?? "low";
        const summary = result?.summary ?? "No visual analysis available.";

        useAlertStore.getState().updateEvent(event.id, {
          riskLevel,
          aiSummary: summary,
        });
        updateRiskLevel(riskLevel, summary);

        if (riskLevel === "medium") {
          sendLocalNotification(
            "Safety alert",
            `Potential concern detected: ${summary}`,
          ).catch((err) =>
            console.error("[monitoring] sendLocalNotification failed:", err),
          );
        }

        if (riskLevel === "high") {
          sendLocalNotification(
            "HIGH RISK DETECTED",
            `Immediate threat detected: ${summary}`,
          ).catch((err) =>
            console.error("[monitoring] sendLocalNotification failed:", err),
          );

          const { contactName, contactPhone, contactEmail } =
            useSettingsStore.getState();

          if (contactPhone && contactEmail) {
            const contact: Contact = {
              name: contactName || "Emergency Contact",
              phone: contactPhone,
              email: contactEmail,
            };
            triggerAlert(
              { ...event, riskLevel, aiSummary: summary },
              contact,
            ).catch((err) =>
              console.error("[monitoring] triggerAlert failed:", err),
            );
          } else {
            console.warn(
              "[monitoring] High risk detected but no contact configured.",
            );
          }
        }
      })
      .catch((err) => {
        console.error("[monitoring] analyseImage failed:", err);
        useAlertStore.getState().updateEvent(event.id, {
          aiSummary: "Visual analysis unavailable.",
        });
      });

    // Wait for the audio clip to finish recording, then transcribe and analyse.
    // Also await imagePromise here so combineRisks uses the real image score.
    const [audioUri, imageResult] = await Promise.all([
      audioPromise.catch((err) => {
        console.error("[monitoring] recordAudioClip failed:", err);
        return null;
      }),
      imagePromise.catch(() => null),
    ]);

    const imageRisk: RiskLevel = imageResult?.riskLevel ?? "low";

    if (!audioUri) {
      useAlertStore
        .getState()
        .updateEvent(event.id, { transcript: null, audioUri: null });
    } else {
      useAlertStore.getState().updateEvent(event.id, { audioUri });
      transcribeAudio(audioUri)
        .then(async (transcript) => {
          if (!transcript) {
            useAlertStore
              .getState()
              .updateEvent(event.id, { transcript: null });
            return;
          }
          useAlertStore.getState().updateEvent(event.id, { transcript });

          const { audioSummary, audioRisk } =
            await analyseAudioTranscript(transcript);
          if (audioSummary) {
            useAlertStore.getState().updateEvent(event.id, { audioSummary });
          }

          const consolidatedRisk = combineRisks(imageRisk, audioRisk);

          // Only escalate — never double-alert a level already fired above.
          if (consolidatedRisk === "medium" && imageRisk === "low") {
            sendLocalNotification(
              "Safety alert",
              `Audio concern detected: ${audioSummary ?? ""}`,
            ).catch((err) =>
              console.error("[monitoring] sendLocalNotification failed:", err),
            );
          }

          if (consolidatedRisk === "high" && imageRisk !== "high") {
            sendLocalNotification(
              "HIGH RISK DETECTED",
              `Audio threat detected: ${audioSummary ?? ""}`,
            ).catch((err) =>
              console.error("[monitoring] sendLocalNotification failed:", err),
            );

            const { contactName, contactPhone, contactEmail } =
              useSettingsStore.getState();

            if (contactPhone && contactEmail) {
              const contact: Contact = {
                name: contactName || "Emergency Contact",
                phone: contactPhone,
                email: contactEmail,
              };
              triggerAlert(
                { ...event, audioSummary, riskLevel: consolidatedRisk },
                contact,
              ).catch((err) =>
                console.error("[monitoring] triggerAlert (audio) failed:", err),
              );
            }
          }
        })
        .catch((err) =>
          console.error("[monitoring] transcription failed:", err),
        );
    }
  } catch (err) {
    console.error("[monitoring] runMonitoringCycle failed:", err);
  }
}
