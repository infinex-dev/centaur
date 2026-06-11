import { createHash } from 'node:crypto';

export interface FinalPickRevisionRow {
  channel: string;
  candidate_id: string;
  final_text: string;
  final_structured_json: string | null;
  shipped_at?: string | null;
  shipped_to?: string | null;
}

export function finalPickRevision(rows: FinalPickRevisionRow[]): string {
  const hash = createHash('sha256');
  const sorted = [...rows].sort((a, b) => a.channel.localeCompare(b.channel));
  for (const row of sorted) {
    hash.update(row.channel);
    hash.update('\0');
    hash.update(row.candidate_id);
    hash.update('\0');
    hash.update(row.final_text);
    hash.update('\0');
    hash.update(row.final_structured_json ?? '');
    hash.update('\0');
    hash.update(row.shipped_at ?? '');
    hash.update('\0');
    hash.update(row.shipped_to ?? '');
    hash.update('\0\0');
  }
  return `${sorted.length}:${hash.digest('hex').slice(0, 16)}`;
}
