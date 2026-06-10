#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DEFAULT_INPUT = "/Users/opaque/Downloads/mirodan-tts/mirodan-vol2.raw.txt";
const DEFAULT_OUT = "/Users/opaque/Downloads/mirodan-tts/clean";
const DEFAULT_CHUNK_CHARS = 9000;

const args = parseArgs(process.argv.slice(2));
const inputPath = args.input ?? DEFAULT_INPUT;
const outDir = args.out ?? DEFAULT_OUT;
const chunkChars = Number(args.chunkChars ?? DEFAULT_CHUNK_CHARS);

if (!fs.existsSync(inputPath)) {
  throw new Error(`Input not found: ${inputPath}`);
}

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(outDir, { recursive: true });

const raw = fs.readFileSync(inputPath, "utf8");
const pages = raw.replace(/\r/g, "").split("\f");

const full = buildTranscript({ pages, removeFootnotes: false });
const narrationBuild = buildTranscript({ pages, removeFootnotes: true });
const narration = {
  ...narrationBuild,
  text: finalNarrationCleanup(cutBeforeChapterV(narrationBuild.text)),
};

const fullPath = path.join(outDir, "mirodan-vol2-clean-transcript.md");
const narrationPath = path.join(outDir, "mirodan-vol2-tts-narration.md");
fs.writeFileSync(fullPath, full.text);
fs.writeFileSync(narrationPath, narration.text);

const chapterDir = path.join(outDir, "chapters");
fs.mkdirSync(chapterDir, { recursive: true });
const chapterFiles = writeChapters(narration.text, chapterDir);
const goldChapters = writeGoldChapters(chapterFiles, path.join(path.dirname(outDir), "gold"));
const goldChapterOne = goldChapters[0] ?? null;

const chunkDir = path.join(outDir, "chunks-9000");
fs.mkdirSync(chunkDir, { recursive: true });
const chunkFiles = writeChunks(narration.text, chunkDir, chunkChars);

const suspectPath = path.join(outDir, "qa-suspect-lines.txt");
fs.writeFileSync(suspectPath, buildSuspectLineReport(narration.text));

const manifest = {
  source_pdf: "/Users/opaque/Downloads/Mirodan-PhD-1997-Vol2.pdf",
  raw_text: inputPath,
  output_dir: outDir,
  generated_at: new Date().toISOString(),
  transcript_policy: {
    clean_transcript: "Keeps scholarly notes where OCR made them visible; removes page headers, page numbers, image-only pages, and appendices.",
    tts_narration: "Main text only: Chapters I-IV, with likely footnote/citation blocks, image callouts, Chapter V bibliography, and appendices removed for smoother narration.",
    appendices: "Stopped at the APPENDICES marker on printed page 581. Chapter V bibliography is retained only in the clean transcript.",
    visual_pages: "Skipped pages classified as diagrams, cubes, collages, image captions, or unreadable low-prose OCR.",
  },
  input_pages: pages.length,
  clean_transcript: statsFor(full.text),
  tts_narration: statsFor(narration.text),
  estimated_elevenlabs_credits: {
    tts_narration_flash_or_turbo_0_5_credit_per_char: Math.ceil(narration.text.length * 0.5),
    tts_narration_multilingual_or_v3_1_credit_per_char: narration.text.length,
    clean_transcript_flash_or_turbo_0_5_credit_per_char: Math.ceil(full.text.length * 0.5),
    clean_transcript_multilingual_or_v3_1_credit_per_char: full.text.length,
  },
  approx_listening_duration: {
    tts_narration_at_150_wpm_hours: round(statsFor(narration.text).words / 150 / 60, 2),
    clean_transcript_at_150_wpm_hours: round(statsFor(full.text).words / 150 / 60, 2),
  },
  page_handling: {
    kept_pages: narration.keptPages.length,
    skipped_pages: narration.skippedPages.length,
    first_kept_pdf_page: narration.keptPages[0]?.pdfPage ?? null,
    last_kept_pdf_page: narration.keptPages.at(-1)?.pdfPage ?? null,
    first_printed_page: firstDefined(narration.keptPages.map((p) => p.printedPage)),
    last_printed_page: lastDefined(narration.keptPages.map((p) => p.printedPage)),
    skipped_pages_sample: narration.skippedPages.slice(0, 30),
  },
  files: {
    clean_transcript: fullPath,
    tts_narration: narrationPath,
    chapters: chapterFiles,
    gold_chapter_one: goldChapterOne,
    gold_chapters: goldChapters,
    chunks: chunkFiles,
    qa_suspect_lines: suspectPath,
  },
};

const manifestPath = path.join(outDir, "manifest.json");
fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

console.log(`Wrote ${narrationPath}`);
console.log(`Wrote ${fullPath}`);
console.log(`Chapters: ${chapterFiles.length}`);
if (goldChapterOne) console.log(`Gold Chapter I: ${goldChapterOne.tts_md}`);
console.log(`Chunks: ${chunkFiles.length} at <= ${chunkChars} chars`);
console.log(`Manifest: ${manifestPath}`);

function buildTranscript({ pages, removeFootnotes }) {
  const keptPages = [];
  const skippedPages = [];
  const out = [
    "# Mirodan PhD Vol 2 - TTS Transcript",
    "",
    "Source: Veronica Mirodan, Yat Malmgren's Movement Psychology - A Handbook of the System, PhD Vol 2, 1997.",
    "",
  ];

  let stoppedAtAppendix = false;

  pages.forEach((page, idx) => {
    if (stoppedAtAppendix) return;

    const pdfPage = idx + 1;
    const printedPage = extractPrintedPage(page);
    const normalizedPage = fixCommonOcr(page);

    if (/^\s*APPENDICES\s*$/im.test(normalizedPage) || (printedPage && printedPage >= 581)) {
      stoppedAtAppendix = true;
      skippedPages.push({ pdfPage, printedPage, reason: "appendices" });
      return;
    }

    let lines = normalizedPage.split("\n").map((line) => line.replace(/\s+$/g, ""));
    lines = stripRunningMatter(lines);
    if (removeFootnotes) lines = stripLikelyFootnotes(lines);
    lines = trimBlankEdges(lines);

    const reason = skipReason(lines, { printedPage });
    if (reason) {
      skippedPages.push({ pdfPage, printedPage, reason });
      return;
    }

    const normalized = normalizeBlocks(lines);
    if (!normalized.trim()) {
      skippedPages.push({ pdfPage, printedPage, reason: "empty-after-cleanup" });
      return;
    }

    keptPages.push({ pdfPage, printedPage });
    out.push(normalized, "");
  });

  const text = finalTextCleanup(out.join("\n"));
  return { text, keptPages, skippedPages };
}

function stripRunningMatter(lines) {
  return lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed) return true;
    if (/^The Syst(?:em|ea|eia|eit|eii|ei,|eit,|em,)\b/.test(trimmed)) return false;
    if (/^(page|Page)\s+\d+\s*$/i.test(trimmed)) return false;
    if (/^LON\s+DI/i.test(trimmed)) return false;
    if (/^UNIV\.?$/i.test(trimmed)) return false;
    if (/^RIIL$/i.test(trimmed)) return false;
    if (/^\d{4,5}[a-z]?$/i.test(trimmed)) return false;
    return true;
  });
}

function stripLikelyFootnotes(lines) {
  const startAt = Math.floor(lines.length * 0.12);
  for (let i = startAt; i < lines.length; i += 1) {
    const line = lines[i].trim();
    const nearby = lines.slice(i, Math.min(lines.length, i + 8)).join(" ");
    const block = blockAt(lines, i);
    const blockText = block.lines.join(" ");
    if (isLikelyFootnoteStart(line, nearby) || (i === block.start && isStrongFootnoteBlock(block.lines[0]?.trim() ?? "", blockText))) {
      let start = i;
      let blockStart = i;
      while (blockStart > startAt && lines[blockStart - 1].trim()) blockStart -= 1;
      const prefixBlock = lines.slice(blockStart, i);
      if (prefixBlock.length > 0 && prefixBlock.length <= 5 && isLikelyFootnoteContinuation(prefixBlock)) {
        start = blockStart;
      }
      return trimBlankEdges(lines.slice(0, start));
    }
  }
  return lines;
}

function blockAt(lines, index) {
  let start = index;
  let end = index + 1;
  while (start > 0 && lines[start - 1].trim()) start -= 1;
  while (end < lines.length && lines[end].trim()) end += 1;
  return { start, end, lines: lines.slice(start, end) };
}

function stripLeadingFootnoteOverflow(lines) {
  const trimmed = trimBlankEdges(lines);
  if (!trimmed.length) return trimmed;

  let end = 0;
  while (end < trimmed.length && trimmed[end].trim()) end += 1;

  const firstBlock = trimmed.slice(0, end);
  const text = firstBlock.join(" ").trim();
  if (isLikelyFootnoteStart(firstBlock[0]?.trim() ?? "", text) || isLikelyFootnoteContinuation(firstBlock)) {
    return trimBlankEdges(trimmed.slice(end));
  }
  return lines;
}

function isLikelyFootnoteStart(line, nearby) {
  if (!line) return false;
  if (/^\d+\.?\s+(cf\.|see\b|Tapes?:|apud\b|ibid\b|op\. cit\.?|on Tapes?:)/i.test(line)) return true;
  if (/^\d+\.?\s+["']?[A-Z][A-Za-z'.-]+:/.test(line)) return true;
  if (/^\d+\.?\s+["']/.test(line)) return true;
  if (/^[Iil]\s+(cf\.|see\b|Tapes?:|apud\b|ibid\b|op\. cit\.?|["']|Book"|Yat\b|As\b|This\b)/i.test(line)) return true;
  if (/^[a-z].*\b(Interview|Tapes?:|cf\.|apud|ibid|op\. cit\.|pp?\.|CW\s*\d|Tavistock Lectures|Mastery of Movement|Harmony and Conflict)\b/i.test(line)) return true;
  if (/^(?:my senses\. The endopsyche|and Energy - Energy|energy developed by)\b/i.test(line)) return true;
  if (/^\d+\.?\s+/.test(line) && hasFootnoteSignal(nearby)) return true;
  if (/^['`]\s+We must remember\b/.test(line)) return true;
  if (/^['`]\s+/.test(line) && hasFootnoteSignal(nearby)) return true;
  return false;
}

function isStrongFootnoteBlock(firstLine, text) {
  if (!firstLine || !text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 80) return false;
  if (/^(?:Intending|Attending|Deciding|Adapting|Sensing|Thinking|Intuiting|Feeling|Weight|Space|Time|Flow|Light|Strong|Flexible|Direct|Sustained|Quick|Free|Bound)\b/.test(firstLine)) return false;
  const explicitContinuation = /^Inner Participations in his ["']Book["']/.test(firstLine);
  if (/^[A-Z]/.test(firstLine) && !explicitContinuation) return false;
  const strongSignals = [
    /\bcf\./i,
    /\bibid\b/i,
    /\bop\. cit\.?/i,
    /\bTapes?:/i,
    /\bInterview:/i,
    /\bpp?\.\s*\d/i,
    /\bCW\s*\d/i,
    /\bTavistock Lectures\b/i,
    /\bMastery of Movement\b/i,
    /\bHarmony and Conflict\b/i,
    /\bemphasi[sz]ed in the original\b/i,
    /\bmy underlining\b/i,
    /\bapud\b/i,
  ];
  const signalCount = strongSignals.reduce((count, pattern) => count + (pattern.test(trimmed) ? 1 : 0), 0);
  const footnoteCitation = /\b(cf\.|ibid|op\. cit\.?|Tapes?:|Interview:|apud|CW\s*\d|emphasi[sz]ed in the original|my underlining)\b/i.test(trimmed);
  if (/^(?:\d+|[Iil])\.?\s/.test(firstLine) && signalCount >= 1) return true;
  if (/^[a-z(]/.test(firstLine) && signalCount >= 1) return true;
  if (signalCount >= 2 && footnoteCitation) return true;
  return false;
}

function isLikelyFootnoteContinuation(lines) {
  const text = lines.join(" ").trim();
  if (!text) return false;
  if (/^[a-z(]/.test(text) && hasFootnoteSignal(text)) return true;
  if (/^(ibid|op\. cit|cf\.|Interview|Tapes?):/i.test(text)) return true;
  return false;
}

function hasFootnoteSignal(text) {
  return /\b(Tapes?:|Interview|cf\.|ibid|op\. cit|apud|Stanislavski|Jung|Carpenter|Laban|Noverre|Fordham|Storr|Book"|Glossary"|Tavistock Lectures|Mastery of Movement|Harmony and Conflict|pp?\.|CW\s+\d)/i.test(text);
}

function hasStrongFootnoteSignal(text) {
  return /\b(Tapes?:|Interview:|cf\.|ibid|op\. cit|apud|Tavistock Lectures|Mastery of Movement|Harmony and Conflict|emphasi[sz]ed in the original|my underlining|pp?\.|CW\s+\d)\b/i.test(text);
}

function skipReason(lines, { printedPage }) {
  const joined = lines.join("\n");
  const words = wordCount(joined);
  const alpha = (joined.match(/[A-Za-z]/g) ?? []).length;
  const nonSpace = (joined.match(/\S/g) ?? []).length;
  const alphaRatio = nonSpace ? alpha / nonSpace : 0;
  const sentenceMarks = (joined.match(/[.!?]/g) ?? []).length;
  const chapterLike = /^\s*CHAPTER\s+[IVXLC]+\s*$/im.test(joined);
  const proseLines = lines.filter((line) => isProseLine(line)).length;
  const diagramSignals = countDiagramSignals(joined);

  if (chapterLike) return null;
  if (!joined.trim()) return "blank";
  if (diagramSignals >= 2 && proseLines < 3) {
    return "visual-or-diagram";
  }
  if (diagramSignals >= 1 && words < 140 && proseLines < 3) return "visual-or-diagram";
  if (printedPage && words >= 25 && proseLines >= 1) return null;
  if (printedPage && words >= 10 && sentenceMarks >= 1) return null;
  if (!printedPage && words < 90) return "low-prose-unprinted-page";
  if (!printedPage && proseLines < 2) return "low-prose-unprinted-page";
  if (words < 45 && sentenceMarks < 2) return "low-prose-page";
  if (alphaRatio < 0.45) return "ocr-symbol-heavy";
  return null;
}

function isProseLine(line) {
  const trimmed = line.trim();
  if (trimmed.length < 45) return false;
  if (!/[a-z]/.test(trimmed)) return false;
  if (wordCount(trimmed) < 7) return false;
  if (/[.!?:;,)]/.test(trimmed)) return true;
  return false;
}

function countDiagramSignals(text) {
  const signals = [
    /\bCUBE\b/i,
    /\bRIGHT-ACTION\b/i,
    /\bLEFT-ACTION\b/i,
    /\bBOUND FLOW\b/i,
    /\bFREE FLOW\b/i,
    /\bDIAGRAM(?:S)?\b/i,
    /\bCollage\b/i,
    /\bImages for\b/i,
    /\bILLUSTRATION\b/i,
    /\bSPACE-STRESSED\b/i,
    /\bTIME-STRESSED\b/i,
    /\bWEIGHT-STRESSED\b/i,
    /U= I_II/,
    /[A-Z]{2,}\/[A-Z]{2,}/,
  ];
  return signals.filter((pattern) => pattern.test(text)).length;
}

function normalizeBlocks(lines) {
  const blocks = [];
  let current = [];

  const flush = () => {
    if (current.length) {
      blocks.push(current);
      current = [];
    }
  };

  for (const line of lines) {
    if (!line.trim()) {
      flush();
    } else {
      current.push(line.trim());
    }
  }
  flush();

  return blocks
    .map((block) => formatBlock(block))
    .filter(Boolean)
    .join("\n\n");
}

function formatBlock(block) {
  if (block.length === 1) return formatSingleLine(block[0]);

  const joined = block.join(" ");
  const chapterMatch = joined.match(/^CHAPTER\s+([IVXLC]+)$/i);
  if (chapterMatch) return `# Chapter ${chapterMatch[1].toUpperCase()}`;

  if (block.length <= 4 && block.every((line) => isHeadingLine(line))) {
    return block.map((line) => formatSingleLine(line)).join("\n\n");
  }

  if (looksLikeTable(block)) {
    return block.map((line) => cleanSpacing(line)).join("\n");
  }

  return joinWrappedLines(block);
}

function formatSingleLine(line) {
  const trimmed = cleanSpacing(line);
  const chapterMatch = trimmed.match(/^CHAPTER\s+([IVXLC]+)$/i);
  if (chapterMatch) return `# Chapter ${chapterMatch[1].toUpperCase()}`;
  if (isHeadingLine(trimmed)) return `## ${toTitleCase(trimmed)}`;
  return trimmed;
}

function isHeadingLine(line) {
  const stripped = line.replace(/["'.,:;()/-]/g, "").trim();
  if (!stripped) return false;
  if (stripped.length > 80) return false;
  if (/[.!?]$/.test(line.trim())) return false;
  const letters = stripped.match(/[A-Za-z]/g) ?? [];
  if (letters.length < 4) return false;
  const uppercase = stripped.match(/[A-Z]/g) ?? [];
  const upperRatio = uppercase.length / letters.length;
  const wordTotal = stripped.split(/\s+/).length;
  return upperRatio > 0.58 && wordTotal <= 10;
}

function looksLikeTable(block) {
  const multiSpaceRows = block.filter((line) => /\S\s{2,}\S/.test(line)).length;
  const shortRows = block.filter((line) => line.length < 80).length;
  return block.length >= 3 && multiSpaceRows >= 2 && shortRows / block.length > 0.55;
}

function joinWrappedLines(lines) {
  let paragraph = "";
  for (const rawLine of lines) {
    const line = cleanSpacing(rawLine);
    if (!paragraph) {
      paragraph = line;
      continue;
    }
    if (paragraph.endsWith("-") && /^[a-z]/.test(line)) {
      paragraph = `${paragraph.slice(0, -1)}${line}`;
    } else {
      paragraph = `${paragraph} ${line}`;
    }
  }
  return paragraph;
}

function cleanSpacing(line) {
  return line.replace(/\s+/g, " ").trim();
}

function finalTextCleanup(text) {
  return fixCommonOcr(text)
    .replace(/\s*\[[^\]]*ILLUSTRATION[^\]]*\]\s*/gi, " ")
    .replace(/\s*\((?:see\s+)?ILLUSTRATION\)\s*/gi, " ")
    .replace(/\s*[\[(](?:see\s+)?ILLUSTRATION\]\s*/gi, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]+\n/g, "\n")
    .trim()
    .concat("\n");
}

function cutBeforeChapterV(text) {
  return text.replace(/\n# Chapter V[\s\S]*$/m, "\n");
}

function finalNarrationCleanup(text) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => cleanNarrationParagraph(paragraph))
    .filter((paragraph) => paragraph && !shouldDropNarrationParagraph(paragraph));

  return mergeBrokenNarrationParagraphs(paragraphs)
    .join("\n\n")
    .replace(/\n\n1 I have tried to make the relationship clearer[\s\S]*?\(See following page\)/gi, "")
    .replace(/'presence'\s+Mental Factors/g, "'presence'.\n\nMental Factors")
    .replace(/\s*\((?:see\s+)?ILLUSTRATION\)\s*/gi, " ")
    .replace(/fluenc'/g, "fluency")
    .replace(/\bfluency\s+4\s+of\b/g, "fluency of")
    .replace(/\bextravert\s+4\s+energy\b/g, "extravert energy")
    .replace(/muscular one 2 -/g, "muscular one -")
    .replace(/ADAPTING \(Flow\) Free Bound 1 Laban/g, "ADAPTING (Flow) Free Bound\n\nLaban")
    .replace(/Basic Concepts - Motion Factors and Elements/g, "")
    .replace(/role they played\. "\) both/g, "role they played. Each character is both")
    .replace(/role they played, both/g, "role they played. Each character is both")
    .replace(/\bcontrol\s+2\s+the\b/g, "control the")
    .replace(/\."\s+1\s+The duration/g, ". The duration")
    .replace(/\)\s+1\s+Finally/g, ") Finally")
    .replace(/Adapting"\s+2\s+The Quests/g, "Adapting\". The Quests")
    .replace(/towards her\)\s+2\s+In consequence/g, "towards her) In consequence")
    .replace(/\n+1 Describing physical gestures is difficult[\s\S]*?associated with them\./g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .concat("\n");
}

function cleanNarrationParagraph(paragraph) {
  let out = paragraph.trim();
  out = out.replace(/([A-Za-z)"'])\d+\b/g, "$1");
  out = out.replace(/([.!?"')])\s+[0-9]{1,2}\s+(?=[A-Z])/g, "$1 ");
  out = out.replace(/([.!?"')])l(?=\s|$)/g, "$1");
  out = out.replace(/[•°]\d+/g, "");
  out = out.replace(/([.!?])\s*\d+\b/g, "$1");
  out = out.replace(/([.!?])['`](?=\s|$)/g, "$1");
  out = out.replace(/\s+[0-9Il]{1,2}\s*([,.;:])/g, "$1");
  out = out.replace(/\b([A-Za-z]+)\s+[0-9Il]{1,2}\s*(?=[,.;:])/g, "$1");
  out = stripInlineFootnoteNumbers(out);
  out = out.replace(/\s+(?:['`]\s+)?\d+\.?\s+(?:cf\.|Tapes?:|ibid|op\. cit|apud)\b[\s\S]*$/i, "");
  out = out.replace(/\s+\d+\.?\s+["'][\s\S]*?(?:apud|Tapes?:|Jung|Laban|Carpenter|Noverre|Stanislavski|Fordham|Storr)[\s\S]*$/i, "");
  out = out.replace(/\s+\d+\.?\s+(?:As Laban puts it|This constitutes|Yat Malmgren refers to|Yat Malmgren makes a similar point)[\s\S]*$/i, "");
  out = out.replace(/\n?1 I have tried to make the relationship clearer[\s\S]*$/i, "");
  out = out.replace(/\s+The i cf\.[\s\S]*$/i, "");
  out = out.replace(/\s+\]\. Tapes?:[\s\S]*$/i, "");
  out = out.replace(/\s+Tapes?:\s*\d[\s\S]*$/i, "");
  out = out.replace(/\s+emphasized in the original\)$/i, "");
  out = out.replace(/\s+example\)$/i, "");
  out = out.replace(/^The Syste[.\w,]*\s+Basic Concepts - Effort\s*/i, "");
  out = out.replace(/\s*Basic Concepts - Motion Factors and Elements\s*/g, " ");
  out = out.replace(/\bMotion Factors? & Elements\b/g, "Motion Factors and Elements");
  out = out.replace(/\bThe Sys tea\b/g, "");
  return out.trim();
}

function shouldDropNarrationParagraph(paragraph) {
  return /^(?:\d+|['`])\.?\s+(?:cf\.|Tapes?:|ibid|op\. cit|apud|["']|As Laban puts it|This constitutes|Yat Malmgren refers|Yat Malmgren makes|The idea of professional)/i.test(paragraph)
    || /^1 I have tried to make the relationship clearer\b/i.test(paragraph)
    || /^1 Describing physical gestures is difficult\b/i.test(paragraph)
    || /^(?:Tapes?:|emphasized in the original\)|example\)|The Syste[.\w,]*\s+Basic Concepts)/i.test(paragraph)
    || /\b(U= I_II|RIGHT-ACTION|LEFT-ACTION|BOUND FLOW|FREE FLOW|SPACE-STRESSED|TIME-STRESSED|WEIGHT-STRESSED)\b/i.test(paragraph);
}

function stripInlineFootnoteNumbers(text) {
  return text
    .replace(/\b([A-Za-z]{4,})\s+[0-9]{1,2}\s+(?=(?:which|that|the|and|in|as|with|of|to|is|are|has|have|or|works|Laban|Finally|The|In)\b)/g, (match, word) => {
      if (word === "Chapter" || word === "figure" || word === "Figure") return match;
      return `${word} `;
    })
    .replace(/\b([A-Za-z]{4,})\s+[0-9]{1,2}\s+-/g, (match, word) => {
      if (word === "figure" || word === "Figure") return match;
      return `${word} -`;
    })
    .replace(/"Magic If"\s+[0-9]{1,2}\s+works/g, "\"Magic If\" works")
    .replace(/towards her\)\s+[0-9]{1,2}\s+In consequence/g, "towards her) In consequence");
}

function mergeBrokenNarrationParagraphs(paragraphs) {
  const merged = [];

  for (const paragraph of paragraphs) {
    const previous = merged.at(-1);
    if (previous && shouldMergeNarrationParagraphs(previous, paragraph)) {
      merged[merged.length - 1] = `${previous} ${paragraph}`;
    } else {
      merged.push(paragraph);
    }
  }

  return merged;
}

function shouldMergeNarrationParagraphs(previous, next) {
  if (previous.startsWith("#") || next.startsWith("#")) return false;
  if (previous === "* * *" || next === "* * *") return false;
  if (/^[-*]\s/.test(previous) || /^[-*]\s/.test(next)) return false;
  if (isHeadingLine(previous) || isHeadingLine(next)) return false;
  if (/[.!?]["')\]]*$/.test(previous.trim())) return false;
  return true;
}

function fixCommonOcr(text) {
  return text
    .replace(/\bYat\s+Nalmgren\b/g, "Yat Malmgren")
    .replace(/\bYat\s+Malnigren\b/g, "Yat Malmgren")
    .replace(/\bYat\s+Malmgre\.n\b/g, "Yat Malmgren")
    .replace(/\bMalmgre\.n\b/g, "Malmgren")
    .replace(/\bAdreain\b/g, "Adream")
    .replace(/\bAdrean\b/g, "Adream")
    .replace(/\bADREAN\b/g, "ADREAM")
    .replace(/\bAdreaiu\b/g, "Adream")
    .replace(/\bNotion Factors\b/g, "Motion Factors")
    .replace(/\bMotion Factor, of\b/g, "Motion Factors of")
    .replace(/\bMotion Factor, /g, "Motion Factor ")
    .replace(/\bmovenient\b/g, "movement")
    .replace(/\bniovement\b/g, "movement")
    .replace(/\bTine\b/g, "Time")
    .replace(/\bTINE\b/g, "TIME")
    .replace(/\bPlow\b/g, "Flow")
    .replace(/\bPLOW\b/g, "FLOW")
    .replace(/\bFLDW\b/g, "FLOW")
    .replace(/\bPeeling\b/g, "Feeling")
    .replace(/\bPEELING\b/g, "FEELING")
    .replace(/\bDiagrans\b/g, "Diagrams")
    .replace(/\bDIAGRANS\b/g, "DIAGRAMS")
    .replace(/\bExaiiples\b/g, "Examples")
    .replace(/\bEXAIIPLES\b/g, "EXAMPLES")
    .replace(/\bGaMer\b/g, "Gabler")
    .replace(/\bPoloriius\b/g, "Polonius")
    .replace(/\brecieving\b/gi, "receiving")
    .replace(/\bsuccunib\b/g, "succumb")
    .replace(/\bsensememory\b/g, "sense-memory")
    .replace(/\bsensereaction\b/g, "sense-reaction")
    .replace(/\bcounterpressure\b/g, "counter-pressure")
    .replace(/filled'°/g, "filled\"")
    .replace(/\bprimwaz mobile\b/g, "primum mobile")
    .replace(/\benerqy\b/g, "energy")
    .replace(/\bfroi\b/g, "from")
    .replace(/\bf actors\b/g, "factors")
    .replace(/\bLi ght\b/g, "Light")
    .replace(/\bDesdeinona\b/g, "Desdemona")
    .replace(/\blago\b/g, "Iago")
    .replace(/\btago\b/g, "Iago")
    .replace(/\bTushinghain\b/g, "Tushingham")
    .replace(/\bMalingren\b/g, "Malmgren")
    .replace(/\bMaingren\b/g, "Malmgren")
    .replace(/\bMalxngren\b/g, "Malmgren")
    .replace(/\bMa\]\.mgren\b/g, "Malmgren")
    .replace(/\bLahan\b/g, "Laban")
    .replace(/\bcominedia\b/g, "commedia")
    .replace(/\bGrand Gui gnol\b/g, "Grand Guignol")
    .replace(/\bAdreani\b/g, "Adream")
    .replace(/\bAdreazn\b/g, "Adream")
    .replace(/\bAdreaxn\b/g, "Adream")
    .replace(/\bAdreaxa\b/g, "Adream")
    .replace(/\bAdreain\b/g, "Adream")
    .replace(/\bADREPIN\b/g, "ADREAM")
    .replace(/\bADREPN\b/g, "ADREAM")
    .replace(/\bADRE1UI\b/g, "ADREAM")
    .replace(/\bGanyinede\b/g, "Ganymede")
    .replace(/\buithalanced\b/g, "unbalanced")
    .replace(/\bExanples\b/g, "Examples")
    .replace(/\bboff in\b/g, "boffin")
    .replace(/\bpro\]ects\b/g, "projects")
    .replace(/\b1!athrnalized\b/g, "Externalized")
    .replace(/\b1!AThRNALIZED\b/g, "EXTERNALIZED")
    .replace(/\bNe4r\b/g, "Near")
    .replace(/\bRe\?x\)te\b/g, "Remote")
    .replace(/\bAdreaji\b/g, "Adream")
    .replace(/\bCrainpedness\b/g, "Crampedness")
    .replace(/\bWREN\b/g, "WHEN")
    .replace(/\b11DAPTING\b/g, "ADAPTING")
    .replace(/\bArnoiphe\b/g, "Arnolphe")
    .replace(/\bSu\.ch\b/g, "Such")
    .replace(/\bmaimer\b/g, "manner")
    .replace(/\bof ten\b/g, "often")
    .replace(/\bspacial\b/g, "spatial")
    .replace(/\bthee characters\b/g, "the characters")
    .replace(/\bHerakies\b/g, "Herakles")
    .replace(/\bWi th\b/g, "With")
    .replace(/\bClyteinnestra\b/g, "Clytemnestra")
    .replace(/\bPASS ION\b/g, "PASSION")
    .replace(/\bAdreaii\b/g, "Adream")
    .replace(/\bAdrea\.m\b/g, "Adream")
    .replace(/\bSys\s+teni\b/g, "System")
    .replace(/\bsuinmative\b/g, "summative")
    .replace(/\bsumxnative\b/g, "summative")
    .replace(/\bma\]or\b/g, "major")
    .replace(/\bnediuin\b/g, "medium")
    .replace(/\bof f centre\b/g, "off centre")
    .replace(/\bendof-year\b/g, "end-of-year")
    .replace(/\bRigolleto\b/g, "Rigoletto")
    .replace(/\bUrrshaft\b/g, "Undershaft")
    .replace(/\bsparing\b/g, "sparring")
    .replace(/\bmisdeineanours\b/g, "misdemeanours")
    .replace(/\bLainborghini\b/g, "Lamborghini")
    .replace(/\bVanya\b/g, "Vanya")
    .replace(/\bVa\.nya\b/g, "Vanya")
    .replace(/\ba\.bout\b/g, "about")
    .replace(/\bb\/angel\b/g, "Wangel")
    .replace(/\bonl y\b/g, "only")
    .replace(/\bf or\b/g, "for")
    .replace(/\bsub-conscious\b/g, "subconscious")
    .replace(/\bselfconsciously\b/g, "self-consciously")
    .replace(/\bself composure\b/g, "self-composure")
    .replace(/\bcombarnes\b/g, "combines")
    .replace(/\bcombanes\b/g, "combines")
    .replace(/\barid\b/g, "and")
    .replace(/\bcaine\b/g, "came")
    .replace(/\brhewn\b/g, "rheum")
    .replace(/\bJalmar\b/g, "Hjalmar")
    .replace(/\be,pression\b/g, "expression")
    .replace(/\bref lection\b/g, "reflection")
    .replace(/\bfluenc'\b/g, "fluency")
    .replace(/in 'series, in strings/g, "in series, in strings")
    .replace(/\bAnswers' relating\b/g, "Answers relating")
    .replace(/'presence'\s+Mental Factors/g, "'presence'.\n\nMental Factors")
    .replace(/\bspheres t\s*,/g, "spheres,")
    .replace(/\bseries t\s*,/g, "series,")
    .replace(/\bcouriteracts\b/g, "counteracts")
    .replace(/\bHzO\b/g, "H2O")
    .replace(/\bterm of the personality\b/g, "terms of the personality")
    .replace(/\btenipi\b/g, "tempi")
    .replace(/\btransiiiitting\b/g, "transmitting")
    .replace(/\bself knowledge\b/g, "self-knowledge")
    .replace(/\bprimi ti ye\b/g, "primitive")
    .replace(/\bi nheri t\b/g, "inherit")
    .replace(/role they played\. ["')]+ both/g, "role they played, both")
    .replace(/performer \.s/g, "performer is")
    .replace(/decisions and\. intentions/g, "decisions and intentions")
    .replace(/personality \./g, "personality.")
    .replace(/\bLabart\b/g, "Laban")
    .replace(/\brighthanded\b/g, "right-handed")
    .replace(/\binnerouter\b/g, "inner-outer")
    .replace(/\bhalfgestures\b/g, "half-gestures")
    .replace(/\bcauses the yes to 'withdraw'/g, "causes the eyes to 'withdraw'")
    .replace(/\( I 44H going to do it!\"\)/g, "(\"I AM going to do it!\")")
    .replace(/\bgaze in not straight on\b/g, "gaze is not straight on")
    .replace(/\bSyste[a-z.,]*\b/g, "System");
}

function writeGoldChapters(chapterPaths, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const specs = [
    { slug: "chapter-01-basic-concepts" },
    { slug: "chapter-02-attitudes" },
    { slug: "chapter-03-externalized-drives" },
    { slug: "chapter-04-applications" },
  ];

  return chapterPaths.map((chapterPath, index) => {
    if (!chapterPath || !fs.existsSync(chapterPath)) return null;

    const text = makeChapterTtsManuscript(fs.readFileSync(chapterPath, "utf8"));
    const slug = specs[index]?.slug ?? `chapter-${String(index + 1).padStart(2, "0")}`;
    const ttsMd = path.join(dir, `${slug}.tts.md`);
    const ttsTxt = path.join(dir, `${slug}.tts.txt`);
    fs.writeFileSync(ttsMd, text);
    fs.writeFileSync(ttsTxt, text);

    return {
      source_chapter: chapterPath,
      tts_md: ttsMd,
      tts_txt: ttsTxt,
      stats: statsFor(text),
      approx_listening_duration: {
        at_140_wpm_minutes: round(statsFor(text).words / 140, 1),
        at_150_wpm_minutes: round(statsFor(text).words / 150, 1),
      },
      estimated_elevenlabs_credits: {
        flash_or_turbo_0_5_credit_per_char: Math.ceil(text.length * 0.5),
        multilingual_or_v3_1_credit_per_char: text.length,
      },
    };
  }).filter(Boolean);
}

function makeChapterTtsManuscript(text) {
  return chapterTtsCleanup(
    text
      .replace(/^#\s+/gm, "")
      .replace(/^##\s+/gm, "")
      .replace(/^\s*-\s+/gm, "")
  )
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .concat("\n");
}

function chapterTtsCleanup(text) {
  let out = fixCommonOcr(text);

  out = out
    .replace(/\bThe\s+(?:System|Syste[a-z.,]*)\s+(?:Attitudes|Externalized Drives)\s*-\s*[A-Za-z]+\b/g, "")
    .replace(/\bThe\s+(?:System|Syste[a-z.,]*)\s+Attitude\.s\s*-\s*Introduction\b/g, "")
    .replace(/\b18th\. Century\b/g, "eighteenth-century")
    .replace(/Noverre'/g, "Noverre")
    .replace(/\bThis behaviour patterns\b/g, "These behaviour patterns")
    .replace(/\btoo discreet to describe\b/g, "too discrete to describe")
    .replace(/\bprize information from\b/g, "prise information from")
    .replace(/\bfay, weak and ridiculous\b/g, "fey, weak and ridiculous")
    .replace(/"inner activities' which/g, "\"inner activities\" which")
    .replace(/inner 'images" \(contacts\)/g, "inner 'images' (contacts)")
    .replace(/\bfunctional' -/g, "functional -")
    .replace(/\bactivities' \('doings'\)/g, "activities ('doings')")
    .replace(/\bInner Action' layer\b/g, "Inner Action layer")
    .replace(/\bthe visible Movements\b/g, "the visible movements")
    .replace(/conscious volition"\./g, "conscious volition.\"")
    .replace(/Action is Movement that of the torso/g, "Action is Movement: that of the torso")
    .replace(/The four mental states of: DOING \(exerting\/reacting\) PASSION \(constructing\/destroying\) SPELL \(dominating\/surrendering\) VISION \(ideas\/problems\) which are motivated by the subconscious Inner Attitudes and which activate us into the conscious Actions\./g, "The four mental states are Doing, meaning exerting and reacting; Passion, meaning constructing and destroying; Spell, meaning dominating and surrendering; and Vision, meaning ideas and problems. These are motivated by the subconscious Inner Attitudes and activate us into conscious Actions.")
    .replace(/The four mental states are Doing, meaning exerting and reacting; Passion, meaning constructing and destroying; Spell, meaning dominating and surrendering; and Vision, meaning ideas and problems\. These are motivated by the subconscious Inner Attitudes and are motivated by the subconscious Inner Attitudes and which activate us into the conscious Actions\./g, "The four mental states are Doing, meaning exerting and reacting; Passion, meaning constructing and destroying; Spell, meaning dominating and surrendering; and Vision, meaning ideas and problems. These are motivated by the subconscious Inner Attitudes and activate us into conscious Actions.")
    .replace(/\bterms established in Chapter\.\s+The entire process\b/g, "terms established in Chapter 1. The entire process")
    .replace(/\bthe waltz cease to be\b/g, "the waltz ceases to be")
    .replace(/\ba waltz cease to be\b/g, "a waltz ceases to be")
    .replace(/\bat worse they are inert\b/g, "at worst they are inert")
    .replace(/\bneither Light or Strong\b/g, "neither Light nor Strong")
    .replace(/\bneither Light nor Strong, Flexible or Direct, Sustained or Quick, Free or Bound\b/g, "neither Light nor Strong, neither Flexible nor Direct, neither Sustained nor Quick, neither Free nor Bound")
    .replace(/\bwill bet\b/g, "will be")
    .replace(/\bWill bet\b/g, "Will be")
    .replace(/\band\. movements\b/g, "and movements")
    .replace(/\bintonations cf the voices\b/g, "intonations of the voices")
    .replace(/'Aui, I remember/g, "'Ah, I remember")
    .replace(/\bviceversa\b/g, "vice versa")
    .replace(/\bfaculties'\./g, "faculties.")
    .replace(/\bmind'\./g, "mind.")
    .replace(/\bpatterns'\./g, "patterns.")
    .replace(/\bunconscious'\./g, "unconscious.")
    .replace(/\bFeeling\."'/g, "Feeling.\"")
    .replace(/\bExternalized Drives\."'/g, "Externalized Drives.\"")
    .replace(/\bMalmgren,' so\b/g, "Malmgren, so")
    .replace(/\botion factor\b/g, "motion factor")
    .replace(/\bArid a little below\b/g, "And a little below")
    .replace(/\blast on\. the island\b/g, "last on the island")
    .replace(/\bOdysseus' jumps\b/g, "Odysseus jumps")
    .replace(/"Odysseus jumps on the beach:/g, "Odysseus jumps on the beach:")
    .replace(/\bkinds of "decisions':/g, "kinds of \"decisions\":")
    .replace(/\bHalf my life for a glass of tea' he exclaims\b/g, "Half my life for a glass of tea\" he exclaims")
    .replace(/thinking\."'/g, "thinking.\"")
    .replace(/Strong\."'/g, "Strong.\"")
    .replace(/\bdisenthodied\b/g, "disembodied")
    .replace(/\bcircwnspect\b/g, "circumspect")
    .replace(/\brightsided\b/g, "right-sided")
    .replace(/asks 'can this be right\? in comparison with 'what I thought it was'/g, "asks 'can this be right?' in comparison with 'what I thought it was'")
    .replace(/Giovanni asks: "What must we now do\?"' One/g, "Giovanni asks: \"What must we now do?\" One")
    .replace(/\bneo-\s+Platonic\b/g, "neo-Platonic")
    .replace(/"Sensing - sensory perception through the five senses, revealed in our movements as weight; either light or strong\./g, "\"Sensing - sensory perception through the five senses, revealed in our movements as weight; either light or strong.\"")
    .replace(/\bTypical Floating Actions':/g, "Typical Floating actions:")
    .replace(/\bTypical Flicking Actions:/g, "Typical Flicking actions:")
    .replace(/\bTypical Gliding Actions:/g, "Typical Gliding actions:")
    .replace(/\bTypical Dabbing Actions:/g, "Typical Dabbing actions:")
    .replace(/\bTypical Slashing Actions:/g, "Typical Slashing actions:")
    .replace(/\bTypical Pressing Actions:/g, "Typical Pressing actions:")
    .replace(/\bTypical Punching Actions:/g, "Typical Punching actions:")
    .replace(/\bcharacter\/the cube\b/g, "character, or the cube,")
    .replace(/\bcharacter\/situation\b/g, "character or situation")
    .replace(/\bSuper- Objective\b/g, "Super-Objective")
    .replace(/\bSuper- Objectives\b/g, "Super-Objectives")
    .replace(/\bSuper Objective\b/g, "Super-Objective")
    .replace(/\bAction Attitudes\b/g, "Action Attitudes")
    .replace(/\bExternalized Drives \(inner\)/g, "Externalized Drives, inner")
    .replace(/\bExternalized Drives \(outer\)/g, "Externalized Drives, outer")
    .replace(/\bTue Confluence\b/g, "The Confluence")
    .replace(/\bLv7jer Attitudes\b/g, "Inner Attitudes")
    .replace(/\bInnej\? Attitudes\b/g, "Inner Attitudes")
    .replace(/\bCharacteristic: Flowless \(adapting Is Subdued\)/g, "Characteristic: Flowless, meaning Adapting is subdued")
    .replace(/\bCharacteristic: Timeless \(deciding Is Subdued\)/g, "Characteristic: Timeless, meaning Deciding is subdued")
    .replace(/Psychological Type -> Super-objective -> Externalized Drives \(inner\) ->\s+-> Inner Attitude -> Externalized Drives \(outer\) -> Action Attitudes/g, "The sequence is: psychological type, then Super-Objective, then inner Externalized Drives, then Inner Attitude, then outer Externalized Drives, then Action Attitudes.")
    .replace(/SENSING generates DOING\s+FEELING generates PASSION\s+INTUITING generates SPELL\s+THINKING generates VISION/g, "Sensing generates Doing. Feeling generates Passion. Intuiting generates Spell. Thinking generates Vision.")
    .replace(/DOING is based on SENSING but has no FEELING PASSION is based on FEELING but has no THINKING VISION is based on THINKING but has no SENSING This leaves us with the paradox of: SPELL is based on INTUITING but has no INTUITING/g, "Doing is based on Sensing but has no Feeling. Passion is based on Feeling but has no Thinking. Vision is based on Thinking but has no Sensing. This leaves us with the paradox that Spell is based on Intuiting but has no Intuiting.")
    .replace(/"?DOING \(Exerting\/Reacting\)\s+CHARACTERISTICS FLOWLESS \[Adapting is subdued\][\s\S]*?INNER ATTITUDES STABLE NEAR AWAKE purple red blue s I/g, "Doing, exerting and reacting, is flowless: Adapting is subdued. Its mental factors are Sensing, Thinking, and Intuiting, with Feeling subdued. Its motion factors are Weight, Space, and Time, with Flow subdued. Its inner participations are Intending, Attending, and Deciding, with Adapting subdued. Its inner quests are What, Where, and When, with Why subdued. Its active elements are Light/Strong, Flexible/Direct, and Sustained/Quick, with Free/Bound subdued. Its inner attitudes are Stable, Near, and Awake.")
    .replace(/PASSION \(constructing\/destroying\)\s+"CHARACTERISTICS SPACELESS \(Attending is subdued\)[\s\S]*?INNER ATTITUDES MOBILE NEAR ADREAM green red orange"?\s*1/g, "Passion, constructing and destroying, is spaceless: Attending is subdued. Its mental factors are Sensing, Intuiting, and Feeling, with Thinking subdued. Its motion factors are Weight, Time, and Flow, with Space subdued. Its inner participations are Intending, Deciding, and Adapting, with Attending subdued. Its inner quests are What, Why, and When, with Where subdued. Its active elements are Light/Strong, Sustained/Quick, and Free/Bound, with Flexible/Direct subdued. Its inner attitudes are Mobile, Near, and Adream.")
    .replace(/SPELL \(Dominating\/Surrendering\)\s+"CHARACTERISTIC TIMELESS \(Deciding is subdued\)[\s\S]*?INNER ATTITUDES STABLE REMOTE ADREAM purple turquoise orange"?\s*1/g, "Spell, dominating and surrendering, is timeless: Deciding is subdued. Its mental factors are Sensing, Thinking, and Feeling, with Intuiting subdued. Its motion factors are Weight, Space, and Flow, with Time subdued. Its inner participations are Intending, Attending, and Adapting, with Deciding subdued. Its inner quests are What, Where, and Why, with When subdued. Its active elements are Light/Strong, Flexible/Direct, and Free/Bound, with Sustained/Quick subdued. Its inner attitudes are Stable, Remote, and Adream.")
    .replace(/VISION \(Ideas\/Problems\)\s+"CHARACTERISTIC WEIGHTLESS \(Intending is subdued\)[\s\S]*?INNER ATTITUDES MOBILE REMOTE AWAKE green turquoise blue"?\s*1/g, "Vision, ideas and problems, is weightless: Intending is subdued. Its mental factors are Thinking, Intuiting, and Feeling, with Sensing subdued. Its motion factors are Space, Time, and Flow, with Weight subdued. Its inner participations are Attending, Deciding, and Adapting, with Intending subdued. Its inner quests are Where, When, and Why, with What subdued. Its active elements are Flexible/Direct, Sustained/Quick, and Free/Bound, with Light/Strong subdued. Its inner attitudes are Mobile, Remote, and Awake.")
    .replace(/Mobile is Vision and Passion: destroying and constructing with ideas - Remote is Vision and Spell: surrendering to or dominating an idea - Awake is Vision and Doing: reacting to and exerting upon an idea\./g, "Mobile is Vision and Passion: destroying and constructing with ideas. Remote is Vision and Spell: surrendering to or dominating an idea. Awake is Vision and Doing: reacting to and exerting upon an idea.")
    .replace(/\bthe effect bayonet training\b/g, "the effect bayonet training")
    .replace(/\btakes attitudes\s+1\s+all the time\b/g, "takes attitudes all the time")
    .replace(/\btake attitudes\s+1\s+all the time\b/g, "take attitudes all the time")
    .replace(/"psycho-physical"\s+4\s+theory/g, "\"psycho-physical\" theory")
    .replace(/"a recovery function ',/g, "\"a recovery function\",")
    .replace(/\bAdr earn\b/g, "Adream")
    .replace(/Near \+ Mobile Adream/g, "Near + Mobile = Adream")
    .replace(/\bADREPIN\b/g, "ADREAM")
    .replace(/\ba\. dynamic\b/g, "a dynamic")
    .replace(/This Such wild swings/g, "Such wild swings")
    .replace(/they are Mobile they involve/g, "they are Mobile: they involve")
    .replace(/room 101" \(in Orwell's ""\)/g, "room 101\" (in Orwell's \"Nineteen Eighty-Four\")")
    .replace(/Yat Malmgren's confesses/g, "Yat Malmgren confesses")
    .replace(/Intuiting is the "subdued'/g, "Intuiting is the \"subdued\"")
    .replace(/\bCubes for Spell and Vision'/g, "Cubes for Spell and Vision")
    .replace(/\bthe Drives as:\s*a\. the recipients of the motivation\s+b\. the transmission belt linking the motivation to the action\./g, "the Drives as recipients of the motivation and as the transmission belt linking the motivation to the action.")
    .replace(/\bcomes, according to Marie-Louise von Franz,[\s\S]*?auxiliary at the Near is a 'lack of' Remote Stable is a 'lack of' Mobile Adream is a 'lack of' Awake\./g, "Near is a 'lack of' Remote. Stable is a 'lack of' Mobile. Adream is a 'lack of' Awake.")
    .replace(/the air of supreme confidence we assume when entering the manager's office is John's day,[\s\S]*?\(Tapes: 14-14\)\s+undermined/g, "the air of supreme confidence we assume when entering the manager's office is undermined")
    .replace(/Elements cause: Laban, of course, is looking/g, "Elements cause: Strong causes \"Crampedness\". Light causes \"Sloppiness\". Direct causes \"Obstinacy\". Flexible causes \"Fussiness\". Sustained causes \"Laziness\". Quick causes \"Hastiness\". Free Flow causes \"Flightiness\". Bound Flow causes \"Stickiness\".\n\nLaban, of course, is looking")
    .replace(/He had always defined expression as the result of the Laban is therefore aware/g, "He had always defined expression as the result of the inner contradictions present in the body. He knows, for example, that a change between a Strong movement and a Light movement gives rise to an expressive physical statement. He knows that Bound Flow contradicts the universal natural tendency towards Free Flow. His observations of real life are therefore guided by two principles derived from artistic activity. First, the idea of the physical tension between different planes of the body in space. Second, the idea of harmony between the body and the universe: that Light always tends upwards and Strong is drawn downwards; Bound turns inwards while Free expands centrifugally, and so on.\n\nLaban is therefore aware")
    .replace(/\bStrong\s+"Crampedness"\s+Light\s+"Sloppiness"\s+Direct\s+"Obstinacy"\s+Flexible\s+"Fussiness"\s+Sustained\s+"Laziness"\s+Quick\s+"Hastiness"\s+Free Flow\s+"Flightiness"\s+Bound Flow\s+"Stickiness"\b/g, "Strong causes \"Crampedness\". Light causes \"Sloppiness\". Direct causes \"Obstinacy\". Flexible causes \"Fussiness\". Sustained causes \"Laziness\". Quick causes \"Hastiness\". Free Flow causes \"Flightiness\". Bound Flow causes \"Stickiness\".")
    .replace(/Inner Attitude Laban's 'label' y description Stable "unadaptive" 'the intelligent ruler'\s+Mobile "adapting" 'highly emotional'\s+Near "relating" 'down to earth'\s+Remote "solitude" ascetic'\s+Awake "awareness" 'the intellectual'\s+Adream "unawareness" 'the lover'/g, "The Inner Attitudes can be read as follows. Stable is labelled \"unadaptive\": the intelligent ruler. Mobile is labelled \"adapting\": highly emotional. Near is labelled \"relating\": down to earth. Remote is labelled \"solitude\": ascetic. Awake is labelled \"awareness\": the intellectual. Adream is labelled \"unawareness\": the lover.")
    .replace(/Near \+ Awake = Stable\s+Near \+ Mobile = Adream\s+Awake \+ Mobile = Remote/g, "Near plus Awake equals Stable. Near plus Mobile equals Adream. Awake plus Mobile equals Remote.")
    .replace(/Near is Red \(Intending \+ Deciding\)\s+Awake is Blue \(Attending \+ Deciding\)\s+Mobile is Green \(Adapting \+ Deciding\)/g, "Near is red: Intending plus Deciding. Awake is blue: Attending plus Deciding. Mobile is green: Adapting plus Deciding.")
    .replace(/Stable is Purple \(Near \+ Awake = Red \+ Blue\)\s+Adream is Orange \(Near \+ Mobile = Red \+ Green\)\s+Remote is Turquoise \(Awake \+ Mobile = Blue \+ Green\)/g, "Stable is purple: Near plus Awake, red plus blue. Adream is orange: Near plus Mobile, red plus green. Remote is turquoise: Awake plus Mobile, blue plus green.")
    .replace(/The six subconscious Inner Attitudes of: STABLE \[Intending\/Attending or Attending\/Intending\] MOBILE \[Deciding\/Adapting or Adapting\/Deciding\] NEAR \[Intending\/Deciding or Deciding\/Intending\] REMOTE \[Attending\/Adapting or Adapting\/Attending\] AWAKE \[Attending\/Deciding or Deciding\/Attending\] ADREAM \[Intending\/Adapting or Adapting\/Intending\] which are normally motivated in the subconscious mind, but which can be activated by bodily movements\./g, "The six subconscious Inner Attitudes are Stable, Intending/Attending or Attending/Intending; Mobile, Deciding/Adapting or Adapting/Deciding; Near, Intending/Deciding or Deciding/Intending; Remote, Attending/Adapting or Adapting/Attending; Awake, Attending/Deciding or Deciding/Attending; and Adream, Intending/Adapting or Adapting/Intending. They are normally motivated in the subconscious mind, but can be activated by bodily movements.")
    .replace(/are: "The six subconscious/g, "are as follows. The six subconscious")
    .replace(/The three fundamental Inner Attitudes are those which contain Deciding \(Intuiting\), namely:\s+Near\s+Mobile\s+Awake/g, "The three fundamental Inner Attitudes are those which contain Deciding, or Intuiting: Near, Mobile, and Awake.")
    .replace(/\bat puberty we combine for the first time our inborn Intending and Adapting and enter in a state of ADREAM\. Religious rites \(confirmation, bar-mitzvah\), tribal initiation ceremonies, mark our graduation to ADREAM\. - in professional life we strive for STABILITY, discarding Adapting and combining our Intending with Attending\. This is our entry in the mature phase - the key to the door at twenty one, the vote at eighteen, admission to married status, are society's ways of marking it\. - in old age we tend to distance ourselves from the senses \(Intending\)\. We combine Attending with re-discovered Adapting, creating REMOTENESS, the 'final' Inner Attitude, celebrated tin burial rites\./g, "At puberty we combine for the first time our inborn Intending and Adapting and enter a state of Adream. Religious rites, including confirmation, bar-mitzvah, and tribal initiation ceremonies, mark our graduation to Adream. In professional life we strive for Stability, discarding Adapting and combining our Intending with Attending. This is our entry into the mature phase; the key to the door at twenty-one, the vote at eighteen, and admission to married status are society's ways of marking it. In old age we tend to distance ourselves from the senses, or Intending. We combine Attending with re-discovered Adapting, creating Remoteness, the final Inner Attitude celebrated in burial rites.")
    .replace(/Weight\^Time-stress=NEAR MOBILE=Flow\+T ime-stress Weight\+Space-stress=STABLE REMOTE=Flow\+Space- stress/g, "Weight plus Time-stress gives Near. Flow plus Time-stress gives Mobile. Weight plus Space-stress gives Stable. Flow plus Space-stress gives Remote.")
    .replace(/Weight\+Time = Near Stable = Weight\+Space Flow \+Time = Mobile Remote = Flow \+Space/g, "Weight plus Time equals Near. Weight plus Space equals Stable. Flow plus Time equals Mobile. Flow plus Space equals Remote.")
    .replace(/Flow \+ Weight = Adream Remote = Flow \+ Space Time \+ Weight = Near Awake = Time \+ Space/g, "Flow plus Weight equals Adream. Flow plus Space equals Remote. Time plus Weight equals Near. Time plus Space equals Awake.")
    .replace(/Space \+ Weight = Stable Awake = Space \+ Time\s+Flow \+ Weight = Adream Mobile = Flow \+ Time/g, "Space plus Weight equals Stable. Space plus Time equals Awake. Flow plus Weight equals Adream. Flow plus Time equals Mobile.")
    .replace(/Space \+ Weight = Stable Near = Time \+ Weight\s+Space \+ Flow = Remote Mobile\s*= Time \+ Flow/g, "Space plus Weight equals Stable. Time plus Weight equals Near. Space plus Flow equals Remote. Time plus Flow equals Mobile.")
    .replace(/Time \+ Weight = Near Awake = Time \+ Space\s+Flow \+ Weight = Adream Remote = Flow \+ Space/g, "Time plus Weight equals Near. Time plus Space equals Awake. Flow plus Weight equals Adream. Flow plus Space equals Remote.")
    .replace(/Strong\/Sustained \+ Direct Adapting = Pressing Strong\/Sustained \+ Flexible Adapting = Wringing/g, "Strong/Sustained plus Direct Adapting gives Pressing. Strong/Sustained plus Flexible Adapting gives Wringing.")
    .replace(/Near = Intending \(Red\) \+ Deciding \(Neutral\) -> Red\s+Remote = Attending \(Blue\) \+ Adapting \(Green\) -> Turquoise\s+Adream = Intending \(Red\) \+ Adapting \(Green\) -> Orange\s+Awake = Attending \(Blue\) \+ Deciding \(Neutral\) -> Blue\s+Stable = Intending \(Red\) \+ Attending \(Blue\) -> Purple\s+Mobile = Adapting \(Green\) \+ Deciding \(Neutral\) -> Green/g, "The Attitude colours are as follows. Near is Intending, red, plus Deciding, neutral, which gives red. Remote is Attending, blue, plus Adapting, green, which gives turquoise. Adream is Intending, red, plus Adapting, green, which gives orange. Awake is Attending, blue, plus Deciding, neutral, which gives blue. Stable is Intending, red, plus Attending, blue, which gives purple. Mobile is Adapting, green, plus Deciding, neutral, which gives green.")
    .replace(/The choice is between: Strong\/Direct\/Quick Punching\s+Strong\/Flexible\/Quick Slashing\s+Strong\/Direct\/Sustained Pressing\s+Strong\/Flexible\/Sustained Wringing/g, "The choice is between Strong/Direct/Quick, which gives Punching; Strong/Flexible/Quick, which gives Slashing; Strong/Direct/Sustained, which gives Pressing; and Strong/Flexible/Sustained, which gives Wringing.")
    .replace(/Thus: Near Strong\/Quick: Punching \(with Direct Space\) and Slashing \(with Flexible Space\) Near Light\/Sustained: Floating \(with Flexible Space\) and Gliding \(with Direct Space\) Near Strong\/Sustained: Pressing \(with Direct Space\) and Wringing \(with Flexible Space\) Near Light\/Quick: Dabbing \(with Direct Space\) and Flicking \(with Flexible Space\)/g, "Thus, Near Strong/Quick gives Punching with Direct Space and Slashing with Flexible Space. Near Light/Sustained gives Floating with Flexible Space and Gliding with Direct Space. Near Strong/Sustained gives Pressing with Direct Space and Wringing with Flexible Space. Near Light/Quick gives Dabbing with Direct Space and Flicking with Flexible Space.")
    .replace(/The Variations of Near are: Variation Subconscious Motif Strong\/Quick \('materialistic'\) Punching\/Slashing\s+Light\/Sustained \('human'\) Floating\/Gliding\s+Strong\/Sustained \('warm'\) Pressing\/Wringing\s+Light\/Quick \('cool'\) Dabbing\/Flicking "? Near characters/g, "The Variations of Near are: Strong/Quick, materialistic, with Punching and Slashing; Light/Sustained, human, with Floating and Gliding; Strong/Sustained, warm, with Pressing and Wringing; and Light/Quick, cool, with Dabbing and Flicking.\n\nNear characters")
    .replace(/The Variations of Adream are: Variation Subconscious Motif Strong\/Bound \("sombre"\) Punching\/Pressing\s+Light\/Free \("\s*irradiant"\) Floating\/Flicking\s+Strong\/Free \("overpowering"\) Wringing\/Slashing\s+Light\/Bound:? \("diffused"\) Gliding\/Dabbing The Fusions of Adream are: Strong\/Bound going Strong\/Free Pressing going Slashing Light\/Bound going Light\/Free Gliding going Flicking"? Adream is/g, "The Variations of Adream are: Strong/Bound, sombre, with Punching and Pressing; Light/Free, irradiant, with Floating and Flicking; Strong/Free, overpowering, with Wringing and Slashing; and Light/Bound, diffused, with Gliding and Dabbing. The Fusions of Adream are Strong/Bound going Strong/Free, or Pressing going Slashing, and Light/Bound going Light/Free, or Gliding going Flicking.\n\nAdream is")
    .replace(/The Variations of Awake are: Variation Subconscious Motif Direct\/Quick \("acute"\) Punching\/Dabbing\s+Flexible\/Sustained \("doubting"\) Floating\/Wringing\s+Direct\/Sustained \("certain"\) Pressing\/Gliding\s+Flexible\/Quick \("uncertain"\) (?:Flicking\/S\s+1|gives Flicking and Slashing\.)\s+Awake is/g, "The Variations of Awake are: Direct/Quick, acute, with Punching and Dabbing; Flexible/Sustained, doubting, with Floating and Wringing; Direct/Sustained, certain, with Pressing and Gliding; and Flexible/Quick, uncertain, with Flicking and Slashing.\n\nAwake is")
    .replace(/The Variations of Stable are: Variation Subconscious Motifs Strong\/Direct \("commanding"\) Punching\/Pressing\s+Light\/Flexible \("receptive"\) Floating\/Flicking\s+Strong\/Flexible \("practical"\) Wringing\/S\s*lashing\s+Light\/Direct \("self-contained"\) (?:Gliding\/Dabbing"\s+1|gives Gliding and Dabbing\.)\s+Stable is/g, "The Variations of Stable are: Strong/Direct, commanding, with Punching and Pressing; Light/Flexible, receptive, with Floating and Flicking; Strong/Flexible, practical, with Wringing and Slashing; and Light/Direct, self-contained, with Gliding and Dabbing.\n\nStable is")
    .replace(/The Variations of Mobile are: Variation Subconscious Motif Quick\/Bound \(unacknowledged\) Punching\/Slashing\s+Sustained\/Free \(acknowledged\) Floating\/Gliding\s+Quick\/Free \(revealed\) Dabbing\/Flicking\s+Sustained\/Bound \(concealed\) Pressing\/Wringing The Fusions of Mobile are: Quick\/Bound going Quick\/Free Slashing going Dabbing Sustained\/Bound going Sustained\/Free Wringing going Gliding '? Mobile is/g, "The Variations of Mobile are: Quick/Bound, unacknowledged, with Punching and Slashing; Sustained/Free, acknowledged, with Floating and Gliding; Quick/Free, revealed, with Dabbing and Flicking; and Sustained/Bound, concealed, with Pressing and Wringing. The Fusions of Mobile are Quick/Bound going Quick/Free, or Slashing going Dabbing, and Sustained/Bound going Sustained/Free, or Wringing going Gliding.\n\nMobile is")
    .replace(/\bEach Inner Attitude is revealed in our movements \(expression\) as a compound of two Elements\."\s+The names/g, "Each Inner Attitude is revealed in our movements (expression) as a compound of two Elements.\n\nThe names")
    .replace(/Externalized Drives Cubes\s+1\s+The cubes/g, "Externalized Drives Cubes\n\nThe cubes")
    .replace(/\n?1 The cubes are graphic representations/g, "\n\nExternalized Drives Cubes\n\nThe cubes are graphic representations")
    .replace(/Here is how they are constructed: a\. To make/g, "Here is how they are constructed. First, to make")
    .replace(/ b\. One of/g, " Second, one of")
    .replace(/ c\. Each of/g, " Third, each of")
    .replace(/ d\. Each of/g, " Fourth, each of")
    .replace(/ e\. The lines/g, " Fifth, the lines")
    .replace(/ f\. The process/g, " Sixth, the process")
    .replace(/ g\. The end result/g, " Seventh, the end result")
    .replace(/Strong\/Direct produces Pressing and Punching Strong\/Flexible produces Wringing and Slashing Fourth/g, "Strong/Direct produces Pressing and Punching. Strong/Flexible produces Wringing and Slashing. Fourth")
    .replace(/\bFusions\s+2\s+Therefore\b/g, "Fusions. Therefore")
    .replace(/diagonals of Fusions\. Therefore/g, "diagonals of Fusions; therefore")
    .replace(/one of the Drives has the upper hand\s+1\s+trans\.[\s\S]*?\(Zakhar\)\./g, "one of the Drives has the upper hand.")
    .replace(/upper hand\.\s+but the other/g, "upper hand, but the other")
    .replace(/Stable is thus formed' by/g, "Stable is thus formed by")
    .replace(/Following this reasoning, the system shows that: STABLE is formed at the confluence of DOING and SPELL\s+MOBILE is formed at the confluence of PASSION and VISION\s+NEAR is formed at the confluence of DOING and PASSION\s+REMOTE is formed at the confluence of SPELL and VISION\s+ADREAM is formed at the confluence of PASSION and SPELL\s+AWAKE is formed at the confluence of DOING and VISION/g, "Following this reasoning, the system shows that Stable is formed at the confluence of Doing and Spell. Mobile is formed at the confluence of Passion and Vision. Near is formed at the confluence of Doing and Passion. Remote is formed at the confluence of Spell and Vision. Adream is formed at the confluence of Passion and Spell. Awake is formed at the confluence of Doing and Vision.")
    .replace(/which we discussed regarding the formation of Attitudes also apply to the Externalized Drives\.[\s\S]*?in the case of Stable we have the pairs Near\/Remote and Awake\/Adream as the Action Attitudes\./g, "which we discussed regarding the formation of Attitudes also apply to the Externalized Drives. The choice of Drive in the face of an outside provocation depends on which of the Mental Factors the Character has developed well and on which he has suppressed.")
    .replace(/Construction of the Diagrams The diagrams are constructed/g, "Construction of the Diagrams\n\nThe diagrams are constructed")
    .replace(/therefore the Adream diagram can serve as a model: a\. we start/g, "therefore the Adream diagram can serve as a model. First, we start")
    .replace(/^b\. we write/gm, "Second, we write")
    .replace(/^c\. we write/gm, "Third, we write")
    .replace(/^d\. we then add/gm, "Fourth, we then add")
    .replace(/In Adream we thus have a diagram each for: e\. The combination/g, "In Adream we thus have a diagram for each type. Fifth, the combination")
    .replace(/f\. Here Yat Malmgren introduces/g, "Sixth, Yat Malmgren introduces")
    .replace(/g\. we now determine/g, "Seventh, we now determine")
    .replace(/The Externalized Drives are derived as follows: i\. For the two/g, "The Externalized Drives are derived as follows. First, for the two")
    .replace(/ii\. In order to determine/g, "Second, in order to determine")
    .replace(/Thus the h\. finally, we draw/g, "Finally, we draw")
    .replace(/1 i\.e\. the Inner Participation written furthest from the joint of the X\.\s+/g, "")
    .replace(/\s+\(Tapes:\s*39-4\/5\)/g, "")
    .replace(/\bFlowstressed\b/g, "Flow-stressed")
    .replace(/\bFlowstress\b/g, "Flow-stress")
    .replace(/\bPassion-\s+Vision\b/g, "Passion-Vision")
    .replace(/\bSpell-\s+Vision\b/g, "Spell-Vision")
    .replace(/\bgoing-\s+away\b/g, "going away")
    .replace(/They enable the practitioner to see at a glance: a\. the Inner and Outer Character Drives \(marked with a \/ in the text\) b\. the Action axis of Drives \(marked with a - in the text\) c\. the different Variations opened to the character d\. the Inner and Outer actions, with their respective 'linings' e\. the Aspects and Stresses\./g, "They enable the practitioner to see at a glance the Inner and Outer Character Drives, marked with a slash in the text; the Action axis of Drives, marked with a hyphen in the text; the different Variations opened to the character; the Inner and Outer Actions, with their respective linings; and the Aspects and Stresses.")
    .replace(/Yelena in "Uncle Vanya" is Adream, but in a Remote state in the speech which starts: "He's not in love with her\.\.\.\." \(Act II\)\. Under the Remote Outer Action is her Near Attraction to the doctor and the thought of Sonya as a rival\. - Lorca's "Dona Rosita The Spinster": "I have got used to living outside myself\.\.\." - Ibsen: "The Master Builder" - Mrs\. Solness: "Oh, no, no Miss Wangel\. Don't talk to me any more about the two little boys\.\.\." - again the emotional drive towards the past - Remote\./g, "Yelena in \"Uncle Vanya\" is Adream, but in a Remote state in the speech which starts: \"He's not in love with her...\" (Act II). Under the Remote Outer Action is her Near Attraction to the doctor and the thought of Sonya as a rival. Lorca's \"Dona Rosita The Spinster\" gives another example: \"I have got used to living outside myself...\" Ibsen's \"The Master Builder\" offers Mrs. Solness: \"Oh, no, no Miss Wangel. Don't talk to me any more about the two little boys...\" Again, the emotional drive towards the past is Remote.")
    .replace(/In "Twelfth Night" Yat Malmgren considers that the play's main characters divide between four Adream and four Near types: Orsino and Olivia Adream enclosing Viola and Sebastian Adream radiating Andrew Aguecheek and Malvolio Near circumscribing Feste and Toby Belch Near enclosing This seems/g, "In \"Twelfth Night\" Yat Malmgren considers that the play's main characters divide between four Adream and four Near types. Orsino and Olivia are Adream enclosing; Viola and Sebastian are Adream radiating; Andrew Aguecheek and Malvolio are Near circumscribing; Feste and Toby Belch are Near enclosing. This seems")
    .replace(/In "Measure for Measure", for example, the division is: Duke and Claudio Adream enclosing Isabella and Angelo Adream radiating Escalus and Mrs\. Overdone Near enclosing Lucio and Juliet Near circumscribing Equally, in "Othello": Othello and Bianca Adream enclosing Desdemona and Cassio Adream radiating Iago and Brabantio Near enclosing Emilia and Roderigo Near circumscribing This is not/g, "In \"Measure for Measure\", for example, the division is: Duke and Claudio are Adream enclosing; Isabella and Angelo are Adream radiating; Escalus and Mrs. Overdone are Near enclosing; Lucio and Juliet are Near circumscribing. Equally, in \"Othello\": Othello and Bianca are Adream enclosing; Desdemona and Cassio are Adream radiating; Iago and Brabantio are Near enclosing; Emilia and Roderigo are Near circumscribing. This is not")
    .replace(/Thus we have: The Adream triangle of Hedda - Lovborg - Brack, at once fascinating and repelling the Near triangle of Tesman - Mrs\. Elvsted - Bertha\./g, "Thus we have the Adream triangle of Hedda, Lovborg, and Brack, at once fascinating and repelling the Near triangle of Tesman, Mrs. Elvsted, and Bertha.")
    .replace(/\btendency to 'distributes the\b/g, "tendency to distribute the")
    .replace(/^([a-e])\. (Incomplete Efforts|Inner Attitudes|Variations and Fusions|Action Attitudes|Attitude Cubes|General|The Four Externalized Drives|Externalized Drives Cubes|The Diagrams of the Inner Attitudes|Externalized Drives Cubes) /gm, "$2\n\n")
    .replace(/^([a-e])\. (Incomplete Efforts|Inner Attitudes|Variations and Fusions|Action Attitudes|Attitude Cubes|General|The Four Externalized Drives|Externalized Drives Cubes|The Diagrams of the Inner Attitudes|Externalized Drives Cubes)$/gm, "$2")
    .replace(/"What! fifty followers at a clap, Within a fortnight\?"\s+1\s+1,,\.-19\s+Space, allows/g, "\"What! fifty followers at a clap, Within a fortnight?\" Space-stress allows")
    .replace(/What! fifty followers at a clap, Within a fortnight\?"\s+1\s+1\s*,,\.-19\s+Space, allows/g, "What! fifty followers at a clap, Within a fortnight?\" Space-stress allows")
    .replace(/Flexible\/Quick \("uncertain"\) Flicking\/S\s+1\s+Awake is/g, "Flexible/Quick (\"uncertain\") gives Flicking and Slashing.\n\nAwake is")
    .replace(/Light\/Direct \("self-contained"\) Gliding\/Dabbing"\s+1\s+Stable is/g, "Light/Direct (\"self-contained\") gives Gliding and Dabbing.\n\nStable is")
    .replace(/As we have mentioned before,\s+2\s+Super-Objectives/g, "As we have mentioned before, Super-Objectives")
    .replace(/\bDrum-\s+Major\b/g, "Drum-Major")
    .replace(/I'll-\s*P-\.\.\./g, "I'll...")
    .replace(/"you're so nice to invite me"\.\./g, "\"you're so nice to invite me...\"")
    .replace(/Do Caesar what he can\.\s+\.\s+\.\./g, "Do Caesar what he can...\"")
    .replace(/Do Caesar what he can\.\.\.\./g, "Do Caesar what he can...\"")
    .replace(/and yet his pride becomes him\.\.\.\.\s+'/g, "and yet his pride becomes him...\"")
    .replace(/and yet his pride becomes him\.\.\.\.'/g, "and yet his pride becomes him...\"")
    .replace(/Should make thee worth them\.\s+"\s+"\.{4}\s+Thou shalt find That I '\s+resume/g, "Should make thee worth them. Thou shalt find that I'll resume")
    .replace(/Slashing\.TM When/g, "Slashing. When")
    .replace(/1 written corrections 2 written corrections The Subconscious Motifs/g, "The Subconscious Motifs")
    .replace(/Dabbing and Flicking" successful date\. Here/g, "Dabbing and Flicking. Here")
    .replace(/Cressida's thought process revolves around three elements: a\. what Pandarus has to offer b\. what Troilus represents c\. is she right in choosing Troilus\?/g, "Cressida's thought process revolves around three elements: what Pandarus has to offer, what Troilus represents, and whether she is right in choosing Troilus.")
    .replace(/next section\s+2\s+they combine/g, "next section, they combine")
    .replace(/\s+- the "Book" therefore/g, " The \"Book\" therefore")
    .replace(/\s+- as we have seen/g, " As we have seen")
    .replace(/\s+- therefore each Variation/g, " Therefore each Variation")
    .replace(/\s+- the line joining/g, " The line joining")
    .replace(/\s+- the four lines/g, " The four lines")
    .replace(/\s+- on the "Attitude Cubes"/g, " On the \"Attitude Cubes\"")
    .replace(/^"The four mental states are/gm, "The four mental states are")
    .replace(/Psychological Type -> Super-objective -> Externalized Drives, inner ->\s+-> Inner Attitude -> Externalized Drives, outer -> Action Attitudes/g, "The sequence is: psychological type, then Super-Objective, then inner Externalized Drives, then Inner Attitude, then outer Externalized Drives, then Action Attitudes.")
    .replace(/"confluence"\s+2\s+of/g, "\"confluence\" of")
    .replace(/\s*->\s*/g, " to ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([.!?]"?)\s+[0-9]{1,2}\s+(?=[A-Z])/g, "$1 ")
    .replace(/"endowed"\s+[0-9]{1,2}\s+the/g, "\"endowed\" the")
    .replace(/Intuiting\s+\./g, "Intuiting.")
    .replace(/asking 'what is this character like\? More often/g, "asking: \"what is this character like?\" More often")
    .replace(/"\s+;/g, "\";")
    .replace(/\.\s+\./g, ".")
    .replace(/"Quick Deciding - an intuitive urge to the future\. The duration/g, "\"Quick Deciding - an intuitive urge to the future.\" The duration")
    .replace(/\n\n?Time and this is a totally different perception of time from the reckoning of the number of elapsed seconds in the pressing action\."\n?/g, "\n\n")
    .replace(/emotions through our 'veins' Actors/g, "emotions through our 'veins'. Actors")
    .replace(/can neither "adapt" internally to his emotions or "relate"/g, "can neither \"adapt\" internally to his emotions nor \"relate\"")
    .replace(/'contacts' in the paper as a result he does not absorb/g, "'contacts' in the paper; as a result he does not absorb")
    .replace(/desolate\.\.\.\.Seek/g, "desolate... Seek")
    .replace(/mouth\.\.\.And/g, "mouth... And")
    .replace(/^\* \* \*$/gm, "")
    .replace(/"\s+$/gm, "\"")
    .replace(/([.!?])\s+(['"])(?=\s|$)/g, "$1$2");

  out = out.replace(
    /To recapitulate - Yat Malmgren considers that there are four levels in the Character-Action continuum, which correspond to four Stanislavskian or Jungian concepts: Inner Character corresponds to 'character essence' or Psychological type\s+Outer Character corresponds to professional or other 'persona'\s+Inner Action corresponds to character thought-process\s+Outer Action corresponds to physical and psychological activities\s+/,
    "To recapitulate: Yat Malmgren considers that there are four levels in the Character-Action continuum, which correspond to four Stanislavskian or Jungian concepts. Inner Character corresponds to 'character essence' or psychological type. Outer Character corresponds to professional or other 'persona'. Inner Action corresponds to character thought-process. Outer Action corresponds to physical and psychological activities. "
  );

  out = out.replace(
    /Grand Equation\s*\n\nMental Inner Motion Inner Factor Participation Factor Yielding \(Negative\) Contending: Quest sensing > intending > weight > light \(heavy\) strong: what\?\s+thinking > attending > space > flexible \(adrift\) direct: where\?\s+intuiting > deciding > time > sustained \(indecisive\) quick: when\?\s+feeling > adapting > flow > free \(irrelated\) bound: why\?/,
    "Grand Equation\n\nThe Grand Equation can be read as follows.\n\nSensing becomes intending, expresses itself as weight, yields as light, has heavy as its negative, contends as strong, and asks the quest: what?\n\nThinking becomes attending, expresses itself as space, yields as flexible, has adrift as its negative, contends as direct, and asks the quest: where?\n\nIntuiting becomes deciding, expresses itself as time, yields as sustained, has indecisive as its negative, contends as quick, and asks the quest: when?\n\nFeeling becomes adapting, expresses itself as flow, yields as free, has irrelated as its negative, contends as bound, and asks the quest: why?"
  );

  out = out
    .replace(
      /"The Mental Factors\s+sensing\s+thinking\s+intuiting\s+feeling\s+the four psychological concepts\."/,
      "\"The Mental Factors are sensing, thinking, intuiting, and feeling: the four psychological concepts.\""
    )
    .replace(
      /"The Inner Participations intending attending deciding adapting\s+revealed in our movements by the Motion Factors of weight, space, time, and flow respectively\."/,
      "\"The Inner Participations are intending, attending, deciding, and adapting, revealed in our movements by the Motion Factors of weight, space, time, and flow respectively.\""
    );

  out = out.replace(
    /The two sets of concepts are linked thus: Weight is the physical expression of Intending \(Sensing\) Space is the physical expression of Attending \(Thinking\) Time is the physical expression of Deciding \(Intuiting\) Flow is the physical expression of Adapting \(Feeling\) For Laban/,
    "The two sets of concepts are linked thus: Weight is the physical expression of Intending, or Sensing. Space is the physical expression of Attending, or Thinking. Time is the physical expression of Deciding, or Intuiting. Flow is the physical expression of Adapting, or Feeling. For Laban"
  );

  out = out.replace(
    /"The four factors of Weight, Space, Time and Flow into which all movement \(expression\) can be analysed, and which express the four Mental Factors of Sensing, Thinking, Intuiting, and Feeling \(respectively\)\.\s+Each Motion Factor is sub-divided into two elements, which yield with or contend against the factors\."/,
    "\"The four factors of Weight, Space, Time and Flow into which all movement (expression) can be analysed, and which express the four Mental Factors of Sensing, Thinking, Intuiting, and Feeling (respectively). Each Motion Factor is sub-divided into two elements, which yield with or contend against the factors.\""
  );

  out = out
    .replace(/play\."\s+Attention, intention/g, "play. \"Attention, intention")
    .replace(/with which it reacts to the Objective in different forms of "towards" and "away from": - Intending represents a sensuous attracting \(energy towards\) or repelling \(energy away from\) of the Objective\. - Attending is a cerebral approving \(energy towards\) or denying \(energy away from\) an Objective\. - Adapting is an emotional liking \(energy towards\) or disliking \(energy away from\) an Objective\./g, "with which it reacts to the Objective in different forms of \"towards\" and \"away from\". Intending represents a sensuous attracting (energy towards) or repelling (energy away from) of the Objective. Attending is a cerebral approving (energy towards) or denying (energy away from) an Objective. Adapting is an emotional liking (energy towards) or disliking (energy away from) an Objective.")
    .replace(/four concentric 'spheres,/g, "four concentric 'spheres',")
    .replace(/It does, however provide/g, "It does, however, provide");

  out = out.replace(
    /From the outside, Flow registers as the presence or absence of 'relaxation' or as the "(?:fluency" of|fluency of) a Character's movements\.\s+It must be remembered/,
    "From the outside, Flow registers as the presence or absence of 'relaxation' or as the \"fluency\" of a Character's movements.\n\nFaust, in love, would like to make time stand still. His body oozes happiness, his joints are oily, his movements \"flow\". The flow is unimpeded, like the light gurgling passage of wine from a Spanish goat skin into the gullet. The flow is Free: easy, pleasant. The sensation of Free Flow is that of a constant, homogenous mass moving slowly downhill. It is, says Yat Malmgren, like a good French sauce, free of even the suggestion of lumps.\n\nBound Flow, on the other hand, is jerky, quick, tight. \"I am on the tube without a ticket and the controller calls 'tickets please!'\" - Yat Malmgren imagines. \"I jump, the stomach muscles tighten, the adrenaline flows, the heart beats harder\" - Bound Flow. \"I drive too fast and am stopped by the Police. I get out of the car full of swagger: 'What's this about?'; 'You were going too fast'; 'ME?'\" The body jerks, the chin goes forward, the shoulders lift - Bound Flow, full of disguised aggression. The sensation of Bound Flow is unpleasant, like thick, warm, sulphurous lava moving reluctantly downhill. Hence Carpenter describes it as \"viscid\", that is sticky or semi-fluid.\n\nA mistake often encountered among students of movement is to identify Bound Flow with 'dead' movement, inaction and immobility. Nothing could be further from the truth: Bound Flow is still a form of motion. What is more, it is a very important element of expression, as, in combination with other Motion Factors, it creates restrained, under-played movements. Bound Flow is the result of a mental state which applies caution, circumspection to action, but is an active Motion Factor for all that.\n\nFlow thus measures and describes the mechanical degree of viscosity necessary to perform practical actions. To differentiate it from the Bound Flow induced by negative emotions, Yat Malmgren calls this normal, mechanical tightening of the muscles and joints, industrial Bound Flow.\n\nIt must be remembered"
  );

  out = out.replace(
    /"The kinetic Motion Factor which expresses the Mental Factor of Thinking and the Inner Participation of Attending; the reflection of thoughtful I the examples are mine movements in one or more planes of space - subdivided into the elements of Flexible and Direct\./,
    "\"The kinetic Motion Factor which expresses the Mental Factor of Thinking and the Inner Participation of Attending; the reflection of thoughtful movements in one or more planes of space - subdivided into the elements of Flexible and Direct.\""
  );

  out = out.replace(
    /moving on two mirroring trajectories or 'rings': a\. extravert energy, moving away from the actor towards the outer and recovering back into the centre\. Intuitively, we experience this energy as moving 'forward' in space, towards the 'future' in time and 'upwards' in weight \(against gravity\)\. b\. introvert energy, going inwards towards the innermost part of the Character and then returning \(recovering\) to the centre\. This energy will 'feel' intuitively as moving 'backwards' in space, towards the 'past' in time and 'downwards' in weight \(giving in to the gravitational pull\)\./,
    "moving on two mirroring trajectories or 'rings'. The first is extravert energy, moving away from the actor towards the outer and recovering back into the centre. Intuitively, we experience this energy as moving 'forward' in space, towards the 'future' in time and 'upwards' in weight, against gravity. The second is introvert energy, going inwards towards the innermost part of the Character and then returning, or recovering, to the centre. This energy will 'feel' intuitively as moving 'backwards' in space, towards the 'past' in time and 'downwards' in weight, giving in to the gravitational pull."
  );

  out = out.replace(
    /Following Jung's categories, Laban and Malmgren define four types of 'pressing out' and, crucially, connect them to four physical dimensions through which the movement of energy, internal as well as physical, can be observed and, eventually, measured: a\. Sensing 'presses out' the sensuous energy of Weight, creating movement with or against gravity\. b\. Thinking 'ex-presses' itself as mental energy 'travelling' through Space\. Thought 'moves', creating bodily movement in space\. c\. Intuition 'ex-presses' temporal relationships, creating connections between past and future, with the movement occurring in Time\. d\. Feeling 'presses out' emotional energy, which pervades all other forms of movement and is perceived as co-ordination or Flow\./,
    "Following Jung's categories, Laban and Malmgren define four types of 'pressing out' and, crucially, connect them to four physical dimensions through which the movement of energy, internal as well as physical, can be observed and, eventually, measured. Sensing 'presses out' the sensuous energy of Weight, creating movement with or against gravity. Thinking 'ex-presses' itself as mental energy 'travelling' through Space. Thought 'moves', creating bodily movement in space. Intuition 'ex-presses' temporal relationships, creating connections between past and future, with the movement occurring in Time. Feeling 'presses out' emotional energy, which pervades all other forms of movement and is perceived as co-ordination or Flow."
  );

  out = out.replace(
    /describes a movement in two phases, one "receiving", the other "transmitting" energy': a\. we react to the impact of sensory stimulation with a "perception" which gives it meaning and b\. this in turn generates the action which "reveals" or expresses itself through outer movement\./,
    "describes a movement in two phases, one \"receiving\", the other \"transmitting\" energy. First, we react to the impact of sensory stimulation with a \"perception\" which gives it meaning. Second, this in turn generates the action which \"reveals\" or expresses itself through outer movement."
  );

  out = out.replace(
    /The Movement of energy is again in two phases: a\. the object is reflected by the psyche and the reflection causes a reasoning process which b\. leads eventually to the formation of ideas\./,
    "The movement of energy is again in two phases. First, the object is reflected by the psyche and the reflection causes a reasoning process. Second, this leads eventually to the formation of ideas."
  );

  out = out.replace(
    /We thus have two kinds of "decisions": a\. one creates the character's 'memories' of the place as well as his present transformation of the stage space into a 'reality' by connecting the clues of the play with the actor's own memories; b\. another connects these two sets of images, to allow the Character, as opposed to the actor, to make connections across the ten years which have elapsed since the last visit to Lemnos\./,
    "We thus have two kinds of \"decisions\". First, one creates the character's 'memories' of the place as well as his present transformation of the stage space into a 'reality' by connecting the clues of the play with the actor's own memories. Second, another connects these two sets of images, to allow the Character, as opposed to the actor, to make connections across the ten years which have elapsed since the last visit to Lemnos."
  );

  out = out.replace(
    /'Ideas' which induce Feeling to the extent that it dominates consciousness, operate in two phases: a\. the character surrenders to an idea, gives himself up to it entirely; b\. having adapted his whole existence to the idea, the character constructs a new reality with its help\./,
    "'Ideas' which induce Feeling to the extent that it dominates consciousness operate in two phases. First, the character surrenders to an idea, gives himself up to it entirely. Second, having adapted his whole existence to the idea, the character constructs a new reality with its help."
  );

  out = out.replace(
    /Long before his work with Carpenter, Laban formulates four basic questions to be asked of visible movement: a\. which part of the body is in motion and how does it co-ordinate with other parts of the body\? b\. what is the duration of the movement and in what relationship does it stand to the duration of other movements around it\? c\. how much muscular power is exerted in effecting the movement\? d\. which direction in space is the movement leading towards or away from\?/,
    "Long before his work with Carpenter, Laban formulates four basic questions to be asked of visible movement. Which part of the body is in motion, and how does it co-ordinate with other parts of the body? What is the duration of the movement, and in what relationship does it stand to the duration of other movements around it? How much muscular power is exerted in effecting the movement? Which direction in space is the movement leading towards or away from?"
  );

  out = out.replace(
    /Inner Participation Yielding Contending\s+INTENDING \(Weight\) Light Strong\s+ATTENDING \(Space\) Flexible Direct\s+DECIDING \(Time\) Sustained Quick\s+ADAPTING \(Flow\) Free Bound/,
    "The yielding and contending elements are as follows. Intending, or Weight: Light yields, and Strong contends. Attending, or Space: Flexible yields, and Direct contends. Deciding, or Time: Sustained yields, and Quick contends. Adapting, or Flow: Free yields, and Bound contends."
  );

  out = out.replace(
    /The relationship between inner life \(Mental Factors and Inner Participations\) and physical expression \(Motion Factors and Elements\) is summarized in the table below:\s+Mental F\. Inner P\. Motion F\. Element Physical Plane\s+Sensing Intending Weight Light Upwards Strong Downwards Thinking Attending Space Flexible Round-About Direct Round-About Intuiting Deciding Time Sustained Backward Quick Forward Feeling Adapting Flow Free Width-opening volume Bound Width-closing volume The concordance of Mental and Motion Factors/,
    "The relationship between inner life, meaning Mental Factors and Inner Participations, and physical expression, meaning Motion Factors and Elements, can be summarized as follows. Sensing becomes Intending and expresses Weight: Light moves upwards, and Strong moves downwards. Thinking becomes Attending and expresses Space: Flexible is round-about, and Direct is round-about. Intuiting becomes Deciding and expresses Time: Sustained moves backward, and Quick moves forward. Feeling becomes Adapting and expresses Flow: Free opens volume in width, and Bound closes volume in width. This is the concordance of Mental and Motion Factors."
  );

  out = out.replace(
    /They are: "What\? asked of\.\.\. Intending\s+Where\? asked of\.\.\. Attending\s+When\? asked of\.\.\. Deciding\s+Why\? asked of\.\.\. Adapting"\./,
    "They are: What? asked of Intending. Where? asked of Attending. When? asked of Deciding. Why? asked of Adapting."
  );

  out = out.replace(
    /The actor 'meditates' upon these from four different angles:\s+What\?: their material nature, including social background and circumstances; - Where\?: direction, including geographical location \(country, city, house, room\); - When\?: duration, including period, season, time of day; - Why\?: motivation, especially that rooted in emotions\./,
    "The actor 'meditates' upon these from four different angles. What: their material nature, including social background and circumstances. Where: direction, including geographical location - country, city, house, room. When: duration, including period, season, time of day. Why: motivation, especially that rooted in emotions."
  );

  out = out.replace(
    /The Inner Quests, Questions and Answers form a matrix into which an actor can fit his own individual answers, reflecting his work on particular characters and circumstances\. The matrix looks as follows: Basic Quest Question Latent Answer \(Intending\) What\? Which\? This That!\s+\(Attending\) Where\? Yonder\? Here There!\s+\(Deciding\) When\? Has Been\? Now Will be \(Adapting\) Why\? You\? None I!\s+Table of the Inner Quests/,
    "The Inner Quests, Questions and Answers form a matrix into which an actor can fit his own individual answers, reflecting his work on particular characters and circumstances. The matrix looks as follows. Intending asks the basic quest: what? Its question is: which? Its latent state is: this. Its answer is: that. Attending asks the basic quest: where? Its question is: yonder? Its latent state is: here. Its answer is: there. Deciding asks the basic quest: when? Its question is: has been? Its latent state is: now. Its answer is: will be. Adapting asks the basic quest: why? Its question is: you? Its latent state is: none. Its answer is: I. That is the table of the Inner Quests."
  );

  out = out.replace(
    /Working Action Weight Space Time\s+FLOATING light flexible sustained\s+FLICKING light flexible quick\s+GLIDING light direct sustained\s+DABBING light direct quick\s+WRINGING strong flexible sustained\s+SLASHING strong flexible quick\s+PRESSING strong direct sustained\s+PUNCHING strong direct quick/,
    "The Working Action table is as follows. Floating: light, flexible, sustained. Flicking: light, flexible, quick. Gliding: light, direct, sustained. Dabbing: light, direct, quick. Wringing: strong, flexible, sustained. Slashing: strong, flexible, quick. Pressing: strong, direct, sustained. Punching: strong, direct, quick."
  );

  out = out.replace(
    /Working Actions and Subconscious Motifs\s+The Working Action table is as follows\./,
    "Working Actions and Subconscious Motifs\n\nThe \"Book\" defines Working Actions and Subconscious Motifs as \"the eight basic actions, in which all consciously performed activities can be analysed. Compounded of the Motion Factors of Weight, Space, Time and industrial Free Flow, or co-ordination.\" As we have seen in the previous chapter, no physical movement is possible without at least a modicum of co-ordination: industrial Free Flow is always present in movement. The other Motion Factors assemble in different combinations of yielding and contending Elements. For example, Weight can be Light, or yielding, while Space and Time are contending, meaning Direct and Quick; or Weight and Space are yielding and Time is contending, and so on. These combinations of three Elements - one from each Motion Factor - create eight basic types of physical movement which Laban calls the Working Actions. Laban gives them names suggestive of their general qualities: a Strong, Direct and Quick movement is like a boxer's punch, hence Punching; a Light, Direct and Sustained movement reminds him of the waltz, so Gliding, and so on. In order, from the most yielding to the most contending, the eight Working Actions are as follows.\n\nThe Working Action table is as follows."
  );

  out = out.replace(
    /Punching: strong, direct, quick\.\s+The Working Actions are described as follows:/,
    "Punching: strong, direct, quick.\n\nDescribing physical gestures is difficult, however, even with Carpenter's suggestive choice of words. Yat Malmgren relies to a large extent on his students' physical experience of the Working Actions in movement exercises. The students are also helped by analogies with well known tunes which convey the essential rhythm of each Working Action and by physical and psychological activities associated with them.\n\nThe Working Actions are described as follows:"
  );

  out = out
    .replace(/The Working Actions are described as follows: FLOATING/g, "The Working Actions are described as follows:\n\nFLOATING")
    .replace(/"\s+(FLICKING|GLIDING|DABBING|SLASHING|PRESSING|PUNCHING)\s+\(/g, "\"\n\n$1 (")
    .replace(/'\s+(PRESSING|PUNCHING)\s+\(/g, "'\n\n$1 (")
    .replace(/\(Sustained\) are Pressing; those which are "sudden" \(Quick\) are Punching\./g, "(Sustained) are Pressing; those which are \"sudden\" (Quick) are Punching.")
    .replace(/a swing\* inwards/g, "a swing inwards")
    .replace(/"Did I\?; All right\?\./g, "\"Did I? All right?\"")
    .replace(/change of shape\.'/g, "change of shape.\"")
    .replace(/are Punching\.\s+Working Actions/g, "are Punching.\"\n\nWorking Actions")
    .replace(/These are: "under-stressed normal stressed over-stressed" Through them/g, "These are: under-stressed, normal, stressed, and over-stressed. Through them")
    .replace(/even with these crude measurements "there are 64 variants/g, "even with these crude measurements, there are 64 variants")
    .replace(/In the famous first scene in "Brief Encounter Trevor Howard/g, "In the famous first scene in \"Brief Encounter\", Trevor Howard")
    .replace(/Dabbing \(action towards her\) In consequence/g, "Dabbing (action towards her). In consequence")
    .replace(
      /Classified from this point of view, the Working Actions look like this: INTROVERT \(Preparation\) EXTRA VERT \(Execution\) Floating -> Flicking\s+Gliding -> Dabbing\s+Wringing -> Slashing\s+Pressing -> Punching Because/,
      "Classified from this point of view, the Working Actions look like this. Introvert preparation becomes extravert execution: Floating becomes Flicking. Gliding becomes Dabbing. Wringing becomes Slashing. Pressing becomes Punching.\n\nBecause"
    );

  out = out.replace(
    /"Sprites and goblins, whose movements are imagined to be sudden and direct and yet gentle, are often characterised in dabbing dances\."\s+SLASHING/,
    "\"Sprites and goblins, whose movements are imagined to be sudden and direct and yet gentle, are often characterised in dabbing dances.\"\n\nWRINGING (Strong/Flexible/Sustained) Tune: \"Nobody Knows The Trouble I Have Seen\". Physical Activity: wringing water out of a towel. Typical Wringing actions: to gouge, to twist. Wringing gives the feeling that it \"never stops\" - like the turn of a vice. It is a twisting, spiral movement. Mary Wigman's ballet students practised an exercise which consisted in being 'screwed into the floor', creating Bound Flow, then rising, 'unscrewing' the body out of the floor with a Free Flowing, 'endless' movement. \"Wringing gods' movements would be flexible and speak of the gradual passage of time, yet they would be strong and firm.\"\n\nSLASHING"
  );

  out = out.replace(
    /sequence of movements\.\s+Subconscious Motif gives rise to a Pressing Working Action;/,
    "sequence of movements.\n\nWorking Actions are often misunderstood because of the association of 'working' with mundane physical actions: dusting, scrubbing, nailing are the 'actions' which come readily to mind. These kinds of working actions place the mover in contact with the immediate object (tool): the duster, scrubbing brush, etc. He therefore feels that he is doing something to the duster or to the brush and that the Working Action stops at the physical gesture. In fact, the movement of the fist punching the table is the product of an inner \"Punch\" - of an inner cocktail of Strong Intending, Direct Attending and Quick Deciding, exercised either towards or away from an Objective. The inner Working Action is then coloured, 'informed' by the presence of inner (as opposed to \"industrial\") Flow. Bound Flow causes the punch to be assertive, aggressive - a blow. Free Flow, on the other hand, creates a determined, loving punch, full of desire - a sharp hug, perhaps, or a brisk, expectant opening of doors. Yat Malmgren therefore insists that the Working Actions do not refer exclusively to physical gestures; in fact, in acting they are more often heard in the inflections of the voice than seen in gestures. Ideally, the revelation of Working Actions should occur both in the voice and in the body. Thus a Slashing can come across as a winding, insistent, drawn \"go on!\" urging someone to do something, accompanied perhaps by a flexible turn of the lower arms and wrists. Laban and Malmgren consider that the inner impulse has the same shape as the outer movement and therefore are analysed through the Elements of Inner Participations in the same way that Working Actions can be analysed through the Elements of Motion Factors. However, to emphasize the psychological nature of the inner impulse, and to avoid confusion in the terminology, these inner counterparts of the Working Actions are called Subconscious Motifs. They bear the same individual names as the Working Actions: a Pressing Subconscious Motif gives rise to a Pressing Working Action;"
  );

  out = out.replace(
    /Their classification according to the predominant Element looks as follows:\s+Weight Space Time\s+Light Strong Flexible Direct Sustained Quick\s+Floating Wringing Floating Gliding Floating Flicking\s+Flicking Slashing Wringing Pressing Gliding Dabbing\s+Gliding Pressing Slashing Punching Wringing Slashing\s+Dabbing Punching Flicking Dabbing Pressing Punching In listing/,
    "Their classification according to the predominant Element can be read as follows. By Weight, Light includes Floating, Flicking, Gliding, and Dabbing; Strong includes Wringing, Slashing, Pressing, and Punching. By Space, Flexible includes Floating, Wringing, Slashing, and Flicking; Direct includes Gliding, Pressing, Punching, and Dabbing. By Time, Sustained includes Floating, Gliding, Wringing, and Pressing; Quick includes Flicking, Dabbing, Slashing, and Punching. In listing"
  );

  out = out
    .replace(/Graphically, this centre note is represented by a central horizontal plane \(Laban calls it the 'table' plane\), which divides the kinesphere into two: - Light Weight is situated upwards of this plane\. - Strong Weight is situated downwards of this plane\./g, "Graphically, this centre note is represented by a central horizontal plane (Laban calls it the 'table' plane), which divides the kinesphere into two. Light Weight is situated upwards of this plane. Strong Weight is situated downwards of this plane.")
    .replace(/Thus, in a right-handed action, that is when the Character directs his actions towards a contact on his right diagonals: - Flexible Space is situated left, in the 'introvert' part of the kinesphere\. - Direct Space is situated right, in the 'extravert' part of the kinesphere\./g, "Thus, in a right-handed action, that is when the Character directs his actions towards a contact on his right diagonals, Flexible Space is situated left, in the 'introvert' part of the kinesphere. Direct Space is situated right, in the 'extravert' part of the kinesphere.")
    .replace(/kinesphere\.\. Either side of the 'wheel' plane: - Sustained Time is situated backwards\. - Quick Time is situated forwards\./g, "kinesphere. On either side of the 'wheel' plane, Sustained Time is situated backwards and Quick Time is situated forwards.")
    .replace(/\("I MIGHT do it\. "\)/g, "(\"I MIGHT do it.\")")
    .replace(/Backward\. \(LHB\)/g, "Backward, or LHB.")
    .replace(/well': Weight/g, "well: Weight")
    .replace(/"to hammer" could not be done/g, "\"to hammer\" could be done")
    .replace(/you would not like to have the action done to you\. '/g, "you would not like to have the action done to you.\"")
    .replace(/you would not like to have the action done to you\.'/g, "you would not like to have the action done to you.\"")
    .replace(/these verbs they are meant/g, "these verbs: they are meant")
    .replace(/\bsquirrellike\b/g, "squirrel-like")
    .replace(/centre-note'\. With Light/g, "centre-note'. With Light")
    .replace(/'convex' \./g, "'convex'.")
    .replace(/demeanour\. "/g, "demeanour.\"")
    .replace(/as the "fluency of a Character's movements\./g, "as the \"fluency\" of a Character's movements.")
    .replace(/with less\) Finally/g, "with less). Finally")
    .replace(/movement"\.\.\. In addition/g, "movement.\" In addition")
    .replace(/affect me!"\./g, "affect me!\"")
    .replace(/inside him and the circulation/g, "inside him, and the circulation")
    .replace(/clock\.\./g, "clock.");

  out = out.replace(
    /The difference between inner and "industrial" Flow is epitomized for him by the difference between the genuine inner grace of a person full of spirituality \(Mother Theresa springs to mind\) and the artificial 'graceful'\s+The relationship between inner life/,
    "The difference between inner and \"industrial\" Flow is epitomized for him by the difference between the genuine inner grace of a person full of spirituality (Mother Theresa springs to mind) and the artificial 'graceful' movements of a classical dancer. \"Industrial\" Free Flow is the ability to carry out a physical task or series of tasks without necessarily establishing a link with the emotions. We do not scrub floors with Feeling - yet co-ordination is necessary. We adapt instinctively to produce exactly the necessary amount of Intending, Attending and Deciding to carry out a given task: move a piano, shift a canvas bag. If the canvas bag has a stage weight inside, or the piano is hollow, we are shocked, surprised and have to adjust our Adapting. This ability to adapt to physical reality is described as \"industrial\" Free Flow or co-ordination. It is the product of experience, which has taught us to measure things subconsciously and to adapt to the task. Most of us remember the frustrations of learning to tie shoelaces: as children we could not do this relatively simple task, but, once mastered, we do it without thinking. In other words, \"industrial\" Free Flow belongs to the world of conditioned reflexes. In the same way, ballet and movement exercises executed for their own sake can produce flexibility and ease of the limbs, but nothing more. The challenge for the actor is to connect such movements to the emotions to which they give rise. In this way physical 'expertise' is allowed to affect the psyche and release true, psychological Free Adapting.\n\nIn contrast, the terms \"industrial\" Bound Flow describe the absence of co-ordination. In real life, a reluctance to expose oneself emotionally produces shy, awkward, self-conscious movements - the patterns of adolescence.\n\nFor Yat Malmgren movement exercises for actors should aim to release this mechanical Bound Flow and thus prepare the ground - on the principle that the outer affects the inner - for the emergence of real Free Flow, or Adapting, the prerequisite for receptivity and a creative state.\n\nBy the same token, Free Flow is not just giving in to gravity or being swept along with the flux. It is an active movement rooted in a positive adaptation to a pleasant Feeling such as love, whether religious or erotic.\n\nPhysically, a pleasant experience 'opens us up' to enable us to 'receive' its pleasurable impact. The chest expands, the heart swells. Conversely, an unpleasant experience causes our bodies to contract, to 'close up'. Flow expresses itself in the body in width. Yat Malmgren uses traditional dance terms to describe the effect of Flow on the body: Bound Flow \"gathers\" the body inwards; Free Flow \"scatters\" outwardly.\n\nThe relationship between inner life"
  );

  return out;
}

function extractPrintedPage(page) {
  const match = page.match(/(?:page|Page)\s+(\d{2,4})/);
  return match ? Number(match[1]) : null;
}

function trimBlankEdges(lines) {
  let start = 0;
  let end = lines.length;
  while (start < end && !lines[start].trim()) start += 1;
  while (end > start && !lines[end - 1].trim()) end -= 1;
  return lines.slice(start, end);
}

function writeChapters(text, dir) {
  const matches = [...text.matchAll(/^# Chapter\s+([IVXLC]+)\s*$/gm)];
  const files = [];

  matches.forEach((match, index) => {
    const start = match.index;
    const end = matches[index + 1]?.index ?? text.length;
    const chapterText = text.slice(start, end).trim().concat("\n");
    const chapterTitle = firstHeadingAfter(chapterText) ?? `chapter-${match[1].toLowerCase()}`;
    const filename = `${String(index + 1).padStart(2, "0")}-${slugify(`chapter-${match[1]}-${chapterTitle}`)}.md`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, chapterText);
    files.push(filePath);
  });

  return files;
}

function firstHeadingAfter(text) {
  const heading = text.match(/^##\s+(.+)$/m);
  return heading?.[1];
}

function writeChunks(text, dir, maxChars) {
  const paragraphs = text.split(/\n{2,}/);
  const files = [];
  let current = "";
  let index = 1;

  const flush = () => {
    const content = current.trim();
    if (!content) return;
    const filename = `mirodan-tts-${String(index).padStart(3, "0")}.md`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, `${content}\n`);
    files.push(filePath);
    current = "";
    index += 1;
  };

  for (const paragraph of paragraphs) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length > maxChars && current) flush();

    if (paragraph.length > maxChars) {
      splitLongParagraph(paragraph, maxChars).forEach((part) => {
        if (current && current.length + part.length + 2 > maxChars) flush();
        current = current ? `${current}\n\n${part}` : part;
        flush();
      });
    } else {
      current = current ? `${current}\n\n${paragraph}` : paragraph;
    }
  }
  flush();
  return files;
}

function splitLongParagraph(paragraph, maxChars) {
  const sentences = paragraph.match(/[^.!?]+[.!?]+["')\]]?|.+$/g) ?? [paragraph];
  const parts = [];
  let current = "";
  sentences.forEach((sentence) => {
    const candidate = current ? `${current} ${sentence.trim()}` : sentence.trim();
    if (candidate.length > maxChars && current) {
      parts.push(current);
      current = sentence.trim();
    } else {
      current = candidate;
    }
  });
  if (current) parts.push(current);
  return parts;
}

function buildSuspectLineReport(text) {
  const lines = text.split("\n");
  const suspect = lines
    .map((line, index) => ({ line, index: index + 1 }))
    .filter(({ line }) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return false;
      const chars = [...trimmed];
      const alpha = chars.filter((char) => /[A-Za-z]/.test(char)).length;
      const symbols = chars.filter((char) => /[^A-Za-z0-9\s.,;:'"!?()/-]/.test(char)).length;
      return symbols > 2 || (trimmed.length > 40 && alpha / trimmed.length < 0.45);
    })
    .slice(0, 500);

  return suspect.map(({ line, index }) => `${index}: ${line}`).join("\n").concat("\n");
}

function statsFor(text) {
  return {
    chars: text.length,
    words: wordCount(text),
    lines: text.split("\n").length,
  };
}

function wordCount(text) {
  return (text.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g) ?? []).length;
}

function round(value, places) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function firstDefined(values) {
  return values.find((value) => value != null) ?? null;
}

function lastDefined(values) {
  return [...values].reverse().find((value) => value != null) ?? null;
}

function toTitleCase(value) {
  const keepLower = new Set(["and", "or", "of", "the", "for", "in", "to", "with"]);
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((word, index) => {
      if (index > 0 && keepLower.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--input") parsed.input = argv[++i];
    else if (arg === "--out") parsed.out = argv[++i];
    else if (arg === "--chunk-chars") parsed.chunkChars = argv[++i];
    else if (arg === "--help") {
      console.log("Usage: node scripts/prepare-mirodan-tts.mjs [--input raw.txt] [--out dir] [--chunk-chars 9000]");
      process.exit(0);
    }
  }
  return parsed;
}
