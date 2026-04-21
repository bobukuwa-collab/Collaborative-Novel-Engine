import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// createRoomSchema と同じ定義（server actionsはimportできないため再定義）
const createRoomSchema = z.object({
  genre: z.string().min(1, 'ジャンルを入力してください').max(20),
  max_players: z.coerce.number().int().min(2).max(8),
  char_limit: z.preprocess(
    (v) => (v === '' || v === 'null' || v === '0' ? null : v),
    z.coerce.number().int().min(1).max(1000).nullable(),
  ),
  timer_seconds: z.coerce.number().int().min(10, 'タイマーは10秒以上で設定してください').max(600, 'タイマーは600秒以内で設定してください'),
  turn_order_mode: z.enum(['fixed', 'random']).default('fixed'),
  game_mode: z.enum(['open', 'secret_battle']).default('secret_battle'),
  max_turns: z.coerce.number().int().min(5).max(200).default(48),
})

const VALID_BASE = {
  genre: 'SF',
  max_players: '4',
  char_limit: '300',
  timer_seconds: '60',
  turn_order_mode: 'fixed',
  game_mode: 'secret_battle',
  max_turns: '48',
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
      char_limit: '300',
      timer_seconds: '60',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.genre).toBe('ファンタジー')
      expect(result.data.max_players).toBe(4)
      expect(result.data.char_limit).toBe(300)
      expect(result.data.timer_seconds).toBe(60)
      expect(result.data.turn_order_mode).toBe('fixed')
      expect(result.data.game_mode).toBe('secret_battle')
      expect(result.data.max_turns).toBe(48)
    }
  })

  it('game_mode のデフォルトは secret_battle', () => {
    const without = { ...VALID_BASE }
    delete (without as { game_mode?: string }).game_mode
    const result = createRoomSchema.safeParse(without)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.game_mode).toBe('secret_battle')
    }
  })

  it('secret_battle と max_turns を受け付ける', () => {
    const result = createRoomSchema.safeParse({
      ...VALID_BASE,
      game_mode: 'secret_battle',
      max_turns: '120',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.game_mode).toBe('secret_battle')
      expect(result.data.max_turns).toBe(120)
    }
  })

  it('open モードも受け付ける', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, game_mode: 'open' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.game_mode).toBe('open')
    }
  })

  // char_limit
  it('char_limit が 100 は有効', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, char_limit: '100' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.char_limit).toBe(100)
  })

  it('char_limit が 300（推奨）は有効', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, char_limit: '300' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.char_limit).toBe(300)
  })

  it('char_limit が 500 は有効', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, char_limit: '500' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.char_limit).toBe(500)
  })

  it('char_limit が 1000 は有効（隠し上限）', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, char_limit: '1000' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.char_limit).toBe(1000)
  })

  it('char_limit が 1001 はエラー（上限超過）', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, char_limit: '1001' })
    expect(result.success).toBe(false)
  })

  it('char_limit が "null" は null になる（∞）', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, char_limit: 'null' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.char_limit).toBeNull()
  })

  it('char_limit が "0" は null になる（∞）', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, char_limit: '0' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.char_limit).toBeNull()
  })

  it('char_limit が "" は null になる（∞）', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, char_limit: '' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.char_limit).toBeNull()
  })

  // max_turns
  it('max_turns が4の場合はエラー', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, max_turns: '4' })
    expect(result.success).toBe(false)
  })

  // genre
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

  // max_players
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
    if (result.success) expect(result.data.turn_order_mode).toBe('fixed')
  })

  it('turn_order_mode が random は有効', () => {
    const result = createRoomSchema.safeParse({ ...VALID_BASE, turn_order_mode: 'random' })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.turn_order_mode).toBe('random')
  })

  it('turn_order_mode が未指定の場合は fixed にデフォルト', () => {
    const withoutMode = { ...VALID_BASE }
    delete (withoutMode as { turn_order_mode?: string }).turn_order_mode
    const result = createRoomSchema.safeParse(withoutMode)
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.turn_order_mode).toBe('fixed')
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
