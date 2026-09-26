'use client'

import { NotesSection as SharedNotesSection, type NoteRow } from '@/components/dashboard/notes-section'
import { addCaseNote, editCaseNote, deleteCaseNote, restoreCaseNote } from '../actions'

export type CaseNote = NoteRow

export function NotesSection({ caseId, notes }: { caseId: string; notes: CaseNote[] }) {
  return (
    <SharedNotesSection
      notes={notes}
      namespace="dashboard.cases.detail.notes"
      testId="case-notes-section"
      actions={{
        addNote: (formData) => addCaseNote(caseId, formData),
        editNote: (noteId, formData) => editCaseNote(caseId, noteId, formData),
        deleteNote: (noteId) => deleteCaseNote(caseId, noteId),
        restoreNote: (noteId) => restoreCaseNote(caseId, noteId),
      }}
    />
  )
}
