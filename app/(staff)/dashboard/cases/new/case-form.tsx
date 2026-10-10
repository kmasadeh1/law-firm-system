'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { createCase, type CreateCaseErrorCode } from '../actions'
import { ClientPicker } from '../client-picker'
import { Field, Label, HelpText, FieldError, controlClass } from '@/components/dashboard/form'
import { Button } from '@/components/dashboard/button'
import { localizedName } from '@/lib/localized-name'

type CaseTypeOption = { id: string; name_en: string | null; name_ar: string | null }

// Closed set the server can return - anything else falls back to a generic
// translated message rather than passing an arbitrary value to t() as a key.
const CREATE_CASE_ERROR_CODES: CreateCaseErrorCode[] = [
  'selectClient',
  'titleRequired',
  'caseNumberRequired',
  'statusLookupFailed',
  'caseNumberInUse',
  'noPermission',
  'createFailed',
]

// Which input each server error refers to. Codes not listed (permission,
// lookup and generic failures) aren't about any field and stay until resubmit.
const ERROR_FIELDS: Partial<Record<CreateCaseErrorCode, string[]>> = {
  titleRequired: ['title'],
  caseNumberRequired: ['case_number'],
  caseNumberInUse: ['case_number'],
}

export function CaseForm({ caseTypes }: { caseTypes: CaseTypeOption[] }) {
  const router = useRouter()
  const locale = useLocale()
  const t = useTranslations('dashboard.cases.new')
  const tErrors = useTranslations('dashboard.cases.new.errors')
  const formRef = useRef<HTMLFormElement>(null)
  // errorFields: the inputs a server error is about. Editing one of them
  // clears the message, so a corrected form doesn't keep looking rejected.
  const [error, setError] = useState<{ message: string; fields: string[] } | null>(null)
  const [isPending, startTransition] = useTransition()

  function resolveError(code: CreateCaseErrorCode) {
    const known = (CREATE_CASE_ERROR_CODES as string[]).includes(code)
    return {
      message: known ? tErrors(code) : tErrors('createFailed'),
      fields: ERROR_FIELDS[code] ?? [],
    }
  }

  function clearErrorFor(field: string) {
    setError((current) => (current && current.fields.includes(field) ? null : current))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)

    startTransition(async () => {
      const result = await createCase(formData)
      if (result.error) {
        setError(resolveError(result.error))
        return
      }
      if (result.caseId) {
        router.push(`/dashboard/cases/${result.caseId}`)
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ClientPicker />

      <Field>
        <Label htmlFor="title" required>
          {t('titleLabel')}
        </Label>
        <input id="title" name="title" required onChange={() => clearErrorFor('title')} className={controlClass} />
      </Field>

      <Field>
        <Label htmlFor="case_number" required>
          {t('caseNumberLabel')}
        </Label>
        <input
          id="case_number"
          name="case_number"
          required
          onChange={() => clearErrorFor('case_number')}
          className={controlClass}
        />
        <HelpText>{t('caseNumberHelp')}</HelpText>
      </Field>

      <Field>
        <Label htmlFor="case_type_id">{t('caseTypeLabel')}</Label>
        <select id="case_type_id" name="case_type_id" defaultValue="" className={controlClass}>
          <option value="">{t('selectCaseTypePlaceholder')}</option>
          {caseTypes.map((ct) => (
            <option key={ct.id} value={ct.id}>
              {localizedName({ name: ct.name_en ?? '', name_ar: ct.name_ar }, locale)}
            </option>
          ))}
        </select>
      </Field>

      {error && <FieldError>{error.message}</FieldError>}

      <Button type="submit" variant="primary" disabled={isPending} className="mt-2 self-start">
        {isPending ? t('creating') : t('submit')}
      </Button>
    </form>
  )
}
