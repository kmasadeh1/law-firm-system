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

export default async function SettingsPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.settings' })
  const [{ data }, initialTheme] = await Promise.all([
    supabase.auth.getClaims(),
    getThemeCookie(),
  ])
  const user = data?.claims

  const { data: staffRow } = user
    ? await supabase.from('staff').select('full_name, phone').eq('id', user.sub as string).maybeSingle()
    : { data: null }

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
