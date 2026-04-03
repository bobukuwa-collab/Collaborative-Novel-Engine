'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const TURN_DURATION_SECONDS = 60

function nextTimerEnd(): string {
  return new Date(Date.now() + TURN_DURATION_SECONDS * 1000).toISOString()
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function startSession(roomId: string, _formData: FormData): Promise<void> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: member } = await supabase
    .from('room_members')
    .select('join_order')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .single()

  if (!member || member.join_order !== 0) return

  const { error: sessionError } = await supabase
    .from('sessions')
    .insert({ room_id: roomId, current_turn: 0, timer_end: nextTimerEnd() })

  if (sessionError) {
    console.error('[startSession] session insert error:', sessionError)
    return
  }

  const { error: roomError } = await supabase
    .from('rooms')
    .update({ status: 'in_progress' })
    .eq('id', roomId)

  if (roomError) {
    console.error('[startSession] room update error:', roomError)
    return
  }

  redirect(`/rooms/${roomId}`)
}

const submitSchema = z.object({
  content: z.string().min(1, '1文字以上入力してください'),
})

export async function submitSentence(
  sessionId: string,
  content: string,
  currentTurn: number,
  charLimit: number,
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = submitSchema.safeParse({ content })
  if (!result.success) return { error: result.error.issues[0].message }

  if (content.length > charLimit) {
    return { error: `${charLimit}文字以内で入力してください` }
  }

  const { count } = await supabase
    .from('sentences')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)

  const seq = (count ?? 0) + 1

  const { error: sentenceError } = await supabase
    .from('sentences')
    .insert({ session_id: sessionId, user_id: user.id, content, seq })

  if (sentenceError) {
    return { error: `投稿に失敗しました: ${sentenceError.message}` }
  }

  const { error: sessionError } = await supabase
    .from('sessions')
    .update({ current_turn: currentTurn + 1, timer_end: nextTimerEnd() })
    .eq('id', sessionId)
    .eq('current_turn', currentTurn)

  if (sessionError) {
    return { error: `ターン更新に失敗しました: ${sessionError.message}` }
  }

  return { success: true }
}

export async function skipTurn(sessionId: string, currentTurn: number) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  await supabase
    .from('sessions')
    .update({ current_turn: currentTurn + 1, timer_end: nextTimerEnd() })
    .eq('id', sessionId)
    .eq('current_turn', currentTurn)

  return { success: true }
}

export async function endSession(roomId: string, sessionId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  // ホストのみ完結可能
  const { data: member } = await supabase
    .from('room_members')
    .select('join_order')
    .eq('room_id', roomId)
    .eq('user_id', user.id)
    .single()

  if (!member || member.join_order !== 0) {
    return { error: 'ホストのみ完結できます' }
  }

  // novelsテーブルにレコードを作成
  const { data: novel, error: novelError } = await supabase
    .from('novels')
    .insert({
      room_id: roomId,
      status: 'completed',
      published_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  if (novelError || !novel) {
    return { error: `小説の保存に失敗しました: ${novelError?.message}` }
  }

  // ルームのステータスを完結に更新
  const { error: roomError } = await supabase
    .from('rooms')
    .update({ status: 'completed' })
    .eq('id', roomId)

  if (roomError) {
    return { error: `ルームの更新に失敗しました: ${roomError?.message}` }
  }

  redirect(`/novels/${novel.id}`)
}
