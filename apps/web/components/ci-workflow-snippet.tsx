'use client'

import type { ReactNode } from 'react'
import { Fragment } from 'react'
import type { TCiWorkflowAction, TCodeTone } from '@/lib/ci-workflow-snippets'
import { CI_WORKFLOW_SNIPPETS, ECodeTone, ciWorkflowYaml } from '@/lib/ci-workflow-snippets'
import { SegmentedControl } from '@/components/ui/segmented-control'
import { CopyButton } from '@/components/ui/copy-button'
import { useCopyToClipboard } from '@/lib/use-copy-to-clipboard'

// MARK: - CI workflow snippet switcher (Audit ↔ Fix)

const TONE_CLASSES: Record<TCodeTone, string> = {
  [ECodeTone.KEY]: 'text-site-muted',
  [ECodeTone.ACTION]: 'text-site-accent',
  [ECodeTone.NUMBER]: 'text-score-good',
  [ECodeTone.COMMENT]: 'text-site-faint',
}

interface ICiWorkflowSnippetOption {
  value: TCiWorkflowAction
  label: string
}

interface ICiWorkflowSnippetProps {
  action: TCiWorkflowAction
  onActionChange: (action: TCiWorkflowAction) => void
  switchAriaLabel: string
  switchOptions: readonly ICiWorkflowSnippetOption[]
  copyLabel: string
  copiedLabel: string
  /** Surface-specific panel background for the code block (defaults to the marketing card's tone). */
  preClassName?: string
  /** Extra content rendered between the switch/copy row and the code block (e.g. a numbered activation guide). */
  children?: ReactNode
}

/**
 * Audit/Fix segmented switch + highlighted YAML + copy button. Shared by the
 * marketing GitHub card and the dashboard CI empty state so the two surfaces
 * can never fall out of sync.
 */
export function CiWorkflowSnippet({
  action,
  onActionChange,
  switchAriaLabel,
  switchOptions,
  copyLabel,
  copiedLabel,
  preClassName = 'bg-site-surface/60',
  children,
}: ICiWorkflowSnippetProps) {
  const { copied, copy } = useCopyToClipboard()
  const snippet = CI_WORKFLOW_SNIPPETS[action]
  const yaml = ciWorkflowYaml(snippet)

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <SegmentedControl
          value={action}
          options={switchOptions}
          onChange={onActionChange}
          ariaLabel={switchAriaLabel}
        />
        <CopyButton
          copied={copied === action}
          onCopy={() => void copy(yaml, action)}
          copyLabel={copyLabel}
          copiedLabel={copiedLabel}
        />
      </div>
      {children}
      <pre
        className={`border-site-border/60 mt-2 overflow-x-auto rounded-xl border p-4 font-mono text-xs leading-relaxed sm:text-sm ${preClassName}`}
      >
        <code>
          {snippet.lines.map((line, lineIndex) => {
            const lineText = line.map((token) => token.text).join('')
            // A trailing comment (e.g. the audit action's api-key line) renders on
            // its own indented row so long lines never clip or force horizontal
            // scroll. ciWorkflowYaml() still joins this line's ORIGINAL tokens for
            // the copied plain text, so the clipboard output is unaffected.
            const commentToken = line.find((token) => token.tone === ECodeTone.COMMENT) ?? null
            const codeTokens =
              commentToken === null ? line : line.filter((token) => token !== commentToken)
            const indent = line[0]?.text.match(/^\s*/)?.[0] ?? ''
            return (
              <Fragment key={lineText}>
                {lineIndex > 0 ? '\n' : null}
                {codeTokens.map((token) =>
                  token.tone === undefined ? (
                    token.text
                  ) : (
                    <span key={`${token.tone}-${token.text}`} className={TONE_CLASSES[token.tone]}>
                      {token.text}
                    </span>
                  ),
                )}
                {commentToken !== null ? (
                  <>
                    {'\n'}
                    {indent}
                    <span className={TONE_CLASSES[ECodeTone.COMMENT]}>{commentToken.text}</span>
                  </>
                ) : null}
              </Fragment>
            )
          })}
        </code>
      </pre>
    </div>
  )
}
