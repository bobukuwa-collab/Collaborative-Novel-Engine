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
      <main className="min-h-screen bg-gradient-to-b from-indigo-50 to-stone-50 py-16 px-4">
        <div className="max-w-lg mx-auto space-y-10 text-center">

          <div className="space-y-3">
            <p className="text-xs font-semibold tracking-widest text-indigo-500 uppercase">Human × AI Collaborative Novel</p>
            <h1 className="text-4xl font-black text-gray-900">AIと小説を書こう</h1>
            <p className="text-gray-500 text-base leading-relaxed">
              あなたとAIが交互に文章を紡ぎ、ひとつの物語を作ります。<br />
              完成後、あなたの<span className="font-semibold text-indigo-600">執筆の癖と人格</span>をAIが占います。
            </p>
          </div>

          {/* 特徴カード */}
          <div className="grid grid-cols-2 gap-3 text-left">
            {[
              { emoji: '✍️', title: '交互執筆', desc: 'あなた→AI→あなた…と交互に物語を紡ぐ' },
              { emoji: '🧠', title: '人格占い', desc: 'サイコパス度・共感力・闇度などを分析' },
              { emoji: '📚', title: 'ライブラリ', desc: '完成した作品をライブラリで公開' },
              { emoji: '🎭', title: 'ジャンル選択', desc: '10ジャンルからテーマを選んで執筆' },
            ].map((f) => (
              <div key={f.title} className="bg-white rounded-xl border border-gray-100 p-4 space-y-1">
                <p className="text-2xl">{f.emoji}</p>
                <p className="font-semibold text-sm text-gray-800">{f.title}</p>
                <p className="text-xs text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link
              href="/rooms/new"
              className="py-3 px-8 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors text-base"
            >
              執筆を始める
            </Link>
            <Link
              href="/library"
              className="py-3 px-8 bg-white text-gray-600 font-semibold rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              ライブラリを見る
            </Link>
          </div>
        </div>
      </main>
    </>
  )
}
