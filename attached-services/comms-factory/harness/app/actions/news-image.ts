'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { uploadFile } from '@/lib/cloudinary-upload';
import { imageSlots, setSlotSrc } from '@/lib/news-image-patch';

/**
 * Place an uploaded image into a blog pick's copy at `slot` (`cover` |
 * `inline-<n>`). Uploads to Cloudinary, patches `final_picks.final_text`, and
 * revalidates the preview. Requires an approved blog pick — placement is a
 * delivery-time edit, not a candidate mutation.
 */
export async function uploadNewsImage(
  cardId: string,
  candidateId: string,
  slot: string,
  formData: FormData,
): Promise<{ url: string }> {
  const db = getDb();
  const pick = db
    .prepare(
      "SELECT id, final_text FROM final_picks WHERE card_id = ? AND candidate_id = ? AND channel = 'blog'",
    )
    .get(cardId, candidateId) as { id: string; final_text: string } | undefined;
  if (!pick) {
    throw new Error(
      'No approved blog pick for this candidate — approve it as the blog surface (Stage 3) before placing images.',
    );
  }

  // Validate the slot exists in the current copy.
  const slots = imageSlots(pick.final_text);
  if (slot === 'cover') {
    if (!slots.hasCover) throw new Error('This copy has no coverImage block to fill.');
  } else {
    const m = slot.match(/^inline-(\d+)$/);
    if (!m || Number(m[1]) >= slots.inline.length) {
      throw new Error(`No inline image slot "${slot}" in this copy.`);
    }
  }

  const { url, width, height } = await uploadFile(formData.get('file'));
  const next = setSlotSrc(pick.final_text, slot, url, { width, height });
  db.prepare('UPDATE final_picks SET final_text = ? WHERE id = ?').run(next, pick.id);

  revalidatePath(`/cards/${cardId}/news-preview/${candidateId}`);
  revalidatePath(`/cards/${cardId}`);
  return { url };
}
