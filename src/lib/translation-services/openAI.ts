import moment from 'moment'
import { TranslationOptions } from '../types'
import axios from 'axios'
import OpenAI from 'openai'

export default async function translate(
  string: string,
  options: TranslationOptions,
  context: string,
  convertCurrency: boolean,
): Promise<string> {
  const fxRatesRequest = await (async () => {
    try {
      const date = moment().utc().format('YYYY-MM-DD')

      return await axios.get(
        `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/${date}/currencies/eur.json`,
      )
    } catch {
      const date = moment().utc().format('YYYY-MM-DD')

      return await axios.get(
        `https://cdn.jsdelivr.net/gh/fawazahmed0/currency-api@1/latest/currencies/eur.json?date=${date}`,
      )
    }
  })()

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

  const openai = new OpenAI({
    apiKey: options.apiKey,
    dangerouslyAllowBrowser: true,
  })

  const stream = openai.beta.chat.completions.stream({
    model: options.openAIOptions.model,
    temperature: options.openAIOptions.temperature,
    max_tokens: options.openAIOptions.maxTokens,
    top_p: options.openAIOptions.topP,
    messages: [
      {
        role: 'system',
        content: `You are a translation assistant that accepts any text submitted by the user, and returns exclusively the code of a javascript function called \`translatedText\` with no parameters that returns the text translated in the provided locale and in the requested formatting and currency conversion (when requested explicitly). You should use javascript script when requested to format a number or convert a currency from one to another when requested explicitly. The context of the app you are translating the text for is the following: ${context}. Do not translate anything before the triple newline. Supply the \`translatedText\` function code that will return the translated text from the locale '${options.fromLocale}' to the locale '${options.toLocale}'${currencyConversionString}. ${currencyConversionString}`,
      },
      { role: 'user', content: string },
    ],
  })

  let code = ''

  try {
    for await (const part of stream) {
      code += part.choices[0]?.delta?.content
    }

    // eslint-disable-next-line no-eval
    return eval(
      code.split('```')[1].replace('javascript', '') + '\ntranslatedText();',
    )
  } catch (error) {
    console.error(string)
    console.error(code)
    console.error(
      code.split('```')[1].replace('javascript', '') + '\ntranslatedText();',
    )
    throw error
  }
}
