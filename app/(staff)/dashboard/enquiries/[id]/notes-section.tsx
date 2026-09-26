'use client'

import { NotesSection as SharedNotesSection, type NoteRow } from '@/components/dashboard/notes-section'
import { addEnquiryNote, deleteEnquiryNote, restoreEnquiryNote } from '../actions'

export type EnquiryNote = NoteRow

export function NotesSection({
  enquiryId,
  notes,
  canRestore,
}: {
  enquiryId: string
  notes: EnquiryNote[]
  canRestore: boolean
}) {
  return (
    <SharedNotesSection
      notes={notes}
      namespace="dashboard.enquiries.detail.notes"
      testId="enquiry-notes-section"
      actions={{
        addNote: (formData) => addEnquiryNote(enquiryId, formData),
        deleteNote: (noteId) => deleteEnquiryNote(enquiryId, noteId),
        restoreNote: canRestore ? (noteId) => restoreEnquiryNote(enquiryId, noteId) : undefined,
      }}
    />
  )
}
