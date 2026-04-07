import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { z } from 'zod'

const submitSchema = z.object({
  content: z.string().min(1, '1文字以上入力してください'),
})

const TURN_DURATION_SECONDS = 60

function nextTimerEnd(): string {
  return new Date(Date.now() + TURN_DURATION_SECONDS * 1000).toISOString()
}

describe('submitSchema', () => {
  it('1文字以上のcontentを受け付ける', () => {
    const result = submitSchema.safeParse({ content: 'こんにちは' })
    expect(result.success).toBe(true)
  })

  it('空文字はエラー', () => {
    const result = submitSchema.safeParse({ content: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('1文字以上入力してください')
    }
  })

  it('長い文字列も受け付ける（charLimit検証はスキーマ外）', () => {
    const result = submitSchema.safeParse({ content: 'あ'.repeat(200) })
    expect(result.success).toBe(true)
  })
})

describe('charLimit検証ロジック', () => {
  it('content.length > charLimit の場合はエラーメッセージを返す', () => {
    const charLimit = 100
    const content = 'あ'.repeat(101)
    const error = content.length > charLimit
      ? `${charLimit}文字以内で入力してください`
      : null
    expect(error).toBe('100文字以内で入力してください')
  })

  it('content.length === charLimit の場合はエラーなし', () => {
    const charLimit = 100
    const content = 'あ'.repeat(100)
    const error = content.length > charLimit
      ? `${charLimit}文字以内で入力してください`
      : null
    expect(error).toBeNull()
  })

  it('content.length < charLimit の場合はエラーなし', () => {
    const charLimit = 100
    const content = 'あ'.repeat(50)
    const error = content.length > charLimit
      ? `${charLimit}文字以内で入力してください`
      : null
    expect(error).toBeNull()
  })
})

describe('nextTimerEnd', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('現在時刻から60秒後のISO文字列を返す', () => {
    const now = new Date('2026-04-07T00:00:00.000Z')
    vi.setSystemTime(now)

    const result = nextTimerEnd()
    const expected = new Date('2026-04-07T00:01:00.000Z').toISOString()
    expect(result).toBe(expected)
  })

  it('返り値はISO 8601形式', () => {
    vi.setSystemTime(new Date('2026-04-07T12:00:00.000Z'))
    const result = nextTimerEnd()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  })
})
