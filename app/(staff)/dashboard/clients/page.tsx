import Link from 'next/link'
import { rowLabel } from '@/lib/row-label'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Pagination } from '@/components/dashboard/pagination'
import { LinkButton, Button } from '@/components/dashboard/button'
import { controlClass } from '@/components/dashboard/form'
import { PAGE_SIZE, parsePage, pageRange } from '@/lib/pagination'
import { dashboardTitle } from '@/lib/page-title'

export default async function ClientsListPage({ searchParams }: PageProps<'/dashboard/clients'>) {
  const { q, page: pageParam } = (await searchParams) as { q?: string; page?: string }
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.clients.list' })

  const term = q?.trim()
  const page = parsePage(pageParam)
  const { from, to } = pageRange(page, PAGE_SIZE)

  const [{ data: clients }, { count: total }, { data: canManage }] = await Promise.all([
    // Paging belongs in the query - .range() on the same filtered,
    // DB-ordered call search_clients already makes, not a fetch-then-slice.
    supabase.rpc('search_clients', { p_query: term }).select('id, full_name, phone, national_id').range(from, to),
    // Same function, same filter, head: true so it returns only the count -
    // the RLS-scoped, filtered total, never a client-side count. count/head
    // are rpc()'s own third argument, not a chained .select() option - a
    // table .from() call takes them on .select() instead (see the cases
    // list), but rpc()'s request shape (HEAD vs POST) is decided before any
    // .select() chaining happens.
    supabase.rpc('search_clients', { p_query: term }, { count: 'exact', head: true }),
    // Read is broader than write now (owner, clients_manage, or being on a
    // case for that client) - asked once here for the write-only controls
    // below, never OR'd with is_owner() since has_permission already
    // returns true for the owner internally.
    supabase.rpc('has_permission', { p_key: 'clients_manage' }),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        action={
          canManage === true ? (
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/dashboard/clients/conflict-checks" variant="secondary">
                <bdi>{t('conflictCheckHistory')}</bdi>
              </LinkButton>
              <LinkButton href="/dashboard/clients/new" variant="primary">
                {t('addClient')}
              </LinkButton>
            </div>
          ) : undefined
        }
      />

      <form method="get" className="flex flex-wrap gap-2">
        <input
          type="text"
          name="q"
          defaultValue={term ?? ''}
          placeholder={t('searchPlaceholder')}
          className={`w-full max-w-sm ${controlClass}`}
        />
        <Button type="submit" variant="secondary">
          {t('search')}
        </Button>
        {term && (
          <Link
            href="/dashboard/clients"
            className="flex items-center text-sm text-fg-muted underline-offset-2 hover:underline"
          >
            {t('clear')}
          </Link>
        )}
      </form>

      {!clients || clients.length === 0 ? (
        <EmptyState
          title={term ? t('noClientsFiltered') : t('noClientsYet')}
          description={term ? undefined : t('noClientsYetDescription')}
          action={
            !term && canManage === true && (
              <LinkButton href="/dashboard/clients/new" variant="secondary">
                {t('addClient')}
              </LinkButton>
            )
          }
        />
      ) : (
        <>
          <Panel className="p-0">
            <ul className="flex flex-col divide-y divide-line">
              {clients.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/clients/${c.id}`}
                    aria-label={rowLabel(c.full_name, c.phone, c.national_id)}
                    className="flex flex-wrap items-center justify-between gap-1 px-5 py-3 text-sm transition-colors hover:bg-line/30"
                  >
                    <span className="font-medium text-fg">{c.full_name}</span>
                    <span className="text-fg-muted">
                      {c.phone || c.national_id ? (
                        <>
                          {c.phone && <bdi>{c.phone}</bdi>}
                          {c.phone && c.national_id && ' · '}
                          {c.national_id && <bdi>{c.national_id}</bdi>}
                        </>
                      ) : (
                        '—'
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Panel>

          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total ?? 0}
            locale={locale}
            basePath="/dashboard/clients"
            searchParams={{ q: term }}
            testId="clients-pagination"
          />
        </>
      )}
    </div>
  )
}

export const generateMetadata = () => dashboardTitle('clients')
