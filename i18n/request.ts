import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { notFound } from 'next/navigation'
import * as rootParams from 'next/root-params'
import { routing } from './routing'
import { getMessagesForLocale } from './messages'

export default getRequestConfig(async ({ locale }) => {
  if (!locale) {
    const paramValue = await rootParams.locale()
    if (hasLocale(routing.locales, paramValue)) {
      locale = paramValue
    } else {
      notFound()
    }
  }

  return {
    locale,
    messages: getMessagesForLocale(locale),
    onError(error) {
      // Should rarely fire now that Arabic deep-merges onto English - a key
      // missing from BOTH files is a real bug (typo, or a key never added to
      // en.json), not an untranslated string. Warn instead of throwing so
      // one bad key doesn't take down the page for every locale.
      if (error.code === 'MISSING_MESSAGE') {
        console.warn(`[i18n] ${error.message}`)
        return
      }
      console.error(error)
    },
    getMessageFallback() {
      // Second line of defence behind the deep merge: never let a missing
      // key render as a raw "namespace.key" path on screen.
      return ''
    },
  }
})
