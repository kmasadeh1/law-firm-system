import { redirect } from 'next/navigation'
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

  const dailyWork: NavItem[] = [{ href: homeHref, label: 'Home', icon: 'home' }]
  if (isOwner || clientsManage) {
    dailyWork.push({ href: '/dashboard/clients', label: 'Clients', icon: 'clients' })
  }
  if (isOwner || enquiriesManage) {
    dailyWork.push({ href: '/dashboard/enquiries', label: 'Enquiries', icon: 'enquiries' })
  }
  dailyWork.push({ href: '/dashboard/cases', label: 'Cases', icon: 'cases' })
  dailyWork.push({ href: '/dashboard/appointments', label: 'Appointments', icon: 'appointments' })
  // Deadlines has no single gating permission (owner, cases_manage,
  // court_dates_manage, or just being on the case's team all qualify), so
  // - like Cases and Appointments - it's always shown and RLS scopes what's
  // actually visible.
  dailyWork.push({ href: '/dashboard/deadlines', label: 'Deadlines', icon: 'deadlines' })

  const money: NavItem[] = []
  if (isOwner || feesView) {
    money.push({ href: '/dashboard/fees', label: 'Fees & payments', icon: 'fees' })
  }

  const administration: NavItem[] = []
  if (isOwner) {
    administration.push({ href: '/dashboard/owner/staff', label: 'Staff accounts', icon: 'staff' })
    administration.push({ href: '/dashboard/owner/roles', label: 'Roles & permissions', icon: 'roles' })
    administration.push({
      href: '/dashboard/owner/deadline-period-types',
      label: 'Deadline period types',
      icon: 'period-types',
    })
    administration.push({ href: '/dashboard/owner/activity', label: 'Activity log', icon: 'activity' })
  }
  if (isOwner || reportsView) {
    administration.push({ href: '/dashboard/reports', label: 'Reports', icon: 'reports' })
  }

  // A group with no visible items must not render at all - no empty
  // section header left dangling for a role (e.g. Lawyer, with no fees
  // permission and no owner-only screens) that can't see anything in it.
  // NavLinks also filters defensively, but building the list already-clean
  // keeps this the single source of truth for what a role sees.
  const navGroups: NavGroup[] = [
    { title: 'Daily work', items: dailyWork },
    { title: 'Money', items: money },
    { title: 'Administration', items: administration },
  ].filter((group) => group.items.length > 0)

  const locale = staffRow?.locale === 'ar' ? 'ar' : 'en'
  const roleLabel = isOwner ? 'Owner' : staffRow?.roles ? localizedName(staffRow.roles, locale) : 'Staff'

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
