// MARK: - CI workflow snippets (single source for audit-action + fix-action YAML)

/**
 * Single source of truth for the `audit-action` and `fix-action` YAML shown
 * on the marketing GitHub card (`components/github-showcase.tsx`) and the
 * dashboard CI empty state (`components/dashboard/ci-repos-table.tsx`). Each
 * snippet is authored as an array of token lines; the copyable plain-text
 * YAML is derived by joining every token's text, so the clipboard string and
 * the highlighted rendering in `components/ci-workflow-snippet.tsx` can never
 * drift apart.
 */

export const ECiWorkflowAction = {
  AUDIT: 'audit',
  FIX: 'fix',
} as const
export type TCiWorkflowAction = (typeof ECiWorkflowAction)[keyof typeof ECiWorkflowAction]

export const ECodeTone = {
  KEY: 'key',
  ACTION: 'action',
  NUMBER: 'number',
  COMMENT: 'comment',
} as const
export type TCodeTone = (typeof ECodeTone)[keyof typeof ECodeTone]

/** One highlighted token within a YAML line. A token without `tone` renders as plain text. */
export interface ICodeToken {
  text: string
  tone?: TCodeTone
}

export type TCodeLine = readonly ICodeToken[]

export interface ICiWorkflowSnippet {
  action: TCiWorkflowAction
  lines: readonly TCodeLine[]
  /** GitHub repo for this action, linked from the dashboard activation guide. */
  repoUrl: string
}

const AUDIT_LINES: readonly TCodeLine[] = [
  [{ text: 'permissions:', tone: ECodeTone.KEY }],
  [{ text: '  id-token:', tone: ECodeTone.KEY }, { text: ' write' }],
  [{ text: 'steps:', tone: ECodeTone.KEY }],
  [
    { text: '  - uses:', tone: ECodeTone.KEY },
    { text: ' ' },
    { text: 'isreadyai/audit-action@v1', tone: ECodeTone.ACTION },
  ],
  [{ text: '    with:', tone: ECodeTone.KEY }],
  [
    { text: '      url:', tone: ECodeTone.KEY },
    { text: ' ${{ env.DEPLOY_URL }}' },
    { text: ' ' },
    { text: '# define DEPLOY_URL yourself, e.g. env: DEPLOY_URL: https://yoursite.com', tone: ECodeTone.COMMENT },
  ],
  [
    { text: '      threshold:', tone: ECodeTone.KEY },
    { text: ' ' },
    { text: '80', tone: ECodeTone.NUMBER },
  ],
  [
    { text: '      api-key:', tone: ECodeTone.KEY },
    { text: ' ' },
    { text: '${{ secrets.ISREADYAI_API_KEY }}' },
    { text: ' ' },
    { text: '# optional — report upload + repo badge (Pro/Team)', tone: ECodeTone.COMMENT },
  ],
]

const FIX_LINES: readonly TCodeLine[] = [
  [{ text: 'permissions:', tone: ECodeTone.KEY }],
  [{ text: '  contents:', tone: ECodeTone.KEY }, { text: ' write' }],
  [{ text: '  pull-requests:', tone: ECodeTone.KEY }, { text: ' write' }],
  [
    { text: '  id-token:', tone: ECodeTone.KEY },
    { text: ' write' },
    { text: ' ' },
    { text: '# uploads the CI report + repo badge', tone: ECodeTone.COMMENT },
  ],
  [{ text: 'steps:', tone: ECodeTone.KEY }],
  [
    { text: '  - uses:', tone: ECodeTone.KEY },
    { text: ' ' },
    { text: 'actions/checkout@v7', tone: ECodeTone.ACTION },
  ],
  [
    { text: '  - uses:', tone: ECodeTone.KEY },
    { text: ' ' },
    { text: 'isreadyai/fix-action@v1', tone: ECodeTone.ACTION },
  ],
  [{ text: '    with:', tone: ECodeTone.KEY }],
  [
    { text: '      url:', tone: ECodeTone.KEY },
    { text: ' ${{ env.DEPLOY_URL }}' },
    { text: ' ' },
    { text: '# define DEPLOY_URL yourself, e.g. env: DEPLOY_URL: https://yoursite.com', tone: ECodeTone.COMMENT },
  ],
  [
    { text: '      api-key:', tone: ECodeTone.KEY },
    { text: ' ' },
    { text: '${{ secrets.ISREADYAI_API_KEY }}' },
  ],
]

export const CI_WORKFLOW_SNIPPETS: Record<TCiWorkflowAction, ICiWorkflowSnippet> = {
  [ECiWorkflowAction.AUDIT]: {
    action: ECiWorkflowAction.AUDIT,
    lines: AUDIT_LINES,
    repoUrl: 'https://github.com/isreadyai/audit-action',
  },
  [ECiWorkflowAction.FIX]: {
    action: ECiWorkflowAction.FIX,
    lines: FIX_LINES,
    repoUrl: 'https://github.com/isreadyai/fix-action',
  },
}

/** Plain-text YAML for clipboard copy, derived from the same tokens as the highlighted rendering. */
export function ciWorkflowYaml(snippet: ICiWorkflowSnippet): string {
  return snippet.lines.map((line) => line.map((token) => token.text).join('')).join('\n')
}
