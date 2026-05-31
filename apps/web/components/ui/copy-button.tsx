'use client'

// MARK: - Copy chip

export function CopyButton({
  copied,
  onCopy,
  copyLabel,
  copiedLabel,
}: {
  copied: boolean
  onCopy: () => void
  copyLabel: string
  copiedLabel: string
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      className={`shrink-0 cursor-pointer rounded-lg border px-3 py-1.5 font-mono text-xs transition-colors ${
        copied
          ? 'border-site-accent text-site-accent'
          : 'border-site-border text-site-muted hover:border-site-accent-dim hover:text-site-text'
      }`}
    >
      {copied ? copiedLabel : copyLabel}
    </button>
  )
}
