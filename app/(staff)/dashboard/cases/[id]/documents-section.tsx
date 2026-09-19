'use client'

import { useRef, useState, useTransition } from 'react'
import { uploadDocument, getDocumentSignedUrl } from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { FieldError } from '@/components/dashboard/form'

export type DocumentRow = {
  id: string
  filename: string
  uploaded_at: string
  uploaded_by_name: string
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

function DocumentRowItem({ caseId, doc }: { caseId: string; doc: DocumentRow }) {
  const [error, setError] = useState<string | null>(null)
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

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-3 py-3 text-sm">
      <div>
        <p className="font-medium text-fg">{doc.filename}</p>
        <p className="mt-0.5 text-xs text-fg-muted">
          Uploaded by {doc.uploaded_by_name} · {formatDateTime(doc.uploaded_at)}
        </p>
        {error && <FieldError>{error}</FieldError>}
      </div>
      <Button type="button" variant="secondary" onClick={handleView} disabled={isPending}>
        {isPending ? 'Opening…' : 'View'}
      </Button>
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

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-heading text-lg text-fg">Documents</h2>

      {documents.length === 0 ? (
        <p className="text-sm text-fg-muted">No documents uploaded yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {documents.map((doc) => (
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
    </Panel>
  )
}
