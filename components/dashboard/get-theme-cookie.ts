import { cookies } from 'next/headers'
import type { Theme } from './theme-store'

/**
 * Server-only: resolves the dashboard theme from a cookie (set by
 * theme-store's setTheme on toggle) so the very first server-rendered HTML
 * already has the right data-theme attribute - no blocking client script,
 * no flash. Returns undefined when no explicit choice has been made yet,
 * in which case the CSS prefers-color-scheme fallback in globals.css
 * decides (also zero-flash, since it's evaluated at first paint).
 */
export async function getThemeCookie(): Promise<Theme | undefined> {
  const store = await cookies()
  const value = store.get('dashboard-theme')?.value
  return value === 'light' || value === 'dark' ? value : undefined
}
