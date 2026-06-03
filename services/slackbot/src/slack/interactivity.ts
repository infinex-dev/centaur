import type { WebClient } from '@slack/web-api'

export type CommsCompactRef = {
  run_id: string
  stage: string
  gate_version: number
  action: string
  target_id?: string
  requester_user_id?: string
  approver_user_ids?: string[]
}

export type SlackSubmittedValues = Record<string, string>

export type ParsedSlackInteraction = {
  type: 'block_actions' | 'view_submission' | 'shortcut' | 'message_action' | 'options'
  ref?: CommsCompactRef
  trigger_id?: string
  response_url?: string
  slack_user_id?: string
  slack_team_id?: string
  slack_user_team_id?: string
  slack_source_team_id?: string
  channel_id?: string
  message_ts?: string
  view_id?: string
  raw_action_id?: string
  values?: SlackSubmittedValues
}

export type SlackInteractionParseResult =
  | { ok: true; interaction: ParsedSlackInteraction }
  | { ok: false; status: number; error: string; userMessage?: string }

export type SlackInteractionHandleResult =
  | { status: 200; body: Record<string, unknown> }
  | { status: 400; body: { ok: false; error: string } }

export type SlackInteractionDispatch = (interaction: ParsedSlackInteraction) => Promise<void>

export type SlackInteractionOptions = {
  client?: WebClient
  dispatch?: SlackInteractionDispatch
  authorize?: (interaction: ParsedSlackInteraction) => SlackInteractionHandleResult | null
}

const MAX_REF_BYTES = 1900
const IDENT_RE = /^[A-Za-z0-9_.:-]{1,128}$/
const EDIT_ACTION_RE = /^(edit|add|answer|qa|retry)(?:_|$)/i

export function parseSlackInteractionBody(
  rawBody: string,
  contentType: string | undefined
): SlackInteractionParseResult {
  const payloadResult = parsePayload(rawBody, contentType)
  if (!payloadResult.ok) return payloadResult
  const payload = payloadResult.payload
  const type = stringValue(payload.type)
  if (!type) return invalid('missing_interaction_type')

  if (type === 'block_suggestion' || type === 'external_select') {
    return {
      ok: true,
      interaction: baseInteraction('options', payload)
    }
  }

  if (type !== 'block_actions' && type !== 'view_submission' && type !== 'shortcut' && type !== 'message_action') {
    return invalid('unsupported_interaction_type')
  }

  const base = baseInteraction(type, payload)
  const refResult = extractCompactRef(payload)
  if (!refResult.ok) return refResult
  const interaction: ParsedSlackInteraction = {
    ...base,
    ref: refResult.ref,
    raw_action_id: refResult.actionId,
    values: type === 'view_submission' ? extractViewValues(payload.view) : undefined,
    view_id: isRecord(payload.view) ? stringValue(payload.view.id) : undefined
  }

  if (interaction.ref && !hasAuthorityMetadata(interaction.ref)) {
    return {
      ok: false,
      status: 400,
      error: 'missing_interaction_authority'
    }
  }

  if (interaction.ref && interaction.slack_user_id && !isAuthorizedUser(interaction.ref, interaction.slack_user_id)) {
    return {
      ok: false,
      status: 200,
      error: 'unauthorized_interaction',
      userMessage: 'You are not allowed to act on this comms gate.'
    }
  }

  return { ok: true, interaction }
}

export async function handleSlackInteractionBody(
  rawBody: string,
  contentType: string | undefined,
  options: SlackInteractionOptions = {}
): Promise<SlackInteractionHandleResult> {
  const parsed = parseSlackInteractionBody(rawBody, contentType)
  if (!parsed.ok) {
    if (parsed.status === 200) {
      return {
        status: 200,
        body: {
          response_type: 'ephemeral',
          replace_original: false,
          text: parsed.userMessage ?? 'That Slack action could not be processed.'
        }
      }
    }
    return { status: 400, body: { ok: false, error: parsed.error } }
  }

  const interaction = parsed.interaction
  const authorization = options.authorize?.(interaction)
  if (authorization) return authorization
  if (interaction.type === 'options') {
    return { status: 200, body: { options: [] } }
  }

  if (!interaction.ref) {
    return {
      status: 200,
      body: {
        response_type: 'ephemeral',
        replace_original: false,
        text: 'This action is missing workflow context.'
      }
    }
  }

  if (interaction.type === 'block_actions' && shouldOpenModal(interaction.ref.action)) {
    if (!interaction.trigger_id || !options.client) {
      return {
        status: 200,
        body: {
          response_type: 'ephemeral',
          replace_original: false,
          text: 'Slack could not open the edit modal for this action. Please try again.'
        }
      }
    }
    await options.client.views.open({
      trigger_id: interaction.trigger_id,
      view: buildCommsModalView(interaction.ref)
    })
    return { status: 200, body: { ok: true } }
  }

  if (options.dispatch) await options.dispatch(interaction)
  return { status: 200, body: { ok: true } }
}

export function compactRefFromValue(value: string): CommsCompactRef | null {
  if (!value || Buffer.byteLength(value, 'utf8') > MAX_REF_BYTES) return null
  try {
    const data = JSON.parse(value) as unknown
    if (!isRecord(data)) return null
    const run_id = stringValue(data.run_id ?? data.runId)
    const stage = stringValue(data.stage)
    const action = stringValue(data.action)
    const versionRaw = data.gate_version ?? data.gateVersion
    const gate_version = typeof versionRaw === 'number' ? versionRaw : Number(versionRaw)
    if (!run_id || !stage || !action || !Number.isInteger(gate_version) || gate_version < 0) {
      return null
    }
    if (!IDENT_RE.test(run_id) || !IDENT_RE.test(stage) || !IDENT_RE.test(action)) return null
    const target_id = stringValue(data.target_id ?? data.targetId)
    if (target_id && !IDENT_RE.test(target_id)) return null
    const requester_user_id = stringValue(data.requester_user_id ?? data.requesterUserId)
    const approver_user_ids = stringArray(data.approver_user_ids ?? data.approverUserIds)
    return {
      run_id,
      stage,
      gate_version,
      action,
      ...(target_id ? { target_id } : {}),
      ...(requester_user_id ? { requester_user_id } : {}),
      ...(approver_user_ids.length ? { approver_user_ids } : {})
    }
  } catch {
    return null
  }
}

export function interactionCorrelationId(ref: CommsCompactRef): string {
  return `${ref.run_id}:${ref.stage}:${ref.gate_version}`
}

function parsePayload(
  rawBody: string,
  contentType: string | undefined
): { ok: true; payload: Record<string, unknown> } | { ok: false; status: 400; error: string } {
  try {
    if (contentType?.includes('application/x-www-form-urlencoded')) {
      const form = new URLSearchParams(rawBody)
      const payload = form.get('payload')
      if (!payload) return { ok: false, status: 400, error: 'missing_interaction_payload' }
      const parsed = JSON.parse(payload) as unknown
      if (!isRecord(parsed)) return { ok: false, status: 400, error: 'invalid_interaction_payload' }
      return { ok: true, payload: parsed }
    }
    const parsed = JSON.parse(rawBody) as unknown
    if (!isRecord(parsed)) return { ok: false, status: 400, error: 'invalid_interaction_payload' }
    return { ok: true, payload: parsed }
  } catch {
    return { ok: false, status: 400, error: 'malformed_interaction_payload' }
  }
}

function extractCompactRef(
  payload: Record<string, unknown>
): { ok: true; ref?: CommsCompactRef; actionId?: string } | { ok: false; status: number; error: string; userMessage?: string } {
  const view = isRecord(payload.view) ? payload.view : undefined
  const metadata = stringValue(view?.private_metadata)
  if (metadata) {
    const ref = compactRefFromValue(metadata)
    return ref ? { ok: true, ref } : invalid('invalid_modal_metadata')
  }
  const actions = Array.isArray(payload.actions) ? payload.actions : []
  const action = actions.find(isRecord)
  if (action) {
    const value = stringValue(action.value)
    const actionId = stringValue(action.action_id)
    if (value) {
      const ref = compactRefFromValue(value)
      if (!ref) return invalid('invalid_action_value')
      return { ok: true, ref, actionId }
    }
    if (actionId?.startsWith('comms:')) return invalid('missing_action_value')
    return { ok: true, actionId }
  }
  return { ok: true }
}

function baseInteraction(type: ParsedSlackInteraction['type'], payload: Record<string, unknown>): ParsedSlackInteraction {
  const user = isRecord(payload.user) ? payload.user : undefined
  const team = isRecord(payload.team) ? payload.team : undefined
  const channel = isRecord(payload.channel) ? payload.channel : undefined
  const message = isRecord(payload.message) ? payload.message : undefined
  return {
    type,
    trigger_id: stringValue(payload.trigger_id),
    response_url: stringValue(payload.response_url),
    slack_user_id: stringValue(user?.id ?? payload.user_id),
    slack_team_id: stringValue(team?.id ?? payload.team_id),
    slack_user_team_id: stringValue(user?.team_id ?? user?.team ?? payload.user_team),
    slack_source_team_id: stringValue(payload.source_team),
    channel_id: stringValue(channel?.id ?? payload.channel_id),
    message_ts: stringValue(message?.ts ?? payload.message_ts)
  }
}

function extractViewValues(view: unknown): SlackSubmittedValues {
  const values = isRecord(view) && isRecord(view.state) && isRecord(view.state.values) ? view.state.values : {}
  const out: SlackSubmittedValues = {}
  for (const [blockId, blockValue] of Object.entries(values)) {
    if (!isRecord(blockValue)) continue
    for (const [actionId, field] of Object.entries(blockValue)) {
      if (!isRecord(field)) continue
      const key = sanitizeFieldKey(`${blockId}.${actionId}`)
      const raw = stringValue(field.value ?? field.selected_option?.value)
      if (raw !== undefined) out[key] = sanitizeFieldValue(raw)
    }
  }
  return out
}

function buildCommsModalView(ref: CommsCompactRef) {
  const title = modalTitle(ref.action)
  return {
    type: 'modal' as const,
    callback_id: 'comms_gate_submission',
    title: { type: 'plain_text' as const, text: title.slice(0, 24) || 'Comms gate' },
    submit: { type: 'plain_text' as const, text: 'Submit' },
    close: { type: 'plain_text' as const, text: 'Cancel' },
    private_metadata: JSON.stringify(ref),
    blocks: [
      {
        type: 'input' as const,
        block_id: 'comms_input',
        label: { type: 'plain_text' as const, text: title },
        element: {
          type: 'plain_text_input' as const,
          action_id: 'value',
          multiline: true,
          max_length: 2500,
          placeholder: { type: 'plain_text' as const, text: 'Enter the edit or answer' }
        }
      }
    ]
  }
}

function shouldOpenModal(action: string): boolean {
  return EDIT_ACTION_RE.test(action)
}

function modalTitle(action: string): string {
  if (/qa|answer/i.test(action)) return 'Answer fact question'
  if (/retry/i.test(action)) return 'Retry notes'
  if (/add/i.test(action)) return 'Add facts'
  return 'Edit comms gate'
}

function hasAuthorityMetadata(ref: CommsCompactRef): boolean {
  return Boolean(ref.requester_user_id || ref.approver_user_ids?.length)
}

function isAuthorizedUser(ref: CommsCompactRef, userId: string): boolean {
  if (ref.requester_user_id === userId) return true
  return (ref.approver_user_ids ?? []).includes(userId)
}

function invalid(error: string): { ok: false; status: 400; error: string } {
  return { ok: false, status: 400, error }
}

function sanitizeFieldKey(value: string): string {
  return value.replace(/[^A-Za-z0-9_.:-]+/g, '_').slice(0, 120)
}

function sanitizeFieldValue(value: string): string {
  return value.replace(/\u0000/g, '').slice(0, 5000)
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    .map(item => item.trim())
}

function isRecord(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
