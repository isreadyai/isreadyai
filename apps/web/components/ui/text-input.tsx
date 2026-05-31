'use client'

import type { InputProps } from '@heroui/react/input'
import { Input as HeroInput } from '@heroui/react/input'

interface ITextInputProps extends Omit<InputProps, 'className'> {
  className?: string
  surface?: 'solid' | 'subtle'
  isMonospace?: boolean
}

/** Styled text input with surface and monospace variants. */
export function TextInput({
  className = '',
  surface = 'solid',
  isMonospace = false,
  ...props
}: ITextInputProps) {
  const surfaceClass = surface === 'solid' ? 'bg-site-surface' : 'bg-site-surface/70'
  const fontClass = isMonospace ? 'font-mono text-base' : 'text-sm'

  return (
    <HeroInput
      {...props}
      className={`border-site-border placeholder:text-site-faint min-h-12 w-full rounded-xl border px-4 outline-none ${surfaceClass} ${fontClass} ${className}`}
    />
  )
}
