import { getTranslations } from 'next-intl/server'
import { BackLink } from './back-link'
import { EmptyState } from './empty-state'

// Shared by every route under /dashboard/owner (see owner/layout.tsx) and
// /dashboard/reference (see reference/layout.tsx) - one no-access state per
// subtree rather than a copy in every page. The dashboard shell and nav stay
// mounted around this, since the parent layout still renders them; this
// only replaces {children}.
//
// The owner subtree says "Owner access only"; the reference subtree can be
// opened by a role holding reference_data_manage, so it gets a title that
// doesn't claim the screen is the owner's alone.
export async function OwnerNoAccess({
  locale,
  variant = 'owner',
}: {
  locale: string
  variant?: 'owner' | 'permission'
}) {
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.noAccess' })
  const tNav = await getTranslations({ locale, namespace: 'dashboard.nav' })

  return (
    <div className="flex flex-col gap-6" data-testid={variant === 'owner' ? 'owner-no-access' : 'permission-no-access'}>
      <BackLink href="/dashboard" label={tNav('home')} />
      <EmptyState title={variant === 'owner' ? t('title') : t('permissionTitle')} description={t('description')} />
    </div>
  )
}
