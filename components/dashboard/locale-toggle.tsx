'use client'

import { useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { setLocale } from '@/app/(staff)/dashboard/actions'

function GlobeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-4 w-4" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" />
      <path strokeLinecap="round" d="M2.5 10h15M10 2.5a11 11 0 0 1 0 15 11 11 0 0 1 0-15Z" />
    </svg>
  )
}

// The visible label is always the name of the language it switches TO,
// written in that language - "العربية" on an English UI, "English" on an
// Arabic one. That's not a translation of the current locale's UI text, so
// it's a fixed pair rather than routed through t(); only the accessible
// name (aria-label/title) is translated into the current locale.
const targetLanguageLabel: Record<'en' | 'ar', string> = {
  en: 'العربية',
  ar: 'English',
}

export function LocaleToggle() {
  const locale = useLocale()
  const t = useTranslations('dashboard.shell')
  const [isPending, startTransition] = useTransition()

  const target = locale === 'ar' ? 'en' : 'ar'
  const switchLabel = target === 'ar' ? t('switchToArabic') : t('switchToEnglish')

  function toggle() {
    startTransition(async () => {
      await setLocale(target)
    })
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      aria-label={switchLabel}
      title={switchLabel}
      className="flex items-center gap-2 rounded-md px-2.5 py-2 text-sm text-fg-muted transition-colors hover:bg-line/40 hover:text-fg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
    >
      <GlobeIcon />
      <span className="hidden sm:inline">{targetLanguageLabel[target]}</span>
    </button>
  )
}
