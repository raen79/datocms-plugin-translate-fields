import { TranslationOptions } from '../types'

export default async function translate(
  string: string,
  options: TranslationOptions,
): Promise<string> {
  const prompt = `Translate the following from the locale '${options.fromLocale}' to the locale '${options.toLocale}': ${string}`

  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + options.apiKey,
    },
    body: JSON.stringify({
      messages: [
        {
          role: 'system',
          content:
            'You are a translation assistant that accepts text, and exclusively returns the same text in the provided locale.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: options.openAIOptions.temperature,
      max_tokens: options.openAIOptions.maxTokens,
      top_p: options.openAIOptions.topP,
    }),
  }

  const request = await fetch(
    'https://api.openai.com/v1/chat/completions',
    requestOptions,
  )

  if (request.status !== 200) {
    throw new Error(`OpenAI returned status ${request.status}`)
  }

  const response = await request.json()
  const text = response.choices[0].text as string

  return text.trim()
}
