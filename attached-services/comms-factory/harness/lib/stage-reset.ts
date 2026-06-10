import type Database from 'better-sqlite3';

export function clearResearchDownstream(db: Database.Database, cardId: string): void {
  clearCardDownstream(db, cardId);
  db.prepare('DELETE FROM release_card_edits WHERE card_id = ?').run(cardId);
  db.prepare('DELETE FROM release_cards WHERE card_id = ?').run(cardId);
}

export function clearCardDownstream(db: Database.Database, cardId: string): void {
  db.prepare('DELETE FROM final_picks WHERE card_id = ?').run(cardId);
  db.prepare(
    `DELETE FROM candidate_text_edits
     WHERE candidate_id IN (SELECT id FROM candidates WHERE card_id = ?)`,
  ).run(cardId);
  db.prepare(
    `DELETE FROM candidate_semantic_edits
     WHERE candidate_id IN (SELECT id FROM candidates WHERE card_id = ?)`,
  ).run(cardId);
  db.prepare(
    `DELETE FROM candidate_decisions
     WHERE candidate_id IN (SELECT id FROM candidates WHERE card_id = ?)`,
  ).run(cardId);
  db.prepare('DELETE FROM candidates WHERE card_id = ?').run(cardId);
}
