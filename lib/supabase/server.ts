import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

/**
 * Supabase client for Server Components, Server Actions and Route Handlers.
 *
 * `cookies()` is async as of Next.js 15, so this is async too - always call it
 * as `const supabase = await createClient()`. Create it per request; never
 * share the instance across requests.
 */
export async function createClient() {
  const cookieStore = await cookies()

  const supabase = createServerClient<Database>(
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

  if (process.env.NODE_ENV !== 'production') {
    attachSignOutTracer(supabase)
  }

  return supabase
}

// TEMPORARY diagnostic instrumentation for the "session lost on
// create-and-navigate" investigation (see CLAUDE.md). Dev-only, pure
// observation - logs who calls signOut() and does not alter its behavior
// or return value. Remove once the bug is found and fixed.
function attachSignOutTracer(supabase: ReturnType<typeof createServerClient<Database>>) {
  const originalSignOut = supabase.auth.signOut.bind(supabase.auth)
  supabase.auth.signOut = ((...args: Parameters<typeof originalSignOut>) => {
    console.error(
      '[signOut-tracer]',
      new Date().toISOString(),
      new Error('signOut() invoked - stack trace').stack
    )
    return originalSignOut(...args)
  }) as typeof originalSignOut
}
