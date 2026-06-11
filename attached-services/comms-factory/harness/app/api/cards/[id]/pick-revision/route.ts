import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { finalPickRevision, type FinalPickRevisionRow } from '@/lib/final-pick-revision';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const rows = getDb()
    .prepare(
      `
      SELECT channel, candidate_id, final_text, final_structured_json, shipped_at, shipped_to
      FROM final_picks
      WHERE card_id = ?
      ORDER BY channel ASC
      `,
    )
    .all(id) as FinalPickRevisionRow[];
  return NextResponse.json({ revision: finalPickRevision(rows), count: rows.length });
}
