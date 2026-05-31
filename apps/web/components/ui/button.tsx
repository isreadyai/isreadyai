'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'

// MARK: - Button (one component; variant × appearance × size)

/**
 * Native elements over react-aria: react-aria swallows native clicks inside
 * <Link> and adds ~40KB to first load for no gain here. With `href` it renders
 * a real Next <Link> (native navigation, middle-click, prefetch).
 *
 * Three orthogonal axes: `variant` is the colour intent, `appearance` is the
 * fill style, `size` is the footprint. Every visual combination comes from this
 * matrix — callers never hand-roll button classes.
 */

export const EButtonVariant = {
  PRIMARY: 'primary',
  SECONDARY: 'secondary',
  DANGER: 'danger',
  NEUTRAL: 'neutral',
} as const
export type TButtonVariant = (typeof EButtonVariant)[keyof typeof EButtonVariant]

export const EButtonAppearance = {
  SOLID: 'solid',
  OUTLINE: 'outline',
  GHOST: 'ghost',
} as const
export type TButtonAppearance = (typeof EButtonAppearance)[keyof typeof EButtonAppearance]

export const EButtonSize = {
  MD: 'md',
  SM: 'sm',
} as const
export type TButtonSize = (typeof EButtonSize)[keyof typeof EButtonSize]

const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60'

const SIZES: Record<TButtonSize, string> = {
  [EButtonSize.MD]: 'min-h-12 px-5 text-sm',
  [EButtonSize.SM]: 'min-h-9 px-3.5 text-xs',
}

const STYLES: Record<TButtonVariant, Record<TButtonAppearance, string>> = {
  [EButtonVariant.PRIMARY]: {
    [EButtonAppearance.SOLID]:
      'bg-site-accent text-site-accent-foreground hover:bg-site-text font-semibold',
    [EButtonAppearance.OUTLINE]:
      'border-site-border text-site-text hover:border-site-accent-dim border bg-transparent',
    [EButtonAppearance.GHOST]: 'text-site-text hover:bg-site-raised bg-transparent',
  },
  [EButtonVariant.SECONDARY]: {
    [EButtonAppearance.SOLID]:
      'bg-site-secondary text-site-secondary-foreground hover:bg-site-text hover:text-site-background font-semibold',
    [EButtonAppearance.OUTLINE]:
      'border-site-secondary-dim text-site-text hover:border-site-secondary border bg-transparent',
    [EButtonAppearance.GHOST]: 'text-site-secondary hover:bg-site-raised bg-transparent',
  },
  [EButtonVariant.DANGER]: {
    [EButtonAppearance.SOLID]: 'bg-danger text-site-text hover:bg-danger/85 font-semibold',
    [EButtonAppearance.OUTLINE]:
      'border-site-border text-site-text hover:border-danger hover:text-danger border bg-transparent',
    [EButtonAppearance.GHOST]: 'text-danger hover:bg-danger/12 bg-transparent',
  },
  [EButtonVariant.NEUTRAL]: {
    [EButtonAppearance.SOLID]: 'bg-site-raised text-site-text hover:bg-site-border font-semibold',
    [EButtonAppearance.OUTLINE]:
      'border-site-border text-site-text hover:border-site-accent-dim border bg-transparent',
    [EButtonAppearance.GHOST]:
      'text-site-muted hover:text-site-text hover:bg-site-raised bg-transparent',
  },
}

interface IButtonProps {
  children: ReactNode
  variant?: TButtonVariant
  appearance?: TButtonAppearance
  size?: TButtonSize
  href?: string
  onPress?: () => void
  type?: 'button' | 'submit'
  isDisabled?: boolean
  className?: string
  ariaLabel?: string
}

export function Button({
  children,
  variant = EButtonVariant.PRIMARY,
  appearance = EButtonAppearance.SOLID,
  size = EButtonSize.MD,
  href,
  onPress,
  type = 'button',
  isDisabled = false,
  className = '',
  ariaLabel,
}: IButtonProps) {
  const classes = `${BASE} ${SIZES[size]} ${STYLES[variant][appearance]} ${className}`

  if (href !== undefined) {
    return (
      <Link href={href} aria-label={ariaLabel} className={classes}>
        {children}
      </Link>
    )
  }
  return (
    <button
      type={type}
      onClick={onPress}
      disabled={isDisabled}
      aria-label={ariaLabel}
      className={classes}
    >
      {children}
    </button>
  )
}
