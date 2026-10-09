import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import NextLink from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
import { routing } from '@/i18n/routing'
import {
  getSiteOrigin,
  legalServiceJsonLd,
  openGraphLocale,
  serializeJsonLd,
  whatsappHref,
} from '@/lib/public-site'
import { localizedField } from '@/lib/localized-field'
import { Crest } from '@/components/crest'
import { Link } from '@/i18n/navigation'
import { LanguageSwitcher } from './components/language-switcher'
import { ContactForm } from './contact-form'

// This page was fully static (prerendered at build time via the [locale]
// layout's generateStaticParams) before it read from the database. A plain
// Supabase call doesn't hook into Next's fetch-based data cache the way
// fetch() does, so left alone it would still run exactly once at build
// time and freeze whatever was in the tables then - the owner would edit
// content, see nothing change, and reasonably conclude the editor was
// broken. `revalidate` turns this into ISR: visitors get the cached page
// instantly, and the first request after 60s re-runs this function (one
// round trip across four small tables) and swaps in fresh HTML for
// everyone after. Cost: an edit can take up to ~60s to appear. The
// alternative, `dynamic = 'force-dynamic'`, guarantees zero staleness but
// costs that same round trip on every single visitor, not once a minute -
// not worth it for a marketing page with no live-editing UX yet. Once an
// owner-facing editor exists, its save action should call
// revalidatePath on this route so edits appear immediately; this interval
// then becomes a safety net rather than the only mechanism.
export const revalidate = 60

// The homepage's own URL facts, layered on the [locale] layout's metadata:
// canonical, the other-language alternate, and og:url. Page-level openGraph
// replaces the layout's rather than merging, so it is restated in full.
// Emitted only when the site's origin is known - see getSiteOrigin().
export async function generateMetadata({ params }: PageProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params
  if (!getSiteOrigin()) return {}
  const t = await getTranslations({ locale, namespace: 'layout' })
  return {
    alternates: {
      canonical: `/${locale}`,
      languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])),
    },
    openGraph: {
      type: 'website',
      url: `/${locale}`,
      siteName: t('firmName'),
      title: t('firmName'),
      description: t('metaDescription'),
      locale: openGraphLocale(locale),
      alternateLocale: routing.locales.filter((l) => l !== locale).map(openGraphLocale),
    },
  }
}

export default async function PublicHomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  const t = await getTranslations()
  const supabase = await createClient()

  const [{ data: firmSettings }, { data: sectionRows }, { data: practiceAreaRows }, { data: lawyerRows }] =
    await Promise.all([
      supabase
        .from('firm_settings')
        .select('address_en, address_ar, phone, whatsapp_phone, email, hours_en, hours_ar, map_embed_url')
        .maybeSingle(),
      supabase
        .from('site_sections')
        .select('key, eyebrow_en, eyebrow_ar, title_en, title_ar, intro_en, intro_ar, body_en, body_ar')
        .order('sort_order'),
      // is_published is filtered here explicitly, even though anon RLS
      // already enforces it - a signed-in owner previewing this page would
      // otherwise see unpublished rows a real visitor can't, which is
      // exactly the kind of divergence that's easy to miss until it isn't.
      supabase
        .from('practice_areas')
        .select('name_en, name_ar, description_en, description_ar')
        .eq('is_published', true)
        .order('sort_order'),
      supabase
        .from('lawyer_profiles')
        .select('name_en, name_ar, role_en, role_ar, bio_en, bio_ar')
        .eq('is_published', true)
        .order('sort_order'),
    ])

  const sections = new Map((sectionRows ?? []).map((row) => [row.key, row]))
  const hero = sections.get('hero') ?? null
  const practiceAreasSection = sections.get('practice_areas') ?? null
  const lawyersSection = sections.get('lawyers') ?? null
  const contactSection = sections.get('contact') ?? null

  // hero.title_en/ar are deliberately null in the seed data - the firm's
  // name already lives in layout.firmName, and keeping two sources for one
  // name is how they drift. Fall back to the message-file name when unset;
  // once an owner sets a distinct headline, that takes over instead.
  const heroTitle = (hero ? localizedField(hero, 'title', locale) : null) ?? t('layout.firmName')
  const heroEyebrow = hero ? localizedField(hero, 'eyebrow', locale) : null
  const heroTagline = hero ? localizedField(hero, 'intro', locale) : null
  const heroBody = hero ? localizedField(hero, 'body', locale) : null

  const practiceAreas = (practiceAreaRows ?? []).map((row) => ({
    name: localizedField(row, 'name', locale) ?? '',
    description: localizedField(row, 'description', locale) ?? '',
  }))
  const lawyers = (lawyerRows ?? []).map((row) => ({
    name: localizedField(row, 'name', locale) ?? '',
    role: localizedField(row, 'role', locale) ?? '',
    bio: localizedField(row, 'bio', locale) ?? '',
  }))

  const whatsapp = whatsappHref(firmSettings?.whatsapp_phone ?? null, firmSettings?.phone ?? null)
  const jsonLd = legalServiceJsonLd({
    settings: firmSettings,
    name: t('layout.firmName'),
    locale,
    origin: getSiteOrigin(),
  })

  return (
    <div className="flex min-h-screen flex-col">
      <script
        type="application/ld+json"
        data-testid="legal-service-jsonld"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(jsonLd) }}
      />
      {/* Header */}
      <header className="border-b border-warm-grey/25">
        <div className="flex w-full flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-10 lg:px-16">
          <Link href="/" className="flex items-center gap-2.5 text-paper">
            <Crest className="h-9 w-9" />
            <span className="flex flex-col">
              <span className="font-heading text-lg leading-tight">{t('layout.firmName')}</span>
              <span className="text-xs text-paper-dim">{t('layout.firmTagline')}</span>
            </span>
          </Link>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-paper-dim">
            <a href="#practice-areas" className="transition-colors hover:text-paper">
              {t('nav.practiceAreas')}
            </a>
            <a href="#lawyers" className="transition-colors hover:text-paper">
              {t('nav.lawyers')}
            </a>
            <a href="#contact" className="transition-colors hover:text-paper">
              {t('nav.contact')}
            </a>
            <NextLink
              href="/login"
              className="rounded-sm border border-warm-grey/40 px-3 py-1.5 text-paper-dim transition-colors hover:border-brass hover:text-paper"
            >
              {t('nav.staffSignIn')}
            </NextLink>
            <LanguageSwitcher />
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* 2.1 Firm introduction */}
        <section className="w-full px-6 py-20 sm:px-10 sm:py-28 lg:px-16">
          <Image
            src="/brand/logo_lockup.png"
            alt={heroTitle}
            width={599}
            height={434}
            className="h-auto w-48 sm:w-64"
            priority
          />
          <p className="mt-8 text-sm text-brass">{heroEyebrow}</p>
          <h1 className="mt-3 max-w-2xl font-heading text-4xl leading-tight text-paper sm:text-5xl">
            {heroTagline}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-paper-dim">
            {heroBody}
          </p>
          {/* Points at the working contact form - an enquiry the firm
              receives and can assign. There is no online booking yet. */}
          <a
            href="#contact"
            className="mt-8 inline-block rounded-sm bg-brass px-6 py-3 text-sm font-medium text-ink transition-colors hover:bg-brass-hover"
          >
            {t('hero.cta')}
          </a>
        </section>

        {/* 2.2 Practice areas */}
        <section id="practice-areas" className="border-t border-warm-grey/25">
          <div className="w-full px-6 py-20 sm:px-10 lg:px-16">
            <h2 className="font-heading text-3xl text-paper">
              {practiceAreasSection && localizedField(practiceAreasSection, 'title', locale)}
            </h2>
            <p className="mt-3 max-w-xl text-sm text-paper-dim">
              {practiceAreasSection && localizedField(practiceAreasSection, 'intro', locale)}
            </p>

            <ul className="mt-10 divide-y divide-warm-grey/20 border-y border-warm-grey/20">
              {practiceAreas.map((area) => (
                <li key={area.name} className="grid gap-2 py-6 sm:grid-cols-[1fr_2fr] sm:gap-8">
                  <h3 className="font-heading text-lg text-paper">{area.name}</h3>
                  <p className="text-sm leading-relaxed text-paper-dim">{area.description}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* 2.3 Lawyer profiles */}
        <section id="lawyers" className="border-t border-warm-grey/25">
          <div className="w-full px-6 py-20 sm:px-10 lg:px-16">
            <h2 className="font-heading text-3xl text-paper">
              {lawyersSection && localizedField(lawyersSection, 'title', locale)}
            </h2>
            <p className="mt-3 max-w-xl text-sm text-paper-dim">
              {lawyersSection && localizedField(lawyersSection, 'intro', locale)}
            </p>

            <div className="mt-10 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
              {lawyers.map((lawyer, i) => (
                <div key={i}>
                  <div className="h-32 w-full border border-warm-grey/25 bg-ink-raised" aria-hidden="true" />
                  <div className="mt-4 h-px w-10 bg-brass/60" aria-hidden="true" />
                  <h3 className="mt-3 font-heading text-lg text-paper">{lawyer.name}</h3>
                  <p className="text-sm text-brass">{lawyer.role}</p>
                  <p className="mt-2 text-sm leading-relaxed text-paper-dim">{lawyer.bio}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2.4 Contact and location - details, WhatsApp and map beside the
            contact form, which creates an enquiry the firm can assign. */}
        <section id="contact" className="border-t border-warm-grey/25 bg-ink-raised/40" data-testid="contact-section">
          <div className="grid w-full gap-12 px-6 py-20 sm:px-10 lg:grid-cols-2 lg:px-16">
            <div>
              <h2 className="font-heading text-3xl text-paper">
                {contactSection && localizedField(contactSection, 'title', locale)}
              </h2>
              <p className="mt-3 text-sm text-paper-dim">
                {contactSection && localizedField(contactSection, 'intro', locale)}
              </p>

              <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
                <dt className="text-paper-dim">{t('contact.addressLabel')}</dt>
                <dd className="text-paper">{firmSettings && localizedField(firmSettings, 'address', locale)}</dd>
                <dt className="text-paper-dim">{t('contact.phoneLabel')}</dt>
                <dd className="text-paper" dir="ltr">
                  {firmSettings?.phone}
                </dd>
                <dt className="text-paper-dim">{t('contact.emailLabel')}</dt>
                <dd className="text-paper" dir="ltr">
                  {firmSettings?.email}
                </dd>
                <dt className="text-paper-dim">{t('contact.hoursLabel')}</dt>
                <dd className="text-paper">{firmSettings && localizedField(firmSettings, 'hours', locale)}</dd>
              </dl>

              {whatsapp && (
                <a
                  href={whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="contact-whatsapp"
                  className="mt-6 inline-flex items-center gap-2.5 rounded-sm bg-[#25D366] px-5 py-2.5 text-sm font-medium text-[#0b141a] transition-opacity hover:opacity-90"
                >
                  <WhatsAppIcon className="h-5 w-5 shrink-0" />
                  {t('contact.whatsapp')}
                </a>
              )}

              {firmSettings?.map_embed_url && (
                <div className="mt-8 aspect-[4/3] w-full overflow-hidden border border-warm-grey/25 sm:aspect-video" data-testid="contact-map">
                  <iframe
                    src={firmSettings.map_embed_url}
                    title={t('contact.mapTitle')}
                    loading="lazy"
                    referrerPolicy="strict-origin-when-cross-origin"
                    className="h-full w-full border-0"
                  />
                </div>
              )}
            </div>

            <div>
              <ContactForm />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-warm-grey/25">
        <div className="flex w-full flex-col gap-2 px-6 py-8 text-sm text-warm-grey sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16">
          <p>
            {t('layout.firmName')} &middot; {t('footer.rights')}
          </p>
        </div>
      </footer>
    </div>
  )
}

// WhatsApp's glyph, so the button reads as a WhatsApp action at a glance
// rather than as another phone number. Decorative: the label carries the
// meaning.
function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.47-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.13-.14.3-.35.45-.52.15-.18.2-.3.3-.5.1-.2.05-.37-.03-.52-.07-.15-.67-1.6-.92-2.2-.24-.58-.49-.5-.67-.5h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.48.71.31 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35M12.04 21.5h-.01a9.4 9.4 0 0 1-4.8-1.32l-.34-.2-3.57.94.95-3.48-.22-.36a9.4 9.4 0 0 1-1.44-5.02c0-5.2 4.23-9.43 9.44-9.43 2.52 0 4.89.98 6.67 2.77a9.37 9.37 0 0 1 2.76 6.67c0 5.2-4.24 9.43-9.44 9.43m8.03-17.46A11.28 11.28 0 0 0 12.04.72C5.78.72.69 5.8.69 12.06c0 2 .52 3.95 1.52 5.67L.6 23.28l5.68-1.49a11.33 11.33 0 0 0 5.75 1.47h.01c6.25 0 11.34-5.09 11.35-11.35 0-3.03-1.18-5.88-3.32-8.02" />
    </svg>
  )
}
