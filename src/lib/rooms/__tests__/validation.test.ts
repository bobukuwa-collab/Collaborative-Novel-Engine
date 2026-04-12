import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// createRoomSchema と同じ定義（server actionsはimportできないため再定義）
const createRoomSchema = z.object({
  genre: z.string().min(1, 'ジャンルを入力してください').max(20),
  max_players: z.coerce.number().int().min(2).max(8),
  char_limit: z.coerce.number().int().min(20).max(200),
  timer_seconds: z.coerce.number().int().min(10, 'タイマーは10秒以上で設定してください').max(600, 'タイマーは600秒以内で設定してください'),
  turn_order_mode: z.enum(['fixed', 'random']).default('fixed'),
})

const VALID_BASE = {
  genre: 'SF',
  max_players: '4',
  char_limit: '100',
  timer_seconds: '60',
  turn_order_mode: 'fixed',
}

const MEMBER_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
]

describe('createRoomSchema', () => {
  it('正常な入力を受け付ける', () => {
    const result = createRoomSchema.safeParse({
      genre: 'ファンタジー',
      max_players: '4',
      char_limit: '100',
      timer_seconds: '60',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.genre).toBe('ファンタジー')
      expect(result.data.max_players).toBe(4)
      expect(result.data.char_limit).toBe(100)
      expect(result.data.timer_seconds).toBe(60)
      expect(result.data.turn_order_mode).toBe('fixed')
    }
  })

  it('ジャンルが空の場合はエラー', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, genre: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('ジャンルを入力してください')
    }
  })

  it('ジャンルが20文字超の場合はエラー', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, genre: 'あ'.repeat(21) })
    expect(result.success).toBe(false)
  })

  it('max_playersが1の場合はエラー（最小2）', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, max_players: '1' })
    expect(result.success).toBe(false)
  })

  it('max_playersが8の場合は有効', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, max_players: '8' })
    expect(result.success).toBe(true)
  })

  it('max_playersが9の場合はエラー（最大8）', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, max_players: '9' })
    expect(result.success).toBe(false)
  })

  it('char_limitが19の場合はエラー（最小20）', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, char_limit: '19' })
    expect(result.success).toBe(false)
  })

  it('char_limitが200の場合は有効', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, char_limit: '200' })
    expect(result.success).toBe(true)
  })

  it('char_limitが201の場合はエラー（最大200）', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, char_limit: '201' })
    expect(result.success).toBe(false)
  })

  // timer_seconds
  it('timer_secondsが10秒は有効（最小値）', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, timer_seconds: '10' })
    expect(result.success).toBe(true)
  })

  it('timer_secondsが9秒の場合はエラー（最小10）', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, timer_seconds: '9' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('タイマーは10秒以上で設定してください')
    }
  })

  it('timer_secondsが600秒は有効（最大値）', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, timer_seconds: '600' })
    expect(result.success).toBe(true)
  })

  it('timer_secondsが601秒の場合はエラー（最大600）', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, timer_seconds: '601' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('タイマーは600秒以内で設定してください')
    }
  })

  it('timer_secondsが任意の値（例: 45秒）も有効', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, timer_seconds: '45' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.timer_seconds).toBe(45)
    }
  })

  // turn_order_mode
  it('turn_order_mode が fixed は有効', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, turn_order_mode: 'fixed' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.turn_order_mode).toBe('fixed')
    }
  })

  it('turn_order_mode が random は有効', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, turn_order_mode: 'random' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.turn_order_mode).toBe('random')
    }
  })

  it('turn_order_mode が未指定の場合は fixed にデフォルト', () => {
    const { turn_order_mode: _, ...withoutMode } = VALID_BASE
    const result = createRoomSchema.safeParse(withoutMode)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.turn_order_mode).toBe('fixed')
    }
  })

  it('turn_order_mode が不正値の場合はエラー', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, turn_order_mode: 'shuffle' })
    expect(result.success).toBe(false)
  })
})

describe('MEMBER_COLORS', () => {
  it('8色定義されている', () => {
    expect(MEMBER_COLORS).toHaveLength(8)
  })

  it('全て有効なhex色コード', () => {
    const hexPattern = /^#[0-9a-f]{6}$/i
    MEMBER_COLORS.forEach(color => {
      expect(color).toMatch(hexPattern)
    })
  })

  it('重複がない', () => {
    const unique = new Set(MEMBER_COLORS)
    expect(unique.size).toBe(MEMBER_COLORS.length)
  })
})
