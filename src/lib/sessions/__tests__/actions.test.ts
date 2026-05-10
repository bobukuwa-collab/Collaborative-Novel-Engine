import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockSupabase = {
  auth: { getUser: vi.fn() },
  from: vi.fn(),
}

vi.mock('@/lib/supabase/server', () => ({
  createClient: () => mockSupabase,
}))

vi.mock('@/lib/ai/continue-story', () => ({
  continueStory: vi.fn().mockResolvedValue('AIが書いた続き。'),
}))

vi.mock('@/lib/ai/analyze-personality', () => ({
  analyzePersonality: vi.fn().mockResolvedValue({
    psychopathy_score: 50,
    empathy_score: 50,
    imagination_score: 50,
    darkness_score: 50,
    personality_type: 'テスト',
    character_title: 'テスト称号',
    analysis_text: 'テスト分析',
  }),
}))

vi.mock('next/navigation', () => ({
  redirect: vi.fn().mockImplementation((url: string) => {
    throw Object.assign(new Error('NEXT_REDIRECT'), { digest: `NEXT_REDIRECT;${url}` })
  }),
}))

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}))

const { submitSentence, finishSession } = await import('@/lib/sessions/actions')

describe('submitSentence', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('未認証の場合は /login にリダイレクトする', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    await expect(submitSentence('session-1', 'test', 0)).rejects.toThrow('NEXT_REDIRECT')
  })

  it('空文字はバリデーションエラー', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    const result = await submitSentence('session-1', '', 0)
    expect(result?.error).toBeTruthy()
  })

  it('セッションが見つからない場合はエラー', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    mockSupabase.from.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
    })
    const result = await submitSentence('session-1', '何か書く', 0)
    expect(result?.error).toBe('セッションが見つかりません')
  })
})

describe('finishSession', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('未認証の場合はエラー', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null } })
    const result = await finishSession('room-1', 'session-1')
    expect(result).toEqual({ error: '認証が必要です' })
  })

  it('権限がないユーザーにはエラー', async () => {
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } })
    // 呼び出し順: 1=sessions(sessionId帰属確認), 2=rooms(created_by確認)
    let callCount = 0
    mockSupabase.from.mockImplementation(() => {
      callCount++
      if (callCount === 1) {
        // sessions: room_id が一致することを確認
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { room_id: 'room-1' } }),
        }
      }
      // rooms: 他のユーザーが所有
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { created_by: 'other-user' } }),
      }
    })
    const result = await finishSession('room-1', 'session-1')
    expect(result).toEqual({ error: '権限がありません' })
  })
})
