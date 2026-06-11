import Link from 'next/link';
import { getDb } from '@/lib/db';
import { renderNewsArticle } from '@/lib/news-render';
import { EditableArticle } from './EditableArticle';

export const dynamic = 'force-dynamic';

const NEWS_CSS = `
  .nv-root{ --bg:#0a0b0e; --rule:#23262f; --ink:#eceef2; --ink2:#a6abb6; --ink3:#6f7480; --accent:#3b6bff;
    background:var(--bg); color:var(--ink); min-height:100vh; font:16px/1.65 -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,sans-serif; }
  .nv-bar{ position:sticky; top:0; background:rgba(10,11,14,.92); backdrop-filter:blur(8px); border-bottom:1px solid var(--rule);
    padding:10px 20px; display:flex; gap:14px; align-items:center; }
  .nv-brand{ font-weight:700; letter-spacing:.02em } .nv-brand .x{ color:var(--ink3); font-weight:400 }
  .nv-path{ color:var(--ink3); font-size:13px; font-family:ui-monospace,Menlo,monospace }
  .nv-back{ margin-left:auto; color:var(--accent); font-size:13px; text-decoration:none }
  .nv-wrap{ max-width:720px; margin:0 auto; padding:48px 24px 120px }
  .nv-badge{ display:inline-block; font-size:11px; letter-spacing:.14em; text-transform:uppercase; color:var(--accent);
    border:1px solid var(--accent); border-radius:4px; padding:3px 9px; margin-bottom:20px }
  .nv-wrap h1{ font-size:38px; line-height:1.15; letter-spacing:-.02em; margin:0 0 14px }
  .nv-sub{ font-size:20px; color:var(--ink2); margin:0 0 18px; line-height:1.4 }
  .nv-meta{ color:var(--ink3); font-size:14px; margin-bottom:28px }
  .nv-cover{ height:300px; border:1px dashed var(--rule); border-radius:14px; background:linear-gradient(135deg,#141826,#0e1016);
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; margin-bottom:40px }
  .nv-cover .t{ font-size:11px; text-transform:uppercase; letter-spacing:.14em; color:var(--ink3) }
  .nv-cover .a{ color:var(--ink2); font-size:14px; max-width:80%; text-align:center }
  .nv-body h2{ font-size:26px; margin:40px 0 12px; letter-spacing:-.01em }
  .nv-body h3{ font-size:21px; margin:38px 0 12px; letter-spacing:-.01em }
  .nv-body p{ margin:0 0 18px; color:#dce0e8 }
  .nv-body a{ color:var(--accent); text-decoration:none; border-bottom:1px solid rgba(59,107,255,.4) }
  .nv-body ul{ margin:0 0 18px; padding-left:22px; color:#dce0e8 } .nv-body li{ margin:6px 0 }
  .nv-body hr{ border:0; border-top:1px solid var(--rule); margin:34px 0 }
  .nv-body .cloud-image .imgph{ height:240px; border:1px dashed var(--rule); border-radius:12px; background:linear-gradient(135deg,#10131c,#0c0e13);
    display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; margin:8px 0 24px }
  .nv-body .imgph-tag{ font-size:11px; text-transform:uppercase; letter-spacing:.14em; color:var(--ink3) }
  .nv-body .imgph-alt{ color:var(--ink2); font-size:13px; max-width:80%; text-align:center }
  .nv-body .cloud-image img{ width:100%; border-radius:12px; margin:8px 0 24px }
  .nv-body details.toggle{ border:1px solid var(--rule); border-radius:10px; padding:4px 16px; margin:0 0 22px; background:#0d0f15 }
  .nv-body details.toggle summary{ cursor:pointer; padding:12px 0; font-weight:600; color:var(--ink); list-style:none }
  .nv-body details.toggle summary::-webkit-details-marker{ display:none }
  .nv-body details.toggle summary::before{ content:"+ "; color:var(--accent) }
  .nv-body details.toggle[open] summary::before{ content:"– " }
  .nv-body .toggle-body{ padding:0 0 14px; color:var(--ink2) }
  .nv-cover-img{ width:100%; border-radius:14px; margin-bottom:40px; display:block }
  .nv-edit-note{ font-size:13px; color:var(--ink3); border:1px solid var(--rule); border-radius:8px; padding:10px 14px; margin-bottom:28px }
  .nv-toast{ position:sticky; top:64px; z-index:5; background:#13203d; border:1px solid var(--accent); color:var(--ink);
    border-radius:8px; padding:10px 14px; margin-bottom:20px; font-size:14px }
  .nv-toast-err{ background:#2a1416; border-color:#7a2630; cursor:pointer }
  .nv-toast-x{ float:right; color:var(--ink3) }
  .nv-cover-slot{ display:block }
  /* editable affordance: any [data-slot] becomes a click target */
  .nv-editable [data-slot]{ position:relative; cursor:pointer; outline:2px solid transparent; outline-offset:4px; border-radius:14px; transition:outline-color .12s }
  .nv-editable [data-slot]:hover{ outline-color:var(--accent) }
  .nv-editable [data-slot]:hover::after{ content:attr(data-hint); position:absolute; top:10px; right:10px; z-index:4;
    background:var(--accent); color:#fff; font-size:11px; letter-spacing:.04em; text-transform:uppercase;
    padding:4px 9px; border-radius:6px; pointer-events:none }
`;

export default async function NewsPreviewPage({
  params,
}: {
  params: Promise<{ id: string; candidateId: string }>;
}) {
  const { id, candidateId } = await params;
  const db = getDb();
  const row = db
    .prepare('SELECT text, channel FROM candidates WHERE id = ? AND card_id = ?')
    .get(candidateId, id) as { text: string; channel: string } | undefined;

  if (!row) {
    return (
      <div style={{ padding: 40 }}>
        Candidate not found. <Link href={`/cards/${id}`}>back to card</Link>
      </div>
    );
  }

  // Prefer the final pick's (possibly operator-edited) copy — that's what ships.
  const pick = db
    .prepare('SELECT final_text FROM final_picks WHERE card_id = ? AND candidate_id = ?')
    .get(id, candidateId) as { final_text: string } | undefined;

  const article = renderNewsArticle(pick?.final_text ?? row.text);
  const editable = row.channel === 'blog' && !!pick;

  return (
    <div className="nv-root">
      <style dangerouslySetInnerHTML={{ __html: NEWS_CSS }} />
      <div className="nv-bar">
        <span className="nv-brand">
          infinex<span className="x"> · news</span>
        </span>
        <span className="nv-path">infinex.xyz/news/&lt;slug&gt; — rendered preview ({row.channel} candidate)</span>
        <Link className="nv-back" href={`/cards/${id}`}>
          ← back to card
        </Link>
      </div>
      <div className="nv-wrap">
        <div className="nv-badge">{article.category}</div>
        <h1>{article.title}</h1>
        {article.subtitle && <p className="nv-sub">{article.subtitle}</p>}
        <div className="nv-meta">
          {article.date} · Infinex News
        </div>
        <EditableArticle
          cardId={id}
          candidateId={candidateId}
          editable={editable}
          coverSrc={article.coverSrc}
          coverAlt={article.coverAlt}
          bodyHtml={article.bodyHtml}
        />
      </div>
    </div>
  );
}
