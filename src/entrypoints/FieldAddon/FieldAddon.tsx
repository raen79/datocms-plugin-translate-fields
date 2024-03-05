import { useEffect, useState } from 'react'
import get from 'lodash/get'
import { RenderFieldExtensionCtx } from 'datocms-plugin-sdk'
import { Canvas, Form, Button, Spinner } from 'datocms-react-ui'

import {
  getTranslation,
  getStructuredTextTranslation,
  getMarkdownTranslation,
  getRichTextTranslation,
  getHtmlTranslation,
  getSeoTranslation,
  getSlugTranslation,
} from '../../lib/translation'
import {
  getSupportedToLocale,
  getSupportedFromLocale,
} from '../../lib/supported-locales'
import {
  Editor,
  TranslationFormat,
  TranslationOptions,
  GlobalParameters,
  Parameters,
  TranslationService,
  TranslationServiceKey,
  OpenAIDefaultValues,
} from '../../lib/types'
import {
  deeplFormalityLevelOptions,
  translationFormats,
  translationServiceOptions,
} from '../../lib/constants'
import { fieldHasFieldValue } from '../../lib/helpers'

type Props = {
  ctx: RenderFieldExtensionCtx
}

export default function FieldAddon({ ctx }: Props) {
  const [isTranslating, setIsTranslating] = useState(false)
  const [hasError, setHasError] = useState('')
  const useMock = process.env.REACT_APP_USE_MOCK === 'true'

  const pluginGlobalParameters: GlobalParameters =
    ctx.plugin.attributes.parameters
  const pluginParameters: Parameters = ctx.parameters

  const translationService =
    pluginParameters?.translationService ||
    pluginGlobalParameters?.translationService ||
    translationServiceOptions[0]

  const translationServiceValue = useMock
    ? TranslationService.mock
    : translationService.value
  const translationServiceApiKey =
    `${translationServiceValue}ApiKey` as TranslationServiceKey

  const translationApiKey: string =
    pluginParameters?.[translationServiceApiKey] ||
    pluginGlobalParameters?.[translationServiceApiKey] ||
    ''

  const model = pluginParameters.model ?? pluginGlobalParameters.model
  const modelValue = model?.value ?? OpenAIDefaultValues.model

  const temperature =
    pluginParameters.temperature ??
    pluginGlobalParameters.temperature ??
    OpenAIDefaultValues.temperature

  const maxTokens =
    pluginParameters.maxTokens ??
    pluginGlobalParameters.maxTokens ??
    OpenAIDefaultValues.maxTokens

  const context =
    pluginParameters.context ??
    pluginGlobalParameters.context ??
    OpenAIDefaultValues.context

  const topP =
    pluginParameters.topP ??
    pluginGlobalParameters.topP ??
    OpenAIDefaultValues.topP

  const locales: string[] = ctx.formValues.internalLocales as string[]

  const currencies =
    pluginParameters.currencies ??
    pluginGlobalParameters.currencies ??
    locales.reduce(
      (previousCurrencies, locale) => ({
        ...previousCurrencies,
        [locale]: { code: 'EUR', format: '€{{amount}}' },
      }),
      {},
    )

  const deeplGlossaryId =
    pluginParameters.deeplGlossaryId || pluginGlobalParameters.deeplGlossaryId

  const deeplFormalityLevelValue =
    pluginGlobalParameters.deeplFormalityLevel?.value ||
    deeplFormalityLevelOptions[0].value

  const fieldValue: any = get(ctx.formValues, ctx.fieldPath)
  const currentLocale: string = ctx.locale
  const editor: Editor = ctx.field.attributes.appearance?.editor as Editor
  const isDefaultLocale: boolean = currentLocale === locales[0]
  const translationFormat: TranslationFormat = translationFormats[editor]

  useEffect(() => {
    setHasError('')
  }, [fieldValue])

  useEffect(() => {
    if (translationApiKey === '' && !useMock) {
      setHasError(`Set ${translationService.label} API key in the settings`)
    }
  }, [translationApiKey, translationService, useMock])

  async function translateField(
    languages: string[],
    fromLocale?: string,
    convertCurrency: boolean = false,
  ) {
    let translatableField = fieldValue
    const [fieldPath]: string[] = ctx.fieldPath.split(/\.(?=[^.]+$)/)
    if (fromLocale) {
      translatableField = get(ctx.formValues, `${fieldPath}.${fromLocale}`)
    }

    if (
      fieldHasFieldValue(translatableField, {
        itemTypes: ctx.itemTypes,
        fields: ctx.fields,
        editor: editor,
      })
    ) {
      setIsTranslating(true)

      await Promise.all(
        languages.map(async (locale) => {
          let translatedField
          const options: TranslationOptions = {
            fromLocale: getSupportedFromLocale(
              fromLocale || locales[0],
              translationServiceValue,
            ),
            toLocale: getSupportedToLocale(locale, translationServiceValue),
            format: translationFormat,
            translationService: translationServiceValue,
            apiKey: translationApiKey,
            locales,
            deeplOptions: {
              glossaryId: deeplGlossaryId,
              formality: deeplFormalityLevelValue,
            },
            openAIOptions: {
              model: modelValue,
              temperature,
              maxTokens,
              topP,
              context,
              currencies,
            },
          }

          try {
            switch (translationFormat) {
              case TranslationFormat.structuredText: {
                translatedField = await getStructuredTextTranslation(
                  translatableField,
                  options,
                  ctx,
                  convertCurrency,
                )
                break
              }
              case TranslationFormat.html: {
                translatedField = await getHtmlTranslation(
                  translatableField,
                  options,
                  convertCurrency,
                  ctx,
                )
                break
              }
              case TranslationFormat.markdown: {
                translatedField = await getMarkdownTranslation(
                  translatableField,
                  options,
                  convertCurrency,
                  ctx,
                )
                break
              }
              case TranslationFormat.seo: {
                translatedField = await getSeoTranslation(
                  translatableField,
                  options,
                  convertCurrency,
                  ctx,
                )
                break
              }
              case TranslationFormat.richText: {
                translatedField = await getRichTextTranslation(
                  translatableField,
                  options,
                  ctx,
                  convertCurrency,
                )
                break
              }
              case TranslationFormat.slug: {
                translatedField = await getSlugTranslation(
                  translatableField,
                  options,
                  convertCurrency,
                  ctx,
                )
                break
              }
              default: {
                translatedField = await getTranslation(
                  translatableField,
                  options,
                  options.openAIOptions.context,
                  convertCurrency,
                  ctx,
                )
                break
              }
            }

            ctx.setFieldValue(`${fieldPath}.${locale}`, translatedField)
          } catch (error: any) {
            setHasError(error.message)
          } finally {
          }
        }),
      )
      setIsTranslating(false)
    } else {
      setIsTranslating(false)

      setHasError(
        `Please add content to the default field (${fromLocale || locales[0]})`,
      )
    }
  }

  if (hasError) {
    return (
      <Canvas ctx={ctx}>
        <p className="text-error body--small">{hasError}</p>
      </Canvas>
    )
  }

  if (
    (fieldHasFieldValue(fieldValue, {
      itemTypes: ctx.itemTypes,
      fields: ctx.fields,
      editor: editor,
    }) &&
      !isDefaultLocale) ||
    locales.length <= 1
  ) {
    ctx.setHeight(0)
    return <></>
  }

  if (!isDefaultLocale) {
    return (
      <Canvas ctx={ctx}>
        <Form onSubmit={() => translateField([currentLocale], locales[0])}>
          <Button
            buttonSize="xxs"
            type="submit"
            rightIcon={isTranslating ? <Spinner size={24} /> : null}
            leftIcon={
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 448 512"
                width="1em"
                height="1em"
              >
                <path
                  d="M320 448v40c0 13.255-10.745 24-24 24H24c-13.255 0-24-10.745-24-24V120c0-13.255 10.745-24 24-24h72v296c0 30.879 25.121 56 56 56h168zm0-344V0H152c-13.255 0-24 10.745-24 24v368c0 13.255 10.745 24 24 24h272c13.255 0 24-10.745 24-24V128H344c-13.2 0-24-10.8-24-24zm120.971-31.029L375.029 7.029A24 24 0 0 0 358.059 0H352v96h96v-6.059a24 24 0 0 0-7.029-16.97z"
                  fill="currentColor"
                ></path>
              </svg>
            }
            disabled={isTranslating}
          >
            Copy and translate from {locales[0]}
          </Button>
        </Form>
      </Canvas>
    )
  }

  return (
    <Canvas ctx={ctx}>
      <div style={{ display: 'flex', flexDirection: 'row', gap: 15 }}>
        <Form
          onSubmit={() =>
            translateField(
              locales.filter((locale) => locale !== currentLocale),
              'en',
              true,
            )
          }
        >
          <Button
            buttonSize="xxs"
            type="submit"
            rightIcon={isTranslating ? <Spinner size={24} /> : null}
            disabled={isTranslating}
          >
            Translate to all locales and convert currencies
          </Button>
        </Form>

        <Form
          onSubmit={() =>
            translateField(locales.filter((locale) => locale !== currentLocale))
          }
        >
          <Button
            buttonSize="xxs"
            type="submit"
            rightIcon={isTranslating ? <Spinner size={24} /> : null}
            disabled={isTranslating}
          >
            Translate to all locales
          </Button>
        </Form>
      </div>
    </Canvas>
  )
}
