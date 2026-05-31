'use client'

interface ISegmentedControlOption<T extends string> {
  value: T
  label: string
}

interface ISegmentedControlProps<T extends string> {
  value: T
  options: readonly ISegmentedControlOption<T>[]
  onChange: (value: T) => void
  ariaLabel: string
  className?: string
}

/** Tablist-style button group for value selection */
export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  className = '',
}: ISegmentedControlProps<T>) {
  return (
    <div className={`flex min-w-0 gap-1 ${className}`} role="tablist" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
          className={`min-w-0 flex-1 cursor-pointer rounded-md border px-2.5 py-1 font-mono text-xs transition-colors sm:flex-none ${
            value === option.value
              ? 'bg-site-accent text-site-accent-foreground border-site-accent font-semibold'
              : 'text-site-muted hover:border-site-accent-dim hover:text-site-text border-transparent'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
