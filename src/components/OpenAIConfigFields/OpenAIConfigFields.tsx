import {
  RenderConfigScreenCtx,
  RenderManualFieldExtensionConfigScreenCtx,
} from 'datocms-plugin-sdk'
import {
  SelectField,
  TextField,
  FieldGroup,
  Spinner,
  Canvas,
} from 'datocms-react-ui'
import { useOpenAIConfigFields } from '../../hooks/useOpenAIConfigFields'
import {
  Parameters,
  GlobalParameters,
  Models,
  SettingOption,
  Currency,
} from '../../lib/types'

type OpenAIConfigFieldsProps = {
  ctx: RenderConfigScreenCtx | RenderManualFieldExtensionConfigScreenCtx
  pluginParameters: Parameters | GlobalParameters
  updateParametersFn: (params: Record<string, unknown>) => Promise<void>
  options: SettingOption<string>[]
  models: Models | null
  openAIApiKey: string | undefined
  error: string
  selectedModel: SettingOption<string>
  temperature: number
  maxTokens: number
  topP: number
  context: string
  locales: string[]
  currencies: Record<string, Currency>
}

function OpenAIConfigFields({
  ctx,
  pluginParameters,
  updateParametersFn,
  options,
  models,
  error,
  openAIApiKey,
  selectedModel,
  temperature,
  maxTokens,
  topP,
  context,
  locales,
  currencies,
}: OpenAIConfigFieldsProps) {
  if (error) {
    return (
      <Canvas ctx={ctx}>
        <p className="text-error">{error}</p>
      </Canvas>
    )
  }

  if (!openAIApiKey) {
    return null
  }

  if (!models) {
    return <Spinner />
  }

  return (
    <FieldGroup>
      <SelectField
        name="model"
        id="model"
        label="Model"
        hint="All available GPT3 models. Note: not all models are suitable for translation."
        selectInputProps={{ options }}
        value={selectedModel}
        onChange={(newValue) => {
          updateParametersFn({
            ...pluginParameters,
            model: newValue,
          })
          ctx.notice('Settings updated successfully!')
        }}
      />

      <TextField
        name="context"
        id="context"
        label="Context"
        hint="Give an explanation of the app that is being translated, including anything that should or should not be done within translations."
        value={context}
        onChange={(newValue) => {
          updateParametersFn({
            ...pluginParameters,
            context: newValue?.toString(),
          })
          ctx.notice('Settings updated successfully!')
        }}
      />

      {locales.map((locale) => (
        <FieldGroup
          style={{ flexDirection: 'row', display: 'flex', gap: 15 }}
          key={locale}
        >
          <TextField
            key={`${locale}-currency`}
            name={`${locale}-currency`}
            id={`${locale}-currency`}
            label={`Currency Code (${locale})`}
            hint="Provide the three letter code for the currency that should be used with this locale (e.g. GBP, EUR, AED)."
            value={currencies[locale]?.code}
            onChange={(newValue) => {
              updateParametersFn({
                ...pluginParameters,
                currencies: {
                  ...currencies,
                  [locale]: {
                    ...currencies[locale],
                    code: newValue?.toString(),
                  },
                },
              })
              ctx.notice('Settings updated successfully!')
            }}
          />
          <TextField
            key={`${locale}-currency-format`}
            name={`${locale}-currency-format`}
            id={`${locale}-currency-format`}
            label={`Currency Format (${locale})`}
            hint="Provide the format for this currency (e.g. `€{{amount}}` for €15,000 or `{{amount}} OMR` for 15,000 OMR)."
            value={currencies[locale]?.format}
            onChange={(newValue) => {
              updateParametersFn({
                ...pluginParameters,
                currencies: {
                  ...currencies,
                  [locale]: {
                    ...currencies[locale],
                    format: newValue?.toString(),
                  },
                },
              })
              ctx.notice('Settings updated successfully!')
            }}
          />
        </FieldGroup>
      ))}

      <TextField
        name="temperature"
        id="temperature"
        label="Temperature"
        hint="What sampling temperature to use."
        value={temperature}
        textInputProps={{
          type: 'number',
          min: 0,
          max: 1,
          step: 0.01,
        }}
        onChange={(newValue) => {
          updateParametersFn({
            ...pluginParameters,
            temperature: Number(newValue),
          })
          ctx.notice('Settings updated successfully!')
        }}
      />

      <TextField
        name="maxTokens"
        id="maxTokens"
        label="Max Tokens"
        hint="The maximum number of tokens to generate in the completion. The exact limit varies per model."
        placeholder="100"
        value={maxTokens}
        textInputProps={{
          type: 'number',
          min: 0,
          max: 4000,
          step: 1,
        }}
        onChange={(newValue) => {
          updateParametersFn({
            ...pluginParameters,
            maxTokens: Number(newValue),
          })
          ctx.notice('Settings updated successfully!')
        }}
      />

      <TextField
        name="topP"
        id="topP"
        label="Top P"
        hint="An alternative to sampling with temperature, called nucleus sampling, where the model considers the results of the tokens with top_p probability mass."
        value={topP}
        textInputProps={{
          type: 'number',
          min: 0,
          max: 1,
          step: 0.01,
        }}
        onChange={(newValue) => {
          updateParametersFn({
            ...pluginParameters,
            topP: Number(newValue),
          })
          ctx.notice('Settings updated successfully!')
        }}
      />
    </FieldGroup>
  )
}

type OpenAIConfigFieldsConfigScreenProps = {
  ctx: RenderConfigScreenCtx
  locales: string[]
}

export function OpenAIConfigFieldsConfigScreen({
  ctx,
  locales,
}: OpenAIConfigFieldsConfigScreenProps) {
  const {
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
  } = useOpenAIConfigFields({ ctx, locales })

  const pluginParameters: GlobalParameters = ctx.plugin.attributes.parameters

  return (
    <OpenAIConfigFields
      ctx={ctx}
      pluginParameters={pluginParameters}
      updateParametersFn={ctx.updatePluginParameters}
      options={options}
      models={models}
      openAIApiKey={openAIApiKey}
      error={error}
      selectedModel={selectedModel}
      temperature={temperature}
      maxTokens={maxTokens}
      topP={topP}
      context={context}
      locales={locales}
      currencies={currencies}
    />
  )
}

type OpenAIConfigFieldsFieldAddonConfigScreenProps = {
  ctx: RenderManualFieldExtensionConfigScreenCtx
  locales: string[]
}

export function OpenAIConfigFieldsFieldAddonConfigScreen({
  ctx,
  locales,
}: OpenAIConfigFieldsFieldAddonConfigScreenProps) {
  const configFields = useOpenAIConfigFields({ ctx, locales })

  const { options, models, openAIApiKey, error } = configFields
  let { selectedModel, temperature, maxTokens, topP, context, currencies } =
    configFields

  const pluginParameters: Parameters = ctx.parameters

  selectedModel = pluginParameters.model ?? selectedModel
  temperature = pluginParameters.temperature ?? temperature
  maxTokens = pluginParameters.maxTokens ?? maxTokens
  topP = pluginParameters.topP ?? topP
  context = pluginParameters.context ?? context

  return (
    <OpenAIConfigFields
      ctx={ctx}
      pluginParameters={pluginParameters}
      updateParametersFn={ctx.setParameters}
      options={options}
      models={models}
      openAIApiKey={openAIApiKey}
      error={error}
      selectedModel={selectedModel}
      temperature={temperature}
      maxTokens={maxTokens}
      topP={topP}
      context={context}
      currencies={currencies}
      locales={locales}
    />
  )
}
