import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
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
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-zinc-50 px-4 dark:bg-black">
      <form
        action={login}
        className="flex w-full max-w-sm flex-col gap-4 rounded-lg border border-black/10 bg-white p-8 dark:border-white/10 dark:bg-zinc-950"
      >
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Sign in
        </h1>

        {error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex flex-col gap-1">
          <label
            htmlFor="email"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="username"
            className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="password"
            className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
          />
        </div>

        <button
          type="submit"
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Log in
        </button>

        <button
          type="button"
          disabled
          title="Not implemented yet"
          className="cursor-not-allowed text-left text-sm text-zinc-400"
        >
          Forgot password? (coming soon)
        </button>
      </form>
    </div>
  )
}
