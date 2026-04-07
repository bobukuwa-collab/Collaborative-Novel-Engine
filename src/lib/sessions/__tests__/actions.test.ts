import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase = {
  auth: {
    getUser: vi.fn(),
  },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase,
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn(),
}))

const { skipTurn, endSession } = await import('@/lib/sessions/actions')

describe('skipTurn', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証の場合はエラーを返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    const result = await skipTurn('session-1', 0)
    expect(result).toEqual({ error: '認証が必要です' })
  })

  it('認証済みの場合はsuccess: trueを返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    mockSupabase.from.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
    })

    const result = await skipTurn('session-1', 2)
    expect(result).toEqual({ success: true })
  })

  it('current_turn + 1 でDBを更新する', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    const mockEq = vi.fn().mockReturnThis()
    const mockUpdate = vi.fn().mockReturnValue({ eq: mockEq })
    mockSupabase.from.mockReturnValue({ update: mockUpdate })

    await skipTurn('session-1', 3)

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ current_turn: 4 }),
    )
  })
})

describe('endSession', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('未認証の場合はエラーを返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })

    const result = await endSession('room-1', 'session-1')
    expect(result).toEqual({ error: '認証が必要です' })
  })

  it('ホスト以外（join_order !== 0）はエラーを返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-2' } },
    })

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { join_order: 1 } }),
    })

    const result = await endSession('room-1', 'session-1')
    expect(result).toEqual({ error: 'ホストのみ完結できます' })
  })

  it('memberがnullの場合はエラーを返す', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })

    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null }),
    })

    const result = await endSession('room-1', 'session-1')
    expect(result).toEqual({ error: 'ホストのみ完結できます' })
  })
})
