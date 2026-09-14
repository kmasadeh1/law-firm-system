'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

const ROLES_PATH = '/dashboard/owner/roles'

type ActionResult = { error?: string }

// Postgres error codes we translate into a readable message. Anything else
// falls back to a generic message - these mutations are gated entirely by
// RLS (see role_permissions/roles policies), so this is just explaining a
// constraint that already exists, not adding a new rule.
const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'

export async function createRole(
  name: string
): Promise<ActionResult & { role?: { id: string; name: string } }> {
  const trimmed = name.trim()
  if (!trimmed) {
    return { error: 'Role name is required.' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('roles')
    .insert({ name: trimmed })
    .select('id, name')
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: 'A role with that name already exists.' }
    }
    return { error: 'Could not create the role. Please try again.' }
  }

  revalidatePath(ROLES_PATH)
  return { role: data }
}

export async function renameRole(roleId: string, name: string): Promise<ActionResult> {
  const trimmed = name.trim()
  if (!trimmed) {
    return { error: 'Role name is required.' }
  }

  const supabase = await createClient()
  const { error } = await supabase.from('roles').update({ name: trimmed }).eq('id', roleId)

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: 'A role with that name already exists.' }
    }
    return { error: 'Could not rename the role. Please try again.' }
  }

  revalidatePath(ROLES_PATH)
  return {}
}

export async function deleteRole(roleId: string): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('roles').delete().eq('id', roleId)

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return { error: "Can't delete a role while staff are assigned to it." }
    }
    return { error: 'Could not delete the role. Please try again.' }
  }

  revalidatePath(ROLES_PATH)
  return {}
}

export async function setRolePermission(
  roleId: string,
  permissionKey: string,
  enabled: boolean
): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase
    .from('role_permissions')
    .upsert(
      { role_id: roleId, permission_key: permissionKey, enabled },
      { onConflict: 'role_id,permission_key' }
    )

  if (error) {
    return { error: 'Could not save that change. Please try again.' }
  }

  revalidatePath(ROLES_PATH)
  return {}
}
