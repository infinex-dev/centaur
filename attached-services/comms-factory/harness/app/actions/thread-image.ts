'use server';

import { revalidatePath } from 'next/cache';
import { getDb } from '@/lib/db';
import { uploadFile } from '@/lib/cloudinary-upload';
import { setThreadMedia } from '@/lib/thread-media';

/**
 * Attach an uploaded image to tweet `tweetIndex` of an x-thread pick. Uploads to
 * Cloudinary and stores the URL in the pick's structured `media[]` (parallel to
 * tweets). Requires an approved pick — placement is a delivery-time edit. The
 * image does NOT embed in the thread text; it's kept for the Typefully push.
 */
export async function uploadThreadImage(
  cardId: string,
  candidateId: string,
  tweetIndex: number,
  formData: FormData,
): Promise<{ url: string }> {
  const db = getDb();
  const pick = db
    .prepare('SELECT id, final_structured_json FROM final_picks WHERE card_id = ? AND candidate_id = ?')
    .get(cardId, candidateId) as { id: string; final_structured_json: string | null } | undefined;
  if (!pick) {
    throw new Error('No approved pick for this candidate — approve it as the X-thread pick (Stage 3) before placing images.');
  }
  if (!pick.final_structured_json) {
    throw new Error('This pick has no structured thread payload to attach images to.');
  }

  const { url } = await uploadFile(formData.get('file'));
  const next = setThreadMedia(pick.final_structured_json, tweetIndex, url);
  db.prepare('UPDATE final_picks SET final_structured_json = ? WHERE id = ?').run(next, pick.id);

  revalidatePath(`/cards/${cardId}`);
  return { url };
}
