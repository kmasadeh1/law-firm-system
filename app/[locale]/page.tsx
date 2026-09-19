import { useTranslations } from 'next-intl'
import NextLink from 'next/link'
import { Crest } from '@/components/crest'
import { Link } from '@/i18n/navigation'
import { LanguageSwitcher } from './components/language-switcher'

export default function PublicHomePage() {
  const t = useTranslations()

  const practiceAreas = t.raw('practiceAreas.items') as {
    name: string
    description: string
  }[]
  const lawyers = t.raw('lawyers.items') as {
    name: string
    role: string
    bio: string
  }[]

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="border-b border-warm-grey/25">
        <div className="flex w-full flex-wrap items-center justify-between gap-4 px-6 py-5 sm:px-10 lg:px-16">
          <Link href="/" className="flex items-center gap-2.5 text-paper">
            <Crest className="h-7 w-7 text-brass" />
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
          <p className="text-sm text-brass">{t('hero.eyebrow')}</p>
          <h1 className="mt-3 max-w-2xl font-heading text-4xl leading-tight text-paper sm:text-5xl">
            {t('hero.tagline')}
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-paper-dim">
            {t('hero.body')}
          </p>
          <a
            href="#appointment"
            className="mt-8 inline-block rounded-sm bg-burgundy px-6 py-3 text-sm font-medium text-paper transition-colors hover:bg-burgundy-dim"
          >
            {t('hero.cta')}
          </a>
        </section>

        {/* 2.2 Practice areas */}
        <section id="practice-areas" className="border-t border-warm-grey/25">
          <div className="w-full px-6 py-20 sm:px-10 lg:px-16">
            <h2 className="font-heading text-3xl text-paper">{t('practiceAreas.title')}</h2>
            <p className="mt-3 max-w-xl text-sm text-paper-dim">{t('practiceAreas.intro')}</p>

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
            <h2 className="font-heading text-3xl text-paper">{t('lawyers.title')}</h2>
            <p className="mt-3 max-w-xl text-sm text-paper-dim">{t('lawyers.intro')}</p>

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
                  className="mt-2 cursor-not-allowed rounded-sm bg-burgundy/50 px-5 py-2.5 text-start text-sm font-medium text-paper-dim"
                >
                  {t('appointment.submit')} ({t('appointment.comingSoon')})
                </button>
              </form>
            </div>

            {/* 2.5 Contact and location */}
            <div id="contact">
              <h2 className="font-heading text-3xl text-paper">{t('contact.title')}</h2>
              <p className="mt-3 text-sm text-paper-dim">{t('contact.intro')}</p>

              <dl className="mt-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 text-sm">
                <dt className="text-paper-dim">{t('contact.addressLabel')}</dt>
                <dd className="text-paper">{t('contact.address')}</dd>
                <dt className="text-paper-dim">{t('contact.phoneLabel')}</dt>
                <dd className="text-paper" dir="ltr">
                  {t('contact.phone')}
                </dd>
                <dt className="text-paper-dim">{t('contact.emailLabel')}</dt>
                <dd className="text-paper" dir="ltr">
                  {t('contact.email')}
                </dd>
                <dt className="text-paper-dim">{t('contact.hoursLabel')}</dt>
                <dd className="text-paper">{t('contact.hours')}</dd>
              </dl>

              <div
                className="mt-8 flex h-40 w-full items-center justify-center border border-warm-grey/25 bg-ink text-sm text-warm-grey"
                aria-hidden="true"
              >
                {t('contact.mapPlaceholder')}
              </div>

              <form className="mt-8 flex flex-col gap-4">
                <Field label={t('contact.formNameLabel')} id="contact-name" />
                <Field label={t('contact.formEmailLabel')} id="contact-email" type="email" />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="contact-message" className="text-sm text-paper-dim">
                    {t('contact.formMessageLabel')}
                  </label>
                  <textarea
                    id="contact-message"
                    rows={3}
                    className="rounded-sm border border-warm-grey/40 bg-ink px-3 py-2 text-sm text-paper outline-none transition-colors focus:border-brass"
                  />
                </div>
                <button
                  type="button"
                  disabled
                  title={t('contact.comingSoon')}
                  className="mt-2 cursor-not-allowed rounded-sm border border-warm-grey/40 px-5 py-2.5 text-start text-sm font-medium text-warm-grey"
                >
                  {t('contact.submit')} ({t('contact.comingSoon')})
                </button>
              </form>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-warm-grey/25">
        <div className="flex w-full flex-col gap-2 px-6 py-8 text-sm text-warm-grey sm:flex-row sm:items-center sm:justify-between sm:px-10 lg:px-16">
          <p>
            {t('layout.firmName')} &middot; {t('footer.rights')}
          </p>
          <p>{t('footer.placeholderNotice')}</p>
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
