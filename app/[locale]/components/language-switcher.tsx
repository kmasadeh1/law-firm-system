import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

/**
 * Switches the whole site to the other locale from the current page, at the
 * same path. A plain server-rendered link pair - no client JS required.
 */
export function LanguageSwitcher() {
  const locale = useLocale()
  const t = useTranslations('languageSwitcher')

  return (
    <div className="flex items-center gap-1 text-sm">
      {routing.locales.map((loc, i) => (
        <span key={loc} className="flex items-center gap-1">
          {i > 0 && <span className="text-warm-grey">/</span>}
          <Link
            href="/"
            locale={loc}
            aria-current={loc === locale ? 'true' : undefined}
            className={
              loc === locale
                ? 'text-brass'
                : 'text-paper-dim transition-colors hover:text-paper'
            }
          >
            {t(loc)}
          </Link>
        </span>
      ))}
    </div>
  )
}
