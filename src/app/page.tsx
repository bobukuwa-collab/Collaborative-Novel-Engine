import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/login')

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">協調小説エンジン</h1>
        <p className="text-gray-500">ログイン成功！（ルーム機能は実装中）</p>
        <p className="text-sm text-gray-400 mt-2">{user.email}</p>
      </div>
    </main>
  )
}
