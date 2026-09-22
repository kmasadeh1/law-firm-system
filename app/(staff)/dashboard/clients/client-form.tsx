'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { createClientRecord, updateClientRecord, type ConflictMatch } from './actions'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { Button } from '@/components/dashboard/button'
import { ConflictWarning } from '@/components/dashboard/conflict-warning'

type ClientRow = {
  id: string
  full_name: string
  national_id: string | null
  phone: string | null
  email: string | null
  notes: string | null
}

type Props =
  | { mode: 'create' }
  | { mode: 'edit'; client: ClientRow }

// Only two outcomes here (unlike the case-detail opposing-parties flow's
// three) - this form has no "current case" to compare a matched opposing
// party against, so same-case vs other-case isn't a distinction it can
// draw.
function matchLabel(match: ConflictMatch, t: ReturnType<typeof useTranslations>) {
  const bdi = (chunks: React.ReactNode) => <bdi>{chunks}</bdi>
  return match.source === 'opposing_party'
    ? t.rich('matchExistingOpposingParty', { name: match.matched_name, bdi })
    : t.rich('matchExistingClient', { name: match.matched_name, bdi })
}

export function ClientForm(props: Props) {
  const router = useRouter()
  const t = useTranslations('dashboard.clients.form')
  const formRef = useRef<HTMLFormElement>(null)

  const [matches, setMatches] = useState<ConflictMatch[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const initial =
    props.mode === 'edit'
      ? props.client
      : { full_name: '', national_id: '', phone: '', email: '', notes: '' }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(formRef.current!)

    startTransition(async () => {
      if (props.mode === 'create') {
        const result = await createClientRecord(formData, false)
        if (result.error) {
          setError(result.error)
          return
        }
        if (result.matches) {
          setMatches(result.matches)
          return
        }
        if (result.clientId) {
          router.push(`/dashboard/clients/${result.clientId}`)
        }
      } else {
        const result = await updateClientRecord(props.client.id, formData)
        if (result.error) {
          setError(result.error)
          return
        }
        setSaved(true)
      }
    })
  }

  function handleConfirmAnyway() {
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await createClientRecord(formData, true)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.clientId) {
        router.push(`/dashboard/clients/${result.clientId}`)
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field>
        <Label htmlFor="full_name" required>
          {t('fullNameLabel')}
        </Label>
        <input
          id="full_name"
          name="full_name"
          required
          defaultValue={initial.full_name}
          className={controlClass}
        />
      </Field>
      <Field>
        <Label htmlFor="national_id">{t('nationalIdLabel')}</Label>
        <input id="national_id" name="national_id" defaultValue={initial.national_id ?? ''} className={controlClass} />
      </Field>
      <Field>
        <Label htmlFor="phone">{t('phoneLabel')}</Label>
        <input id="phone" name="phone" type="tel" defaultValue={initial.phone ?? ''} className={controlClass} />
      </Field>
      <Field>
        <Label htmlFor="email">{t('emailLabel')}</Label>
        <input id="email" name="email" type="email" defaultValue={initial.email ?? ''} className={controlClass} />
      </Field>
      <Field>
        <Label htmlFor="notes">{t('notesLabel')}</Label>
        <textarea id="notes" name="notes" rows={3} defaultValue={initial.notes ?? ''} className={controlClass} />
      </Field>

      {matches && matches.length > 0 && (
        <ConflictWarning
          labels={matches.map((m) => matchLabel(m, t))}
          onConfirm={handleConfirmAnyway}
          onEdit={() => setMatches(null)}
          pending={isPending}
        />
      )}

      {error && <FieldError>{error}</FieldError>}

      {!matches && (
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending
              ? props.mode === 'create'
                ? t('checking')
                : t('saving')
              : props.mode === 'create'
                ? t('createClient')
                : t('saveChanges')}
          </Button>
          {saved && <FieldSuccess>{t('saved')}</FieldSuccess>}
        </div>
      )}
    </form>
  )
}
