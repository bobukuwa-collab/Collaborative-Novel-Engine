import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { PersonalityCard } from '@/components/personality/PersonalityCard'
import { LikeButton } from '@/components/novels/LikeButton'
import { redirect } from 'next/navigation'

export default async function NovelPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: novel, error } = await supabase
    .from('novels')
    .select('*, rooms(genre)')
    .eq('id', params.id)
    .single()

  if (error || !novel) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-stone-50 flex items-center justify-center">
          <p className="text-gray-600">作品が見つかりません。</p>
        </main>
      </>
    )
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('id')
    .eq('room_id', novel.room_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const sentences = session
    ? (await supabase
        .from('sentences')
        .select('id, user_id, author_type, content, seq')
        .eq('session_id', session.id)
        .order('seq', { ascending: true })
      ).data ?? []
    : []

  const { data: personality } = await supabase
    .from('personality_profiles')
    .select('*')
    .eq('novel_id', params.id)
    .maybeSingle()

  const { count: likeCount } = await supabase
    .from('likes').select('*', { count: 'exact', head: true }).eq('novel_id', params.id)
  const { data: myLike } = await supabase
    .from('likes').select('novel_id').eq('novel_id', params.id).eq('user_id', user.id).maybeSingle()

  const genre = (novel.rooms as { genre: string } | null)?.genre ?? ''
  const publishedAt = novel.published_at
    ? new Date(novel.published_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''
  const humanCount = sentences.filter((s) => s.author_type === 'human').length
  const aiCount = sentences.filter((s) => s.author_type === 'ai').length

  return (
    <>
      <Header />
      <main className="min-h-screen bg-stone-100 py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* 書籍カバー風タイトル */}
          <div
            className="relative bg-gradient-to-b from-amber-50 to-amber-100 rounded-sm shadow-2xl border border-amber-200 overflow-hidden"
            style={{ boxShadow: '4px 4px 20px rgba(0,0,0,0.25), inset -3px 0 8px rgba(0,0,0,0.08)' }}
          >
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-amber-300/60" />
            <div className="pl-6 pr-5 py-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-xs text-amber-700/70 tracking-widest uppercase mb-3 font-medium">{genre}</p>
                  <h1 className="text-2xl font-bold text-gray-800 mb-4 leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
                    {novel.title}
                  </h1>
                  <p className="text-xs text-gray-500">人間 × AI 共著</p>
                  <p className="text-xs text-gray-400 mt-1">
                    {publishedAt}　全{sentences.length}段落（あなた {humanCount} / AI {aiCount}）
                  </p>
                </div>
                <LikeButton novelId={params.id} initialLiked={!!myLike} initialCount={likeCount ?? 0} />
              </div>
            </div>
          </div>

          {/* 本文 */}
          <div
            className="bg-amber-50 rounded-sm border border-amber-200/80"
            style={{ boxShadow: '2px 2px 12px rgba(0,0,0,0.12), inset -2px 0 6px rgba(0,0,0,0.04)' }}
          >
            <div className="flex items-center justify-between px-8 pt-5 pb-2 border-b border-amber-200/60">
              <span className="text-xs text-amber-700/50 tracking-widest">{novel.title}</span>
              <span className="text-xs text-amber-700/50">{genre}</span>
            </div>
            <div className="px-8 py-8">
              {sentences.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">段落がありません。</p>
              ) : (
                <div className="space-y-6" style={{ fontFamily: '"Noto Serif JP", Georgia, serif' }}>
                  {sentences.map((s) => (
                    <div
                      key={s.id}
                      className="relative pl-4 border-l-2"
                      style={{ borderColor: s.author_type === 'human' ? '#818cf8' : '#a8a29e' }}
                    >
                      <p className="text-gray-800 text-[0.95rem] leading-[2] whitespace-pre-wrap">{s.content}</p>
                      <p className="text-xs mt-1" style={{ color: s.author_type === 'human' ? '#818cf8' : '#a8a29e' }}>
                        {s.author_type === 'human' ? 'あなた' : 'AI'}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="flex items-center justify-center px-8 py-4 border-t border-amber-200/60">
              <div className="flex gap-4 text-xs text-amber-700/60">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-indigo-400" />あなた
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-stone-400" />AI
                </span>
              </div>
            </div>
          </div>

          {/* 人格占い結果 */}
          {personality && (
            <div className="space-y-2">
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide px-1">執筆人格診断</h2>
              <PersonalityCard
                psychopathy_score={personality.psychopathy_score}
                empathy_score={personality.empathy_score}
                imagination_score={personality.imagination_score}
                darkness_score={personality.darkness_score}
                personality_type={personality.personality_type}
                character_title={personality.character_title}
                analysis_text={personality.analysis_text}
              />
            </div>
          )}

          <div className="text-center">
            <a href="/library" className="text-sm text-indigo-600 hover:underline">← ライブラリに戻る</a>
          </div>
        </div>
      </main>
    </>
  )
}
