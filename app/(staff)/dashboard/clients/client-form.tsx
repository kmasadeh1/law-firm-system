'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { createClientRecord, updateClientRecord, type ConflictMatch } from './actions'
import { Field, Label, FieldError, FieldSuccess, HelpText, controlClass } from '@/components/dashboard/form'
import type { ReferralSourceOption } from './referral-source-options'
import { Button } from '@/components/dashboard/button'
import { ConflictWarning } from '@/components/dashboard/conflict-warning'
import { FreeText } from '@/components/free-text'

type ClientRow = {
  id: string
  full_name: string
  national_id: string | null
  phone: string | null
  email: string | null
  notes: string | null
  referral_source_id: string | null
  referral_notes: string | null
}

// referralSources: active sources, plus (edit only) the client's current
// one if it has since been deactivated - built server-side by
// referralSourceOptions(). Labels are the database's names, localized.
type Props =
  | { mode: 'create'; referralSources: ReferralSourceOption[] }
  | { mode: 'edit'; client: ClientRow; canManage: boolean; referralSources: ReferralSourceOption[] }

// Only two outcomes here (unlike the case-detail opposing-parties flow's
// three) - this form has no "current case" to compare a matched opposing
// party against, so same-case vs other-case isn't a distinction it can
// draw.
function matchLabel(match: ConflictMatch, t: ReturnType<typeof useTranslations>) {
  const bdi = (chunks: React.ReactNode) => <bdi>{chunks}</bdi>
  // matchExistingOpposingParty is held (English) pending the firm's term
  // for "opposing party" - the whole sentence needs its own outer <bdi>,
  // not just the interpolated name. matchExistingClient is already
  // translated Arabic and needs none.
  return match.source === 'opposing_party' ? (
    <bdi>{t.rich('matchExistingOpposingParty', { name: match.matched_name, bdi })}</bdi>
  ) : (
    t.rich('matchExistingClient', { name: match.matched_name, bdi })
  )
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
      : { full_name: '', national_id: '', phone: '', email: '', notes: '', referral_source_id: '', referral_notes: '' }

  function sourceLabel(option: ReferralSourceOption) {
    return option.inactive ? t('referralSourceInactive', { name: option.label }) : option.label
  }
  const currentSource = props.referralSources.find((o) => o.id === initial.referral_source_id) ?? null

  // Read is broader than write for a client - a Lawyer can reach this page
  // for a client on their own case without clients_manage. No control at
  // all here, not a disabled one: the database will refuse the write
  // regardless, so nothing offers it.
  if (props.mode === 'edit' && !props.canManage) {
    return (
      <dl className="flex flex-col gap-4">
        <div>
          <dt className="text-sm font-medium text-fg">{t('fullNameLabel')}</dt>
          <dd className="mt-1 text-sm text-fg">{initial.full_name}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-fg">{t('nationalIdLabel')}</dt>
          <dd className="mt-1 text-sm text-fg">
            <bdi>{initial.national_id || '—'}</bdi>
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-fg">{t('phoneLabel')}</dt>
          <dd className="mt-1 text-sm text-fg" dir="ltr">
            {initial.phone || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-fg">{t('emailLabel')}</dt>
          <dd className="mt-1 text-sm text-fg" dir="ltr">
            {initial.email || '—'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-fg">{t('notesLabel')}</dt>
          <FreeText as="dd" className="mt-1 whitespace-pre-wrap text-sm text-fg">{initial.notes || '—'}</FreeText>
        </div>
        <div>
          <dt className="text-sm font-medium text-fg">{t('referralSourceLabel')}</dt>
          <dd className="mt-1 text-sm text-fg" data-testid="client-referral-source">
            {currentSource ? sourceLabel(currentSource) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-fg">{t('referralNotesLabel')}</dt>
          <FreeText as="dd" className="mt-1 whitespace-pre-wrap text-sm text-fg">{initial.referral_notes || '—'}</FreeText>
        </div>
      </dl>
    )
  }

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
    <form ref={formRef} onSubmit={handleSubmit} onChange={() => setError(null)} className="flex flex-col gap-4">
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
        <input id="national_id" name="national_id" dir="ltr" defaultValue={initial.national_id ?? ''} className={controlClass} />
      </Field>
      <Field>
        <Label htmlFor="phone">{t('phoneLabel')}</Label>
        <input id="phone" name="phone" type="tel" dir="ltr" defaultValue={initial.phone ?? ''} className={controlClass} />
      </Field>
      <Field>
        <Label htmlFor="email">{t('emailLabel')}</Label>
        <input id="email" name="email" type="email" dir="ltr" defaultValue={initial.email ?? ''} className={controlClass} />
      </Field>
      <Field>
        <Label htmlFor="notes">{t('notesLabel')}</Label>
        <textarea id="notes" name="notes" rows={3} defaultValue={initial.notes ?? ''} className={controlClass} />
      </Field>
      <Field>
        <Label htmlFor="referral_source_id">{t('referralSourceLabel')}</Label>
        <select
          id="referral_source_id"
          name="referral_source_id"
          defaultValue={initial.referral_source_id ?? ''}
          className={controlClass}
          data-testid="client-referral-source-picker"
        >
          <option value="">{t('referralSourceNone')}</option>
          {props.referralSources.map((o) => (
            <option key={o.id} value={o.id}>
              {sourceLabel(o)}
            </option>
          ))}
        </select>
        {props.referralSources.length === 0 && <HelpText>{t('referralSourcesEmpty')}</HelpText>}
      </Field>
      <Field>
        <Label htmlFor="referral_notes">{t('referralNotesLabel')}</Label>
        <input
          id="referral_notes"
          name="referral_notes"
          defaultValue={initial.referral_notes ?? ''}
          placeholder={t('referralNotesPlaceholder')}
          className={controlClass}
        />
      </Field>

      {matches && matches.length > 0 && (
        <ConflictWarning
          matches={matches}
          labelFor={(m) => matchLabel(m, t)}
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
          <FieldSuccess show={saved}>{t('saved')}</FieldSuccess>
        </div>
      )}
    </form>
  )
}
