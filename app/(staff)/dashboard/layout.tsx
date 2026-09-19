import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell, type NavItem } from '@/components/dashboard/shell'
import { getThemeCookie } from '@/components/dashboard/get-theme-cookie'
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

  const [{ data: staffRow }, { data: clientsManage }, { data: feesView }, initialTheme] = await Promise.all([
    supabase.from('staff').select('full_name, user_type, roles(name)').eq('id', user.sub as string).maybeSingle(),
    supabase.rpc('has_permission', { p_key: 'clients_manage' }),
    supabase.rpc('has_permission', { p_key: 'fees_view' }),
    getThemeCookie(),
  ])

  const isOwner = staffRow?.user_type === 'owner'
  const homeHref = isOwner ? '/dashboard/owner' : '/dashboard/staff'

  const navItems: NavItem[] = [{ href: homeHref, label: 'Home', icon: 'home' }]
  if (isOwner || clientsManage) {
    navItems.push({ href: '/dashboard/clients', label: 'Clients', icon: 'clients' })
  }
  navItems.push({ href: '/dashboard/cases', label: 'Cases', icon: 'cases' })
  navItems.push({ href: '/dashboard/appointments', label: 'Appointments', icon: 'appointments' })
  // Deadlines has no single gating permission (owner, cases_manage,
  // court_dates_manage, or just being on the case's team all qualify), so
  // - like Cases and Appointments - it's always shown and RLS scopes what's
  // actually visible.
  navItems.push({ href: '/dashboard/deadlines', label: 'Deadlines', icon: 'deadlines' })
  if (isOwner || feesView) {
    navItems.push({ href: '/dashboard/fees', label: 'Fees & payments', icon: 'fees' })
  }
  if (isOwner) {
    navItems.push({ href: '/dashboard/owner/roles', label: 'Roles & permissions', icon: 'roles' })
    navItems.push({
      href: '/dashboard/owner/deadline-period-types',
      label: 'Deadline period types',
      icon: 'period-types',
    })
  }

  const roleLabel = isOwner ? 'Owner' : (staffRow?.roles?.name ?? 'Staff')

  return (
    <DashboardShell
      firmName="Ahmad Al-Masadeh & Associates"
      homeHref={homeHref}
      navItems={navItems}
      userName={staffRow?.full_name ?? 'Signed in'}
      roleLabel={roleLabel}
      logoutAction={logout}
      initialTheme={initialTheme ?? 'light'}
    >
      {children}
    </DashboardShell>
  )
}
