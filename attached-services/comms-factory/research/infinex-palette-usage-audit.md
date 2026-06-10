# Infinex Palette Usage Audit

**Date:** 2026-05-12
**Method:** Raw curl of each page + grep of inline HTML colors + analysis of the production CSS bundle (`/_next/static/css/dd71e00b49fcd54e.css`, 311 KB, fetched same day).
**Anchor question:** Are Infinex's 8 decorative colors + cantaloupe scale used SPARINGLY (Radix discipline, one color per semantic state) or RAINBOW-SOUP-STYLE (gradients, multi-color hero decoration)?

**Headline: Discipline. Not slop.** Every "color" in the design system is bound to a single semantic role through CSS custom properties (`--fill-brand`, `--fill-critical`, `--fill-bull`, etc.). The colors that *do* appear in raw HTML across all pages are overwhelmingly third-party token/chain logos (Bitcoin orange, Solana purple, Cardano blue), not Infinex's own design language. There is no rainbow gradient hero on any audited page.

---

## 1. Pages audited

| URL | HTTP | Notes |
|---|---|---|
| `https://infinex.xyz/` | 200 | Marketing homepage |
| `https://infinex.xyz/perps` | 200 | Perps product page |
| `https://infinex.xyz/extension` | 200 | Browser extension page |
| `https://infinex.xyz/inx` | 200 | INX token page |
| `https://infinex.xyz/features` | 200 | Features overview |
| `https://infinex.xyz/sale` | 200 | Token sale page |
| `https://infinex.xyz/craterun` | 200 | Crate Run promo |
| `https://infinex.xyz/patron-nft` | 200 | Patron NFT page |
| `https://infinex.xyz/yubikey` | 200 | Yubikey opsec page |
| `https://infinex.xyz/news` | 200 | News index |
| `https://infinex.xyz/swidge` | **404** | Path does not exist on infinex.xyz |
| `https://infinex.xyz/portfolio` | **404** | Path does not exist on infinex.xyz |
| `https://infinex.xyz/passkeys` | **404** | Path does not exist on infinex.xyz |
| `https://infinex.xyz/chains/monad` | **404** | Real path is `/networks/monad` |

The three 404s (swidge/portfolio/passkeys) are likely in-app routes on `app.infinex.xyz` behind auth, or are features surfaced from inside the marketing homepage. Sitemap confirms they are not standalone marketing URLs on `infinex.xyz`.

---

## 2. The design system: semantic-token discipline

Infinex's production CSS bundle defines a **strict semantic token layer**. Each color appears exactly once as a named role and is then referenced by every component via `var(--name)`. Below are the role → hex bindings extracted from the CSS bundle:

### Brand (single)
- `--fill-brand: #fe6f39` (cantaloupe — the anchor)
- `--text-color-brand: #fe6f39`
- `--border-color-brand: #fe6f39`
- `--border-color-selected: #fe6f39`
- `--ring-color-selected: #fe6f39`
- `--stroke-brand: #fe6f39`

→ Cantaloupe is **only** the brand accent. It is wired to brand, selected, and focus-ring roles. No decorative usage of cantaloupe outside these semantic roles was found.

### State colors (one per state, Radix-derived)
- `--fill-positive: #30a46c` (Radix green-9 — success)
- `--fill-positiveOnFill: #33b074`
- `--fill-critical: #e5484d` (Radix red-9 — error)
- `--fill-criticalOnFill: #ec5d5e`
- `--fill-caution: #ffc53d` (Radix yellow-9 — warning)
- `--fill-cautionOnFill: #ffd60a`
- `--fill-info: #0090ff` / `#3b9eff` (Radix blue — info)
- `--fill-highlight: #6e56cf` (Radix violet-9 — used very sparingly)
- `--fill-disabled: #5d6166`

### Trading semantics (financial)
- `--fill-bull: #70ff93` / `--fill-bullSecondary: #00b277` (up = green)
- `--fill-bear: #fe4363` / (down = red-pink)
- `--text-color-bull: #70ff93`
- `--text-color-bear: #fe4363`
- `--background-color-fillBullEmphasis: #70ff93`

→ This is the **classic semantic-color usage**: green for price-up, red-pink for price-down. Bull/bear are distinct tokens from positive/critical, so a successful action and a green price aren't fighting each other visually.

### Surface (grayscale only — Radix shark scale)
- `--background-color-default: #101114`
- `--background-color-surface: #17191c`
- `--background-color-surfaceTwo: #1c1e21`
- `--background-color-fillAltPress: #101114`
- `--background-color-surfaceInverse: #eceef1`
- `--text-color-tertiary: #6a6e74`
- `--text-color-disabled: #5d6166`

→ All backgrounds and chrome live on a shark/gray Radix scale. There are no decorative colored surfaces. Dark surfaces dominate.

### Conclusion of CSS token analysis
The design system contains roughly **6 chromatic roles + a gray scale**, each bound to exactly one hex per state. This is textbook Radix-style semantic-color discipline.

---

## 3. Per-page color tally (rendered HTML)

### 3a. Homepage `infinex.xyz/`

Color is applied via inline `--fg` custom property on six small category-label chips (one per product surface). Each chip is the size of a sub-heading badge, not a hero background:

| Inline `--fg:` value | Product surface |
|---|---|
| `#0BD8B6` | Perpetual Futures (mint) |
| `#4CCCE6` | Wallet Extension (cyan) |
| `#70B8FF` | Prediction Markets (light blue) |
| `#BDE56C` | Earn (lime) |
| `#C936C9` | NFTs (magenta) |
| `#FC4913` | Swap & Bridge (vermillion — *not* cantaloupe `#fe6f39`) |
| `#B0B4BA` | Generic gray for "Early Access" badge |

These six accents are used **only on small badge chips**, e.g.:
```html
<div ... class="... text-(--fg) ..." style="--fg:#0BD8B6">
  <span class="text-base font-semibold">Perpetual Futures</span>
</div>
```

Tally of semantic class usage on homepage:
- `text-emphasis`: 95 (default white text)
- `text-brand`: 28 (all are `aria-current:text-brand` on active nav links — cantaloupe)
- `text-secondary`: 22 (gray)
- `bg-surfaceTwo`: 18, `bg-surface`: 17, `bg-surfaceHover`: 8 (all gray)
- `text-positive`: **1**
- `text-info`: **1**
- `text-negative/danger`: **0** (marketing page, no errors visible)

→ Cantaloupe owns "active state" and brand. Everything else is grayscale. The 6 product-chip accents are isolated to chip components.

### 3b. `/perps`, `/extension`, `/inx`, `/features`, `/sale`, `/craterun`, `/yubikey`

Identical pattern. Hex tallies are dominated by **third-party token/chain logos**, not Infinex's own UI colors:
- `#0033AD` (Cardano blue, 31×)
- `#9945FF` (Solana purple, 2×)
- `#F7931A` (Bitcoin orange, 2×)
- `#F0B90B` (BNB yellow, 2×)
- `#FF0420` (Optimism red, 2×)
- `#8752F3` (Polygon purple, 2×)
- `#12AAFF` (Arbitrum cyan, 4×)
- ...plus ~30 other chain emblem colors at counts of 2–4 each.

These are SVG fill colors inside chain emblems (`#chain-monad-emblemSymbol`, `#chain-fogo-emblemSymbol`, etc.) — i.e. **third-party brand assets**, not Infinex's design vocabulary. They appear visually as small (32×32) circular logos in a chain-picker grid.

### 3c. `/patron-nft`

Only page with a non-grayscale Infinex-owned color in significant volume: **`#FFE5D4` × 78** instances. This is a pale cantaloupe tint (Radix cantaloupe-2/3 territory) used as `stroke` on SVG illustration paths of the patron-avatar artwork. Used decoratively but **within the cantaloupe scale**, not introducing a new hue. Also: one `radial-gradient(50% 50% at 50% 50%, #2E3136 0%, #101114 100%)` — a dark gray monochrome radial, no rainbow.

### 3d. `/news`, `/yubikey`, others

Same shark/cantaloupe pattern. No new chromatic introductions.

---

## 4. Multi-color treatments (gradients, rainbow chips, decoration)

| Pattern | Found? | Notes |
|---|---|---|
| Rainbow / multi-hue gradients | **No** | Only `linear-gradient(180deg, rgba(0,0,0,1) → 0)` black fades, used on overlay scrims. |
| Multi-color hero backgrounds | **No** | All hero areas are `#101114` (background-default) with optional grayscale grid SVG. |
| Mesh / aurora gradient blobs | **No** | Not observed in any audited page. |
| Holographic / iridescent text | **No** | All emphasis text is `text-emphasis` (white) or `text-brand` (cantaloupe). |
| Multi-color chip row | **Yes — homepage only** | Six product surfaces each get their own accent chip. This is the *only* place multiple chromatic colors coexist on screen. They are small, semantically tied to a product surface, and confined to a label-sized component. |
| Decorative rainbow icon set | **No** | Chain/token logos use their own brand hexes but those are 3rd-party brand assets, not Infinex's design language. |
| `--fill-highlight: #6e56cf` (violet) | Defined but unused in audited pages | The token exists in CSS for completeness; no rendered violet decoration was seen. |

The dark-fade gradients (`linear-gradient(180deg, #000 0%, #000 50%, rgba(0,0,0,0))`) are **monochrome scrim overlays** for video/image legibility, not chromatic decoration.

---

## 5. Cantaloupe dominance check

**Yes, cantaloupe (`#fe6f39`) is the single brand accent.** Roles wired to cantaloupe in the CSS bundle:
- Brand fill, text, stroke, border
- Selected state (border + ring)
- Focus-selected ring
- Tinted backgrounds (`bg-fillBrand/10` = `#fe6f391a`, `/20` = `#fe6f3933`, `/30` = `#fe6f394d`)

The `.bg-fillBrand/N` opacity ladder is the only chromatic background-tint family in the system. Cantaloupe is therefore not just the logo color — it is the **single chromatic accent permitted across CTAs, focus rings, selection chrome, and tinted surfaces**.

---

## 6. Semantic vs decorative usage

| Color | Role | Usage |
|---|---|---|
| Cantaloupe `#fe6f39` | Brand / selected / focus | Semantic — single role |
| Green `#30a46c` / `#70ff93` | Success / bull | Semantic — success state OR price-up |
| Red `#e5484d` / `#fe4363` | Critical / bear | Semantic — error state OR price-down |
| Yellow `#ffc53d` | Caution | Semantic — warning |
| Blue `#0090ff` | Info | Semantic — informational |
| Violet `#6e56cf` | Highlight | Defined but unused in audited surfaces |
| 6 homepage chip accents | Category labels | Decorative-ish — but tied 1:1 to product surfaces, used at chip scale only |

The 8 Radix "decorative singles" you described as part of the system show up in CSS *exclusively* as state-token bindings, not as paint. Pink (`#d6409f`) is not present in the bundle at all. Cyan (`#23afd0`) is not in the bundle at all. Indigo (`#5472e4`) is not in the bundle at all. The "8 decorative colors" are defined in the design system *theoretically* but are rarely or never rendered.

---

## 7. Verdict

**Strong Radix discipline, not rainbow soup.** The design system uses cantaloupe as the single brand accent, binds every other chromatic color to exactly one semantic state (positive/critical/caution/info/bull/bear), and runs all surfaces and chrome on a shark/gray scale — exactly the Hyperliquid-style monochrome+anchor pattern, not the 2021-era L1 five-color brand soup. The one multi-color moment (six product-chip accents on the homepage) is confined to chip-sized labels, not blown up into gradient hero decoration, so it's a far cry from anti-pattern #4.

**Implication for comms-factory:** Infinex's palette is solid and worth respecting. The vocabulary to lean into is *cantaloupe-as-single-anchor + grayscale*; the per-product chip accents (Perps mint, Prediction-markets blue, etc.) are available as small categorical signals but should not be expanded into gradients or hero washes. The fact that pink/cyan/indigo from the theoretical "8 decorative" list are nearly absent in production is itself the discipline — having tokens for them doesn't mean using them.

---

## Appendix: artifacts

Raw HTML and CSS dumps saved to `/tmp/infinex-audit/`:
- `infinex.xyz.html`, `infinex.xyz_perps.html`, `infinex.xyz_extension.html`, `infinex.xyz_inx.html`, `infinex.xyz_features.html`, `infinex.xyz_sale.html`, `infinex.xyz_craterun.html`, `infinex.xyz_patron-nft.html`, `infinex.xyz_yubikey.html`, `infinex.xyz_news.html`
- `second.css` (production design-system CSS bundle, 311 KB, contains all token bindings cited above)
