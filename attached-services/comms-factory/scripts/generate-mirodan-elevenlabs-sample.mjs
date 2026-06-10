#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

const SOURCE =
  "/Users/opaque/Downloads/mirodan-tts/gold/chapter-01-basic-concepts.tts.txt";
const OUT_DIR =
  "/Users/opaque/Downloads/mirodan-tts/gold/audio-samples/chapter-01-first-5380-words";
const END_HEADING = "\nSensing and Intending\n";
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB";
const MODEL_ID = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const MAX_CHARS_PER_CHUNK = Number(process.env.ELEVENLABS_CHUNK_CHARS || 4200);
const OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";

const voiceSettings = {
  stability: 0.55,
  similarity_boost: 0.8,
  style: 0.0,
  use_speaker_boost: true,
};

function getApiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  try {
    return execFileSync(
      "/opt/local/bin/op",
      ["read", "op://Openclaw/11Labs/credential"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] },
    ).trim();
  } catch {
    return "";
  }
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function splitLongParagraph(paragraph, maxChars) {
  const sentences = paragraph.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) || [
    paragraph,
  ];
  const chunks = [];
  let current = "";
  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (next.length > maxChars && current) {
      chunks.push(current);
      current = sentence.trim();
    } else {
      current = next;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function chunkText(text, maxChars) {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks = [];
  let current = "";

  for (const paragraph of paragraphs) {
    const pieces =
      paragraph.length > maxChars
        ? splitLongParagraph(paragraph, maxChars)
        : [paragraph];

    for (const piece of pieces) {
      const next = current ? `${current}\n\n${piece}` : piece;
      if (next.length > maxChars && current) {
        chunks.push(current);
        current = piece;
      } else {
        current = next;
      }
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function ffprobeDuration(path) {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "default=noprint_wrappers=1:nokey=1",
      path,
    ],
    { encoding: "utf8" },
  );
  if (result.status !== 0) return null;
  const seconds = Number(result.stdout.trim());
  return Number.isFinite(seconds) ? seconds : null;
}

async function synthesizeChunk({ apiKey, text, outPath }) {
  const url = new URL(
    `https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`,
  );
  url.searchParams.set("output_format", OUTPUT_FORMAT);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: MODEL_ID,
      voice_settings: voiceSettings,
    }),
  });

  const body = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || contentType.includes("application/json")) {
    throw new Error(
      `ElevenLabs returned ${response.status}: ${body.toString("utf8").slice(0, 800)}`,
    );
  }

  writeFileSync(outPath, body);
}

async function main() {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY is not set and 1Password lookup did not return a key.",
    );
  }

  const source = readFileSync(SOURCE, "utf8");
  const endIndex = source.indexOf(END_HEADING);
  if (endIndex < 0) {
    throw new Error(`Could not find logical endpoint heading: ${END_HEADING}`);
  }

  const sampleText = source.slice(0, endIndex).trim() + "\n";
  const chunks = chunkText(sampleText, MAX_CHARS_PER_CHUNK);

  mkdirSync(OUT_DIR, { recursive: true });
  const partsDir = join(OUT_DIR, "parts");
  mkdirSync(partsDir, { recursive: true });

  const textPath = join(OUT_DIR, "mirodan-chapter-01-first-5380-words.tts.txt");
  const markdownPath = join(OUT_DIR, "mirodan-chapter-01-first-5380-words.tts.md");
  writeFileSync(textPath, sampleText);
  writeFileSync(markdownPath, sampleText);

  const partRecords = [];
  for (let i = 0; i < chunks.length; i += 1) {
    const index = String(i + 1).padStart(3, "0");
    const outPath = join(partsDir, `part-${index}.mp3`);
    console.log(
      `Synthesizing part ${index}/${String(chunks.length).padStart(3, "0")} (${chunks[i].length} chars, ${wordCount(chunks[i])} words)`,
    );
    await synthesizeChunk({ apiKey, text: chunks[i], outPath });
    partRecords.push({
      index: i + 1,
      path: outPath,
      chars: chunks[i].length,
      words: wordCount(chunks[i]),
      duration_seconds: ffprobeDuration(outPath),
    });
  }

  const concatPath = join(OUT_DIR, "concat.txt");
  const concatBody =
    partRecords
      .map((record) => `file '${record.path.replace(/'/g, "'\\''")}'`)
      .join("\n") + "\n";
  writeFileSync(concatPath, concatBody);

  const audioPath = join(OUT_DIR, "mirodan-chapter-01-first-5380-words.mp3");
  const ffmpeg = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatPath,
      "-c:a",
      "libmp3lame",
      "-b:a",
      "128k",
      audioPath,
    ],
    { encoding: "utf8" },
  );
  if (ffmpeg.status !== 0) {
    throw new Error(ffmpeg.stderr || "ffmpeg concat failed");
  }

  const manifest = {
    source: SOURCE,
    text_path: textPath,
    markdown_path: markdownPath,
    audio_path: audioPath,
    logical_endpoint_before_heading: "Sensing and Intending",
    voice_id: VOICE_ID,
    voice_name: VOICE_ID === "pNInz6obpgDQGcFmaJgB" ? "Adam" : null,
    model_id: MODEL_ID,
    output_format: OUTPUT_FORMAT,
    voice_settings: voiceSettings,
    max_chars_per_chunk: MAX_CHARS_PER_CHUNK,
    chars: sampleText.length,
    words: wordCount(sampleText),
    estimated_credits_at_1x: sampleText.length,
    estimated_credits_at_half_char: Math.ceil(sampleText.length / 2),
    parts: partRecords,
    duration_seconds: ffprobeDuration(audioPath),
  };
  writeFileSync(join(OUT_DIR, "manifest.json"), JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
