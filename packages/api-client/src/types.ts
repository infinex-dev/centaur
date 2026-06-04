// Re-export AxiosError as the standard error type for consumers
export { AxiosError as ApiError } from "axios";

// ---------------------------------------------------------------------------
// tool_result.v1 envelope — mirrors centaur_sdk/evidence.py
// ---------------------------------------------------------------------------

export interface EvidenceItem {
  schema_version: "centaur.evidence_item.v1";
  id: string;
  source: string;
  source_ref?: string | null;
  title?: string | null;
  url?: string | null;
  quote?: string | null;
  retrieved_at?: string | null;
  metadata?: Record<string, unknown>;
}

export interface ToolResultError {
  code: string;
  message: string;
}

export interface ToolResult {
  schema_version: "centaur.tool_result.v1";
  ok: boolean;
  content?: string | null;
  text?: string | null;
  output?: Record<string, unknown> | string | null;
  evidence: EvidenceItem[];
  error?: ToolResultError | null;
  retryable?: boolean;
}
