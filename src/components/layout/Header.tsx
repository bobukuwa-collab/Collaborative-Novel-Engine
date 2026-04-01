import { createClient } from '@/lib/supabase/server'
import { signOut } from '@/lib/supabase/actions'

export async function Header() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = user
    ? await supabase.from('users').select('display_name').eq('id', user.id).single()
    : { data: null }

  const displayName = profile?.display_name ?? user?.email ?? ''

  return (
    <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
      <a href="/" className="text-lg font-bold text-indigo-600">協調小説エンジン</a>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{displayName}</span>
        <form action={signOut}>
          <button
            type="submit"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            ログアウト
          </button>
        </form>
      </div>
    </header>
  )
}
