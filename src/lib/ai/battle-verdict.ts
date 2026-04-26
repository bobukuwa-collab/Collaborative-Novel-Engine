import { anthropicMessages } from '@/lib/ai/anthropic'

export async function generateBattleVerdict(params: {
  storyText: string
  genre: string
  players: { name: string; theme: string; score: number }[]
  winnerName: string
}): Promise<string> {
  const { storyText, genre, players, winnerName } = params
  const winner = players.find((p) => p.name === winnerName)

  if (!process.env.ANTHROPIC_API_KEY) {
    const others = players.filter((p) => p.name !== winnerName)
    const otherInfo = others.map((p) => `「${p.theme}」（${p.score}点）`).join('・')
    return `【${winnerName}の勝利】テーマ「${winner?.theme ?? ''}」への誘導が物語全体に一貫して表れており、高評価を得ました。対するプレイヤーのテーマ ${otherInfo} も反映されましたが、物語の展開を支配するには至りませんでした。`
  }

  const playerList = players
    .map((p) => `・${p.name}：秘密テーマ「${p.theme}」、獲得スコア ${p.score}点`)
    .join('\n')

  try {
    const raw = await anthropicMessages({
      system: [
        'あなたは短編小説バトルの審査員です。',
        '審査結果を100〜150文字の日本語で解説してください。',
        '以下を必ず含めること：①勝者名と勝因（どの場面・表現が効果的だったか）②敗者が及ばなかった理由③物語全体の総評。',
        '抽象的な表現は避け、本文の具体的な場面を根拠にすること。',
      ].join('\n'),
      messages: [{
        role: 'user',
        content: `カテゴリ：${genre}\n\nプレイヤー情報：\n${playerList}\n\n勝者：${winnerName}\n\n本文（末尾抜粋）：\n${storyText.slice(-2000)}`,
      }],
      maxTokens: 400,
    })
    return raw.trim().slice(0, 300)
  } catch {
    return `【${winnerName}の勝利】テーマ「${winner?.theme ?? ''}」を物語の軸に据えた描写が一貫しており、採点で上回りました。`
  }
}
