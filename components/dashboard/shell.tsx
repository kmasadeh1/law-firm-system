'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Crest } from '@/components/crest'
import { ThemeToggle } from './theme-toggle'
import { LocaleToggle } from './locale-toggle'
import type { Theme } from './theme-store'
import {
  MenuIcon,
  CloseIcon,
  LogoutIcon,
  HomeIcon,
  ClientsIcon,
  CasesIcon,
  AppointmentsIcon,
  RolesIcon,
  FeesIcon,
  DeadlinesIcon,
  PeriodTypesIcon,
  StaffIcon,
  ActivityIcon,
  EnquiriesIcon,
  ReportsIcon,
} from './icons'

// A component reference can't cross the server->client prop boundary (the
// nav items are built in a Server Component), so the server side passes a
// string key instead and this map resolves it to the actual icon here.
const iconByKey = {
  home: HomeIcon,
  clients: ClientsIcon,
  cases: CasesIcon,
  appointments: AppointmentsIcon,
  roles: RolesIcon,
  fees: FeesIcon,
  deadlines: DeadlinesIcon,
  'period-types': PeriodTypesIcon,
  staff: StaffIcon,
  activity: ActivityIcon,
  enquiries: EnquiriesIcon,
  reports: ReportsIcon,
} as const

export type IconKey = keyof typeof iconByKey

export type NavItem = {
  href: string
  label: string
  icon: IconKey
}

export type NavGroup = {
  title: string
  items: NavItem[]
}

// First letter of the first two words, uppercased - toLocaleUpperCase is a
// no-op on scripts without case (Arabic), so this works for either locale's
// names without a locale check.
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toLocaleUpperCase()
}

function isActive(pathname: string, href: string) {
  if (href === '/dashboard/owner' || href === '/dashboard/staff') {
    return pathname === href
  }
  return pathname === href || pathname.startsWith(href + '/')
}

function NavLinks({ groups, onNavigate }: { groups: NavGroup[]; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-5">
      {groups
        .filter((group) => group.items.length > 0)
        .map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <p className="px-3 text-xs font-medium text-fg-muted/80">{group.title}</p>
            {group.items.map((item) => {
              const active = isActive(pathname, item.href)
              const Icon = iconByKey[item.icon]
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
                    active
                      ? 'bg-accent text-accent-fg'
                      : 'text-fg-muted hover:bg-line/40 hover:text-fg'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        ))}
    </nav>
  )
}

export function DashboardShell({
  firmName,
  homeHref,
  navGroups,
  userName,
  roleLabel,
  logoutAction,
  initialTheme,
  children,
}: {
  firmName: string
  homeHref: string
  navGroups: NavGroup[]
  userName: string
  roleLabel: string
  logoutAction: () => Promise<void>
  initialTheme: Theme
  children: React.ReactNode
}) {
  const t = useTranslations('dashboard.shell')
  const [drawerOpen, setDrawerOpen] = useState(false)

  const sidebarContent = (
    <>
      <Link href={homeHref} className="flex items-center gap-2.5 px-1 py-1">
        <Crest className="h-8 w-8" />
        <span className="font-heading text-base text-fg">{firmName}</span>
      </Link>

      <div className="mt-6 flex-1 overflow-y-auto">
        <NavLinks groups={navGroups} onNavigate={() => setDrawerOpen(false)} />
      </div>
    </>
  )

  return (
    <div className="dashboard min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 hidden w-64 flex-col border-e border-line bg-surface p-4 md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label={t('closeMenu')}
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col border-e border-line bg-surface p-4">
            <div className="mb-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label={t('closeMenu')}
                className="flex h-9 w-9 items-center justify-center rounded-md text-fg-muted hover:bg-line/40 hover:text-fg"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      <div className="min-h-screen md:ms-64">
        {/* Content header: spans the main content area, above the page's own
            title (PageHeader, rendered by each page inside children - this
            bar is shell-level chrome, the two are deliberately not merged).
            Sticky, opaque (bg-surface/border-line) so it separates from
            scrolled content the same way the sidebar separates from the
            main column.

            Deliberately NOT aligned to the sidebar's brand-block height -
            that block stays taller (it's the identity anchor), this is a
            plain utility bar and reads as more finished short than
            stretched to match: py-2 with the row's h-9 controls lands
            around 52px total, not the brand block's own height. Horizontal
            padding matches <main> below it (px-4 sm:px-6 md:px-8) so the
            header's edges stay aligned with the content column it sits
            above.

            Inline-start holds the mobile nav trigger (the aside it opens is
            hidden below md, so this is its only home); everything else is
            pushed to inline-end via ms-auto as two groups separated by one
            divider: theme + language (what you'd change), then the account
            - avatar, name/role, log out - grouped together because log out
            acts on the account, not on the page. Plain flex row, so it
            mirrors under dir="rtl" the same way the rest of the app relies
            on for start/end layout; the language pair's own internal order
            mirrors the same way, for the same reason. */}
        <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-line bg-surface px-4 py-2 sm:px-6 md:px-8">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t('openMenu')}
            className="flex h-9 w-9 items-center justify-center rounded-md text-fg transition-colors hover:bg-line/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:hidden"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-1 ms-auto sm:gap-2">
            <ThemeToggle initialTheme={initialTheme} />
            <LocaleToggle />
          </div>

          <div className="ms-2 flex items-center gap-2 border-s border-line ps-3 sm:ms-3">
            {/* The avatar/name block is a link to the signed-in staff
                member's own Settings page, not a display-only identity mark
                - personal settings are an account affordance, reached from
                here rather than the sidebar (which is for the app's
                sections, not the account). */}
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-2 rounded-md transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              {/* Fixed dark-on-brass, independent of the light/dark toggle -
                  a brand-identity mark (same reasoning as the crest) rather
                  than a theme-reactive control, so it stays legible and
                  recognisable in either dashboard theme. ink/brass are the
                  same shared-palette tokens the public site's identity uses
                  (5.90:1, already measured). */}
              <span
                aria-hidden="true"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-xs font-medium text-brass"
              >
                {initials(userName)}
              </span>

              <p className="max-w-[8rem] truncate text-sm leading-tight text-fg sm:max-w-[12rem]">
                <span className="font-medium">
                  <bdi>{userName}</bdi>
                </span>
                <span className="text-fg-muted">
                  {' · '}
                  <bdi>{roleLabel}</bdi>
                </span>
              </p>
            </Link>

            {/* Quiet by colour/weight, not by omission: an unlabelled icon
                is a bad fit for this audience for a destructive action.
                Label shows at sm and up, same breakpoint the theme and
                language controls already use - icon-only only below that,
                where the row genuinely can't fit a labelled control. */}
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label={t('logOut')}
                className="flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm text-fg-muted/70 transition-colors hover:text-fg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <LogoutIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{t('logOut')}</span>
              </button>
            </form>
          </div>
        </header>

        <main className="px-4 py-8 sm:px-6 md:px-8 md:py-10">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
