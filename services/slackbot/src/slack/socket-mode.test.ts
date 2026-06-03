import { describe, expect, it, mock } from 'bun:test'
import { startSocketMode } from './socket-mode'
import type { SlackCommandBodyResult, SlackEventBodyResult } from '../index'

type Handler = (frame: {
  type?: unknown
  ack?: (body?: unknown) => void | Promise<void>
  body?: unknown
  event?: unknown
  command?: unknown
}) => void | Promise<void>

function fakeClient() {
  const handlers = new Map<string, Handler>()
  const client = {
    on: mock((event: string, handler: Handler) => {
      handlers.set(event, handler)
      return client
    }),
    start: mock(async () => ({ ok: true }))
  }
  return { client, handlers }
}

describe('startSocketMode', () => {
  it('acks Slack events and routes the reconstructed envelope to the shared event core', async () => {
    const { client, handlers } = fakeClient()
    const ack = mock(async () => {})
    const handleEvent = mock(
      (_rawBody: string, _contentType: string | undefined): SlackEventBodyResult => ({
        status: 200,
        body: { ok: true }
      })
    )

    startSocketMode({
      appToken: 'xapp-test',
      client,
      handleEvent,
      handleCommand: async (): Promise<SlackCommandBodyResult> => ({
        status: 200,
        body: { response_type: 'ephemeral', text: 'unused' }
      })
    })

    await handlers.get('slack_event')?.({
      ack,
      body: {
        type: 'event_callback',
        event_id: 'Ev-socket',
        team_id: 'T123',
        event: { type: 'app_mention', channel: 'C123', ts: '1778883099.579529' }
      }
    })

    expect(client.start).toHaveBeenCalledTimes(1)
    expect(ack).toHaveBeenCalledTimes(1)
    expect(handleEvent).toHaveBeenCalledTimes(1)
    const [rawBody, contentType] = handleEvent.mock.calls[0] as [string, string]
    expect(contentType).toBe('application/json')
    expect(JSON.parse(rawBody)).toMatchObject({
      type: 'event_callback',
      event_id: 'Ev-socket',
      event: { type: 'app_mention', channel: 'C123' }
    })
  })

  it('does not let the umbrella slack_event handler consume slash command acks', async () => {
    const { client, handlers } = fakeClient()
    const ack = mock(async () => {})
    const handleEvent = mock((_rawBody: string, _contentType: string | undefined): SlackEventBodyResult => ({
      status: 200,
      body: { ok: true }
    }))

    startSocketMode({
      appToken: 'xapp-test',
      client,
      handleEvent,
      handleCommand: async (): Promise<SlackCommandBodyResult> => ({
        status: 200,
        body: { response_type: 'ephemeral', text: 'unused' }
      })
    })

    await handlers.get('slack_event')?.({
      type: 'slash_commands',
      ack,
      body: { command: '/website-feedback' }
    })

    expect(ack).not.toHaveBeenCalled()
    expect(handleEvent).not.toHaveBeenCalled()
  })

  it('passes slash command ephemeral responses to ack', async () => {
    const { client, handlers } = fakeClient()
    const ack = mock(async (_body?: unknown) => {})
    const response = {
      response_type: 'ephemeral' as const,
      text: 'Created DSGN-123: https://linear.app/x'
    }
    const handleCommand = mock(
      async (_rawBody: string): Promise<SlackCommandBodyResult> => ({
        status: 200,
        body: response
      })
    )

    startSocketMode({
      appToken: 'xapp-test',
      client,
      handleEvent: (): SlackEventBodyResult => ({ status: 200, body: { ok: true } }),
      handleCommand
    })

    await handlers.get('slash_commands')?.({
      ack,
      command: {
        command: '/website-feedback',
        text: 'Button copy is confusing',
        user_id: 'U123',
        channel_id: 'C123'
      }
    })

    expect(handleCommand).toHaveBeenCalledTimes(1)
    expect(handleCommand.mock.calls[0]?.[0]).toContain('command=%2Fwebsite-feedback')
    expect(ack).toHaveBeenCalledWith(response)
  })

  it('acks slash commands with a fallback body when command handling throws', async () => {
    const { client, handlers } = fakeClient()
    const ack = mock(async (_body?: unknown) => {})
    const originalError = console.error
    console.error = mock(() => {}) as typeof console.error
    try {
      startSocketMode({
        appToken: 'xapp-test',
        client,
        handleEvent: (): SlackEventBodyResult => ({ status: 200, body: { ok: true } }),
        handleCommand: async (): Promise<SlackCommandBodyResult> => {
          throw new Error('linear down')
        }
      })

      await handlers.get('slash_commands')?.({
        ack,
        command: { command: '/website-feedback', text: 'Button copy is confusing' }
      })

      expect(ack).toHaveBeenCalledWith({
        response_type: 'ephemeral',
        text: 'Could not process the Slack command. The error was logged for follow-up.'
      })
    } finally {
      console.error = originalError
    }
  })

  it('acks interactive and options frames without routing them to the event core', async () => {
    const { client, handlers } = fakeClient()
    const ack = mock(async () => {})
    const handleEvent = mock((): SlackEventBodyResult => ({ status: 200, body: { ok: true } }))

    startSocketMode({
      appToken: 'xapp-test',
      client,
      handleEvent,
      handleCommand: async (): Promise<SlackCommandBodyResult> => ({
        status: 200,
        body: { response_type: 'ephemeral', text: 'unused' }
      })
    })

    await handlers.get('interactive')?.({ ack })
    await handlers.get('options')?.({ ack })

    expect(ack).toHaveBeenCalledTimes(2)
    expect(handleEvent).not.toHaveBeenCalled()
  })

  it('acks Slack events before logging handler failures', async () => {
    const { client, handlers } = fakeClient()
    const ack = mock(async () => {})
    const originalError = console.error
    console.error = mock(() => {}) as typeof console.error
    try {
      startSocketMode({
        appToken: 'xapp-test',
        client,
        handleEvent: () => {
          throw new Error('boom')
        },
        handleCommand: async (): Promise<SlackCommandBodyResult> => ({
          status: 200,
          body: { response_type: 'ephemeral', text: 'unused' }
        })
      })

      await handlers.get('slack_event')?.({
        ack,
        body: { type: 'event_callback', event: { type: 'message' } }
      })

      expect(ack).toHaveBeenCalledTimes(1)
      expect(console.error).toHaveBeenCalledWith(
        'slack_socket_mode_event_handler_failed',
        expect.objectContaining({ message: 'boom' })
      )
    } finally {
      console.error = originalError
    }
  })
})
