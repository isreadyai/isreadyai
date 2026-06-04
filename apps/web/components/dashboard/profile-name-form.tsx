'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { TextInput } from '@/components/ui/text-input'
import { notify } from '@/components/ui/toast'
import { createBrowserSupabaseClient } from '@/lib/supabase/client'

/** Form to update display name via Supabase auth metadata. */
export function ProfileNameForm({ initialName }: { initialName: string }) {
  const t = useTranslations('dashboard')
  const router = useRouter()
  const [name, setName] = useState(initialName)
  const [busy, setBusy] = useState(false)

  async function save(): Promise<void> {
    setBusy(true)
    try {
      const supabase = createBrowserSupabaseClient()
      const { error } = await supabase.auth.updateUser({ data: { display_name: name.trim() } })
      if (error !== null) {
        notify.error(t('profileSaveError'))
      } else {
        notify.success(t('profileSaved'))
        router.refresh()
      }
    } catch {
      notify.error(t('profileSaveError'))
    }
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <TextInput
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder={t('displayNamePlaceholder')}
        aria-label={t('displayNameLabel')}
      />
      <Button variant="primary" onPress={() => void save()} isDisabled={busy} className="shrink-0">
        {busy ? t('saving') : t('save')}
      </Button>
    </div>
  )
}
