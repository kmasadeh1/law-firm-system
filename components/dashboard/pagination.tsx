import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { pageWindow, totalPages as computeTotalPages } from '@/lib/pagination'
import { formatNumber } from '@/lib/format-number'

const linkClass =
  'inline-flex min-w-8 items-center justify-center rounded-md border border-line px-2.5 py-1.5 text-sm text-fg transition-colors hover:bg-line/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus'
const disabledClass =
  'inline-flex min-w-8 items-center justify-center rounded-md border border-line px-2.5 py-1.5 text-sm text-fg-muted opacity-50 cursor-not-allowed'
const currentClass =
  'inline-flex min-w-8 items-center justify-center rounded-md border border-accent-border bg-accent px-2.5 py-1.5 text-sm font-medium text-accent-fg'

/**
 * Shared by the cases and clients lists (and any future paginated list).
 * Page number is URL state - every control is a plain <a> built from the
 * caller's own searchParams plus a new `page` value, not a client-side
 * state update, so the current page survives a refresh and is linkable.
 * Disabled ends (first/previous at page 1, next/last at the last page) are
 * rendered, not hidden - this is navigation, not a permission the database
 * might refuse, so a disabled control correctly tells the user where they
 * are rather than disappearing.
 */
export async function Pagination({
  page,
  pageSize,
  total,
  locale,
  basePath,
  searchParams,
  testId,
}: {
  page: number
  pageSize: number
  total: number
  locale: string
  basePath: string
  // Every OTHER query param to preserve across page links (search term,
  // filter) - 'page' itself is set per-link below, never read from here.
  searchParams: Record<string, string | undefined>
  testId: string
}) {
  const t = await getTranslations({ locale, namespace: 'dashboard.common.pagination' })
  const total_pages = computeTotalPages(total, pageSize)

  function hrefFor(targetPage: number): string {
    const params = new URLSearchParams()
    for (const [key, value] of Object.entries(searchParams)) {
      if (value) params.set(key, value)
    }
    if (targetPage > 1) params.set('page', String(targetPage))
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const atStart = page <= 1
  const atEnd = page >= total_pages

  const pages = pageWindow(page, total_pages)

  return (
    <div className="flex flex-wrap items-center justify-between gap-3" data-testid={testId}>
      <p className="text-sm text-fg-muted">
        {t('showing', {
          from: formatNumber(from, locale),
          to: formatNumber(to, locale),
          total: formatNumber(total, locale),
        })}
      </p>

      <nav aria-label={t('navLabel')} className="flex flex-wrap items-center gap-1">
        {atStart ? (
          <span className={disabledClass} aria-disabled="true" data-testid={`${testId}-first`}>
            {t('first')}
          </span>
        ) : (
          <Link href={hrefFor(1)} className={linkClass} data-testid={`${testId}-first`}>
            {t('first')}
          </Link>
        )}
        {atStart ? (
          <span className={disabledClass} aria-disabled="true" data-testid={`${testId}-previous`}>
            {t('previous')}
          </span>
        ) : (
          <Link href={hrefFor(page - 1)} className={linkClass} data-testid={`${testId}-previous`}>
            {t('previous')}
          </Link>
        )}

        {pages.map((p, i) =>
          p === 'ellipsis' ? (
            <span key={`ellipsis-${i}`} className="px-1 text-sm text-fg-muted" aria-hidden="true">
              …
            </span>
          ) : p === page ? (
            <span
              key={p}
              className={currentClass}
              aria-current="page"
              data-testid={`${testId}-page-${p}`}
            >
              {formatNumber(p, locale)}
            </span>
          ) : (
            <Link
              key={p}
              href={hrefFor(p)}
              className={linkClass}
              aria-label={t('pageLabel', { page: formatNumber(p, locale) })}
              data-testid={`${testId}-page-${p}`}
            >
              {formatNumber(p, locale)}
            </Link>
          )
        )}

        {atEnd ? (
          <span className={disabledClass} aria-disabled="true" data-testid={`${testId}-next`}>
            {t('next')}
          </span>
        ) : (
          <Link href={hrefFor(page + 1)} className={linkClass} data-testid={`${testId}-next`}>
            {t('next')}
          </Link>
        )}
        {atEnd ? (
          <span className={disabledClass} aria-disabled="true" data-testid={`${testId}-last`}>
            {t('last')}
          </span>
        ) : (
          <Link href={hrefFor(total_pages)} className={linkClass} data-testid={`${testId}-last`}>
            {t('last')}
          </Link>
        )}
      </nav>
    </div>
  )
}
