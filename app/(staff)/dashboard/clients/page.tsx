import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '../back-link'

export default async function ClientsListPage({ searchParams }: PageProps<'/dashboard/clients'>) {
  const { q } = (await searchParams) as { q?: string }
  const supabase = await createClient()

  let query = supabase
    .from('clients')
    .select('id, full_name, phone, national_id')
    .order('full_name')

  const term = q?.trim()
  if (term) {
    // Strip characters that are structurally significant to PostgREST's
    // .or() filter syntax before interpolating - this is a plain search
    // box, not a query language.
    const safe = term.replace(/[,()]/g, '')
    if (safe) {
      query = query.or(
        `full_name.ilike.%${safe}%,phone.ilike.%${safe}%,national_id.ilike.%${safe}%`
      )
    }
  }

  const { data: clients } = await query

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <BackLink />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Clients</h1>
            <Link
              href="/dashboard/clients/new"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Add client
            </Link>
          </div>
        </div>

        <form method="get" className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={term ?? ''}
            placeholder="Search by name, phone, or national ID"
            className="w-full max-w-sm rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
          />
          <button
            type="submit"
            className="rounded-md border border-black/10 px-4 py-2 text-sm text-black transition-colors hover:bg-black/5 dark:border-white/10 dark:text-zinc-50 dark:hover:bg-white/10"
          >
            Search
          </button>
          {term && (
            <Link
              href="/dashboard/clients"
              className="flex items-center text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              Clear
            </Link>
          )}
        </form>

        {!clients || clients.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {term ? 'No clients match that search.' : 'No clients yet - add the first one above.'}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/10">
            {clients.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/clients/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-1 px-4 py-3 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span className="font-medium text-black dark:text-zinc-50">{c.full_name}</span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {[c.phone, c.national_id].filter(Boolean).join(' · ') || '—'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
