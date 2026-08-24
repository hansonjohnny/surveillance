// Audio recording and transcription for the surveillance monitoring cycle.
//
// transcribeAudio() is intentionally NOT awaited in the monitoring cycle.
// Whisper transcription takes 2-5 seconds for a 10-second clip. Blocking
// the cycle on that wait would delay GPS capture, camera snapshot, and
// risk scoring for every single cycle. Instead, the caller fires
// transcribeAudio() and moves on — the transcript arrives and can be
// included in the NEXT cycle's consolidated AI risk score.

import {
  getRecordingPermissionsAsync,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  AudioModule,
  IOSOutputFormat,
  AudioQuality,
} from "expo-audio";
import type { AudioRecorder, RecordingOptions } from "expo-audio";
import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";
import type { RiskLevel } from "../types";
import { supabase } from "./supabase";

// Whisper-compatible recording options.
//
// iOS: LINEARPCM with .wav extension. AVAudioRecorder infers the container
// from the file URL extension — .wav produces a standard RIFF/WAV container
// that Whisper reliably accepts. MPEG4AAC was tried but expo-audio's internal
// temp path may use .caf or .aac, causing CAF or raw ADTS output (no container)
// which Whisper rejects. WAV is uncompressed and slightly larger (~320 KB for
// 10 s at 16 kHz) but is the only format that consistently works here.
//
// Android: MPEG-4 container with AAC encoder (.mp4). MediaRecorder writes a
// proper moov atom; the 400 ms wait after stop() ensures it is flushed before
// we read the file.
// The top-level extension is what AVAudioRecorder (iOS) uses to choose the
// container format — ios.extension is not used for the file path. Setting
// ".wav" here tells AVAudioRecorder to create a RIFF/WAV container, which
// is the only format that reliably round-trips through expo-audio + Whisper.
// Android ignores the top-level extension in favour of android.extension.
const WHISPER_RECORDING_OPTIONS: RecordingOptions = {
  extension: Platform.OS === "ios" ? ".wav" : ".mp4",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 128000,
  isMeteringEnabled: false,
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  android: {
    extension: ".mp4",
    outputFormat: "mpeg4",
    audioEncoder: "aac",
  },
  web: {
    mimeType: "audio/webm",
    bitsPerSecond: 64000,
  },
};

export async function requestMicrophonePermission(): Promise<boolean> {
  try {
    const { granted } = await requestRecordingPermissionsAsync();
    return granted;
  } catch (err) {
    console.error("[audio] requestMicrophonePermission failed:", err);
    return false;
  }
}

export async function recordAudioClip(
  durationMs: number = 10000,
): Promise<string | null> {
  let recorder: AudioRecorder | null = null;
  try {
    const { granted } = await getRecordingPermissionsAsync();
    if (!granted) {
      console.warn("[audio] microphone permission not granted");
      return null;
    }

    // allowsBackgroundRecording is what keeps the app process alive at all
    // while backgrounded/screen-locked (iOS suspends an app the moment it's
    // backgrounded unless it's actively doing something the OS recognises,
    // like recording audio) — this is the mechanism the whole background
    // monitoring loop depends on, not just this one clip.
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true, allowsBackgroundRecording: true });

    recorder = new AudioModule.AudioRecorder(WHISPER_RECORDING_OPTIONS);
    await recorder.prepareToRecordAsync();
    recorder.record();

    await new Promise<void>((resolve) => setTimeout(resolve, durationMs));

    await recorder.stop();

    // Android's MediaRecorder writes the MPEG-4 moov atom (metadata/index)
    // at the very end of the file. stop() can resolve before the OS has fully
    // flushed that atom to disk, producing a truncated/invalid container.
    // A short wait gives the encoder time to finish writing.
    if (Platform.OS === "android") {
      await new Promise<void>((resolve) => setTimeout(resolve, 400));
    }

    await setAudioModeAsync({ allowsRecording: false, allowsBackgroundRecording: false });

    const uri = recorder.uri;
    console.log("[audio] recorded uri:", uri);

    if (!uri) {
      console.error("[audio] recorder.uri is null after stop");
      return null;
    }

    // Verify the file actually exists and has content
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || (info as { size?: number }).size === 0) {
      console.error("[audio] recorded file missing or empty:", info);
      return null;
    }

    // Read first 12 bytes as base64 to detect actual container format.
    // expo-audio on iOS can produce a CAF file even when .m4a is requested
    // because AVAudioRecorder infers the container from its internal temp
    // file path, not from the RecordingOptions extension field.
    const headerB64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
      length: 16,
      position: 0,
    });
    const hdr = Uint8Array.from(atob(headerB64), (c) => c.charCodeAt(0));
    const isMpeg4 = hdr[4] === 0x66 && hdr[5] === 0x74 && hdr[6] === 0x79 && hdr[7] === 0x70;
    const isWav   = hdr[0] === 0x52 && hdr[1] === 0x49 && hdr[2] === 0x46 && hdr[3] === 0x46;
    const isCaf   = hdr[0] === 0x63 && hdr[1] === 0x61 && hdr[2] === 0x66 && hdr[3] === 0x66;
    const hexHeader = Array.from(hdr.slice(0, 8)).map((b) => b.toString(16).padStart(2, "0")).join(" ");
    console.log("[audio] file header bytes:", hexHeader, "| mpeg4:", isMpeg4, "wav:", isWav, "caf:", isCaf);

    if (isCaf) {
      console.error("[audio] recorder produced CAF format — Whisper does not support CAF. Check RecordingOptions.");
      return null;
    }

    // Copy to a persistent path. Derive extension from recorder.uri so the
    // file name matches the actual bytes on disk.
    const uriExt = uri.split(".").pop()?.toLowerCase() ?? (Platform.OS === "android" ? "mp4" : "wav");
    const destUri = `${FileSystem.documentDirectory}audio_clip_${Date.now()}.${uriExt}`;
    await FileSystem.copyAsync({ from: uri, to: destUri });

    console.log("[audio] clip ready, size:", (info as { size?: number }).size, "bytes, saved to:", destUri);
    return destUri;
  } catch (err) {
    console.error("[audio] recordAudioClip failed:", err);
    return null;
  } finally {
    recorder?.release();
  }
}

function mimeTypeFromUri(uri: string): string {
  if (uri.endsWith(".3gp")) return "audio/3gpp";
  if (uri.endsWith(".aac")) return "audio/aac";
  if (uri.endsWith(".wav")) return "audio/wav";
  if (uri.endsWith(".mp3")) return "audio/mpeg";
  if (uri.endsWith(".mp4")) return "audio/mp4";
  if (uri.endsWith(".m4a")) return "audio/m4a";
  return "audio/m4a";
}

export async function analyseAudioTranscript(
  transcript: string,
): Promise<{ audioSummary: string | null; audioRisk: RiskLevel | null }> {
  try {
    console.log("[audio] sending transcript to GPT-4o for analysis");
    const { data, error } = await supabase.functions.invoke("analyse-audio", {
      body: { transcript },
    });
    if (error) {
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx) {
        const body = await ctx.text().catch(() => "(unreadable)");
        console.error(`[audio] analyseAudioTranscript HTTP ${ctx.status}:`, body);
      } else {
        console.error("[audio] analyseAudioTranscript error:", error.message);
      }
      return { audioSummary: null, audioRisk: null };
    }
    const d = data as { summary: string | null; riskLevel?: string | null };
    console.log("[audio] AI result — risk:", d.riskLevel);
    const r = d.riskLevel;
    const audioRisk: RiskLevel | null =
      r === "low" || r === "medium" || r === "high" ? r : null;
    return { audioSummary: d.summary ?? null, audioRisk };
  } catch (err) {
    console.error("[audio] analyseAudioTranscript failed:", err);
    return { audioSummary: null, audioRisk: null };
  }
}

export async function transcribeAudio(
  audioUri: string,
): Promise<string | null> {
  try {
    const audioBase64 = await FileSystem.readAsStringAsync(audioUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const mimeType = mimeTypeFromUri(audioUri);
    console.log("[audio] sending to Whisper — mimeType:", mimeType, "base64 length:", audioBase64.length);

    const { data, error } = await supabase.functions.invoke("analyse-audio", {
      body: { audioBase64, mimeType },
    });

    if (error) {
      const ctx = (error as unknown as { context?: Response }).context;
      if (ctx) {
        const body = await ctx.text().catch(() => "(unreadable)");
        console.error(`[audio] transcribeAudio HTTP ${ctx.status}:`, body);
      } else {
        console.error("[audio] transcribeAudio error:", error.message);
      }
      return null;
    }

    const d = data as { transcript: string | null; whisperError?: string };
    if (d.whisperError) {
      console.error("[audio] Whisper API error:", d.whisperError);
    }
    const transcript = d.transcript ?? null;
    if (transcript === null) {
      console.warn("[audio] Whisper transcript: null (API error or silent audio)");
    } else if (transcript === "") {
      console.log("[audio] Whisper transcript: empty string (no speech detected)");
    } else {
      console.log(`[audio] Whisper transcript: ${transcript.length} chars`);
    }
    return transcript;
  } catch (err) {
    console.error("[audio] transcribeAudio failed:", err);
    return null;
  }
}
