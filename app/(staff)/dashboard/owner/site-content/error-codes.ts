// Not 'use server' - a plain helper shared by actions.ts (type-only) and
// the client form components, mirroring the fees/team/opposing-party
// pattern: server actions return a closed code, the render site validates
// against a whitelist before ever passing a caller-controlled value into
// t() as a message key.
export type SiteContentErrorCode =
  | 'save_failed'
  | 'add_failed'
  | 'delete_failed'
  | 'reorder_failed'
  | 'publish_failed'

export const SITE_CONTENT_ERROR_CODES: SiteContentErrorCode[] = [
  'save_failed',
  'add_failed',
  'delete_failed',
  'reorder_failed',
  'publish_failed',
]

export function resolveSiteContentError(
  code: string | undefined,
  t: (key: string) => string
): string | null {
  if (!code) return null
  return (SITE_CONTENT_ERROR_CODES as string[]).includes(code) ? t(code) : t('generic')
}
