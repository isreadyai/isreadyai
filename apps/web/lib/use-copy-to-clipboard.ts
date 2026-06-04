'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

// MARK: - useCopyToClipboard

/**
 * Shared clipboard state: copy() writes text and flips `copied` to the given
 * key for `resetMs`, so components with several copy buttons know which fired.
 */

const RESET_MS = 1800

export interface ICopyToClipboard {
  copied: string | null
  copy: (text: string, key?: string) => Promise<void>
}

export function useCopyToClipboard(resetMs: number = RESET_MS): ICopyToClipboard {
  const [copied, setCopied] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    return () => {
      clearTimeout(timer.current)
    }
  }, [])

  const copy = useCallback(
    async (text: string, key = 'default'): Promise<void> => {
      await navigator.clipboard.writeText(text)
      setCopied(key)
      clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(null), resetMs)
    },
    [resetMs],
  )

  return { copied, copy }
}
