import { get, set } from 'lodash'
import slugify from 'slugify'
import { fromMarkdown } from 'mdast-util-from-markdown'
import { toMarkdown } from 'mdast-util-to-markdown'

import { TranslationOptions, Path, TranslationService, PathType } from './types'
import { paths, removePropertyRecursively } from './helpers'

import yandexTranslate from './translation-services/yandex'
import deeplTranslate from './translation-services/deepl'
import openAITranslate from './translation-services/openAI'
import { RenderFieldExtensionCtx } from 'datocms-plugin-sdk'

const parseHtml = require('html2json')

export async function getTranslation(
  string: string,
  options: TranslationOptions,
  context: string,
  convertCurrency: boolean,
): Promise<string> {
  switch (options.translationService) {
    case TranslationService.mock: {
      return `Translated ${string}`
    }
    case TranslationService.yandex: {
      return yandexTranslate(string, options)
    }
    case TranslationService.deepl:
    case TranslationService.deeplFree: {
      return deeplTranslate(string, options)
    }
    case TranslationService.openAI: {
      return openAITranslate(string, options, context, convertCurrency)
    }
    default: {
      throw new Error('No translation service added in the settings')
    }
  }
}

export async function getRichTextTranslation(
  value: any[],
  options: TranslationOptions,
  ctx: RenderFieldExtensionCtx,
  convertCurrency: boolean,
): Promise<any[]> {
  const mappedValue = removePropertyRecursively(value, {
    keysToRemove: ['itemId'],
  })
  const allPaths = paths(mappedValue)
  let translatedArray = mappedValue

  await Promise.all(
    allPaths.map(async (path) => {
      const field = Object.values(ctx.fields).find(
        (field) => field?.attributes.api_key === path.key,
      )

      const isSelectField = 'enum' in (field?.attributes.validators ?? {})

      if (isSelectField) {
        const currentPath = path.path
        const currentString = get(translatedArray, currentPath)
        if (currentString) set(translatedArray, currentPath, currentString)

        return
      }

      if (path.type === PathType.text) {
        const currentPath = path.path
        const currentString = get(translatedArray, currentPath)
        if (currentString) {
          const translatedString = await getTranslation(
            currentString,
            options,
            options.openAIOptions.context,
            convertCurrency,
          )
          set(translatedArray, currentPath, translatedString)
        }
      }

      if (path.type === PathType.html) {
        const currentPath = path.path
        const currentString = get(translatedArray, currentPath)
        if (currentString) {
          const translatedString = await getHtmlTranslation(
            currentString,
            options,
            convertCurrency,
          )
          set(translatedArray, currentPath, translatedString)
        }
      }

      if (path.type === PathType.markdown) {
        const currentPath = path.path
        const currentString = get(translatedArray, currentPath)
        if (currentString) {
          const translatedString = await getMarkdownTranslation(
            currentString,
            options,
            convertCurrency,
          )
          set(translatedArray, currentPath, translatedString)
        }
      }

      if (path.type === PathType.structured_text) {
        const currentPath = path.path
        const currentArray = get(translatedArray, currentPath)
        if (currentArray) {
          const translatedString = await getStructuredTextTranslation(
            currentArray,
            options,
            ctx,
            convertCurrency,
          )
          set(translatedArray, currentPath, translatedString)
        }
      }

      if (path.type === PathType.structured_text_block) {
        const currentPath = path.path
        const currentObject: any = get(translatedArray, path.path)
        if (currentObject) {
          const translatedObject = await getRichTextTranslation(
            { ...currentObject, type: null, children: null },
            options,
            ctx,
            convertCurrency,
          )
          set(translatedArray, currentPath, {
            ...translatedObject,
            type: currentObject.type,
            children: currentObject.children,
          })
        }
      }

      if (path.type === PathType.seo) {
        const currentPath = path.path
        const currentValue = get(translatedArray, currentPath)
        if (currentValue) {
          const translatedString = await getSeoTranslation(
            currentValue,
            options,
            convertCurrency,
          )
          set(translatedArray, currentPath, translatedString)
        }
      }
    }),
  )

  return translatedArray
}

export async function getSeoTranslation(
  value: any,
  options: TranslationOptions,
  convertCurrency: boolean,
): Promise<any> {
  return {
    title: value.title
      ? await getTranslation(
          value.title,
          options,
          options.openAIOptions.context,
          convertCurrency,
        )
      : '',
    description: value.description
      ? await getTranslation(
          value.description,
          options,
          options.openAIOptions.context,
          convertCurrency,
        )
      : '',
    image: value?.image,
    twitter_card: value?.twitter_card,
  }
}

export async function getStructuredTextTranslation(
  value: any[],
  options: TranslationOptions,
  ctx: RenderFieldExtensionCtx,
  convertCurrency: boolean,
): Promise<any[]> {
  const mappedValue = removePropertyRecursively(value, {
    keysToRemove: ['id'],
    keysToSkip: ['meta'],
  })
  const allPaths = paths(mappedValue)
  let translatedArray = mappedValue

  await Promise.all(
    allPaths.map(async (path) => {
      if (path.type === PathType.text && path.key === 'text') {
        const currentPath = path.path
        const currentString = get(translatedArray, currentPath)
        if (currentString) {
          const translatedString = await getTranslation(
            currentString,
            options,
            options.openAIOptions.context,
            convertCurrency,
          )
          set(translatedArray, currentPath, translatedString)
        }
      }

      if (path.type === PathType.structured_text) {
        const currentPath = path.path
        const currentArray = get(translatedArray, currentPath)
        if (currentArray) {
          const translatedString = await getStructuredTextTranslation(
            currentArray,
            options,
            ctx,
            convertCurrency,
          )
          set(translatedArray, currentPath, translatedString)
        }
      }

      if (path.type === PathType.structured_text_block) {
        const currentPath = path.path
        const currentObject: any = get(translatedArray, path.path)
        if (currentObject) {
          const translatedObject = await getRichTextTranslation(
            { ...currentObject, type: null, children: null },
            options,
            ctx,
            convertCurrency,
          )
          set(translatedArray, currentPath, {
            ...translatedObject,
            type: currentObject.type,
            children: currentObject.children,
          })
        }
      }
    }),
  )

  return translatedArray
}

export async function getHtmlTranslation(
  string: string,
  options: TranslationOptions,
  convertCurrency: boolean,
): Promise<string> {
  const json = parseHtml.html2json(string)
  const allPaths: Path[] = paths(json.child)
  let translatedArray = json.child

  for (const path of allPaths) {
    if (path.key === 'text') {
      const currentPath = path.path
      const currentString = get(translatedArray, currentPath)
      if (currentString) {
        const translatedString = await getTranslation(
          currentString,
          options,
          options.openAIOptions.context,
          convertCurrency,
        )
        set(translatedArray, currentPath, translatedString)
      }
    }
  }

  const html = parseHtml.json2html({ ...json, child: translatedArray })
  return html
}

export async function getMarkdownTranslation(
  string: string,
  options: TranslationOptions,
  convertCurrency: boolean,
): Promise<string> {
  const json = fromMarkdown(string)
  const allPaths: Path[] = paths(json.children)
  let translatedArray = json.children

  for (const path of allPaths) {
    if (path.key === 'value') {
      const currentPath = path.path
      const currentString = get(translatedArray, currentPath)
      if (currentString) {
        const translatedString = await getTranslation(
          currentString,
          options,
          options.openAIOptions.context,
          convertCurrency,
        )
        set(translatedArray, currentPath, translatedString)
      }
    }
  }

  const md = toMarkdown({ ...json, children: translatedArray })
  return md
}

export async function getSlugTranslation(
  string: string,
  options: TranslationOptions,
  convertCurrency: boolean,
): Promise<string> {
  const deSlugifiedString = string.replace(/-/g, ' ')

  const translatedString = await getTranslation(
    deSlugifiedString,
    options,
    options.openAIOptions.context,
    convertCurrency,
  )
  return slugify(translatedString, {
    lower: true,
    strict: true,
    locale: options.toLocale,
  })
}
