'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'

const createRoomSchema = z.object({
  genre: z.string().min(1, 'ジャンルを入力してください').max(20),
  max_players: z.coerce.number().int().min(2).max(8),
  char_limit: z.coerce.number().int().min(20).max(200),
})

const MEMBER_COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#10b981',
  '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6',
]

export async function createRoom(_prev: { error: string } | null, formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = createRoomSchema.safeParse({
    genre: formData.get('genre'),
    max_players: formData.get('max_players'),
    char_limit: formData.get('char_limit'),
  })

  if (!result.success) {
    return { error: result.error.issues[0].message }
  }

  const { genre, max_players, char_limit } = result.data

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .insert({ genre, max_players, char_limit, created_by: user.id })
    .select('id')
    .single()

  if (roomError || !room) {
    console.error('[createRoom] room insert error:', roomError)
    return { error: `ルームの作成に失敗しました: ${roomError?.message}` }
  }

  const { error: memberError } = await supabase
    .from('room_members')
    .insert({
      room_id: room.id,
      user_id: user.id,
      join_order: 0,
      color: MEMBER_COLORS[0],
    })

  if (memberError) {
    console.error('[createRoom] member insert error:', memberError)
    return { error: `ルームへの参加に失敗しました: ${memberError?.message}` }
  }

  redirect(`/rooms/${room.id}`)
}
