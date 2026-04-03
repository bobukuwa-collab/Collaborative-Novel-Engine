'use client'

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'

type Props = {
  data: { name: string; sentences: number; characters: number; color: string }[]
}

export function ContributionChart({ data }: Props) {
  const sentenceData = data.map((d) => ({ name: d.name, value: d.sentences, color: d.color }))
  const charData = data.map((d) => ({ name: d.name, value: d.characters, color: d.color }))

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      <ChartBlock title="投稿文数" data={sentenceData} unit="文" />
      <ChartBlock title="総文字数" data={charData} unit="字" />
    </div>
  )
}

function ChartBlock({
  title,
  data,
  unit,
}: {
  title: string
  data: { name: string; value: number; color: string }[]
  unit: string
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-600 mb-2 text-center">{title}</h3>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            outerRadius={75}
            dataKey="value"
            label={({ name, percent }) =>
              `${name} ${((percent ?? 0) * 100).toFixed(0)}%`
            }
            labelLine={false}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => [`${value}${unit}`, '']} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
