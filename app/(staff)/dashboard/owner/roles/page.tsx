import { createClient } from '@/lib/supabase/server'
import { RolesAdmin } from './roles-admin'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'

export default async function RolesPage() {
  const supabase = await createClient()

  const [{ data: roles }, { data: permissionKeys }, { data: rolePermissions }] = await Promise.all([
    supabase.from('roles').select('id, name').order('name'),
    supabase.from('permission_keys').select('key, label, description, owner_only').order('key'),
    supabase.from('role_permissions').select('role_id, permission_key, enabled'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/dashboard/owner" label="Firm overview" />
        <PageHeader title="Roles & permissions" />
      </div>

      <RolesAdmin
        roles={roles ?? []}
        permissionKeys={permissionKeys ?? []}
        rolePermissions={rolePermissions ?? []}
      />
    </div>
  )
}
