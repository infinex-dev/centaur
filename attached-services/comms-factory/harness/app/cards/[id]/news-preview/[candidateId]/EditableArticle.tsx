'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { uploadNewsImage } from '@/app/actions/news-image';

interface Props {
  cardId: string;
  candidateId: string;
  editable: boolean; // blog channel + an approved pick exists
  coverSrc: string;
  coverAlt: string;
  bodyHtml: string;
}

/**
 * Renders the article cover + body and, when editable, turns every image slot
 * (`[data-slot]`) into a click target: click → file picker → Cloudinary upload
 * → the pick's copy is patched and the page re-renders with the image in place.
 */
export function EditableArticle({ cardId, candidateId, editable, coverSrc, coverAlt, bodyHtml }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function onSlotClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!editable || busy) return;
    const el = (e.target as HTMLElement).closest('[data-slot]') as HTMLElement | null;
    if (!el) return;
    pendingSlot.current = el.getAttribute('data-slot');
    setError(null);
    fileRef.current?.click();
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const slot = pendingSlot.current;
    e.target.value = ''; // allow re-selecting the same file
    if (!file || !slot) return;
    const fd = new FormData();
    fd.append('file', file);
    setBusy(slot);
    startTransition(async () => {
      try {
        await uploadNewsImage(cardId, candidateId, slot, fd);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <div className={editable ? 'nv-editable' : undefined} onClick={onSlotClick}>
      {editable && <input ref={fileRef} type="file" accept="image/*" hidden onChange={onFile} />}

      {!editable && (
        <p className="nv-edit-note">
          Image placement is enabled once this candidate is approved as the <strong>blog</strong> pick (Stage 3).
        </p>
      )}
      {busy && <div className="nv-toast">Uploading to Cloudinary → {busy}…</div>}
      {error && (
        <div className="nv-toast nv-toast-err" onClick={() => setError(null)}>
          {error} <span className="nv-toast-x">✕</span>
        </div>
      )}

      <div className="nv-cover-slot" data-slot="cover" data-hint={coverSrc ? 'click to replace' : 'click to add cover image'}>
        {coverSrc ? (
          <img className="nv-cover-img" src={coverSrc} alt={coverAlt} />
        ) : (
          <div className="nv-cover">
            <span className="t">cover image</span>
            <span className="a">{coverAlt}</span>
          </div>
        )}
      </div>

      <div className="nv-body" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
    </div>
  );
}
