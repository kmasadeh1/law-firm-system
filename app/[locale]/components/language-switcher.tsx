import { useLocale, useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'
import { LanguagePair } from '@/components/language-pair'

/**
 * Switches the whole site to the other locale from the current page, at the
 * same path. A plain server-rendered link pair - no client JS required.
 * `href` defaults to the homepage; pass the current page's path (e.g. a
 * tracking link's token) to switch locale in place instead of navigating
 * away.
 */
export function LanguageSwitcher({ href = '/' }: { href?: string }) {
  const locale = useLocale()
  const t = useTranslations('languageSwitcher')

  return (
    <LanguagePair
      options={routing.locales.map((loc) => ({ code: loc, label: t(loc), active: loc === locale }))}
      activeClassName="text-brass"
      inactiveClassName="text-paper-dim transition-colors hover:text-paper"
      separatorClassName="text-warm-grey"
      renderOption={(option, className) => (
        <Link
          href={href}
          locale={option.code}
          aria-current={option.active ? 'true' : undefined}
          className={className}
        >
          {option.label}
        </Link>
      )}
    />
  )
}
