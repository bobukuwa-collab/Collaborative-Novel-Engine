'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { startSession } from '@/lib/sessions/actions'

type Member = {
  user_id: string
  join_order: number
  color: string
  users: { display_name: string } | null
}

type Room = {
  id: string
  genre: string
  max_players: number
  char_limit: number
  status: string
  room_members: Member[]
}

type Props = {
  room: Room
  currentUserId: string
  inviteUrl: string
}

export function WaitingRoom({ room, currentUserId, inviteUrl }: Props) {
  const router = useRouter()
  const [copied, setCopied] = useState(false)

  const isHost = room.room_members.some(
    (m) => m.user_id === currentUserId && m.join_order === 0,
  )
  const sortedMembers = [...room.room_members].sort((a, b) => a.join_order - b.join_order)
  const canStart = isHost && room.room_members.length >= 2

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Realtime: detect new members joining and session start
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel(`waiting-${room.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'room_members',
          filter: `room_id=eq.${room.id}`,
        },
        () => router.refresh(),
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sessions',
          filter: `room_id=eq.${room.id}`,
        },
        () => router.refresh(),
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [room.id, router])

  const startSessionForRoom = startSession.bind(null, room.id)

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-lg mx-auto space-y-6">

        {/* ルーム情報 */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold text-gray-800">待機室</h1>
            <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full font-medium">
              参加待ち
            </span>
          </div>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-500">ジャンル</p>
              <p className="font-semibold text-gray-800">{room.genre}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">人数</p>
              <p className="font-semibold text-gray-800">
                {room.room_members.length} / {room.max_players}人
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">文字数上限</p>
              <p className="font-semibold text-gray-800">{room.char_limit}文字</p>
            </div>
          </div>
        </div>

        {/* 招待リンク */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">友達を招待する</h2>
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md bg-gray-50 text-gray-600 truncate"
            />
            <button
              onClick={handleCopy}
              className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 transition-colors whitespace-nowrap"
            >
              {copied ? 'コピー済み ✓' : 'コピー'}
            </button>
          </div>
        </div>

        {/* 参加者一覧 */}
        <div className="bg-white rounded-xl shadow-md p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">
            参加者 ({room.room_members.length}/{room.max_players})
          </h2>
          <ul className="space-y-2">
            {sortedMembers.map((member) => (
              <li key={member.user_id} className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: member.color }}
                />
                <span className="text-sm text-gray-700">
                  {member.users?.display_name ?? '不明なユーザー'}
                </span>
                {member.user_id === currentUserId && (
                  <span className="text-xs text-gray-400">（あなた）</span>
                )}
                {member.join_order === 0 && (
                  <span className="text-xs text-indigo-500 ml-auto">ホスト</span>
                )}
              </li>
            ))}
          </ul>

          <form action={startSessionForRoom} className="mt-4">
            <button
              type="submit"
              disabled={!canStart}
              className="w-full py-2 px-4 bg-green-600 text-white font-semibold rounded-md hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {!isHost
                ? 'ホストが開始するまでお待ちください'
                : room.room_members.length < 2
                  ? 'あと1人以上参加が必要です'
                  : '執筆を開始'}
            </button>
          </form>
        </div>

      </div>
    </main>
  )
}
