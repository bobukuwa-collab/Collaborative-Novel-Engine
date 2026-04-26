import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/Header'
import { ContributionChart } from '@/components/novels/ContributionChart'
import { LikeButton } from '@/components/novels/LikeButton'
import { redirect } from 'next/navigation'

export default async function NovelPage({ params }: { params: { id: string } }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: novel, error } = await supabase
    .from('novels')
    .select('*, rooms(genre, max_players, game_mode)')
    .eq('id', params.id)
    .single()

  if (error || !novel) {
    return (
      <>
        <Header />
        <main className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-600">作品が見つかりません。</p>
        </main>
      </>
    )
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('id, main_theme_score')
    .eq('room_id', novel.room_id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  const sentences = session
    ? (await supabase
        .from('sentences')
        .select('id, user_id, content, seq')
        .eq('session_id', session.id)
        .order('seq', { ascending: true })
      ).data ?? []
    : []

  const { data: members } = await supabase
    .from('room_members')
    .select('user_id, color, join_order, users(display_name)')
    .eq('room_id', novel.room_id)

  const memberMap = new Map(
    (members ?? []).map((m) => [
      m.user_id,
      {
        color: m.color,
        name:
          (Array.isArray(m.users)
            ? m.users[0]?.display_name
            : (m.users as { display_name: string } | null)?.display_name) ?? '不明',
      },
    ]),
  )

  const contributionMap = new Map<string, { name: string; color: string; sentences: number; characters: number }>()
  for (const s of sentences) {
    const member = memberMap.get(s.user_id)
    if (!member) continue
    const existing = contributionMap.get(s.user_id)
    if (existing) {
      existing.sentences += 1
      existing.characters += s.content.length
    } else {
      contributionMap.set(s.user_id, { name: member.name, color: member.color, sentences: 1, characters: s.content.length })
    }
  }
  const contributionData = Array.from(contributionMap.values())

  const { count: likeCount } = await supabase
    .from('likes').select('*', { count: 'exact', head: true }).eq('novel_id', params.id)
  const { data: myLike } = await supabase
    .from('likes').select('novel_id').eq('novel_id', params.id).eq('user_id', user.id).maybeSingle()

  const roomInfo = novel.rooms as { genre: string; max_players: number; game_mode: string } | null
  const genre = roomInfo?.genre ?? ''
  const isBattle = roomInfo?.game_mode === 'secret_battle'

  let themes: { user_id: string; theme_text: string }[] = []
  let themeScores: { user_id: string; score: number }[] = []
  if (isBattle && session) {
    const [themesRes, scoresRes] = await Promise.all([
      supabase.from('room_themes').select('user_id, theme_text').eq('room_id', novel.room_id),
      supabase.from('session_theme_scores').select('user_id, score').eq('session_id', session.id),
    ])
    themes = themesRes.data ?? []
    themeScores = scoresRes.data ?? []
  }
  const winner = themeScores.length > 0
    ? themeScores.reduce((a, b) => (a.score >= b.score ? a : b))
    : null
  const publishedAt = novel.published_at
    ? new Date(novel.published_at).toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })
    : ''

  const authorNames = contributionData.map((d) => d.name)

  return (
    <>
      <Header />
      <main className="min-h-screen bg-stone-100 py-10 px-4">
        <div className="max-w-2xl mx-auto space-y-6">

          {/* バトル結果 */}
          {isBattle && (
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl border border-indigo-200 p-6 space-y-5">
              <h2 className="text-lg font-bold text-center text-indigo-900">⚔️ バトル結果</h2>

              {winner && (
                <div className="text-center">
                  <p className="text-xs text-indigo-600 mb-2 uppercase tracking-widest">Winner</p>
                  <div className="inline-flex items-center gap-2 bg-white rounded-full px-5 py-2 shadow border border-indigo-200">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: memberMap.get(winner.user_id)?.color ?? '#9ca3af' }} />
                    <span className="font-bold text-gray-800">{memberMap.get(winner.user_id)?.name ?? '不明'}</span>
                    <span>🏆</span>
                  </div>
                </div>
              )}

              {novel.battle_verdict && (
                <div className="bg-white border border-indigo-100 rounded-lg p-4">
                  <p className="text-xs font-semibold text-indigo-600 mb-2">AI 審査員の講評</p>
                  <p className="text-sm text-stone-700 leading-relaxed">{novel.battle_verdict}</p>
                </div>
              )}

              {typeof session?.main_theme_score === 'number' && (
                <div className="text-center text-xs text-stone-500">
                  メインテーマ一致度：<span className="font-semibold text-stone-700">{session.main_theme_score}</span> / 100
                </div>
              )}

              <div className="grid gap-3">
                {Array.from(memberMap.entries()).map(([uid, m]) => {
                  const score = themeScores.find((s) => s.user_id === uid)?.score ?? null
                  const theme = themes.find((t) => t.user_id === uid)?.theme_text
                  const isWinner = winner?.user_id === uid
                  return (
                    <div key={uid} className={`bg-white rounded-lg p-4 border ${isWinner ? 'border-yellow-300 shadow-md' : 'border-indigo-100'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full" style={{ backgroundColor: m.color }} />
                          <span className="font-semibold text-sm text-gray-800">{m.name}</span>
                          {isWinner && <span className="text-sm">🏆</span>}
                        </div>
                        <span className="font-bold text-indigo-600 text-sm">{score !== null ? `${score}pt` : '採点なし'}</span>
                      </div>
                      {theme && (
                        <p className="text-xs text-gray-500 mb-2">
                          秘密テーマ：<span className="font-medium text-gray-800">「{theme}」</span>
                        </p>
                      )}
                      {score !== null && (
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${score}%`, backgroundColor: m.color }} />
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* 書籍カバー風タイトル */}
          <div
            className="relative bg-gradient-to-b from-amber-50 to-amber-100 rounded-sm shadow-2xl border border-amber-200 overflow-hidden"
            style={{ boxShadow: '4px 4px 20px rgba(0,0,0,0.25), inset -3px 0 8px rgba(0,0,0,0.08)' }}
          >
            {/* 背表紙ライン */}
            <div className="absolute left-0 top-0 bottom-0 w-2 bg-amber-300/60" />
            <div className="pl-6 pr-5 py-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="text-xs text-amber-700/70 tracking-widest uppercase mb-3 font-medium">{genre}</p>
                  <h1 className="text-2xl font-bold text-gray-800 mb-4 leading-tight" style={{ fontFamily: 'Georgia, serif' }}>
                    {novel.title}
                  </h1>
                  <p className="text-xs text-gray-500">
                    {authorNames.length > 0 ? authorNames.join('・') + ' 共著' : ''}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {publishedAt} 完成　全{sentences.length}段落
                  </p>
                </div>
                <LikeButton novelId={params.id} initialLiked={!!myLike} initialCount={likeCount ?? 0} />
              </div>
            </div>
          </div>

          {/* 本文（書籍ページ風） */}
          <div
            className="bg-amber-50 rounded-sm border border-amber-200/80"
            style={{ boxShadow: '2px 2px 12px rgba(0,0,0,0.12), inset -2px 0 6px rgba(0,0,0,0.04)' }}
          >
            {/* ページ上部装飾 */}
            <div className="flex items-center justify-between px-8 pt-5 pb-2 border-b border-amber-200/60">
              <span className="text-xs text-amber-700/50 tracking-widest">{novel.title}</span>
              <span className="text-xs text-amber-700/50">{genre}</span>
            </div>

            <div className="px-8 py-8">
              {sentences.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">段落がありません。</p>
              ) : (
                <div className="space-y-6" style={{ fontFamily: '"Noto Serif JP", Georgia, serif' }}>
                  {sentences.map((s) => {
                    const member = memberMap.get(s.user_id)
                    return (
                      <div
                        key={s.id}
                        className="relative pl-4 border-l-2"
                        style={{ borderColor: member?.color ?? '#9ca3af' }}
                      >
                        <p className="text-gray-800 text-[0.95rem] leading-[2] whitespace-pre-wrap">{s.content}</p>
                        <p className="text-xs text-amber-700/50 mt-1">{member?.name ?? '不明'}</p>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* ページ下部装飾 */}
            <div className="flex items-center justify-center px-8 py-4 border-t border-amber-200/60">
              <div className="flex gap-3">
                {contributionData.map((d) => (
                  <span key={d.name} className="flex items-center gap-1 text-xs text-amber-700/60">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* 貢献率グラフ */}
          {contributionData.length > 0 && (
            <div className="bg-white rounded-xl shadow p-6">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">段落貢献率</h2>
              <ContributionChart data={contributionData} />
              <div className="mt-4 space-y-1">
                {contributionData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs text-gray-600">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="font-medium">{d.name}</span>
                    <span className="text-gray-400">{d.sentences}段落 · {d.characters}字</span>
                  </div>
                ))}
              </div>
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
