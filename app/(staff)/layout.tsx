import type { Metadata } from 'next'
import { Amiri, Source_Serif_4 } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getThemeCookie } from '@/components/dashboard/get-theme-cookie'
import { createClient } from '@/lib/supabase/server'
import enMessages from '@/messages/en.json'
import '../globals.css'

const amiri = Amiri({
  variable: '--font-amiri',
  subsets: ['latin', 'arabic'],
  weight: ['400', '700'],
})

const sourceSerif = Source_Serif_4({
  variable: '--font-source-serif',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Ahmad Al-Masadeh & Associates - Staff sign in',
  description: 'Staff sign in',
}

// This is a Next.js root layout in its own right - the staff area
// (/login, /dashboard/*) is not localized via routing, so it renders
// <html lang dir> directly rather than nesting under app/[locale]. See
// app/[locale]/layout.tsx for the public site's root layout.
//
// Locale here comes from the signed-in staff member's own preference
// (staff.locale), not the URL - there's no [locale] segment for this route
// tree, so next-intl's usual root-params-based resolution doesn't apply.
// NextIntlClientProvider is given locale/messages explicitly instead.
export default async function StaffRootLayout({ children }: { children: React.ReactNode }) {
  // Resolves the dashboard theme from a cookie set by the toggle, baked
  // directly into the first HTML response - no blocking client script, no
  // flash. When unset, data-theme is simply omitted and the CSS
  // prefers-color-scheme fallback in globals.css decides (also zero-flash).
  const theme = await getThemeCookie()

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  let locale: 'en' | 'ar' = 'en'
  if (user) {
    const { data: staffRow } = await supabase
      .from('staff')
      .select('locale')
      .eq('id', user.sub as string)
      .maybeSingle()
    if (staffRow?.locale === 'ar') {
      locale = 'ar'
    }
  }
  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  // No Arabic dashboard translations exist yet (a later task adds them), so
  // the dashboard message namespace always comes from English regardless of
  // the staff member's locale - that's the intended fallback, not a bug:
  // <html> and formatting still reflect the real locale, only the strings
  // that don't exist yet in Arabic stay in English.
  const messages = { dashboard: enMessages.dashboard }

  return (
    <html
      lang={locale}
      dir={dir}
      data-theme={theme}
      className={`${amiri.variable} ${sourceSerif.variable} h-full`}
    >
      <body className="min-h-full flex flex-col font-body-en antialiased">
        {/* locale/messages aren't enough on their own: NextIntlClientProvider's
            server wrapper independently falls back to i18n/request.ts for
            formats/now/timeZone whenever they're omitted, and that config
            resolves the locale from a [locale] route segment via
            next/root-params - which doesn't exist here, so it 404s. Passing
            all three explicitly skips that lookup. Their actual values don't
            matter yet since the one extracted screen does no date/number
            formatting. */}
        <NextIntlClientProvider
          locale={locale}
          messages={messages}
          now={new Date()}
          timeZone="Asia/Amman"
          formats={{}}
        >
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
