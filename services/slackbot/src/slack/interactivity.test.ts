import { describe, expect, it, mock } from 'bun:test'
import {
  compactRefFromValue,
  handleSlackInteractionBody,
  interactionCorrelationId,
  parseSlackInteractionBody
} from './interactivity'

const ref = {
  run_id: 'run_123',
  stage: 'facts',
  gate_version: 2,
  action: 'approve',
  target_id: 'fact_1',
  requester_user_id: 'U123'
}

describe('Slack interactivity parsing', () => {
  it('parses block action compact refs and derives correlation IDs', () => {
    const payload = {
      type: 'block_actions',
      user: { id: 'U123' },
      team: { id: 'T123' },
      channel: { id: 'C123' },
      message: { ts: '1778883099.579529' },
      actions: [{ action_id: 'comms:approve', value: JSON.stringify(ref) }]
    }
    const body = new URLSearchParams({ payload: JSON.stringify(payload) }).toString()

    const parsed = parseSlackInteractionBody(body, 'application/x-www-form-urlencoded')

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.interaction.ref).toEqual(ref)
    expect(interactionCorrelationId(parsed.interaction.ref!)).toBe('run_123:facts:2')
  })

  it('parses view submissions with sanitized submitted values from private metadata', () => {
    const payload = {
      type: 'view_submission',
      user: { id: 'U123' },
      view: {
        id: 'V123',
        private_metadata: JSON.stringify({ ...ref, action: 'edit' }),
        state: {
          values: {
            comms_input: {
              value: { type: 'plain_text_input', value: 'updated fact\u0000' }
            }
          }
        }
      }
    }

    const parsed = parseSlackInteractionBody(JSON.stringify(payload), 'application/json')

    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.interaction.values).toEqual({ 'comms_input.value': 'updated fact' })
    expect(parsed.interaction.view_id).toBe('V123')
  })

  it('rejects malformed payloads and oversized compact refs safely', () => {
    expect(parseSlackInteractionBody('payload=not-json', 'application/x-www-form-urlencoded')).toEqual({
      ok: false,
      status: 400,
      error: 'malformed_interaction_payload'
    })
    expect(compactRefFromValue(JSON.stringify({ ...ref, run_id: 'x'.repeat(3000) }))).toBeNull()
  })

  it('dispatches authorized approve actions through the shared handler', async () => {
    const dispatch = mock(async () => {})
    const payload = {
      type: 'block_actions',
      user: { id: 'U123' },
      actions: [{ action_id: 'comms:approve', value: JSON.stringify(ref) }]
    }

    const result = await handleSlackInteractionBody(JSON.stringify(payload), 'application/json', { dispatch })

    expect(result).toEqual({ status: 200, body: { ok: true } })
    expect(dispatch).toHaveBeenCalledTimes(1)
    const calls = dispatch.mock.calls as unknown as [[unknown]]
    expect(calls[0]?.[0]).toMatchObject({ ref })
  })

  it('returns an ephemeral response instead of dispatching unauthorized clicks', async () => {
    const dispatch = mock(async () => {})
    const payload = {
      type: 'block_actions',
      user: { id: 'U999' },
      actions: [{ action_id: 'comms:approve', value: JSON.stringify(ref) }]
    }

    const result = await handleSlackInteractionBody(JSON.stringify(payload), 'application/json', { dispatch })

    expect(result.status).toBe(200)
    expect(result.body).toMatchObject({ response_type: 'ephemeral' })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('rejects comms refs that omit requester or approver authority metadata', async () => {
    const dispatch = mock(async () => {})
    const payload = {
      type: 'block_actions',
      user: { id: 'U123' },
      actions: [
        {
          action_id: 'comms:approve',
          value: JSON.stringify({ run_id: 'run_123', stage: 'facts', gate_version: 1, action: 'approve' })
        }
      ]
    }

    const result = await handleSlackInteractionBody(JSON.stringify(payload), 'application/json', { dispatch })

    expect(result.status).toBe(400)
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('opens an edit modal before dispatching modal-backed actions', async () => {
    const dispatch = mock(async () => {})
    const views = { open: mock(async (_args: unknown) => ({ ok: true })) }
    const payload = {
      type: 'block_actions',
      trigger_id: 'trigger-123',
      user: { id: 'U123' },
      actions: [
        { action_id: 'comms:edit', value: JSON.stringify({ ...ref, action: 'edit_fact' }) }
      ]
    }

    const result = await handleSlackInteractionBody(JSON.stringify(payload), 'application/json', {
      client: { views } as never,
      dispatch
    })

    expect(result).toEqual({ status: 200, body: { ok: true } })
    expect(views.open).toHaveBeenCalledTimes(1)
    expect(dispatch).not.toHaveBeenCalled()
  })
})
