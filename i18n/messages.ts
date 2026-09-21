import type { AbstractIntlMessages } from 'next-intl'
import enMessages from '@/messages/en.json'
import arMessages from '@/messages/ar.json'

// Arabic translation arrives in phases, namespace by namespace, the same way
// name_ar ?? name works for firm-defined reference data (lib/localized-name.ts):
// a key missing from ar.json isn't an error, it's "not translated yet," and
// the app has to stay usable in the meantime. Deep-merging English as the
// base with Arabic overlaid on top means a key present in ar.json wins and a
// key missing from it silently falls back to English, per key rather than
// per file - so a namespace that's half-translated still renders correctly.
function deepMerge(base: unknown, overlay: unknown): unknown {
  if (
    typeof base === 'object' &&
    base !== null &&
    !Array.isArray(base) &&
    typeof overlay === 'object' &&
    overlay !== null &&
    !Array.isArray(overlay)
  ) {
    const result: Record<string, unknown> = { ...(base as Record<string, unknown>) }
    for (const key of Object.keys(overlay as Record<string, unknown>)) {
      result[key] = deepMerge((base as Record<string, unknown>)[key], (overlay as Record<string, unknown>)[key])
    }
    return result
  }
  return overlay !== undefined ? overlay : base
}

// Computed once at module load, not per request - the source JSON is static.
const mergedArMessages = deepMerge(enMessages, arMessages) as unknown as AbstractIntlMessages

export function getMessagesForLocale(locale: string): AbstractIntlMessages {
  return locale === 'ar' ? mergedArMessages : (enMessages as unknown as AbstractIntlMessages)
}
