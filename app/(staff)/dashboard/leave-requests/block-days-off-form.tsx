'use client'

import { useRef, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { blockDaysOff } from './actions'
import { resolveLeaveRequestError } from './error-codes'
import { Field, Label, FieldError, controlClass } from '@/components/dashboard/form'
import { Button } from '@/components/dashboard/button'

// The owner's own version of RequestLeaveForm - same two date fields, but
// this submits already-decided leave (blockDaysOff inserts status
// 'approved'), so nothing on it says "request", "submit for approval" or
// "awaiting approval". There's nobody above the owner to approve it.
export function BlockDaysOffForm() {
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
      const result = await blockDaysOff(formData)
      if (result.error) {
        setError(resolveLeaveRequestError(result.error, tErrors))
        return
      }
      formRef.current?.reset()
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} onChange={() => setError(null)} className="flex flex-wrap items-end gap-3">
      <Field>
        <Label htmlFor="block_start_date" required>
          {t('startDateLabel')}
        </Label>
        <input id="block_start_date" name="start_date" type="date" required className={controlClass} />
      </Field>
      <Field>
        <Label htmlFor="block_end_date" required>
          {t('endDateLabel')}
        </Label>
        <input id="block_end_date" name="end_date" type="date" required className={controlClass} />
      </Field>
      <Button type="submit" variant="primary" disabled={isPending} data-testid="block-days-off-submit">
        {isPending ? t('blocking') : t('block')}
      </Button>
      {error && <FieldError data-testid="block-days-off-error">{error}</FieldError>}
    </form>
  )
}
