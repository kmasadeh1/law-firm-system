'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { deleteDraft, generateDraft, type DraftErrorCode } from '../draft-actions'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { Field, Label, FieldError, controlClass } from '@/components/dashboard/form'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { formatDateTime } from '@/lib/format-date-time'
import type { DraftLanguage } from '@/lib/document-placeholders'

// A template the picker can offer: active, for this case's type or for any
// type (filtered in the page's query), with the languages it has a body in.
export type TemplateOption = { id: string; name: string; languages: DraftLanguage[] }

export type DraftListItem = { id: string; title: string; updated_at: string | null; created_at: string }

const ERROR_CODES: DraftErrorCode[] = [
  'templateUnavailable',
  'titleRequired',
  'bodyRequired',
  'noPermission',
  'generateFailed',
  'saveFailed',
  'deleteFailed',
]

export function useResolveDraftError() {
  const tErrors = useTranslations('dashboard.cases.detail.drafts.errors')
  return (code: DraftErrorCode | undefined, fallback: DraftErrorCode) =>
    tErrors(code && ERROR_CODES.includes(code) ? code : fallback)
}

// Pre-filled drafts. The page renders this only when can_write_case_documents
// is true - the same function document_drafts' read and write policies use,
// so anyone who sees this section can use every control in it.
export function DraftsSection({
  caseId,
  templates,
  drafts,
}: {
  caseId: string
  templates: TemplateOption[]
  drafts: DraftListItem[]
}) {
  const t = useTranslations('dashboard.cases.detail.drafts')
  const locale = useLocale()
  const router = useRouter()
  const resolveError = useResolveDraftError()
  const [templateId, setTemplateId] = useState('')
  const [language, setLanguage] = useState<DraftLanguage | ''>('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const selected = templates.find((tpl) => tpl.id === templateId) ?? null
  // The reader's own language when the template has it, else the one it has.
  const effectiveLanguage: DraftLanguage | '' =
    selected && language && selected.languages.includes(language)
      ? language
      : selected
        ? selected.languages.includes(locale as DraftLanguage)
          ? (locale as DraftLanguage)
          : selected.languages[0]
        : ''

  function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!selected || !effectiveLanguage) return
    setError(null)
    startTransition(async () => {
      const result = await generateDraft(caseId, selected.id, effectiveLanguage)
      if (result.error || !result.draftId) {
        setError(resolveError(result.error, 'generateFailed'))
        return
      }
      router.push(`/dashboard/cases/${caseId}/drafts/${result.draftId}`)
    })
  }

  return (
    <Panel className="flex flex-col gap-3" data-testid="case-drafts-section">
      <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>

      {drafts.length === 0 ? (
        <p className="text-sm text-fg-muted">{t('noneYet')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
          {drafts.map((d) => (
            <DraftItem key={d.id} caseId={caseId} draft={d} />
          ))}
        </ul>
      )}

      {templates.length === 0 ? (
        <p className="text-sm text-fg-muted" data-testid="drafts-no-templates">
          {t('noTemplates')}
        </p>
      ) : (
        <form onSubmit={handleGenerate} className="flex flex-wrap items-end gap-2" data-testid="draft-generate-form">
          <Field>
            <Label htmlFor="draft-template">{t('templateLabel')}</Label>
            <select
              id="draft-template"
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value)
                setLanguage('')
              }}
              className={controlClass}
              data-testid="draft-template"
            >
              <option value="">{t('chooseTemplate')}</option>
              {templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))}
            </select>
          </Field>
          {selected && selected.languages.length > 1 && (
            <Field>
              <Label htmlFor="draft-language">{t('languageLabel')}</Label>
              <select
                id="draft-language"
                value={effectiveLanguage}
                onChange={(e) => setLanguage(e.target.value as DraftLanguage)}
                className={controlClass}
                data-testid="draft-language"
              >
                {selected.languages.map((lang) => (
                  <option key={lang} value={lang}>
                    {t(`language.${lang}`)}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Button type="submit" variant="secondary" disabled={!selected || isPending} data-testid="draft-generate">
            {isPending ? t('generating') : t('generate')}
          </Button>
        </form>
      )}

      {error && <FieldError>{error}</FieldError>}
    </Panel>
  )
}

function DraftItem({ caseId, draft }: { caseId: string; draft: DraftListItem }) {
  const t = useTranslations('dashboard.cases.detail.drafts')
  const locale = useLocale()
  const resolveError = useResolveDraftError()
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  return (
    <li className="flex flex-col gap-1 px-3 py-2 text-sm" data-testid="draft-row">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link href={`/dashboard/cases/${caseId}/drafts/${draft.id}`} className="font-medium text-fg hover:underline">
          {draft.title}
        </Link>
        <span className="flex items-center gap-3 text-xs text-fg-muted">
          <bdi>{formatDateTime(draft.updated_at ?? draft.created_at, locale)}</bdi>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            disabled={isPending}
            className="underline-offset-2 hover:text-fg hover:underline disabled:opacity-50"
            data-testid="draft-delete"
          >
            {t('delete')}
          </button>
        </span>
      </div>
      {error && <FieldError>{error}</FieldError>}
      <DeleteConfirmDialog
        open={confirming}
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false)
          setError(null)
          startTransition(async () => {
            const result = await deleteDraft(caseId, draft.id)
            if (result.error) setError(resolveError(result.error, 'deleteFailed'))
          })
        }}
        kind="soft"
        itemLabel={draft.title}
        confirmLabel={t('delete')}
      />
    </li>
  )
}
