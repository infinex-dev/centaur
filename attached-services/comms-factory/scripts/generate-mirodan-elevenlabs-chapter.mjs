#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";

const SOURCE =
  process.env.MIRODAN_TTS_SOURCE ||
  "/Users/opaque/Downloads/mirodan-tts/gold/chapter-01-basic-concepts.tts.txt";
const OUT_DIR =
  process.env.MIRODAN_TTS_OUT_DIR ||
  "/Users/opaque/Downloads/mirodan-tts/gold/audio/chapter-01-basic-concepts";
const SAMPLE_DIR =
  process.env.MIRODAN_TTS_REUSE_SAMPLE_DIR ||
  "/Users/opaque/Downloads/mirodan-tts/gold/audio-samples/chapter-01-first-5380-words";

const BASENAME = "mirodan-chapter-01-basic-concepts";
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB";
const MODEL_ID = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";
const MAX_CHARS_PER_CHUNK = Number(process.env.ELEVENLABS_CHUNK_CHARS || 4200);
const OUTPUT_FORMAT = process.env.ELEVENLABS_OUTPUT_FORMAT || "mp3_44100_128";
const FORCE = process.env.ELEVENLABS_FORCE === "1";

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

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function sha256(text) {
  return createHash("sha256").update(text).digest("hex");
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

function isUsableAudio(path) {
  if (!existsSync(path)) return false;
  const stat = statSync(path);
  if (stat.size < 1000) return false;
  const duration = ffprobeDuration(path);
  return duration !== null && duration > 0;
}

function partPaths(partsDir, index) {
  const stem = `part-${String(index).padStart(3, "0")}`;
  return {
    audio: join(partsDir, `${stem}.mp3`),
    text: join(partsDir, `${stem}.txt`),
    meta: join(partsDir, `${stem}.json`),
  };
}

function existingPartMatches(paths, text) {
  if (!isUsableAudio(paths.audio) || !existsSync(paths.meta)) return false;
  const meta = readJson(paths.meta);
  return (
    meta.text_sha256 === sha256(text) &&
    meta.voice_id === VOICE_ID &&
    meta.model_id === MODEL_ID &&
    meta.output_format === OUTPUT_FORMAT &&
    meta.audio_path === paths.audio
  );
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

function reusableSampleChunks(sourceText) {
  const sampleTextPath = join(
    SAMPLE_DIR,
    "mirodan-chapter-01-first-5380-words.tts.txt",
  );
  const sampleManifestPath = join(SAMPLE_DIR, "manifest.json");
  if (!existsSync(sampleTextPath) || !existsSync(sampleManifestPath)) return null;

  const sampleText = readFileSync(sampleTextPath, "utf8");
  if (!sourceText.startsWith(sampleText)) return null;

  const manifest = readJson(sampleManifestPath);
  if (
    manifest.voice_id !== VOICE_ID ||
    manifest.model_id !== MODEL_ID ||
    manifest.output_format !== OUTPUT_FORMAT ||
    manifest.max_chars_per_chunk !== MAX_CHARS_PER_CHUNK
  ) {
    return null;
  }

  const chunks = chunkText(sampleText, MAX_CHARS_PER_CHUNK);
  if (chunks.length !== manifest.parts.length) return null;

  for (let i = 0; i < chunks.length; i += 1) {
    const part = manifest.parts[i];
    if (
      part.chars !== chunks[i].length ||
      part.words !== wordCount(chunks[i]) ||
      !isUsableAudio(part.path)
    ) {
      return null;
    }
  }

  return {
    text: sampleText,
    chunks: chunks.map((text, i) => ({
      text,
      reused_from: manifest.parts[i].path,
    })),
  };
}

async function ensurePart({ apiKey, chunk, index, partsDir }) {
  const paths = partPaths(partsDir, index);
  const existing = existingPartMatches(paths, chunk.text);
  if (existing && !FORCE) {
    console.log(`Skipping part ${String(index).padStart(3, "0")} (already current)`);
  } else if (chunk.reused_from && isUsableAudio(chunk.reused_from) && !FORCE) {
    console.log(
      `Reusing part ${String(index).padStart(3, "0")} from sample (${chunk.text.length} chars)`,
    );
    copyFileSync(chunk.reused_from, paths.audio);
  } else {
    if (existsSync(paths.audio) && !FORCE) {
      throw new Error(
        `Refusing to overwrite existing non-matching audio part: ${paths.audio}. Set ELEVENLABS_FORCE=1 if you really want to regenerate it.`,
      );
    }
    console.log(
      `Synthesizing part ${String(index).padStart(3, "0")} (${chunk.text.length} chars, ${wordCount(chunk.text)} words)`,
    );
    await synthesizeChunk({ apiKey, text: chunk.text, outPath: paths.audio });
  }

  const record = {
    index,
    path: paths.audio,
    text_path: paths.text,
    chars: chunk.text.length,
    words: wordCount(chunk.text),
    text_sha256: sha256(chunk.text),
    voice_id: VOICE_ID,
    model_id: MODEL_ID,
    output_format: OUTPUT_FORMAT,
    reused_from: chunk.reused_from || null,
    duration_seconds: ffprobeDuration(paths.audio),
  };
  writeFileSync(paths.text, chunk.text + "\n");
  writeFileSync(paths.meta, JSON.stringify(record, null, 2));
  return record;
}

function concatAudio({ concatPath, audioPath, parts }) {
  const concatBody =
    parts
      .map((record) => `file '${record.path.replace(/'/g, "'\\''")}'`)
      .join("\n") + "\n";
  writeFileSync(concatPath, concatBody);

  const ffmpeg = spawnSync(
    "ffmpeg",
    ["-y", "-f", "concat", "-safe", "0", "-i", concatPath, "-c", "copy", audioPath],
    { encoding: "utf8" },
  );
  if (ffmpeg.status !== 0) {
    throw new Error(ffmpeg.stderr || "ffmpeg concat failed");
  }
}

async function main() {
  const sourceText = readFileSync(SOURCE, "utf8");
  const sourceHash = sha256(sourceText);
  const sample = reusableSampleChunks(sourceText);
  const chunks = [];

  if (sample) {
    chunks.push(...sample.chunks);
    const remainder = sourceText.slice(sample.text.length).replace(/^\n+/, "");
    chunks.push(
      ...chunkText(remainder, MAX_CHARS_PER_CHUNK).map((text) => ({ text })),
    );
  } else {
    chunks.push(...chunkText(sourceText, MAX_CHARS_PER_CHUNK).map((text) => ({ text })));
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const partsDir = join(OUT_DIR, "parts");
  mkdirSync(partsDir, { recursive: true });

  const audioPath = join(OUT_DIR, `${BASENAME}.mp3`);
  const textPath = join(OUT_DIR, `${BASENAME}.tts.txt`);
  const markdownPath = join(OUT_DIR, `${BASENAME}.tts.md`);
  const concatPath = join(OUT_DIR, "concat.txt");
  const manifestPath = join(OUT_DIR, "manifest.json");

  if (existsSync(manifestPath) && isUsableAudio(audioPath) && !FORCE) {
    const manifest = readJson(manifestPath);
    if (
      manifest.source_sha256 === sourceHash &&
      manifest.voice_id === VOICE_ID &&
      manifest.model_id === MODEL_ID &&
      manifest.output_format === OUTPUT_FORMAT &&
      manifest.parts?.length === chunks.length &&
      manifest.parts.every((part) => isUsableAudio(part.path))
    ) {
      console.log(`Skipping synthesis and concat; final audio is current: ${audioPath}`);
      console.log(JSON.stringify(manifest, null, 2));
      return;
    }
  }

  const needsApi = chunks.some((chunk, i) => {
    if (chunk.reused_from && !FORCE) return false;
    return !existingPartMatches(partPaths(partsDir, i + 1), chunk.text);
  });
  const apiKey = needsApi ? getApiKey() : "";
  if (needsApi && !apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY is not set and 1Password lookup did not return a key.",
    );
  }

  writeFileSync(textPath, sourceText);
  writeFileSync(markdownPath, sourceText);

  console.log(
    `Preparing ${chunks.length} parts; ${sample ? sample.chunks.length : 0} reusable sample parts.`,
  );

  const partRecords = [];
  for (let i = 0; i < chunks.length; i += 1) {
    partRecords.push(
      await ensurePart({
        apiKey,
        chunk: chunks[i],
        index: i + 1,
        partsDir,
      }),
    );
  }

  concatAudio({ concatPath, audioPath, parts: partRecords });

  const manifest = {
    source: SOURCE,
    source_sha256: sourceHash,
    text_path: textPath,
    markdown_path: markdownPath,
    audio_path: audioPath,
    voice_id: VOICE_ID,
    voice_name: VOICE_ID === "pNInz6obpgDQGcFmaJgB" ? "Adam" : null,
    model_id: MODEL_ID,
    output_format: OUTPUT_FORMAT,
    voice_settings: voiceSettings,
    max_chars_per_chunk: MAX_CHARS_PER_CHUNK,
    chars: sourceText.length,
    words: wordCount(sourceText),
    estimated_credits_at_1x: sourceText.length,
    estimated_credits_reused_from_sample: partRecords
      .filter((part) => part.reused_from)
      .reduce((sum, part) => sum + part.chars, 0),
    estimated_new_credits_this_run_at_1x: partRecords
      .filter((part) => !part.reused_from)
      .reduce((sum, part) => sum + part.chars, 0),
    parts: partRecords,
    duration_seconds: ffprobeDuration(audioPath),
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify(manifest, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
