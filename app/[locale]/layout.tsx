import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { NextIntlClientProvider, hasLocale } from 'next-intl'
import { getTranslations } from 'next-intl/server'
import { Amiri, IBM_Plex_Sans_Arabic, Source_Serif_4 } from 'next/font/google'
import { routing } from '@/i18n/routing'
import { getSiteOrigin, openGraphLocale } from '@/lib/public-site'
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

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'layout' })
  const origin = getSiteOrigin()
  // The firm's name in the reader's language everywhere a search engine or
  // a link preview reads it. No og:url or canonical here - this layout also
  // wraps /[locale]/track/[token], which must not claim the homepage's URL;
  // the homepage adds those itself.
  return {
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    title: t('firmName'),
    description: t('metaDescription'),
    openGraph: {
      type: 'website',
      siteName: t('firmName'),
      title: t('firmName'),
      description: t('metaDescription'),
      locale: openGraphLocale(locale),
      alternateLocale: routing.locales.filter((l) => l !== locale).map(openGraphLocale),
    },
  }
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
