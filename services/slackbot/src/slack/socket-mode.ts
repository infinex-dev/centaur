import { SocketModeClient } from '@slack/socket-mode'
import { logError, logInfo, logWarn } from '../logging'

type AckFn = (response?: unknown) => void | Promise<void>

type SocketModeFrame = {
  type?: unknown
  envelope_id?: unknown
  ack?: AckFn
  body?: unknown
  event?: unknown
  command?: unknown
}

type SocketModeClientLike = {
  on(event: string, handler: (args: SocketModeFrame) => void | Promise<void>): unknown
  start(): Promise<unknown>
}

type SlackHandlerResult = {
  status: number
  body: unknown
}

type SocketModeHandlers = {
  handleEvent(rawBody: string, contentType: string | undefined): SlackHandlerResult
  handleCommand(rawBody: string): Promise<SlackHandlerResult>
}

export type StartSocketModeOptions = SocketModeHandlers & {
  appToken: string
  client?: SocketModeClientLike
}

export function startSocketMode(options: StartSocketModeOptions): SocketModeClientLike {
  const client =
    options.client ??
    new SocketModeClient({ appToken: options.appToken, clientOptions: { timeout: 10_000 } })

  client.on('connected', () => {
    logInfo('slack_socket_mode_connected')
  })
  client.on('disconnected', () => {
    logWarn('slack_socket_mode_disconnected')
  })
  client.on('error', frame => {
    logError('slack_socket_mode_client_error', frame)
  })

  client.on('slack_event', frame =>
    handleSlackEventFrame(frame, (rawBody, contentType) =>
      options.handleEvent(rawBody, contentType)
    )
  )
  client.on('slash_commands', frame =>
    handleSlashCommandFrame(frame, rawBody => options.handleCommand(rawBody))
  )
  client.on('interactive', frame => handleAckOnlyFrame(frame))
  client.on('options', frame => handleAckOnlyFrame(frame))

  void startWithRetry(client)

  return client
}

async function handleSlackEventFrame(
  frame: SocketModeFrame,
  handleEvent: SocketModeHandlers['handleEvent']
): Promise<void> {
  if (!isSlackEventCallbackFrame(frame)) return
  logSocketFrame('slack_socket_mode_event_received', frame)
  await safeAck(frame.ack)
  try {
    const envelope = normalizeEventEnvelope(frame.body, frame.event)
    handleEvent(JSON.stringify(envelope), 'application/json')
  } catch (error) {
    logError('slack_socket_mode_event_handler_failed', error)
  }
}

async function handleSlashCommandFrame(
  frame: SocketModeFrame,
  handleCommand: SocketModeHandlers['handleCommand']
): Promise<void> {
  logSocketFrame('slack_socket_mode_command_received', frame)
  try {
    const command = frame.command ?? frame.body
    const result = await withAckDeadline(
      handleCommand(toFormBody(command)),
      {
        status: 200,
        body: {
          response_type: 'ephemeral',
          text: 'Still working on that Slack command. If no result appears, check the slackbot logs.'
        }
      },
      2500
    )
    await safeAck(frame.ack, result.body)
  } catch (error) {
    logError('slack_socket_mode_command_handler_failed', error)
    await safeAck(frame.ack, {
      response_type: 'ephemeral',
      text: 'Could not process the Slack command. The error was logged for follow-up.'
    })
  }
}

async function handleAckOnlyFrame(frame: SocketModeFrame): Promise<void> {
  await safeAck(frame.ack)
}

async function startWithRetry(client: SocketModeClientLike, attempt = 0): Promise<void> {
  try {
    await client.start()
  } catch (error) {
    logError('slack_socket_mode_start_failed', error)
    const delayMs = Math.min(30_000, 1000 * 2 ** attempt)
    setTimeout(() => {
      void startWithRetry(client, attempt + 1)
    }, delayMs)
  }
}

async function withAckDeadline<T>(promise: Promise<T>, fallback: T, timeoutMs: number): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<T>(resolve => {
        timeout = setTimeout(() => resolve(fallback), timeoutMs)
      })
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

async function safeAck(ack: AckFn | undefined, response?: unknown): Promise<void> {
  if (!ack) return
  try {
    await ack(response)
  } catch (error) {
    logError('slack_socket_mode_ack_failed', error)
  }
}

function isSlackEventCallbackFrame(frame: SocketModeFrame): boolean {
  if (typeof frame.type === 'string') {
    return frame.type === 'events_api' || frame.type === 'event_callback'
  }
  if (!isRecord(frame.body)) return true
  return typeof frame.body.type !== 'string' || frame.body.type === 'event_callback'
}

function logSocketFrame(eventName: string, frame: SocketModeFrame): void {
  const body = isRecord(frame.body) ? frame.body : undefined
  const event = isRecord(body?.event) ? body.event : isRecord(frame.event) ? frame.event : undefined
  logInfo(eventName, {
    envelope_id: typeof frame.envelope_id === 'string' ? frame.envelope_id : undefined,
    frame_type: typeof frame.type === 'string' ? frame.type : undefined,
    body_type: typeof body?.type === 'string' ? body.type : undefined,
    event_type: typeof event?.type === 'string' ? event.type : undefined,
    event_id: typeof body?.event_id === 'string' ? body.event_id : undefined,
    team_id: typeof body?.team_id === 'string' ? body.team_id : undefined,
    channel_id: typeof event?.channel === 'string' ? event.channel : undefined
  })
}

function normalizeEventEnvelope(body: unknown, event: unknown): Record<string, unknown> {
  if (isRecord(body)) {
    if (isRecord(body.event)) return body
    return {
      ...body,
      type: typeof body.type === 'string' ? body.type : 'event_callback',
      event: isRecord(event) ? event : body.event
    }
  }
  return {
    type: 'event_callback',
    event: isRecord(event) ? event : undefined
  }
}

function toFormBody(value: unknown): string {
  if (!isRecord(value)) return ''
  const params = new URLSearchParams()
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined || item === null) continue
    if (typeof item === 'string') params.set(key, item)
    else if (typeof item === 'number' || typeof item === 'boolean') params.set(key, String(item))
  }
  return params.toString()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
