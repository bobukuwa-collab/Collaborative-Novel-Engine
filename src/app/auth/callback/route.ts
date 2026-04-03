import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.user) {
      // OAuth ユーザーの public.users レコードがなければ作成
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('id', data.user.id)
        .single()

      if (!existing) {
        const meta = data.user.user_metadata ?? {}
        const displayName =
          (meta.full_name as string | undefined) ??
          (meta.name as string | undefined) ??
          data.user.email?.split('@')[0] ??
          'ユーザー'
        await supabase.from('users').insert({
          id: data.user.id,
          display_name: displayName,
          avatar_url: (meta.avatar_url as string | undefined) ?? null,
        })
      }

      return NextResponse.redirect(`${origin}/`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
