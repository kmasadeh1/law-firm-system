import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { RolesAdmin } from './roles-admin'

export default async function RolesPage() {
  const supabase = await createClient()

  const [{ data: roles }, { data: permissionKeys }, { data: rolePermissions }] = await Promise.all([
    supabase.from('roles').select('id, name').order('name'),
    supabase.from('permission_keys').select('key, label, description, owner_only').order('key'),
    supabase.from('role_permissions').select('role_id, permission_key, enabled'),
  ])

  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-10 dark:bg-black sm:px-8">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href="/dashboard/owner"
              className="text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
            >
              ← Owner dashboard
            </Link>
            <h1 className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">
              Roles &amp; permissions
            </h1>
          </div>
        </div>

        <RolesAdmin
          roles={roles ?? []}
          permissionKeys={permissionKeys ?? []}
          rolePermissions={rolePermissions ?? []}
        />
      </div>
    </div>
  )
}
