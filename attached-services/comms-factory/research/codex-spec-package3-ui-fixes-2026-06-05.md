# Codex Spec — Package 3: Harness Review-UI Fixes

6 review-UI fixes for the comms-factory harness (harness/ Next.js app). The harness is the operator's review surface; these make a run's reasoning visible.
Not the production pipeline.

## Ground rules for Codex

- **Working-tree discipline (do this):** if the tree is dirty when you start, commit it first as a checkpoint; when your work is done AND `typecheck:harness` + `build:harness` pass, commit your changes as ONE commit (e.g. `pkg3: harness review-UI fixes`). Do NOT merge, push, or open a PR. This keeps each package an isolated, separately-verifiable commit.
- **Language:** TypeScript only.
- **Keep green:** run `pnpm typecheck:harness` and `pnpm build:harness` and keep both passing after every unit. (The harness `typecheck` script is `next typegen && tsc --noEmit`; do not invoke a bare `tsc`.)
- **Render-only / minimal:** these are presentation changes. Make the smallest edit that satisfies the acceptance criteria.
- **Do not alter run/generation behavior:** no changes to how candidates are generated, validated, audited, ranked, or persisted. View-model and render layers only.
- **Preserve existing tabs/states:** keep all current tabs, panels, and state machines intact; you are adding/repairing display, not restructuring the IA.

## Build order

Every unit reports `depends_on: []` — all 6 are self-contained with no inter-unit ordering requirement. Recommended order (lowest blast radius first, the two director-gate units last since they touch overlapping view-model regions):

1. **superseded-tooltip** — Explain the corpus "superseded" status with a hover tooltip
2. **expandable-more** — Make the "+N more tweets" / "+N" compact-preview markers clickable to expand inline
3. **failures-show-text** — Show failed candidate text inline in the Failures view
4. **director-fail-hover** — Add tooltip to the director Gate badge surfacing director_audit_json reject reasons
5. **show-beats** — Render the actor's DECLARED channel beat plans in the Throughline tab (declared-vs-audited side by side)
6. **stop-regex-echo** — JUDG/director gate cell must show the director's own verdict, never echo the regex reason

(`stop-regex-echo` and `director-fail-hover` both touch the director Gate cell area but, per review, edit non-overlapping lines; doing them adjacently keeps that context fresh.)

## Unit 1 — Explain the corpus "superseded" status with a hover tooltip

**id:** `superseded-tooltip`  ·  **depends_on:** `[]`

### Files

- `/Users/opaque/.superset/projects/comms-factory/harness/components/design/PackageTabs.tsx` — Corpus tab renders one chip per candidate with the raw status word (picked/superseded/failed) and no explanation; add the tooltip here.
- `/Users/opaque/.superset/projects/comms-factory/harness/app/cards/[id]/page.tsx` — Read-only context: shows how status is derived (lines 154-160) so the tooltip wording matches the real semantics. No edit required.

### Problem

In the Corpus tab, every candidate card shows a status chip with one of three raw words — picked, superseded, or failed — rendered at PackageTabs.tsx line 267:

    <span className={`corpus-status ${c.status}`}>{c.status}</span>

The word `superseded` is unexplained in the UI. An operator reading it cannot tell whether the candidate failed, was buggy, or was simply not chosen. The actual meaning is defined by the status derivation in app/cards/[id]/page.tsx lines 155-160:

    const failed = !c.validation_passed || c.director_passed === false;
    const status: CorpusItemVM['status'] = pickedIds.has(c.id)
      ? 'picked'
      : failed
        ? 'failed'
        : 'superseded';

So `superseded` means: the candidate passed ALL gates (regex validation passed AND director did not reject it) but was NOT the one picked for its surface — another candidate was selected instead. That semantic needs to be surfaced to the operator without adding any new layout.

### Change

In /Users/opaque/.superset/projects/comms-factory/harness/components/design/PackageTabs.tsx, add a native `title` attribute to the corpus status chip so hovering it explains the status. This follows the existing tooltip convention in this codebase — native `title=` strings, as used by `FlowChip` (line 357: title={`vertical flow: ${flow.label}`}) and `StageDots` in atoms.tsx (line 31).

Step 1 — add a module-scope lookup constant. Place it just after the TABS constant block that ends at line 58 and before `type TabId` on line 60:

    const CORPUS_STATUS_TITLE: Record<CorpusItemVM['status'], string> = {
      picked: 'picked — selected as the candidate to ship for this surface',
      superseded: 'passed validation but not selected — another candidate was picked for this surface',
      failed: 'failed a gate — rejected by regex validation or the Director',
    };

Step 2 — replace the corpus status chip at line 267, which currently reads exactly:

    <span className={`corpus-status ${c.status}`}>{c.status}</span>

with:

    <span className={`corpus-status ${c.status}`} title={CORPUS_STATUS_TITLE[c.status]}>{c.status}</span>

The `superseded` string is the load-bearing one the task asked for: "passed validation but not selected — another candidate was picked for this surface". The `picked` and `failed` entries are included so the tooltip is consistent across all three states (cheap, avoids a one-off conditional). No CSS, no new component, no layout change — `title` renders as the browser-native hover tooltip. Do NOT touch the SurfaceCard status chip at lines 324-326; it uses the `state` values (eligible/blocked/missing), never `superseded`, and is out of scope.

### Acceptance criteria

- A CORPUS_STATUS_TITLE (or equivalently-named) constant is added at module scope in PackageTabs.tsx, typed Record<CorpusItemVM['status'], string>, with keys picked, superseded, failed.
- The superseded entry's value is exactly: passed validation but not selected — another candidate was picked for this surface
- The corpus status chip on line 267 gains a title={CORPUS_STATUS_TITLE[c.status]} attribute; its visible text ({c.status}) and className (corpus-status ${c.status}) are unchanged.
- Hovering the superseded chip in the Corpus tab shows the explanatory tooltip; the chip's appearance and the page layout are otherwise identical to before.
- No other file is modified; the SurfaceCard chip at PackageTabs.tsx lines 324-326 is left untouched.

### Tests

- Manual/visual: open a card detail page that has at least one superseded candidate (passed regex and director but not picked), switch to the Corpus tab (key 4), hover the superseded status chip, and confirm the tooltip reads: passed validation but not selected — another candidate was picked for this surface
- Manual/visual: hover a picked chip and a failed chip and confirm each shows its respective tooltip string.
- Build/typecheck passes: run the project's existing build/typecheck for the harness (e.g. `pnpm --dir harness build` or the configured next build / tsc step) and confirm no type error from the new Record<CorpusItemVM['status'], string> constant.

### Gotchas

- This codebase has NO custom tooltip component — use the browser-native title attribute, matching FlowChip (PackageTabs.tsx line 357) and StageDots (atoms.tsx line 31). Do not introduce a tooltip library or new component.
- CorpusItemVM['status'] is the union 'picked' | 'superseded' | 'failed' declared at PackageTabs.tsx line 40 — type the lookup constant against it so a future status value forces a compile error rather than an undefined tooltip.
- Do NOT confuse the two status chips. Line 267 is the per-candidate corpus chip (picked/superseded/failed) — that is the target. Lines 324-326 are the SurfaceCard chip whose values are eligible/blocked/missing — NOT in scope and never shows superseded.
- Keep the visible chip text as the raw status word; the explanation lives only in the hover tooltip. Don't replace {c.status} with the long string — that breaks the compact chip layout and the corpus-status ${c.status} CSS coupling.
- Use a literal em dash (—) in the tooltip strings as shown; the source already uses em dashes elsewhere (e.g. FlowChip, line 396). This is plain UI copy and is unrelated to the validator's em-dash-density slop rule.

### Review notes (hardening pass — read before editing)

- GOTCHA CITATION WRONG (non-blocking): the gotcha says em dashes are used in 'FlowChip, line 396'. PackageTabs.tsx is only 362 lines and FlowChip is at lines 354-361. FlowChip contains NO em dash — it uses a middot (·): 'flow {flow.tag} · {flow.label}' and title 'vertical flow: ${flow.label}'. The line-396 reference does not exist. This is a bad precedent citation only; the instruction to use a literal em dash in the new tooltip strings is independently fine.
- EM-DASH PRECEDENT EXISTS ELSEWHERE (clarification): a real em-dash precedent in the same area is app/cards/[id]/page.tsx line 171 (reason string `${fails[0].rule} — ${fails[0].reason}`), and StageDots/atoms.tsx uses plain title attributes. The change does not depend on this, but the cited example is the wrong one.
- MINOR SEMANTIC PRECISION (non-blocking): the problem statement says superseded means 'director did not reject it', i.e. director_passed !== false (true OR null). The chosen tooltip 'passed validation but not selected — another candidate was picked for this surface' is safe because it omits the director clause; no fix needed, but worth noting the wording deliberately under-claims rather than asserting the director passed.

## Unit 2 — Make the "+N more tweets" / "+N" compact-preview markers clickable to expand inline

**id:** `expandable-more`  ·  **depends_on:** `[]`

### Files

- `/Users/opaque/.superset/projects/comms-factory/harness/components/design/SurfacePreview.tsx` — Edit ThreadPreview (lines 77-105) and CarouselPreview (lines 224-249) to add local expand state and make the +N markers clickable buttons.
- `/Users/opaque/.superset/projects/comms-factory/harness/app/globals.css` — Edit .pv-more (line 1592) and .pv-slide-more (line 1662) to give the clickable markers button affordance (cursor, hover); add an optional collapse-marker rule.

### Problem

In the harness compact surface previews, an X-thread that has more than 2 tweets renders a static "+N more tweets" caption, and a carousel with more than 2 slides renders a static "+N" tile. Operator reports these are NOT expandable/clickable — there is no way to see the hidden tweets/slides without leaving the compact view.

Concretely, in /Users/opaque/.superset/projects/comms-factory/harness/components/design/SurfacePreview.tsx:

ThreadPreview (lines 77-105) computes `const shown = variant === 'compact' ? tweets.slice(0, 2) : tweets;` (line 78) and then at lines 100-102 renders a non-interactive div:
```
      {variant === 'compact' && tweets.length > shown.length && (
        <div className="pv-more mono">+{tweets.length - shown.length} more tweets</div>
      )}
```

CarouselPreview (lines 224-249) computes `const shown = variant === 'compact' ? slides.slice(0, 2) : slides;` (line 225) and at lines 243-245 renders a non-interactive div:
```
        {variant === 'compact' && slides.length > shown.length && (
          <div className="pv-slide pv-slide-more mono">+{slides.length - shown.length}</div>
        )}
```

Neither has an onClick or any state, so the "+N" markers do nothing when clicked.

### Change

Add a local boolean `expanded` state (via the already-imported `useState`, see line 16) to BOTH ThreadPreview and CarouselPreview, and convert the static "+N" markers into `<button>` elements that toggle it. When `expanded` is true in compact variant, render all items and show a "collapse" affordance instead of "+N more".

=== ThreadPreview (replace the whole function body, lines 77-105) ===

Replace:
```
function ThreadPreview({ tweets, variant }: { tweets: string[]; variant: string }) {
  const shown = variant === 'compact' ? tweets.slice(0, 2) : tweets;
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
      {variant === 'compact' && tweets.length > shown.length && (
        <div className="pv-more mono">+{tweets.length - shown.length} more tweets</div>
      )}
    </div>
  );
}
```

With:
```
function ThreadPreview({ tweets, variant }: { tweets: string[]; variant: string }) {
  const [expanded, setExpanded] = useState(false);
  const compact = variant === 'compact';
  const shown = compact && !expanded ? tweets.slice(0, 2) : tweets;
  const hidden = tweets.length - shown.length;
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
      {compact && hidden > 0 && (
        <button type="button" className="pv-more mono" onClick={() => setExpanded(true)}>
          +{hidden} more {hidden === 1 ? 'tweet' : 'tweets'}
        </button>
      )}
      {compact && expanded && tweets.length > 2 && (
        <button type="button" className="pv-more pv-more-collapse mono" onClick={() => setExpanded(false)}>
          ▴ collapse
        </button>
      )}
    </div>
  );
}
```

=== CarouselPreview (replace the whole function body, lines 224-249) ===

Replace:
```
function CarouselPreview({ slides, variant }: { slides: { name: string; body: string }[]; variant: string }) {
  const shown = variant === 'compact' ? slides.slice(0, 2) : slides;
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
        {variant === 'compact' && slides.length > shown.length && (
          <div className="pv-slide pv-slide-more mono">+{slides.length - shown.length}</div>
        )}
      </div>
    </div>
  );
}
```

With:
```
function CarouselPreview({ slides, variant }: { slides: { name: string; body: string }[]; variant: string }) {
  const [expanded, setExpanded] = useState(false);
  const compact = variant === 'compact';
  const shown = compact && !expanded ? slides.slice(0, 2) : slides;
  const hidden = slides.length - shown.length;
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
        {compact && hidden > 0 && (
          <button type="button" className="pv-slide pv-slide-more mono" onClick={() => setExpanded(true)}>
            +{hidden}
          </button>
        )}
        {compact && expanded && slides.length > 2 && (
          <button type="button" className="pv-slide pv-slide-more mono" onClick={() => setExpanded(false)}>
            ▴
          </button>
        )}
      </div>
    </div>
  );
}
```

=== CSS (globals.css) ===

The existing `.pv-more` (line 1592) and `.pv-slide-more` (line 1662) are styled for `div`s; `<button>` inherits the browser default button chrome (background, border, padding, font), so reset it and add an interactive affordance.

Edit `.pv-more` at line 1592 from:
```
.pv-more { font-size: 11px; color: var(--ink-4); padding-left: 36px; }
```
to:
```
.pv-more { font-size: 11px; color: var(--ink-4); padding: 0 0 0 36px; background: none; border: 0; text-align: left; cursor: pointer; font-family: var(--font-mono); }
.pv-more:hover { color: var(--accent-ink); }
.pv-more-collapse { padding-left: 36px; }
```

Edit `.pv-slide-more` at line 1662 from:
```
.pv-slide-more { flex: 0 0 60px; display: grid; place-items: center; color: var(--ink-4); background: var(--canvas); }
```
to:
```
.pv-slide-more { flex: 0 0 60px; display: grid; place-items: center; color: var(--ink-4); background: var(--canvas); border: 1px solid var(--rule-strong); border-radius: var(--radius); cursor: pointer; font-family: var(--font-mono); font-size: 13px; }
.pv-slide-more:hover { color: var(--accent-ink); border-color: color-mix(in oklab, var(--accent), transparent 50%); }
```
(`.pv-slide-more` already carries the `pv-slide` class in the markup, which supplies `flex: 0 0 200px; border; border-radius; padding`; `.pv-slide-more` overrides the flex basis. As a button it still needs `background`/`border`/`cursor` reset which the `pv-slide` base + the additions above provide. Keep both classes on the element exactly as in the JSX above.)

### Acceptance criteria

- In a compact X-thread preview with >2 tweets (rendered by ThreadPreview, e.g. via PackageTabs corpus tab at /Users/opaque/.superset/projects/comms-factory/harness/components/design/PackageTabs.tsx:271), clicking the '+N more tweets' marker reveals all tweets inline and replaces the marker with a '▴ collapse' control.
- Clicking '▴ collapse' returns the thread to showing the first 2 tweets plus the '+N more tweets' marker.
- In a compact carousel preview with >2 slides, clicking the '+N' tile reveals all slides inline (horizontally scrollable in .pv-carousel-track) and replaces the '+N' tile with a '▴' collapse tile; clicking it collapses back to 2 slides.
- The '+N' markers are real <button type="button"> elements (keyboard-focusable, Enter/Space activatable) with no default browser button chrome — they read as the same muted text/tile as before but show a pointer cursor and accent-color on hover.
- Singular/plural is correct: a single hidden tweet reads '+1 more tweet', two or more read '+N more tweets'.
- The 'full' variant (variant='full', the default, used at PackageTabs.tsx:330) is unchanged — it already renders all tweets/slides and shows no '+N' marker; no expand/collapse control appears there.
- When structured payload is present, the same behavior applies (SurfacePreview routes structured 'thread'/'carousel' kinds through these same components at SurfacePreview.tsx:269-270).

### Tests

- Manual: run the harness dev server (pnpm dev in /Users/opaque/.superset/projects/comms-factory/harness), open a card detail page with a thread candidate of 3+ tweets, switch to the corpus tab, and confirm the '+N more tweets' button expands then collapses.
- Manual: same flow with a carousel candidate of 3+ slides; confirm the '+N' tile expands to all slides and the '▴' tile collapses.
- Manual a11y: Tab to the '+N' marker and press Enter — it must expand (confirms it's a real button, not a div).
- Type-check / build: from /Users/opaque/.superset/projects/comms-factory/harness run the project's typecheck/lint (e.g. pnpm build or pnpm tsc --noEmit) and confirm no new TypeScript or ESLint errors are introduced by the added useState hooks and button elements.

### Gotchas

- useState is ALREADY imported at SurfacePreview.tsx:16 (`import { useMemo, useState } from 'react';`) and the file already has 'use client' at line 1 — do NOT re-add the import or the directive.
- Hooks must be called unconditionally at the top of each component (Rules of Hooks). Put `const [expanded, setExpanded] = useState(false);` as the first line of ThreadPreview/CarouselPreview, before any early return or branching. These components currently have no early returns, so just add it at the top of the body.
- `tweets.length` (not `shown.length`) is the canonical total used for the '1/N' index labels at SurfacePreview.tsx:91-93 — keep using `tweets.length` for the total in the index labels; only the rendered slice changes. Same for `slides.length` in the carousel num label at lines 233-235.
- The carousel '+N' element MUST keep BOTH classes `pv-slide pv-slide-more` (the `pv-slide` base from globals.css line 1653 supplies the flex/border/padding the tile relies on; `pv-slide-more` overrides flex-basis to 60px). Dropping `pv-slide` will break the tile layout.
- `.pv-more` and `.pv-slide-more` were authored for <div>; switching to <button> pulls in default UA button styling (gray background, border, centered text, inherited-but-different font). The CSS edits in this spec reset those (background:none/border, text-align, font-family) — apply them or the markers will look like raw form buttons.
- Do NOT add stopPropagation: the compact preview's parent in PackageTabs (`div.corpus-card` at PackageTabs.tsx:254) has no onClick, so there's no click-through to suppress. Adding it would be dead code (repo style: no handling for impossible scenarios).
- Keep `variant` typed as `string` exactly as the existing signatures (`{ tweets: string[]; variant: string }`) — do not narrow it; SurfacePreview passes 'full' | 'compact' but the child components accept the looser `string` and the `compact` local derives from it.
- Edge case: if a compact thread/carousel has exactly 2 or fewer items, `hidden` is 0 and no '+N' button renders — preserve this (the `hidden > 0` guard handles it). The collapse button is guarded by `tweets.length > 2` / `slides.length > 2` so it never appears when there was nothing to expand.

### Review notes (hardening pass — read before editing)

- The spec's stated rationale for the CSS reset is factually wrong for this codebase. The gotcha and the CSS section claim that switching <div> to <button> 'pulls in default UA button styling (gray background, border, centered text, inherited-but-different font)' that must be reset. But harness/app/globals.css lines 122-129 already contain a GLOBAL `button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; padding: 0; }` reset, plus a `button:focus-visible` ring at lines 130-136. UA button chrome is already neutralized app-wide. The premise behind the prescribed CSS edits is therefore misleading.
- Consequence of the above: several proposed CSS additions are redundant (harmless, not breaking). In `.pv-more`: `background: none`, `border: 0`, `cursor: pointer`, and `font-family: var(--font-mono)` duplicate the global button reset and the `mono` class (`.mono { font-family: var(--font-mono) }` at line 238) already on the element. In `.pv-slide-more`: `cursor` and `font-family` duplicate the global reset/`mono` class, and `border: 1px solid var(--rule-strong); border-radius: var(--radius)` duplicate what the retained `.pv-slide` base class already supplies (globals.css line 1653-1656). The `.pv-slide-more` gotcha's claim that 'as a button it still needs background/border/cursor reset' is not true — the global reset handles it.
- Minor: `.pv-slide` (line 1653) sets `padding: 14px`; the global button reset sets `padding: 0`. Because `.pv-slide` is more specific/later it wins, so the +N button tile keeps its 14px padding. The spec does not call this out but the outcome is correct; no fix needed, noting only that the interaction is non-obvious.

## Unit 3 — Show failed candidate text inline in the Failures view

**id:** `failures-show-text`  ·  **depends_on:** `[]`

### Files

- `/Users/opaque/.superset/projects/comms-factory/harness/components/design/PackageTabs.tsx` — PRIMARY — the Failures tab renders blocked surfaces but omits the candidate text; add a SurfacePreview render of the failed text here
- `/Users/opaque/.superset/projects/comms-factory/harness/app/cards/[id]/page.tsx` — REFERENCE ONLY — confirms SurfaceRowVM.text / structuredJson are already populated (lines 137-147); do NOT edit unless adding a missing field
- `/Users/opaque/.superset/projects/comms-factory/harness/lib/package-view.ts` — REFERENCE ONLY — buildPackageView already joins the best candidate (r.candidate) per surface; the candidate text/structured_json reach page.tsx from here. No edit needed
- `/Users/opaque/.superset/projects/comms-factory/harness/components/design/SurfacePreview.tsx` — REFERENCE ONLY — the structured/text renderer reused for the inline preview; exports SurfacePreview({surface, data:{text, structuredJson}, variant})

### Problem

The Failures tab (tab id `failures`) in `harness/components/design/PackageTabs.tsx` shows, for each blocked surface, the failure REASON (`s.blockReason`) across two lanes (DET regex / JUDG director) plus a "read" action line — but it never shows the actual failed candidate TEXT. The operator reads "Director — content/tone not publication-ready." with no way to see WHICH copy was rejected, forcing a jump to the Corpus tab to correlate. The candidate text is already available: each `SurfaceRowVM` carries `text: string` and `structuredJson: string | null` (interface at PackageTabs.tsx:22-32), populated in `app/cards/[id]/page.tsx:137-147` from `r.candidate?.text` / `r.candidate?.structured_json`, where `r.candidate` is the best (latest-passing-else-latest) candidate joined per surface by `buildPackageView` in `lib/package-view.ts:69-75`. So the join `candidates.text → failures view model` is ALREADY done end-to-end; the Failures render just discards it. This is a render-only fix in PackageTabs.tsx — no queries.ts or page.tsx change is required.

### Change

Render the failed candidate's text inline in each blocker card in the Failures tab of `harness/components/design/PackageTabs.tsx`, reusing the existing `SurfacePreview` component (already imported at line 12: `import { SurfacePreview } from './SurfacePreview';`).

In the `{tab === 'failures' && (...)}` block, inside the `blocked.map((s) => (...))` body, the current blocker card is:

```tsx
<div key={s.surface} className="blocker">
  <div className="blocker-head">
    <span className="blocker-id">
      <SurfaceGlyph surface={s.surface} />
      <span className="surf-name">{SURFACE_META[s.surface].label}</span>
    </span>
    <span className="lane-verdict fail">blocked</span>
  </div>
  <div className="blocker-lanes">
    ...
  </div>
  {s.blockReason && (
    <div className="blocker-action">
      <span className="blocker-action-lab">read</span>
      <span className="blocker-action-txt">{s.blockReason}</span>
    </div>
  )}
</div>
```

Insert a candidate-text preview block BETWEEN the `</div>` that closes `blocker-head` and the `<div className="blocker-lanes">` opening tag. Use the same `SurfacePreview` invocation shape the Corpus tab uses at PackageTabs.tsx:271:

```tsx
{s.text ? (
  <div className="blocker-preview">
    <SurfacePreview
      surface={s.surface}
      data={{ text: s.text, structuredJson: s.structuredJson }}
      variant="compact"
    />
  </div>
) : (
  <div className="blocker-preview muted text-xs">No candidate text captured for this surface.</div>
)}
```

Exact insertion point — the lines as they currently read:

```tsx
                  <span className="lane-verdict fail">blocked</span>
                </div>
                <div className="blocker-lanes">
```

become:

```tsx
                  <span className="lane-verdict fail">blocked</span>
                </div>
                {s.text ? (
                  <div className="blocker-preview">
                    <SurfacePreview
                      surface={s.surface}
                      data={{ text: s.text, structuredJson: s.structuredJson }}
                      variant="compact"
                    />
                  </div>
                ) : (
                  <div className="blocker-preview muted text-xs">No candidate text captured for this surface.</div>
                )}
                <div className="blocker-lanes">
```

No other code changes. `SurfaceRowVM.text` and `SurfaceRowVM.structuredJson` already exist on the interface (PackageTabs.tsx:25,26) and are already passed from page.tsx — no new prop plumbing, no queries.ts change, no type change.

### Acceptance criteria

- In the Failures tab, each blocked surface card displays the rejected candidate's rendered copy (via SurfacePreview) directly under the surface-name header and above the DET/JUDG lane results.
- The text shown is the same best-candidate text that buildPackageView selected for that surface (r.candidate.text), i.e. it matches what the Package tab's SurfaceCard shows for that same blocked surface.
- For a blocked surface whose candidate has a structured payload (web-card / thread / carousel), the preview renders the structured mockup (not raw JSON), because SurfacePreview is given structuredJson; for a plain-text surface (x / modal / blog / in-product) it renders the text mockup.
- When s.text is empty, a muted 'No candidate text captured for this surface.' line is shown instead of a broken/empty preview.
- The existing two-lane (DET regex / JUDG director) verdicts and the 'read' blockReason action line are unchanged and still present below the new preview.
- The 'No blockers.' empty state (blocked.length === 0) is unchanged.
- Only PackageTabs.tsx is modified; no changes to queries.ts, package-view.ts, or page.tsx.

### Tests

- Build/typecheck the harness: from /Users/opaque/.superset/projects/comms-factory/harness run `pnpm tsc --noEmit` (or `pnpm build`) and confirm no new type errors — SurfacePreview's data prop type is { text: string; structuredJson?: string | null } and s.text/s.structuredJson satisfy it.
- Manual: start the harness dev server (`pnpm dev` in harness/), open a card detail page that has at least one blocked surface (e.g. a surface where director_passed === false or validation_passed === false), click the Failures tab (key 2), and confirm the rejected copy renders inside each blocker card above the lane verdicts.
- Manual: confirm a card with a blocked structured surface (web/x-thread/carousel) shows the structured mockup, and a card with a blocked plain-text surface (x/modal/blog) shows the text mockup.
- Manual regression: a card with no blocked surfaces still shows the 'No blockers.' card; the Package and Corpus tabs are visually unchanged.

### Gotchas

- Do NOT add a join in queries.ts — the candidate text is already on SurfaceRowVM. The task title says 'join candidates.text into the failures view model' but that join already exists via buildPackageView (lib/package-view.ts:69 picks r.candidate) and page.tsx:140 (text: r.candidate?.text ?? ''). The only missing piece is rendering it. Adding a new SQL join would be redundant and risk diverging from the best-candidate selection logic.
- SurfacePreview is a 'use client' component and PackageTabs.tsx is already 'use client' (line 1) and already imports SurfacePreview (line 12) — no new import needed.
- Match the Corpus tab's call exactly (PackageTabs.tsx:271): data={{ text: c.text, structuredJson: c.structuredJson }} with variant="compact". The Failures equivalent uses s.text / s.structuredJson. variant="compact" is important so threads/carousels truncate (+N more) rather than rendering full-height in the blocker card.
- s.blockReason is null when state !== 'blocked', but in the Failures tab `blocked` is pre-filtered to state === 'blocked' (PackageTabs.tsx:90), so blockReason is generally populated; do not gate the preview on blockReason — gate it on s.text only.
- The 'blocker-preview' className is new; if no CSS exists for it the preview still renders (SurfacePreview brings its own pv-* styling). Optional: a minimal wrapper margin can be added to globals.css, but it is not required for correctness — keep scope to PackageTabs.tsx unless a spacing issue is observed.
- Keep the SurfaceGlyph and SURFACE_META imports as-is; they are already imported (line 11, 14).

### Review notes (hardening pass — read before editing)

- AC3 phrasing is slightly imprecise: it frames the structured-vs-text split as driven by 'whether the candidate has a structured payload', but SurfacePreview (SurfacePreview.tsx:266-280) renders by structured payload kind FIRST and only then falls back per surface label. A web surface with no structured_json still renders a web-card mockup (via webCardFromText, line 276) and an x-thread with no structured_json still renders a thread mockup (via splitTweets, line 274). So 'structured mockup' will appear for web/x-thread/carousel even when structuredJson is null. Non-blocking — does not affect the code change, only the precision of the manual-test expectation.
- Cosmetic: the task title and the 'change' text imply a join may be needed ('join candidates.text into the failures view model'), but no join is needed. The spec already flags this contradiction explicitly in the first gotcha and resolves it correctly (the join exists end-to-end via package-view.ts:69-75 -> page.tsx:140). I verified r.candidate selection and text mapping are present. Not a defect, just noting the title is self-contradictory and the gotcha is what to trust.

## Unit 4 — Add tooltip to the director Gate badge surfacing director_audit_json reject reasons

**id:** `director-fail-hover`  ·  **depends_on:** `[]`

### Files

- `/Users/opaque/.superset/projects/comms-factory/harness/components/design/atoms.tsx` — Add an optional `title` prop to the Gate component and bind it to the rendered span's HTML `title` attribute (native hover tooltip).
- `/Users/opaque/.superset/projects/comms-factory/harness/components/design/PackageTabs.tsx` — Carry a `directorReasons: string | null` field on SurfaceRowVM and CorpusItemVM; pass it as `title` on each director Gate. Also surface it as the director-lane body text on the Failures tab.
- `/Users/opaque/.superset/projects/comms-factory/harness/app/cards/[id]/page.tsx` — Parse `director_audit_json` into a reasons string when building the surface/corpus view models, and populate the new `directorReasons` field.

### Problem

On the package-review screen (harness/app/cards/[id]/page.tsx), each candidate surface renders a "director" Gate badge via the `Gate` component in harness/components/design/atoms.tsx. When the director audit fails, the badge shows only `✕ director fail` with no way to see WHY. The reject reasons already exist in the persisted `director_audit_json` (the raw DirectorAudit object serialized at harness/app/actions/generate.ts:972 and :995 via `JSON.stringify(record.director_audit)`), which contains `voice_issues: string[]`, `factual_issues: string[]`, `publication_gate_issues?: string[]`, and `infinex_fit.reason: string`. The Gate component currently has no way to surface these. Operators have to dig into the Debug tab / CandidateCard to find the reason.

The Gate component today (atoms.tsx:50-66) takes only `register`, `passed`, `label` — no tooltip support:
```tsx
export function Gate({
  register,
  passed,
  label,
}: {
  register: 'regex' | 'director';
  passed: boolean;
  label: string;
}) {
  return (
    <span className={`gate ${register} ${passed ? 'pass' : 'fail'}`}>
```
The director Gate is rendered in three places in PackageTabs.tsx (the SurfaceCard footer at line 338-340, the Corpus tab at line 264-266) with no reason data threaded through. The view models that feed it (SurfaceRowVM at PackageTabs.tsx:22-32, CorpusItemVM at :34-45) carry `directorPassed` but not the reasons.

### Change

Three coordinated edits. All field/prop names below are exact.

=== EDIT 1: harness/components/design/atoms.tsx — add optional `title` to Gate ===
Replace the Gate signature and its returned span's opening tag (currently lines 50-60):
```tsx
export function Gate({
  register,
  passed,
  label,
}: {
  register: 'regex' | 'director';
  passed: boolean;
  label: string;
}) {
  return (
    <span className={`gate ${register} ${passed ? 'pass' : 'fail'}`}>
```
with:
```tsx
export function Gate({
  register,
  passed,
  label,
  title,
}: {
  register: 'regex' | 'director';
  passed: boolean;
  label: string;
  /** Native hover tooltip — e.g. director reject reasons. Undefined renders no title attr. */
  title?: string;
}) {
  return (
    <span className={`gate ${register} ${passed ? 'pass' : 'fail'}`} title={title}>
```
Do NOT change the rest of the component body (the three inner spans `gate-icon`/`gate-lab`/`gate-val` stay as-is). Passing `title={undefined}` renders no `title` attribute in React, which is the desired no-op for the regex Gate and for passing director gates with no reasons.

=== EDIT 2: harness/app/cards/[id]/page.tsx — parse reasons + populate VM field ===
(2a) Add a parse helper next to the other parse helpers (after `parseBeats`, which ends at line 342). Insert this new function:
```tsx
function directorReasons(json: string | null): string | null {
  if (!json) return null;
  try {
    const a = JSON.parse(json) as {
      voice_issues?: string[];
      factual_issues?: string[];
      publication_gate_issues?: string[];
      infinex_fit?: { legal?: boolean; reason?: string };
    };
    const lines: string[] = [];
    if (a.infinex_fit && a.infinex_fit.legal === false && a.infinex_fit.reason) {
      lines.push(`placement: ${a.infinex_fit.reason}`);
    }
    for (const v of a.voice_issues ?? []) lines.push(`voice: ${v}`);
    for (const f of a.factual_issues ?? []) lines.push(`fact: ${f}`);
    for (const p of a.publication_gate_issues ?? []) lines.push(`publication: ${p}`);
    return lines.length > 0 ? lines.join('\
') : null;
  } catch {
    return null;
  }
}
```
Notes on shape: the serialized DirectorAudit's `voice_issues`, `factual_issues`, and `publication_gate_issues` are arrays of plain strings (see the type at harness/components/CandidateCard.tsx:104-106). `infinex_fit` is `{ legal: boolean; reason: string; nearest_allowed_read?: string }`. Mirror the placement-prefix convention already used in harness/app/actions/director.ts:163-166.

(2b) In the `surfaceVMs` map (currently lines 137-147), add the new field. The object literal currently ends:
```tsx
    flow: flowBadge(r.candidate?.prompt_variant ?? null),
    blockReason: r.blockReason,
  }));
```
Add `directorReasons` before `blockReason`:
```tsx
    flow: flowBadge(r.candidate?.prompt_variant ?? null),
    directorReasons: directorReasons(r.candidate?.director_audit_json ?? null),
    blockReason: r.blockReason,
  }));
```

(2c) In the `corpusVMs` map (currently lines 150-173), the returned object ends:
```tsx
        flow: flowBadge(c.prompt_variant),
        reason: !c.validation_passed && fails[0] ? `${fails[0].rule} — ${fails[0].reason}` : null,
      };
```
Add `directorReasons` before `reason`:
```tsx
        flow: flowBadge(c.prompt_variant),
        directorReasons: directorReasons(c.director_audit_json),
        reason: !c.validation_passed && fails[0] ? `${fails[0].rule} — ${fails[0].reason}` : null,
      };
```
(`HarnessCandidate.director_audit_json` is `string | null` — see harness/lib/types.ts:86 — so for corpus pass it directly; for surfaces the candidate may be null so use the `?? null` form above.)

=== EDIT 3: harness/components/design/PackageTabs.tsx — thread field + pass title ===
(3a) Add `directorReasons: string | null;` to the SurfaceRowVM interface. The interface currently ends (lines 30-32):
```tsx
    flow: FlowBadge | null;
    blockReason: string | null;
  }
```
Make it:
```tsx
    flow: FlowBadge | null;
    directorReasons: string | null;
    blockReason: string | null;
  }
```

(3b) Add `directorReasons: string | null;` to the CorpusItemVM interface. It currently ends (lines 43-45):
```tsx
    flow: FlowBadge | null;
    reason: string | null;
  }
```
Make it:
```tsx
    flow: FlowBadge | null;
    directorReasons: string | null;
    reason: string | null;
  }
```

(3c) In the Corpus tab, the director Gate currently (lines 264-266):
```tsx
                  {c.directorPassed != null && (
                    <Gate register="director" passed={c.directorPassed} label="director" />
                  )}
```
becomes:
```tsx
                  {c.directorPassed != null && (
                    <Gate register="director" passed={c.directorPassed} label="director" title={c.directorReasons ?? undefined} />
                  )}
```

(3d) In `SurfaceCard`, the director Gate currently (lines 338-340):
```tsx
          {row.directorPassed != null && (
            <Gate register="director" passed={row.directorPassed} label="director" />
          )}
```
becomes:
```tsx
          {row.directorPassed != null && (
            <Gate register="director" passed={row.directorPassed} label="director" title={row.directorReasons ?? undefined} />
          )}
```

(3e) (Failures tab enrichment.) In the blocked-surface director lane body (lines 190-194), the body currently falls back to a generic string when `blockReason` is absent. Prefer the parsed director reasons there. Current:
```tsx
                    <div className="lane-result-body director-quote">
                      {s.directorPassed === false
                        ? s.blockReason ?? 'Director rejected content/tone.'
                        : 'Director read it as publication-ready.'}
                    </div>
```
becomes:
```tsx
                    <div className="lane-result-body director-quote">
                      {s.directorPassed === false
                        ? s.directorReasons ?? s.blockReason ?? 'Director rejected content/tone.'
                        : 'Director read it as publication-ready.'}
                    </div>
```
This keeps `blockReason` as the fallback so regex-blocked surfaces (where directorPassed isn't false) are unaffected.

### Acceptance criteria

- The `Gate` component in harness/components/design/atoms.tsx accepts an optional `title?: string` prop and renders it as the `title` attribute on the outer `<span className="gate ...">`. When `title` is undefined, no `title` attribute appears in the DOM.
- SurfaceRowVM and CorpusItemVM in harness/components/design/PackageTabs.tsx each declare a `directorReasons: string | null` field.
- harness/app/cards/[id]/page.tsx populates `directorReasons` on both surfaceVMs and corpusVMs by parsing the candidate's `director_audit_json` via the new `directorReasons(json)` helper.
- The parsed reasons string concatenates (newline-joined) any `infinex_fit.reason` (only when `infinex_fit.legal === false`, prefixed `placement:`), `voice_issues` (prefixed `voice:`), `factual_issues` (prefixed `fact:`), and `publication_gate_issues` (prefixed `publication:`). Returns null when the JSON is null/unparseable or yields no lines.
- Both director Gate usages in PackageTabs.tsx (SurfaceCard footer and Corpus tab) pass `title={... ?? undefined}` from the VM's `directorReasons`. The regex Gate usages are left with no `title` prop.
- Hovering a failing director badge on the Package or Corpus tab shows a native browser tooltip listing the director's reject reasons.
- The Failures tab director lane body prefers `s.directorReasons` over `s.blockReason` when the director failed, falling back to the existing generic strings.
- `pnpm tsc --noEmit` (or the harness build) passes — no type errors from the new field/prop.

### Tests

- Typecheck: run `pnpm --dir harness tsc --noEmit` (or `pnpm --dir harness build`) and confirm no new TypeScript errors — adding the required `directorReasons` field to both VM interfaces will fail to compile if either the page.tsx surfaceVMs or corpusVMs map omits it, which is the intended compile-time guard.
- Manual: load a card detail page that has at least one director-failed candidate (a card with a non-null `director_audit_json` whose audit failed), hover the red `✕ director fail` badge on the Package tab surface card and on the Corpus tab, and confirm the native tooltip shows the voice/factual/publication/placement reasons (newline-separated).
- Manual negative: hover a passing director badge (`◆ director pass`) — no tooltip should appear (title is undefined). Hover a `regex` badge — no tooltip (regex Gate gets no title prop).
- Manual: open the Failures tab for a director-blocked surface and confirm the 'Director / content-tone' lane body shows the parsed reasons rather than the generic 'Director rejected content/tone.' placeholder.

### Gotchas

- The `director_audit_json` persisted on candidates is the RAW DirectorAudit object (serialized at harness/app/actions/generate.ts:972 and :995 via `JSON.stringify(record.director_audit)`), NOT the DirectorCheckResult shape produced in harness/app/actions/director.ts. So `voice_issues`/`factual_issues`/`publication_gate_issues` are top-level string arrays and `infinex_fit` is a nested object — do not look for director.ts's `voice.issues`/`fact.issues` nesting here.
- In this serialized shape `voice_issues` is `string[]` (see harness/components/CandidateCard.tsx:106), NOT the `{line,rule,fix}[]` object array that appears elsewhere. Treat each element as a plain string; do not index `.line`/`.rule`.
- `publication_gate_issues` is optional (`?: string[]`) — guard with `?? []`.
- Only prefix the infinex_fit reason when `legal === false`; a legal placement may still carry a `reason` string you don't want to surface as a failure.
- `title={c.directorReasons}` would pass `null`, and React renders `title="null"` — must coerce with `?? undefined` so no attribute is rendered when there are no reasons.
- Don't add a `title` prop to the regex Gate usages (PackageTabs.tsx:263 and :337) — they intentionally have no tooltip; leaving the prop off renders no attribute.
- For surfaceVMs the candidate can be null (missing surface), so call the helper with `r.candidate?.director_audit_json ?? null`; for corpusVMs every item has a candidate so pass `c.director_audit_json` directly (it is `string | null`).
- Newlines in an HTML `title` attribute are rendered as line breaks by most browsers in the native tooltip — use `
` join (this matches the existing pattern in atoms.tsx StageDots line 31 which joins its title with `
`).
- Do not collapse this into the generator/validator or add a new validator rule — this is a presentational view-model change only; the reasons already exist in persisted state.

### Review notes (hardening pass — read before editing)

- Test command nit (non-blocking): 'pnpm --dir harness tsc --noEmit' won't run as written — 'tsc' is not a pnpm script. The harness package.json defines a 'typecheck' script ('next typegen && tsc --noEmit'). Codex should use 'pnpm --dir harness typecheck' (or 'pnpm --dir harness exec tsc --noEmit', or the offered fallback 'pnpm --dir harness build'). The spec's alternative 'pnpm --dir harness build' is valid, so this does not block.
- Minor over-defensiveness (harmless): the gotcha claims 'title={c.directorReasons} would pass null and React renders title="null"'. React actually omits the title attribute for both null and undefined. The '?? undefined' coercion is still correct and recommended, so no change needed — just noting the rationale is slightly inaccurate.

## Unit 5 — Render the actor's DECLARED channel beat plans in the Throughline tab (declared-vs-audited side by side)

**id:** `show-beats`  ·  **depends_on:** `[]`

### Files

- `/Users/opaque/.superset/projects/comms-factory/harness/app/cards/[id]/page.tsx` — Build the Throughline VMs: import DeclaredBeatVM from PackageTabs (extend existing import at lines 17-22), add a declared-beats parser that reads the latest actor attempt's channel_beat_plans (no local interface), and join it per surface to the existing audited beats. EDIT the import block (17-22), lines 176-179 (throughlineVMs), and add the helper after parseBeats (334-342).
- `/Users/opaque/.superset/projects/comms-factory/harness/components/design/PackageTabs.tsx` — Sole declaration site for DeclaredBeatVM (define + export it before ThroughlineBeatVM at lines 47-50), extend ThroughlineBeatVM with a declaredBeats field, and render the declared plan in the Throughline tab body (lines 209-248). EDIT the interfaces and the `tab === 'throughline'` ladder rows.
- `/Users/opaque/.superset/projects/comms-factory/harness/lib/types.ts` — Reference only — TableWork.channel_beat_plans is typed `unknown` at line 146; the parser casts it. HarnessActorAttempt.table_work_json (line 129) is the source field; HarnessCandidate.channel (line 71) is the lookup key. No edit required.
- `/Users/opaque/.superset/projects/comms-factory/harness/lib/surfaces.ts` — Reference only — surfaceOfCandidate (lines 59-64) is the x→x-thread fallback that makes SurfaceKind diverge from Channel; explains why the plan lookup must use candidate.channel, not surface.
- `/Users/opaque/.superset/projects/comms-factory/src/actor-director.ts` — Reference only — ActorBeatPlan shape at lines 37-45; parse/validation at parseBeatPlanArray (1358-1374). Do NOT import from src into the harness; replicate the minimal field shape inline in the parser.

### Problem

The Throughline tab shows beats per surface, but it reads ONLY the validator's beat_audit_json — which is frequently empty for actor-driven candidates and, when populated, is keyed on tempo classifications, not the actor's intent. The actor's actual DECLARED beat plan (the verb / working-action / micro-objective sequence it authored per channel) lives in `actor_attempts.table_work_json` under `channel_beat_plans[channel]` and is NEVER surfaced in the UI.

Concretely, in `harness/app/cards/[id]/page.tsx`:

- Throughline VMs are built at lines 176-179:
```
const throughlineVMs: ThroughlineBeatVM[] = pkg.rows.map((r) => ({
  surface: r.surface,
  beats: parseBeats(r.candidate?.beat_audit_json),
}));
```
- `parseBeats` (lines 334-342) only understands the validator audit shape:
```
function parseBeats(json: string | undefined): { tempo: string; passed: boolean }[] {
  if (!json) return [];
  try {
    const arr = JSON.parse(json) as Array<{ declared_tempo?: string; classified_tempo?: string; passed?: boolean }>;
    return arr.map((b) => ({ tempo: b.declared_tempo ?? b.classified_tempo ?? '?', passed: Boolean(b.passed) }));
  } catch {
    return [];
  }
}
```
When `beat_audit_json` is `[]` (the common case for actor runs), the Throughline tab renders "no beats" even though the actor declared a full plan. The plan exists in `detail.actor_attempts[*].table_work_json` → `channel_beat_plans` but is dropped on the floor.

The actor beat-plan shape (confirmed in DB and in `src/actor-director.ts:37-45` / `parseBeatPlanArray` at 1358-1374, ActorBeatPlan) is, per channel:
```
{ verb: string, working_action: string, physical_score: string,
  micro_objective: string, obstacle_local: string,
  preparation_from?: string, shadow_move?: string }
```
`channel_beat_plans` is keyed by the raw `Channel` (x, x-thread, web, in-product, modal, blog, carousel), confirmed by `sqlite3 harness.db "SELECT json_extract(table_work_json,'$.channel_beat_plans.web') ..."` returning the array above.

The fix: surface the actor's declared beats per surface, alongside the audited beats when present, so the operator sees declared-vs-audited side by side.

### Change

Make the Throughline tab show the actor's DECLARED channel beat plan per surface, joined alongside the validator's audited beats.

SINGLE SOURCE OF TRUTH FOR THE TYPE: `DeclaredBeatVM` is defined and exported EXACTLY ONCE, in `harness/components/design/PackageTabs.tsx` (step 3). `page.tsx` imports it from there (step 1). There must be NO local `interface DeclaredBeatVM` in page.tsx in the shipped diff — if a draft adds one, delete it before finishing. This is the required fix; do not ship two declarations of the same type name.

**Step 1 — page.tsx — import the shared type, then add a declared-beats parser**

page.tsx already imports from `@/components/design/PackageTabs` at lines 17-22:
```ts
import {
  PackageTabs,
  type CorpusItemVM,
  type SurfaceRowVM,
  type ThroughlineBeatVM,
} from '@/components/design/PackageTabs';
```
EXTEND that existing import block (do not add a second import line) to also pull `DeclaredBeatVM`:
```ts
import {
  PackageTabs,
  type CorpusItemVM,
  type DeclaredBeatVM,
  type SurfaceRowVM,
  type ThroughlineBeatVM,
} from '@/components/design/PackageTabs';
```

`detail.actor_attempts` is already destructured (it is `actor_attempts` in the destructure at lines 112-122). Pick the latest attempt by `attempt` number (highest), parse its `table_work_json`, and read `channel_beat_plans`.

Add a new helper next to `parseBeats` (after line 342). Do NOT declare a local `interface DeclaredBeatVM` here — use the type imported from PackageTabs above:
```ts
/** Latest actor attempt's declared channel_beat_plans, keyed by raw Channel. */
function declaredBeatsByChannel(
  actorAttempts: HarnessActorAttempt[],
): Partial<Record<Channel, DeclaredBeatVM[]>> {
  if (actorAttempts.length === 0) return {};
  const latest = actorAttempts.reduce((m, x) => (x.attempt > m.attempt ? x : m), actorAttempts[0]);
  let plans: Record<string, unknown>;
  try {
    const tw = JSON.parse(latest.table_work_json) as { channel_beat_plans?: Record<string, unknown> };
    plans = tw.channel_beat_plans ?? {};
  } catch {
    return {};
  }
  const out: Partial<Record<Channel, DeclaredBeatVM[]>> = {};
  for (const [channel, value] of Object.entries(plans)) {
    if (!Array.isArray(value)) continue;
    out[channel as Channel] = value.flatMap((b) => {
      if (!b || typeof b !== 'object') return [];
      const row = b as Record<string, unknown>;
      if (typeof row.verb !== 'string') return [];
      return [{
        verb: row.verb,
        workingAction: typeof row.working_action === 'string' ? row.working_action : '?',
        microObjective: typeof row.micro_objective === 'string' ? row.micro_objective : '',
        obstacleLocal: typeof row.obstacle_local === 'string' ? row.obstacle_local : '',
        preparationFrom: typeof row.preparation_from === 'string' ? row.preparation_from : null,
      }];
    });
  }
  return out;
}
```

**Step 2 — page.tsx — join declared beats per surface into the Throughline VMs**

The Throughline iterates `pkg.rows`, whose `.surface` is a `SurfaceKind`. SurfaceKind equals Channel EXCEPT the x→x-thread fallback in `surfaceOfCandidate` (lib/surfaces.ts:59-64): an `x` candidate with no structured payload and multi-tweet text renders as surface `x-thread`. `channel_beat_plans` is keyed by the candidate's UNDERLYING channel, not the surface. So the lookup key must be the row candidate's raw `channel`, falling back to the surface when there is no candidate.

Replace lines 176-179:
```ts
  // ── Throughline VMs (beats per surface, from best candidate) ─────────────
  const throughlineVMs: ThroughlineBeatVM[] = pkg.rows.map((r) => ({
    surface: r.surface,
    beats: parseBeats(r.candidate?.beat_audit_json),
  }));
```
with:
```ts
  // ── Throughline VMs (declared + audited beats per surface) ───────────────
  const declaredPlans = declaredBeatsByChannel(actor_attempts);
  const throughlineVMs: ThroughlineBeatVM[] = pkg.rows.map((r) => {
    const lookupChannel = (r.candidate?.channel ?? r.surface) as Channel;
    return {
      surface: r.surface,
      declaredBeats: declaredPlans[lookupChannel] ?? [],
      beats: parseBeats(r.candidate?.beat_audit_json),
    };
  });
```

**Step 3 — PackageTabs.tsx — define + export DeclaredBeatVM (sole declaration) and extend ThroughlineBeatVM**

This file is the ONE place `DeclaredBeatVM` is declared. Add an exported `DeclaredBeatVM` interface immediately before `ThroughlineBeatVM` (lines 47-50) and add the `declaredBeats` field to `ThroughlineBeatVM`:
```ts
export interface DeclaredBeatVM {
  verb: string;
  workingAction: string;
  microObjective: string;
  obstacleLocal: string;
  preparationFrom: string | null;
}

export interface ThroughlineBeatVM {
  surface: SurfaceKind;
  declaredBeats: DeclaredBeatVM[];
  beats: { tempo: string; passed: boolean }[];
}
```
`page.tsx` imports `DeclaredBeatVM` from this module (step 1). Confirm with grep that `interface DeclaredBeatVM` appears exactly once in the harness (in this file) after the change — if it also appears in page.tsx, the step-1 local interface was not deleted; delete it.

**Step 4 — PackageTabs.tsx — render the declared plan**

In the `tab === 'throughline'` block, update the copy and each ladder row to show the declared plan as the primary content, with the audited tempo chips as the secondary (verification) row.

Update the sub-line at lines 217-220 to reflect that declared beats are now shown even when no audit exists:
```tsx
              <div className="coherence-sub muted">
                The actor-declared beat plan per surface (verb · working-action), with
                validator tempo classification when present.
              </div>
```

Replace the per-row body (lines 228-243, the `ladder-row` map) so each row renders the declared beats then the audited chips. The existing `ladder-main` grid + `SurfaceGlyph` header is kept; the right column becomes a stack:
```tsx
            {throughline.map((t) => (
              <div key={t.surface} className="ladder-row">
                <div className="ladder-main" style={{ gridTemplateColumns: '160px 1fr' }}>
                  <span className="ladder-id">
                    <SurfaceGlyph surface={t.surface} />
                    <span className="surf-name">{SURFACE_META[t.surface].label}</span>
                  </span>
                  <div className="space-y-2">
                    {t.declaredBeats.length === 0 && t.beats.length === 0 && (
                      <span className="muted-2 mono text-xs">no beats declared</span>
                    )}
                    {t.declaredBeats.length > 0 && (
                      <div className="beat-chips">
                        {t.declaredBeats.map((b, i) => (
                          <span
                            key={i}
                            className="beat-chip"
                            title={[
                              b.microObjective && `objective: ${b.microObjective}`,
                              b.obstacleLocal && `obstacle: ${b.obstacleLocal}`,
                              b.preparationFrom && `prep from: ${b.preparationFrom}`,
                            ].filter(Boolean).join(' · ')}
                          >
                            <span className="idx">{i + 1}</span>
                            {b.verb}
                            <span className="muted-2"> · {b.workingAction}</span>
                          </span>
                        ))}
                      </div>
                    )}
                    {t.beats.length > 0 && (
                      <div className="beat-chips">
                        <span className="muted-2 mono text-xs" style={{ alignSelf: 'center' }}>audited</span>
                        {t.beats.map((b, i) => (
                          <span key={i} className={`beat-chip ${b.passed ? 'pass' : 'fail'}`}>
                            <span className="idx">{i + 1}</span>
                            {b.tempo}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
```
Keep the `throughline.length === 0` empty-state at lines 224-226 unchanged.

The declared chips intentionally carry NO pass/fail class (declared intent is not pass/fail; only the audit is). The `beat-chip`, `idx`, `pass`, `fail`, `muted-2`, `beat-chips` classes already exist and are styled — reuse them; do not invent new CSS.

### Acceptance criteria

- For a card whose latest actor attempt has a populated channel_beat_plans (e.g. the most recent actor_attempts row in harness.db), the Throughline tab renders one chip per declared beat for each surface that has a plan, showing the beat's verb and working_action.
- Surfaces are matched to plans by the candidate's underlying channel: an `x` candidate that renders on the `x-thread` surface (no structured payload, multi-tweet text) still shows the `x` channel's declared plan, not an empty list.
- When beat_audit_json is non-empty, the audited tempo chips render in a second row labelled `audited` with their existing pass/fail coloring, beneath the declared chips.
- When neither declared beats nor audited beats exist for a surface, the row shows `no beats declared` (not a crash, not a blank cell).
- Declared beat chips carry no pass/fail color (no `.pass`/`.fail` class); only audited chips do.
- Hovering a declared chip shows its micro_objective / obstacle_local / preparation_from via the title attribute when those fields are present.
- `DeclaredBeatVM` is declared exactly once in the harness — in PackageTabs.tsx — and imported into page.tsx; `grep -rn 'interface DeclaredBeatVM' harness` returns a single hit. No local copy survives in page.tsx.
- TypeScript compiles: `pnpm -C harness tsc --noEmit` (or the repo's typecheck script) passes with the new ThroughlineBeatVM.declaredBeats field threaded from page.tsx through PackageTabs.tsx.
- No other consumer of ThroughlineBeatVM breaks — grep confirms PackageTabs is the only consumer of the `throughline` prop and page.tsx is the only producer.

### Tests

- Manual: run `pnpm -C harness dev`, open a card detail page that has a recent actor run (one with channel_beat_plans), click the Throughline tab (tab 3). Confirm declared verb/working-action chips appear per surface and the `audited` row appears only where the validator emitted beats.
- Type check: from repo root run the harness typecheck (`pnpm -C harness exec tsc --noEmit` or the configured `lint`/`typecheck` script). Must pass.
- Type-dedup check: `grep -rn 'interface DeclaredBeatVM' harness` returns exactly one match (PackageTabs.tsx); `grep -rn 'DeclaredBeatVM' harness/app/cards/\[id\]/page.tsx` shows only the import + usages, never a re-declaration.
- Edge: pick a card with actor_attempts present but beat_audit_json = `[]` for its candidates — confirm declared beats still render (this is the core bug being fixed) instead of `no beats`.
- Edge: pick a legacy/stub card with NO actor_attempts — confirm the Throughline tab still renders without errors and shows `no beats declared` per surface (declaredBeatsByChannel returns {} when actor_attempts is empty).

### Gotchas

- REQUIRED-FIX / one source of truth: `DeclaredBeatVM` must be defined and exported ONLY in PackageTabs.tsx and imported into page.tsx via the existing import at lines 17-22. Do NOT leave a local `interface DeclaredBeatVM` in page.tsx — two declarations of the same type name is the exact defect this revision exists to prevent. After editing, run `grep -rn 'interface DeclaredBeatVM' harness` and confirm a single hit.
- channel_beat_plans is keyed by the RAW Channel (x, x-thread, web, in-product, modal, blog, carousel), but pkg.rows[].surface is a SurfaceKind that can differ from the candidate's channel for the x→x-thread fallback (lib/surfaces.ts:59-64). Look up plans by `r.candidate?.channel ?? r.surface`, NOT by `r.surface`. Using the surface key would silently miss declared beats for split-thread X candidates.
- TableWork.channel_beat_plans is typed `unknown` (lib/types.ts:146) — do not assume it parses; wrap JSON.parse in try/catch and validate each beat is an object with a string `verb` before reading it. The DB has both well-formed actor rows and possibly older/stub rows.
- Do NOT import ActorBeatPlan or anything from `src/actor-director.ts` into the harness. The harness deliberately mirrors pipeline shapes and TableWork.channel_beat_plans is left `unknown` precisely to avoid the cross-boundary import. Replicate the minimal field shape inline. (Note: the SHARED VM type DeclaredBeatVM lives in the harness's own PackageTabs.tsx — that is an intra-harness import, which is fine and required; the prohibition is only on importing from ../src.)
- Use the latest actor attempt by `attempt` number (max), not array order. actor_attempts ordering from queries is not guaranteed to be newest-last for this purpose — reduce on `.attempt`. (Note: actorFlow at page.tsx:344-353 uses `actorAttempts[actorAttempts.length-1]`; do not copy that pattern — prefer max-by-attempt for correctness.)
- field names: the actor JSON uses snake_case (working_action, micro_objective, obstacle_local, preparation_from). The VM uses camelCase. Map carefully — a mismatch silently yields '?' / empty strings, not a compile error.
- Reuse existing CSS classes only (beat-chip, beat-chips, idx, pass, fail, muted-2, ladder-row, ladder-main, ladder-id). Per project rules the harness reads brand tokens / existing styles; do not add ad-hoc hex or new class names. The two `beat-chips` rows are stacked via the existing `space-y-2` utility.
- Declared beats are NOT pass/fail — they are authored intent. Do not apply `.pass`/`.fail` to declared chips or you imply the actor's plan was validated when it was not. Only the `audited` row (from beat_audit_json) carries verdict color.
- page.tsx already imports from '@/components/design/PackageTabs' at lines 17-22 — add `type DeclaredBeatVM` to that existing import block rather than adding a second import line; do not declare the interface locally.

### Review notes (hardening pass — read before editing)

- Step 3 is internally ambiguous: it offers two mutually exclusive options (import DeclaredBeatVM from PackageTabs vs keep a local interface in page.tsx) AND then recommends importing while still leaving the local `interface DeclaredBeatVM` inside step 1's code block. A literal implementer could end up with a duplicate/colliding type. Should be a single directive.
- Line range for the PackageTabs render replacement is slightly off: spec says 'Replace the per-row body (lines 228-243)' but the actual `ladder-row` map runs 227-245. The anchor text is unique so it won't misfire, but the numbers are imprecise (same minor drift on '209-248' for the tab block).
- The existing chip container is a `<span className="beat-chips">` (PackageTabs.tsx:234); the spec's replacement silently changes it to `<div className="beat-chips">` nested in `<div className="space-y-2">`. This is harmless (.beat-chips is display:flex, works on a div) but the tag change is not called out.
- DB sampling shows `preparation_from` is not populated in current actor rows (only `verb/working_action/physical_score/micro_objective/obstacle_local/shadow_move` appear). The parser handles its absence (→null) correctly, so acceptance criterion #6's prep_from hover path won't be exercisable against current test data — not a defect, just a coverage note.
- Verified non-issues: all cited line numbers, the channel_beat_plans DB shape, the 99.3%-empty beat_audit_json claim, the surface-vs-channel x→x-thread keying rationale, the single-consumer/single-producer claim for ThroughlineBeatVM, Tailwind presence for text-xs/space-y-2, and all reused CSS classes all check out against the real files.

## Unit 6 — JUDG/director gate cell must show the director's own verdict, never echo the regex reason

**id:** `stop-regex-echo`  ·  **depends_on:** `[]`

### Files

- `/Users/opaque/.superset/projects/comms-factory/harness/app/cards/[id]/page.tsx` — Build a real director-reason string per surface and pass it into the SurfaceRowVM as a new field; pass director_audit_json + director_passed through.
- `/Users/opaque/.superset/projects/comms-factory/harness/components/design/PackageTabs.tsx` — Stop the JUDG cell (and SurfaceCard) from rendering s.blockReason; render the director's own reason / verdict instead. Add the new VM field to the SurfaceRowVM interface.
- `/Users/opaque/.superset/projects/comms-factory/harness/lib/package-view.ts` — Read-only reference: blockReasonFor() is the source of the conflated string. Do NOT change its behavior; the fix lives in page.tsx + PackageTabs.tsx.
- `/Users/opaque/.superset/projects/comms-factory/src/actor-director.ts` — Read-only reference: DirectorAuditResult interface (lines 260-308) is the shape persisted in candidate.director_audit_json; defines infinex_fit.reason / voice_issues / factual_issues / publication_gate_issues / notes_for_actor.
- `/Users/opaque/.superset/projects/comms-factory/harness/app/actions/director.ts` — Read-only reference: lines 136-191 show the canonical priority order for rolling a DirectorAuditResult into human-readable reason strings. Mirror this ordering.

### Problem

In the harness package-review UI, when a candidate FAILS the regex/DET gate, the Director (JUDG) cell falsely echoes the regex failure reason instead of the director's own verdict.

Root cause is a conflated single reason string. In `harness/lib/package-view.ts`, `blockReasonFor(c)` returns ONE string:
```
if (!c.validation_passed) {
  const fails = safeParse<...>(c.validation_failures_json, []);
  return fails[0] ? `Format / regex — ${fails[0].reason}` : 'Format / regex failure.';
}
if (c.director_passed === false) return 'Director — content/tone not publication-ready.';
...
```
So when regex pre-fails, `blockReason` is the regex string. That single string is plumbed into `SurfaceRowVM.blockReason` at `harness/app/cards/[id]/page.tsx:146` (`blockReason: r.blockReason`).

Then in `harness/components/design/PackageTabs.tsx` the Failures-tab JUDG cell renders that same string into the director cell (lines 182-195):
```
<span className="lane-reg">JUDG</span>
<span className="lane-name">Director / content-tone</span>
<span className={`lane-verdict ${s.directorPassed === false ? 'fail' : 'pass'}`}>
  {s.directorPassed === false ? 'fail' : 'pass'}
</span>
...
<div className="lane-result-body director-quote">
  {s.directorPassed === false
    ? s.blockReason ?? 'Director rejected content/tone.'
    : 'Director read it as publication-ready.'}
</div>
```
Two defects here:
1. When regex fails AND director never ran (`directorPassed == null` because the director is gated behind regex passing), the verdict renders "pass" and the body renders "Director read it as publication-ready." — a fabricated director pass. When `directorPassed === false`, the body renders `s.blockReason`, which is the REGEX reason (since the regex-fail branch in `blockReasonFor` wins before the director branch is ever reached).
2. The SurfaceCard block (lines 344-348) renders `row.blockReason` once as a generic block line — that's acceptable as a single combined block reason, but the per-lane JUDG cell must NOT reuse it.

Net: the director cell either claims a pass that never happened, or quotes the regex reason as if it were the director's verdict.

Spec contract: the JUDG cell must show (a) the director's OWN reason when the director ran and failed, (b) the director's pass note when it ran and passed, or (c) the literal string `Director not run — blocked by regex` when the director did not run because regex pre-failed. It must NEVER echo the regex reason.

### Change

Add a dedicated director-reason field to the surface VM, derive it from the persisted director audit, and consume it (instead of `blockReason`) in the JUDG cell.

STEP 1 — `harness/components/design/PackageTabs.tsx`, extend the `SurfaceRowVM` interface (currently lines 22-32). Add two fields after `blockReason`:
```
  /** Director's OWN reason when it ran (pass note or fail reason). NULL when the director did not run. */
  directorReason: string | null;
  /** True when the director did not run because the regex/DET gate pre-failed. */
  directorBlockedByRegex: boolean;
```

STEP 2 — `harness/app/cards/[id]/page.tsx`. Add a helper that derives the director's own reason from a candidate's persisted `director_audit_json` (which stores the full `DirectorAuditResult` from `src/actor-director.ts:260`). Place it next to the other parse helpers near the bottom of the file (alongside `parseFailures`, `parseBeats`):
```
function directorReasonFor(c: HarnessCandidate | null): string | null {
  if (!c || c.director_passed == null || !c.director_audit_json) return null;
  let a: {
    infinex_fit?: { legal?: boolean; reason?: string };
    voice_issues?: string[];
    factual_issues?: string[];
    publication_gate_issues?: string[];
    notes_for_actor?: string[];
  };
  try {
    a = JSON.parse(c.director_audit_json);
  } catch {
    return null;
  }
  if (c.director_passed === false) {
    // Priority order mirrors harness/app/actions/director.ts:136-191.
    if (a.infinex_fit && a.infinex_fit.legal === false && a.infinex_fit.reason) {
      return `placement: ${a.infinex_fit.reason}`;
    }
    if (a.voice_issues && a.voice_issues.length > 0) return a.voice_issues[0];
    if (a.factual_issues && a.factual_issues.length > 0) return a.factual_issues[0];
    if (a.publication_gate_issues && a.publication_gate_issues.length > 0) return a.publication_gate_issues[0];
    return 'Director rejected content/tone.';
  }
  // director passed: surface any non-blocking note, else a clean pass line.
  if (a.notes_for_actor && a.notes_for_actor.length > 0) return a.notes_for_actor[0];
  return 'Director read it as publication-ready.';
}
```
Then update the `surfaceVMs` mapping (currently lines 137-147) to populate the two new fields. The director "did not run because regex pre-failed" condition is: the best candidate failed regex (`validation_passed === false`) AND the director never produced a verdict (`director_passed == null`):
```
  const surfaceVMs: SurfaceRowVM[] = pkg.rows.map((r) => ({
    surface: r.surface,
    state: r.state,
    text: r.candidate?.text ?? '',
    structuredJson: r.candidate?.structured_json ?? null,
    attempt: r.candidate?.attempt ?? null,
    regexPassed: r.candidate ? r.candidate.validation_passed : null,
    directorPassed: r.candidate ? r.candidate.director_passed : null,
    flow: flowBadge(r.candidate?.prompt_variant ?? null),
    blockReason: r.blockReason,
    directorReason: directorReasonFor(r.candidate),
    directorBlockedByRegex:
      r.candidate != null &&
      r.candidate.validation_passed === false &&
      r.candidate.director_passed == null,
  }));
```

STEP 3 — `harness/components/design/PackageTabs.tsx`, rewrite ONLY the JUDG cell body and verdict in the Failures tab (currently lines 182-195). Replace the verdict + body so they read the director's own signal, and represent the not-run case explicitly. The verdict must show `not run` (neither pass nor fail) when the director was blocked by regex:
```
                  <div className="lane-result judgment">
                    <div className="lane-result-top">
                      <span className="lane-reg">JUDG</span>
                      <span className="lane-name">Director / content-tone</span>
                      <span
                        className={`lane-verdict ${
                          s.directorBlockedByRegex
                            ? 'skip'
                            : s.directorPassed === false
                              ? 'fail'
                              : 'pass'
                        }`}
                      >
                        {s.directorBlockedByRegex
                          ? 'not run'
                          : s.directorPassed === false
                            ? 'fail'
                            : 'pass'}
                      </span>
                    </div>
                    <div className="lane-result-body director-quote">
                      {s.directorBlockedByRegex
                        ? 'Director not run — blocked by regex'
                        : s.directorReason ??
                          (s.directorPassed === false
                            ? 'Director rejected content/tone.'
                            : 'Director read it as publication-ready.')}
                    </div>
                  </div>
```
Leave the DET cell (lines 170-181) and the combined `blocker-action` read line (lines 197-202) unchanged — those legitimately show the regex reason / overall block reason.

STEP 4 — `harness/components/design/PackageTabs.tsx`, the `SurfaceCard` foot block (lines 344-348) currently renders `row.blockReason` as a single combined block line. That is acceptable (it is the overall surface block reason, not a director-attributed cell), so leave it. Do NOT route `directorReason` through it.

No schema, query, or package-view changes. `director_audit_json` and `director_passed` are already selected onto the candidate in `harness/lib/queries.ts:74-80` and mapped at line 800, so no new plumbing is needed beyond the page/component layer.

### Acceptance criteria

- When a surface's best candidate fails regex and the director never ran (director_passed == null), the Failures-tab JUDG cell verdict reads 'not run' and its body reads exactly 'Director not run — blocked by regex' — NOT the regex failure text.
- When the director actually ran and failed (director_passed === false), the JUDG cell body shows the director's OWN reason derived from director_audit_json (placement reason, else first voice_issue, else first factual_issue, else first publication_gate_issue, else the generic 'Director rejected content/tone.') and the verdict reads 'fail'.
- When the director ran and passed (director_passed === true), the JUDG cell verdict reads 'pass' and the body shows the first notes_for_actor entry if present, else 'Director read it as publication-ready.'
- The DET cell still shows the regex/format failure reason (s.blockReason) when regexPassed === false — its behavior is unchanged.
- The regex reason string ('Format / regex — …') never appears inside the JUDG/director cell under any combination of regex/director pass/fail/not-run states.
- SurfaceRowVM gains directorReason: string | null and directorBlockedByRegex: boolean; both are populated in page.tsx's surfaceVMs mapping; the project still typechecks (pnpm tsc / next build has no new TS errors).

### Tests

- Manual/visual: open a card whose latest candidate for some surface failed the regex gate (validation_passed=false, director_passed NULL) → Failures tab → that surface's JUDG cell shows 'not run' + 'Director not run — blocked by regex'.
- Manual/visual: open (or seed via harness DB) a candidate where validation_passed=true but director_passed=false with a populated director_audit_json (e.g. infinex_fit.legal=false with a reason) → JUDG cell verdict 'fail' and body shows 'placement: <reason>' rather than any regex text.
- Type/build check: run the harness build (e.g. `pnpm --dir /Users/opaque/.superset/projects/comms-factory/harness build` or `pnpm --dir .../harness exec tsc --noEmit`) and confirm no new type errors from the added SurfaceRowVM fields or the directorReasonFor helper.
- Grep check: confirm `s.blockReason` no longer appears inside the JUDG `lane-result judgment` block in PackageTabs.tsx (it should only remain in the DET `lane-result deterministic` block and the `blocker-action` read line).

### Gotchas

- director_passed has THREE meaningful states: true (ran, passed), false (ran, failed), null (did not run / not persisted). The original bug came from collapsing null into the pass branch (`directorPassed === false ? ... : 'pass'`). Always branch on the not-run case FIRST.
- candidate.director_audit_json stores the FULL DirectorAuditResult (src/actor-director.ts:260-308) — selected via the correlated subquery in harness/lib/queries.ts:74-80. It can be null even when director_passed is set (e.g. stub mode writes director_audit_json: null in app/actions/generate.ts:664). Guard the JSON.parse and fall back to the generic strings.
- Do NOT change blockReasonFor() in package-view.ts — its combined string is still used for the DET cell and the overall block-reason read line. The fix is additive (new VM fields), not a rewrite of the existing reason.
- The reason-priority order (placement → voice → factual → publication → notes) mirrors harness/app/actions/director.ts:136-191; keep them consistent so the Director-as-service surface and the package-review surface attribute the same primary reason.
- The new verdict value 'not run' uses className 'skip' — if no `.lane-verdict.skip` style exists in the harness CSS it will render unstyled (still correct text). Adding a neutral/grey `.lane-verdict.skip` rule is optional polish, not required for correctness; do not block on it.
- Scope is the gate CELLS only. The Corpus tab's `c.reason` (PackageTabs.tsx:273-275, built from validation_failures at page.tsx:171) is a separate regex-only reason and is out of scope for this unit — leave it.

### Review notes (hardening pass — read before editing)

- All cited line anchors verify against the real files as of HEAD: PackageTabs.tsx SurfaceRowVM (22-32), JUDG cell (182-195), DET cell (170-181), blocker-action (197-202), SurfaceCard foot (344-348); page.tsx surfaceVMs (137-147), parse helpers at bottom (326-342); package-view.ts blockReasonFor (44-53); actor-director.ts DirectorAuditResult (260-308); director.ts priority order (136-191); queries.ts director_audit_json subquery (74-80) and mapping (line 800); generate.ts stub null write (664). No stale references.
- VERIFIED: director_audit_json persists JSON.stringify(record.director_audit) at generate.ts:972 — the FULL DirectorAuditResult at top level, so the helper's parse shape (a.infinex_fit / a.voice_issues / a.factual_issues / a.publication_gate_issues / a.notes_for_actor) reads real keys. Spec's claim is correct.
- VERIFIED the load-bearing premise that the Director is gated behind regex: actor-orchestrator.ts:373 `const auditable = records.filter((record) => record.script_validation.passed)`. So a regex-failed candidate gets director_audit undefined → director_passed persists null. The directorBlockedByRegex proxy (validation_passed===false && director_passed==null) is sound.
- The director.ts priority order (136-191) is NOT a literal placement→voice→factual→publication ordering — it builds parallel voiceLight/factLight axes and unshifts the placement reason onto voiceIssues (line 164-166). The spec's 'mirror this ordering' is a reasonable interpretation (placement first, then voice, etc.) and the helper's explicit fallback chain is internally consistent, but it is an approximation of director.ts, not a literal mirror. Not a blocker; the acceptance criteria pin the exact order the helper must implement, which is unambiguous on its own.
- .lane-verdict.skip CSS does not exist (only .pass and .fail in globals.css:1679-1680). The spec's gotcha already flags this as optional polish (renders unstyled but correct text). Confirmed acceptable, not a blocker.
- Latent edge not covered (cannot manifest): a regex-passing + director-null candidate (stub mode, generate.ts:664) would render a fabricated 'pass' in the JUDG body — but candidatePasses() treats director_passed==null as passing, so such a candidate is state:'shippable' and never reaches the Failures-tab JUDG cell (only blocked.map renders it). So the bug class can't appear where the code renders. No fix needed.
- Conflict scan: the parent backlog research/harness-pipeline-fixlist-2026-06-05.md item 10 IS this unit. Sibling items touch overlapping files but not the same lines: item 7 (failed-candidate text) touches page.tsx:154-172 + PackageTabs.tsx:273 (Corpus reason / different region from JUDG cell); item 8 (Gate title) touches atoms.tsx:50; item 11 (declared beats) touches page.tsx:176 (throughlineVMs, separate from surfaceVMs:137-147). No edit-region collision with this unit. depends_on:[] is correct — the unit is self-contained and needs no other unit first.
- Typecheck baseline is clean (pnpm exec tsc --noEmit in harness exits 0), so the 'no new TS errors' acceptance criterion is meaningful and testable.
- Acceptance criteria and tests are concrete and testable: exact strings ('not run', 'Director not run — blocked by regex', 'placement: <reason>'), a grep check for s.blockReason absence in the JUDG block, and a build/tsc check. The grep test (criterion: s.blockReason only in DET block + blocker-action line) is a good regression guard.

## Verification

Automated:

- `pnpm typecheck:harness` — clean (no new TS errors).
- `pnpm build:harness` — clean.

Manual (per fix):

- **failures-show-text:** open a run with blocked candidates; the failed candidate's text now shows inline in the Failures view.
- **director-fail-hover:** hover the director Gate badge on a director-rejected surface; the tooltip surfaces the `director_audit_json` reject reasons.
- **expandable-more:** click a `+N more tweets` / `+N` compact-preview marker; the hidden items expand inline.
- **show-beats:** open the Throughline tab; the actor's DECLARED channel beat plans render (declared-vs-audited side by side).
- **superseded-tooltip:** hover a corpus `superseded` status; a tooltip explains the status.
- **stop-regex-echo:** on a director-gate cell, the director's own verdict shows; no regex reason is echoed in the director cell.
