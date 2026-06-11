/**
 * Synchronously copy rich text (HTML + plain) to the clipboard inside a click
 * handler — via the `copy` event + execCommand, NOT the async Clipboard API.
 *
 * Why not navigator.clipboard.write: when the same click also opens a new tab
 * (window.open), the new tab steals focus and consumes the user gesture, so the
 * async clipboard.write fails ("document not focused" / no transient activation).
 * The copy-event path is fully synchronous, so it lands before the tab opens.
 *
 * Returns true if the copy event fired (the browser accepted the copy).
 */
export function copyRichText(html: string, plain: string): boolean {
  if (typeof document === 'undefined') return false;

  let ok = false;
  const onCopy = (e: ClipboardEvent) => {
    e.preventDefault();
    e.clipboardData?.setData('text/html', html);
    e.clipboardData?.setData('text/plain', plain);
    ok = true;
  };
  document.addEventListener('copy', onCopy);

  const span = document.createElement('span');
  span.textContent = plain || ' '; // need a non-empty selection for execCommand('copy')
  span.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;white-space:pre;';
  document.body.appendChild(span);

  const sel = window.getSelection();
  const saved = sel && sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
  try {
    const range = document.createRange();
    range.selectNodeContents(span);
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.execCommand('copy');
  } finally {
    sel?.removeAllRanges();
    if (saved) sel?.addRange(saved);
    span.remove();
    document.removeEventListener('copy', onCopy);
  }
  return ok;
}
