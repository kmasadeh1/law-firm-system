import Link from 'next/link'
import { rowLabel } from '@/lib/row-label'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { PageHeader } from '@/components/dashboard/page-header'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Pagination } from '@/components/dashboard/pagination'
import { LinkButton, Button } from '@/components/dashboard/button'
import { controlClass } from '@/components/dashboard/form'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { localizedName } from '@/lib/localized-name'
import { PAGE_SIZE, parsePage, pageRange } from '@/lib/pagination'
import { dashboardTitle } from '@/lib/page-title'

export default async function CasesListPage({ searchParams }: PageProps<'/dashboard/cases'>) {
  const { q, status, type, page: pageParam } = (await searchParams) as {
    q?: string
    status?: string
    type?: string
    page?: string
  }
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.cases.list' })
  const page = parsePage(pageParam)
  const { from, to } = pageRange(page, PAGE_SIZE)

  const [{ data: statuses }, { data: caseTypes }, { data: canCreate }] = await Promise.all([
    supabase.from('case_statuses').select('id, name, name_ar, sort_order').order('sort_order'),
    // Every case type, active or not - the picker below shows active ones
    // only, plus the current `type` param's row if it names an inactive
    // one, so a deactivated type never silently vanishes out from under a
    // filter the user is already applying.
    supabase
      .from('case_types')
      .select('id, name_en, name_ar, is_active')
      .order('sort_order', { nullsFirst: false })
      .order('name_en'),
    // Server-side, not inferred from the list coming back empty - the Lawyer
    // role sees its own assigned cases in an otherwise-empty list, which is
    // not the same thing as "cannot create one."
    supabase.rpc('has_permission', { p_key: 'cases_manage' }),
  ])

  const typeOptions = (caseTypes ?? []).filter((ct) => ct.is_active || ct.id === type)

  // No access gate here - this just renders whatever RLS returns for the
  // signed-in user (owner, cases_manage, or their own case assignments),
  // including a legitimately empty list.
  let query = supabase
    .from('cases')
    .select(
      'id, case_number, title, clients(full_name), case_statuses(name, name_ar), case_types(name_en, name_ar)'
    )
    .order('created_at', { ascending: false })

  // Counted separately (head: true, no rows returned) with the exact same
  // filters as the row query below - RLS applies to both, so this is the
  // filtered, permission-scoped total, never a client-side count and never
  // the whole table's count.
  let countQuery = supabase.from('cases').select('id', { count: 'exact', head: true })

  const term = q?.trim()
  if (term) {
    const safe = term.replace(/[,()]/g, '')
    if (safe) {
      query = query.or(`case_number.ilike.%${safe}%,title.ilike.%${safe}%`)
      countQuery = countQuery.or(`case_number.ilike.%${safe}%,title.ilike.%${safe}%`)
    }
  }
  if (status) {
    query = query.eq('status_id', status)
    countQuery = countQuery.eq('status_id', status)
  }
  if (type) {
    query = query.eq('case_type_id', type)
    countQuery = countQuery.eq('case_type_id', type)
  }

  // Paging is ordering and limiting, so it belongs in the query - .range()
  // on the already-filtered, already-ordered query, not a fetch-everything-
  // then-slice in JavaScript.
  query = query.range(from, to)

  const [{ data: cases }, { count: total }] = await Promise.all([query, countQuery])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title={t('title')}
        action={
          canCreate === true ? (
            <LinkButton href="/dashboard/cases/new" variant="primary">
              {t('newCase')}
            </LinkButton>
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
        <select name="status" defaultValue={status ?? ''} className={controlClass}>
          <option value="">{t('allStatuses')}</option>
          {(statuses ?? []).map((s) => (
            <option key={s.id} value={s.id}>
              {localizedName(s, locale)}
            </option>
          ))}
        </select>
        <select
          name="type"
          defaultValue={type ?? ''}
          aria-label={t('typeFilterLabel')}
          className={controlClass}
        >
          <option value="">{t('allTypes')}</option>
          {typeOptions.map((ct) => (
            <option key={ct.id} value={ct.id}>
              {localizedName({ name: ct.name_en ?? '', name_ar: ct.name_ar }, locale)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="secondary">
          {t('filter')}
        </Button>
        {(term || status || type) && (
          <Link
            href="/dashboard/cases"
            className="flex items-center text-sm text-fg-muted underline-offset-2 hover:underline"
          >
            {t('clear')}
          </Link>
        )}
      </form>

      {!cases || cases.length === 0 ? (
        <EmptyState
          title={term || status || type ? t('noCasesFiltered') : t('noCasesYet')}
          description={term || status || type ? undefined : t('noCasesYetDescription')}
          action={
            !term && !status && !type && canCreate === true && (
              <LinkButton href="/dashboard/cases/new" variant="secondary">
                {t('newCase')}
              </LinkButton>
            )
          }
        />
      ) : (
        <>
          <Panel className="p-0">
            <ul className="flex flex-col divide-y divide-line">
              {cases.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/dashboard/cases/${c.id}`}
                    aria-label={rowLabel(
                      c.case_number,
                      c.title,
                      c.clients?.full_name,
                      c.case_statuses ? localizedName(c.case_statuses, locale) : null,
                      c.case_types
                        ? localizedName({ name: c.case_types.name_en ?? '', name_ar: c.case_types.name_ar }, locale)
                        : null
                    )}
                    className="flex flex-wrap items-center justify-between gap-1 px-5 py-3 text-sm transition-colors hover:bg-line/30"
                  >
                    <span>
                      <span className="font-medium text-fg">
                        <bdi>{c.case_number}</bdi>
                      </span>
                      <span className="text-fg-muted">
                        {' — '}
                        <bdi>{c.title}</bdi>
                      </span>
                    </span>
                    <span className="text-fg-muted">
                      <bdi>{c.clients?.full_name ?? '—'}</bdi> ·{' '}
                      {c.case_statuses ? localizedName(c.case_statuses, locale) : '—'}
                      {c.case_types && (
                        <>
                          {' · '}
                          {localizedName({ name: c.case_types.name_en ?? '', name_ar: c.case_types.name_ar }, locale)}
                        </>
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
            basePath="/dashboard/cases"
            searchParams={{ q: term, status, type }}
            testId="cases-pagination"
          />
        </>
      )}
    </div>
  )
}

export const generateMetadata = () => dashboardTitle('cases')
