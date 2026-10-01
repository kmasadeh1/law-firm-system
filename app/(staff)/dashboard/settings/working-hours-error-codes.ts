// Not 'use server' - a plain helper for the client component. A 'use
// server' file (actions.ts) can only export async functions, so the
// whitelist/resolver live here instead, same split as site-content's
// error-codes.ts.
import type { SaveWorkingHoursErrorCode } from './actions'

const WORKING_HOURS_ERROR_CODES: SaveWorkingHoursErrorCode[] = ['invalidTimes', 'saveFailed']

export function resolveWorkingHoursError(code: string | undefined, t: (key: string) => string): string | null {
  if (!code) return null
  return (WORKING_HOURS_ERROR_CODES as string[]).includes(code) ? t(code) : t('saveFailed')
}
