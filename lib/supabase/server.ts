import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * `cookies()` is async as of Next.js 15, so this is async too - always call it
 * as `const supabase = await createClient()`. Create it per request; never
 * share the instance across requests.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // The `setAll` method was called from a Server Component, which
            // cannot write cookies. Safe to ignore because the proxy refreshes
            // the session on every request.
          }
        },
      },
    }
  )
}
