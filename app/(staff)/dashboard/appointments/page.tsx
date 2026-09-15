import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '../back-link'

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default async function AppointmentsListPage({
  searchParams,
}: PageProps<'/dashboard/appointments'>) {
  const { from, to, type } = (await searchParams) as { from?: string; to?: string; type?: string }
  const supabase = await createClient()

  // No access gate here - this just renders whatever RLS returns for the
  // signed-in user (owner, appointments_view_all, court_dates_manage for
  // court dates, or their own appointments), including a legitimately
  // narrow or empty list.
  let query = supabase
    .from('appointments')
    .select('id, type, status, starts_at, ends_at, clients(full_name), cases(case_number)')
    .order('starts_at', { ascending: true })

  if (from) {
    query = query.gte('starts_at', new Date(from).toISOString())
  }
  if (to) {
    query = query.lte('starts_at', new Date(to).toISOString())
  }
  if (type === 'consultation' || type === 'court_date') {
    query = query.eq('type', type)
  }

  const { data: appointments } = await query

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div>
          <BackLink />
          <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
            <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">Appointments</h1>
            <Link
              href="/dashboard/appointments/new"
              className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              New appointment
            </Link>
          </div>
        </div>

        <form method="get" className="flex flex-wrap items-end gap-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="from" className="text-xs text-zinc-500 dark:text-zinc-400">
              From
            </label>
            <input
              id="from"
              type="date"
              name="from"
              defaultValue={from ?? ''}
              className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="to" className="text-xs text-zinc-500 dark:text-zinc-400">
              To
            </label>
            <input
              id="to"
              type="date"
              name="to"
              defaultValue={to ?? ''}
              className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
            />
          </div>
          <select
            name="type"
            defaultValue={type ?? ''}
            className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
          >
            <option value="">All types</option>
            <option value="consultation">Consultation</option>
            <option value="court_date">Court date</option>
          </select>
          <button
            type="submit"
            className="rounded-md border border-black/10 px-4 py-2 text-sm text-black transition-colors hover:bg-black/5 dark:border-white/10 dark:text-zinc-50 dark:hover:bg-white/10"
          >
            Filter
          </button>
          {(from || to || type) && (
            <Link
              href="/dashboard/appointments"
              className="flex items-center text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              Clear
            </Link>
          )}
        </form>

        {!appointments || appointments.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {from || to || type
              ? 'No appointments match those filters.'
              : 'No appointments yet - either none exist, or none are visible to you.'}
          </p>
        ) : (
          <ul className="flex flex-col divide-y divide-black/10 rounded-lg border border-black/10 dark:divide-white/10 dark:border-white/10">
            {appointments.map((a) => (
              <li key={a.id}>
                <Link
                  href={`/dashboard/appointments/${a.id}`}
                  className="flex flex-wrap items-center justify-between gap-1 px-4 py-3 text-sm transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                >
                  <span>
                    <span className="font-medium text-black dark:text-zinc-50">
                      {formatDateTime(a.starts_at)}
                    </span>
                    <span className="text-zinc-500 dark:text-zinc-400">
                      {' '}
                      — {a.type === 'court_date' ? 'Court date' : 'Consultation'}
                    </span>
                  </span>
                  <span className="text-zinc-500 dark:text-zinc-400">
                    {a.clients?.full_name ?? '—'}
                    {a.cases?.case_number && <> · {a.cases.case_number}</>} · {a.status}
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
