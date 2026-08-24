// Supabase Edge Function -- analyse-audio
//
// Two modes depending on the request body:
//
//   audioBase64 provided -> transcribe via OpenAI Whisper
//                           returns { transcript: string | null }
//
//   transcript provided  -> analyse via Claude (claude-sonnet-4-20250514)
//                           returns { riskLevel, summary, concerns, confidence }
//
// Deploy:  supabase functions deploy analyse-audio
// Secrets: supabase secrets set OPENAI_API_KEY=sk-...

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// --- Whisper transcription ---

// Detect audio container format from the first 12 bytes of the file and
// normalise non-standard brands so Whisper accepts the file.
// Mutates `bytes` in place for brand patching — the caller uses the same
// Uint8Array when constructing the Blob sent to Whisper.
function detectAudioFormat(bytes: Uint8Array): { filename: string; mime: string } {
  if (bytes.length >= 12) {
    // MPEG-4 container: ftyp box signature at bytes 4-7.
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      const brand = String.fromCharCode(bytes[8], bytes[9], bytes[10], bytes[11]);
      console.log("[analyse-audio] ftyp major brand:", brand);
      // 3GPP brands (3gp4, 3gp5, 3gp6, 3g2a, 3g2b, …) are structurally
      // identical to MPEG-4 but Whisper rejects them. Patch the major brand
      // to "isom" (ISO Base Media Format) so Whisper treats the file as MP4.
      if (brand.startsWith("3gp") || brand.startsWith("3g2")) {
        bytes[8]  = 0x69; // i
        bytes[9]  = 0x73; // s
        bytes[10] = 0x6F; // o
        bytes[11] = 0x6D; // m
        console.log("[analyse-audio] patched 3GPP brand to isom");
      }
      return { filename: "audio.mp4", mime: "audio/mp4" };
    }
  }
  if (bytes.length >= 12) {
    // WAV: RIFF....WAVE
    if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
        bytes[8] === 0x57 && bytes[9] === 0x41 && bytes[10] === 0x56 && bytes[11] === 0x45) {
      return { filename: "audio.wav", mime: "audio/wav" };
    }
  }
  if (bytes.length >= 4) {
    // FLAC: fLaC
    if (bytes[0] === 0x66 && bytes[1] === 0x4C && bytes[2] === 0x61 && bytes[3] === 0x43) {
      return { filename: "audio.flac", mime: "audio/flac" };
    }
    // OGG: OggS
    if (bytes[0] === 0x4F && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) {
      return { filename: "audio.ogg", mime: "audio/ogg" };
    }
    // WebM: EBML header
    if (bytes[0] === 0x1A && bytes[1] === 0x45 && bytes[2] === 0xDF && bytes[3] === 0xA3) {
      return { filename: "audio.webm", mime: "audio/webm" };
    }
    // CAF: caff — not supported by Whisper
    if (bytes[0] === 0x63 && bytes[1] === 0x61 && bytes[2] === 0x66 && bytes[3] === 0x66) {
      throw new Error("CAF format is not supported by Whisper. The recorder produced a CoreAudio Format file. Check RecordingOptions.ios.outputFormat.");
    }
  }
  // MP3 ID3 tag
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
    return { filename: "audio.mp3", mime: "audio/mpeg" };
  }
  // MP3 sync frame vs ADTS AAC — both start 0xFF but differ in layer bits (bits 2-1 of byte 1).
  // Layer 01 = MPEG Layer 3 (MP3). Layer 00 = reserved in MPEG but used by ADTS AAC.
  // ADTS AAC is not in Whisper's supported format list — surface a clear error.
  if (bytes.length >= 2 && bytes[0] === 0xFF && (bytes[1] & 0xE0) === 0xE0) {
    if ((bytes[1] & 0x06) === 0x00) {
      throw new Error("ADTS AAC detected — iOS recorder produced a raw AAC stream without a container. Fix: set RecordingOptions.ios.outputFormat = IOSOutputFormat.LINEARPCM with extension '.wav'.");
    }
    return { filename: "audio.mp3", mime: "audio/mpeg" };
  }
  // Fall back to m4a and let Whisper reject it with a clear error if wrong
  const hexHeader = Array.from(bytes.slice(0, 8)).map((b) => b.toString(16).padStart(2, "0")).join(" ");
  console.warn("[analyse-audio] unknown audio format, header bytes:", hexHeader);
  return { filename: "audio.m4a", mime: "audio/mp4" };
}

async function transcribeAudio(
  audioBase64: string,
  _mimeType: string,
  apiKey: string,
): Promise<string | null> {
  const binaryString = atob(audioBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const { filename, mime } = detectAudioFormat(bytes);
  console.log("[analyse-audio] detected format:", filename, "size:", bytes.length, "bytes");

  const audioBlob = new Blob([bytes], { type: mime });

  const formData = new FormData();
  formData.append("file", audioBlob, filename);
  formData.append("model", "whisper-1");

  const response = await fetch(
    "https://api.openai.com/v1/audio/transcriptions",
    {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    },
  );

  if (!response.ok) {
    const errBody = await response.text();
    console.error("[analyse-audio] Whisper error:", response.status, errBody);
    throw new Error(`Whisper ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  return data.text ?? null;
}

// --- Claude threat analysis ---

function buildAudioPrompt(transcript: string): string {
  return `You are a personal safety AI monitoring ambient conversation.

Analyse this transcript for potential threats to the person carrying the recording device:
"${transcript}"

Look for: threats, aggressive language, sounds of distress, instructions to harm someone, or anything alarming.

If the transcript is very short, just noise, filler words, or otherwise does not contain any clear speech content, this is NOT evidence of danger by itself. Rate it low risk and say in the summary that nothing clear was heard. Never rate high risk based only on an unclear or fragmentary transcript -- only rate high when the words themselves clearly indicate a threat or distress.

Respond ONLY with JSON:
{
  "riskLevel": "low" | "medium" | "high",
  "summary": "One sentence about what was heard",
  "concerns": ["concern 1"],
  "confidence": 0.0 to 1.0
}

Do not use em-dashes. Be conservative.`;
}

type AnalysisResult = {
  riskLevel: "low" | "medium" | "high";
  summary: string;
  concerns: string[];
  confidence: number;
};

function safeParseResult(text: string): AnalysisResult {
  try {
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error("no JSON block found");
    const parsed = JSON.parse(match[0]);

    const riskLevel = ["low", "medium", "high"].includes(parsed.riskLevel)
      ? (parsed.riskLevel as "low" | "medium" | "high")
      : "low";

    return {
      riskLevel,
      summary:
        typeof parsed.summary === "string" ? parsed.summary : "Audio analysed.",
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns : [],
      confidence:
        typeof parsed.confidence === "number"
          ? Math.min(1, Math.max(0, parsed.confidence))
          : 0.5,
    };
  } catch {
    return {
      riskLevel: "low",
      summary: "Unable to analyse audio.",
      concerns: [],
      confidence: 0,
    };
  }
}

async function analyseTranscript(
  transcript: string,
  apiKey: string,
): Promise<AnalysisResult> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: buildAudioPrompt(transcript),
        },
      ],
    }),
  });

  if (!response.ok) {
    console.error("[analyse-audio] OpenAI error:", await response.text());
    return {
      riskLevel: "low",
      summary: "Analysis failed.",
      concerns: [],
      confidence: 0,
    };
  }

  const data = await response.json();
  const text: string = data.choices?.[0]?.message?.content ?? "";
  return safeParseResult(text);
}

// --- Handler ---

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS });
  }

  try {
    const body = await req.json();

    if (body.transcript) {
      const apiKey = Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) {
        return json({ error: "OPENAI_API_KEY not configured" }, 500);
      }
      const result = await analyseTranscript(body.transcript, apiKey);
      return json(result);
    }

    if (body.audioBase64) {
      const apiKey = Deno.env.get("OPENAI_API_KEY");
      if (!apiKey) {
        return json({ error: "OPENAI_API_KEY not configured" }, 500);
      }

      // Decode enough bytes to identify the format before transcribing.
      // Include the header hex in every error so it appears in Metro logs.
      const binary = atob(body.audioBase64);
      const headerBytes = new Uint8Array(Math.min(12, binary.length));
      for (let i = 0; i < headerBytes.length; i++) headerBytes[i] = binary.charCodeAt(i);
      const headerHex = Array.from(headerBytes).map((b) => b.toString(16).padStart(2, "0")).join(" ");
      console.log("[analyse-audio] audio received — size:", binary.length, "bytes | header:", headerHex);

      try {
        const transcript = await transcribeAudio(
          body.audioBase64,
          body.mimeType,
          apiKey,
        );
        return json({ transcript });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error("[analyse-audio] transcribeAudio threw:", msg);
        // Include header hex in whisperError so it surfaces in Metro logs.
        return json({ transcript: null, whisperError: `${msg} | header: ${headerHex}` });
      }
    }

    return json({ error: "transcript or audioBase64 is required" }, 400);
  } catch (err) {
    console.error("[analyse-audio] unexpected error:", err);
    return json({ transcript: null });
  }
});
