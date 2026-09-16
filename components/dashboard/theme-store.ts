export type Theme = 'light' | 'dark'

type Listener = () => void
let listeners: Listener[] = []

/**
 * A tiny external store over the data-theme attribute. The initial value
 * comes from the server (a cookie read in the root layout, baked directly
 * into the first HTML response - see get-theme-cookie.ts), so there is no
 * flash and no blocking init script needed. useSyncExternalStore (rather
 * than useState+useEffect) is the right primitive for mirroring this kind
 * of externally-mutated DOM state, and it keeps every ThemeToggle instance
 * on the page (sidebar, mobile bar, drawer) in sync for free.
 */
export function getSnapshot(): Theme {
  if (typeof document === 'undefined') return 'light'
  const attr = document.documentElement.getAttribute('data-theme')
  if (attr === 'light' || attr === 'dark') return attr
  // No explicit choice yet - matches the CSS prefers-color-scheme fallback
  // in globals.css, so the toggle's icon agrees with what's on screen.
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function subscribe(listener: Listener) {
  listeners.push(listener)
  return () => {
    listeners = listeners.filter((l) => l !== listener)
  }
}

export function setTheme(theme: Theme) {
  document.documentElement.setAttribute('data-theme', theme)
  document.cookie = `dashboard-theme=${theme}; path=/; max-age=31536000; samesite=lax`
  for (const listener of listeners) listener()
}
