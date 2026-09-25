'use client'

import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { addOpposingParty, type ConflictMatch, type OpposingPartyErrorCode } from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { FieldError, controlClass } from '@/components/dashboard/form'
import { ConflictWarning } from '@/components/dashboard/conflict-warning'

type OpposingParty = { id: string; name: string; national_id: string | null }

// Closed set the server can return - anything else falls back to a generic
// translated message rather than passing an arbitrary value to t() as a key.
const OPPOSING_PARTY_ERROR_CODES: OpposingPartyErrorCode[] = [
  'name_required',
  'conflict_check_failed',
  'add_failed',
]

// Each distinct conflict-check outcome is its own complete message, not a
// fragment glued to the matched name - "already an opposing party on this
// case" and "existing client" are different sentences in Arabic, not the
// same template with a swapped-in word.
//
// t.rich() with a <bdi>-wrapped name, now that ConflictWarning types
// `labels` as ReactNode[] (batch 4) rather than string[] (the constraint
// that forced plain t() here in batch 3d).
const bdi = (chunks: React.ReactNode) => <bdi>{chunks}</bdi>

function matchLabel(
  match: ConflictMatch,
  currentCaseId: string,
  t: ReturnType<typeof useTranslations>
) {
  // matchSameCase/matchOtherCase are held (English) pending the firm's term
  // for "opposing party" - the surrounding sentence, not just the
  // interpolated name, needs its own outer <bdi> so its trailing
  // punctuation doesn't reorder under the page's RTL base direction.
  // matchExistingClient is already translated Arabic and needs none.
  if (match.source === 'opposing_party') {
    return match.case_id === currentCaseId ? (
      <bdi>{t.rich('matchSameCase', { name: match.matched_name, bdi })}</bdi>
    ) : (
      <bdi>{t.rich('matchOtherCase', { name: match.matched_name, bdi })}</bdi>
    )
  }
  return t.rich('matchExistingClient', { name: match.matched_name, bdi })
}

export function OpposingPartiesSection({
  caseId,
  parties,
}: {
  caseId: string
  parties: OpposingParty[]
}) {
  const t = useTranslations('dashboard.cases.detail.opposingParties')
  const tErrors = useTranslations('dashboard.cases.detail.opposingParties.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [matches, setMatches] = useState<ConflictMatch[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resolveError(code: OpposingPartyErrorCode) {
    return (OPPOSING_PARTY_ERROR_CODES as string[]).includes(code) ? tErrors(code) : tErrors('generic')
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)

    startTransition(async () => {
      const result = await addOpposingParty(caseId, formData, false)
      if (result.error) {
        setError(resolveError(result.error))
        return
      }
      if (result.matches) {
        setMatches(result.matches)
        return
      }
      formRef.current?.reset()
      setMatches(null)
    })
  }

  function handleConfirmAnyway() {
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await addOpposingParty(caseId, formData, true)
      if (result.error) {
        setError(resolveError(result.error))
        return
      }
      formRef.current?.reset()
      setMatches(null)
    })
  }

  return (
    <Panel className="flex flex-col gap-3" data-testid="case-opposing-parties-section">
      <h2 className="font-heading text-lg text-fg">
        <bdi>{t('heading')}</bdi>
      </h2>

      {parties.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noneAddedYet')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {parties.map((p) => (
            <li key={p.id} className="px-3 py-2 text-sm text-fg">
              <bdi>{p.name}</bdi>
              {p.national_id && <span className="text-fg-muted"> · <bdi>{p.national_id}</bdi></span>}
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="op-name" className="text-sm text-fg-muted">
            {t('nameLabel')}
          </label>
          <input id="op-name" name="name" required className={controlClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="op-national-id" className="text-sm text-fg-muted">
            {t('nationalIdLabel')}
          </label>
          <input id="op-national-id" name="national_id" className={controlClass} />
        </div>
        {!matches && (
          <Button type="submit" variant="secondary" data-testid="opposing-party-add-button" disabled={isPending}>
            {isPending ? t('checking') : t('add')}
          </Button>
        )}
      </form>

      {matches && matches.length > 0 && (
        <ConflictWarning
          labels={matches.map((m) => matchLabel(m, caseId, t))}
          onConfirm={handleConfirmAnyway}
          onEdit={() => setMatches(null)}
          pending={isPending}
          confirmLabel={t('addAnyway')}
        />
      )}

      {error && (
        <FieldError>
          <bdi>{error}</bdi>
        </FieldError>
      )}
    </Panel>
  )
}
