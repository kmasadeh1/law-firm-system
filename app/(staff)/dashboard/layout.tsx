import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell, type NavGroup, type NavItem } from '@/components/dashboard/shell'
import { getThemeCookie } from '@/components/dashboard/get-theme-cookie'
import { localizedName } from '@/lib/localized-name'
import { logout } from './actions'

/**
 * Persistent shell for every /dashboard/* page. Nav visibility is computed
 * here from the same checks already used by each area's own layout guard
 * (has_permission / user_type) - this only decides what to SHOW, the
 * existing per-area guards still do the actual access control.
 */
export default async function DashboardLayout({ children }: LayoutProps<'/dashboard'>) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (!user) {
    redirect('/login')
  }

  const [
    { data: staffRow },
    { data: clientsManage },
    { data: feesView },
    { data: enquiriesManage },
    { data: reportsView },
    initialTheme,
  ] = await Promise.all([
    supabase
      .from('staff')
      .select('full_name, user_type, locale, roles(name, name_ar)')
      .eq('id', user.sub as string)
      .maybeSingle(),
    supabase.rpc('has_permission', { p_key: 'clients_manage' }),
    supabase.rpc('has_permission', { p_key: 'fees_view' }),
    supabase.rpc('has_permission', { p_key: 'enquiries_manage' }),
    supabase.rpc('has_permission', { p_key: 'reports_view' }),
    getThemeCookie(),
  ])

  const isOwner = staffRow?.user_type === 'owner'
  const homeHref = isOwner ? '/dashboard/owner' : '/dashboard/staff'

  const locale = staffRow?.locale === 'ar' ? 'ar' : 'en'
  const t = await getTranslations({ locale, namespace: 'dashboard.nav' })

  const dailyWork: NavItem[] = [{ href: homeHref, label: t('home'), icon: 'home' }]
  if (isOwner || clientsManage) {
    dailyWork.push({ href: '/dashboard/clients', label: t('clients'), icon: 'clients' })
  }
  if (isOwner || enquiriesManage) {
    dailyWork.push({ href: '/dashboard/enquiries', label: t('enquiries'), icon: 'enquiries' })
  }
  dailyWork.push({ href: '/dashboard/cases', label: t('cases'), icon: 'cases' })
  dailyWork.push({ href: '/dashboard/appointments', label: t('appointments'), icon: 'appointments' })
  // Deadlines has no single gating permission (owner, cases_manage,
  // court_dates_manage, or just being on the case's team all qualify), so
  // - like Cases and Appointments - it's always shown and RLS scopes what's
  // actually visible.
  dailyWork.push({ href: '/dashboard/deadlines', label: t('deadlines'), icon: 'deadlines' })

  const money: NavItem[] = []
  if (isOwner || feesView) {
    money.push({ href: '/dashboard/fees', label: t('feesAndPayments'), icon: 'fees' })
  }

  const administration: NavItem[] = []
  if (isOwner) {
    administration.push({ href: '/dashboard/owner/staff', label: t('staffAccounts'), icon: 'staff' })
    administration.push({ href: '/dashboard/owner/roles', label: t('rolesAndPermissions'), icon: 'roles' })
    administration.push({
      href: '/dashboard/owner/deadline-period-types',
      label: t('deadlinePeriodTypes'),
      icon: 'period-types',
    })
    administration.push({ href: '/dashboard/owner/activity', label: t('activityLog'), icon: 'activity' })
  }
  if (isOwner || reportsView) {
    administration.push({ href: '/dashboard/reports', label: t('reports'), icon: 'reports' })
  }

  // A group with no visible items must not render at all - no empty
  // section header left dangling for a role (e.g. Lawyer, with no fees
  // permission and no owner-only screens) that can't see anything in it.
  // NavLinks also filters defensively, but building the list already-clean
  // keeps this the single source of truth for what a role sees.
  const navGroups: NavGroup[] = [
    { title: t('groupDailyWork'), items: dailyWork },
    { title: t('groupMoney'), items: money },
    { title: t('groupAdministration'), items: administration },
  ].filter((group) => group.items.length > 0)

  const roleLabel = isOwner ? t('roleOwner') : staffRow?.roles ? localizedName(staffRow.roles, locale) : t('roleStaffFallback')

  return (
    <DashboardShell
      firmName="Ahmad Al-Masadeh & Associates"
      homeHref={homeHref}
      navGroups={navGroups}
      userName={staffRow?.full_name ?? 'Signed in'}
      roleLabel={roleLabel}
      logoutAction={logout}
      initialTheme={initialTheme ?? 'light'}
    >
      {children}
    </DashboardShell>
  )
}
