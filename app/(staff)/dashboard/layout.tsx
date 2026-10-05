import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell, type NavGroup, type NavItem } from '@/components/dashboard/shell'
import { getThemeCookie } from '@/components/dashboard/get-theme-cookie'
import { localizedName } from '@/lib/localized-name'
import { logout } from './actions'
import { loadBellData } from './notifications/data'
import { NotificationBell } from './notifications/notification-bell'

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
    { data: feesView },
    { data: enquiriesManage },
    { count: assignedEnquiryCount },
    { data: reportsView },
    { data: manageReferenceData },
    initialTheme,
    bellData,
  ] = await Promise.all([
    supabase
      .from('staff')
      .select('full_name, user_type, locale, roles(name, name_ar)')
      .eq('id', user.sub as string)
      .maybeSingle(),
    supabase.rpc('has_permission', { p_key: 'fees_view' }),
    supabase.rpc('has_permission', { p_key: 'enquiries_manage' }),
    // Someone with an enquiry assigned to them can read it under RLS even
    // without enquiries_manage - the nav has to offer the same link the
    // enquiries layout guard will actually let them through to.
    supabase.from('enquiries').select('id', { count: 'exact', head: true }).eq('assigned_to', user.sub as string),
    supabase.rpc('has_permission', { p_key: 'reports_view' }),
    supabase.rpc('can_manage_reference_data'),
    getThemeCookie(),
    // The bell is for everyone - no permission gates it. What each person
    // sees is already limited by RLS and the pending_alerts view.
    loadBellData(),
  ])

  const isOwner = staffRow?.user_type === 'owner'
  const homeHref = isOwner ? '/dashboard/owner' : '/dashboard/staff'

  const locale = staffRow?.locale === 'ar' ? 'ar' : 'en'
  const t = await getTranslations({ locale, namespace: 'dashboard.nav' })
  const tShell = await getTranslations({ locale, namespace: 'dashboard.shell' })

  const dailyWork: NavItem[] = [{ href: homeHref, label: t('home'), icon: 'home' }]
  // Unconditional, like Cases/Deadlines/Appointments below - the clients
  // SELECT policy now has three qualifying branches (owner, clients_manage,
  // or being on a case for that client), the same shape as those, so there's
  // no single permission left to gate the nav entry on. RLS scopes what the
  // list actually contains.
  dailyWork.push({ href: '/dashboard/clients', label: t('clients'), icon: 'clients' })
  if (isOwner || enquiriesManage || (assignedEnquiryCount ?? 0) > 0) {
    dailyWork.push({ href: '/dashboard/enquiries', label: t('enquiries'), icon: 'enquiries' })
  }
  dailyWork.push({ href: '/dashboard/cases', label: t('cases'), icon: 'cases' })
  // Unconditional - there's no permission key for this deliberately. The
  // page renders whatever RLS returns: your own requests, or everyone's if
  // you're the owner.
  dailyWork.push({ href: '/dashboard/leave-requests', label: t('leaveRequests'), icon: 'leave-requests' })
  dailyWork.push({ href: '/dashboard/appointments', label: t('appointments'), icon: 'appointments' })
  // Unconditional, same reasoning as Cases/Appointments/Deadlines - the
  // firm_hearing_schedule view is security_invoker, so it already returns
  // only the hearings on cases this user can see. An empty day for a role
  // with no visible cases is a normal state, not an access failure.
  dailyWork.push({ href: '/dashboard/hearings', label: t('hearings'), icon: 'hearings' })
  // Deadlines has no single gating permission (owner, cases_manage,
  // court_dates_manage, or just being on the case's team all qualify), so
  // - like Cases and Appointments - it's always shown and RLS scopes what's
  // actually visible.
  dailyWork.push({ href: '/dashboard/deadlines', label: t('deadlines'), icon: 'deadlines' })
  // Unconditional, same reasoning as Cases/Appointments/Deadlines above -
  // the read policy (owner, assignee, or creator) has no single permission
  // to gate the nav entry on, and RLS scopes what the list actually shows.
  dailyWork.push({ href: '/dashboard/tasks', label: t('tasks'), icon: 'tasks' })

  const money: NavItem[] = []
  if (isOwner || feesView) {
    money.push({ href: '/dashboard/fees', label: t('feesAndPayments'), icon: 'fees' })
  }

  const administration: NavItem[] = []
  if (isOwner) {
    administration.push({ href: '/dashboard/owner/staff', label: t('staffAccounts'), icon: 'staff' })
    administration.push({ href: '/dashboard/owner/roles', label: t('rolesAndPermissions'), icon: 'roles' })
  }
  // The same function the reference lists' write policies and their route
  // guard call - owner, or a role holding reference_data_manage.
  if (manageReferenceData === true) {
    administration.push({ href: '/dashboard/reference/courts', label: t('courts'), icon: 'courts' })
    administration.push({ href: '/dashboard/reference/case-types', label: t('caseTypes'), icon: 'case-types' })
    administration.push({
      href: '/dashboard/reference/referral-sources',
      label: t('referralSources'),
      icon: 'referral-sources',
    })
    administration.push({
      href: '/dashboard/reference/deadline-period-types',
      label: t('deadlinePeriodTypes'),
      icon: 'period-types',
    })
  }
  if (isOwner) {
    administration.push({ href: '/dashboard/owner/activity', label: t('activityLog'), icon: 'activity' })
    administration.push({
      href: '/dashboard/owner/site-content',
      label: t('siteContent'),
      icon: 'site-content',
    })
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

  // Ungrouped, not part of navGroups - Settings is personal, not a work
  // area, so it doesn't belong in Daily work/Money/Administration. Pinned
  // to the bottom of the sidebar by DashboardShell, plain link, no
  // expansion machinery for what is currently a single page.
  const settingsItem: NavItem = { href: '/dashboard/settings', label: t('settings'), icon: 'settings' }

  return (
    <DashboardShell
      firmName={tShell('firmName')}
      homeHref={homeHref}
      navGroups={navGroups}
      settingsItem={settingsItem}
      userName={staffRow?.full_name ?? 'Signed in'}
      roleLabel={roleLabel}
      logoutAction={logout}
      initialTheme={initialTheme ?? 'light'}
      notificationBell={<NotificationBell initial={bellData} />}
    >
      {children}
    </DashboardShell>
  )
}
