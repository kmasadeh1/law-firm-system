import { getTranslations } from 'next-intl/server'
import { BackLink } from './back-link'
import { EmptyState } from './empty-state'

// Shared by every route under /dashboard/owner (see owner/layout.tsx) - one
// no-access state for the whole subtree rather than seven copies in seven
// pages. The dashboard shell and nav stay mounted around this, since the
// parent layout still renders them; this only replaces {children}.
export async function OwnerNoAccess({ locale }: { locale: string }) {
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.noAccess' })
  const tNav = await getTranslations({ locale, namespace: 'dashboard.nav' })

  return (
    <div className="flex flex-col gap-6" data-testid="owner-no-access">
      <BackLink href="/dashboard" label={tNav('home')} />
      <EmptyState title={t('title')} description={t('description')} />
    </div>
  )
}
