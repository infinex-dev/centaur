/** Run: pnpm --dir harness exec tsx lib/news-image-patch.test.ts */
import { assert, createTestRunner } from './test-utils';
import { imageSlots, setCoverSrc, setInlineSrc, setSlotSrc } from './news-image-patch';

const { test, done } = createTestRunner();

// Real shape emitted by the actor for the Bridge.xyz card.
const MD = `---
title: Fiat bank deposits live via Bridge.xyz
subtitle: Fund Infinex by US bank transfer
date: 2026-06-09
published: false
pinned: false
category: changelogs
coverImage:
  src: <designer-cover-url>
  alt: Infinex deposit dialog showing the Bank transfer method
  height: 640
  width: 1280
---

### Fund Infinex from your bank

{% cloud-image src="<designer-cover-url>" alt="Bank transfer method" height=640 width=1280 /%}

You can now fund Infinex directly from a bank account.

{% cloud-image src="<second>" alt="account number" /%}
`;

const URL = 'https://res.cloudinary.com/infinex/image/upload/v1/blog/cover.png';

// --- imageSlots ---
test('imageSlots: unfilled placeholders read as empty/false', () => {
  const s = imageSlots(MD);
  assert.equal(s.hasCover, true);
  assert.equal(s.coverSrc, '', 'placeholder cover src must read as empty');
  assert.equal(s.inline.length, 2);
  assert.equal(s.inline[0].filled, false);
  assert.equal(s.inline[1].filled, false);
});

// --- setCoverSrc ---
test('setCoverSrc: replaces placeholder, preserves alt, updates dims', () => {
  const out = setCoverSrc(MD, URL, { width: 1600, height: 900 });
  const s = imageSlots(out);
  assert.equal(s.coverSrc, URL);
  assert.match(out, /alt: Infinex deposit dialog showing the Bank transfer method/);
  assert.match(out, /^\s+height: 900$/m);
  assert.match(out, /^\s+width: 1600$/m);
  // inline tags untouched
  assert.equal(imageSlots(out).inline[0].filled, false);
});

test('setCoverSrc: handles YAML folded (>-) src form', () => {
  const folded = MD.replace(
    '  src: <designer-cover-url>',
    '  src: >-\n    <designer-cover-url>',
  );
  const out = setCoverSrc(folded, URL);
  assert.equal(imageSlots(out).coverSrc, URL);
});

test('setCoverSrc: inserts a coverImage block when absent', () => {
  const noCover = `---\ntitle: x\npublished: false\n---\n\nbody\n`;
  const out = setCoverSrc(noCover, URL, { width: 100, height: 50 });
  const s = imageSlots(out);
  assert.equal(s.coverSrc, URL);
  assert.match(out, /coverImage:\n\s+src: https/);
  assert.match(out, /\n---\n\nbody/, 'frontmatter fence + body preserved');
});

// --- setInlineSrc ---
test('setInlineSrc: targets only the requested index', () => {
  const out = setInlineSrc(MD, 1, URL);
  const s = imageSlots(out);
  assert.equal(s.inline[0].filled, false, 'index 0 untouched');
  assert.equal(s.inline[1].src, URL);
});

test('setInlineSrc: adds dims when the tag lacks them', () => {
  const out = setInlineSrc(MD, 1, URL, { width: 800, height: 600 });
  const tags = out.match(/\{%\s*cloud-image[\s\S]*?\/%\}/g)!;
  const tag = tags[1]; // attribute order is not guaranteed; assert each present
  assert.match(tag, /src="https:\/\/res\.cloudinary\.com[^"]*"/);
  assert.match(tag, /height=600/);
  assert.match(tag, /width=800/);
});

test('setInlineSrc: replaces existing dims rather than duplicating', () => {
  const out = setInlineSrc(MD, 0, URL, { width: 1920, height: 1080 });
  const tag = out.match(/\{%\s*cloud-image[\s\S]*?\/%\}/)![0];
  assert.equal((tag.match(/width=/g) || []).length, 1);
  assert.match(tag, /width=1920/);
  assert.match(tag, /height=1080/);
});

test('setInlineSrc: throws on out-of-range index', () => {
  assert.throws(() => setInlineSrc(MD, 5, URL), /no cloud-image at index 5/);
});

// --- setSlotSrc dispatch ---
test('setSlotSrc: routes cover + inline-n', () => {
  assert.equal(imageSlots(setSlotSrc(MD, 'cover', URL)).coverSrc, URL);
  assert.equal(imageSlots(setSlotSrc(MD, 'inline-1', URL)).inline[1].src, URL);
  assert.throws(() => setSlotSrc(MD, 'bogus', URL), /unknown slot/);
});

test('idempotent: re-applying the same url is stable', () => {
  const once = setSlotSrc(MD, 'cover', URL);
  const twice = setSlotSrc(once, 'cover', URL);
  assert.equal(once, twice);
});

done();
