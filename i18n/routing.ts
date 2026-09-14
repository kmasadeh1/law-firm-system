import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: ['en', 'ar'],
  // Jordan-based firm, so Arabic leads by default - flip this if English
  // should be the default instead.
  defaultLocale: 'ar',
  // Always prefix both locales (/en/..., /ar/...) so every URL states its
  // language explicitly rather than leaving the default locale bare.
  localePrefix: 'always',
})
