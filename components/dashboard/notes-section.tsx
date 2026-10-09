'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Panel } from './panel'
import { Badge } from './badge'
import { Button } from './button'
import { FieldError, controlClass } from './form'
import { DeleteConfirmDialog } from './delete-confirm-dialog'
import { formatDateTime } from '@/lib/format-date-time'

// The identifying detail for the confirm dialog - the note's first line,
// trimmed so a long note doesn't blow out the dialog.
function firstLine(text: string, maxLength = 60) {
  const line = text.split('\n')[0]!.trim()
  return line.length > maxLength ? `${line.slice(0, maxLength - 1)}…` : line
}

export type NoteRow = {
  id: string
  note: string
  created_at: string
  edited_at: string | null
  author_name: string
  deleted_at: string | null
  deleted_by_name: string | null
  // The database's answer to "may this viewer edit or delete this note?",
  // where it differs per note (enquiry notes: can_edit_enquiry_note). false
  // hides Edit and Delete on this note; omitted leaves it to `actions`.
  can_modify?: boolean
}

type ActionResult = { error?: string }

// All four are optional - a caller omits whichever action the viewer isn't
// permitted to take, and that control never renders (never a disabled one).
// addNote absent hides the add-note form entirely; deleteNote absent hides
// Delete on every note; editNote absent hides Edit; restoreNote is passed
// only when the deleted rows in `notes` are meant to be restorable (the
// owner's view). None of this is the caller hiding the whole section - the
// notes list itself still renders regardless of which actions are present.
type NotesSectionActions = {
  addNote?: (formData: FormData) => Promise<ActionResult>
  editNote?: (noteId: string, formData: FormData) => Promise<ActionResult>
  deleteNote?: (noteId: string) => Promise<ActionResult>
  restoreNote?: (noteId: string) => Promise<ActionResult>
}

function DeletedNote({
  note,
  namespace,
  restoreNote,
}: {
  note: NoteRow
  namespace: string
  restoreNote: (noteId: string) => Promise<ActionResult>
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const locale = useLocale()
  const t = useTranslations(namespace)

  function handleRestore() {
    setError(null)
    startTransition(async () => {
      const result = await restoreNote(note.id)
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

function NoteItem({
  note,
  namespace,
  editNote,
  deleteNote,
}: {
  note: NoteRow
  namespace: string
  editNote?: (noteId: string, formData: FormData) => Promise<ActionResult>
  deleteNote?: (noteId: string) => Promise<ActionResult>
}) {
  const canModify = note.can_modify !== false
  const [isEditing, setIsEditing] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const locale = useLocale()
  const t = useTranslations(namespace)

  function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!editNote) return
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await editNote(note.id, formData)
      if (result.error) {
        setError(result.error)
        return
      }
      setIsEditing(false)
    })
  }

  function handleConfirmDelete() {
    if (!deleteNote) return
    setError(null)
    startTransition(async () => {
      const result = await deleteNote(note.id)
      setConfirmingDelete(false)
      if (result.error) setError(result.error)
    })
  }

  if (isEditing && editNote) {
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
    <li className="flex flex-col gap-1 px-3 py-3 text-sm" data-testid="note-item">
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
      {canModify && (editNote || deleteNote) && (
        <div className="flex items-center gap-2">
          {editNote && (
            <Button type="button" variant="ghost" onClick={() => setIsEditing(true)} data-testid="note-edit">
              {t('edit')}
            </Button>
          )}
          {deleteNote && (
            <Button
              type="button"
              variant="danger"
              onClick={() => setConfirmingDelete(true)}
              disabled={isPending}
              data-testid="note-delete"
            >
              {isPending ? t('deleting') : t('delete')}
            </Button>
          )}
        </div>
      )}
      {error && <FieldError>{error}</FieldError>}

      {canModify && deleteNote && (
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
      )}
    </li>
  )
}

export function NotesSection({
  notes,
  namespace,
  testId,
  actions,
}: {
  notes: NoteRow[]
  namespace: string
  testId: string
  actions: NotesSectionActions
}) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const t = useTranslations(namespace)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!actions.addNote) return
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await actions.addNote!(formData)
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
    <Panel className="flex flex-col gap-3" data-testid={testId}>
      <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>

      {activeNotes.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noNotesYet')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {activeNotes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              namespace={namespace}
              editNote={actions.editNote}
              deleteNote={actions.deleteNote}
            />
          ))}
        </ul>
      )}

      {actions.addNote && (
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
      )}
      {error && <FieldError>{error}</FieldError>}

      {/* Only ever populated when the caller means for this viewer to see
          deleted rows (the owner's restore view) - the caller filters
          deleted rows out of `notes` for everyone else before this ever
          renders, so their presence here is itself the access check. */}
      {actions.restoreNote && deletedNotes.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{t('deletedNotesHeading')}</p>
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
            {deletedNotes.map((note) => (
              <DeletedNote key={note.id} note={note} namespace={namespace} restoreNote={actions.restoreNote!} />
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}
