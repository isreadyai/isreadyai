'use client'

import { Dropdown } from '@heroui/react/dropdown'
import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { validateScanInput } from '@isreadyai/scanner'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { notify } from '@/components/ui/toast'
import { useAccount } from '@/lib/use-account'
import { rememberScanWriteToken } from '@/lib/scan-write-token-client'

const SCAN_FORM_MODES = ['quick', 'deep'] as const
type TScanFormMode = (typeof SCAN_FORM_MODES)[number]

const SEGMENT =
  'bg-site-accent text-site-accent-foreground hover:bg-site-text inline-flex min-h-12 cursor-pointer items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60'

export function ScanForm({
  size = 'lg',
  authenticated,
  fullWidth = false,
}: {
  size?: 'lg' | 'sm'
  /**
   * Forces the signed-in form (Quick/Deep selector, routes into the dashboard).
   * Omit on public pages: the client session decides, so this one component
   * adapts everywhere — anonymous visitors get the single "Scan for free" CTA.
   */
  authenticated?: boolean
  fullWidth?: boolean
}) {
  const t = useTranslations('hero')
  const router = useRouter()
  const { identity } = useAccount()
  // Signed-in visitors get the Quick/Deep selector and land in the dashboard;
  // anonymous visitors get the single "Scan for free" CTA and the public report.
  const authed = authenticated ?? identity !== null

  const [value, setValue] = useState('')
  const [pending, setPending] = useState(false)
  const [mode, setMode] = useState<TScanFormMode>('quick')
  // onPress and native submit can both fire; guard re-entrancy synchronously.
  const inFlight = useRef(false)

  async function runScan(scanMode: TScanFormMode): Promise<void> {
    if (inFlight.current) {
      return
    }
    // Same validator the API uses, so client and server can't disagree.
    const validated = validateScanInput(value)
    if (!validated.ok) {
      // Input validation, not a failure — guide the user with a warning.
      notify.warning(t(validated.problem === 'private' ? 'privateUrl' : 'invalidUrl'))
      return
    }
    inFlight.current = true
    setPending(true)
    try {
      const response = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: validated.url }),
      })
      if (!response.ok) {
        // Distinct message per status; don't blame the URL for a 429.
        if (response.status === 429) {
          // Throttling and bad input are expected, recoverable states → warning.
          notify.warning(t('rateLimited'))
        } else if (response.status === 400) {
          notify.warning(t('invalidUrl'))
        } else {
          notify.error(t('scanFailed'))
        }
        setPending(false)
        inFlight.current = false
        return
      }
      const data = (await response.json()) as { id: string; writeToken?: string }
      if (data.writeToken !== undefined) {
        rememberScanWriteToken(data.id, data.writeToken)
      }
      // Signed-in scans open in the dashboard (premium-aware, owner-scoped); the
      // public form keeps routing to the shareable /report page. ?deep=true
      // auto-starts the deep crawl.
      const base = authed ? `/dashboard/scans/${data.id}` : `/report/${data.id}`
      router.push(scanMode === 'deep' ? `${base}?deep=true` : base)
    } catch {
      notify.error(t('scanFailed'))
      setPending(false)
      inFlight.current = false
    }
  }

  const submitLabel = authed ? (mode === 'deep' ? t('modeDeep') : t('modeQuick')) : t('cta')

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        void runScan(mode)
      }}
      className={fullWidth ? 'w-full' : 'w-full max-w-xl'}
      noValidate
    >
      <div
        className={`flex w-full gap-2 ${size === 'lg' ? 'flex-col sm:flex-row sm:items-stretch' : 'flex-col xs:flex-row sm:flex-row'}`}
      >
        <TextInput
          aria-label={t('inputAriaLabel')}
          placeholder={t('inputPlaceholder')}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          autoComplete="url"
          inputMode="url"
          spellCheck={false}
          isMonospace
          className="flex-1"
        />
        {authed ? (
          <div className="flex shrink-0">
            <button
              type="submit"
              disabled={pending}
              className={`${SEGMENT} flex-1 rounded-l-xl px-5 text-sm sm:flex-none`}
            >
              {pending ? t('scanning') : submitLabel}
            </button>
            <Dropdown.Root>
              <Dropdown.Trigger
                aria-label={t('modeAria')}
                className={`${SEGMENT} border-site-background/25 rounded-r-xl border-l px-3 outline-none`}
              >
                <CaretIcon />
              </Dropdown.Trigger>
              <Dropdown.Popover placement="bottom end">
                <Dropdown.Menu className="min-w-44">
                  {SCAN_FORM_MODES.map((scanMode) => (
                    <Dropdown.Item key={scanMode} onAction={() => setMode(scanMode)}>
                      {scanMode === 'deep' ? t('modeDeep') : t('modeQuick')}
                    </Dropdown.Item>
                  ))}
                </Dropdown.Menu>
              </Dropdown.Popover>
            </Dropdown.Root>
          </div>
        ) : (
          <Button type="submit" variant="primary" isDisabled={pending} className="w-full sm:w-auto">
            {pending ? t('scanning') : submitLabel}
          </Button>
        )}
      </div>
      <p className="text-site-faint mt-2 text-xs">
        {authed ? t(mode === 'deep' ? 'modeDeepHint' : 'modeQuickHint') : t('ctaHint')}
      </p>
    </form>
  )
}

function CaretIcon() {
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden="true">
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
