/**
 * Pure string surgery for placing image URLs into a blog/changelog pick's
 * markdown (`final_picks.final_text`). The actor emits placeholder slots:
 *   - a frontmatter `coverImage:` block  (src seeded `<designer-cover-url>`)
 *   - inline `{% cloud-image src="<...>" /%}` tags
 * The operator fills each slot's src by uploading on the view-as preview.
 *
 * Slot ids: `cover` and `inline-<n>` (n = 0-based source order, matching
 * `imageSlots().inline`). No deps — mirrors news-render.ts parsing.
 */

export interface ImageDims {
  width?: number;
  height?: number;
}

export interface ImageSlots {
  hasCover: boolean;
  coverSrc: string; // real URL if filled, else ''
  inline: { src: string; filled: boolean }[];
}

const PLACEHOLDER = (s: string): boolean => !s || s.startsWith('<');

const COVER_BLOCK = /\ncoverImage:\n((?:[ \t]+.*(?:\n|$))*)/;
const CLOUD_IMAGE_G = /\{%\s*cloud-image([\s\S]*?)\/%\}/g;

function coverSrcOf(blockBody: string): string {
  // handles inline `src: url` and YAML folded `src: >-\n    url`
  const folded = blockBody.match(/[ \t]+src:[ \t]*>-\s*\n[ \t]+(\S+)/);
  if (folded) return folded[1];
  return blockBody.match(/[ \t]+src:[ \t]*(\S.*?)\s*$/m)?.[1] ?? '';
}

export function imageSlots(md: string): ImageSlots {
  const coverM = md.match(COVER_BLOCK);
  const rawCover = coverM ? coverSrcOf(coverM[1]) : '';
  const inline = [...md.matchAll(CLOUD_IMAGE_G)].map((m) => {
    const src = m[1].match(/src="([^"]*)"/)?.[1] ?? '';
    return { src, filled: !PLACEHOLDER(src) };
  });
  return {
    hasCover: !!coverM,
    coverSrc: PLACEHOLDER(rawCover) ? '' : rawCover,
    inline,
  };
}

function setScalarLine(body: string, key: string, value: string | number): string {
  const re = new RegExp(`([ \\t]+${key}:[ \\t]*).*`);
  if (re.test(body)) return body.replace(re, `$1${value}`);
  // append, matching the block's indentation (default 2 spaces)
  const indent = body.match(/^([ \t]+)\S/)?.[1] ?? '  ';
  return body.replace(/\n*$/, '\n') + `${indent}${key}: ${value}\n`;
}

/** Set the frontmatter `coverImage.src` (+ optional dims). Inserts the block if absent. */
export function setCoverSrc(md: string, url: string, dims?: ImageDims): string {
  const coverM = md.match(COVER_BLOCK);
  if (!coverM) {
    // no coverImage block — insert one just before the closing frontmatter `---`
    const fmEnd = md.indexOf('\n---', 3);
    if (!md.startsWith('---') || fmEnd === -1) {
      throw new Error('setCoverSrc: no frontmatter to attach a coverImage block to');
    }
    let block = `coverImage:\n  src: ${url}\n`;
    if (dims?.height) block += `  height: ${dims.height}\n`;
    if (dims?.width) block += `  width: ${dims.width}\n`;
    return md.slice(0, fmEnd) + '\n' + block.replace(/\n$/, '') + md.slice(fmEnd);
  }
  let body = coverM[1];
  // replace src (folded or inline form) → normalise to inline
  if (/[ \t]+src:[ \t]*>-/.test(body)) {
    body = body.replace(/([ \t]+src:[ \t]*)>-\s*\n[ \t]+\S+/, `$1${url}`);
  } else if (/[ \t]+src:/.test(body)) {
    body = body.replace(/([ \t]+src:[ \t]*).*/, `$1${url}`);
  } else {
    body = `  src: ${url}\n` + body;
  }
  if (dims?.height) body = setScalarLine(body, 'height', dims.height);
  if (dims?.width) body = setScalarLine(body, 'width', dims.width);
  return md.replace(coverM[0], `\ncoverImage:\n${body}`);
}

function setAttr(attrs: string, key: string, value: string, quoted: boolean): string {
  const re = quoted ? new RegExp(`${key}="[^"]*"`) : new RegExp(`${key}=\\d+`);
  const token = quoted ? `${key}="${value}"` : `${key}=${value}`;
  if (re.test(attrs)) return attrs.replace(re, token);
  // insert after `cloud-image ` (attrs starts with a leading space)
  return ` ${token}${attrs}`;
}

/** Set the src (+ optional dims) on the index-th `{% cloud-image %}` tag. */
export function setInlineSrc(md: string, index: number, url: string, dims?: ImageDims): string {
  let i = -1;
  let touched = false;
  const out = md.replace(CLOUD_IMAGE_G, (m, attrs: string) => {
    i += 1;
    if (i !== index) return m;
    touched = true;
    let a = setAttr(attrs, 'src', url, true);
    if (dims?.height) a = setAttr(a, 'height', String(dims.height), false);
    if (dims?.width) a = setAttr(a, 'width', String(dims.width), false);
    return `{% cloud-image${a}/%}`;
  });
  if (!touched) throw new Error(`setInlineSrc: no cloud-image at index ${index}`);
  return out;
}

/** Apply an upload to a slot id (`cover` | `inline-<n>`). */
export function setSlotSrc(md: string, slot: string, url: string, dims?: ImageDims): string {
  if (slot === 'cover') return setCoverSrc(md, url, dims);
  const m = slot.match(/^inline-(\d+)$/);
  if (!m) throw new Error(`setSlotSrc: unknown slot "${slot}"`);
  return setInlineSrc(md, Number(m[1]), url, dims);
}
