'use client'

import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { assignEnquiry } from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'

type StaffOption = { id: string; full_name: string }

export function AssignSection({
  enquiryId,
  currentAssignedTo,
  staffOptions,
}: {
  enquiryId: string
  currentAssignedTo: string | null
  staffOptions: StaffOption[]
}) {
  const t = useTranslations('dashboard.enquiries')
  const [assignedTo, setAssignedTo] = useState(currentAssignedTo ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const changed = assignedTo !== (currentAssignedTo ?? '')

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await assignEnquiry(enquiryId, assignedTo || null)
      if (result.error) {
        setError(result.error)
        setAssignedTo(currentAssignedTo ?? '')
        return
      }
      setSaved(true)
    })
  }

  return (
    <Panel className="flex flex-col gap-3">
      <h2 className="font-heading text-lg text-fg">{t('detail.assignment.heading')}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={assignedTo}
          onChange={(e) => {
            setAssignedTo(e.target.value)
            setSaved(false)
          }}
          className={controlClass}
        >
          <option value="">{t('list.unassigned')}</option>
          {staffOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.full_name}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" onClick={handleSave} disabled={isPending || !changed}>
          {isPending ? t('detail.assignment.saving') : t('detail.assignment.save')}
        </Button>
        {saved && !changed && <FieldSuccess>{t('detail.assignment.saved')}</FieldSuccess>}
      </div>
      {error && <FieldError>{error}</FieldError>}
    </Panel>
  )
}
