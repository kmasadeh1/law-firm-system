'use client'

import { useEffect, useId, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { LogoutIcon } from './icons'

// A disclosure, not an ARIA menu: aria-expanded/aria-controls on the
// trigger, plain link/button inside the panel, no role="menu", no
// role="menuitem", no arrow-key navigation - a real menu is a lot more
// code for a pattern nobody expects arrow keys in here.
export function AccountDrawer({
  userName,
  roleLabel,
  logoutAction,
}: {
  userName: string
  roleLabel: string
  logoutAction: () => Promise<void>
}) {
  const t = useTranslations('dashboard.shell')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  useEffect(() => {
    if (!open) return

    function handlePointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setOpen(false)
        triggerRef.current?.focus()
      }
    }
    // Tab moving focus out of the trigger+panel group closes it - focusout
    // bubbles, so one listener on the container catches focus leaving
    // either the trigger or any item inside the panel.
    function handleFocusOut(e: FocusEvent) {
      const next = e.relatedTarget as Node | null
      if (!next || (containerRef.current && !containerRef.current.contains(next))) {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    const container = containerRef.current
    container?.addEventListener('focusout', handleFocusOut)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
      container?.removeEventListener('focusout', handleFocusOut)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? t('closeAccountMenu') : t('openAccountMenu')}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {/* Fixed dark-on-brass, independent of the light/dark toggle - a
            brand-identity mark (same reasoning as the crest) rather than a
            theme-reactive control, so it stays legible and recognisable in
            either dashboard theme. ink/brass are the same shared-palette
            tokens the public site's identity uses (5.90:1, already
            measured). */}
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
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute end-0 top-full z-50 mt-2 w-56 rounded-md border border-line bg-surface p-1.5 shadow-lg"
        >
          <div className="px-2 py-1.5">
            <p className="text-sm font-medium text-fg">
              <bdi>{userName}</bdi>
            </p>
            <p className="text-xs text-fg-muted">
              <bdi>{roleLabel}</bdi>
            </p>
          </div>

          <div className="my-1 h-px bg-line" />

          <Link
            href="/dashboard/settings"
            onClick={() => setOpen(false)}
            className="block rounded-md px-2 py-1.5 text-sm text-fg transition-colors hover:bg-line/40"
          >
            {t('myAccount')}
          </Link>

          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-start text-sm text-fg-muted transition-colors hover:bg-line/40 hover:text-fg"
            >
              <LogoutIcon className="h-4 w-4" />
              {t('logOut')}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

// First letter of the first two words, uppercased - toLocaleUpperCase is a
// no-op on scripts without case (Arabic), so this works for either locale's
// names without a locale check. Moved here from shell.tsx along with the
// avatar it renders - the trigger is the only place it's used now.
function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean)
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toLocaleUpperCase()
}
