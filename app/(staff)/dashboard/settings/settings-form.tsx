'use client'

import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { updateOwnProfile } from './actions'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { Button } from '@/components/dashboard/button'

type Profile = { full_name: string; phone: string | null }

export function SettingsForm({ profile }: { profile: Profile }) {
  const t = useTranslations('dashboard.settings.profile')
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await updateOwnProfile(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setSaved(true)
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-3">
        <Field>
          <Label htmlFor="settings-full-name" required>
            {t('fullNameLabel')}
          </Label>
          <input
            id="settings-full-name"
            name="full_name"
            defaultValue={profile.full_name}
            onChange={() => setSaved(false)}
            className={controlClass}
          />
        </Field>
        <Field>
          <Label htmlFor="settings-phone">{t('phoneLabel')}</Label>
          <input
            id="settings-phone"
            name="phone"
            type="tel"
            dir="ltr"
            defaultValue={profile.phone ?? ''}
            onChange={() => setSaved(false)}
            className={controlClass}
          />
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? t('saving') : t('save')}
        </Button>
        {saved && <FieldSuccess>{t('saved')}</FieldSuccess>}
      </div>
      {error && <FieldError>{error}</FieldError>}
    </form>
  )
}
