'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { setLocale } from '@/app/(staff)/dashboard/actions'
import { LanguagePair, type LanguagePairOption } from '@/components/language-pair'

type LocaleCode = 'en' | 'ar'

// Fixed pair, not routed through t() - a language's own name isn't a
// translation of the current UI locale (same reasoning as the old single-
// button toggle this replaces).
const LANGUAGES: { code: LocaleCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
]

export function LocaleToggle() {
  const locale = useLocale()
  const t = useTranslations('dashboard.shell')
  const [isPending, startTransition] = useTransition()

  function switchTo(code: LocaleCode) {
    if (code === locale || isPending) return
    startTransition(async () => {
      await setLocale(code)
    })
  }

  const options: LanguagePairOption[] = LANGUAGES.map((lang) => ({
    code: lang.code,
    label: lang.label,
    active: lang.code === locale,
  }))

  return (
    <LanguagePair
      options={options}
      // text-accent/text-fg-muted, not text-brass/text-paper-dim: these are
      // the dashboard's own theme-toggle-aware tokens. Brass is only safe
      // on the public site's fixed-dark identity - in the dashboard's light
      // theme, accent resolves to ink, not brass (see globals.css).
      activeClassName="text-accent"
      inactiveClassName="text-fg-muted transition-colors hover:text-fg"
      separatorClassName="text-fg-muted/60"
      renderOption={(option, className) => {
        // The active language is a no-op if clicked - it still costs a
        // round trip for nothing - so it renders as plain text, not a
        // button, unlike the public switcher's active Link (which still
        // navigates, just to the same place).
        if (option.active) {
          return (
            <span className={className} aria-current="true">
              {option.label}
            </span>
          )
        }
        const code = option.code as LocaleCode
        const switchLabel = code === 'ar' ? t('switchToArabic') : t('switchToEnglish')
        return (
          <button
            type="button"
            onClick={() => switchTo(code)}
            disabled={isPending}
            aria-label={switchLabel}
            title={switchLabel}
            className={`${className} disabled:opacity-60`}
          >
            {option.label}
          </button>
        )
      }}
    />
  )
}
