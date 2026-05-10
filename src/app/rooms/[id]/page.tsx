import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { WritingRoom } from '@/components/rooms/WritingRoom'
import { redirect } from 'next/navigation'

export default async function RoomPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .select('id, genre, max_turns, status, created_by')
    .eq('id', params.id)
    .single()

  if (roomError || !room) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-stone-50 flex items-center justify-center">
          <p className="text-gray-600">セッションが見つかりません。</p>
        </main>
      </>
    )
  }

  if (room.created_by !== user.id) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-stone-50 flex items-center justify-center">
          <p className="text-gray-600">アクセスできません。</p>
        </main>
      </>
    )
  }

  // 完結済みなら小説ページへ
  if (room.status === 'completed') {
    const { data: novel } = await supabase
      .from('novels')
      .select('id')
      .eq('room_id', params.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (novel) redirect(`/novels/${novel.id}`)
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('id, room_id, current_turn')
    .eq('room_id', params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  if (!session) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-stone-50 flex items-center justify-center">
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

  return (
    <>
      <Header />
      <WritingRoom
        room={{ id: room.id, genre: room.genre, max_turns: room.max_turns ?? 30 }}
        session={session}
        initialSentences={sentences ?? []}
        currentUserId={user.id}
      />
    </>
  )
}
