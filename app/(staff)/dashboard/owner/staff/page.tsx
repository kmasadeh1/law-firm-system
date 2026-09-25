import Link from 'next/link'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { PageHeader } from '@/components/dashboard/page-header'
import { StaffAdmin } from './staff-admin'

export default async function StaffAdminPage({ searchParams }: PageProps<'/dashboard/owner/staff'>) {
  const { showInactive } = (await searchParams) as { showInactive?: string }
  const includeInactive = showInactive === '1'

  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.staff' })

  let staffQuery = supabase
    .from('staff')
    .select(
      'id, full_name, user_type, is_active, must_change_password, temp_password_set_at, temp_password_expires_at, roles(name, name_ar)'
    )
    .order('full_name')
  if (!includeInactive) {
    staffQuery = staffQuery.eq('is_active', true)
  }

  const [{ data: staffRows }, { data: roles }] = await Promise.all([
    staffQuery,
    supabase.from('roles').select('id, name, name_ar').order('name'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <PageHeader
          title={t('title')}
          description={t('description')}
          action={
            <Link
              href={includeInactive ? '/dashboard/owner/staff' : '/dashboard/owner/staff?showInactive=1'}
              className="text-sm text-fg-muted underline-offset-2 hover:underline"
            >
              {includeInactive ? t('hideDeactivated') : t('showDeactivated')}
            </Link>
          }
        />
      </div>

      <StaffAdmin staff={staffRows ?? []} roles={roles ?? []} />
    </div>
  )
}
