'use client'

import { useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { saveWorkingHours, type WorkingHoursDay } from './actions'
import { resolveWorkingHoursError } from './working-hours-error-codes'
import { Button } from '@/components/dashboard/button'
import { FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { formatTimeOfDay } from '@/lib/format-date-time'

export type WorkingHoursRow = {
  day_of_week: number
  start_time: string | null
  end_time: string | null
  is_override: boolean
}

type EditableDay = {
  day_of_week: number
  is_override: boolean
  dayOff: boolean
  start: string
  end: string
}

function toEditableDay(row: WorkingHoursRow): EditableDay {
  return {
    day_of_week: row.day_of_week,
    is_override: row.is_override,
    dayOff: row.start_time === null || row.end_time === null,
    // <input type="time"> wants "HH:MM" - the DB gives "HH:MM:SS".
    start: row.start_time ? row.start_time.slice(0, 5) : '',
    end: row.end_time ? row.end_time.slice(0, 5) : '',
  }
}

export function WorkingHoursSection({ rows }: { rows: WorkingHoursRow[] }) {
  const locale = useLocale()
  const t = useTranslations('dashboard.settings.workingHours')
  const tDay = useTranslations('dashboard.settings.workingHours.day')
  const tErrors = useTranslations('dashboard.settings.workingHours.errors')
  const [days, setDays] = useState<EditableDay[]>(() => rows.map(toEditableDay))
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function updateDay(dayOfWeek: number, patch: Partial<EditableDay>) {
    setSaved(false)
    setDays((prev) => prev.map((d) => (d.day_of_week === dayOfWeek ? { ...d, ...patch } : d)))
  }

  function handleSave() {
    setError(null)
    setSaved(false)
    const payload: WorkingHoursDay[] = days
      .filter((d) => !d.is_override)
      .map((d) => ({
        day_of_week: d.day_of_week,
        start_time: d.dayOff ? null : d.start || null,
        end_time: d.dayOff ? null : d.end || null,
      }))

    startTransition(async () => {
      const result = await saveWorkingHours(payload)
      if (result.error) {
        setError(resolveWorkingHoursError(result.error, tErrors))
        return
      }
      setSaved(true)
    })
  }

  return (
    <div className="flex flex-col gap-3" data-testid="working-hours-section">
      <ul className="flex flex-col divide-y divide-line rounded-md border border-line">
        {days.map((day) => (
          <li key={day.day_of_week} className="flex flex-wrap items-center gap-3 px-3 py-2.5 text-sm">
            <span className="w-24 shrink-0 font-medium text-fg">{tDay(String(day.day_of_week))}</span>

            {day.is_override ? (
              <span className="text-fg-muted">
                {day.dayOff
                  ? t('dayOff')
                  : t('overrideHoursLine', {
                      start: formatTimeOfDay(day.start, locale),
                      end: formatTimeOfDay(day.end, locale),
                    })}{' '}
                <span className="text-xs">({t('setByOffice')})</span>
              </span>
            ) : (
              <label className="flex items-center gap-1.5 text-fg-muted">
                <input
                  type="checkbox"
                  checked={day.dayOff}
                  onChange={(e) => updateDay(day.day_of_week, { dayOff: e.target.checked })}
                  data-testid={`working-hours-day-off-${day.day_of_week}`}
                />
                {t('dayOff')}
              </label>
            )}

            {!day.is_override && !day.dayOff && (
              <span className="flex items-center gap-2">
                <input
                  type="time"
                  value={day.start}
                  onChange={(e) => updateDay(day.day_of_week, { start: e.target.value })}
                  className={controlClass}
                  data-testid={`working-hours-start-${day.day_of_week}`}
                />
                <span className="text-fg-muted">{t('to')}</span>
                <input
                  type="time"
                  value={day.end}
                  onChange={(e) => updateDay(day.day_of_week, { end: e.target.value })}
                  className={controlClass}
                  data-testid={`working-hours-end-${day.day_of_week}`}
                />
              </span>
            )}
          </li>
        ))}
      </ul>

      <div className="flex items-center gap-2">
        <Button type="button" variant="secondary" onClick={handleSave} disabled={isPending} className="self-start">
          {isPending ? t('saving') : t('save')}
        </Button>
        <FieldSuccess show={saved}>{t('saved')}</FieldSuccess>
      </div>
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}
