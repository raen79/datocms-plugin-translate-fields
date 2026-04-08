import moment from 'moment'
import { TranslationOptions } from '../types'
import axios from 'axios'
import OpenAI from 'openai'
import { RenderFieldExtensionCtx } from 'datocms-plugin-sdk'

function parseTranslationResponse(content: string | null): string {
  if (!content) {
    throw new Error('OpenAI returned an empty translation response.')
  }

  const trimmedContent = content.trim()

  if (!trimmedContent) {
    throw new Error('OpenAI returned an empty translation response.')
  }

  const normalizedContent = trimmedContent.replace(
    /^```(?:json)?\s*([\s\S]*?)\s*```$/i,
    '$1',
  )

  try {
    const parsedContent = JSON.parse(normalizedContent)

    if (
      parsedContent &&
      typeof parsedContent === 'object' &&
      typeof parsedContent.translation === 'string'
    ) {
      return parsedContent.translation
    }
  } catch {}

  return normalizedContent
}

function cleanObject(
  obj: { [key: string]: any },
  keysToRemove = [],
  isNested: boolean = false,
): { [key: string]: any } {
  const result: { [key: string]: any } = {}

  for (const [key, value] of Object.entries(obj)) {
    // Step 5: Exclude any specific keys
    if (keysToRemove.includes(key as never)) {
      continue
    }

    // Step 1: Exclude keys with values that are empty strings or null
    if (value === '' || value === null) {
      continue
    }

    // Step 2: Truncate string values longer than 50 characters
    if (typeof value === 'string') {
      result[key] = value.length > 50 ? `${value.substring(0, 50)}...` : value
      continue
    }

    // Recursively process objects
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      const nestedObject = cleanObject(value, keysToRemove, true)

      // Step 4: Keep only the 'en' key in objects that include it, exclude other locales
      if ('en' in nestedObject) {
        result[key] = { en: nestedObject.en }
        continue
      }

      // Step 3: Exclude objects that don't have an 'en' key, unless it's the top-level call
      if (Object.keys(nestedObject).length > 0 && !isNested) {
        result[key] = nestedObject
      }
    }
  }

  return result
}

export default async function translate(
  string: string,
  options: TranslationOptions,
  context: string,
  convertCurrency: boolean,
  ctx: RenderFieldExtensionCtx,
): Promise<string> {
  const fxRatesRequest = await (async () => {
    try {
      const date = moment().utc().format('YYYY.M.D')

      return await axios.get(
        `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@${date}/v1/currencies/eur.json`,
      )
    } catch {
      const date = moment().utc().format('YYYY.M.D')

      return await axios.get(
        `https://cdn.jsdelivr.net/npm/@fawazahmed0/currency-api@latest/v1/currencies/eur.json?date=${date}`,
      )
    }
  })()

  const fieldName = ctx.field.attributes.api_key

  const fromCurrency = options.openAIOptions.currencies[options.fromLocale].code
  const toCurrency = options.openAIOptions.currencies[options.toLocale].code

  const fromCurrencyFormat =
    options.openAIOptions.currencies[options.fromLocale].format
  const toCurrencyFormat =
    options.openAIOptions.currencies[options.toLocale].format

  const fxRate = fxRatesRequest.data['eur'][toCurrency.toLowerCase()]

  const shouldConvertCurrency = convertCurrency && fxRate !== 1

  const currencyConversionString = shouldConvertCurrency
    ? `, if the user entered text includes a number with currency, it is explicitly requested and required to change all currencies from ${fromCurrency} with format ${fromCurrencyFormat} to ${toCurrency} with format ${toCurrencyFormat} (or use previously provided harcoded mappings) and the exchange rate ${fromCurrency}:${toCurrency} is ${fxRate}. Floor (using javascript) each number that is within the text with the following condition: to the nearest multiple of 50 if the number is below or equal 100, to the nearest multiple of 100 if the number is above 100, or to the nearest multiple of 1000 if the number is above 1000. The script should automatically format numbers as 1000; 10,000; 100,000; 1,000,000 (comma separated) with decimal points in all locales no matter what.`
    : ', do not convert any currency or change any number formatting.'

  const wholeRecordContext = JSON.stringify(
    cleanObject(ctx.formValues, [fieldName as never]),
  )

  const openai = new OpenAI({
    apiKey: options.apiKey,
    dangerouslyAllowBrowser: true,
  })

  const completion = await openai.chat.completions.create({
    model: options.openAIOptions.model,
    temperature: options.openAIOptions.temperature,
    max_tokens: options.openAIOptions.maxTokens,
    top_p: options.openAIOptions.topP,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You are a translation assistant. Return only valid JSON with a single string property named "translation". Translate the user's text from the locale '${options.fromLocale}' to the locale '${options.toLocale}'. The context of the app you are translating for is: \`\`${context}\`\`. The field being translated is "${fieldName}" within this record: \`\`${wholeRecordContext}\`\`${currencyConversionString} When converting currencies, directly return the final converted text in the "translation" value. You even translate single words. Never translate a URL; return it unchanged. Do not include markdown, code fences, or any properties other than "translation".`,
      },
      { role: 'user', content: string },
    ],
  })

  console.warn(wholeRecordContext)

  try {
    return parseTranslationResponse(completion.choices[0]?.message?.content)
  } catch (error) {
    console.error(string)
    console.error(completion.choices[0]?.message?.content)
    throw error
  }
}
