import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { Amiri, IBM_Plex_Sans_Arabic, Source_Serif_4 } from 'next/font/google'
import { routing } from '@/i18n/routing'
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

const plexArabic = IBM_Plex_Sans_Arabic({
  variable: '--font-plex-arabic',
  subsets: ['arabic'],
  weight: ['400', '500', '600'],
})

export const metadata: Metadata = {
  title: 'Ahmad Al-Masadeh & Associates',
  description: 'Placeholder firm site',
}

// This is a Next.js root layout in its own right (see the "Multiple root
// layouts" pattern) - the public site lives entirely under app/[locale], so
// this is the only place that can render <html lang dir>. The staff area
// (/login, /dashboard/*) is not localized and has its own root layout at
// app/(staff)/layout.tsx.
export default async function LocaleRootLayout({
  children,
  params,
}: LayoutProps<'/[locale]'>) {
  const { locale } = await params

  if (!hasLocale(routing.locales, locale)) {
    notFound()
  }

  const dir = locale === 'ar' ? 'rtl' : 'ltr'

  return (
    <html
      lang={locale}
      dir={dir}
      className={`${amiri.variable} ${sourceSerif.variable} ${plexArabic.variable} h-full`}
    >
      <body
        className={`min-h-full flex flex-col antialiased ${locale === 'ar' ? 'font-body-ar' : 'font-body-en'}`}
      >
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  )
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}
