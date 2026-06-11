/** Run: pnpm --dir harness exec tsx lib/news-render.test.ts */
import { assert, createTestRunner } from './test-utils';
import { renderNewsArticle } from './news-render';

const { test, done } = createTestRunner();

const MD = `---
title: Fiat bank deposits live via Bridge.xyz
subtitle: Fund Infinex by US bank transfer
date: 2026-06-09
category: changelogs
coverImage:
  src: <designer-cover-url>
  alt: Infinex deposit dialog showing the Bank transfer method
---

### Fund Infinex from your bank

{% cloud-image src="<designer-inline-url>" alt="Bank transfer method" /%}

You can now fund Infinex directly from a bank account.

{% toggle title="Before your first transfer" %}
Bridge.xyz handles identity verification.
{% /toggle %}
`;

test('renderNewsArticle: maps frontmatter and placeholder cover fields', () => {
  const article = renderNewsArticle(MD);
  assert.equal(article.title, 'Fiat bank deposits live via Bridge.xyz');
  assert.equal(article.subtitle, 'Fund Infinex by US bank transfer');
  assert.equal(article.date, '2026-06-09');
  assert.equal(article.category, 'changelogs');
  assert.equal(article.coverAlt, 'Infinex deposit dialog showing the Bank transfer method');
  assert.equal(article.coverSrc, '');
});

test('renderNewsArticle: renders cloud-image and toggle blocks for preview editing', () => {
  const article = renderNewsArticle(MD);
  assert.match(article.bodyHtml, /<figure class="cloud-image" data-slot="inline-0"/);
  assert.match(article.bodyHtml, /data-hint="click to add image"/);
  assert.match(article.bodyHtml, /<span class="imgph-alt">Bank transfer method<\/span>/);
  assert.match(article.bodyHtml, /<details class="toggle"><summary>Before your first transfer<\/summary>/);
});

done();
