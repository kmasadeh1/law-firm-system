import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { LinkButton, Button } from '@/components/dashboard/button'
import { controlClass } from '@/components/dashboard/form'

export default async function ClientsListPage({ searchParams }: PageProps<'/dashboard/clients'>) {
  const { q } = (await searchParams) as { q?: string }
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.clients.list' })

  const term = q?.trim()

  const { data: clients } = await supabase
    .rpc('search_clients', { p_query: term })
    .select('id, full_name, phone, national_id')

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        action={
          <div className="flex flex-wrap gap-2">
            <LinkButton href="/dashboard/clients/conflict-checks" variant="secondary">
              {t('conflictCheckHistory')}
            </LinkButton>
            <LinkButton href="/dashboard/clients/new" variant="primary">
              {t('addClient')}
            </LinkButton>
          </div>
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
            !term && (
              <LinkButton href="/dashboard/clients/new" variant="secondary">
                {t('addClient')}
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
      )}
    </div>
  )
}
