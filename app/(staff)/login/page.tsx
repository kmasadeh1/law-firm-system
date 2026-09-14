import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Crest } from '@/components/crest'
import { login } from './actions'

export default async function LoginPage({ searchParams }: PageProps<'/login'>) {
  const { error } = (await searchParams) as { error?: string }

  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  if (user) {
    const { data: staffRow } = await supabase
      .from('staff')
      .select('user_type')
      .eq('id', user.sub)
      .maybeSingle()

    redirect(staffRow?.user_type === 'owner' ? '/dashboard/owner' : '/dashboard/staff')
  }

  return (
    <div className="grid min-h-screen grid-cols-1 md:grid-cols-2">
      {/* Branding panel */}
      <div className="relative flex flex-col justify-between overflow-hidden bg-burgundy px-8 py-10 text-paper sm:px-12 md:py-16">
        <div className="flex items-center gap-3">
          <Crest className="h-9 w-9 text-brass" />
          <span className="font-heading text-lg tracking-wide">Firm Name LLP</span>
        </div>

        <div className="max-w-sm">
          <p className="font-heading text-3xl leading-snug sm:text-4xl">
            Staff sign in
          </p>
          <p className="mt-4 text-sm leading-relaxed text-paper-dim">
            This area is for firm staff only. Clients and visitors looking for
            the firm&apos;s public site should head back to the homepage.
          </p>
        </div>

        <div className="h-px w-16 bg-brass/60" aria-hidden="true" />
      </div>

      {/* Form panel */}
      <div className="flex flex-col items-center justify-center bg-ink px-6 py-16 sm:px-12">
        <form
          action={login}
          className="flex w-full max-w-sm flex-col gap-5"
        >
          <div className="mb-2 md:hidden">
            <div className="flex items-center gap-2 text-brass">
              <Crest className="h-6 w-6" />
              <span className="font-heading text-base text-paper">Firm Name LLP</span>
            </div>
          </div>

          <h1 className="font-heading text-2xl text-paper">Sign in</h1>

          {error && (
            <p className="rounded-sm border border-burgundy bg-burgundy/20 px-3 py-2 text-sm text-paper">
              {error}
            </p>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm text-paper-dim">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              className="rounded-sm border border-warm-grey/40 bg-ink-raised px-3 py-2 text-sm text-paper outline-none transition-colors focus:border-brass"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm text-paper-dim">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="rounded-sm border border-warm-grey/40 bg-ink-raised px-3 py-2 text-sm text-paper outline-none transition-colors focus:border-brass"
            />
          </div>

          <button
            type="submit"
            className="mt-2 rounded-sm bg-burgundy px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-burgundy-dim"
          >
            Log in
          </button>

          <button
            type="button"
            disabled
            title="Not implemented yet"
            className="cursor-not-allowed text-left text-sm text-warm-grey"
          >
            Forgot password? (coming soon)
          </button>
        </form>
      </div>
    </div>
  )
}
