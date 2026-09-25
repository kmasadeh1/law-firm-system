// Closed set of codes the fees server actions (actions.ts) can return, and
// the shared lookup that turns one into translated text. Not a 'use server'
// module - a plain helper the client components import directly, since
// Next.js requires every export of a 'use server' file to itself be an
// async server action.

export type FeesErrorCode =
  | 'select_client'
  | 'select_fee_type'
  | 'enter_amount'
  | 'enter_percentage'
  | 'invalid_fee_type_amount'
  | 'create_failed'
  | 'cases_link_failed'
  | 'select_case'
  | 'case_wrong_client'
  | 'case_already_linked'
  | 'link_failed'
  | 'unlink_failed'
  | 'document_not_found'
  | 'document_not_linked'
  | 'save_failed'
  | 'no_permission_change'
  | 'link_generation_failed'
  | 'description_required'
  | 'invalid_amount'
  | 'add_installment_failed'
  | 'save_installment_failed'
  | 'installment_has_payments'
  | 'delete_installment_failed'
  | 'date_required'
  | 'no_permission_record_payment'
  | 'record_payment_failed'

export const FEES_ERROR_CODES: FeesErrorCode[] = [
  'select_client',
  'select_fee_type',
  'enter_amount',
  'enter_percentage',
  'invalid_fee_type_amount',
  'create_failed',
  'cases_link_failed',
  'select_case',
  'case_wrong_client',
  'case_already_linked',
  'link_failed',
  'unlink_failed',
  'document_not_found',
  'document_not_linked',
  'save_failed',
  'no_permission_change',
  'link_generation_failed',
  'description_required',
  'invalid_amount',
  'add_installment_failed',
  'save_installment_failed',
  'installment_has_payments',
  'delete_installment_failed',
  'date_required',
  'no_permission_record_payment',
  'record_payment_failed',
]

// A caller-controlled value never reaches t() as a message key - validate
// against the closed set first, and fall back to a generic translated
// error rather than a blank slot or a raw key path for anything else.
export function resolveFeesError(code: string | undefined, t: (key: string) => string): string | null {
  if (!code) return null
  return (FEES_ERROR_CODES as string[]).includes(code) ? t(code) : t('generic')
}
