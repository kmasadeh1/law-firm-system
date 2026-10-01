// Not 'use server' - a plain helper shared by actions.ts (type-only) and
// the client components, mirroring the site-content/working-hours pattern:
// server actions return a closed code, the render site validates against
// a whitelist before ever passing a caller-controlled value into t() as a
// message key.
export type LeaveRequestErrorCode =
  | 'startDateRequired'
  | 'endDateRequired'
  | 'endBeforeStart'
  | 'notPermitted'
  | 'requestFailed'
  | 'withdrawFailed'
  | 'noPermissionWithdraw'
  | 'decisionFailed'
  | 'noPermissionDecide'

const LEAVE_REQUEST_ERROR_CODES: LeaveRequestErrorCode[] = [
  'startDateRequired',
  'endDateRequired',
  'endBeforeStart',
  'notPermitted',
  'requestFailed',
  'withdrawFailed',
  'noPermissionWithdraw',
  'decisionFailed',
  'noPermissionDecide',
]

export function resolveLeaveRequestError(code: string | undefined, t: (key: string) => string): string | null {
  if (!code) return null
  return (LEAVE_REQUEST_ERROR_CODES as string[]).includes(code) ? t(code) : t('requestFailed')
}
