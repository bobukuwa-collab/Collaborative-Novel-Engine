const ANTHROPIC_VERSION = '2023-06-01'

type MessageContent = { type: 'text'; text: string }

export async function anthropicMessages(params: {
  system?: string
  messages: { role: 'user' | 'assistant'; content: string }[]
  maxTokens?: number
}): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY が未設定です')
  }

  const body = {
    model: 'claude-3-5-haiku-20241022',
    max_tokens: params.maxTokens ?? 1024,
    system: params.system,
    messages: params.messages.map((m) => ({
      role: m.role,
      content: [{ type: 'text', text: m.content } satisfies MessageContent],
    })),
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const t = await res.text()
    throw new Error(`Anthropic API エラー: ${res.status} ${t}`)
  }

  const data = (await res.json()) as {
    content: Array<{ type: string; text?: string }>
  }
  const text = data.content?.find((c) => c.type === 'text')?.text
  if (!text) throw new Error('Anthropic 応答にテキストがありません')
  return text
}
