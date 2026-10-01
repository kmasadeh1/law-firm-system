import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { getThemeCookie } from '@/components/dashboard/get-theme-cookie'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { LinkButton } from '@/components/dashboard/button'
import { ThemeToggle } from '@/components/dashboard/theme-toggle'
import { LocaleToggle } from '@/components/dashboard/locale-toggle'
import { SettingsForm } from './settings-form'
import { WorkingHoursSection, type WorkingHoursRow } from './working-hours-section'

export default async function SettingsPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.settings' })
  const [{ data }, initialTheme] = await Promise.all([
    supabase.auth.getClaims(),
    getThemeCookie(),
  ])
  const user = data?.claims

  // Same per-request claims fetch above already gives us the staff id, so
  // working hours rides along in this same wave rather than a separate
  // round trip - parallel with staffRow, not serial after it.
  const [{ data: staffRow }, { data: hoursRows }] = user
    ? await Promise.all([
        supabase.from('staff').select('full_name, phone').eq('id', user.sub as string).maybeSingle(),
        supabase
          .from('effective_working_hours')
          .select('day_of_week, start_time, end_time, is_override')
          .eq('staff_id', user.sub as string),
      ])
    : [{ data: null }, { data: null }]

  // Nothing is seeded - a day with no row at all (neither an override nor
  // the staff member's own row) is filled in here as a plain day off,
  // rather than only rendering the days that happen to exist.
  const hoursByDay = new Map((hoursRows ?? []).filter((r) => r.day_of_week !== null).map((r) => [r.day_of_week!, r]))
  const workingHoursRows: WorkingHoursRow[] = Array.from({ length: 7 }, (_, dayOfWeek) => {
    const row = hoursByDay.get(dayOfWeek)
    return {
      day_of_week: dayOfWeek,
      start_time: row?.start_time ?? null,
      end_time: row?.end_time ?? null,
      is_override: row?.is_override ?? false,
    }
  })

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} description={t('description')} />

      <Panel className="flex flex-col gap-3">
        <h2 className="font-heading text-lg text-fg">{t('profile.heading')}</h2>
        <SettingsForm profile={{ full_name: staffRow?.full_name ?? '', phone: staffRow?.phone ?? null }} />
      </Panel>

      <Panel className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-lg text-fg">{t('language.heading')}</h2>
          <p className="text-sm text-fg-muted">{t('language.description')}</p>
        </div>
        <LocaleToggle />
      </Panel>

      <Panel className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-lg text-fg">{t('theme.heading')}</h2>
          <p className="text-sm text-fg-muted">{t('theme.description')}</p>
        </div>
        <ThemeToggle initialTheme={initialTheme ?? 'light'} />
      </Panel>

      <Panel className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-lg text-fg">{t('workingHours.heading')}</h2>
          <p className="text-sm text-fg-muted">{t('workingHours.description')}</p>
        </div>
        <WorkingHoursSection rows={workingHoursRows} />
      </Panel>

      <Panel className="flex flex-col gap-3">
        <div>
          <h2 className="font-heading text-lg text-fg">{t('password.heading')}</h2>
          <p className="text-sm text-fg-muted">{t('password.description')}</p>
        </div>
        <LinkButton href="/change-password" variant="secondary" className="self-start">
          {t('password.changePassword')}
        </LinkButton>
      </Panel>
    </div>
  )
}
