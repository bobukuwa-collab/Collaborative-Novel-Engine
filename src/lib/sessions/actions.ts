'use server'

import { createClient } from '@/lib/supabase/server'
import { continueStory } from '@/lib/ai/continue-story'
import { analyzePersonality } from '@/lib/ai/analyze-personality'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'

const submitSchema = z.object({
  content: z.string().min(1, '1文字以上入力してください').max(1000),
})

export async function submitSentence(
  sessionId: string,
  content: string,
  currentTurn: number,
): Promise<{ error?: string; success?: boolean }> {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = submitSchema.safeParse({ content })
  if (!result.success) return { error: result.error.issues[0].message }

  const { data: sessRow, error: sessErr } = await supabase
    .from('sessions')
    .select('current_turn, room_id')
    .eq('id', sessionId)
    .single()

  if (sessErr || !sessRow) return { error: 'セッションが見つかりません' }
  if (sessRow.current_turn !== currentTurn) return { error: 'ターンが変わっています。画面を更新してください。' }

  const { data: room } = await supabase
    .from('rooms')
    .select('genre, max_turns, status')
    .eq('id', sessRow.room_id)
    .single()

  if (!room || room.status === 'completed') return { error: 'このセッションは既に終了しています。' }

  const { count } = await supabase
    .from('sentences')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)

  const seq = (count ?? 0) + 1

  const { error: insertErr } = await supabase
    .from('sentences')
    .insert({ session_id: sessionId, user_id: user.id, author_type: 'human', content: result.data.content, seq })

  if (insertErr) return { error: `投稿に失敗しました: ${insertErr.message}` }

  const humanTurn = currentTurn + 1

  const { error: sessionErr } = await supabase
    .from('sessions')
    .update({ current_turn: humanTurn })
    .eq('id', sessionId)
    .eq('current_turn', currentTurn)

  if (sessionErr) return { error: `ターン更新に失敗しました: ${sessionErr.message}` }

  // AI ターン自動生成
  const { data: allSents } = await supabase
    .from('sentences')
    .select('content, author_type')
    .eq('session_id', sessionId)
    .order('seq', { ascending: true })

  const humanSentences = (allSents ?? [])
    .filter((s) => s.author_type === 'human')
    .map((s) => s.content)

  const storySoFar = (allSents ?? [])
    .slice(0, -1)
    .map((s) => s.content)
    .join('\n')

  // AI 生成失敗時はターンをロールバックして人間に戻す
  let aiContent: string
  try {
    aiContent = await continueStory({
      genre: room.genre,
      storySoFar,
      lastHumanSentence: result.data.content,
    })
  } catch {
    await supabase
      .from('sessions')
      .update({ current_turn: currentTurn })
      .eq('id', sessionId)
      .eq('current_turn', humanTurn)
    return { error: 'AIの生成に失敗しました。もう一度お試しください。' }
  }

  // seq は人間の seq + 1 で確定（カウント再取得による競合を回避）
  const aiSeq = seq + 1

  const { error: aiInsertErr } = await supabase
    .from('sentences')
    .insert({ session_id: sessionId, user_id: null, author_type: 'ai', content: aiContent, seq: aiSeq })

  if (aiInsertErr) {
    await supabase
      .from('sessions')
      .update({ current_turn: currentTurn })
      .eq('id', sessionId)
      .eq('current_turn', humanTurn)
    return { error: `AI文章の保存に失敗しました: ${aiInsertErr.message}` }
  }

  const aiTurn = humanTurn + 1

  await supabase
    .from('sessions')
    .update({ current_turn: aiTurn })
    .eq('id', sessionId)
    .eq('current_turn', humanTurn)

  // max_turns に達したら自動完結
  if (aiTurn >= room.max_turns) {
    await completeNovel(sessRow.room_id, sessionId, humanSentences)
    return { success: true }
  }

  return { success: true }
}

async function completeNovel(
  roomId: string,
  sessionId: string,
  humanSentences: string[],
): Promise<{ novelId?: string; error?: string }> {
  const supabase = createClient()

  const { data: room } = await supabase
    .from('rooms')
    .select('genre, status')
    .eq('id', roomId)
    .single()

  if (!room || room.status === 'completed') return { error: 'すでに完結しています' }

  const title = `${room.genre}の物語`

  const { data: novel, error: novelErr } = await supabase
    .from('novels')
    .insert({ room_id: roomId, title, status: 'completed', published_at: new Date().toISOString() })
    .select('id')
    .single()

  if (novelErr || !novel) return { error: `作品の保存に失敗しました: ${novelErr?.message}` }

  await supabase.from('rooms').update({ status: 'completed' }).eq('id', roomId)

  if (humanSentences.length > 0) {
    try {
      const profile = await analyzePersonality(humanSentences.join('\n'))
      await supabase.from('personality_profiles').insert({ novel_id: novel.id, ...profile })
    } catch { /* 分析失敗は無視して完結を続行 */ }
  }

  revalidatePath('/library')
  revalidatePath(`/novels/${novel.id}`)

  return { novelId: novel.id }
}

export async function finishSession(roomId: string, sessionId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  // sessionId が roomId に属することを確認（IDOR 防止）
  const { data: session } = await supabase
    .from('sessions')
    .select('room_id')
    .eq('id', sessionId)
    .single()

  if (!session || session.room_id !== roomId) return { error: 'セッションが見つかりません' }

  const { data: room } = await supabase
    .from('rooms')
    .select('created_by')
    .eq('id', roomId)
    .single()

  if (!room || room.created_by !== user.id) return { error: '権限がありません' }

  const { data: sents } = await supabase
    .from('sentences')
    .select('content, author_type')
    .eq('session_id', sessionId)
    .order('seq', { ascending: true })

  const humanSentences = (sents ?? [])
    .filter((s) => s.author_type === 'human')
    .map((s) => s.content)

  const result = await completeNovel(roomId, sessionId, humanSentences)

  if (result.error) return { error: result.error }
  redirect(`/novels/${result.novelId}`)
}
