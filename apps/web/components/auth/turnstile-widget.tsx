'use client'

import { useEffect, useRef } from 'react'

// MARK: - Cloudflare Turnstile widget

const SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js'

interface ITurnstileApi {
  render: (el: HTMLElement, options: Record<string, unknown>) => string
  reset: (id?: string) => void
  remove: (id: string) => void
}

declare global {
  interface Window {
    turnstile?: ITurnstileApi
  }
}

interface ITurnstileWidgetProps {
  siteKey: string
  onToken: (token: string | null) => void
  resetSignal: number
}

export function TurnstileWidget({ siteKey, onToken, resetSignal }: ITurnstileWidgetProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetIdRef = useRef<string | null>(null)
  // Keep the latest callback without re-rendering the widget on every parent render.
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    let cancelled = false

    function renderWidget(): void {
      if (
        cancelled ||
        containerRef.current === null ||
        window.turnstile === undefined ||
        widgetIdRef.current !== null
      ) {
        return
      }
      const size = containerRef.current.clientWidth < 300 ? 'compact' : 'flexible'
      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme: 'dark',
        size,
        action: 'turnstile-spin-v1',
        callback: (token: string) => onTokenRef.current(token),
        'error-callback': () => onTokenRef.current(null),
        'expired-callback': () => onTokenRef.current(null),
      })
    }

    if (document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_SRC}"]`) === null) {
      const script = document.createElement('script')
      script.src = SCRIPT_SRC
      script.async = true
      script.defer = true
      document.head.appendChild(script)
    }

    // Poll for the API instead of relying on the script's load event: under React
    // strict mode the listener is attached after the (cached) script already fired.
    const timer = setInterval(() => {
      if (window.turnstile !== undefined) {
        clearInterval(timer)
        renderWidget()
      }
    }, 120)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [siteKey])

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current !== null && window.turnstile !== undefined) {
      window.turnstile.reset(widgetIdRef.current)
      onTokenRef.current(null)
    }
  }, [resetSignal])

  return (
    <div
      ref={containerRef}
      data-action="turnstile-spin-v1"
      className="min-h-[65px] w-full min-w-0"
    />
  )
}
