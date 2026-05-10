'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { ALLOWED_GENRES } from './constants'

const createRoomSchema = z.object({
  genre: z.enum(ALLOWED_GENRES, { message: '有効なジャンルを選択してください' }),
  max_turns: z.coerce.number().int().min(10).max(100).default(30),
})

export async function createRoom(_prev: { error: string } | null, formData: FormData) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const result = createRoomSchema.safeParse({
    genre: formData.get('genre'),
    max_turns: formData.get('max_turns'),
  })

  if (!result.success) return { error: result.error.issues[0].message }

  const { genre, max_turns } = result.data

  const { data: room, error: roomErr } = await supabase
    .from('rooms')
    .insert({ genre, max_turns, created_by: user.id })
    .select('id')
    .single()

  if (roomErr || !room) return { error: '作成に失敗しました。もう一度お試しください。' }

  const { error: sessionErr } = await supabase
    .from('sessions')
    .insert({ room_id: room.id, current_turn: 0 })

  if (sessionErr) return { error: 'セッション作成に失敗しました。もう一度お試しください。' }

  redirect(`/rooms/${room.id}`)
}
