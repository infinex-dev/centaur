'use client';

/**
 * SurfaceEditor — inline "polish to ship" editing for one package surface.
 *
 * Two editing modalities, chosen by surface so each lands where it reads best:
 *  - In-card editing (web / carousel / thread / X / in-product): the rendered
 *    card's text becomes contentEditable — you edit "in the card itself".
 *  - Source editing (blog / modal, and any unstructured multi-line surface): a
 *    text/markdown pane with the card rendering live beside it — the "md preview".
 *
 * Saving captures a text diff against the immutable candidate and writes the
 * edited copy (plus edited StructuredOutput) to the channel's final pick, which
 * is the ship artifact — the blog pick's markdown is exactly what the emit PR
 * pushes.
 */

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState, useTransition } from 'react';
import { saveSurfaceEdit, freshenSurface } from '@/app/actions/surface-edit';
import { uploadThreadImage } from '@/app/actions/thread-image';
import { SurfacePreview, type SurfaceEditHandlers, type ThreadImageControls } from './SurfacePreview';
import { RegenerateModal } from './RegenerateModal';
import { flattenStructured, parseStructured, type StructuredOutput, type SurfaceKind } from '@/lib/surfaces';
import { hasToggle } from '@/lib/markdown-splice';
import { toXArticle, xArticleHtml, xArticlePlain } from '@/lib/x-article';
import { copyRichText } from '@/lib/copy-rich';
import { shouldRestoreSurfaceDraft, surfaceDraftPayload, type SurfaceDraftPayload } from '@/lib/surface-draft';
import type { Channel } from '@/lib/types';

function cloneStructured(s: StructuredOutput): StructuredOutput {
  if (s.kind === 'web-card') return { ...s };
  if (s.kind === 'thread') return { kind: 'thread', tweets: [...s.tweets], ...(s.media ? { media: [...s.media] } : {}) };
  return { kind: 'carousel', slides: s.slides.map((x) => ({ ...x })) };
}

export function SurfaceEditor({
  surface,
  cardId,
  channel,
  candidateId,
  text,
  structuredJson,
  edited,
}: {
  surface: SurfaceKind;
  cardId: string;
  channel: Channel;
  candidateId: string;
  text: string;
  structuredJson: string | null;
  /** A pick already exists for this surface (so the shown copy may be edited). */
  edited?: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<'view' | 'edit'>('view');
  const [showRegen, setShowRegen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [restored, setRestored] = useState(false);
  const [freshenMsg, setFreshenMsg] = useState<string | null>(null);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);
  const [imgBusy, setImgBusy] = useState<number | null>(null);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const pendingTweet = useRef<number | null>(null);

  const structured = parseStructured(structuredJson);
  const inCardStructured =
    structured && (structured.kind === 'web-card' || structured.kind === 'thread' || structured.kind === 'carousel');
  const inCardFlat = !structured && (surface === 'x' || surface === 'in-product');
  const sourceMode = !inCardStructured && !inCardFlat; // blog, modal, x-thread-from-split, unstructured web

  // Working drafts. contentEditable nodes mutate `draft` (a ref — no re-render,
  // so the cursor never jumps); the source textarea is controlled by `source`.
  const draft = useRef<{ structured: StructuredOutput | null; text: string }>({
    structured: structured ? cloneStructured(structured) : null,
    text,
  });
  const [source, setSource] = useState(text);
  // What the edit-mode card/textarea renders from — props normally, or a restored
  // unsaved draft after a refresh/crash.
  const [editData, setEditData] = useState<{ text: string; structuredJson: string | null }>({ text, structuredJson });

  // ── In-progress edit autosave ────────────────────────────────────────────
  // Every edit autosaves to localStorage so a refresh/crash never loses it. The
  // key only lingers across a NON-clean exit (save + cancel clear it), so finding
  // it on mount means there's unsaved work to restore.
  const lsKey = `cf-surface-draft:${cardId}:${channel}`;
  function persistDraft(working: { structured: StructuredOutput | null; text: string }) {
    try {
      localStorage.setItem(
        lsKey,
        JSON.stringify(surfaceDraftPayload(working, { baseText: text, baseStructuredJson: structuredJson })),
      );
    } catch {
      // storage unavailable — nothing more we can do
    }
  }
  function clearDraft() {
    try {
      localStorage.removeItem(lsKey);
    } catch {
      // ignore
    }
  }

  const hydrated = useRef(false);
  useEffect(() => {
    if (hydrated.current) return;
    hydrated.current = true;
    let saved: SurfaceDraftPayload | null = null;
    try {
      const raw = localStorage.getItem(lsKey);
      if (!raw) return;
      saved = JSON.parse(raw) as SurfaceDraftPayload;
    } catch {
      return;
    }
    if (!saved || typeof saved.text !== 'string') return;
    if (!shouldRestoreSurfaceDraft(saved, text)) {
      clearDraft();
      return;
    }
    draft.current = { structured: saved.structured ?? null, text: saved.text };
    setSource(saved.text);
    setEditData({ text: saved.text, structuredJson: saved.structured ? JSON.stringify(saved.structured) : null });
    setRestored(true);
    setMode('edit');
  }, [lsKey]);

  // Source-mode (blog/modal) autosaves on every keystroke while editing.
  useEffect(() => {
    if (mode !== 'edit' || !sourceMode) return;
    persistDraft({ structured: null, text: source });
  }, [mode, sourceMode, source]); // eslint-disable-line react-hooks/exhaustive-deps

  function begin() {
    draft.current = { structured: structured ? cloneStructured(structured) : null, text };
    setSource(text);
    setEditData({ text, structuredJson });
    setRestored(false);
    setError(null);
    setMode('edit');
  }

  function cancel() {
    clearDraft();
    setRestored(false);
    setError(null);
    setMode('view');
  }

  function copyForX() {
    setError(null);
    setCopyMsg(null);
    const art = toXArticle(text);
    // Copy SYNCHRONOUSLY first (lands before focus shifts), THEN open the composer
    // in the same gesture. X can't be prefilled — you paste (⌘V).
    const ok = copyRichText(xArticleHtml(art), xArticlePlain(art));
    window.open('https://x.com/compose/articles', '_blank', 'noopener,noreferrer');
    setCopyMsg(
      ok
        ? `✓ copied — paste (⌘V) into the X article composer that just opened. Title: “${art.title}”`
        : '⚠ copy may have been blocked — click again.',
    );
  }

  async function copySurface() {
    setError(null);
    setCopyMsg(null);
    try {
      await navigator.clipboard.writeText(text);
      setCopyMsg('copied');
    } catch {
      setCopyMsg('copy blocked');
    }
  }

  function pickThreadImage(tweetIndex: number) {
    if (imgBusy !== null) return;
    pendingTweet.current = tweetIndex;
    setError(null);
    imgInputRef.current?.click();
  }

  function onThreadImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const i = pendingTweet.current;
    e.target.value = ''; // allow re-selecting the same file
    if (!file || i === null) return;
    const fd = new FormData();
    fd.append('file', file);
    setImgBusy(i);
    startTransition(async () => {
      try {
        await uploadThreadImage(cardId, candidateId, i, fd);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setImgBusy(null);
      }
    });
  }

  function refresh() {
    setError(null);
    setFreshenMsg(null);
    startTransition(async () => {
      try {
        const res = await freshenSurface(candidateId);
        setFreshenMsg(
          res.changes.length === 0
            ? 'dates current ✓'
            : '🗓 ' + res.changes.map((c) => `${c.field}: ${c.from} → ${c.to}`).join(' · '),
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  function save() {
    let finalText: string;
    let finalStructured: string | null;
    if (inCardStructured && draft.current.structured) {
      finalStructured = JSON.stringify(draft.current.structured);
      finalText = flattenStructured(draft.current.structured);
    } else if (inCardFlat) {
      finalStructured = null;
      finalText = draft.current.text;
    } else {
      finalStructured = null;
      finalText = source;
    }
    if (!finalText.trim()) {
      setError('Copy cannot be empty.');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await saveSurfaceEdit(candidateId, finalText, finalStructured);
        clearDraft();
        setRestored(false);
        setMode('view');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      }
    });
  }

  const handlers: SurfaceEditHandlers = {
    setText: (v) => {
      draft.current.text = v;
      persistDraft(draft.current);
    },
    setWebField: (field, v) => {
      if (draft.current.structured?.kind === 'web-card') draft.current.structured[field] = v;
      persistDraft(draft.current);
    },
    setTweet: (i, v) => {
      if (draft.current.structured?.kind === 'thread') draft.current.structured.tweets[i] = v;
      persistDraft(draft.current);
    },
    setSlide: (i, field, v) => {
      if (draft.current.structured?.kind === 'carousel') draft.current.structured.slides[i]![field] = v;
      persistDraft(draft.current);
    },
  };

  const editing = mode === 'edit';

  // Per-tweet image attachment is available on an approved x-thread pick, in
  // view mode (text-edit mode owns the contentEditable nodes). Media is a
  // delivery-time asset stored on the pick, not embedded in the tweet text.
  const threadImage: ThreadImageControls | undefined =
    !editing && edited && structured?.kind === 'thread'
      ? {
          media: structured.tweets.map((_, i) => structured.media?.[i] ?? null),
          busyIndex: imgBusy,
          onPick: pickThreadImage,
        }
      : undefined;

  return (
    <div className={`surf-editor ${editing ? 'is-editing' : ''}`}>
      {threadImage && <input ref={imgInputRef} type="file" accept="image/*" hidden onChange={onThreadImageFile} />}
      <div className="surf-editor-card">
        {editing && !sourceMode ? (
          // In-card editing — render the card frozen at its initial (or restored)
          // values with contentEditable fields. Data stays fixed so nodes never re-render.
          <SurfacePreview surface={surface} data={editData} edit={handlers} />
        ) : editing && sourceMode ? (
          // Long-form surfaces (blog/modal) edit IN PLACE — the card slot becomes
          // the editor, so there's no second pane. Markdown can't be safely round-
          // tripped from the rendered blocks, so the raw source is edited here.
          <textarea
            className="surf-editor-source in-card"
            value={source}
            spellCheck={false}
            autoFocus
            onChange={(e) => setSource(e.target.value)}
            rows={surface === 'blog' ? 18 : 6}
            placeholder={surface === 'blog' ? 'Markdown — title:/subtitle: front-matter then body' : 'Copy'}
          />
        ) : (
          <SurfacePreview surface={surface} data={{ text, structuredJson }} threadImage={threadImage} />
        )}
      </div>

      <div className="surf-editor-bar">
        {!editing ? (
          <>
            <button type="button" className="se-btn se-edit" onClick={begin}>
              edit
            </button>
            <button type="button" className="se-btn se-copy" onClick={copySurface}>
              copy
            </button>
            <button type="button" className="se-btn se-regen" onClick={() => setShowRegen(true)}>
              regenerate
            </button>
            <button type="button" className="se-btn se-refresh" disabled={pending} onClick={refresh} title="Bump a stale publish date to today (deterministic)">
              refresh dates
            </button>
            {freshenMsg && <span className="se-freshen mono">{freshenMsg}</span>}
            {surface === 'blog' && (
              <>
                <a
                  className="se-viewpage"
                  href={`/cards/${cardId}/news-preview/${candidateId}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  view as page ↗
                </a>
                <button
                  type="button"
                  className="se-btn se-copyx"
                  onClick={copyForX}
                  title="Copy as a formatted X Article body — paste straight into X's article composer"
                >
                  copy for X article
                </button>
              </>
            )}
            {copyMsg && <span className="se-freshen mono">{copyMsg}</span>}
            {edited && <span className="se-edited">edited · pick</span>}
          </>
        ) : (
          <>
            <button type="button" className="se-btn se-save" disabled={pending} onClick={save}>
              {pending ? 'saving…' : 'save → pick'}
            </button>
            <button type="button" className="se-btn se-cancel" disabled={pending} onClick={cancel}>
              cancel
            </button>
            <span className="se-hint mono">
              {sourceMode ? (surface === 'blog' ? 'editing markdown in place' : 'editing copy in place') : 'edit text in the card'}
            </span>
            {restored && <span className="se-restored mono">↺ restored unsaved edit</span>}
          </>
        )}
        {error && <span className="se-error">{error}</span>}
      </div>

      {showRegen && (
        <RegenerateModal
          cardId={cardId}
          channel={channel}
          candidateId={candidateId}
          surface={surface}
          canSplice={hasToggle(text)}
          onClose={() => setShowRegen(false)}
        />
      )}
    </div>
  );
}
