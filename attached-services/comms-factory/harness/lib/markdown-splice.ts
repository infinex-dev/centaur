/**
 * Block-scoped splice for the "regenerate just this block" handback. The Actor
 * regenerates the whole post (so it has full context), but we adopt ONLY its
 * version of the operator's `{% toggle %}` block(s) — by title — and keep the
 * operator's surrounding copy byte-for-byte. That preserves the operator's
 * deliberate edits while letting the machine (re)write the toggle they asked for,
 * whether the toggle was empty OR carried wrong/placeholder text.
 */

const TOGGLE = /(\{%\s*toggle\b[^%]*%\})([\s\S]*?)(\{%\s*\/toggle\s*%\})/g;

function toggleTitle(openTag: string): string {
  return openTag.match(/title="([^"]*)"/)?.[1] ?? '';
}

/** True when `text` contains at least one toggle (a splice target). */
export function hasToggle(text: string): boolean {
  for (const _ of text.matchAll(TOGGLE)) return true;
  return false;
}

/**
 * Replace the operator base's toggle bodies with the actor's same-title toggle
 * bodies, keeping everything else in `base` verbatim. Falls back to the actor's
 * single toggle when the base has exactly one toggle and titles don't line up.
 * Toggles the actor didn't produce are left as the operator had them.
 */
export function spliceToggles(base: string, actor: string): string {
  const actorBodies = new Map<string, string>();
  const actorBodyList: string[] = [];
  for (const m of actor.matchAll(TOGGLE)) {
    const body = (m[2] ?? '').trim();
    if (!body) continue;
    actorBodies.set(toggleTitle(m[1] ?? ''), body);
    actorBodyList.push(body);
  }

  const baseToggleCount = [...base.matchAll(TOGGLE)].length;

  return base.replace(TOGGLE, (full, open: string, _body: string, close: string) => {
    const byTitle = actorBodies.get(toggleTitle(open));
    const fill = byTitle ?? (baseToggleCount === 1 && actorBodyList.length === 1 ? actorBodyList[0] : undefined);
    if (!fill) return full;
    return `${open}\n${fill}\n${close}`;
  });
}
