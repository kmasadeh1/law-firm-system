'use client'

import { useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import {
  deleteClientContact,
  editClientContact,
  logClientContact,
  type ContactErrorCode,
} from './contacts-actions'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Button } from '@/components/dashboard/button'
import { Field, FieldError, HelpText, Label, controlClass } from '@/components/dashboard/form'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { formatDateTime, toFirmDateTimeInput } from '@/lib/format-date-time'
import type { Database } from '@/lib/supabase/database.types'

type ContactDirection = Database['public']['Enums']['contact_direction']
type ContactChannel = Database['public']['Enums']['contact_channel']

const DIRECTIONS: ContactDirection[] = ['incoming', 'outgoing']
const CHANNELS: ContactChannel[] = ['phone', 'whatsapp', 'email', 'in_person', 'letter', 'other']

export type ContactRow = {
  id: string
  occurred_at: string
  direction: ContactDirection
  channel: ContactChannel
  summary: string
  follow_up_needed: boolean
  case_id: string | null
  case_number: string | null
  case_title: string | null
  handled_by: string | null
  handled_by_name: string | null
  edited_at: string | null
  /** can_edit_client_contact(row), straight from the query - the same
   *  function the update policy enforces. Gates Edit and Delete. */
  can_edit: boolean
}

export type ContactCaseOption = { id: string; case_number: string; title: string }
export type ContactStaffOption = { id: string; full_name: string }

// Closed set the server can return - anything else falls back to a generic
// translated message rather than passing an arbitrary value to t() as a key.
const CONTACT_ERROR_CODES: ContactErrorCode[] = [
  'summaryRequired',
  'caseMismatch',
  'invalidChoice',
  'invalidOccurredAt',
  'noPermission',
  'addFailed',
  'updateFailed',
  'deleteFailed',
]

function firstLine(text: string, maxLength = 60) {
  const line = text.split('\n')[0]!.trim()
  return line.length > maxLength ? `${line.slice(0, maxLength - 1)}…` : line
}

function ContactForm({
  idPrefix,
  cases,
  staffOptions,
  defaults,
  submitLabel,
  pendingLabel,
  onSubmit,
  onCancel,
  isPending,
  error,
}: {
  idPrefix: string
  cases: ContactCaseOption[]
  staffOptions: ContactStaffOption[]
  defaults: {
    direction: ContactDirection
    channel: ContactChannel
    occurred_at: string
    summary: string
    case_id: string
    handled_by: string
    follow_up_needed: boolean
  }
  submitLabel: string
  pendingLabel: string
  onSubmit: (formData: FormData, form: HTMLFormElement) => void
  onCancel?: () => void
  isPending: boolean
  error: string | null
}) {
  const t = useTranslations('dashboard.clients.detail.contacts')
  const tDirection = useTranslations('dashboard.clients.detail.contacts.direction')
  const tChannel = useTranslations('dashboard.clients.detail.contacts.channel')
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    onSubmit(new FormData(formRef.current!), formRef.current!)
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3" data-testid={`${idPrefix}-form`}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label htmlFor={`${idPrefix}-direction`} required>
            {t('directionLabel')}
          </Label>
          <select
            id={`${idPrefix}-direction`}
            name="direction"
            defaultValue={defaults.direction}
            className={controlClass}
          >
            {DIRECTIONS.map((d) => (
              <option key={d} value={d}>
                {tDirection(d)}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <Label htmlFor={`${idPrefix}-channel`} required>
            {t('channelLabel')}
          </Label>
          <select id={`${idPrefix}-channel`} name="channel" defaultValue={defaults.channel} className={controlClass}>
            {CHANNELS.map((c) => (
              <option key={c} value={c}>
                {tChannel(c)}
              </option>
            ))}
          </select>
        </Field>
        <Field>
          <Label htmlFor={`${idPrefix}-occurred-at`}>{t('occurredAtLabel')}</Label>
          <input
            id={`${idPrefix}-occurred-at`}
            type="datetime-local"
            name="occurred_at"
            defaultValue={defaults.occurred_at}
            className={controlClass}
          />
          {!defaults.occurred_at && <HelpText>{t('occurredAtHelp')}</HelpText>}
        </Field>
        <Field>
          <Label htmlFor={`${idPrefix}-handled-by`}>{t('handledByLabel')}</Label>
          <select
            id={`${idPrefix}-handled-by`}
            name="handled_by"
            defaultValue={defaults.handled_by}
            className={controlClass}
          >
            <option value="">{t('handledByNone')}</option>
            {staffOptions.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field>
        <Label htmlFor={`${idPrefix}-case`}>{t('caseLabel')}</Label>
        <select id={`${idPrefix}-case`} name="case_id" defaultValue={defaults.case_id} className={controlClass}>
          <option value="">{t('generalOption')}</option>
          {cases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.case_number} — {c.title}
            </option>
          ))}
        </select>
      </Field>
      <Field>
        <Label htmlFor={`${idPrefix}-summary`} required>
          {t('summaryLabel')}
        </Label>
        <textarea
          id={`${idPrefix}-summary`}
          name="summary"
          rows={3}
          defaultValue={defaults.summary}
          placeholder={t('summaryPlaceholder')}
          className={`${controlClass} resize-y`}
        />
      </Field>
      <label className="flex items-center gap-2 text-sm text-fg">
        <input type="checkbox" name="follow_up_needed" defaultChecked={defaults.follow_up_needed} />
        {t('followUpLabel')}
      </label>
      <div className="flex items-center justify-end gap-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={isPending}>
            {t('cancel')}
          </Button>
        )}
        <Button type="submit" variant="secondary" disabled={isPending} data-testid={`${idPrefix}-submit`}>
          {isPending ? pendingLabel : submitLabel}
        </Button>
      </div>
      {error && <FieldError data-testid={`${idPrefix}-error`}>{error}</FieldError>}
    </form>
  )
}

function ContactItem({
  contact,
  clientId,
  cases,
  staffOptions,
  showCase,
}: {
  contact: ContactRow
  clientId: string
  cases: ContactCaseOption[]
  staffOptions: ContactStaffOption[]
  showCase: boolean
}) {
  const t = useTranslations('dashboard.clients.detail.contacts')
  const tDirection = useTranslations('dashboard.clients.detail.contacts.direction')
  const tChannel = useTranslations('dashboard.clients.detail.contacts.channel')
  const tErrors = useTranslations('dashboard.clients.detail.contacts.errors')
  const locale = useLocale()
  const [isEditing, setIsEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function resolveError(code: ContactErrorCode) {
    return (CONTACT_ERROR_CODES as string[]).includes(code) ? tErrors(code) : tErrors('generic')
  }

  function handleSaveEdit(formData: FormData) {
    setError(null)
    startTransition(async () => {
      const result = await editClientContact(clientId, contact.id, contact.case_id, formData)
      if (result.error) {
        setError(resolveError(result.error))
        return
      }
      setIsEditing(false)
    })
  }

  function handleConfirmDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteClientContact(clientId, contact.id, contact.case_id)
      setConfirmingDelete(false)
      if (result.error) setError(resolveError(result.error))
    })
  }

  // An entry handled by someone who has since left isn't in the active
  // staff list - keep them selectable so editing doesn't silently clear it.
  const editStaffOptions =
    contact.handled_by && !staffOptions.some((s) => s.id === contact.handled_by)
      ? [{ id: contact.handled_by, full_name: contact.handled_by_name ?? '—' }, ...staffOptions]
      : staffOptions

  if (isEditing && contact.can_edit) {
    return (
      <li className="px-3 py-3" data-testid="contact-row">
        <ContactForm
          idPrefix={`contact-edit-${contact.id}`}
          cases={cases}
          staffOptions={editStaffOptions}
          defaults={{
            direction: contact.direction,
            channel: contact.channel,
            occurred_at: toFirmDateTimeInput(contact.occurred_at),
            summary: contact.summary,
            case_id: contact.case_id ?? '',
            handled_by: contact.handled_by ?? '',
            follow_up_needed: contact.follow_up_needed,
          }}
          submitLabel={t('save')}
          pendingLabel={t('saving')}
          onSubmit={handleSaveEdit}
          onCancel={() => {
            setError(null)
            setIsEditing(false)
          }}
          isPending={isPending}
          error={error}
        />
      </li>
    )
  }

  // Follow-up entries carry a thick start-edge rule plus a text badge - the
  // badge, not colour alone, is what marks them, so it survives greyscale.
  return (
    <li
      className={`flex flex-col gap-1 px-3 py-3 text-sm ${
        contact.follow_up_needed ? 'border-s-4 border-accent-border bg-line/20' : ''
      }`}
      data-testid="contact-row"
      data-follow-up={contact.follow_up_needed ? 'true' : undefined}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-fg-muted">
        <span className="font-medium text-fg">
          <bdi>{formatDateTime(contact.occurred_at, locale)}</bdi>
        </span>
        <span>·</span>
        <span>{tDirection(contact.direction)}</span>
        <span>·</span>
        <span>{tChannel(contact.channel)}</span>
        {showCase && contact.case_id && (
          <>
            <span>·</span>
            <Link href={`/dashboard/cases/${contact.case_id}`} className="underline-offset-2 hover:underline">
              <bdi>{contact.case_number ?? '—'}</bdi>
              {contact.case_title && (
                <>
                  {' '}
                  — <bdi>{contact.case_title}</bdi>
                </>
              )}
            </Link>
          </>
        )}
        {contact.handled_by_name && (
          <>
            <span>·</span>
            <span>
              {t.rich('handledByLine', {
                name: contact.handled_by_name,
                bdi: (chunks) => <bdi>{chunks}</bdi>,
              })}
            </span>
          </>
        )}
        {contact.follow_up_needed && (
          <Badge variant="accent" data-testid="contact-follow-up-badge">
            {t('followUpBadge')}
          </Badge>
        )}
      </div>
      <p className="whitespace-pre-wrap text-fg">{contact.summary}</p>
      {contact.edited_at && (
        <p className="text-xs text-fg-muted">
          {t.rich('editedLine', {
            date: formatDateTime(contact.edited_at, locale),
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </p>
      )}
      {contact.can_edit && (
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => setIsEditing(true)} data-testid="contact-edit">
            {t('edit')}
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => setConfirmingDelete(true)}
            disabled={isPending}
            data-testid="contact-delete"
          >
            {isPending ? t('deleting') : t('delete')}
          </Button>
        </div>
      )}
      {error && <FieldError>{error}</FieldError>}

      {contact.can_edit && (
        <DeleteConfirmDialog
          open={confirmingDelete}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={handleConfirmDelete}
          kind="soft"
          itemLabel={firstLine(contact.summary)}
          confirmLabel={t('delete')}
          pendingLabel={t('deleting')}
          pending={isPending}
          note={t('deleteNote')}
        />
      )}
    </li>
  )
}

/**
 * The client contact log - used on the client detail page (every contact
 * for the client) and on the case detail page (only the ones linked to
 * that case, with the form pre-set to it). The caller supplies rows
 * already filtered to non-deleted in its query, and resolves both gates
 * from the database: canAdd from can_view_client(), and each row's
 * can_edit from can_edit_client_contact(). Neither is decided here.
 */
export function ContactLogSection({
  clientId,
  contacts,
  cases,
  staffOptions,
  canAdd,
  defaultCaseId,
  defaultHandledBy,
  showCase,
  testId,
}: {
  clientId: string
  contacts: ContactRow[]
  cases: ContactCaseOption[]
  staffOptions: ContactStaffOption[]
  canAdd: boolean
  defaultCaseId: string | null
  defaultHandledBy: string | null
  /** Off on a case page, where every row is that case. */
  showCase: boolean
  testId: string
}) {
  const t = useTranslations('dashboard.clients.detail.contacts')
  const tErrors = useTranslations('dashboard.clients.detail.contacts.errors')
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleAdd(formData: FormData, form: HTMLFormElement) {
    setError(null)
    startTransition(async () => {
      const result = await logClientContact(clientId, formData)
      if (result.error) {
        setError((CONTACT_ERROR_CODES as string[]).includes(result.error) ? tErrors(result.error) : tErrors('generic'))
        return
      }
      form.reset()
      setIsAdding(false)
    })
  }

  return (
    <Panel className="flex flex-col gap-3" data-testid={testId}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>
        {canAdd && !isAdding && (
          <Button type="button" variant="secondary" onClick={() => setIsAdding(true)} data-testid="contact-log-open">
            {t('logContact')}
          </Button>
        )}
      </div>

      {canAdd && isAdding && (
        <div className="rounded-md border border-line p-3">
          <ContactForm
            idPrefix="contact-new"
            cases={cases}
            staffOptions={staffOptions}
            defaults={{
              direction: 'incoming',
              channel: 'phone',
              occurred_at: '',
              summary: '',
              case_id: defaultCaseId ?? '',
              handled_by:
                defaultHandledBy && staffOptions.some((s) => s.id === defaultHandledBy) ? defaultHandledBy : '',
              follow_up_needed: false,
            }}
            submitLabel={t('logContact')}
            pendingLabel={t('logging')}
            onSubmit={handleAdd}
            onCancel={() => {
              setError(null)
              setIsAdding(false)
            }}
            isPending={isPending}
            error={error}
          />
        </div>
      )}

      {contacts.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noneYet')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {contacts.map((contact) => (
            <ContactItem
              key={contact.id}
              contact={contact}
              clientId={clientId}
              cases={cases}
              staffOptions={staffOptions}
              showCase={showCase}
            />
          ))}
        </ul>
      )}
    </Panel>
  )
}
