export type PipelineId = "pipeline-1" | "pipeline-2" | "pipeline-3";

export interface PipelineProofField {
  key: string;
  label: string;
  passed: boolean;
  evidence: string;
}

export interface PipelineIdentityReport {
  pipeline_id: PipelineId;
  pipeline_label: string;
  entrypoint: string;
  generated_at: string;
  proof_passed: boolean;
  proof_fields: PipelineProofField[];
  warnings: string[];
}

export interface Pipeline3ProofInput {
  env_arch?: string | null;
  entrypoint?: string;
  actor_attempt_rows?: number;
  actor_run_event_rows?: number;
  candidate_rationale_has_actor_option?: boolean;
  director_audit_has_split_gates?: boolean;
  generated_at?: string;
}

export const PIPELINE_1_LABEL = "Pipeline 1 - legacy generator + regex validator";
export const PIPELINE_2_LABEL = "Pipeline 2 - legacy generator + active LLM validator";
export const PIPELINE_3_LABEL = "Pipeline 3 - Actor/Director";
export const PIPELINE_3_ENTRYPOINT = "orchestrateActorDirectorWithRetries()";

export function buildPipeline3Proof(input: Pipeline3ProofInput): PipelineIdentityReport {
  const entrypoint = input.entrypoint ?? PIPELINE_3_ENTRYPOINT;
  const actorAttempts = input.actor_attempt_rows ?? 0;
  const actorEvents = input.actor_run_event_rows ?? 0;
  const fields: PipelineProofField[] = [
    {
      key: "env_arch_actor",
      label: "Env contains HARNESS_GENERATOR_ARCH=actor",
      passed: input.env_arch === "actor",
      evidence: `HARNESS_GENERATOR_ARCH=${input.env_arch ?? "(unset)"}`,
    },
    {
      key: "entrypoint",
      label: "Entry point is orchestrateActorDirectorWithRetries()",
      passed: entrypoint === PIPELINE_3_ENTRYPOINT,
      evidence: entrypoint,
    },
    {
      key: "actor_attempt_rows",
      label: "DB has actor_attempts rows",
      passed: actorAttempts > 0,
      evidence: String(actorAttempts),
    },
    {
      key: "actor_run_event_rows",
      label: "DB has actor_run_events rows",
      passed: actorEvents > 0,
      evidence: String(actorEvents),
    },
    {
      key: "actor_option_rationale",
      label: "Candidate rationale contains \"Actor option N\"",
      passed: input.candidate_rationale_has_actor_option === true,
      evidence: input.candidate_rationale_has_actor_option ? "present" : "missing",
    },
    {
      key: "director_split_gates",
      label: "Director audit JSON contains copy_voice_passed, factual_passed, publication_gate_passed",
      passed: input.director_audit_has_split_gates === true,
      evidence: input.director_audit_has_split_gates ? "present" : "missing",
    },
  ];
  const warnings = fields
    .filter((field) => !field.passed)
    .map((field) => `${field.label}: ${field.evidence}`);

  return {
    pipeline_id: "pipeline-3",
    pipeline_label: PIPELINE_3_LABEL,
    entrypoint,
    generated_at: input.generated_at ?? new Date().toISOString(),
    proof_passed: warnings.length === 0,
    proof_fields: fields,
    warnings,
  };
}

export function assertPipeline3Proof(report: PipelineIdentityReport): void {
  if (report.pipeline_id !== "pipeline-3" || !report.proof_passed) {
    throw new Error(
      `Pipeline 3 proof failed. Treat this run as legacy until rerun.\n${report.warnings.join("\n")}`,
    );
  }
}
