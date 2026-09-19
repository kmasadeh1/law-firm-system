import { type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from '@/i18n/routing'
import { updateSession } from '@/lib/supabase/proxy'

const handlePublicSite = createIntlMiddleware(routing)

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Staff area: refresh the Supabase session and (inside updateSession) gate
  // /dashboard/* for unauthenticated visitors. Not localized.
  if (pathname === '/login' || pathname === '/change-password' || pathname.startsWith('/dashboard')) {
    return updateSession(request)
  }

  // Everything else is the public, bilingual site - hand off to next-intl for
  // locale detection/redirects (including "/" -> "/<default-locale>").
  return handlePublicSite(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
