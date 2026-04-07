import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// createRoomSchema と同じ定義（server actionsはimportできないため再定義）
const createRoomSchema = z.object({
  genre: z.string().min(1, 'ジャンルを入力してください').max(20),
  max_players: z.coerce.number().int().min(2).max(8),
  char_limit: z.coerce.number().int().min(20).max(200),
})

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
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.genre).toBe('ファンタジー')
      expect(result.data.max_players).toBe(4)
      expect(result.data.char_limit).toBe(100)
    }
  })

  it('ジャンルが空の場合はエラー', () => {
    const result = createRoomSchema.safeParse({
      genre: '',
      max_players: '4',
      char_limit: '100',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('ジャンルを入力してください')
    }
  })

  it('ジャンルが20文字超の場合はエラー', () => {
    const result = createRoomSchema.safeParse({
      genre: 'あ'.repeat(21),
      max_players: '4',
      char_limit: '100',
    })
    expect(result.success).toBe(false)
  })

  it('max_playersが1の場合はエラー（最小2）', () => {
    const result = createRoomSchema.safeParse({
      genre: 'SF',
      max_players: '1',
      char_limit: '100',
    })
    expect(result.success).toBe(false)
  })

  it('max_playersが8の場合は有効', () => {
    const result = createRoomSchema.safeParse({
      genre: 'SF',
      max_players: '8',
      char_limit: '100',
    })
    expect(result.success).toBe(true)
  })

  it('max_playersが9の場合はエラー（最大8）', () => {
    const result = createRoomSchema.safeParse({
      genre: 'SF',
      max_players: '9',
      char_limit: '100',
    })
    expect(result.success).toBe(false)
  })

  it('char_limitが19の場合はエラー（最小20）', () => {
    const result = createRoomSchema.safeParse({
      genre: 'SF',
      max_players: '4',
      char_limit: '19',
    })
    expect(result.success).toBe(false)
  })

  it('char_limitが200の場合は有効', () => {
    const result = createRoomSchema.safeParse({
      genre: 'SF',
      max_players: '4',
      char_limit: '200',
    })
    expect(result.success).toBe(true)
  })

  it('char_limitが201の場合はエラー（最大200）', () => {
    const result = createRoomSchema.safeParse({
      genre: 'SF',
      max_players: '4',
      char_limit: '201',
    })
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
