'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { clearChecklistStatus, setChecklistStatus, type ChecklistErrorCode } from '../checklist-actions'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Button } from '@/components/dashboard/button'
import { Field, Label, FieldError, controlClass } from '@/components/dashboard/form'
import { formatDateTime } from '@/lib/format-date-time'
import type { Database } from '@/lib/supabase/database.types'

type ChecklistState = Database['public']['Enums']['checklist_state']

export type ChecklistItem = {
  item_id: string
  name: string
  is_required: boolean
  state: ChecklistState | null
  note: string | null
  // null when nothing is linked; the filename is null when a linked
  // document is no longer visible on this case (deleted since).
  document_id: string | null
  document_filename: string | null
  noted_at: string | null
  noted_by_name: string | null
}

// Counts come from the database (head-count queries on the view), required
// items only - optional items never enter the "x of y" figure.
export type ChecklistCounts = { requiredTotal: number; requiredProvided: number; requiredNotApplicable: number }

// A document that can be linked: on this case and not deleted - the same
// rule the checklist_document_on_case trigger enforces, applied to the
// list the Documents section already renders rather than a second query.
export type LinkableDocument = { id: string; filename: string }

const ERROR_CODES: ChecklistErrorCode[] = ['invalidState', 'documentNotOnCase', 'noPermission', 'saveFailed', 'clearFailed']

// The case's document checklist, derived from its case type's template.
// The page doesn't render this at all when the type has no items. Rows
// arrive in the query's order (outstanding first, required before
// optional, then the template order); nothing is re-sorted here.
export function ChecklistSection({
  caseId,
  items,
  counts,
  documents,
  canWrite,
}: {
  caseId: string
  items: ChecklistItem[]
  counts: ChecklistCounts
  documents: LinkableDocument[]
  canWrite: boolean
}) {
  const t = useTranslations('dashboard.cases.detail.checklist')

  return (
    <Panel className="flex flex-col gap-3" data-testid="case-checklist-section">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>
        {counts.requiredTotal > 0 && (
          <p className="text-sm text-fg-muted" data-testid="checklist-count">
            {t('requiredCount', { provided: counts.requiredProvided, total: counts.requiredTotal })}
            {counts.requiredNotApplicable > 0 && (
              <> · {t('requiredNotApplicable', { count: counts.requiredNotApplicable })}</>
            )}
          </p>
        )}
      </div>

      <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
        {items.map((item) => (
          <ChecklistRow key={item.item_id} caseId={caseId} item={item} documents={documents} canWrite={canWrite} />
        ))}
      </ul>
    </Panel>
  )
}

function ChecklistRow({
  caseId,
  item,
  documents,
  canWrite,
}: {
  caseId: string
  item: ChecklistItem
  documents: LinkableDocument[]
  canWrite: boolean
}) {
  const t = useTranslations('dashboard.cases.detail.checklist')
  const tErrors = useTranslations('dashboard.cases.detail.checklist.errors')
  const locale = useLocale()
  const formRef = useRef<HTMLFormElement>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const outstanding = item.state === null

  function resolve(code: ChecklistErrorCode, fallback: ChecklistErrorCode) {
    return tErrors(ERROR_CODES.includes(code) ? code : fallback)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await setChecklistStatus(caseId, item.item_id, formData)
      if (result.error) {
        setError(resolve(result.error, 'saveFailed'))
        return
      }
      setEditing(false)
    })
  }

  function handleClear() {
    setError(null)
    startTransition(async () => {
      const result = await clearChecklistStatus(caseId, item.item_id)
      if (result.error) setError(resolve(result.error, 'clearFailed'))
    })
  }

  return (
    <li
      className={`flex flex-col gap-2 px-3 py-3 text-sm ${outstanding ? '' : 'bg-line/20'}`}
      data-testid="checklist-item"
      data-state={item.state ?? 'outstanding'}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="flex flex-wrap items-center gap-2">
          <span className={outstanding ? 'font-medium text-fg' : 'text-fg-muted'}>{item.name}</span>
          <Badge variant={item.is_required ? 'neutral' : 'muted'}>
            {item.is_required ? t('required') : t('optional')}
          </Badge>
        </span>
        <Badge variant={outstanding ? 'accent' : 'muted'} data-testid="checklist-item-state">
          {t(`state.${item.state ?? 'outstanding'}`)}
        </Badge>
      </div>

      {!outstanding && (
        <div className="flex flex-col gap-0.5 text-xs text-fg-muted">
          {item.document_id && (
            <p>
              {item.document_filename
                ? t.rich('linkedDocument', { name: item.document_filename, bdi: (chunks) => <bdi>{chunks}</bdi> })
                : t('linkedDocumentUnavailable')}
            </p>
          )}
          {item.note && <p className="whitespace-pre-wrap text-fg">{item.note}</p>}
          {item.noted_at && (
            <p>
              {item.noted_by_name
                ? t.rich('notedBy', {
                    name: item.noted_by_name,
                    date: formatDateTime(item.noted_at, locale),
                    bdi: (chunks) => <bdi>{chunks}</bdi>,
                  })
                : t.rich('notedOn', { date: formatDateTime(item.noted_at, locale), bdi: (chunks) => <bdi>{chunks}</bdi> })}
            </p>
          )}
        </div>
      )}

      {/* Controls only for someone the status table's write policy
          (can_write_case_documents) accepts; otherwise read-only. */}
      {canWrite &&
        (editing ? (
          <form ref={formRef} onSubmit={handleSave} className="flex flex-col gap-2" data-testid="checklist-item-form">
            <fieldset className="flex flex-wrap gap-4">
              <legend className="sr-only">{t('stateLabel')}</legend>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="state" value="provided" defaultChecked={item.state !== 'not_applicable'} />
                {t('state.provided')}
              </label>
              <label className="flex items-center gap-1.5">
                <input type="radio" name="state" value="not_applicable" defaultChecked={item.state === 'not_applicable'} />
                {t('state.not_applicable')}
              </label>
            </fieldset>
            <Field>
              <Label htmlFor={`checklist-doc-${item.item_id}`}>{t('documentLabel')}</Label>
              <select
                id={`checklist-doc-${item.item_id}`}
                name="document_id"
                defaultValue={item.document_filename ? (item.document_id ?? '') : ''}
                className={controlClass}
                data-testid="checklist-item-document"
              >
                <option value="">{t('noDocument')}</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.filename}
                  </option>
                ))}
              </select>
            </Field>
            <Field>
              <Label htmlFor={`checklist-note-${item.item_id}`}>{t('noteLabel')}</Label>
              <textarea
                id={`checklist-note-${item.item_id}`}
                name="note"
                rows={2}
                defaultValue={item.note ?? ''}
                className={controlClass}
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="primary" disabled={isPending} data-testid="checklist-item-save">
                {isPending ? t('saving') : t('save')}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setEditing(false)} disabled={isPending}>
                {t('cancel')}
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => setEditing(true)}
              disabled={isPending}
              data-testid="checklist-item-edit"
            >
              {outstanding ? t('record') : t('edit')}
            </Button>
            {!outstanding && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleClear}
                disabled={isPending}
                data-testid="checklist-item-clear"
              >
                {t('clear')}
              </Button>
            )}
          </div>
        ))}

      {error && <FieldError>{error}</FieldError>}
    </li>
  )
}
