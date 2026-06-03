import { z } from 'zod'

const WorkflowCommandSchema = z.object({
  match: z.string().min(1),
  workflow: z.string().min(1),
  input: z.record(z.string(), z.string()).default({}),
  triggerSuffix: z.string().optional()
})

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().positive().default(3001),
  SLACK_BOT_TOKEN: z.string().optional(),
  SLACK_API_URL: z.string().url().optional(),
  SLACK_SIGNING_SECRET: z.string().optional(),
  SLACK_APP_TOKEN: z.string().optional(),
  SLACK_SOCKET_MODE: z
    .string()
    .default('')
    .transform(value => ['1', 'true', 'yes', 'on'].includes(value.trim().toLowerCase())),
  SLACK_WORKFLOW_COMMANDS: z
    .string()
    .default('')
    .transform(value => {
      const raw = value.trim()
      if (!raw) return []
      return z.array(WorkflowCommandSchema).parse(JSON.parse(raw))
    }),
  SLACKBOT_API_KEY: z.string().optional(),
  CENTAUR_API_URL: z.string().url().default('http://localhost:8000'),
  CENTAUR_API_KEY: z.string().optional(),
  CENTAUR_SLACK_EVENTS_PATH: z.string().default('/api/webhooks/slack'),
  RUNTIME_ERROR_ALERT_CHANNEL: z.string().default(''),
  SLACK_EVENT_DEDUP_TTL_MS: z.coerce
    .number()
    .int()
    .positive()
    .default(10 * 60 * 1000),
  SLACK_SIGNATURE_MAX_AGE_SECONDS: z.coerce
    .number()
    .int()
    .positive()
    .default(60 * 5),
  LINEAR_API_KEY: z.string().optional(),
  SLACK_FEEDBACK_COMMANDS: z
    .string()
    .default('/website-feedback')
    .transform(value =>
      value
        .split(/[\s,]+/)
        .map(part => part.trim())
        .filter(Boolean)
    ),
  SLACK_FEEDBACK_LINEAR_TEAM_ID: z.string().default('caf113f0-703b-454e-87fd-5772dfea62a5'),
  SLACK_FEEDBACK_LINEAR_PROJECT_ID: z.string().default('34e30cef-da96-4905-9814-1f8674e7f2ae'),
  SLACK_FEEDBACK_ALLOWED_CHANNELS: z
    .string()
    .default('')
    .transform(value =>
      value
        .split(/[\s,]+/)
        .map(part => part.trim())
        .filter(Boolean)
    ),
  SLACKBOT_EXTERNAL_ORG_ALLOWLIST: z
    .string()
    .default('')
    .transform(value =>
      value
        .split(/[\s,]+/)
        .map(part => part.trim())
        .filter(Boolean)
    )
})

export type AppConfig = z.infer<typeof EnvSchema>

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  return EnvSchema.parse(env)
}

export function centaurApiKey(config: AppConfig): string | undefined {
  return config.SLACKBOT_API_KEY || config.CENTAUR_API_KEY || undefined
}
