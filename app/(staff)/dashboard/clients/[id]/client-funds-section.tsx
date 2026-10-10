'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  createClientFundEntry,
  createReversalEntry,
  type ClientFundDirection,
  type ClientFundEntryType,
  type ClientFundErrorCode,
  type RecordableClientFundEntryType,
} from '../funds-actions'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Button } from '@/components/dashboard/button'
import { Field, Label, FieldError, controlClass } from '@/components/dashboard/form'
import { formatAmount } from '@/lib/format-money'
import { formatDate, todayInFirmZone } from '@/lib/format-date-time'
import { FreeText } from '@/components/free-text'

export type CaseOption = { id: string; case_number: string; title: string }

export type FundBalance = {
  balance_held: number | null
  total_in: number | null
  total_out: number | null
  last_movement_on: string | null
  entry_count: number | null
}

export type FundEntry = {
  id: string
  entry_type: ClientFundEntryType
  direction: ClientFundDirection
  amount: number
  occurred_on: string
  method: string | null
  reference: string | null
  description: string | null
  case_id: string | null
  case_number: string | null
  case_title: string | null
  reverses_entry_id: string | null
  reverses: { id: string; occurred_on: string; amount: number } | null
  reversed_by: { id: string; occurred_on: string; amount: number } | null
}

const RECORDABLE_ENTRY_TYPES: RecordableClientFundEntryType[] = ['deposit', 'disbursement', 'fee_transfer', 'refund']

// Closed set the server can return - anything else falls back to a generic
// translated message rather than passing an arbitrary value to t() as a key.
const FUND_ERROR_CODES: ClientFundErrorCode[] = [
  'typeRequired',
  'invalidAmount',
  'amountNotPositive',
  'directionMismatch',
  'paymentOnlyOnTransfer',
  'reversalNeedsTarget',
  'caseMismatch',
  'insufficientBalance',
  'reversalTargetNotFound',
  'noPermission',
  'addFailed',
]

function resolveError(code: ClientFundErrorCode, tErrors: ReturnType<typeof useTranslations>) {
  return (FUND_ERROR_CODES as string[]).includes(code) ? tErrors(code) : tErrors('generic')
}

function CaseSelect({ id, cases, defaultValue }: { id: string; cases: CaseOption[]; defaultValue?: string }) {
  const t = useTranslations('dashboard.clients.detail.funds')
  return (
    <select id={id} name="case_id" defaultValue={defaultValue ?? ''} className={controlClass}>
      <option value="">{t('generalCaseOption')}</option>
      {cases.map((c) => (
        <option key={c.id} value={c.id}>
          {c.case_number} — {c.title}
        </option>
      ))}
    </select>
  )
}

function EntryRow({ clientId, entry, cases }: { clientId: string; entry: FundEntry; cases: CaseOption[] }) {
  const locale = useLocale()
  const t = useTranslations('dashboard.clients.detail.funds')
  const tType = useTranslations('dashboard.clients.detail.funds.type')
  const tErrors = useTranslations('dashboard.clients.detail.funds.errors')
  const [reversing, setReversing] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleReverse(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await createReversalEntry(clientId, entry.id, formData)
      if (result.error) {
        setError(resolveError(result.error, tErrors))
        return
      }
      setReversing(false)
    })
  }

  return (
    <li className="flex flex-col gap-2 px-3 py-3 text-sm" data-testid={`fund-entry-${entry.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-fg">{formatDate(entry.occurred_on, locale)}</span>
        <Badge variant={entry.direction === 'in' ? 'accent' : 'neutral'}>{tType(entry.entry_type)}</Badge>
        <span className={entry.direction === 'in' ? 'text-success-text' : 'text-fg'}>
          {entry.direction === 'in' ? '+' : '−'}
          {formatAmount(entry.amount, locale)}
        </span>
        {entry.case_id && (
          <span className="text-fg-muted">
            <bdi>{entry.case_number}</bdi> — <bdi>{entry.case_title}</bdi>
          </span>
        )}
      </div>
      {(entry.method || entry.reference) && (
        <div className="flex flex-wrap gap-3 text-xs text-fg-muted">
          {entry.method && (
            <span>
              {t.rich('methodLine', { method: entry.method, bdi: (chunks) => <bdi>{chunks}</bdi> })}
            </span>
          )}
          {entry.reference && (
            <span>
              {t('referenceLabel')}: <span dir="ltr">{entry.reference}</span>
            </span>
          )}
        </div>
      )}
      {entry.description && <FreeText as="p" className="text-fg-muted">{entry.description}</FreeText>}

      {entry.reverses && (
        <p className="text-xs text-fg-muted">
          {t.rich('reversesEntryNote', {
            date: formatDate(entry.reverses.occurred_on, locale),
            amount: formatAmount(entry.reverses.amount, locale),
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </p>
      )}
      {entry.reversed_by && (
        <p className="text-xs text-fg-muted">
          {t.rich('reversedByNote', {
            date: formatDate(entry.reversed_by.occurred_on, locale),
            amount: formatAmount(entry.reversed_by.amount, locale),
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </p>
      )}

      {reversing ? (
        <form ref={formRef} onSubmit={handleReverse} className="flex flex-col gap-3 rounded-md border border-line p-3">
          <div className="flex flex-wrap gap-3">
            <Field>
              <Label htmlFor={`rev-amount-${entry.id}`} required>
                {t('amountLabel')}
              </Label>
              <input
                id={`rev-amount-${entry.id}`}
                name="amount"
                type="number"
                step="0.01"
                min="0.01"
                required
                defaultValue={entry.amount}
                className={controlClass}
              />
            </Field>
            <Field>
              <Label htmlFor={`rev-date-${entry.id}`}>{t('occurredOnLabel')}</Label>
              <input id={`rev-date-${entry.id}`} name="occurred_on" type="date" defaultValue={todayInFirmZone()} className={controlClass} />
            </Field>
            <Field>
              <Label htmlFor={`rev-case-${entry.id}`}>{t('caseLabel')}</Label>
              <CaseSelect id={`rev-case-${entry.id}`} cases={cases} defaultValue={entry.case_id ?? ''} />
            </Field>
          </div>
          <div className="flex flex-wrap gap-3">
            <Field>
              <Label htmlFor={`rev-method-${entry.id}`}>{t('methodLabel')}</Label>
              <input id={`rev-method-${entry.id}`} name="method" defaultValue={entry.method ?? ''} className={controlClass} />
            </Field>
            <Field>
              <Label htmlFor={`rev-reference-${entry.id}`}>{t('referenceLabel')}</Label>
              <input
                id={`rev-reference-${entry.id}`}
                name="reference"
                dir="ltr"
                defaultValue={entry.reference ?? ''}
                className={controlClass}
              />
            </Field>
          </div>
          <Field>
            <Label htmlFor={`rev-description-${entry.id}`}>{t('descriptionLabel')}</Label>
            <textarea id={`rev-description-${entry.id}`} name="description" rows={2} className={controlClass} />
          </Field>
          {error && <FieldError>{error}</FieldError>}
          <div className="flex items-center gap-3">
            <Button type="submit" variant="danger" disabled={isPending} data-testid="fund-confirm-reverse">
              {isPending ? t('reversing') : t('confirmReverse')}
            </Button>
            <Button type="button" variant="ghost" disabled={isPending} onClick={() => setReversing(false)}>
              {t('cancel')}
            </Button>
          </div>
        </form>
      ) : (
        <Button
          type="button"
          variant="ghost"
          className="self-start"
          onClick={() => setReversing(true)}
          data-testid="fund-reverse-button"
        >
          {t('reverse')}
        </Button>
      )}
    </li>
  )
}

export function ClientFundsSection({
  clientId,
  balance,
  entries,
  cases,
}: {
  clientId: string
  balance: FundBalance | null
  entries: FundEntry[]
  cases: CaseOption[]
}) {
  const locale = useLocale()
  const t = useTranslations('dashboard.clients.detail.funds')
  const tType = useTranslations('dashboard.clients.detail.funds.type')
  const tErrors = useTranslations('dashboard.clients.detail.funds.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await createClientFundEntry(clientId, formData)
      if (result.error) {
        setError(resolveError(result.error, tErrors))
        return
      }
      formRef.current?.reset()
    })
  }

  return (
    <Panel className="flex flex-col gap-3" data-testid="client-funds-section">
      <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>
      <p className="text-xs text-fg-muted">{t('notFeeMoneyNote')}</p>

      <div className="flex flex-wrap gap-2">
        <Badge variant={(balance?.balance_held ?? 0) > 0 ? 'accent' : 'muted'}>
          {t.rich('balanceHeld', { amount: formatAmount(balance?.balance_held ?? 0, locale), bdi: (chunks) => <bdi>{chunks}</bdi> })}
        </Badge>
        <Badge variant="neutral">
          {t.rich('totalIn', { amount: formatAmount(balance?.total_in ?? 0, locale), bdi: (chunks) => <bdi>{chunks}</bdi> })}
        </Badge>
        <Badge variant="neutral">
          {t.rich('totalOut', { amount: formatAmount(balance?.total_out ?? 0, locale), bdi: (chunks) => <bdi>{chunks}</bdi> })}
        </Badge>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noneYet')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {entries.map((entry) => (
            <EntryRow key={entry.id} clientId={clientId} entry={entry} cases={cases} />
          ))}
        </ul>
      )}

      <form ref={formRef} onSubmit={handleAdd} className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-fg">{t('recordHeading')}</h3>
        <div className="flex flex-wrap gap-3">
          <Field>
            <Label htmlFor="new-fund-type" required>
              {t('typeLabel')}
            </Label>
            <select id="new-fund-type" name="entry_type" required defaultValue="" className={controlClass}>
              <option value="" disabled>
                {t('selectTypePlaceholder')}
              </option>
              {RECORDABLE_ENTRY_TYPES.map((type) => (
                <option key={type} value={type}>
                  {tType(type)}
                </option>
              ))}
            </select>
          </Field>
          <Field>
            <Label htmlFor="new-fund-amount" required>
              {t('amountLabel')}
            </Label>
            <input id="new-fund-amount" name="amount" type="number" step="0.01" min="0.01" required className={controlClass} />
          </Field>
          <Field>
            <Label htmlFor="new-fund-date">{t('occurredOnLabel')}</Label>
            <input id="new-fund-date" name="occurred_on" type="date" defaultValue={todayInFirmZone()} className={controlClass} />
          </Field>
        </div>
        <div className="flex flex-wrap gap-3">
          <Field>
            <Label htmlFor="new-fund-case">{t('caseLabel')}</Label>
            <CaseSelect id="new-fund-case" cases={cases} />
          </Field>
          <Field>
            <Label htmlFor="new-fund-method">{t('methodLabel')}</Label>
            <input id="new-fund-method" name="method" className={controlClass} />
          </Field>
          <Field>
            <Label htmlFor="new-fund-reference">{t('referenceLabel')}</Label>
            <input id="new-fund-reference" name="reference" dir="ltr" className={controlClass} />
          </Field>
        </div>
        <Field>
          <Label htmlFor="new-fund-description">{t('descriptionLabel')}</Label>
          <textarea id="new-fund-description" name="description" rows={2} className={controlClass} />
        </Field>
        {error && <FieldError>{error}</FieldError>}
        <Button type="submit" variant="primary" data-testid="fund-entry-add-button" disabled={isPending} className="self-start">
          {isPending ? t('adding') : t('add')}
        </Button>
      </form>
    </Panel>
  )
}
