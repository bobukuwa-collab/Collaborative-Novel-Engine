'use client'

type Props = {
  psychopathy_score: number
  empathy_score: number
  imagination_score: number
  darkness_score: number
  personality_type: string
  character_title: string
  analysis_text: string
}

type BarProps = { label: string; value: number; color: string; emoji: string }

function ScoreBar({ label, value, color, emoji }: BarProps) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="font-medium text-gray-700">{emoji} {label}</span>
        <span className="font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}

export function PersonalityCard({
  psychopathy_score,
  empathy_score,
  imagination_score,
  darkness_score,
  personality_type,
  character_title,
  analysis_text,
}: Props) {
  const dominantColor = getDominantColor(psychopathy_score, empathy_score, imagination_score, darkness_score)

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-lg">
      {/* ヘッダー */}
      <div
        className="p-6 text-white text-center"
        style={{ background: dominantColor.gradient }}
      >
        <p className="text-xs font-semibold tracking-widest uppercase opacity-80 mb-1">あなたの執筆人格</p>
        <h2 className="text-3xl font-black mb-2">{character_title}</h2>
        <div className="inline-flex items-center gap-1.5 bg-white/20 rounded-full px-4 py-1.5">
          <span className="text-sm font-semibold">{personality_type}</span>
        </div>
      </div>

      {/* スコアバー */}
      <div className="bg-white p-6 space-y-4">
        <ScoreBar label="サイコパス度" value={psychopathy_score} color="#ef4444" emoji="🧊" />
        <ScoreBar label="共感力" value={empathy_score} color="#ec4899" emoji="💗" />
        <ScoreBar label="想像力" value={imagination_score} color="#8b5cf6" emoji="✨" />
        <ScoreBar label="闇度" value={darkness_score} color="#374151" emoji="🌑" />
      </div>

      {/* フレーバーテキスト */}
      <div className="bg-gray-50 border-t border-gray-100 px-6 py-5">
        <p className="text-sm text-gray-700 leading-relaxed italic">&ldquo;{analysis_text}&rdquo;</p>
      </div>
    </div>
  )
}

function getDominantColor(p: number, e: number, i: number, d: number) {
  const max = Math.max(p, e, i, d)
  if (max === p) return { gradient: 'linear-gradient(135deg, #ef4444 0%, #991b1b 100%)' }
  if (max === e) return { gradient: 'linear-gradient(135deg, #ec4899 0%, #9d174d 100%)' }
  if (max === i) return { gradient: 'linear-gradient(135deg, #8b5cf6 0%, #4c1d95 100%)' }
  return { gradient: 'linear-gradient(135deg, #374151 0%, #111827 100%)' }
}
