'use client'

import { NotesSection as SharedNotesSection, type NoteRow } from '@/components/dashboard/notes-section'
import { addCaseNote, editCaseNote, deleteCaseNote, restoreCaseNote } from '../actions'

export type CaseNote = NoteRow

export function NotesSection({
  caseId,
  notes,
  canWrite,
}: {
  caseId: string
  notes: CaseNote[]
  canWrite: boolean
}) {
  return (
    <SharedNotesSection
      notes={notes}
      namespace="dashboard.cases.detail.notes"
      testId="case-notes-section"
      actions={{
        addNote: canWrite ? (formData) => addCaseNote(caseId, formData) : undefined,
        editNote: canWrite ? (noteId, formData) => editCaseNote(caseId, noteId, formData) : undefined,
        deleteNote: canWrite ? (noteId) => deleteCaseNote(caseId, noteId) : undefined,
        restoreNote: (noteId) => restoreCaseNote(caseId, noteId),
      }}
    />
  )
}
