'use client'

import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { requestLeave } from './actions'
import { resolveLeaveRequestError } from './error-codes'
import { Field, Label, FieldError, controlClass } from '@/components/dashboard/form'
import { Button } from '@/components/dashboard/button'

export function RequestLeaveForm() {
  const t = useTranslations('dashboard.leaveRequests.form')
  const tErrors = useTranslations('dashboard.leaveRequests.errors')
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await requestLeave(formData)
      if (result.error) {
        setError(resolveLeaveRequestError(result.error, tErrors))
        return
      }
      formRef.current?.reset()
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <Field>
        <Label htmlFor="start_date" required>
          {t('startDateLabel')}
        </Label>
        <input id="start_date" name="start_date" type="date" required className={controlClass} />
      </Field>
      <Field>
        <Label htmlFor="end_date" required>
          {t('endDateLabel')}
        </Label>
        <input id="end_date" name="end_date" type="date" required className={controlClass} />
      </Field>
      <Button type="submit" variant="primary" disabled={isPending} data-testid="request-leave-submit">
        {isPending ? t('submitting') : t('submit')}
      </Button>
      {error && <FieldError data-testid="request-leave-error">{error}</FieldError>}
    </form>
  )
}
