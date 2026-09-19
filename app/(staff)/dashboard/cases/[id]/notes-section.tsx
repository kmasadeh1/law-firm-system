'use client'

import { useRef, useState, useTransition } from 'react'
import { addCaseNote } from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { FieldError, controlClass } from '@/components/dashboard/form'

export type CaseNote = {
  id: string
  note: string
  created_at: string
  author_name: string
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function NoteItem({ note }: { note: CaseNote }) {
  return (
    <li className="flex flex-col gap-1 px-3 py-3 text-sm">
      <p className="text-xs text-fg-muted">
        {note.author_name} · {formatDateTime(note.created_at)}
      </p>
      <p className="whitespace-pre-wrap text-fg">{note.note}</p>
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

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-heading text-lg text-fg">Notes</h2>

      {notes.length === 0 ? (
        <p className="text-sm text-fg-muted">No notes yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {notes.map((note) => (
            <NoteItem key={note.id} note={note} />
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-fg-muted">
            Notes are permanent once added — there&apos;s no editing or deleting later.
          </p>
          <Button type="submit" variant="secondary" disabled={isPending}>
            {isPending ? 'Adding…' : 'Add note'}
          </Button>
        </div>
      </form>
      {error && <FieldError>{error}</FieldError>}
    </Panel>
  )
}
