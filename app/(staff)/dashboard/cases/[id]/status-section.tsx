'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { setCaseStatus } from '../actions'
import { Panel } from '@/components/dashboard/panel'
import { Button } from '@/components/dashboard/button'
import { FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { localizedName } from '@/lib/localized-name'

type StatusOption = { id: string; name: string; name_ar: string | null; is_terminal: boolean }

export function StatusSection({
  caseId,
  currentStatusId,
  statuses,
}: {
  caseId: string
  currentStatusId: string
  statuses: StatusOption[]
}) {
  const locale = useLocale()
  const t = useTranslations('dashboard.cases.detail.status')
  const [statusId, setStatusId] = useState(currentStatusId)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const changed = statusId !== currentStatusId

  function handleSave() {
    setError(null)
    setSaved(false)
    startTransition(async () => {
      const result = await setCaseStatus(caseId, statusId)
      if (result.error) {
        setError(result.error)
        setStatusId(currentStatusId)
        return
      }
      setSaved(true)
    })
  }

  return (
    <Panel className="flex flex-col gap-3" data-testid="case-status-section">
      <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <select
          id="status_id"
          value={statusId}
          onChange={(e) => {
            setStatusId(e.target.value)
            setSaved(false)
          }}
          className={controlClass}
        >
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {localizedName(s, locale)}
            </option>
          ))}
        </select>
        <Button type="button" variant="secondary" onClick={handleSave} disabled={isPending || !changed}>
          {isPending ? t('saving') : t('saveStatus')}
        </Button>
        {saved && !changed && <FieldSuccess>{t('saved')}</FieldSuccess>}
      </div>
      {error && <FieldError>{error}</FieldError>}
    </Panel>
  )
}
