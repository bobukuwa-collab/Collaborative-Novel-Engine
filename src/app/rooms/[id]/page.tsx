import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { notFound, redirect } from 'next/navigation'
import { WaitingRoom } from '@/components/rooms/WaitingRoom'

const MEMBER_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
]

export default async function RoomPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: room } = await supabase
    .from('rooms')
    .select('*, room_members(user_id, join_order, color, users(display_name))')
    .eq('id', params.id)
    .single()

  if (!room) notFound()

  const isMember = room.room_members.some(
    (m: { user_id: string }) => m.user_id === user.id
  )

  // 未参加の場合は参加処理
  if (!isMember) {
    const currentCount = room.room_members.length
    if (currentCount >= room.max_players) {
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
      join_order: currentCount,
      color: MEMBER_COLORS[currentCount % MEMBER_COLORS.length],
    })

    redirect(`/rooms/${params.id}`)
  }

  const inviteUrl = `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/rooms/${params.id}`

  return (
    <>
      <Header />
      <WaitingRoom room={room} currentUserId={user.id} inviteUrl={inviteUrl} />
    </>
  )
}
