#!/usr/bin/env node
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, join } from "node:path";

const SOURCE_MANIFEST =
  process.env.LEGACY_CODE_TTS_MANIFEST ||
  "/Users/opaque/Downloads/legacy-code-ebook/clean/manifest.json";
const OUT_ROOT =
  process.env.LEGACY_CODE_TTS_AUDIO_OUT ||
  "/Users/opaque/Downloads/legacy-code-ebook/audio/orientation-ch6-ch16";

const DEFAULT_LABELS = [
  "Foreword",
  "Preface",
  "Introduction",
  "Part I: The Mechanics of Change",
  "Chapter 1: Changing Software",
  "Chapter 2: Working with Feedback",
  "Chapter 3: Sensing and Separation",
  "Chapter 4: The Seam Model",
  "Chapter 5: Tools",
  "Chapter 6: I Don’t Have Much Time and I Have to Change It",
  "Chapter 16: I Don’t Understand the Code Well Enough to Change It",
];

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
    const trimmed = sentence.trim();
    const next = current ? `${current} ${trimmed}` : trimmed;
    if (next.length > maxChars && current) {
      chunks.push(current);
      current = trimmed;
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

async function ensurePart({ apiKey, text, index, partsDir }) {
  const paths = partPaths(partsDir, index);
  const existing = existingPartMatches(paths, text);
  if (existing && !FORCE) {
    console.log(`  skip part ${String(index).padStart(3, "0")} (current)`);
  } else {
    if (existsSync(paths.audio) && !FORCE) {
      throw new Error(
        `Refusing to overwrite existing non-matching audio part: ${paths.audio}. Set ELEVENLABS_FORCE=1 to regenerate it.`,
      );
    }
    console.log(
      `  synth part ${String(index).padStart(3, "0")} (${text.length} chars, ${wordCount(text)} words)`,
    );
    await synthesizeChunk({ apiKey, text, outPath: paths.audio });
  }

  const record = {
    index,
    path: paths.audio,
    text_path: paths.text,
    chars: text.length,
    words: wordCount(text),
    text_sha256: sha256(text),
    voice_id: VOICE_ID,
    model_id: MODEL_ID,
    output_format: OUTPUT_FORMAT,
    duration_seconds: ffprobeDuration(paths.audio),
  };
  writeFileSync(paths.text, `${text}\n`);
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

function requestedLabels() {
  const env = process.env.LEGACY_CODE_TTS_LABELS;
  if (!env) return DEFAULT_LABELS;
  return env
    .split(/\n|\|/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function resolveSections(allSections, labels) {
  const resolved = [];
  for (const label of labels) {
    const exact = allSections.find((section) => section.label === label);
    if (exact) {
      resolved.push(exact);
      continue;
    }
    const chapterNumber = /^chapter\s*(\d+)$/i.exec(label)?.[1] ?? /^(\d+)$/.exec(label)?.[1];
    if (chapterNumber) {
      const match = allSections.find((section) =>
        section.label.startsWith(`Chapter ${chapterNumber}:`),
      );
      if (match) {
        resolved.push(match);
        continue;
      }
    }
    const contains = allSections.filter((section) =>
      section.label.toLowerCase().includes(label.toLowerCase()),
    );
    if (contains.length === 1) {
      resolved.push(contains[0]);
      continue;
    }
    throw new Error(`Could not resolve section label: ${label}`);
  }

  const deduped = [];
  const seen = new Set();
  for (const section of resolved) {
    if (seen.has(section.label)) continue;
    deduped.push(section);
    seen.add(section.label);
  }
  return deduped;
}

function sectionStem(section) {
  return basename(section.txt, ".tts.txt");
}

async function generateSection({ apiKey, section }) {
  const sourceText = readFileSync(section.txt, "utf8").trim() + "\n";
  const sourceHash = sha256(sourceText);
  const chunks = chunkText(sourceText, MAX_CHARS_PER_CHUNK);
  const stem = sectionStem(section);
  const outDir = join(OUT_ROOT, stem);
  const partsDir = join(outDir, "parts");
  mkdirSync(partsDir, { recursive: true });

  const audioPath = join(outDir, `${stem}.mp3`);
  const textPath = join(outDir, `${stem}.tts.txt`);
  const concatPath = join(outDir, "concat.txt");
  const manifestPath = join(outDir, "manifest.json");

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
      console.log(`current ${stem}: ${audioPath}`);
      return manifest;
    }
  }

  writeFileSync(textPath, sourceText);
  console.log(`${stem}: ${chunks.length} parts`);
  const parts = [];
  for (let i = 0; i < chunks.length; i += 1) {
    parts.push(
      await ensurePart({
        apiKey,
        text: chunks[i],
        index: i + 1,
        partsDir,
      }),
    );
  }

  concatAudio({ concatPath, audioPath, parts });
  const manifest = {
    label: section.label,
    source: section.txt,
    source_sha256: sourceHash,
    text_path: textPath,
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
    parts,
    duration_seconds: ffprobeDuration(audioPath),
  };
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`done ${stem}: ${formatDuration(manifest.duration_seconds)}`);
  return manifest;
}

function formatDuration(seconds) {
  if (!Number.isFinite(seconds)) return "unknown duration";
  const rounded = Math.round(seconds);
  const minutes = Math.floor(rounded / 60);
  const remaining = rounded % 60;
  return `${minutes}:${String(remaining).padStart(2, "0")}`;
}

async function main() {
  const sourceManifest = readJson(SOURCE_MANIFEST);
  const allSections = sourceManifest.files.tts_section_files;
  const sections = resolveSections(allSections, requestedLabels());
  mkdirSync(OUT_ROOT, { recursive: true });

  const totalChars = sections.reduce((sum, section) => sum + section.stats.chars, 0);
  const totalWords = sections.reduce((sum, section) => sum + section.stats.words, 0);
  console.log(
    `Selected ${sections.length} sections: ${totalChars} chars, ${totalWords} words.`,
  );

  const needsApi = sections.some((section) => {
    const stem = sectionStem(section);
    const sourceText = readFileSync(section.txt, "utf8").trim() + "\n";
    const manifestPath = join(OUT_ROOT, stem, "manifest.json");
    const audioPath = join(OUT_ROOT, stem, `${stem}.mp3`);
    if (!existsSync(manifestPath) || !isUsableAudio(audioPath) || FORCE) return true;
    const manifest = readJson(manifestPath);
    return !(
      manifest.source_sha256 === sha256(sourceText) &&
      manifest.voice_id === VOICE_ID &&
      manifest.model_id === MODEL_ID &&
      manifest.output_format === OUTPUT_FORMAT
    );
  });

  const apiKey = needsApi ? getApiKey() : "";
  if (needsApi && !apiKey) {
    throw new Error(
      "ELEVENLABS_API_KEY is not set and 1Password lookup did not return a key.",
    );
  }

  const manifests = [];
  for (const section of sections) {
    manifests.push(await generateSection({ apiKey, section }));
  }

  const summary = {
    generated_at: new Date().toISOString(),
    source_manifest: SOURCE_MANIFEST,
    output_root: OUT_ROOT,
    playlist_path: join(OUT_ROOT, "playlist.m3u"),
    voice_id: VOICE_ID,
    voice_name: VOICE_ID === "pNInz6obpgDQGcFmaJgB" ? "Adam" : null,
    model_id: MODEL_ID,
    output_format: OUTPUT_FORMAT,
    max_chars_per_chunk: MAX_CHARS_PER_CHUNK,
    selected_labels: sections.map((section) => section.label),
    totals: {
      chars: manifests.reduce((sum, manifest) => sum + manifest.chars, 0),
      words: manifests.reduce((sum, manifest) => sum + manifest.words, 0),
      duration_seconds: manifests.reduce(
        (sum, manifest) => sum + (manifest.duration_seconds || 0),
        0,
      ),
      estimated_credits_at_1x: manifests.reduce(
        (sum, manifest) => sum + manifest.estimated_credits_at_1x,
        0,
      ),
    },
    sections: manifests.map((manifest) => ({
      label: manifest.label,
      audio_path: manifest.audio_path,
      text_path: manifest.text_path,
      chars: manifest.chars,
      words: manifest.words,
      duration_seconds: manifest.duration_seconds,
      parts: manifest.parts.length,
    })),
  };
  writeFileSync(
    summary.playlist_path,
    [
      "#EXTM3U",
      ...manifests.flatMap((manifest) => [
        `#EXTINF:${Math.round(manifest.duration_seconds || -1)},${manifest.label}`,
        manifest.audio_path,
      ]),
      "",
    ].join("\n"),
  );
  writeFileSync(join(OUT_ROOT, "manifest.json"), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
