import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Header } from '@/components/layout/Header'
import Link from 'next/link'

export default async function HomePage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <>
      <Header />
      <main className="min-h-screen bg-gray-50 py-12 px-4">
        <div className="max-w-lg mx-auto text-center space-y-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">協調小説エンジン</h1>
            <p className="text-gray-500">見知らぬ誰かと、小説を完成させよう</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/rooms/new"
              className="py-3 px-8 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              ルームを作成
            </Link>
            <Link
              href="/library"
              className="py-3 px-8 bg-white text-indigo-600 font-semibold rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors"
            >
              ライブラリを見る
            </Link>
          </div>
          <p className="text-sm text-gray-400">
            友達から招待リンクを受け取った場合はそのURLを開いてください
          </p>
        </div>
      </main>
    </>
  )
}
