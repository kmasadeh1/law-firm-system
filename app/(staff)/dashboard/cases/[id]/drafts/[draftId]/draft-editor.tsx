'use client'

import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { deleteDraft, saveDraft } from '../../../draft-actions'
import { useResolveDraftError } from '../../drafts-section'
import { BackLink } from '@/components/dashboard/back-link'
import { Button } from '@/components/dashboard/button'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { PrintButton } from '@/components/dashboard/print-button'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'

type Letterhead = {
  nameEn: string
  nameAr: string
  addressEn: string | null
  addressAr: string | null
  phone: string | null
  email: string | null
}

// Plain text only - a textarea on screen, and on paper the same text with
// its line breaks kept (whitespace-pre-wrap). dir="auto" lets each draft
// take its direction from its own first words, so an Arabic draft is RTL
// whatever the reader's interface language.
//
// The printout shows what is in the editor right now, saved or not; the
// editor and its controls are print:hidden, as on the receipt.
export function DraftEditor({
  caseId,
  draft,
  letterhead,
}: {
  caseId: string
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
        {error && <FieldError>{error}</FieldError>}
        <div className="flex items-center gap-3">
          <Button type="submit" variant="primary" disabled={isPending || !changed} data-testid="draft-save">
            {isPending ? t('saving') : t('save')}
          </Button>
          {saved && !changed && <FieldSuccess>{t('saved')}</FieldSuccess>}
          {changed && <span className="text-xs text-fg-muted">{t('unsaved')}</span>}
        </div>
      </form>

      {/* Print only: letterhead, title, body. */}
      <article className="hidden text-black print:block" data-testid="draft-print-view">
        <header className="flex flex-col gap-0.5 border-b-2 border-black pb-3 text-center">
          <p className="font-heading text-xl">{letterhead.nameAr}</p>
          <p className="font-heading text-lg">{letterhead.nameEn}</p>
          <div className="mt-1 flex flex-wrap justify-center gap-x-4 text-xs">
            {letterhead.addressAr && <span dir="rtl">{letterhead.addressAr}</span>}
            {letterhead.addressEn && <span dir="ltr">{letterhead.addressEn}</span>}
            {letterhead.phone && <span dir="ltr">{letterhead.phone}</span>}
            {letterhead.email && <span dir="ltr">{letterhead.email}</span>}
          </div>
        </header>
        <h1 dir="auto" className="mt-6 text-center font-heading text-lg">
          {title}
        </h1>
        <div dir="auto" className="mt-4 whitespace-pre-wrap text-[11pt] leading-relaxed">
          {body}
        </div>
      </article>

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
