/**
 * Deterministic date freshening for ship copy. The concrete accident this guards:
 * publishing with a stale `date:` front-matter (e.g. the day the card was grounded)
 * instead of today. No LLM — dates are pattern-matchable, so this is free and exact.
 *
 * Conservative on purpose: it anchors on the front-matter `date:` field and only
 * bumps THAT date plus any verbatim echo of the same stale date elsewhere in the
 * copy. Other dates (genuine historical references) are never touched. Returns the
 * changes so the operator sees exactly what moved.
 */

export interface DateChange {
  field: string;
  from: string;
  to: string;
}

const ISO = /\d{4}-\d{2}-\d{2}/;

export function freshenDates(text: string, today: string): { text: string; changes: DateChange[] } {
  const changes: DateChange[] = [];
  const fm = text.match(/^(date:[ \t]*)(\d{4}-\d{2}-\d{2})([ \t]*)$/m);
  if (!fm || !ISO.test(today)) return { text, changes };

  const anchor = fm[2]!;
  if (anchor === today) return { text, changes }; // already current

  // 1) the publish-date field itself
  let out = text.replace(/^(date:[ \t]*)(\d{4}-\d{2}-\d{2})([ \t]*)$/m, (_m, pre: string, _d: string, post: string) => `${pre}${today}${post}`);
  changes.push({ field: 'date', from: anchor, to: today });

  // 2) verbatim echoes of the same stale date elsewhere (the front-matter one is
  //    already today, so it won't re-match)
  const echo = new RegExp(anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
  let echoes = 0;
  out = out.replace(echo, () => {
    echoes += 1;
    return today;
  });
  if (echoes > 0) changes.push({ field: `body (${echoes}×)`, from: anchor, to: today });

  return { text: out, changes };
}
