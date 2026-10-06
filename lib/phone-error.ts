// Phone columns (clients, staff, enquiries, opposing-party counsel) are
// normalised by the database on write: a Jordanian number is stored as
// +962..., a number with any other country code passes through, and
// anything else is refused with 23514 under the constraint name
// 'normalise_phone'. Told apart by name so it never shares a message with
// another CHECK on the same form.
export function isPhoneRefusal(error: { code?: string; message?: string } | null | undefined): boolean {
  return error?.code === '23514' && (error.message ?? '').includes('normalise_phone')
}
