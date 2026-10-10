'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { isIdentityMatch, type ConflictMatch } from '@/lib/conflict-match'
import { Button } from './button'

/**
 * Shared warn-and-confirm UI for the conflict-check flow (clients, case
 * opposing parties): a possible-duplicate list with "create anyway" /
 * "edit details instead" actions. Match labels are resolved by the caller
 * since what counts as a good label differs slightly by context.
 *
 * labelFor returns a ReactNode so a caller can <bdi>-wrap the matched value (a name is data, isolated from the surrounding sentence
 * the same way case-detail's opposing-parties matches now are).
 */
export function ConflictWarning({
  matches,
  labelFor,
  onConfirm,
  onEdit,
  pending,
  confirmLabel,
}: {
  matches: ConflictMatch[]
  labelFor: (match: ConflictMatch) => React.ReactNode
  onConfirm: () => void
  onEdit: () => void
  pending: boolean
  confirmLabel?: string
}) {
  const t = useTranslations('dashboard.conflict')
  const hasIdentityMatch = matches.some(isIdentityMatch)

  return (
    <div
      className={
        hasIdentityMatch
          ? 'rounded-md border-2 border-danger bg-danger/10 p-4 text-sm'
          : 'rounded-md border border-accent-border/50 bg-accent-border/10 p-4 text-sm'
      }
      data-testid="conflict-warning"
    >
      <p className="font-medium text-fg">{t('possibleMatch', { count: matches.length })}</p>
      <ul className="mt-2 flex flex-col gap-2">
        {matches.map((m, i) => (
          <MatchRow key={`${m.source}-${m.matched_id}-${m.case_id ?? ''}-${i}`} match={m} label={labelFor(m)} />
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-4">
        <Button type="button" variant="primary" onClick={onConfirm} disabled={pending}>
          {pending ? t('saving') : (confirmLabel ?? t('createAnyway'))}
        </Button>
        <Button type="button" variant="ghost" onClick={onEdit} disabled={pending}>
          {t('editDetailsInstead')}
        </Button>
      </div>
    </div>
  )
}

// An identity match (same national ID) is a different kind of finding from
// a shared name, so it gets a different colour and an explicit label rather
// than only sorting first. The database decides which it is (match_on).
function MatchRow({ match, label }: { match: ConflictMatch; label: React.ReactNode }) {
  const t = useTranslations('dashboard.conflict')
  const identity = isIdentityMatch(match)

  // Opposing-party matches point at their case; client matches at the client.
  const href =
    match.source === 'opposing_party' && match.case_id
      ? `/dashboard/cases/${match.case_id}`
      : match.source === 'opposing_party'
        ? null
        : `/dashboard/clients/${match.matched_id}`

  return (
    <li
      className={
        identity
          ? 'flex flex-col gap-1 rounded-sm border border-danger bg-danger/15 px-3 py-2'
          : 'flex flex-col gap-1 rounded-sm border border-line px-3 py-2'
      }
      data-testid="conflict-match"
      data-match-on={match.match_on}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            identity
              ? 'inline-flex items-center rounded-full bg-danger px-2 py-0.5 text-xs font-semibold text-white'
              : 'inline-flex items-center rounded-full border border-line px-2 py-0.5 text-xs font-medium text-fg-muted'
          }
        >
          {t(`matchOn.${match.match_on}`)}
        </span>
        <span className={identity ? 'font-medium text-fg' : 'text-fg-muted'}>{label}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-fg-muted">
        {match.matched_national_id && (
          <span>
            {t('nationalId')}: <span dir="ltr">{match.matched_national_id}</span>
          </span>
        )}
        {match.matched_phone && (
          <span>
            {t('phone')}: <span dir="ltr">{match.matched_phone}</span>
          </span>
        )}
        {href && (
          <Link href={href} target="_blank" className="text-fg underline underline-offset-2 hover:no-underline">
            {match.source === 'opposing_party' && match.case_number
              ? t.rich('viewCase', { caseNumber: match.case_number, bdi: (c) => <bdi dir="ltr">{c}</bdi> })
              : match.source === 'opposing_party'
                ? t('viewCaseNoNumber')
                : t('viewClient')}
          </Link>
        )}
      </div>
    </li>
  )
}
