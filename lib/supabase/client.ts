import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase client for Client Components ("use client").
 * Safe to call on every render - the browser client is memoized internally.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
