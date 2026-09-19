import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

/**
 * Admin client using the Supabase secret key - bypasses RLS entirely.
 * Only for the small set of operations that genuinely need it: creating an
 * auth user for a new staff account, and resetting an existing one's
 * password. Everything else (the staff row itself) goes through the normal
 * RLS-respecting client, since "owner manages staff" / "owner inserts
 * staff" policies already permit the owner to do that directly.
 *
 * `server-only` makes this a build error if anything ever imports it from a
 * client component. Never construct this client with any key other than
 * SUPABASE_SECRET_KEY, and never log or return the key or this client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!url || !secretKey) {
    throw new Error('SUPABASE_SECRET_KEY (or the Supabase URL) is not configured on the server.')
  }

  return createSupabaseClient<Database>(url, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
