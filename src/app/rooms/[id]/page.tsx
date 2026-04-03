import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { redirect } from 'next/navigation'
import { WaitingRoom } from '@/components/rooms/WaitingRoom'
import { WritingRoom } from '@/components/rooms/WritingRoom'

const MEMBER_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
]

export default async function RoomPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('*')
    .eq('id', params.id)
    .single()

  if (roomError || !room) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 rounded-xl shadow max-w-md w-full">
          <h1 className="text-red-600 font-bold mb-2">ルームが見つかりません</h1>
          <p className="text-sm text-gray-600 mb-1">room_id: {params.id}</p>
          <p className="text-sm text-red-500">{roomError?.message ?? 'room is null'}</p>
        </div>
      </main>
    )
  }

  const { data: members, error: membersError } = await supabase
    .from('room_members')
    .select('user_id, join_order, color, users(display_name)')
    .eq('room_id', params.id)

  if (membersError) console.error('[RoomPage] members error:', membersError)

  const roomMembers = members ?? []
  const isMember = roomMembers.some((m: { user_id: string }) => m.user_id === user.id)

  // 未参加かつ待機中なら参加処理
  if (!isMember) {
    if (room.status !== 'waiting') {
      return (
        <>
          <Header />
          <main className="min-h-screen bg-gray-50 flex items-center justify-center">
            <p className="text-gray-600">このルームはすでに執筆中のため参加できません。</p>
          </main>
        </>
      )
    }

    if (roomMembers.length >= room.max_players) {
      return (
        <>
          <Header />
          <main className="min-h-screen bg-gray-50 flex items-center justify-center">
            <p className="text-gray-600">このルームは満員です。</p>
          </main>
        </>
      )
    }

    await supabase.from('room_members').insert({
      room_id: room.id,
      user_id: user.id,
      join_order: roomMembers.length,
      color: MEMBER_COLORS[roomMembers.length % MEMBER_COLORS.length],
    })

    redirect(`/rooms/${params.id}`)
  }

  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'}/rooms/${params.id}`

  // 待機中
  if (room.status === 'waiting') {
    const roomWithMembers = { ...room, room_members: roomMembers }
    return (
      <>
        <Header />
        <WaitingRoom room={roomWithMembers} currentUserId={user.id} inviteUrl={inviteUrl} />
      </>
    )
  }

  // 執筆中
  if (room.status === 'in_progress') {
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('room_id', params.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (sessionError || !session) {
      console.error('[RoomPage] session fetch error:', sessionError)
      return (
        <>
          <Header />
          <main className="min-h-screen bg-gray-50 flex items-center justify-center">
            <p className="text-gray-600">セッション情報の取得に失敗しました。</p>
          </main>
        </>
      )
    }

    const { data: sentences } = await supabase
      .from('sentences')
      .select('*')
      .eq('session_id', session.id)
      .order('seq', { ascending: true })

    // Supabaseのリレーション結果（users）を正規化
    const normalizedMembers = (roomMembers as Array<{
      user_id: string
      join_order: number
      color: string
      users: { display_name: string }[] | { display_name: string } | null
    }>)
      .map((m) => ({
        ...m,
        users: Array.isArray(m.users) ? (m.users[0] ?? null) : m.users,
      }))
      .sort((a, b) => a.join_order - b.join_order)

    const isHost = normalizedMembers.some(
      (m) => m.user_id === user.id && m.join_order === 0,
    )

    return (
      <>
        <Header />
        <WritingRoom
          room={{ id: room.id, genre: room.genre, char_limit: room.char_limit }}
          session={session}
          members={normalizedMembers}
          initialSentences={sentences ?? []}
          currentUserId={user.id}
          isHost={isHost}
        />
      </>
    )
  }

  // 完結済み（Ph.3で実装予定）
  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">この小説は完結しています。</p>
      </main>
    </>
  )
}
