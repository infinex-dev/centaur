import { describe, expect, it } from 'bun:test'
import { loadConfig } from './config'

describe('loadConfig Slack Socket Mode', () => {
  it('defaults Socket Mode off and leaves the app token optional', () => {
    const config = loadConfig({} as NodeJS.ProcessEnv)

    expect(config.SLACK_SOCKET_MODE).toBe(false)
    expect(config.SLACK_APP_TOKEN).toBeUndefined()
  })

  it('parses Socket Mode truthy values', () => {
    for (const value of ['1', 'true', 'TRUE', 'yes', 'on']) {
      expect(
        loadConfig({ SLACK_SOCKET_MODE: value } as unknown as NodeJS.ProcessEnv).SLACK_SOCKET_MODE
      ).toBe(true)
    }
  })

  it('parses Socket Mode falsey values and surfaces the app token', () => {
    for (const value of ['0', 'false', 'FALSE', '']) {
      const config = loadConfig({
        SLACK_SOCKET_MODE: value,
        SLACK_APP_TOKEN: 'xapp-test'
      } as unknown as NodeJS.ProcessEnv)

      expect(config.SLACK_SOCKET_MODE).toBe(false)
      expect(config.SLACK_APP_TOKEN).toBe('xapp-test')
    }
  })
})
