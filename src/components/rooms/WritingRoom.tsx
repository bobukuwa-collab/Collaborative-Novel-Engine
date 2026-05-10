'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { submitSentence, finishSession } from '@/lib/sessions/actions'

type Session = {
  id: string
  room_id: string
  current_turn: number
}

type Sentence = {
  id: string
  session_id: string
  user_id: string | null
  author_type: string
  content: string
  seq: number
  created_at: string
}

type Room = {
  id: string
  genre: string
  max_turns: number
}

type Props = {
  room: Room
  session: Session
  initialSentences: Sentence[]
  currentUserId: string
}

export function WritingRoom({ room, session: initialSession, initialSentences, currentUserId: _currentUserId }: Props) {
  const router = useRouter()
  const [session, setSession] = useState(initialSession)
  const [sentences, setSentences] = useState(initialSentences)
  const [content, setContent] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isAiTyping, setIsAiTyping] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [isFinishing, startFinishTransition] = useTransition()
  const sessionRef = useRef(session)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { sessionRef.current = session }, [session])

  // current_turn が偶数 = 人間のターン（0, 2, 4...）
  const isMyTurn = session.current_turn % 2 === 0
  const turnNumber = Math.floor(session.current_turn / 2) + 1
  const maxHumanTurns = Math.floor(room.max_turns / 2)
  const progress = Math.min(100, (turnNumber / maxHumanTurns) * 100)
  const isCompleted = session.current_turn >= room.max_turns

  // 新しい文章が追加されたらスクロール
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [sentences])

  // AI ターン中はタイピングインジケーター表示
  useEffect(() => {
    setIsAiTyping(!isMyTurn && !isCompleted)
  }, [isMyTurn, isCompleted])

  // Realtime 購読（文章追加・セッション更新）
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`writing-${room.id}`)
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'sessions',
        filter: `room_id=eq.${room.id}`,
      }, (payload) => {
        if (isSessionPayload(payload.new)) setSession(payload.new)
      })
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'sentences',
        filter: `session_id=eq.${initialSession.id}`,
      }, (payload) => {
        if (isSentencePayload(payload.new)) {
          setSentences((prev) => {
            if (prev.some((s) => s.id === (payload.new as Sentence).id)) return prev
            return [...prev, payload.new as Sentence]
          })
          setIsAiTyping(false)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [room.id, initialSession.id])

  // ポーリングフォールバック（3秒ごと）
  useEffect(() => {
    const supabase = createClient()
    const poll = setInterval(async () => {
      const { data } = await supabase
        .from('sessions').select('*').eq('id', initialSession.id).maybeSingle()
      if (data && data.current_turn !== sessionRef.current.current_turn) {
        setSession(data as Session)
        const { data: rows } = await supabase
          .from('sentences').select('*').eq('session_id', initialSession.id).order('seq', { ascending: true })
        // Realtime で追加済みの文章を古いスナップショットで上書きしないよう件数チェック
        if (rows) setSentences((prev) => rows.length >= prev.length ? rows as Sentence[] : prev)
      }
      // 完結済みリダイレクト
      const { data: novel } = await supabase
        .from('novels').select('id').eq('room_id', room.id).eq('status', 'completed').maybeSingle()
      if (novel) router.push(`/novels/${novel.id}`)
    }, 3000)
    return () => clearInterval(poll)
  }, [initialSession.id, room.id, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || !isMyTurn || isPending) return
    setError(null)
    setIsAiTyping(true)
    const submitted = content.trim()
    setContent('')
    startTransition(async () => {
      const result = await submitSentence(session.id, submitted, session.current_turn)
      if (result?.error) {
        setError(result.error)
        setContent(submitted)
        setIsAiTyping(false)
      }
    })
  }

  const handleFinish = () => {
    startFinishTransition(async () => {
      await finishSession(room.id, session.id)
    })
  }

  const phase = getStoryPhase(session.current_turn, room.max_turns)

  return (
    <main className="min-h-screen bg-stone-50 py-6 px-4">
      <div className="max-w-2xl mx-auto space-y-4">

        {/* ヘッダー */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wide">ジャンル</p>
              <h1 className="font-bold text-stone-800 text-lg">{room.genre}</h1>
            </div>
            <button
              onClick={handleFinish}
              disabled={isFinishing || sentences.length < 2}
              className="px-4 py-2 text-sm font-semibold text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {isFinishing ? '完結処理中...' : '完結して占う'}
            </button>
          </div>

          {/* 進捗バー */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-stone-400">
              <span>あなたのターン {turnNumber} / {maxHumanTurns}</span>
              <span className={`font-medium ${phase.textColor}`}>{phase.label}</span>
            </div>
            <div className="h-1.5 bg-stone-100 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${phase.barColor}`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>

        {/* 物語本文 */}
        <div className="bg-white rounded-2xl shadow-sm border border-stone-200 p-5 min-h-64 max-h-[28rem] overflow-y-auto">
          {sentences.length === 0 ? (
            <p className="text-stone-400 text-sm text-center py-8">最初の一文を書いてください。AIが続きを書きます。</p>
          ) : (
            <div className="space-y-4" style={{ fontFamily: '"Noto Serif JP", Georgia, serif' }}>
              {[...sentences].sort((a, b) => a.seq - b.seq).map((s) => (
                <div
                  key={s.id}
                  className={`relative pl-4 border-l-2 ${s.author_type === 'human' ? 'border-indigo-400' : 'border-stone-300'}`}
                >
                  <p className="text-stone-800 text-[0.95rem] leading-[2] whitespace-pre-wrap">{s.content}</p>
                  <p className="text-xs mt-0.5" style={{ color: s.author_type === 'human' ? '#818cf8' : '#a8a29e' }}>
                    {s.author_type === 'human' ? 'あなた' : 'AI'}
                  </p>
                </div>
              ))}
            </div>
          )}

          {isAiTyping && (
            <div className="flex items-center gap-2 mt-4 pl-4 border-l-2 border-stone-300">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-xs text-stone-400">AIが執筆中...</span>
            </div>
          )}

          <div ref={endRef} />
        </div>

        {/* 入力エリア */}
        {isCompleted ? (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-3">
            <p className="text-amber-800 font-semibold">物語が完成しました！</p>
            <button
              onClick={handleFinish}
              disabled={isFinishing}
              className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {isFinishing ? '人格を分析中...' : '人格を占う'}
            </button>
          </div>
        ) : isMyTurn ? (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-indigo-200 p-4 space-y-3">
            <div className="flex justify-between text-xs">
              <span className="text-indigo-600 font-semibold">あなたのターンです</span>
              <span className="text-stone-400">{content.length} / 1000文字</span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={`${room.genre}の物語を続けてください...`}
              rows={4}
              maxLength={1000}
              disabled={isPending}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm text-stone-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={isPending || !content.trim()}
              className="w-full py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 disabled:opacity-50 transition-colors text-sm"
            >
              {isPending ? '送信中...' : '投稿してAIに渡す'}
            </button>
          </form>
        ) : (
          <div className="bg-stone-50 border border-stone-200 rounded-2xl p-5 text-center">
            <div className="flex items-center justify-center gap-2 text-stone-500 text-sm">
              <div className="flex gap-1">
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-stone-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span>AIが執筆中です。しばらくお待ちください...</span>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

function isSessionPayload(v: unknown): v is Session {
  return typeof v === 'object' && v !== null &&
    'id' in v && 'room_id' in v && 'current_turn' in v
}

function isSentencePayload(v: unknown): v is Sentence {
  return typeof v === 'object' && v !== null &&
    'id' in v && 'content' in v && 'seq' in v && 'author_type' in v
}

type PhaseInfo = { label: string; barColor: string; textColor: string }

function getStoryPhase(currentTurn: number, maxTurns: number): PhaseInfo {
  const ratio = maxTurns > 0 ? currentTurn / maxTurns : 0
  if (ratio < 0.25) return { label: '導入', barColor: 'bg-sky-400', textColor: 'text-sky-600' }
  if (ratio < 0.55) return { label: '展開', barColor: 'bg-emerald-500', textColor: 'text-emerald-600' }
  if (ratio < 0.80) return { label: 'クライマックス', barColor: 'bg-orange-500', textColor: 'text-orange-600' }
  return { label: '結末', barColor: 'bg-purple-500', textColor: 'text-purple-600' }
}
