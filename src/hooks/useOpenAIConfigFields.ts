import {
  RenderConfigScreenCtx,
  RenderManualFieldExtensionConfigScreenCtx,
} from 'datocms-plugin-sdk'
import { useEffect, useMemo, useState } from 'react'
import {
  GlobalParameters,
  Models,
  OpenAIDefaultValues,
  SettingOption,
} from '../lib/types'

function getDefaultModel({
  models,
}: {
  models: Models
}): SettingOption<string> {
  const model = models.find((model) => model.id === OpenAIDefaultValues.model)
  const modelId = model?.id

  if (!modelId) {
    return {
      value: '',
      label: '',
    }
  }

  return {
    value: modelId,
    label: modelId,
  }
}

export function useOpenAIConfigFields({
  ctx,
  locales,
}: {
  ctx: RenderConfigScreenCtx | RenderManualFieldExtensionConfigScreenCtx
  locales: string[]
}) {
  const [models, setModels] = useState<Models | null>(null)
  const [error, setError] = useState<string>('')

  const pluginParameters: GlobalParameters = ctx.plugin.attributes.parameters
  const { openAIApiKey } = pluginParameters

  const selectedModel = useMemo(
    () => pluginParameters?.model ?? getDefaultModel({ models: models ?? [] }),
    [models, pluginParameters?.model],
  )

  const options = useMemo(() => {
    if (!models) {
      return []
    }

    return models.map((model) => ({
      label: model.id,
      value: model.id,
    }))
  }, [models])

  const temperature =
    pluginParameters.temperature ?? OpenAIDefaultValues.temperature
  const context = pluginParameters.context ?? OpenAIDefaultValues.context
  const maxTokens = pluginParameters.maxTokens ?? OpenAIDefaultValues.maxTokens
  const topP = pluginParameters.topP ?? OpenAIDefaultValues.topP
  const currencies =
    pluginParameters.currencies ??
    locales.reduce(
      (previousCurrencies, locale) => ({
        ...previousCurrencies,
        [locale]: { code: 'EUR', format: '€{{amount}}' },
      }),
      {},
    )

  useEffect(() => {
    if (openAIApiKey) {
      setError('')

      fetch('https://api.openai.com/v1/models', {
        headers: {
          Authorization: 'Bearer ' + openAIApiKey,
        },
      })
        .then((request) => {
          if (request.status !== 200) {
            throw new Error(`OpenAI returned status ${request.status}`)
          }

          return request.json()
        })
        .then((response) => {
          setModels(response.data)
        })
        .catch((e: Error) => {
          setError(e.message)
        })
    }
  }, [openAIApiKey])

  return {
    options,
    models,
    error,
    openAIApiKey,
    selectedModel,
    temperature,
    maxTokens,
    topP,
    context,
    currencies,
  }
}
