'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import {
  createTemplate,
  setTemplateActive,
  updateTemplate,
  type TemplateErrorCode,
  type TemplateRow,
} from './actions'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Button } from '@/components/dashboard/button'
import { Switch } from '@/components/dashboard/switch'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { localizedName } from '@/lib/localized-name'
import { DOCUMENT_PLACEHOLDERS } from '@/lib/document-placeholders'

type CaseTypeOption = { id: string; name: string; is_active: boolean }

const ERROR_CODES: TemplateErrorCode[] = ['noName', 'noBody', 'noPermission', 'createFailed', 'saveFailed']

function useResolveError() {
  const tErrors = useTranslations('dashboard.admin.templates.errors')
  return (code: TemplateErrorCode | undefined, fallback: TemplateErrorCode) =>
    tErrors(code && ERROR_CODES.includes(code) ? code : fallback)
}

// Templates are plain text with {{placeholders}}; they are filled from a
// case on the server when a draft is generated. Rendered straight from the
// server's rows - every action revalidates the page. No delete control:
// there is no DELETE grant, so a template is deactivated instead.
export function TemplatesAdmin({ templates, caseTypes }: { templates: TemplateRow[]; caseTypes: CaseTypeOption[] }) {
  const t = useTranslations('dashboard.admin.templates')

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]" data-testid="templates-admin">
      <div className="flex min-w-0 flex-col gap-6">
        <Panel className="flex flex-col gap-3" data-testid="template-create">
          <h2 className="font-heading text-lg text-fg">{t('createHeading')}</h2>
          <TemplateForm caseTypes={caseTypes} />
        </Panel>

        {templates.length === 0 && <EmptyState title={t('noneYet')} description={t('noneYetDescription')} />}

        {templates.map((template) => (
          <TemplateCard key={template.id} template={template} caseTypes={caseTypes} />
        ))}
      </div>

      <PlaceholderList />
    </div>
  )
}

// The placeholders a body may use, beside the editor. Each is written
// exactly as shown; anything else becomes a visible "unknown placeholder"
// marker in the draft rather than silently vanishing.
function PlaceholderList() {
  const t = useTranslations('dashboard.admin.templates')
  const tLabels = useTranslations('dashboard.documentPlaceholders')
  // The same sentence the draft editor shows - one wording for how --- lines
  // lay out the printout, wherever the text is written.
  const tDrafts = useTranslations('dashboard.cases.detail.drafts')
  return (
    <aside className="lg:sticky lg:top-20 lg:self-start" data-testid="template-placeholders">
      <Panel className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold text-fg">{t('placeholdersHeading')}</h2>
        <p className="text-xs text-fg-muted">{t('placeholdersHelp')}</p>
        <p className="text-xs text-fg-muted" data-testid="template-sections-help">
          {tDrafts('sectionsHelp')}
        </p>
        <ul className="flex flex-col gap-1.5 text-xs">
          {DOCUMENT_PLACEHOLDERS.map((key) => (
            <li key={key} className="flex flex-col">
              <code dir="ltr" className="self-start rounded bg-line/40 px-1 py-0.5 font-mono text-fg">{`{{${key}}}`}</code>
              <span className="text-fg-muted">{tLabels(key)}</span>
            </li>
          ))}
        </ul>
      </Panel>
    </aside>
  )
}

// One form for create and edit - the fields are the same.
function TemplateForm({
  caseTypes,
  template,
  onSaved,
}: {
  caseTypes: CaseTypeOption[]
  template?: TemplateRow
  onSaved?: () => void
}) {
  const t = useTranslations('dashboard.admin.templates')
  const resolveError = useResolveError()
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()
  const idPrefix = template ? `template-${template.id}` : 'template-new'

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = template ? await updateTemplate(template.id, formData) : await createTemplate(formData)
      if (result.error) {
        setError(resolveError(result.error, template ? 'saveFailed' : 'createFailed'))
        return
      }
      if (template) {
        setSaved(true)
      } else {
        formRef.current?.reset()
      }
      onSaved?.()
    })
  }

  // A case type the template already uses stays selectable even if it has
  // since been deactivated; inactive ones are otherwise not offered.
  const options = caseTypes.filter((c) => c.is_active || c.id === template?.case_type_id)

  return (
    <form ref={formRef} onSubmit={handleSubmit} onChange={() => setSaved(false)} className="flex flex-col gap-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field>
          <Label htmlFor={`${idPrefix}-name-en`}>{t('nameEnLabel')}</Label>
          <input
            id={`${idPrefix}-name-en`}
            name="name_en"
            defaultValue={template?.name_en ?? ''}
            className={controlClass}
          />
        </Field>
        <Field>
          <Label htmlFor={`${idPrefix}-name-ar`}>{t('nameArLabel')}</Label>
          <input
            id={`${idPrefix}-name-ar`}
            name="name_ar"
            dir="rtl"
            lang="ar"
            defaultValue={template?.name_ar ?? ''}
            className={controlClass}
          />
        </Field>
      </div>

      <Field>
        <Label htmlFor={`${idPrefix}-case-type`}>{t('caseTypeLabel')}</Label>
        <select
          id={`${idPrefix}-case-type`}
          name="case_type_id"
          defaultValue={template?.case_type_id ?? ''}
          className={controlClass}
        >
          <option value="">{t('anyCaseType')}</option>
          {options.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-3 xl:grid-cols-2">
        <Field>
          <Label htmlFor={`${idPrefix}-body-en`}>{t('bodyEnLabel')}</Label>
          <textarea
            id={`${idPrefix}-body-en`}
            name="body_en"
            rows={10}
            dir="ltr"
            defaultValue={template?.body_en ?? ''}
            className={`font-mono text-sm ${controlClass}`}
            data-testid="template-body-en"
          />
        </Field>
        <Field>
          <Label htmlFor={`${idPrefix}-body-ar`}>{t('bodyArLabel')}</Label>
          <textarea
            id={`${idPrefix}-body-ar`}
            name="body_ar"
            rows={10}
            dir="rtl"
            lang="ar"
            defaultValue={template?.body_ar ?? ''}
            className={`text-sm ${controlClass}`}
            data-testid="template-body-ar"
          />
        </Field>
      </div>

      {error && <FieldError>{error}</FieldError>}
      <div className="flex items-center gap-3">
        <Button type="submit" variant={template ? 'secondary' : 'primary'} disabled={isPending} data-testid="template-save">
          {isPending ? t('saving') : template ? t('save') : t('create')}
        </Button>
        {saved && <FieldSuccess>{t('saved')}</FieldSuccess>}
      </div>
    </form>
  )
}

function TemplateCard({ template, caseTypes }: { template: TemplateRow; caseTypes: CaseTypeOption[] }) {
  const t = useTranslations('dashboard.admin.templates')
  const locale = useLocale()
  const resolveError = useResolveError()
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false)
  const [activeError, setActiveError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  const name = localizedName({ name: template.name_en ?? template.name_ar ?? '', name_ar: template.name_ar }, locale)
  const caseType = caseTypes.find((c) => c.id === template.case_type_id)

  function applyActive(next: boolean) {
    setActiveError(null)
    startTransition(async () => {
      const result = await setTemplateActive(template.id, next)
      if (result.error) setActiveError(resolveError(result.error, 'saveFailed'))
    })
  }

  return (
    <Panel
      className={`flex flex-col gap-3 ${template.is_active ? '' : 'opacity-75'}`}
      data-testid="template-card"
      data-active={template.is_active}
    >
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="font-heading text-lg text-fg">{name}</h2>
        <Badge variant="muted">{caseType ? caseType.name : t('anyCaseType')}</Badge>
        <div className="grow" />
        <Switch
          checked={template.is_active}
          disabled={isPending}
          onChange={(next) => (next ? applyActive(true) : setConfirmingDeactivate(true))}
          label={template.is_active ? t('activeLabel') : t('inactiveLabel')}
          data-testid="template-active"
        />
        <span className="text-sm text-fg-muted">{template.is_active ? t('active') : t('inactive')}</span>
      </div>
      {activeError && <FieldError>{activeError}</FieldError>}

      <TemplateForm caseTypes={caseTypes} template={template} />

      <DeleteConfirmDialog
        open={confirmingDeactivate}
        onCancel={() => setConfirmingDeactivate(false)}
        onConfirm={() => {
          setConfirmingDeactivate(false)
          applyActive(false)
        }}
        kind="deactivate"
        itemLabel={name}
        confirmLabel={t('deactivate')}
        note={t('deactivateNote')}
      />
    </Panel>
  )
}
