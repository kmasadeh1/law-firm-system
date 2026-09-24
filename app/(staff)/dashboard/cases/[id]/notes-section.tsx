'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { addCaseNote, editCaseNote, deleteCaseNote, restoreCaseNote } from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Button } from '@/components/dashboard/button'
import { FieldError, controlClass } from '@/components/dashboard/form'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { formatDateTime } from '@/lib/format-date-time'

// The identifying detail for the confirm dialog - the note's first line,
// trimmed so a long note doesn't blow out the dialog.
function firstLine(text: string, maxLength = 60) {
  const line = text.split('\n')[0]!.trim()
  return line.length > maxLength ? `${line.slice(0, maxLength - 1)}…` : line
}

export type CaseNote = {
  id: string
  note: string
  created_at: string
  edited_at: string | null
  author_name: string
  deleted_at: string | null
  deleted_by_name: string | null
}

function DeletedNote({ caseId, note }: { caseId: string; note: CaseNote }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const locale = useLocale()
  const t = useTranslations('dashboard.cases.detail.notes')

  function handleRestore() {
    setError(null)
    startTransition(async () => {
      const result = await restoreCaseNote(caseId, note.id)
      if (result.error) setError(result.error)
    })
  }

  return (
    <li className="flex flex-col gap-1 px-3 py-3 text-sm opacity-70">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-fg-muted">
          {t.rich('authorLine', {
            author: note.author_name,
            date: formatDateTime(note.created_at, locale),
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </p>
        <Badge variant="muted">
          {t.rich('deletedByLine', {
            name: note.deleted_by_name ?? '',
            date: formatDateTime(note.deleted_at!, locale),
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </Badge>
      </div>
      <p className="whitespace-pre-wrap text-fg">{note.note}</p>
      <div>
        <Button type="button" variant="ghost" onClick={handleRestore} disabled={isPending}>
          {isPending ? t('restoring') : t('restore')}
        </Button>
      </div>
      {error && <FieldError>{error}</FieldError>}
    </li>
  )
}

function NoteItem({ caseId, note }: { caseId: string; note: CaseNote }) {
  const [isEditing, setIsEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const locale = useLocale()
  const t = useTranslations('dashboard.cases.detail.notes')

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await editCaseNote(caseId, note.id, formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setIsEditing(false)
    })
  }

  function handleConfirmDelete() {
    setError(null)
    startTransition(async () => {
      const result = await deleteCaseNote(caseId, note.id)
      setConfirmingDelete(false)
      if (result.error) setError(result.error)
    })
  }

  if (isEditing) {
    return (
      <li className="px-3 py-3 text-sm">
        <form ref={formRef} onSubmit={handleSaveEdit} className="flex flex-col gap-2">
          <textarea
            name="note"
            rows={3}
            defaultValue={note.note}
            autoFocus
            className={`${controlClass} resize-y`}
          />
          <div className="flex items-center gap-2">
            <Button type="submit" variant="secondary" disabled={isPending}>
              {isPending ? t('saving') : t('save')}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} disabled={isPending}>
              {t('cancel')}
            </Button>
          </div>
          {error && <FieldError>{error}</FieldError>}
        </form>
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-1 px-3 py-3 text-sm">
      <p className="text-xs text-fg-muted">
        {t.rich('authorLine', {
          author: note.author_name,
          date: formatDateTime(note.created_at, locale),
          bdi: (chunks) => <bdi>{chunks}</bdi>,
        })}
        {note.edited_at && (
          <span>
            {' '}
            {t.rich('editedSuffix', {
              date: formatDateTime(note.edited_at, locale),
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            })}
          </span>
        )}
      </p>
      <p className="whitespace-pre-wrap text-fg">{note.note}</p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" onClick={() => setIsEditing(true)}>
          {t('edit')}
        </Button>
        <Button type="button" variant="danger" onClick={() => setConfirmingDelete(true)} disabled={isPending}>
          {isPending ? t('deleting') : t('delete')}
        </Button>
      </div>
      {error && <FieldError>{error}</FieldError>}

      <DeleteConfirmDialog
        open={confirmingDelete}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleConfirmDelete}
        kind="soft"
        itemLabel={firstLine(note.note)}
        confirmLabel={t('delete')}
        pendingLabel={t('deleting')}
        pending={isPending}
      />
    </li>
  )
}

export function NotesSection({ caseId, notes }: { caseId: string; notes: CaseNote[] }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const t = useTranslations('dashboard.cases.detail.notes')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await addCaseNote(caseId, formData)
      if (result.error) {
        setError(result.error)
        return
      }
      formRef.current?.reset()
    })
  }

  const activeNotes = notes.filter((n) => !n.deleted_at)
  const deletedNotes = notes.filter((n) => n.deleted_at)

  return (
    <Panel className="flex flex-col gap-3" data-testid="case-notes-section">
      <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>

      {activeNotes.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noNotesYet')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {activeNotes.map((note) => (
            <NoteItem key={note.id} caseId={caseId} note={note} />
          ))}
        </ul>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-2">
        <textarea
          name="note"
          rows={3}
          placeholder={t('addNotePlaceholder')}
          className={`${controlClass} resize-y`}
        />
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" disabled={isPending}>
            {isPending ? t('adding') : t('addNote')}
          </Button>
        </div>
      </form>
      {error && <FieldError>{error}</FieldError>}

      {/* Only ever populated for the owner - RLS hides deleted notes from
          everyone else, so their presence here is itself the access check. */}
      {deletedNotes.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{t('deletedNotesHeading')}</p>
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
            {deletedNotes.map((note) => (
              <DeletedNote key={note.id} caseId={caseId} note={note} />
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}
