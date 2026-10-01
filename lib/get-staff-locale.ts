import { cache } from 'react'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'

export const STAFF_LOCALE_COOKIE = 'staff-locale'

/**
 * Server-only: resolves the signed-in staff member's locale, the same way
 * app/(staff)/layout.tsx does. Nested Server Components don't share state
 * with a parent layout, so anything below the root layout that needs
 * locale (rather than just dir/lang, already set on <html>) re-derives it
 * here instead of re-implementing the lookup.
 *
 * Signed in: the database row is the source of truth, full stop - a stale
 * cookie never overrides it.
 *
 * Not signed in (the only real case in practice is /login, since every
 * other route in this tree is proxy.ts-gated): falls back to the
 * `staff-locale` cookie (written on successful login and by setLocale, so
 * the same person on the same machine gets their own language back before
 * they've even authenticated), and defaults to Arabic when there's no
 * cookie either - this firm is Arabic-first, and 'ar' is already the
 * database default for new staff.
 *
 * Wrapped in React's cache() so the layout and every page that calls this
 * in the same request share one query instead of each issuing their own -
 * takes no arguments, so every call in a render pass hits the same cache
 * key and there's nothing per-call (like a Supabase client instance) that
 * could break the dedup.
 *
 * If a component already queries `staff` for other columns, add `locale`
 * to that existing select instead of calling this - it's a second round
 * trip otherwise.
 */
async function readLocaleCookie(): Promise<'en' | 'ar'> {
  const store = await cookies()
  return store.get(STAFF_LOCALE_COOKIE)?.value === 'en' ? 'en' : 'ar'
}

export const getStaffLocale = cache(async (): Promise<'en' | 'ar'> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (!user) {
    return readLocaleCookie()
  }

  const { data: staffRow } = await supabase
    .from('staff')
    .select('locale, must_change_password')
    .eq('id', user.sub as string)
    .maybeSingle()

  // Mid-forced-password-change, /change-password is the only route this
  // account can reach (proxy.ts), and that page's own switcher deliberately
  // never writes staff.locale - see getChangePasswordLocale below. Without
  // this, the root layout (app/(staff)/layout.tsx, which calls this
  // function for <html lang dir> and the client message slice) would keep
  // resolving the old DB value after a switch, splitting the page between
  // an English body and an Arabic dir/shell.
  if (staffRow?.must_change_password) {
    return readLocaleCookie()
  }

  return staffRow?.locale === 'ar' ? 'ar' : 'en'
})

/**
 * /change-password only. That screen is reachable while signed in (both the
 * forced first-login flow and the voluntary one from Settings), so the
 * ordinary getStaffLocale() above would always take its DB branch and never
 * see this cookie. That's correct everywhere else - staff.locale is the
 * source of truth for a signed-in user - but this screen's own language
 * switcher deliberately never writes staff.locale (is_owner() and
 * has_permission() both return false mid-forced-password-change, and this
 * cookie-only write is presentation, not a change to the account - it must
 * never touch auth, the session, or the database). So this reads the same
 * cookie /login reads, unconditionally, regardless of sign-in state - the
 * one deliberate exception to "DB wins when signed in."
 */
export const getChangePasswordLocale = cache(readLocaleCookie)

/**
 * Server Action / Route Handler only (cookies() is read-only elsewhere).
 * Presentation, not business logic: this only decides which message file
 * renders before /login knows who's signing in. It never influences
 * authentication, authorization, or which account ends up signed in.
 */
export async function setStaffLocaleCookie(locale: 'en' | 'ar') {
  const store = await cookies()
  store.set(STAFF_LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })
}
