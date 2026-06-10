'use client';

/**
 * SurfacePreview — faithful mini-mockups for each surface (ported from
 * harness-surface-previews.jsx). Renders the *shape* the copy lands in, not
 * raw text. This is the single structured renderer for the harness: it
 * supersedes CandidateCard's plain StructuredCandidateView and consumes the
 * pipeline's real StructuredOutput payload (web-card | carousel | thread).
 *
 * The X-thread preview renders each tweet on a numbered spine with its own
 * char count so tweet boundaries are unmistakable (operator requirement:
 * "can't really see the different tweet start and finish"). When an `x`
 * candidate has no structured payload, splitTweets() provides a fallback so
 * boundaries are still visible.
 */
import { useMemo, useState } from 'react';
import {
  SURFACE_META,
  parseStructured,
  splitTweets,
  type SurfaceKind,
  type StructuredOutput,
} from '@/lib/surfaces';

export interface SurfaceData {
  text: string;
  structuredJson?: string | null;
}

function CharCount({ n, limit, label }: { n: number; limit?: number | null; label?: string }) {
  const over = limit != null && n > limit;
  const near = limit != null && !over && n > limit * 0.9;
  return (
    <span
      className={`charcount ${over ? 'over' : near ? 'near' : ''}`}
      title={limit != null ? `${n} / ${limit}` : `${n} chars`}
    >
      {label ? <span className="cc-label">{label}</span> : null}
      <span className="cc-n">
        {n}
        {limit != null ? `/${limit}` : ''}
      </span>
    </span>
  );
}

function richText(text: string) {
  const parts = String(text).split(/(\bperps\.app\.infinex\.xyz\b|\b[A-Z]{2,6}\/USDC\b|\$\d[\d.,]*[MKB]?)/g);
  return parts.map((p, i) => {
    if (/^perps\.app\.infinex\.xyz$/.test(p)) return <span key={i} className="rt-link">{p}</span>;
    if (/^[A-Z]{2,6}\/USDC$/.test(p)) return <span key={i} className="rt-ticker">{p}</span>;
    if (/^\$\d/.test(p)) return <span key={i} className="rt-num">{p}</span>;
    return <span key={i}>{p}</span>;
  });
}

function TweetPreview({ text, variant }: { text: string; variant: string }) {
  return (
    <div className={`pv pv-x ${variant}`}>
      <div className="pv-x-head">
        <div className="pv-avatar">ix</div>
        <div className="pv-x-id">
          <span className="pv-name">Infinex</span>
          <span className="pv-handle">@infinex</span>
        </div>
        <span className="pv-x-glyph">𝕏</span>
      </div>
      <div className="pv-x-body">{richText(text)}</div>
      <div className="pv-x-foot">
        <span className="mono muted-2">single tweet</span>
        <CharCount n={text.length} limit={280} />
      </div>
    </div>
  );
}

function ThreadPreview({ tweets, variant }: { tweets: string[]; variant: string }) {
  const [expanded, setExpanded] = useState(false);
  const collapsed = variant === 'compact' && !expanded;
  const shown = collapsed ? tweets.slice(0, 2) : tweets;
  return (
    <div className={`pv pv-thread ${variant}`}>
      {shown.map((tw, i) => (
        <div className="pv-tw" key={i}>
          <div className="pv-tw-rail">
            <div className="pv-avatar sm">ix</div>
            {i < shown.length - 1 && <div className="pv-tw-line" />}
          </div>
          <div className="pv-tw-main">
            <div className="pv-tw-head">
              <span className="pv-name">Infinex</span>
              <span className="pv-handle">@infinex</span>
              <span className="pv-tw-idx mono">
                {i + 1}/{tweets.length}
              </span>
            </div>
            <div className="pv-tw-text">{richText(tw)}</div>
            <CharCount n={tw.length} limit={280} />
          </div>
        </div>
      ))}
      {collapsed && tweets.length > shown.length && (
        <button type="button" className="pv-more mono" onClick={() => setExpanded(true)}>
          +{tweets.length - shown.length} more tweets
        </button>
      )}
    </div>
  );
}

function WebPreview({
  card,
  variant,
}: {
  card: { subheading: string; title: string; caption: string };
  variant: string;
}) {
  return (
    <div className={`pv pv-web ${variant}`}>
      <div className="pv-web-card">
        <div className="pv-web-sub">{card.subheading}</div>
        <div className="pv-web-title">{card.title}</div>
        <div className="pv-web-cap">{card.caption}</div>
        <div className="pv-web-art" aria-hidden="true">
          <span className="mono">product shot</span>
        </div>
      </div>
      {variant !== 'compact' && (
        <div className="pv-fields">
          <CharCount label="subheading" n={card.subheading.length} limit={24} />
          <CharCount label="title" n={card.title.replace(/\s*\/\s*/g, ' ').length} limit={48} />
          <CharCount label="caption" n={card.caption.length} limit={44} />
        </div>
      )}
    </div>
  );
}

function InProductPreview({ text, variant }: { text: string; variant: string }) {
  return (
    <div className={`pv pv-ip ${variant}`}>
      <div className="pv-ip-chrome">
        <span className="pv-ip-dot" />
        <span className="pv-ip-dot" />
        <span className="pv-ip-dot" />
        <span className="mono muted-2" style={{ marginLeft: 8 }}>app.infinex.xyz</span>
      </div>
      <div className="pv-ip-notice">
        <span className="pv-ip-mark">◧</span>
        <span className="pv-ip-text">{text}</span>
        <span className="pv-ip-x mono">×</span>
      </div>
      <div className="pv-x-foot">
        <span className="mono muted-2">in-product banner</span>
        <CharCount n={text.length} limit={90} />
      </div>
    </div>
  );
}

function ModalPreview({ text, variant }: { text: string; variant: string }) {
  const paras = text.split('\n\n');
  return (
    <div className={`pv pv-modal ${variant}`}>
      <div className="pv-modal-scrim">
        <div className="pv-modal-card">
          <div className="pv-modal-head">
            <span className="pv-avatar sm">ix</span>
            <span className="pv-modal-x mono">×</span>
          </div>
          <div className="pv-modal-body">
            {paras.map((p, i) => (
              <p key={i} className={i === 0 ? 'lead' : ''}>{p}</p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

type Block = { t: 'h1' | 'h2' | 'p'; text: string } | { t: 'ul'; items: string[] };
function renderMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.split('\n');
  let list: string[] | null = null;
  const flush = () => {
    if (list) {
      blocks.push({ t: 'ul', items: list });
      list = null;
    }
  };
  lines.forEach((ln) => {
    if (/^#\s/.test(ln)) { flush(); blocks.push({ t: 'h1', text: ln.replace(/^#\s/, '') }); }
    else if (/^##\s/.test(ln)) { flush(); blocks.push({ t: 'h2', text: ln.replace(/^##\s/, '') }); }
    else if (/^-\s/.test(ln)) { (list = list || []).push(ln.replace(/^-\s/, '')); }
    else if (ln.trim() === '') { flush(); }
    else { flush(); blocks.push({ t: 'p', text: ln }); }
  });
  flush();
  return blocks;
}

function BlogPreview({ text, variant }: { text: string; variant: string }) {
  const [open, setOpen] = useState(variant === 'full');
  const blocks = useMemo(() => renderMarkdown(text), [text]);
  const collapsed = !open;
  return (
    <div className={`pv pv-blog ${variant} ${collapsed ? 'is-collapsed' : ''}`}>
      <article className="pv-blog-doc">
        {blocks.map((b, i) => {
          if (b.t === 'h1') return <h1 key={i} className="pv-blog-h1">{b.text}</h1>;
          if (b.t === 'h2') return <h2 key={i} className="pv-blog-h2">{b.text}</h2>;
          if (b.t === 'ul') return <ul key={i} className="pv-blog-ul">{b.items.map((it, j) => <li key={j}>{it}</li>)}</ul>;
          return <p key={i} className="pv-blog-p">{b.text}</p>;
        })}
      </article>
      {collapsed && <div className="pv-blog-fade" />}
      {variant !== 'compact' && (
        <button className="pv-blog-toggle mono" onClick={() => setOpen(!open)}>
          {open ? '▴ collapse' : '▾ expand full post'}
        </button>
      )}
    </div>
  );
}

function CarouselPreview({ slides, variant }: { slides: { name: string; body: string }[]; variant: string }) {
  const [expanded, setExpanded] = useState(false);
  const collapsed = variant === 'compact' && !expanded;
  const shown = collapsed ? slides.slice(0, 2) : slides;
  return (
    <div className={`pv pv-carousel ${variant}`}>
      <div className="pv-carousel-track">
        {shown.map((sl, i) => (
          <div className="pv-slide" key={i}>
            <div className="pv-slide-head">
              <span className="pv-slide-num mono">
                {i + 1}
                <span className="muted-2">/{slides.length}</span>
              </span>
              <span className="pv-avatar xs">ix</span>
            </div>
            <div className="pv-slide-name">{sl.name}</div>
            <div className="pv-slide-body">{sl.body}</div>
            <CharCount n={sl.body.length} limit={240} />
          </div>
        ))}
        {collapsed && slides.length > shown.length && (
          <button type="button" className="pv-slide pv-slide-more mono" onClick={() => setExpanded(true)}>
            +{slides.length - shown.length}
          </button>
        )}
      </div>
    </div>
  );
}

/** Web-card fallback when an unstructured web candidate arrives as flat text. */
function webCardFromText(text: string): StructuredOutput & { kind: 'web-card' } {
  const [first, ...rest] = text.split('\n').filter(Boolean);
  return { kind: 'web-card', subheading: '', title: first ?? text, caption: rest.join(' ') };
}

export function SurfacePreview({
  surface,
  data,
  variant = 'full',
}: {
  surface: SurfaceKind;
  data: SurfaceData;
  variant?: 'full' | 'compact';
}) {
  const structured = parseStructured(data.structuredJson);

  // Structured payload renders by its own kind, regardless of channel label.
  if (structured?.kind === 'thread') return <ThreadPreview tweets={structured.tweets} variant={variant} />;
  if (structured?.kind === 'carousel') return <CarouselPreview slides={structured.slides} variant={variant} />;
  if (structured?.kind === 'web-card') return <WebPreview card={structured} variant={variant} />;

  // No structured payload — fall back to the surface label.
  if (surface === 'x-thread') return <ThreadPreview tweets={splitTweets(data.text)} variant={variant} />;
  if (surface === 'carousel') return <CarouselPreview slides={[]} variant={variant} />;
  if (surface === 'web') return <WebPreview card={webCardFromText(data.text)} variant={variant} />;
  if (surface === 'modal') return <ModalPreview text={data.text} variant={variant} />;
  if (surface === 'blog') return <BlogPreview text={data.text} variant={variant} />;
  if (surface === 'in-product') return <InProductPreview text={data.text} variant={variant} />;
  return <TweetPreview text={data.text} variant={variant} />;
}

// `SURFACE_META` re-export kept available for callers that import it alongside.
export { SURFACE_META };
