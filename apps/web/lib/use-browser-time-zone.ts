'use client'

import { useEffect, useState } from 'react'
import { dayjs } from '@/lib/dayjs'

export function useBrowserTimeZone(): string | null {
  const [timeZone, setTimeZone] = useState<string | null>(null)

  useEffect(() => {
    setTimeZone(dayjs.tz.guess())
  }, [])

  return timeZone
}
