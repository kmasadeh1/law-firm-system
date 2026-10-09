import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { Crest } from '@/components/crest'
import { LoginLocaleSwitcher } from '@/components/login-locale-switcher'
import { login, requestPasswordReset, type LoginErrorCode } from './actions'

const ERROR_CODES: LoginErrorCode[] = ['missingFields', 'invalidCredentials', 'noStaffAccount', 'deactivated']

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { error: errorCode, forgot } = (await searchParams) as { error?: string; forgot?: string }
  const forgotView = forgot === 'sent' ? 'sent' : forgot === '1' ? 'form' : null

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (user) {
    const { data: staffRow } = await supabase
      .from('staff')
      .select('user_type, must_change_password')
      .eq('id', user.sub)
      .maybeSingle()

    if (staffRow?.must_change_password) {
      redirect('/change-password')
    }

    redirect(staffRow?.user_type === 'owner' ? '/dashboard/owner' : '/dashboard/staff')
  }

  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'staffAuth' })
  const tLogin = await getTranslations({ locale, namespace: 'staffAuth.login' })
  const tForgot = await getTranslations({ locale, namespace: 'staffAuth.forgotPassword' })

  // errorCode comes from our own redirect (loginError in actions.ts), but
  // it's still a URL search param - validate against the closed set rather
  // than passing arbitrary text through to t().
  const error =
    errorCode && (ERROR_CODES as string[]).includes(errorCode)
      ? tLogin(`errors.${errorCode as LoginErrorCode}`)
      : null

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* Branding panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-ink-raised px-8 py-10 text-paper sm:px-12 md:py-16">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Crest className="h-9 w-9" />
            <span className="flex flex-col">
              <span className="font-heading text-lg leading-tight tracking-wide">{t('firmName')}</span>
              <span className="text-xs text-paper-dim">{t('firmTagline')}</span>
            </span>
          </div>
          <LoginLocaleSwitcher variant="desktop" />
        </div>

        <div className="max-w-sm">
          <p className="font-heading text-3xl leading-snug sm:text-4xl">{tLogin('brandingHeading')}</p>
          <p className="mt-4 text-sm leading-relaxed text-paper-dim">{tLogin('brandingBody')}</p>
        </div>

        <div className="h-px w-16 bg-brass/60" aria-hidden="true" />
      </div>

      {/* Form panel */}
      <div className="flex flex-col items-center justify-center bg-ink px-6 py-16 sm:px-12">
        {forgotView ? (
          <div className="flex w-full max-w-sm flex-col gap-5" data-testid="forgot-password-panel">
            <div className="mb-2 flex items-center justify-between gap-2 md:hidden">
              <div className="flex items-center gap-2">
                <Crest className="h-6 w-6" />
                <span className="font-heading text-base text-paper">{t('firmName')}</span>
              </div>
              <LoginLocaleSwitcher variant="mobile" />
            </div>

            <h1 className="font-heading text-2xl text-paper">{tForgot('heading')}</h1>

            {forgotView === 'sent' ? (
              <p
                data-testid="forgot-password-confirmation"
                role="status"
                className="rounded-sm border border-brass/50 bg-ink-raised px-3 py-2 text-sm leading-relaxed text-paper"
              >
                {tForgot('confirmation')}
              </p>
            ) : (
              <form action={requestPasswordReset} className="flex flex-col gap-5" data-testid="forgot-password-form">
                <p className="text-sm leading-relaxed text-paper-dim">{tForgot('intro')}</p>
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="forgot-email" className="text-sm text-paper-dim">
                    {tLogin('emailLabel')}
                  </label>
                  <input
                    id="forgot-email"
                    name="email"
                    type="text"
                    inputMode="email"
                    required
                    autoComplete="username"
                    dir="ltr"
                    data-testid="forgot-password-email"
                    className="rounded-sm border border-warm-grey/40 bg-ink-raised px-3 py-2 text-start text-sm text-paper outline-none transition-colors focus:border-brass"
                  />
                </div>
                <button
                  type="submit"
                  data-testid="forgot-password-submit"
                  className="mt-2 rounded-sm bg-brass px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-brass-hover"
                >
                  {tForgot('submit')}
                </button>
              </form>
            )}

            <Link
              href="/login"
              data-testid="forgot-password-back"
              className="text-start text-sm text-paper-dim underline-offset-2 transition-colors hover:text-paper hover:underline"
            >
              {tForgot('backToSignIn')}
            </Link>
          </div>
        ) : (
        <form
          action={login}
          className="flex w-full max-w-sm flex-col gap-5"
        >
          <div className="mb-2 flex items-center justify-between gap-2 md:hidden">
            <div className="flex items-center gap-2">
              <Crest className="h-6 w-6" />
              <span className="font-heading text-base text-paper">{t('firmName')}</span>
            </div>
            <LoginLocaleSwitcher variant="mobile" />
          </div>

          <h1 className="font-heading text-2xl text-paper">{tLogin('heading')}</h1>

          {error && (
            <p data-testid="login-error" className="rounded-sm border border-danger bg-danger/20 px-3 py-2 text-sm text-paper">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm text-paper-dim">
              {tLogin('emailLabel')}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              dir="ltr"
              className="rounded-sm border border-warm-grey/40 bg-ink-raised px-3 py-2 text-start text-sm text-paper outline-none transition-colors focus:border-brass"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm text-paper-dim">
              {tLogin('passwordLabel')}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="rounded-sm border border-warm-grey/40 bg-ink-raised px-3 py-2 text-start text-sm text-paper outline-none transition-colors focus:border-brass"
            />
          </div>

          <button
            type="submit"
            className="mt-2 rounded-sm bg-brass px-5 py-2.5 text-sm font-medium text-ink transition-colors hover:bg-brass-hover"
          >
            {tLogin('submit')}
          </button>

          <Link
            href="/login?forgot=1"
            data-testid="login-forgot-password-link"
            className="text-start text-sm text-paper-dim underline-offset-2 transition-colors hover:text-paper hover:underline"
          >
            {tLogin('forgotPassword')}
          </Link>
        </form>
        )}
      </div>
    </div>
  )
}
