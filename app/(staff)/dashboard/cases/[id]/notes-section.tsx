'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale } from 'next-intl'
import { addCaseNote, editCaseNote, deleteCaseNote, restoreCaseNote } from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Button } from '@/components/dashboard/button'
import { FieldError, controlClass } from '@/components/dashboard/form'
import { formatDateTime } from '@/lib/format-date-time'

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
          {note.author_name} · <bdi>{formatDateTime(note.created_at, locale)}</bdi>
        </p>
        <Badge variant="muted">
          Deleted by {note.deleted_by_name} · <bdi>{formatDateTime(note.deleted_at!, locale)}</bdi>
        </Badge>
      </div>
      <p className="whitespace-pre-wrap text-fg">{note.note}</p>
      <div>
        <Button type="button" variant="ghost" onClick={handleRestore} disabled={isPending}>
          {isPending ? 'Restoring…' : 'Restore'}
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

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await deleteCaseNote(caseId, note.id)
      if (result.error) {
        setError(result.error)
        setConfirmingDelete(false)
      }
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
              {isPending ? 'Saving…' : 'Save'}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setIsEditing(false)} disabled={isPending}>
              Cancel
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
        {note.author_name} · <bdi>{formatDateTime(note.created_at, locale)}</bdi>
        {note.edited_at && (
          <span>
            {' '}
            · edited <bdi>{formatDateTime(note.edited_at, locale)}</bdi>
          </span>
        )}
      </p>
      <p className="whitespace-pre-wrap text-fg">{note.note}</p>
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" onClick={() => setIsEditing(true)}>
          Edit
        </Button>
        <Button type="button" variant="danger" onClick={handleDelete} disabled={isPending}>
          {isPending ? 'Deleting…' : confirmingDelete ? 'Confirm delete?' : 'Delete'}
        </Button>
        {confirmingDelete && !isPending && (
          <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </Button>
        )}
      </div>
      {error && <FieldError>{error}</FieldError>}
    </li>
  )
}

export function NotesSection({ caseId, notes }: { caseId: string; notes: CaseNote[] }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

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
      <h2 className="font-heading text-lg text-fg">Notes</h2>

      {activeNotes.length === 0 ? (
        <p className="text-sm text-fg-muted">No notes yet.</p>
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
          placeholder="Add a note for the case file…"
          className={`${controlClass} resize-y`}
        />
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" disabled={isPending}>
            {isPending ? 'Adding…' : 'Add note'}
          </Button>
        </div>
      </form>
      {error && <FieldError>{error}</FieldError>}

      {/* Only ever populated for the owner - RLS hides deleted notes from
          everyone else, so their presence here is itself the access check. */}
      {deletedNotes.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Deleted notes</p>
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
