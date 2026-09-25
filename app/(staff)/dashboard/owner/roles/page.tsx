import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'
import { RolesAdmin } from './roles-admin'
import { PageHeader } from '@/components/dashboard/page-header'

export default async function RolesPage() {
  const supabase = await createClient()
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.roles' })

  const [{ data: roles }, { data: permissionKeys }, { data: rolePermissions }] = await Promise.all([
    supabase.from('roles').select('id, name, name_ar').order('name'),
    supabase.from('permission_keys').select('key, label, description, owner_only').order('key'),
    supabase.from('role_permissions').select('role_id, permission_key, enabled'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} />

      <RolesAdmin
        roles={roles ?? []}
        permissionKeys={permissionKeys ?? []}
        rolePermissions={rolePermissions ?? []}
      />
    </div>
  )
}
