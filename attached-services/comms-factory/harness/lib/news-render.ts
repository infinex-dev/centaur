/**
 * Render a changelog/blog candidate's markdown as an infinex.xyz/news-style
 * article — so the operator can judge the copy as a page, not raw MD. Handles the
 * Infinex shortcodes ({% cloud-image %}, {% toggle %}) + basic markdown. No deps.
 */

import { imageSlots } from './news-image-patch';

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" rel="noreferrer">$1</a>');
}

function renderCloudImage(attrs: string, index: number): string {
  const alt = attrs.match(/alt="([^"]*)"/)?.[1] ?? 'image';
  const src = attrs.match(/src="([^"]*)"/)?.[1] ?? '';
  const placeholder = !src || src.startsWith('<');
  const inner = placeholder
    ? `<div class="imgph"><span class="imgph-tag">image (from designer)</span><span class="imgph-alt">${escapeHtml(alt)}</span></div>`
    : `<img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}">`;
  return `<figure class="cloud-image" data-slot="inline-${index}" data-hint="${placeholder ? 'click to add image' : 'click to replace'}">${inner}</figure>`;
}

function renderBody(body: string, ctx: { i: number } = { i: 0 }): string {
  // Resolve cloud-image first so slot indices follow raw source order (matches
  // imageSlots()), regardless of whether a tag sits inside a toggle.
  body = body.replace(/\{%\s*cloud-image([\s\S]*?)\/%\}/g, (_m, attrs: string) => `\n${renderCloudImage(attrs, ctx.i++)}\n`);
  body = body.replace(/\{%\s*toggle([\s\S]*?)%\}([\s\S]*?)\{%\s*\/toggle\s*%\}/g, (_m, attrs: string, innerRaw: string) => {
    const title = attrs.match(/title="([^"]*)"/)?.[1] ?? 'Details';
    return `\n<details class="toggle"><summary>${escapeHtml(title)}</summary><div class="toggle-body">${renderBody(innerRaw.trim(), ctx)}</div></details>\n`;
  });

  const out: string[] = [];
  let para: string[] = [];
  let ul: string[] = [];
  const flushPara = (): void => {
    if (para.length) {
      out.push('<p>' + inline(para.join(' ')) + '</p>');
      para = [];
    }
  };
  const flushUl = (): void => {
    if (ul.length) {
      out.push('<ul>' + ul.map((x) => `<li>${inline(x)}</li>`).join('') + '</ul>');
      ul = [];
    }
  };

  for (const rawLine of body.split('\n')) {
    const s = rawLine.trim();
    if (s.startsWith('<')) {
      flushPara();
      flushUl();
      out.push(rawLine);
    } else if (!s) {
      flushPara();
      flushUl();
    } else if (s === '---') {
      flushPara();
      flushUl();
      out.push('<hr>');
    } else if (s.startsWith('### ')) {
      flushPara();
      flushUl();
      out.push(`<h3>${inline(s.slice(4))}</h3>`);
    } else if (s.startsWith('## ')) {
      flushPara();
      flushUl();
      out.push(`<h2>${inline(s.slice(3))}</h2>`);
    } else if (s.startsWith('- ')) {
      flushPara();
      ul.push(s.slice(2));
    } else {
      flushUl();
      para.push(s);
    }
  }
  flushPara();
  flushUl();
  return out.join('\n');
}

export interface NewsArticle {
  title: string;
  subtitle: string;
  date: string;
  category: string;
  coverAlt: string;
  coverSrc: string; // real URL if filled, else '' (placeholder)
  bodyHtml: string;
}

export function renderNewsArticle(md: string): NewsArticle {
  let fmRaw = '';
  let body = md;
  if (md.startsWith('---')) {
    const end = md.indexOf('\n---', 3);
    if (end !== -1) {
      fmRaw = md.slice(3, end);
      body = md.slice(end + 4).replace(/^\n+/, '');
    }
  }
  const field = (key: string): string =>
    fmRaw.match(new RegExp(`(?:^|\\n)${key}:\\s*(.+)`))?.[1]?.trim() ?? '';
  const coverAlt = fmRaw.match(/coverImage:[\s\S]*?\n\s*alt:\s*(.+)/)?.[1]?.trim() ?? '';
  return {
    title: field('title') || 'Untitled',
    subtitle: field('subtitle'),
    date: field('date'),
    category: field('category') || 'changelogs',
    coverAlt,
    coverSrc: imageSlots(md).coverSrc,
    bodyHtml: renderBody(body),
  };
}
