'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { setLoginLocale } from '@/app/(staff)/login/actions'
import { LanguagePair, type LanguagePairOption } from '@/components/language-pair'

type LocaleCode = 'en' | 'ar'

// Same fixed pair as the dashboard's LocaleToggle (components/dashboard/
// locale-toggle.tsx) - only the action it calls differs: this writes the
// staff-locale cookie for a visitor who hasn't authenticated yet, instead
// of updating staff.locale for one who has.
const LANGUAGES: { code: LocaleCode; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'ar', label: 'العربية' },
]

export function LoginLocaleSwitcher() {
  const locale = useLocale()
  const t = useTranslations('dashboard.shell')
  const [isPending, startTransition] = useTransition()

  function switchTo(code: LocaleCode) {
    if (code === locale || isPending) return
    startTransition(async () => {
      await setLoginLocale(code)
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
      activeClassName="text-brass"
      inactiveClassName="text-paper-dim transition-colors hover:text-paper"
      separatorClassName="text-paper-dim/60"
      renderOption={(option, className) => {
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
            data-testid={`login-locale-${code}`}
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
