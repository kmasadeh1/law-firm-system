import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Refreshes the Supabase auth session on every matched request and forwards
 * the rotated cookies to both the request and the response.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
          Object.entries(headers).forEach(([key, value]) =>
            supabaseResponse.headers.set(key, value)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and supabase.auth.getClaims().
  // A simple mistake could make it very hard to debug issues with users being
  // randomly logged out.

  // IMPORTANT: If you remove getClaims() and you use server-side rendering
  // with the Supabase client, your users may be randomly logged out.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims
  const pathname = request.nextUrl.pathname

  // Only the staff dashboard (and the forced password-change screen) require
  // auth. /login itself is always open (its own page redirects an
  // already-signed-in visitor onward), and the public site is reachable
  // without signing in at all.
  if (!user && (pathname.startsWith('/dashboard') || pathname === '/change-password')) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // This redirect is UX only - the real gate is that must_change_password
  // makes is_owner()/has_permission()/is_active_staff()/is_on_case() all
  // return false at the database layer, so a signed-in-but-gated account
  // can't read or write anything beyond its own staff row regardless of
  // what routing does. Don't treat this block as the enforcement.
  if (user) {
    const { data: staffRow } = await supabase
      .from('staff')
      .select('must_change_password, user_type')
      .eq('id', user.sub as string)
      .maybeSingle()

    if (staffRow?.must_change_password && pathname.startsWith('/dashboard')) {
      const url = request.nextUrl.clone()
      url.pathname = '/change-password'
      return NextResponse.redirect(url)
    }

    if (!staffRow?.must_change_password && pathname === '/change-password') {
      const url = request.nextUrl.clone()
      url.pathname = staffRow?.user_type === 'owner' ? '/dashboard/owner' : '/dashboard/staff'
      return NextResponse.redirect(url)
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is. If you
  // create a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so: NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally: return myNewResponse
  return supabaseResponse
}
