import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { Crest } from '@/components/crest'
import { ChangePasswordForm } from './change-password-form'

export default async function ChangePasswordPage() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (!user) {
    redirect('/login')
  }

  const { data: staffRow } = await supabase
    .from('staff')
    .select('must_change_password, user_type')
    .eq('id', user.sub as string)
    .maybeSingle()

  // proxy.ts already redirects a cleared account away from here, but this
  // page can still be requested directly - re-check rather than trust the
  // route was reached only through the gate.
  if (!staffRow?.must_change_password) {
    redirect(staffRow?.user_type === 'owner' ? '/dashboard/owner' : '/dashboard/staff')
  }

  const homeHref = staffRow.user_type === 'owner' ? '/dashboard/owner' : '/dashboard/staff'

  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'staffAuth' })

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      <div className="relative flex flex-col justify-between overflow-hidden bg-ink-raised px-8 py-10 text-paper sm:px-12 md:py-16">
        <div className="flex items-center gap-3">
          <Crest className="h-9 w-9" />
          <span className="flex flex-col">
            <span className="font-heading text-lg leading-tight tracking-wide">{t('firmName')}</span>
            <span className="text-xs text-paper-dim">{t('firmTagline')}</span>
          </span>
        </div>

        <div className="max-w-sm">
          <p className="font-heading text-3xl leading-snug sm:text-4xl">Set a new password</p>
          <p className="mt-4 text-sm leading-relaxed text-paper-dim">
            You&apos;re signed in with a temporary password. Choose your own before you can use
            the rest of the dashboard.
          </p>
        </div>

        <div className="h-px w-16 bg-brass/60" aria-hidden="true" />
      </div>

      <div className="flex flex-col items-center justify-center bg-ink px-6 py-16 sm:px-12">
        <div className="mb-2 w-full max-w-sm md:hidden">
          <div className="flex items-center gap-2">
            <Crest className="h-6 w-6" />
            <span className="font-heading text-base text-paper">{t('firmName')}</span>
          </div>
        </div>
        <h1 className="mb-5 w-full max-w-sm font-heading text-2xl text-paper">Change password</h1>
        <ChangePasswordForm homeHref={homeHref} />
      </div>
    </div>
  )
}
