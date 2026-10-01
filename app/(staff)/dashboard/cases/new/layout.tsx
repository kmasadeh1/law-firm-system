import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

/**
 * Only the auth check redirects. Whether the signed-in user can actually
 * create a case (cases_manage) is asked in page.tsx itself, which renders a
 * "you don't have access" state instead of the form rather than bouncing
 * back to /dashboard/cases - the URL is reachable directly, so silently
 * redirecting away reads as a broken link rather than an explained refusal.
 */
export default async function NewCaseLayout({ children }: LayoutProps<'/dashboard/cases/new'>) {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (!user) {
    redirect('/login')
  }

  return <>{children}</>
}
