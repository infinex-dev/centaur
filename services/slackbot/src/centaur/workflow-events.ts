import { centaurApiKey, type AppConfig } from '../config'
import {
  interactionCorrelationId,
  type CommsCompactRef,
  type ParsedSlackInteraction
} from '../slack/interactivity'

export type WorkflowEventDispatchResult =
  | { ok: true; status: number; body: unknown }
  | { ok: false; status: number; body: unknown }

export class CentaurWorkflowEvents {
  readonly config: AppConfig

  constructor(config: AppConfig) {
    this.config = config
  }

  async dispatchInteraction(interaction: ParsedSlackInteraction): Promise<WorkflowEventDispatchResult> {
    if (!interaction.ref) {
      return { ok: false, status: 400, body: { ok: false, error: 'missing_compact_ref' } }
    }
    return this.send({
      event_type: 'comms.action',
      correlation_id: interactionCorrelationId(interaction.ref),
      payload: sanitizeInteractionPayload(interaction.ref, interaction)
    })
  }

  async send(body: {
    event_type: string
    correlation_id: string
    payload: Record<string, unknown>
  }): Promise<WorkflowEventDispatchResult> {
    const url = new URL('/workflows/events', this.config.CENTAUR_API_URL)
    const apiKey = centaurApiKey(this.config)
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: JSON.stringify(body)
    })
    const responseBody = await readResponseBody(response)
    return { ok: response.ok, status: response.status, body: responseBody }
  }
}

export function sanitizeInteractionPayload(
  ref: CommsCompactRef,
  interaction: ParsedSlackInteraction
): Record<string, unknown> {
  return {
    ref: {
      run_id: ref.run_id,
      stage: ref.stage,
      gate_version: ref.gate_version,
      action: ref.action,
      target_id: ref.target_id
    },
    slack: {
      team_id: interaction.slack_team_id,
      user_id: interaction.slack_user_id,
      user_team_id: interaction.slack_user_team_id,
      source_team_id: interaction.slack_source_team_id,
      channel_id: interaction.channel_id,
      message_ts: interaction.message_ts,
      view_id: interaction.view_id
    },
    action: ref.action,
    target_id: ref.target_id,
    stage: ref.stage,
    gate_version: ref.gate_version,
    values: sanitizeValues(interaction.values ?? {})
  }
}

function sanitizeValues(values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    if (/token|secret|authorization|cookie/i.test(key)) continue
    out[key] = value.slice(0, 5000)
  }
  return out
}

async function readResponseBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}
