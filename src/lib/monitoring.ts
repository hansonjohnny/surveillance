// One monitoring cycle: capture snapshot + GPS, log the event immediately,
// then update it asynchronously as AI analysis and audio transcription return.
//
// The event appears in the log right after snapshot + GPS — no waiting for
// GPT-4o or Whisper. Both AI calls patch the existing event when they resolve.

import { AppState } from "react-native";
import { useAlertStore } from "../store/useAlertStore";
import { useSessionStore } from "../store/useSessionStore";
import { useSettingsStore } from "../store/useSettingsStore";
import type { Contact, Event, RiskLevel } from "../types";
import { triggerAlert } from "./alerts";
import {
  analyseAudioTranscript,
  recordAudioClip,
  transcribeAudio,
} from "./audio";
import { isFrameLikelyCovered, photoToBase64, takeSnapshot } from "./camera";
import { NO_ANALYSIS_SUMMARY } from "./eventContent";
import { detectAlarmKeyword } from "./keywordDetection";
import { generateUUID } from "./id";
import { getCurrentLocation, reverseGeocode } from "./location";
import { sendLocalNotification } from "./notifications";
import { schedulePendingAlert } from "./pendingAlert";
import { uploadEventMedia } from "./storage";
import { analyseImage } from "./vision";

// Fired by the accelerometer listener (lib/sensors.ts — a g-force spike
// held for 500ms, with a 5s cooldown so one fall doesn't fire
// repeatedly), started/stopped by useSessionStore alongside the
// monitoring cycle itself. No AI call, no cancel window — a physical
// impact is high-confidence on its own, same as Manual SOS.
export async function handleShakeDetected(): Promise<void> {
  const { contactName, contactPhone, contactEmail } = useSettingsStore.getState();
  if (!contactPhone || !contactEmail) {
    console.warn("[monitoring] Shake detected but no contact configured.");
    return;
  }

  const location = await getCurrentLocation();
  const event: Event = {
    id: generateUUID(),
    sessionId: useSessionStore.getState().sessionId ?? generateUUID(),
    timestamp: Date.now(),
    riskLevel: "high",
    aiSummary: "Sudden impact detected.",
    audioSummary: undefined,
    audioUri: undefined,
    photoUri: null,
    transcript: undefined,
    location,
    source: "shake",
  };
  useAlertStore.getState().addEvent(event);

  sendLocalNotification(
    "HIGH RISK DETECTED",
    "Impact detected — alerting your emergency contact.",
  ).catch((err) =>
    console.error("[monitoring] sendLocalNotification (shake) failed:", err),
  );

  const contact: Contact = {
    name: contactName || "Emergency Contact",
    phone: contactPhone,
    email: contactEmail,
  };
  triggerAlert(event, contact).catch((err) =>
    console.error("[monitoring] Shake triggerAlert failed:", err),
  );
}

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
      userId,
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

    // Camera access is impossible while backgrounded — an OS-level privacy
    // restriction on both iOS and Android, not something any code change
    // works around. Skip the attempt entirely rather than let it fail;
    // audio + GPS keep running as normal (see lib/audio.ts's
    // allowsBackgroundRecording and lib/location.ts's background tracking).
    const isForeground = AppState.currentState === "active";

    // Snapshot and GPS in parallel.
    const [photoUri, location] = await Promise.all([
      isForeground ? takeSnapshot() : Promise.resolve(null),
      getCurrentLocation(),
    ]);

    if (location) updateLocation(location);

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

    // Pushes the event's current local state to Supabase — called at each
    // point below where a meaningful field settles, not just when an alert
    // fires. A linked guardian's dashboard (see lib/guardian.ts) reads
    // straight from Supabase, so without this every Low/Medium event would
    // be invisible to them; only High-risk alert-triggering events synced
    // before. Idempotent (upsert), so a few extra calls per cycle as
    // different fields resolve is harmless.
    function syncEvent() {
      useAlertStore
        .getState()
        .syncEventToSupabase(event.id)
        .catch((err) =>
          console.error("[monitoring] syncEventToSupabase failed:", err),
        );
    }

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

    // A covered lens (pocket, hand over camera) wastes a GPT-4o call on a
    // frame with nothing to see — check for that cheaply before paying for
    // the real vision call. See lib/camera.ts's isFrameLikelyCovered.
    const covered = photoUri ? await isFrameLikelyCovered(photoUri) : false;

    // Upload every real (non-covered) captured frame, independent of risk
    // level — GPT-4o vision already runs on every one of these regardless
    // of risk (that cost is already being paid), so the extra cost of also
    // storing the same photo is comparatively small, and a guardian
    // monitoring a ward benefits from the full visual record, not just
    // flagged incidents. Old media is swept by the retention job in
    // supabase/functions/cleanup-old-media rather than kept forever. Fire-
    // and-forget — never hold up the cycle or an alert on this.
    if (photoUri && !covered && userId) {
      uploadEventMedia(userId, event.id, photoUri, "photo").then((path) => {
        if (path) {
          useAlertStore.getState().updateEvent(event.id, { photoStoragePath: path });
          syncEvent();
        }
      });
    }

    // Kick off image analysis without awaiting — event is already in the log.
    const base64 = photoUri && !covered ? await photoToBase64(photoUri) : null;
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
        const summary =
          result?.summary ??
          (covered
            ? "Camera appears covered — skipped visual analysis this cycle."
            : isForeground
              ? NO_ANALYSIS_SUMMARY
              : "Camera unavailable while backgrounded.");

        useAlertStore.getState().updateEvent(event.id, {
          riskLevel,
          aiSummary: summary,
          concerns: result?.concerns?.length ? result.concerns : null,
          confidence: typeof result?.confidence === "number" ? result.confidence : null,
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
            schedulePendingAlert(
              { ...event, riskLevel, aiSummary: summary },
              contact,
            );
          } else {
            console.warn(
              "[monitoring] High risk detected but no contact configured.",
            );
          }
        }

        syncEvent();
      })
      .catch((err) => {
        console.error("[monitoring] analyseImage failed:", err);
        useAlertStore.getState().updateEvent(event.id, {
          aiSummary: NO_ANALYSIS_SUMMARY,
        });
        syncEvent();
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
      syncEvent();
    } else {
      useAlertStore.getState().updateEvent(event.id, { audioUri });

      // Same reasoning as the photo upload above — Whisper transcription
      // already runs on every recorded clip regardless of risk, so upload
      // unconditionally rather than waiting on a risk level that hasn't
      // even been determined yet. Fire-and-forget.
      if (userId) {
        uploadEventMedia(userId, event.id, audioUri, "audio").then((path) => {
          if (path) {
            useAlertStore.getState().updateEvent(event.id, { audioStoragePath: path });
            syncEvent();
          }
        });
      }

      transcribeAudio(audioUri)
        .then(async (transcript) => {
          if (!transcript) {
            useAlertStore
              .getState()
              .updateEvent(event.id, { transcript: null });
            syncEvent();
            return;
          }
          useAlertStore.getState().updateEvent(event.id, { transcript });

          // Instant, non-AI check — see lib/keywordDetection.ts for why
          // this doesn't bypass the AI cycle the way shake does.
          const keywordMatch = detectAlarmKeyword(transcript);

          const { audioSummary, audioRisk, audioConcerns, audioConfidence } =
            await analyseAudioTranscript(transcript);

          // Merge the keyword flag into the AI's own findings so the
          // guardian sees *why* this escalated even if GPT-4o's own read
          // of the transcript was more measured.
          const mergedAudioSummary = keywordMatch
            ? `Trigger phrase detected: "${keywordMatch}". ${audioSummary ?? ""}`.trim()
            : audioSummary;
          const mergedAudioConcerns = keywordMatch
            ? [`Trigger phrase: "${keywordMatch}"`, ...(audioConcerns ?? [])]
            : audioConcerns;

          if (mergedAudioSummary) {
            useAlertStore.getState().updateEvent(event.id, {
              audioSummary: mergedAudioSummary,
              audioConcerns: mergedAudioConcerns?.length ? mergedAudioConcerns : null,
              audioConfidence,
            });
          }

          const consolidatedRisk = combineRisks(
            combineRisks(imageRisk, audioRisk),
            keywordMatch ? "high" : null,
          );

          // combineRisks only ever returns the higher of the two — audio
          // can escalate risk beyond what image analysis alone found. Keep
          // the event's stored/synced riskLevel (what EventCard's badge and
          // a linked guardian's dashboard both read) and the session's
          // last-risk badge in sync with that same consolidated score,
          // not just whatever the image-only analysis set earlier in this
          // cycle — otherwise a High audio-only threat can display as Low.
          if (consolidatedRisk !== imageRisk) {
            useAlertStore
              .getState()
              .updateEvent(event.id, { riskLevel: consolidatedRisk });
            updateRiskLevel(consolidatedRisk, mergedAudioSummary ?? undefined);
          }

          // Only escalate — never double-alert a level already fired above.
          if (consolidatedRisk === "medium" && imageRisk === "low") {
            sendLocalNotification(
              "Safety alert",
              `Audio concern detected: ${mergedAudioSummary ?? ""}`,
            ).catch((err) =>
              console.error("[monitoring] sendLocalNotification failed:", err),
            );
          }

          if (consolidatedRisk === "high" && imageRisk !== "high") {
            sendLocalNotification(
              "HIGH RISK DETECTED",
              `Audio threat detected: ${mergedAudioSummary ?? ""}`,
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
              // `event` is a stale closure from the top of this cycle —
              // its aiSummary is still the "Analysing scene..." placeholder
              // (or whatever image analysis found) at this point, not this
              // audio-driven escalation's reason. Read the current event
              // back from the store (already patched with the real image
              // aiSummary/concerns/confidence by the imagePromise handler
              // above) so the actual SMS/email/call text reflects what was
              // really detected, not a placeholder.
              const currentEvent =
                useAlertStore.getState().events.find((e) => e.id === event.id) ??
                event;
              schedulePendingAlert(
                {
                  ...currentEvent,
                  audioSummary: mergedAudioSummary,
                  riskLevel: consolidatedRisk,
                },
                contact,
              );
            }
          }

          syncEvent();
        })
        .catch((err) => {
          console.error("[monitoring] transcription failed:", err);
          syncEvent();
        });
    }
  } catch (err) {
    console.error("[monitoring] runMonitoringCycle failed:", err);
  }
}
