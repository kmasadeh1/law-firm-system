import { createClient } from '@/lib/supabase/server'

/**
 * Server-only: resolves the signed-in staff member's locale, the same way
 * app/(staff)/layout.tsx does. Nested Server Components don't share state
 * with a parent layout, so anything below the root layout that needs
 * locale (rather than just dir/lang, already set on <html>) re-derives it
 * here instead of re-implementing the lookup. Defaults to 'en' when
 * unauthenticated or unset.
 *
 * If a component already queries `staff` for other columns, add `locale`
 * to that existing select instead of calling this - it's a second round
 * trip otherwise.
 */
export async function getStaffLocale(): Promise<'en' | 'ar'> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims
  if (!user) return 'en'

  const { data: staffRow } = await supabase
    .from('staff')
    .select('locale')
    .eq('id', user.sub as string)
    .maybeSingle()

  return staffRow?.locale === 'ar' ? 'ar' : 'en'
}
