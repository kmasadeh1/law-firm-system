// Single source for the client-visible half of Supabase Auth's password
// policy (Dashboard > Auth > Policies). Only the length is duplicated here -
// character-class requirements stay server-side only (see weakPassword).
export const MIN_PASSWORD_LENGTH = 12
