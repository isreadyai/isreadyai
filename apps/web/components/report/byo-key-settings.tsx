'use client'

import { useEffect, useState } from 'react'
import { useTranslations } from 'next-intl'
import { BYO_PROVIDERS, isByoProvider, type TByoProvider } from '@/lib/byo-providers'

// Session-only storage of the user's own provider key. Stored as JSON
// { provider, key } under this key, in sessionStorage only — it is cleared when
// the tab closes, never sent to our servers for storage, and only ever sent
// per-request to be forwarded straight to the chosen provider.
const STORAGE_KEY = 'isready:byo-llm'

export interface IByoConfig {
  provider: TByoProvider
  key: string
}

const PROVIDER_LABEL: Record<TByoProvider, string> = {
  anthropic: 'Anthropic (Claude)',
  openai: 'OpenAI (ChatGPT)',
  google: 'Google (Gemini)',
  xai: 'xAI (Grok)',
}

/** Read the saved BYO config from sessionStorage, or null if unset/invalid. */
export function readByoConfig(): IByoConfig | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (raw === null) {
      return null
    }
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) {
      return null
    }
    const record = parsed as Record<string, unknown>
    if (!isByoProvider(record.provider) || typeof record.key !== 'string') {
      return null
    }
    const key = record.key.trim()
    return key.length > 0 ? { provider: record.provider, key } : null
  } catch {
    return null
  }
}

interface IByoKeySettingsProps {
  /** Notifies the parent whenever the stored config changes (saved or cleared). */
  onChange?: (config: IByoConfig | null) => void
}

export function ByoKeySettings({ onChange }: IByoKeySettingsProps) {
  const t = useTranslations('report.askSite.byo')
  const [expanded, setExpanded] = useState(false)
  const [provider, setProvider] = useState<TByoProvider>('anthropic')
  const [keyInput, setKeyInput] = useState('')
  const [connected, setConnected] = useState<TByoProvider | null>(null)

  useEffect(() => {
    const config = readByoConfig()
    if (config !== null) {
      setProvider(config.provider)
      setConnected(config.provider)
    }
  }, [])

  function save(): void {
    const key = keyInput.trim()
    if (key.length === 0) {
      return
    }
    const config: IByoConfig = { provider, key }
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(config))
    } catch {
      return
    }
    setConnected(provider)
    setKeyInput('')
    setExpanded(false)
    onChange?.(config)
  }

  function disconnect(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
    setConnected(null)
    setKeyInput('')
    onChange?.(null)
  }

  return (
    <div className="border-site-border/60 border-t pt-2">
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="text-site-faint hover:text-site-text flex w-full items-center justify-between text-[11px] transition-colors"
      >
        <span>
          {connected !== null
            ? t('connected', { provider: PROVIDER_LABEL[connected] })
            : t('useOwnKey')}
        </span>
        <span aria-hidden="true">{expanded ? '−' : '+'}</span>
      </button>

      {expanded ? (
        <div className="mt-2 space-y-2">
          <select
            value={provider}
            onChange={(event) => setProvider(event.target.value as TByoProvider)}
            className="border-site-border bg-site-surface text-site-text min-h-9 w-full rounded-lg border px-2 text-xs"
            aria-label={t('providerLabel')}
          >
            {BYO_PROVIDERS.map((value) => (
              <option key={value} value={value}>
                {PROVIDER_LABEL[value]}
              </option>
            ))}
          </select>
          <input
            type="password"
            value={keyInput}
            onChange={(event) => setKeyInput(event.target.value)}
            placeholder={t('keyPlaceholder')}
            autoComplete="off"
            className="border-site-border bg-site-surface text-site-text placeholder:text-site-faint min-h-9 w-full rounded-lg border px-3 font-mono text-xs"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={save}
              disabled={keyInput.trim().length === 0}
              className="bg-site-secondary text-site-secondary-foreground hover:bg-site-text hover:text-site-background min-h-8 flex-1 rounded-lg px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40"
            >
              {t('save')}
            </button>
            {connected !== null ? (
              <button
                type="button"
                onClick={disconnect}
                className="border-site-border text-site-muted hover:text-site-text min-h-8 rounded-lg border px-3 text-xs transition-colors"
              >
                {t('disconnect')}
              </button>
            ) : null}
          </div>
          <p className="text-site-faint text-[10px] leading-relaxed">{t('privacyNote')}</p>
        </div>
      ) : null}
    </div>
  )
}
