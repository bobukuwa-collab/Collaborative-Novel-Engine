'use server'

import { createClient } from '@/lib/supabase/server'

export async function toggleLike(novelId: string) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: '認証が必要です' }

  const { data: novel } = await supabase
    .from('novels')
    .select('id')
    .eq('id', novelId)
    .eq('status', 'completed')
    .maybeSingle()

  if (!novel) return { error: '作品が見つかりません' }

  const { data: existing } = await supabase
    .from('likes')
    .select('novel_id')
    .eq('user_id', user.id)
    .eq('novel_id', novelId)
    .maybeSingle()

  if (existing) {
    await supabase
      .from('likes')
      .delete()
      .eq('user_id', user.id)
      .eq('novel_id', novelId)
    return { liked: false }
  } else {
    await supabase
      .from('likes')
      .insert({ user_id: user.id, novel_id: novelId })
    return { liked: true }
  }
}
