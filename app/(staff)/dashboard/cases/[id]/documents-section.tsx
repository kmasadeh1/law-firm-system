'use client'

import { useRef, useState, useTransition } from 'react'
import {
  uploadDocument,
  getDocumentSignedUrl,
  deleteDocument,
  restoreDocument,
} from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Button } from '@/components/dashboard/button'
import { FieldError } from '@/components/dashboard/form'

export type DocumentRow = {
  id: string
  filename: string
  uploaded_at: string
  uploaded_by_name: string
  deleted_at: string | null
  deleted_by_name: string | null
}

// Client-side mirror of the case-documents bucket's limits, purely so a
// rejected file gets a clear reason before a round trip - the bucket itself
// is what actually enforces this.
const MAX_FILE_BYTES = 25 * 1024 * 1024
const ALLOWED_EXTENSIONS = [
  'pdf',
  'jpg',
  'jpeg',
  'png',
  'webp',
  'heic',
  'heif',
  'tif',
  'tiff',
  'doc',
  'docx',
  'xls',
  'xlsx',
  'txt',
]

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

function validateFile(file: File): string | null {
  if (file.size > MAX_FILE_BYTES) return 'That file is larger than the 25 MB limit.'
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return "That file type isn't supported. Allowed: PDF, Word, Excel, plain text, or common image formats (including HEIC)."
  }
  return null
}

function DeletedDocumentRow({ caseId, doc }: { caseId: string; doc: DocumentRow }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleRestore() {
    setError(null)
    startTransition(async () => {
      const result = await restoreDocument(caseId, doc.id)
      if (result.error) setError(result.error)
    })
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm opacity-70">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-fg">{doc.filename}</p>
          <Badge variant="muted">
            Removed by {doc.deleted_by_name} · <bdi>{formatDateTime(doc.deleted_at!)}</bdi>
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-fg-muted">
          Uploaded by {doc.uploaded_by_name} · <bdi>{formatDateTime(doc.uploaded_at)}</bdi>
        </p>
        {error && <FieldError>{error}</FieldError>}
      </div>
      <Button type="button" variant="ghost" onClick={handleRestore} disabled={isPending}>
        {isPending ? 'Restoring…' : 'Restore'}
      </Button>
    </li>
  )
}

function DocumentRowItem({ caseId, doc }: { caseId: string; doc: DocumentRow }) {
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleView() {
    setError(null)
    // Open the tab synchronously on the click, then navigate it once the
    // signed URL comes back - waiting for the async result first would make
    // most browsers treat the eventual window.open as a blocked popup.
    const tab = window.open('', '_blank')
    startTransition(async () => {
      const result = await getDocumentSignedUrl(caseId, doc.id)
      if (result.error || !result.url) {
        tab?.close()
        setError(result.error ?? 'Could not open that file.')
        return
      }
      if (tab) tab.location.href = result.url
    })
  }

  function handleDelete() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await deleteDocument(caseId, doc.id)
      if (result.error) {
        setError(result.error)
        setConfirmingDelete(false)
      }
    })
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm">
      <div>
        <p className="font-medium text-fg">{doc.filename}</p>
        <p className="mt-0.5 text-xs text-fg-muted">
          Uploaded by {doc.uploaded_by_name} · <bdi>{formatDateTime(doc.uploaded_at)}</bdi>
        </p>
        {error && <FieldError>{error}</FieldError>}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={handleView} disabled={isPending}>
          {isPending ? 'Opening…' : 'View'}
        </Button>
        <Button type="button" variant="danger" onClick={handleDelete} disabled={isPending}>
          {isPending ? 'Removing…' : confirmingDelete ? 'Confirm remove?' : 'Remove'}
        </Button>
        {confirmingDelete && !isPending && (
          <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </Button>
        )}
      </div>
    </li>
  )
}

export function DocumentsSection({ caseId, documents }: { caseId: string; documents: DocumentRow[] }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const file = inputRef.current?.files?.[0]
    if (!file) {
      setError('Choose a file to upload.')
      return
    }
    const validationError = validateFile(file)
    if (validationError) {
      setError(validationError)
      return
    }
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await uploadDocument(caseId, formData)
      if (result.error) {
        setError(result.error)
        return
      }
      formRef.current?.reset()
    })
  }

  const activeDocuments = documents.filter((d) => !d.deleted_at)
  const deletedDocuments = documents.filter((d) => d.deleted_at)

  return (
    <Panel className="flex flex-col gap-3" data-testid="case-documents-section">
      <h2 className="font-heading text-lg text-fg">Documents</h2>

      {activeDocuments.length === 0 ? (
        <p className="text-sm text-fg-muted">No documents uploaded yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {activeDocuments.map((doc) => (
            <DocumentRowItem key={doc.id} caseId={caseId} doc={doc} />
          ))}
        </ul>
      )}

      <form ref={formRef} onSubmit={handleUpload} className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          name="file"
          className="text-sm text-fg-muted file:mr-3 file:rounded-md file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-fg hover:file:bg-line/40"
        />
        <Button type="submit" variant="secondary" disabled={isPending}>
          {isPending ? 'Uploading…' : 'Upload'}
        </Button>
      </form>
      {error && <FieldError>{error}</FieldError>}

      {/* Only ever populated for the owner - RLS hides removed documents
          from everyone else, so their presence here is itself the access
          check. */}
      {deletedDocuments.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">Removed documents</p>
          <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
            {deletedDocuments.map((doc) => (
              <DeletedDocumentRow key={doc.id} caseId={caseId} doc={doc} />
            ))}
          </ul>
        </div>
      )}
    </Panel>
  )
}
