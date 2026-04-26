'use client'

type Props = {
  data: { name: string; sentences: number; characters: number; color: string }[]
}

export function ContributionChart({ data }: Props) {
  const totalSentences = data.reduce((s, d) => s + d.sentences, 0)
  const totalChars = data.reduce((s, d) => s + d.characters, 0)

  return (
    <div className="space-y-5">
      <BarBlock
        title="段落数"
        items={data.map((d) => ({ name: d.name, value: d.sentences, total: totalSentences, color: d.color, unit: '段落' }))}
      />
      <BarBlock
        title="文字数"
        items={data.map((d) => ({ name: d.name, value: d.characters, total: totalChars, color: d.color, unit: '字' }))}
      />
    </div>
  )
}

function BarBlock({
  title,
  items,
}: {
  title: string
  items: { name: string; value: number; total: number; color: string; unit: string }[]
}) {
  return (
    <div>
      <p className="text-xs font-medium text-stone-500 mb-2">{title}</p>
      <div className="space-y-2">
        {items.map((item) => {
          const pct = item.total > 0 ? Math.round((item.value / item.total) * 100) : 0
          return (
            <div key={item.name} className="flex items-center gap-3">
              <span className="text-xs text-stone-600 w-20 shrink-0 truncate">{item.name}</span>
              <div className="flex-1 h-4 bg-stone-100 rounded overflow-hidden">
                <div
                  className="h-full rounded transition-all"
                  style={{ width: `${pct}%`, backgroundColor: item.color }}
                />
              </div>
              <span className="text-xs text-stone-500 w-24 text-right shrink-0">
                {item.value.toLocaleString()}{item.unit}（{pct}%）
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
