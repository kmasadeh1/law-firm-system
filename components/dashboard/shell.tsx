'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Crest } from '@/components/crest'
import { ThemeToggle } from './theme-toggle'
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
} as const

export type IconKey = keyof typeof iconByKey

export type NavItem = {
  href: string
  label: string
  icon: IconKey
}

function isActive(pathname: string, href: string) {
  if (href === '/dashboard/owner' || href === '/dashboard/staff') {
    return pathname === href
  }
  return pathname === href || pathname.startsWith(href + '/')
}

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="flex flex-col gap-1">
      {items.map((item) => {
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
    </nav>
  )
}

export function DashboardShell({
  firmName,
  homeHref,
  navItems,
  userName,
  roleLabel,
  logoutAction,
  initialTheme,
  children,
}: {
  firmName: string
  homeHref: string
  navItems: NavItem[]
  userName: string
  roleLabel: string
  logoutAction: () => Promise<void>
  initialTheme: Theme
  children: React.ReactNode
}) {
  const [drawerOpen, setDrawerOpen] = useState(false)

  const sidebarContent = (
    <>
      <Link href={homeHref} className="flex items-center gap-2.5 px-1 py-1">
        <Crest className="h-7 w-7 text-accent" />
        <span className="font-heading text-base text-fg">{firmName}</span>
      </Link>

      <div className="mt-6 flex-1 overflow-y-auto">
        <NavLinks items={navItems} onNavigate={() => setDrawerOpen(false)} />
      </div>

      <div className="flex flex-col gap-3 border-t border-line pt-4">
        <div className="px-1">
          <p className="truncate text-sm font-medium text-fg">{userName}</p>
          <p className="text-xs text-fg-muted">{roleLabel}</p>
        </div>
        <ThemeToggle initialTheme={initialTheme} />
        <form action={logoutAction}>
          <button
            type="submit"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-line/40 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <LogoutIcon className="h-4 w-4" />
            Log out
          </button>
        </form>
      </div>
    </>
  )

  return (
    <div className="dashboard min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 start-0 hidden w-64 flex-col border-e border-line bg-surface p-4 md:flex">
        {sidebarContent}
      </aside>

      {/* Mobile top bar */}
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 md:hidden">
        <Link href={homeHref} className="flex items-center gap-2">
          <Crest className="h-6 w-6 text-accent" />
          <span className="font-heading text-base text-fg">{firmName}</span>
        </Link>
        <div className="flex items-center gap-1">
          <ThemeToggle initialTheme={initialTheme} compact />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 items-center justify-center rounded-md text-fg transition-colors hover:bg-line/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="absolute inset-y-0 start-0 flex w-72 max-w-[85vw] flex-col border-e border-line bg-surface p-4">
            <div className="mb-2 flex items-center justify-end">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-md text-fg-muted hover:bg-line/40 hover:text-fg"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            {sidebarContent}
          </div>
        </div>
      )}

      <main className="min-h-screen px-4 py-8 sm:px-6 md:ms-64 md:px-8 md:py-10">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  )
}
