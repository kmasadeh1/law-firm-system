'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { createCase } from '../actions'
import { ClientPicker } from '../client-picker'
import { Field, Label, HelpText, FieldError, controlClass } from '@/components/dashboard/form'
import { Button } from '@/components/dashboard/button'

export function CaseForm() {
  const router = useRouter()
  const t = useTranslations('dashboard.cases.new')
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)

    startTransition(async () => {
      const result = await createCase(formData)
      if (result.error) {
        setError(result.error)
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
        <input id="title" name="title" required className={controlClass} />
      </Field>

      <Field>
        <Label htmlFor="case_number" required>
          {t('caseNumberLabel')}
        </Label>
        <input id="case_number" name="case_number" required className={controlClass} />
        <HelpText>{t('caseNumberHelp')}</HelpText>
      </Field>

      <Field>
        <Label htmlFor="case_type">{t('caseTypeLabel')}</Label>
        <input id="case_type" name="case_type" placeholder={t('caseTypePlaceholder')} className={controlClass} />
      </Field>

      {error && <FieldError>{error}</FieldError>}

      <Button type="submit" variant="primary" disabled={isPending} className="mt-2 self-start">
        {isPending ? t('creating') : t('submit')}
      </Button>
    </form>
  )
}
