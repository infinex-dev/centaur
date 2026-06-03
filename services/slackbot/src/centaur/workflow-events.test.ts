import { describe, expect, it, mock } from 'bun:test'
import { CentaurWorkflowEvents, sanitizeInteractionPayload } from './workflow-events'
import type { AppConfig } from '../config'
import type { ParsedSlackInteraction } from '../slack/interactivity'

const config = {
  CENTAUR_API_URL: 'http://api.test',
  SLACKBOT_API_KEY: 'slackbot-key'
} as AppConfig

const interaction: ParsedSlackInteraction = {
  type: 'block_actions',
  ref: {
    run_id: 'run_123',
    stage: 'facts',
    gate_version: 7,
    action: 'approve',
    target_id: 'fact_1'
  },
  slack_user_id: 'U123',
  slack_team_id: 'T123',
  channel_id: 'C123',
  message_ts: '1778883099.579529',
  values: { 'safe.value': 'ok', authorization: 'Bearer should-not-leak' }
}

describe('CentaurWorkflowEvents', () => {
  it('posts workflow events with auth and per-gate correlation IDs', async () => {
    const originalFetch = globalThis.fetch
    const fetchMock = mock(async (_input: string | URL | Request, init?: RequestInit) => {
      expect(String(_input)).toBe('http://api.test/workflows/events')
      expect(init?.headers).toMatchObject({ Authorization: 'Bearer slackbot-key' })
      expect(JSON.parse(init?.body as string)).toMatchObject({
        event_type: 'comms.action',
        correlation_id: 'run_123:facts:7',
        payload: {
          action: 'approve',
          stage: 'facts',
          gate_version: 7,
          slack: { user_id: 'U123', channel_id: 'C123' }
        }
      })
      return new Response(JSON.stringify({ ok: true, runs_woken: 1 }), { status: 200 })
    })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    try {
      const result = await new CentaurWorkflowEvents(config).dispatchInteraction(interaction)
      expect(result).toEqual({ ok: true, status: 200, body: { ok: true, runs_woken: 1 } })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('sanitizes submitted values and preserves distinct stage correlations', () => {
    const payload = sanitizeInteractionPayload(interaction.ref!, interaction)
    expect(payload.values).toEqual({ 'safe.value': 'ok' })

    const other = { ...interaction, ref: { ...interaction.ref!, stage: 'card' } }
    expect(`${interaction.ref!.run_id}:${interaction.ref!.stage}:${interaction.ref!.gate_version}`).not.toBe(
      `${other.ref.run_id}:${other.ref.stage}:${other.ref.gate_version}`
    )
  })
})
