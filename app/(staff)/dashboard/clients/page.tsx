import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { LinkButton, Button } from '@/components/dashboard/button'
import { controlClass } from '@/components/dashboard/form'

export default async function ClientsListPage({ searchParams }: PageProps<'/dashboard/clients'>) {
  const { q } = (await searchParams) as { q?: string }
  const supabase = await createClient()

  const term = q?.trim()

  const { data: clients } = await supabase
    .rpc('search_clients', { p_query: term })
    .select('id, full_name, phone, national_id')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Clients"
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/dashboard/clients/conflict-checks" variant="secondary">
              Conflict-check history
            </LinkButton>
            <LinkButton href="/dashboard/clients/new" variant="primary">
              Add client
            </LinkButton>
          </div>
        }
      />

      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="text"
          name="q"
          defaultValue={term ?? ''}
          placeholder="Search by name, phone, or national ID"
          className={`w-full max-w-sm ${controlClass}`}
        />
        <Button type="submit" variant="secondary">
          Search
        </Button>
        {term && (
          <Link
            href="/dashboard/clients"
            className="flex items-center text-sm text-fg-muted underline-offset-2 hover:underline"
          >
            Clear
          </Link>
        )}
      </form>

      {!clients || clients.length === 0 ? (
        <EmptyState
          title={term ? 'No clients match that search.' : 'No clients yet'}
          description={term ? undefined : 'Add your first client to start building case files.'}
          action={
            !term && (
              <LinkButton href="/dashboard/clients/new" variant="secondary">
                Add client
              </LinkButton>
            )
          }
        />
      ) : (
        <Panel className="p-0">
          <ul className="flex flex-col divide-y divide-line">
            {clients.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/dashboard/clients/${c.id}`}
                  className="flex flex-wrap items-center justify-between gap-1 px-5 py-3 text-sm transition-colors hover:bg-line/30"
                >
                  <span className="font-medium text-fg">{c.full_name}</span>
                  <span className="text-fg-muted">
                    {[c.phone, c.national_id].filter(Boolean).join(' · ') || '—'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  )
}
