'use client';

/**
 * FactModal — structured editor for a grounder fact. Replaces the unusable
 * window.prompt(JSON) dialogs: real fields, multi-line claim/value, a category
 * select, and a confidence slider. Three modes share the same chrome:
 *   edit   → field-level edits on an existing fact (→ decideFact 'edit')
 *   new    → operator-authored fact (→ addManualFact)
 *   reject → just a rejection reason (→ decideFact 'reject')
 */

import { useEffect, useState } from 'react';
import type { HarnessFact } from '@/lib/types';

const CATEGORIES = ['partner', 'capability', 'number', 'chain', 'product', 'url', 'date', 'ticker'] as const;

export type FactModalMode = 'edit' | 'new' | 'reject';

export interface FactModalResult {
  category: string;
  claim: string;
  value: string;
  source_ref: string;
  confidence: number;
  rejection_reason: string;
}

const TITLE: Record<FactModalMode, string> = {
  edit: 'Edit fact',
  new: 'Add fact',
  reject: 'Reject fact',
};

export function FactModal({
  mode,
  fact,
  pending,
  onSubmit,
  onCancel,
}: {
  mode: FactModalMode;
  fact?: HarnessFact;
  pending: boolean;
  onSubmit: (result: FactModalResult) => void;
  onCancel: () => void;
}) {
  const [category, setCategory] = useState(fact?.category ?? 'capability');
  const [claim, setClaim] = useState(fact?.claim ?? '');
  const [value, setValue] = useState(fact?.value ?? '');
  const [sourceRef, setSourceRef] = useState(fact?.source_ref ?? (mode === 'new' ? 'operator' : ''));
  const [confidence, setConfidence] = useState(fact?.confidence ?? 1);
  const [reason, setReason] = useState(fact?.rejection_reason ?? '');
  const [error, setError] = useState<string | null>(null);

  function submit() {
    if (mode !== 'reject') {
      if (!claim.trim()) {
        setError('Claim is required.');
        return;
      }
      if (!value.trim()) {
        setError('Value is required.');
        return;
      }
    }
    setError(null);
    onSubmit({ category, claim: claim.trim(), value: value.trim(), source_ref: sourceRef.trim(), confidence, rejection_reason: reason.trim() });
  }

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancel();
      if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) submit();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="rg-scrim" onClick={onCancel}>
      <div className="rg-modal" onClick={(e) => e.stopPropagation()}>
        <div className="rg-head">
          <span className="rg-title">{TITLE[mode]}</span>
          <button type="button" className="rg-x" onClick={onCancel} aria-label="close">×</button>
        </div>

        {mode === 'reject' ? (
          <label className="rg-step">
            <span className="rg-step-name">Rejection reason</span>
            <span className="rg-step-sub">{fact ? `${fact.claim}: ${fact.value}` : ''}</span>
            <textarea
              className="rg-prompt"
              rows={3}
              autoFocus
              placeholder="why this fact is wrong / unusable"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
        ) : (
          <>
            <label className="rg-step">
              <span className="rg-step-name">Claim</span>
              <textarea
                className="rg-prompt"
                rows={2}
                autoFocus
                placeholder="what the release asserts"
                value={claim}
                onChange={(e) => setClaim(e.target.value)}
              />
            </label>

            <label className="rg-step">
              <span className="rg-step-name">Value</span>
              <textarea
                className="rg-prompt"
                rows={2}
                placeholder="the load-bearing figure / string"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </label>

            <div className="fm-row">
              <label className="rg-step fm-grow">
                <span className="rg-step-name">Category</span>
                <select className="rg-prompt" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label className="rg-step fm-conf">
                <span className="rg-step-name">Confidence · {confidence.toFixed(2)}</span>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={confidence}
                  onChange={(e) => setConfidence(Number(e.target.value))}
                />
              </label>
            </div>

            <label className="rg-step">
              <span className="rg-step-name">Source ref</span>
              <input
                className="rg-prompt"
                placeholder="file path, URL, or 'operator'"
                value={sourceRef}
                onChange={(e) => setSourceRef(e.target.value)}
              />
            </label>
          </>
        )}

        {error && <div className="rg-error">{error}</div>}

        <div className="rg-bar">
          <button type="button" className="rg-cancel" onClick={onCancel} disabled={pending}>cancel</button>
          <button type="button" className="rg-run" onClick={submit} disabled={pending}>
            {pending ? '…' : mode === 'reject' ? 'reject →' : mode === 'new' ? 'add →' : 'save →'}
          </button>
        </div>
      </div>
    </div>
  );
}
