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
            main column - the public site's header doesn't need this since
            it isn't sticky, so it's a deliberate divergence from that
            sibling, not a miss. py-4 (rather than the public header's own
            py-5) keeps it close to the sidebar's own p-4 brand-block
            padding, so the two line up as one band rather than reading as
            independently positioned; horizontal padding matches <main>
            below it (px-4 sm:px-6 md:px-8), not the public header's wider
            scale, so the header's edges stay aligned with the content
            column it sits above.

            Inline-start holds the mobile nav trigger (the aside it opens is
            hidden below md, so this is its only home); everything else is
            pushed to inline-end via ms-auto, in reading order theme,
            account, log out (set apart with its own divider, the quietest
            thing here since it's rare and semi-destructive), then the
            language pair outermost - mirroring the public header's own
            "content, then language, last" rhythm. Plain flex row, so it
            mirrors under dir="rtl" the same way the rest of the app already
            relies on for start/end layout - the language pair's own
            internal order mirrors the same way, for the same reason. */}
        <header className="sticky top-0 z-40 flex items-center gap-2 border-b border-line bg-surface px-4 py-4 sm:px-6 md:px-8">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label={t('openMenu')}
            className="flex h-9 w-9 items-center justify-center rounded-md text-fg transition-colors hover:bg-line/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus md:hidden"
          >
            <MenuIcon className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2 ms-auto sm:gap-3">
            <ThemeToggle initialTheme={initialTheme} />

            <p className="max-w-[10rem] truncate text-sm text-fg sm:max-w-[14rem]">
              <span className="font-medium">{userName}</span>
              <span className="text-fg-muted"> · {roleLabel}</span>
            </p>

            {/* Quiet by colour/weight, not by omission: an unlabelled icon
                is a bad fit for this audience for a destructive action.
                Label shows at sm and up, same breakpoint the theme and
                language controls already use - icon-only only below that,
                where the row genuinely can't fit three labelled controls. */}
            <form action={logoutAction} className="ms-1 border-s border-line ps-2 sm:ms-2 sm:ps-3">
              <button
                type="submit"
                aria-label={t('logOut')}
                className="flex items-center gap-1.5 rounded-md px-1.5 py-1.5 text-sm text-fg-muted/70 transition-colors hover:text-fg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <LogoutIcon className="h-4 w-4" />
                <span className="hidden sm:inline">{t('logOut')}</span>
              </button>
            </form>

            <LocaleToggle />
          </div>
        </header>

        <main className="px-4 py-8 sm:px-6 md:px-8 md:py-10">
          <div className="mx-auto max-w-4xl">{children}</div>
        </main>
      </div>
    </div>
  )
}
