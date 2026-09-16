'use client'

import { useSyncExternalStore } from 'react'
import { getSnapshot, subscribe, setTheme, type Theme } from './theme-store'

function SunIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
      <circle cx="10" cy="10" r="3.5" />
      <path
        strokeLinecap="round"
        d="M10 2.5v1.5M10 16v1.5M4.4 4.4l1.1 1.1M14.5 14.5l1.1 1.1M2.5 10h1.5M16 10h1.5M4.4 15.6l1.1-1.1M14.5 5.5l1.1-1.1"
      />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.3A6.5 6.5 0 0 1 7.7 3.5a6.5 6.5 0 1 0 8.8 8.8Z" />
    </svg>
  )
}

export function ThemeToggle({
  initialTheme,
  compact = false,
}: {
  initialTheme: Theme
  compact?: boolean
}) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => initialTheme)

  function toggle() {
    setTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      title={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
      className={
        compact
          ? 'flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-line/60 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'
          : 'flex w-full items-center gap-2 rounded-md border border-line px-3 py-2 text-sm text-fg-muted transition-colors hover:bg-line/40 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'
      }
    >
      {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
      {!compact && <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
    </button>
  )
}
