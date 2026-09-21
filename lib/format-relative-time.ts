const rtfByLocale = new Map<string, Intl.RelativeTimeFormat>()

function getRtf(locale: 'en' | 'ar') {
  let rtf = rtfByLocale.get(locale)
  if (!rtf) {
    rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
    rtfByLocale.set(locale, rtf)
  }
  return rtf
}

/**
 * Formats a past ISO timestamp as relative time ("5 minutes ago", "3 hours
 * ago") in the given locale, via Intl.RelativeTimeFormat so the grammar -
 * including Arabic's plural forms - is handled natively instead of by a
 * hand-rolled English string.
 */
export function formatRelativeTime(iso: string, locale: 'en' | 'ar') {
  const diffMs = Date.now() - new Date(iso).getTime()
  const mins = Math.round(diffMs / 60000)
  const rtf = getRtf(locale)

  if (mins < 1) return rtf.format(0, 'minute')
  if (mins < 60) return rtf.format(-mins, 'minute')
  const hours = Math.round(mins / 60)
  if (hours < 24) return rtf.format(-hours, 'hour')
  const days = Math.round(hours / 24)
  return rtf.format(-days, 'day')
}
