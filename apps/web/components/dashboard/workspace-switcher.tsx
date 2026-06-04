'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useTransition } from 'react'
import { notify } from '@/components/ui/toast'
import { setActiveWorkspace } from '@/lib/actions/workspace'
import type { IWorkspaceOption } from '@/lib/workspace'

// MARK: - Active workspace switcher (sidebar footer, above the account chip)
//
// Only rendered when the user belongs to more than their own personal
// workspace — i.e. they're in a team. It mirrors the account chip (no avatar):
// PERSONAL is tinted primary, TEAM secondary, and a tap cycles to the next
// workspace (a clean toggle for the common personal+team pair).

/** Active workspace switcher; cycles through user's workspaces. */
export function WorkspaceSwitcher({
  workspaces,
  activeId,
}: {
  workspaces: IWorkspaceOption[]
  activeId: string | null
}) {
  const t = useTranslations('admin')
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  // A single workspace means the user isn't in a team: no switcher at all.
  if (workspaces.length <= 1) {
    return null
  }

  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0]
  if (active === undefined) {
    return null
  }
  const current = active
  const isTeam = current.kind === 'team'

  function onCycle(): void {
    const index = workspaces.findIndex((w) => w.id === current.id)
    const next = workspaces[(index + 1) % workspaces.length]
    if (pending || next === undefined || next.id === current.id) {
      return
    }
    startTransition(async () => {
      const result = await setActiveWorkspace(next.id)
      if (result.ok) {
        router.refresh()
      } else {
        notify.error(t('workspaceSwitchError'))
      }
    })
  }

  return (
    <button
      type="button"
      onClick={onCycle}
      disabled={pending}
      aria-label={t('workspaceSwitch')}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left transition-colors disabled:opacity-60 ${
        isTeam
          ? 'border-site-secondary/40 hover:border-site-secondary'
          : 'border-site-accent/40 hover:border-site-accent'
      }`}
    >
      <span
        className={`size-2 shrink-0 rounded-full ${isTeam ? 'bg-site-secondary' : 'bg-site-accent'}`}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1">
        <span
          className={`block text-xs font-semibold tracking-wide uppercase ${isTeam ? 'text-site-secondary' : 'text-site-accent'}`}
        >
          {current.kind}
        </span>
        <span className="text-site-muted block truncate text-xs">
          {current.email !== '' ? current.email : current.name}
        </span>
      </span>
      <SwitchIcon />
    </button>
  )
}

function SwitchIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      className="text-site-muted size-3.5 shrink-0"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M5 6l-2.5 2L5 10M11 6l2.5 2L11 10M2.5 8h11"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
