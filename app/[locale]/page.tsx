import { getTranslations } from 'next-intl/server'
import NextLink from 'next/link'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/server'
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

export default async function PublicHomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  const t = await getTranslations()
  const supabase = await createClient()

  const [{ data: firmSettings }, { data: sectionRows }, { data: practiceAreaRows }, { data: lawyerRows }] =
    await Promise.all([
      supabase
        .from('firm_settings')
        .select('address_en, address_ar, phone, email, hours_en, hours_ar')
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

  return (
    <div className="flex min-h-screen flex-col">
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
            <a href="#appointment" className="transition-colors hover:text-paper">
              {t('nav.appointment')}
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
          <a
            href="#appointment"
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

        {/* 2.4 Book an appointment + 2.5 Contact and location */}
        <section
          id="appointment"
          className="border-t border-warm-grey/25 bg-ink-raised/40"
        >
          <div className="grid w-full gap-12 px-6 py-20 sm:px-10 lg:grid-cols-2 lg:px-16">
            <div>
              <h2 className="font-heading text-3xl text-paper">{t('appointment.title')}</h2>
              <p className="mt-3 text-sm text-paper-dim">{t('appointment.intro')}</p>

              <form className="mt-8 flex flex-col gap-4">
                <Field label={t('appointment.nameLabel')} id="appt-name" />
                <Field label={t('appointment.emailLabel')} id="appt-email" type="email" />
                <Field label={t('appointment.phoneLabel')} id="appt-phone" type="tel" />

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="appt-area" className="text-sm text-paper-dim">
                    {t('appointment.practiceAreaLabel')}
                  </label>
                  <select
                    id="appt-area"
                    className="rounded-sm border border-warm-grey/40 bg-ink px-3 py-2 text-sm text-paper outline-none transition-colors focus:border-brass"
                    defaultValue=""
                  >
                    <option value="" disabled>
                      {t('appointment.practiceAreaPlaceholder')}
                    </option>
                    {practiceAreas.map((area) => (
                      <option key={area.name} value={area.name}>
                        {area.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="appt-message" className="text-sm text-paper-dim">
                    {t('appointment.messageLabel')}
                  </label>
                  <textarea
                    id="appt-message"
                    rows={3}
                    className="rounded-sm border border-warm-grey/40 bg-ink px-3 py-2 text-sm text-paper outline-none transition-colors focus:border-brass"
                  />
                </div>

                <button
                  type="button"
                  disabled
                  title={t('appointment.comingSoon')}
                  className="mt-2 cursor-not-allowed rounded-sm border border-warm-grey/40 px-5 py-2.5 text-start text-sm font-medium text-warm-grey"
                >
                  {t('appointment.submit')} ({t('appointment.comingSoon')})
                </button>
              </form>
            </div>

            {/* 2.5 Contact and location */}
            <div id="contact">
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

              <div
                className="mt-8 flex h-40 w-full items-center justify-center border border-warm-grey/25 bg-ink text-sm text-warm-grey"
                aria-hidden="true"
              >
                {t('contact.mapPlaceholder')}
              </div>

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

function Field({
  label,
  id,
  type = 'text',
}: {
  label: string
  id: string
  type?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-paper-dim">
        {label}
      </label>
      <input
        id={id}
        type={type}
        className="rounded-sm border border-warm-grey/40 bg-ink px-3 py-2 text-sm text-paper outline-none transition-colors focus:border-brass"
      />
    </div>
  )
}
