import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { StaffAdmin } from './staff-admin'

export default async function StaffAdminPage() {
  const supabase = await createClient()

  const [{ data: staffRows }, { data: roles }] = await Promise.all([
    supabase
      .from('staff')
      .select(
        'id, full_name, user_type, is_active, must_change_password, temp_password_set_at, temp_password_expires_at, roles(name)'
      )
      .order('full_name'),
    supabase.from('roles').select('id, name').order('name'),
  ])

  return (
    <div className="flex flex-col gap-6">
      <div>
        <BackLink href="/dashboard/owner" label="Firm overview" />
        <PageHeader
          title="Staff accounts"
          description="Create logins, reissue temporary passwords, and activate or deactivate staff. Accounts are never deleted."
        />
      </div>

      <StaffAdmin staff={staffRows ?? []} roles={roles ?? []} />
    </div>
  )
}
