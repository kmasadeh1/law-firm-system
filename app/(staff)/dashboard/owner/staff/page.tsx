import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { BackLink } from '@/components/dashboard/back-link'
import { PageHeader } from '@/components/dashboard/page-header'
import { StaffAdmin } from './staff-admin'

export default async function StaffAdminPage({ searchParams }: PageProps<'/dashboard/owner/staff'>) {
  const { showInactive } = (await searchParams) as { showInactive?: string }
  const includeInactive = showInactive === '1'

  const supabase = await createClient()

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
        <BackLink href="/dashboard/owner" label="Firm overview" />
        <PageHeader
          title="Staff accounts"
          description="Create logins, reissue temporary passwords, and activate or deactivate staff. Accounts are never deleted."
          action={
            <Link
              href={includeInactive ? '/dashboard/owner/staff' : '/dashboard/owner/staff?showInactive=1'}
              className="text-sm text-accent-fg underline-offset-2 hover:underline"
            >
              {includeInactive ? 'Hide deactivated staff' : 'Show deactivated staff'}
            </Link>
          }
        />
      </div>

      <StaffAdmin staff={staffRows ?? []} roles={roles ?? []} />
    </div>
  )
}
