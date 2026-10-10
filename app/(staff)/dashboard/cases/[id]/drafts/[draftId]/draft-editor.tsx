'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { deleteDraft, saveDraft } from '../../../draft-actions'
import { useResolveDraftError } from '../../drafts-section'
import { BackLink } from '@/components/dashboard/back-link'
import { Button } from '@/components/dashboard/button'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { PrintButton } from '@/components/dashboard/print-button'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { draftDocumentTitle } from '@/lib/draft-sections'
import { DraftDocument, type Letterhead } from './draft-document'

// Plain text only - a textarea on screen, and on paper the same text with
// its line breaks kept (whitespace-pre-wrap). dir="auto" lets each draft
// take its direction from its own first words, so an Arabic draft is RTL
// whatever the reader's interface language.
//
// The printout (draft-document.tsx) shows what is in the editor right now,
// saved or not; the editor and its controls are print:hidden, as on the
// receipt.
export function DraftEditor({
  caseId,
  caseNumber,
  draft,
  letterhead,
}: {
  caseId: string
  caseNumber: string | null
  draft: { id: string; title: string; body: string }
  letterhead: Letterhead
}) {
  const t = useTranslations('dashboard.cases.detail.drafts')
  const router = useRouter()
  const resolveError = useResolveDraftError()
  const formRef = useRef<HTMLFormElement>(null)
  const [title, setTitle] = useState(draft.title)
  const [body, setBody] = useState(draft.body)
  const [savedTitle, setSavedTitle] = useState(draft.title)
  const [savedBody, setSavedBody] = useState(draft.body)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isPending, startTransition] = useTransition()

  const changed = title !== savedTitle || body !== savedBody

  // The server set <title> from the saved draft; keep it on what is in the
  // editor, so the PDF name and Chrome's print header match the printout.
  useEffect(() => {
    document.title = draftDocumentTitle(title, caseNumber)
  }, [title, caseNumber])

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await saveDraft(caseId, draft.id, formData)
      if (result.error) {
        setError(resolveError(result.error, 'saveFailed'))
        return
      }
      setSavedTitle(title)
      setSavedBody(body)
      setSaved(true)
    })
  }

  return (
    <div className="flex flex-col gap-6" data-testid="draft-page">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <BackLink href={`/dashboard/cases/${caseId}`} label={t('backToCase')} />
        <div className="flex items-center gap-2">
          <Button type="button" variant="ghost" onClick={() => setConfirmingDelete(true)} disabled={isPending} data-testid="draft-page-delete">
            {t('delete')}
          </Button>
          <PrintButton label={t('print')} testId="draft-print" />
        </div>
      </div>

      <form ref={formRef} onSubmit={handleSave} className="flex flex-col gap-3 print:hidden" data-testid="draft-form">
        <Field>
          <Label htmlFor="draft-title">{t('titleLabel')}</Label>
          <input
            id="draft-title"
            name="title"
            dir="auto"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              setSaved(false)
            }}
            className={controlClass}
            data-testid="draft-title"
          />
        </Field>
        <Field>
          <Label htmlFor="draft-body">{t('bodyLabel')}</Label>
          <textarea
            id="draft-body"
            name="body"
            dir="auto"
            rows={20}
            value={body}
            onChange={(e) => {
              setBody(e.target.value)
              setSaved(false)
            }}
            className={`text-sm leading-relaxed ${controlClass}`}
            data-testid="draft-body"
          />
        </Field>
        <p className="text-xs text-fg-muted">{t('markerHelp')}</p>
        <p className="text-xs text-fg-muted" data-testid="draft-sections-help">
          {t('sectionsHelp')}
        </p>
        {error && <FieldError>{error}</FieldError>}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={isPending || !changed} data-testid="draft-save">
            {isPending ? t('saving') : t('save')}
          </Button>
          <FieldSuccess show={saved && !changed}>{t('saved')}</FieldSuccess>
          {changed && <span className="text-xs text-fg-muted">{t('unsaved')}</span>}
        </div>
      </form>

      {/* Print only. Shows what is in the editor now, saved or not. */}
      <DraftDocument letterhead={letterhead} title={title} body={body} />

      <DeleteConfirmDialog
        open={confirmingDelete}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => {
          setConfirmingDelete(false)
          setError(null)
          startTransition(async () => {
            const result = await deleteDraft(caseId, draft.id)
            if (result.error) {
              setError(resolveError(result.error, 'deleteFailed'))
              return
            }
            router.push(`/dashboard/cases/${caseId}`)
          })
        }}
        kind="soft"
        itemLabel={savedTitle}
        confirmLabel={t('delete')}
      />
    </div>
  )
}
