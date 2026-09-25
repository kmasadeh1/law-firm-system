'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { setEnquiryStatus } from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import type { Database } from '@/lib/supabase/database.types'

type EnquiryStatus = Database['public']['Enums']['enquiry_status']

const STATUS_VALUES: EnquiryStatus[] = ['new', 'assigned', 'resolved']

export function StatusSection({ enquiryId, currentStatus }: { enquiryId: string; currentStatus: EnquiryStatus }) {
  const t = useTranslations('dashboard.enquiries')
  const tStatus = useTranslations('dashboard.enquiries.status')
  const [status, setStatus] = useState<EnquiryStatus>(currentStatus)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const changed = status !== currentStatus

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await setEnquiryStatus(enquiryId, status)
      if (result.error) {
        setError(result.error)
        setStatus(currentStatus)
        return
      }
      setSaved(true)
    })
  }

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-heading text-lg text-fg">{t('detail.status.heading')}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as EnquiryStatus)
            setSaved(false)
          }}
          className={controlClass}
        >
          {STATUS_VALUES.map((value) => (
            <option key={value} value={value}>
              {tStatus(value)}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" onClick={handleSave} disabled={isPending || !changed}>
          {isPending ? t('detail.status.saving') : t('detail.status.saveStatus')}
        </Button>
        {saved && !changed && <FieldSuccess>{t('detail.status.saved')}</FieldSuccess>}
      </div>
      {error && <FieldError>{error}</FieldError>}
    </Panel>
  )
}
