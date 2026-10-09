import { whatsappLink } from './whatsapp'

// Server-side helpers for the public site's contact link and search-engine
// metadata. Display shaping only: nothing here decides anything the
// database owns - it formats firm_settings values for wa.me, Open Graph and
// schema.org.

// The site's public origin, for absolute URLs in metadata and structured
// data. Read from the environment rather than the request: the homepage is
// ISR (revalidate = 60), and reading request headers would make it render
// per request. SITE_URL is the explicit setting; on Vercel the production
// domain is available without configuration. Neither set (local dev, a
// preview without SITE_URL) means no absolute URL is emitted at all, never
// a guessed one.
export function getSiteOrigin(): string | null {
  const explicit = process.env.SITE_URL?.trim()
  if (explicit) return explicit.replace(/\/+$/, '')
  const vercel = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim()
  if (vercel) return `https://${vercel}`
  return null
}

function present(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

// The public contact button: firm_settings.whatsapp_phone, or the main
// number when that is NULL. Both empty means no link at all. The number
// itself is turned into a link by lib/whatsapp.ts.
export function whatsappHref(whatsappPhone: string | null, phone: string | null): string | null {
  return whatsappLink(present(whatsappPhone) ?? present(phone))
}

// Domains reserved for documentation (RFC 2606 / RFC 6761). An address at
// one of these is a placeholder by definition - info@example.com is the
// seed value - and must never be published as the firm's real contact.
const RESERVED_EMAIL_DOMAIN = /(^|\.)(example\.(com|net|org)|example|test|invalid|localhost)$/i

export function isPlaceholderEmail(email: string): boolean {
  const domain = email.split('@').pop() ?? ''
  return RESERVED_EMAIL_DOMAIN.test(domain)
}

type FirmSettingsForLd = {
  address_en: string | null
  address_ar: string | null
  phone: string | null
  email: string | null
}

// schema.org LegalService for the homepage. Every property is omitted when
// its source is empty or a placeholder - a missing property is harmless, a
// wrong one is published to search engines.
//
// Opening hours are deliberately absent: hours_en/hours_ar are free text
// ("Saturday – Thursday, 9:00 – 18:00 · Friday closed"), and schema.org
// needs structured day/time ranges. Parsing prose into those here would be
// guessing; it needs structured columns in firm_settings first.
export function legalServiceJsonLd({
  settings,
  name,
  locale,
  origin,
}: {
  settings: FirmSettingsForLd | null
  name: string
  locale: string
  origin: string | null
}): Record<string, unknown> {
  const address = present(locale === 'ar' ? (settings?.address_ar ?? settings?.address_en) : settings?.address_en)
  const telephone = present(settings?.phone)
  const email = present(settings?.email)

  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LegalService',
    name,
  }
  if (origin) ld.url = `${origin}/${locale}`
  if (telephone) ld.telephone = telephone
  if (email && !isPlaceholderEmail(email)) ld.email = email
  if (address) {
    ld.address = {
      '@type': 'PostalAddress',
      streetAddress: address,
      addressCountry: 'JO',
    }
  }
  return ld
}

// For a <script type="application/ld+json"> body: JSON.stringify doesn't
// escape "<", so a value containing "</script>" could close the tag early.
export function serializeJsonLd(ld: Record<string, unknown>): string {
  return JSON.stringify(ld).replace(/</g, '\\u003c')
}

export function openGraphLocale(locale: string) {
  return locale === 'ar' ? 'ar_JO' : 'en_US'
}
