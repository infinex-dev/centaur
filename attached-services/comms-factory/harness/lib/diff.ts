import { diffWords } from 'diff';

export interface FieldDiff {
  field_path: string;
  before_value: string;
  after_value: string;
  edited_at: string;
}

export interface TextDiff {
  before_text: string;
  after_text: string;
  word_diff_json: string;
  edited_at: string;
}

export interface SemanticShift {
  beat_index: number;
  before_tempo: string | null;
  after_tempo: string | null;
}

export function makeFieldDiff(
  fieldPath: string,
  beforeValue: unknown,
  afterValue: unknown,
  editedAt: string,
): FieldDiff | null {
  const before = stringifyValue(beforeValue);
  const after = stringifyValue(afterValue);
  if (before === after) return null;
  return {
    field_path: fieldPath,
    before_value: before,
    after_value: after,
    edited_at: editedAt,
  };
}

export function makeFieldDiffs(
  before: unknown,
  after: unknown,
  editedAt: string,
  prefix = '',
): FieldDiff[] {
  if (before === after) return [];
  if (!isObjectLike(before) || !isObjectLike(after)) {
    const diff = makeFieldDiff(prefix, before, after, editedAt);
    return diff ? [diff] : [];
  }

  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diffs: FieldDiff[] = [];
  for (const field of fields) {
    const childPath = appendPath(prefix, field);
    diffs.push(...makeFieldDiffs(before[field], after[field], editedAt, childPath));
  }
  return diffs;
}

export function makeTextDiff(beforeText: string, afterText: string, editedAt: string): TextDiff | null {
  if (beforeText === afterText) return null;
  return {
    before_text: beforeText,
    after_text: afterText,
    word_diff_json: JSON.stringify(diffWords(beforeText, afterText)),
    edited_at: editedAt,
  };
}

export function makeSemanticShifts(beforeAudit: unknown, afterAudit: unknown): SemanticShift[] {
  const beforeItems = Array.isArray(beforeAudit) ? beforeAudit : [];
  const afterItems = Array.isArray(afterAudit) ? afterAudit : [];
  const beforeByIndex = new Map<number, Record<string, unknown>>();
  for (const item of beforeItems) {
    if (!isRecord(item) || typeof item.beat_index !== 'number') continue;
    beforeByIndex.set(item.beat_index, item);
  }

  const shifts: SemanticShift[] = [];
  for (const item of afterItems) {
    if (!isRecord(item) || typeof item.beat_index !== 'number') continue;
    const before = beforeByIndex.get(item.beat_index);
    const beforeTempo = tempoFromAudit(before);
    const afterTempo = tempoFromAudit(item);
    if (beforeTempo !== afterTempo) {
      shifts.push({
        beat_index: item.beat_index,
        before_tempo: beforeTempo,
        after_tempo: afterTempo,
      });
    }
  }
  return shifts;
}

export function getPathValue(root: unknown, path: string): unknown {
  const parts = parsePath(path);
  let cursor = root;
  for (const part of parts) {
    if (cursor == null) return undefined;
    if (typeof part === 'number') {
      if (!Array.isArray(cursor)) return undefined;
      cursor = cursor[part];
    } else if (typeof cursor === 'object') {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cursor;
}

export function setPathValue(root: unknown, path: string, value: unknown): unknown {
  const parts = parsePath(path);
  if (parts.length === 0) return value;
  if (!isRecord(root)) throw new Error(`Cannot set path on non-object root: ${path}`);

  let cursor: Record<string, unknown> | unknown[] = root;
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;
    const next = parts[i + 1]!;
    if (typeof part === 'number') {
      if (!Array.isArray(cursor)) throw new Error(`Expected array while setting ${path}`);
      if (cursor[part] === undefined) cursor[part] = typeof next === 'number' ? [] : {};
      cursor = cursor[part] as Record<string, unknown> | unknown[];
    } else {
      if (Array.isArray(cursor)) throw new Error(`Expected object while setting ${path}`);
      if (cursor[part] === undefined) cursor[part] = typeof next === 'number' ? [] : {};
      cursor = cursor[part] as Record<string, unknown> | unknown[];
    }
  }

  const last = parts[parts.length - 1]!;
  if (typeof last === 'number') {
    if (!Array.isArray(cursor)) throw new Error(`Expected array while setting ${path}`);
    cursor[last] = value;
  } else {
    if (Array.isArray(cursor)) throw new Error(`Expected object while setting ${path}`);
    cursor[last] = value;
  }
  return root;
}

function tempoFromAudit(item: unknown): string | null {
  if (!isRecord(item)) return null;
  const classified = item.classified_tempo;
  if (typeof classified === 'string') return classified;
  const tempo = item.tempo_primary;
  if (typeof tempo === 'string') return tempo;
  return null;
}

function stringifyValue(value: unknown): string {
  if (value === undefined) return '';
  if (value === null) return 'null';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function isObjectLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return isObjectLike(value) && !Array.isArray(value);
}

function appendPath(prefix: string, field: string): string {
  if (/^\d+$/.test(field)) return `${prefix}[${field}]`;
  if (!prefix) return field;
  return `${prefix}.${field}`;
}

function parsePath(path: string): Array<string | number> {
  const parts: Array<string | number> = [];
  const re = /([^.[\]]+)|\[(\d+)\]/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(path))) {
    if (match[1] !== undefined) parts.push(match[1]);
    if (match[2] !== undefined) parts.push(Number(match[2]));
  }
  return parts;
}
