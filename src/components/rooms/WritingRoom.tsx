'use client'

import { useState, useEffect, useRef, useTransition } from 'react'
import { createClient } from '@/lib/supabase/client'
import { submitSentence, skipTurn } from '@/lib/sessions/actions'

type Session = {
  id: string
  room_id: string
  current_turn: number
  timer_end: string
}

type Sentence = {
  id: string
  session_id: string
  user_id: string
  content: string
  seq: number
  created_at: string
}

type Member = {
  user_id: string
  join_order: number
  color: string
  users: { display_name: string } | null
}

type Room = {
  id: string
  genre: string
  char_limit: number
}

type Props = {
  room: Room
  session: Session
  members: Member[]
  initialSentences: Sentence[]
  currentUserId: string
}

export function WritingRoom({
  room,
  session: initialSession,
  members,
  initialSentences,
  currentUserId,
}: Props) {
  const [session, setSession] = useState(initialSession)
  const [sentences, setSentences] = useState(initialSentences)
  const [content, setContent] = useState('')
  const [timeLeft, setTimeLeft] = useState(60)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const skipCalledRef = useRef(false)

  const sortedMembers = [...members].sort((a, b) => a.join_order - b.join_order)
  const currentMemberIndex = session.current_turn % sortedMembers.length
  const currentMember = sortedMembers[currentMemberIndex]
  const isMyTurn = currentMember?.user_id === currentUserId

  // Reset skip flag when turn advances
  useEffect(() => {
    skipCalledRef.current = false
    setError(null)
  }, [session.current_turn])

  // Timer countdown
  useEffect(() => {
    const update = () => {
      const remaining = Math.max(
        0,
        Math.floor((new Date(session.timer_end).getTime() - Date.now()) / 1000),
      )
      setTimeLeft(remaining)
    }
    update()
    const interval = setInterval(update, 500)
    return () => clearInterval(interval)
  }, [session.timer_end])

  // Auto-skip on timeout (only current player calls skip)
  useEffect(() => {
    if (timeLeft === 0 && isMyTurn && !skipCalledRef.current) {
      skipCalledRef.current = true
      startTransition(async () => {
        await skipTurn(session.id, session.current_turn)
      })
    }
  }, [timeLeft, isMyTurn, session.id, session.current_turn])

  // Realtime subscriptions
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`writing-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'sessions',
          filter: `room_id=eq.${room.id}`,
        },
        (payload) => setSession(payload.new as Session),
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sentences',
          filter: `session_id=eq.${initialSession.id}`,
        },
        (payload) => setSentences((prev) => [...prev, payload.new as Sentence]),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [room.id, initialSession.id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim() || !isMyTurn || isPending) return

    setError(null)
    startTransition(async () => {
      const result = await submitSentence(
        session.id,
        content.trim(),
        session.current_turn,
        room.char_limit,
      )
      if (result?.error) {
        setError(result.error)
      } else {
        setContent('')
      }
    })
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-4">
        <div className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-500">ジャンル</p>
            <h1 className="font-bold text-gray-800">{room.genre}</h1>
          </div>
          <TimerDisplay timeLeft={timeLeft} />
        </div>

        <TurnIndicator
          currentMember={currentMember}
          isMyTurn={isMyTurn}
          turnNumber={session.current_turn + 1}
        />

        <NovelViewer sentences={sentences} members={sortedMembers} />

        {isMyTurn ? (
          <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-4 space-y-3">
            <div className="flex justify-between text-xs text-gray-500">
              <span className="text-indigo-600 font-medium">あなたのターンです！</span>
              <span className={content.length > room.char_limit ? 'text-red-500' : ''}>
                {content.length} / {room.char_limit}文字
              </span>
            </div>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="続きを書いてください..."
              rows={3}
              maxLength={room.char_limit}
              disabled={isPending}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
            {error && <p className="text-xs text-red-500">{error}</p>}
            <button
              type="submit"
              disabled={isPending || !content.trim() || content.length > room.char_limit}
              className="w-full py-2 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {isPending ? '投稿中...' : '投稿する'}
            </button>
          </form>
        ) : (
          <div className="bg-white rounded-xl shadow p-4 text-center text-sm text-gray-500">
            <span
              className="inline-block w-2 h-2 rounded-full mr-2 align-middle"
              style={{ backgroundColor: currentMember?.color ?? '#9ca3af' }}
            />
            {currentMember?.users?.display_name ?? '不明'}さんの入力を待っています...
          </div>
        )}
      </div>
    </main>
  )
}

function TimerDisplay({ timeLeft }: { timeLeft: number }) {
  const minutes = Math.floor(timeLeft / 60)
  const seconds = timeLeft % 60
  const isWarning = timeLeft <= 10

  return (
    <div className={`text-2xl font-mono font-bold tabular-nums ${isWarning ? 'text-red-500' : 'text-gray-700'}`}>
      {minutes > 0
        ? `${minutes}:${String(seconds).padStart(2, '0')}`
        : `${seconds}秒`}
    </div>
  )
}

function TurnIndicator({
  currentMember,
  isMyTurn,
  turnNumber,
}: {
  currentMember: Member | undefined
  isMyTurn: boolean
  turnNumber: number
}) {
  return (
    <div
      className={`rounded-xl shadow p-3 flex items-center gap-3 ${
        isMyTurn ? 'bg-indigo-50 border border-indigo-200' : 'bg-white'
      }`}
    >
      <span
        className="w-4 h-4 rounded-full flex-shrink-0"
        style={{ backgroundColor: currentMember?.color ?? '#9ca3af' }}
      />
      <span className="text-sm font-medium text-gray-700">
        第{turnNumber}ターン：
        {isMyTurn ? (
          <span className="text-indigo-600 font-bold"> あなたのターン！</span>
        ) : (
          <span> {currentMember?.users?.display_name ?? '不明'}さん</span>
        )}
      </span>
    </div>
  )
}

function NovelViewer({
  sentences,
  members,
}: {
  sentences: Sentence[]
  members: Member[]
}) {
  const memberMap = new Map(members.map((m) => [m.user_id, m]))

  return (
    <div className="bg-white rounded-xl shadow p-4 min-h-32 max-h-96 overflow-y-auto">
      <h2 className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">物語</h2>
      {sentences.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-4">
          まだ文章がありません。最初の1文を書きましょう！
        </p>
      ) : (
        <div className="space-y-1">
          {[...sentences]
            .sort((a, b) => a.seq - b.seq)
            .map((sentence) => {
              const member = memberMap.get(sentence.user_id)
              return (
                <span key={sentence.id} className="inline">
                  <span
                    className="inline-block w-2 h-2 rounded-full mx-0.5 align-middle flex-shrink-0"
                    style={{ backgroundColor: member?.color ?? '#9ca3af' }}
                    title={member?.users?.display_name ?? '不明'}
                  />
                  <span className="text-gray-800 text-sm leading-relaxed">{sentence.content}</span>
                  {' '}
                </span>
              )
            })}
        </div>
      )}
    </div>
  )
}
