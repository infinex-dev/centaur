#!/usr/bin/env node

import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_HTML =
  "/Users/opaque/Downloads/legacy-code-ebook/unpacked/mobi7/book.html";
const DEFAULT_TOC =
  "/Users/opaque/Downloads/legacy-code-ebook/unpacked/mobi7/toc.ncx";
const DEFAULT_SOURCE =
  "/Users/opaque/Downloads/Working_Effectively_with_Legacy_Working_Copy,.azw";
const DEFAULT_OUT = "/Users/opaque/Downloads/legacy-code-ebook/clean";
const DEFAULT_CHUNK_CHARS = 4200;

const args = parseArgs(process.argv.slice(2));
const htmlPath = args.html ?? DEFAULT_HTML;
const tocPath = args.toc ?? DEFAULT_TOC;
const sourcePath = args.source ?? DEFAULT_SOURCE;
const outDir = args.out ?? DEFAULT_OUT;
const chunkChars = Number(args.chunkChars ?? DEFAULT_CHUNK_CHARS);

if (!fs.existsSync(htmlPath)) throw new Error(`HTML not found: ${htmlPath}`);
if (!fs.existsSync(tocPath)) throw new Error(`TOC not found: ${tocPath}`);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const html = fs.readFileSync(htmlPath, "utf8");
const tocXml = fs.readFileSync(tocPath, "utf8");
const toc = parseToc(tocXml);
const sections = splitSections(html, toc).map((section) => ({
  ...section,
  blocks: extractBlocks(section.html),
}));

const cleanSections = sections.filter(includeInClean);
const ttsSections = sections.filter(includeInTts);

const cleanMd = buildCleanMarkdown(cleanSections);
const cleanTxt = markdownToText(cleanMd);
const ttsMd = buildTtsMarkdown(ttsSections);
const ttsTxt = markdownToText(ttsMd);

const files = {
  clean_md: path.join(outDir, "working-effectively-with-legacy-code.clean.md"),
  clean_txt: path.join(outDir, "working-effectively-with-legacy-code.clean.txt"),
  tts_md: path.join(outDir, "working-effectively-with-legacy-code.tts.md"),
  tts_txt: path.join(outDir, "working-effectively-with-legacy-code.tts.txt"),
  clean_sections: path.join(outDir, "sections-clean"),
  tts_sections: path.join(outDir, "sections-tts"),
  tts_chunks: path.join(outDir, `tts-chunks-${chunkChars}`),
  qa: path.join(outDir, "qa-suspect-lines.txt"),
  manifest: path.join(outDir, "manifest.json"),
};

fs.writeFileSync(files.clean_md, cleanMd);
fs.writeFileSync(files.clean_txt, cleanTxt);
fs.writeFileSync(files.tts_md, ttsMd);
fs.writeFileSync(files.tts_txt, ttsTxt);

fs.mkdirSync(files.clean_sections, { recursive: true });
fs.mkdirSync(files.tts_sections, { recursive: true });
const cleanSectionFiles = writeSectionFiles(cleanSections, files.clean_sections, {
  mode: "clean",
});
const ttsSectionFiles = writeSectionFiles(ttsSections, files.tts_sections, {
  mode: "tts",
});

fs.mkdirSync(files.tts_chunks, { recursive: true });
const chunkFiles = writeChunks(ttsTxt, files.tts_chunks, chunkChars);

const qa = buildQaReport({ cleanMd, ttsMd, cleanSections, ttsSections });
fs.writeFileSync(files.qa, qa);

const manifest = {
  source_azw: sourcePath,
  source_azw_sha256: fs.existsSync(sourcePath) ? sha256File(sourcePath) : null,
  html: htmlPath,
  toc: tocPath,
  output_dir: outDir,
  generated_at: new Date().toISOString(),
  policy: {
    clean_copy:
      "Skips title page, copyright page, contents, and index. Keeps foreword, preface, introduction, chapters, appendix, glossary, code blocks, and local image placeholders.",
    tts_copy:
      "Skips title page, copyright page, contents, glossary, and index. Keeps foreword, preface, introduction, parts, chapters, and appendix. Replaces code/image blocks with short narration placeholders.",
    copyright:
      "Local transform of a user-provided working copy. Do not paste or redistribute the generated text.",
  },
  counts: {
    toc_entries: toc.length,
    source_sections: sections.length,
    clean_sections: cleanSections.length,
    tts_sections: ttsSections.length,
    clean_stats: statsFor(cleanTxt),
    tts_stats: statsFor(ttsTxt),
    clean_code_blocks: countBlocks(cleanSections, "code"),
    tts_code_placeholders: countOccurrences(ttsTxt, "Code example omitted."),
    clean_image_markers: countOccurrences(cleanMd, "[Image:"),
    tts_image_placeholders: countOccurrences(ttsTxt, "Visual figure omitted."),
    chunks: chunkFiles.length,
    chunk_chars: chunkChars,
  },
  files: {
    ...files,
    clean_section_files: cleanSectionFiles,
    tts_section_files: ttsSectionFiles,
    chunk_files: chunkFiles,
  },
};

fs.writeFileSync(files.manifest, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Wrote ${files.clean_md}`);
console.log(`Wrote ${files.tts_md}`);
console.log(`Clean sections: ${cleanSectionFiles.length}`);
console.log(`TTS sections: ${ttsSectionFiles.length}`);
console.log(`TTS chunks: ${chunkFiles.length} at <= ${chunkChars} chars`);
console.log(`Manifest: ${files.manifest}`);

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const eq = arg.indexOf("=");
    if (eq !== -1) {
      parsed[arg.slice(2, eq)] = arg.slice(eq + 1);
      continue;
    }
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next && !next.startsWith("--")) {
      parsed[key] = next;
      i += 1;
    } else {
      parsed[key] = "1";
    }
  }
  return parsed;
}

function parseToc(xml) {
  const navPointRe =
    /<navPoint\b[\s\S]*?<text>([\s\S]*?)<\/text>[\s\S]*?<content\s+src="([^"]+)"/g;
  const entries = [];
  let match;
  while ((match = navPointRe.exec(xml))) {
    const label = cleanInlineText(match[1]);
    const src = decodeEntities(match[2]);
    const anchor = src.includes("#") ? src.split("#").at(-1) : "";
    if (!anchor || /^Working Effectively with Legacy Code$/i.test(label)) {
      continue;
    }
    entries.push({
      index: entries.length + 1,
      label,
      anchor,
      kind: classifyLabel(label),
    });
  }
  return entries;
}

function splitSections(sourceHtml, entries) {
  const withPositions = entries.map((entry) => {
    const anchorRe = new RegExp(
      `<a\\s+id=["']${escapeRegExp(entry.anchor)}["'][^>]*\\/?\\s*>`,
      "i",
    );
    const match = anchorRe.exec(sourceHtml);
    if (!match) throw new Error(`Anchor not found: ${entry.anchor}`);
    return { ...entry, position: match.index };
  });

  return withPositions.map((entry, i) => {
    const next = withPositions[i + 1];
    return {
      ...entry,
      html: sourceHtml.slice(entry.position, next ? next.position : sourceHtml.length),
    };
  });
}

function extractBlocks(sectionHtml) {
  const blocks = [];
  const normalized = sectionHtml
    .replace(/<mbp:pagebreak\s*\/?>/gi, "\n\n")
    .replace(/<a\s+id=["']filepos\d+["'][^>]*\/?\s*>/gi, "");
  const blockRe = /<(p|blockquote)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = blockRe.exec(normalized))) {
    const tag = match[1].toLowerCase();
    const raw = match[2];
    const imgCount = countRegex(raw, /<img\b/gi);
    const code = isCodeBlock(raw);
    const text = code
      ? cleanCodeText(raw)
      : cleanInlineText(raw, { imageMode: "marker" });

    if (!text && imgCount === 0) continue;

    blocks.push({
      tag,
      raw,
      type: code ? "code" : imgCount > 0 && !text ? "image" : "text",
      text,
      image_sources: imageSources(raw),
      is_heading: !code && isLikelyHeading(raw, text),
    });
  }
  return blocks;
}

function buildCleanMarkdown(sectionList) {
  const out = [
    "# Working Effectively with Legacy Code - Clean Local Transcript",
    "",
    "Generated from the local working copy. This file is for private local use.",
    "",
  ];

  for (const section of sectionList) {
    out.push(`${headingPrefix(section)} ${section.label}`, "");
    out.push(...renderSectionBlocks(section, { mode: "clean" }));
    out.push("");
  }

  return finalMarkdownCleanup(out.join("\n"));
}

function buildTtsMarkdown(sectionList) {
  const out = [
    "# Working Effectively with Legacy Code - TTS Narration Copy",
    "",
    "Generated from the local working copy. Code examples and visual figures are omitted for audio.",
    "",
  ];

  for (const section of sectionList) {
    out.push(`${headingPrefix(section)} ${spokenHeading(section.label)}`, "");
    out.push(...renderSectionBlocks(section, { mode: "tts" }));
    out.push("");
  }

  return finalMarkdownCleanup(out.join("\n"));
}

function renderSectionBlocks(section, { mode }) {
  const out = [];
  let skippedDuplicateHeading = false;
  let previousWasPlaceholder = false;

  for (const block of section.blocks) {
    const text = block.text.trim();
    if (!text && block.type !== "image") continue;

    if (!skippedDuplicateHeading && isDuplicateHeading(text, section.label)) {
      skippedDuplicateHeading = true;
      continue;
    }
    skippedDuplicateHeading = true;

    if (mode === "tts") {
      if (block.type === "code") {
        if (!previousWasPlaceholder) out.push("Code example omitted.", "");
        previousWasPlaceholder = true;
        continue;
      }
      if (block.type === "image" || block.image_sources.length > 0) {
        if (!previousWasPlaceholder) out.push("Visual figure omitted.", "");
        previousWasPlaceholder = true;
        continue;
      }
      const plain = normalizeProseForTts(text);
      if (plain) out.push(plain, "");
      previousWasPlaceholder = false;
      continue;
    }

    if (block.type === "code") {
      out.push("```", block.text, "```", "");
      previousWasPlaceholder = false;
      continue;
    }

    if (block.type === "image") {
      const marker = block.image_sources.length
        ? block.image_sources.map((src) => `[Image: ${src}]`).join("\n")
        : "[Image]";
      out.push(marker, "");
      previousWasPlaceholder = false;
      continue;
    }

    if (block.is_heading) {
      out.push(`### ${text}`, "");
    } else if (block.tag === "blockquote" && mode === "clean") {
      out.push(blockquote(text), "");
    } else {
      out.push(text, "");
    }
    previousWasPlaceholder = false;
  }

  return out;
}

function writeSectionFiles(sectionList, dir, { mode }) {
  const files = [];
  for (const section of sectionList) {
    const stem = `${String(section.index).padStart(2, "0")}-${slugify(section.label)}`;
    const mdPath = path.join(dir, `${stem}.${mode}.md`);
    const txtPath = path.join(dir, `${stem}.${mode}.txt`);
    const heading = mode === "tts" ? spokenHeading(section.label) : section.label;
    const md = finalMarkdownCleanup(
      [`# ${heading}`, "", ...renderSectionBlocks(section, { mode })].join("\n"),
    );
    const txt = markdownToText(md);
    fs.writeFileSync(mdPath, md);
    fs.writeFileSync(txtPath, txt);
    files.push({ label: section.label, md: mdPath, txt: txtPath, stats: statsFor(txt) });
  }
  return files;
}

function writeChunks(text, dir, maxChars) {
  const chunks = chunkText(text, maxChars);
  return chunks.map((chunk, index) => {
    const chunkPath = path.join(dir, `part-${String(index + 1).padStart(3, "0")}.txt`);
    fs.writeFileSync(chunkPath, `${chunk.trim()}\n`);
    return {
      path: chunkPath,
      chars: chunk.length,
      words: wordCount(chunk),
      sha256: sha256Text(chunk),
    };
  });
}

function includeInClean(section) {
  return !["title", "copyright", "contents", "index"].includes(section.kind);
}

function includeInTts(section) {
  return !["title", "copyright", "contents", "glossary", "index"].includes(
    section.kind,
  );
}

function classifyLabel(label) {
  if (/^Title Page$/i.test(label)) return "title";
  if (/^Copyright Page$/i.test(label)) return "copyright";
  if (/^Contents$/i.test(label)) return "contents";
  if (/^Foreword\b/i.test(label)) return "foreword";
  if (/^Preface$/i.test(label)) return "preface";
  if (/^Introduction$/i.test(label)) return "introduction";
  if (/^Part\b/i.test(label)) return "part";
  if (/^Chapter\b/i.test(label)) return "chapter";
  if (/^Appendix\b/i.test(label)) return "appendix";
  if (/^Glossary$/i.test(label)) return "glossary";
  if (/^Index$/i.test(label)) return "index";
  return "section";
}

function headingPrefix(section) {
  if (section.kind === "part") return "#";
  if (section.kind === "chapter" || section.kind === "appendix") return "##";
  return "##";
}

function spokenHeading(label) {
  return label.replace(/^Chapter\s+(\d+):\s*/i, "Chapter $1. ");
}

function isCodeBlock(raw) {
  const ttCount = countRegex(raw, /<tt\b/gi);
  const brCount = countRegex(raw, /<br\b/gi);
  if (ttCount >= 2) return true;
  if (ttCount >= 1 && brCount >= 1) return true;
  return looksLikeCodeText(cleanInlineText(raw, { imageMode: "omit" }), raw);
}

function looksLikeCodeText(text, raw) {
  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return false;

  const compact = lines.join(" ");
  const htmlLiteralCount = countRegex(compact, /<\/?[a-z][^>\s]*[^>]*>/gi);
  if (htmlLiteralCount >= 3 && compact.length < 300) return true;

  const signals = lines.filter((line) => {
    if (/^(#include|template\s*<|typedef\b|using\b|import\b)/.test(line)) return true;
    if (/^(public|private|protected)\b/.test(line)) return true;
    if (/^(class|struct|interface|void|int|double|float|bool|boolean|string|char)\b/.test(line)) {
      return /[({;}]|\bextends\b|\bimplements\b/.test(line);
    }
    if (/^(if|for|while|switch|return|assert|try|catch)\b/.test(line)) return true;
    if (/[{};]/.test(line) && /[A-Za-z_][A-Za-z0-9_]*\s*\(|=|->|::|\+\+|--/.test(line)) return true;
    if (/<\/?[a-z][^>\s]*[^>]*>/.test(line) && /["';]?$/.test(line)) return true;
    return false;
  }).length;

  if (lines.length === 1) {
    return signals === 1 && /[{};]|<\/?[a-z][^>]*>/.test(lines[0]);
  }

  if (signals / lines.length >= 0.45) return true;
  return /<font[^>]+size=["']?2/i.test(raw) && signals > 0;
}

function isLikelyHeading(raw, text) {
  if (!text || text.length > 95) return false;
  if (/[.!?]$/.test(text)) return false;
  if (/^\d+\./.test(text)) return false;
  if (/<b\b|<\/b>|<font[^>]+size=["']?[4567]/i.test(raw)) return true;
  return false;
}

function isDuplicateHeading(text, label) {
  if (!text) return false;
  return normalizeTitle(text) === normalizeTitle(label);
}

function cleanCodeText(raw) {
  return decodeEntities(
    raw
      .replace(/<br\s*\/?><\/br>/gi, "\n")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<img\b[\s\S]*?<\/img>/gi, "")
      .replace(/<img\b[^>]*\/?>/gi, "")
      .replace(/<[^>]+>/g, ""),
  )
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, ""))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function cleanInlineText(raw, options = {}) {
  const imageMode = options.imageMode ?? "omit";
  let s = raw
    .replace(/<br\s*\/?><\/br>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<a\b[^>]*>/gi, "")
    .replace(/<\/a>/gi, "");

  s = s.replace(/<img\b([^>]*)><\/img>/gi, (_, attrs) => {
    if (imageMode !== "marker") return "\n";
    const src = attrValue(attrs, "src");
    return src ? `\n[Image: ${src}]\n` : "\n[Image]\n";
  });
  s = s.replace(/<img\b([^>]*)\/?>/gi, (_, attrs) => {
    if (imageMode !== "marker") return "\n";
    const src = attrValue(attrs, "src");
    return src ? `\n[Image: ${src}]\n` : "\n[Image]\n";
  });

  return normalizeText(
    decodeEntities(s.replace(/<[^>]+>/g, " ")).replace(/\u00a0/g, " "),
  );
}

function normalizeText(text) {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => cleanPunctuationSpacing(line.replace(/[ \t]+/g, " ").trim()))
    .filter(Boolean)
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeProseForTts(text) {
  return cleanPunctuationSpacing(text)
    .replace(/\[Image:[^\]]+\]/g, "")
    .replace(/"[^"\n]*(?:<\w+[^>]*>[^"\n]*<\/\w+>)[^"\n]*"/g, "a markup string")
    .replace(/\n+/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function cleanPunctuationSpacing(text) {
  return text
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")");
}

function markdownToText(markdown) {
  return markdown
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/^```[\s\S]*?^```/gm, (block) =>
      block.replace(/^```.*$/gm, "").trim(),
    )
    .replace(/\[Image:([^\]]+)\]/g, "Image: $1")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .concat("\n");
}

function blockquote(text) {
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function finalMarkdownCleanup(text) {
  return text
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim()
    .concat("\n");
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

function splitLongParagraph(paragraph, maxChars) {
  const sentences = paragraph.match(/[^.!?]+[.!?]+["')\]]*|[^.!?]+$/g) ?? [
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

function buildQaReport({ cleanMd, ttsMd, cleanSections, ttsSections }) {
  const lines = [];
  const cleanProseOnly = stripCodeFences(cleanMd);
  lines.push("# QA suspect lines");
  lines.push("");
  lines.push(`Clean sections: ${cleanSections.length}`);
  lines.push(`TTS sections: ${ttsSections.length}`);
  lines.push("");
  lines.push("## Pattern counts");
  for (const [label, pattern, text] of [
    ["angle-bracket strings in clean prose", /<[^>]+>/g, cleanProseOnly],
    ["HTML tags in TTS", /<[^>]+>/g, ttsMd],
    ["filepos markers in clean", /filepos\d+/g, cleanMd],
    ["filepos markers in TTS", /filepos\d+/g, ttsMd],
    ["raw mbp tags in clean", /mbp:/g, cleanMd],
    ["raw mbp tags in TTS", /mbp:/g, ttsMd],
    ["code fences in clean", /^```/gm, cleanMd],
    ["code placeholders in TTS", /Code example omitted\./g, ttsMd],
    ["visual placeholders in TTS", /Visual figure omitted\./g, ttsMd],
  ]) {
    lines.push(`- ${label}: ${countRegex(text, pattern)}`);
  }

  lines.push("");
  lines.push("## Very short sections");
  const short = ttsSections
    .map((section) => ({
      label: section.label,
      kind: section.kind,
      words: wordCount(
        renderSectionBlocks(section, { mode: "tts" }).join("\n"),
      ),
    }))
    .filter((section) => section.kind !== "part" && section.words < 30);
  for (const section of short) {
    lines.push(`- ${section.label}: ${section.words} words`);
  }

  return `${lines.join("\n")}\n`;
}

function stripCodeFences(markdown) {
  return markdown.replace(/^```[\s\S]*?^```/gm, "");
}

function imageSources(raw) {
  const sources = [];
  const re = /<img\b([^>]*)\/?>/gi;
  let match;
  while ((match = re.exec(raw))) {
    const src = attrValue(match[1], "src");
    if (src) sources.push(src);
  }
  return sources;
}

function attrValue(attrs, name) {
  const re = new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, "i");
  return re.exec(attrs)?.[1] ?? "";
}

function normalizeTitle(text) {
  return text
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function decodeEntities(text) {
  const named = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
    rsquo: "'",
    lsquo: "'",
    rdquo: '"',
    ldquo: '"',
    ndash: "-",
    mdash: "-",
    hellip: "...",
  };
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec) =>
      String.fromCodePoint(Number.parseInt(dec, 10)),
    )
    .replace(/&([a-z]+);/gi, (entity, name) => named[name] ?? entity);
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90);
}

function sha256Text(text) {
  return createHash("sha256").update(text).digest("hex");
}

function sha256File(filePath) {
  return createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

function statsFor(text) {
  return {
    chars: text.length,
    words: wordCount(text),
    approx_minutes_at_150_wpm: round(wordCount(text) / 150, 1),
  };
}

function countBlocks(sectionList, type) {
  return sectionList.reduce(
    (sum, section) => sum + section.blocks.filter((block) => block.type === type).length,
    0,
  );
}

function countOccurrences(text, needle) {
  return text.split(needle).length - 1;
}

function countRegex(text, pattern) {
  return (text.match(pattern) ?? []).length;
}

function wordCount(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function round(value, decimals) {
  const mult = 10 ** decimals;
  return Math.round(value * mult) / mult;
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
