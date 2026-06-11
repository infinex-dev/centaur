/**
 * Turn a blog/changelog markdown into an X (Twitter) Article, copy-paste ready.
 *
 * X's article composer is a rich WYSIWYG editor — pasting raw markdown shows
 * literal `##`/`**`. So we emit clean HTML; the copy button puts it on the
 * clipboard as `text/html` and pasting preserves headings/bold/lists/links with
 * no reformatting. Infinex shortcodes are flattened (X has no toggles); images
 * can't be clipboard-pasted, so they become "[Image: alt]" markers to upload by hand.
 *
 * Pure + client-safe (no server imports) so the copy button can call it directly.
 */

export interface XArticle {
  title: string;
  subtitle: string;
  bodyHtml: string;
  bodyPlain: string;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function inline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}

function inlinePlain(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\[(.+?)\]\((.+?)\)/g, '$1 ($2)');
}

export function toXArticle(md: string): XArticle {
  let fm = '';
  let body = md;
  if (md.startsWith('---')) {
    const end = md.indexOf('\n---', 3);
    if (end !== -1) {
      fm = md.slice(3, end);
      body = md.slice(end + 4).replace(/^\n+/, '');
    }
  }
  const field = (key: string): string => fm.match(new RegExp(`(?:^|\\n)${key}:\\s*(.+)`))?.[1]?.trim() ?? '';
  const title = field('title') || 'Untitled';
  const subtitle = field('subtitle');

  // Flatten Infinex shortcodes into plain markdown the block parser handles.
  body = body
    // Toggle → bold title (####) + body as a blockquote (each line prefixed `> `).
    // Blog section headings (###) stay H2.
    .replace(/\{%\s*toggle[^%]*title="([^"]*)"[^%]*%\}([\s\S]*?)\{%\s*\/toggle\s*%\}/g, (_m, t: string, inner: string) => {
      const quoted = inner.trim().split('\n').map((l) => `> ${l.trim()}`).join('\n');
      return `\n#### ${t}\n${quoted}\n`;
    })
    .replace(/\{%\s*cloud-image([\s\S]*?)\/%\}/g, (_m, attrs: string) => {
      const alt = attrs.match(/alt="([^"]*)"/)?.[1] ?? 'image';
      return `\n[Image: ${alt}]\n`;
    });

  const html: string[] = [];
  const plain: string[] = [];
  let para: string[] = [];
  let ul: string[] = [];
  let quote: string[] = [];
  const flushPara = () => {
    if (para.length) {
      html.push(`<p>${inline(para.join(' '))}</p>`);
      plain.push(inlinePlain(para.join(' ')));
      para = [];
    }
  };
  const flushUl = () => {
    if (ul.length) {
      html.push(`<ul>${ul.map((x) => `<li>${inline(x)}</li>`).join('')}</ul>`);
      ul.forEach((x) => plain.push(`• ${inlinePlain(x)}`));
      ul = [];
    }
  };
  const flushQuote = () => {
    if (quote.length) {
      html.push(`<blockquote>${inline(quote.join(' '))}</blockquote>`);
      plain.push(`> ${inlinePlain(quote.join(' '))}`);
      quote = [];
    }
  };
  const flushAll = () => {
    flushPara();
    flushUl();
    flushQuote();
  };

  for (const raw of body.split('\n')) {
    const s = raw.trim();
    if (!s || s === '---') {
      flushAll();
    } else if (s.startsWith('#### ')) {
      // toggle title → bold line (not a heading), body follows as a blockquote
      flushAll();
      html.push(`<p><strong>${inline(s.slice(5))}</strong></p>`);
      plain.push(s.slice(5));
    } else if (s.startsWith('### ') || s.startsWith('## ') || s.startsWith('# ')) {
      // blog section heading → H2 (prominent, since X's title is a separate field)
      flushAll();
      const txt = s.replace(/^#{1,3}\s+/, '');
      html.push(`<h2>${inline(txt)}</h2>`);
      plain.push(txt);
    } else if (s.startsWith('>')) {
      flushPara();
      flushUl();
      quote.push(s.replace(/^>\s?/, ''));
    } else if (s.startsWith('- ')) {
      flushPara();
      flushQuote();
      ul.push(s.slice(2));
    } else {
      flushUl();
      flushQuote();
      para.push(s);
    }
  }
  flushAll();

  return { title, subtitle, bodyHtml: html.join('\n'), bodyPlain: plain.join('\n\n') };
}

/** Full pasteable HTML for X's article BODY — subtitle as an italic lead, then the
 * body. (X's title is a separate field, so the title is NOT included here.) */
export function xArticleHtml(a: XArticle): string {
  const lead = a.subtitle ? `<p><em>${escapeHtml(a.subtitle)}</em></p>\n` : '';
  return lead + a.bodyHtml;
}

/** Plain-text fallback for the same body (for editors that ignore text/html). */
export function xArticlePlain(a: XArticle): string {
  return (a.subtitle ? `${a.subtitle}\n\n` : '') + a.bodyPlain;
}
