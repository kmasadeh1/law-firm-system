'use client'

import { useState, useTransition } from 'react'
import { setEnquiryStatus } from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import type { Database } from '@/lib/supabase/database.types'

type EnquiryStatus = Database['public']['Enums']['enquiry_status']

const STATUS_OPTIONS: { value: EnquiryStatus; label: string }[] = [
  { value: 'new', label: 'New' },
  { value: 'assigned', label: 'Assigned' },
  { value: 'resolved', label: 'Resolved' },
]

export function StatusSection({ enquiryId, currentStatus }: { enquiryId: string; currentStatus: EnquiryStatus }) {
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
      <h2 className="font-heading text-lg text-fg">Status</h2>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as EnquiryStatus)
            setSaved(false)
          }}
          className={controlClass}
        >
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" onClick={handleSave} disabled={isPending || !changed}>
          {isPending ? 'Saving…' : 'Save status'}
        </Button>
        {saved && !changed && <FieldSuccess>Saved</FieldSuccess>}
      </div>
      {error && <FieldError>{error}</FieldError>}
    </Panel>
  )
}
