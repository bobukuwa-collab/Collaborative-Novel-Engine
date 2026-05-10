import { GoogleGenerativeAI } from '@google/generative-ai'

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY が未設定です')
  return new GoogleGenerativeAI(apiKey)
}

export async function geminiGenerate(params: {
  system: string
  prompt: string
  maxTokens?: number
}): Promise<string> {
  const client = getClient()
  const model = client.getGenerativeModel({
    model: 'gemini-2.0-flash',
    systemInstruction: params.system,
    generationConfig: { maxOutputTokens: params.maxTokens ?? 1024 },
  })

  const result = await model.generateContent(params.prompt)
  const text = result.response.text()
  if (!text) throw new Error('Gemini 応答にテキストがありません')
  return text
}
