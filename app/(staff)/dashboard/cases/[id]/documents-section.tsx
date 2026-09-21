'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
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
import { formatDateTime } from '@/lib/format-date-time'

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

// Shares its message keys with uploadDocument's server-side re-check
// (cases/actions.ts) - one English string per condition, not two
// near-identical copies a translator would have to reconcile.
function validateFile(file: File, t: ReturnType<typeof useTranslations>): string | null {
  if (file.size > MAX_FILE_BYTES) return t('errors.fileTooLarge')
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return t('errors.fileTypeNotSupported')
  }
  return null
}

function DeletedDocumentRow({ caseId, doc }: { caseId: string; doc: DocumentRow }) {
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const locale = useLocale()
  const t = useTranslations('dashboard.cases.detail.documents')

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
            {t.rich('removedByLine', {
              name: doc.deleted_by_name ?? '',
              date: formatDateTime(doc.deleted_at!, locale),
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            })}
          </Badge>
        </div>
        <p className="mt-0.5 text-xs text-fg-muted">
          {t.rich('uploadedLine', {
            name: doc.uploaded_by_name,
            date: formatDateTime(doc.uploaded_at, locale),
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </p>
        {error && <FieldError>{error}</FieldError>}
      </div>
      <Button type="button" variant="ghost" onClick={handleRestore} disabled={isPending}>
        {isPending ? t('restoring') : t('restore')}
      </Button>
    </li>
  )
}

function DocumentRowItem({ caseId, doc }: { caseId: string; doc: DocumentRow }) {
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isPending, startTransition] = useTransition()
  const locale = useLocale()
  const t = useTranslations('dashboard.cases.detail.documents')

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
        setError(result.error ?? t('errors.couldNotOpenFile'))
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
          {t.rich('uploadedLine', {
            name: doc.uploaded_by_name,
            date: formatDateTime(doc.uploaded_at, locale),
            bdi: (chunks) => <bdi>{chunks}</bdi>,
          })}
        </p>
        {error && <FieldError>{error}</FieldError>}
      </div>
      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={handleView} disabled={isPending}>
          {isPending ? t('opening') : t('view')}
        </Button>
        <Button type="button" variant="danger" onClick={handleDelete} disabled={isPending}>
          {isPending ? t('removing') : confirmingDelete ? t('confirmRemove') : t('remove')}
        </Button>
        {confirmingDelete && !isPending && (
          <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(false)}>
            {t('cancel')}
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
  const t = useTranslations('dashboard.cases.detail.documents')

  function handleUpload(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const file = inputRef.current?.files?.[0]
    if (!file) {
      setError(t('errors.chooseFile'))
      return
    }
    const validationError = validateFile(file, t)
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
      <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>

      {activeDocuments.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noDocumentsYet')}</p>
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
          {isPending ? t('uploading') : t('upload')}
        </Button>
      </form>
      {error && <FieldError>{error}</FieldError>}

      {/* Only ever populated for the owner - RLS hides removed documents
          from everyone else, so their presence here is itself the access
          check. */}
      {deletedDocuments.length > 0 && (
        <div className="flex flex-col gap-2 border-t border-line pt-3">
          <p className="text-xs font-medium uppercase tracking-wide text-fg-muted">{t('removedDocumentsHeading')}</p>
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
