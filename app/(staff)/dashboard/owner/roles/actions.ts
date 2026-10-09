'use server'

import { revalidatePath } from 'next/cache'
import { getTranslations } from 'next-intl/server'
import { createClient } from '@/lib/supabase/server'
import { getStaffLocale } from '@/lib/get-staff-locale'

const ROLES_PATH = '/dashboard/owner/roles'

type ActionResult = { error?: string }

// Postgres error codes we translate into a readable message. Anything else
// falls back to a generic message - these mutations are gated entirely by
// RLS (see role_permissions/roles policies), so this is just explaining a
// constraint that already exists, not adding a new rule.
const UNIQUE_VIOLATION = '23505'
const FOREIGN_KEY_VIOLATION = '23503'

export async function createRole(
  name: string,
  nameAr: string
): Promise<ActionResult & { role?: { id: string; name: string; name_ar: string | null } }> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.roles.errors' })
  const trimmed = name.trim()
  if (!trimmed) {
    return { error: t('roleNameRequired') }
  }

  const supabase = await createClient()
  // name_ar is sent as-is, untrimmed - a database trigger converts '' and
  // whitespace-only input to NULL on insert, so there's no need to
  // duplicate that here.
  const { data, error } = await supabase
    .from('roles')
    .insert({ name: trimmed, name_ar: nameAr })
    .select('id, name, name_ar')
    .single()

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: t('roleNameExists') }
    }
    return { error: t('createFailed') }
  }

  revalidatePath(ROLES_PATH)
  return { role: data }
}

export async function renameRole(roleId: string, name: string, nameAr: string): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.roles.errors' })
  const trimmed = name.trim()
  if (!trimmed) {
    return { error: t('roleNameRequired') }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('roles')
    .update({ name: trimmed, name_ar: nameAr })
    .eq('id', roleId)
    .select('id')

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      return { error: t('roleNameExists') }
    }
    return { error: t('renameFailed') }
  }
  // Zero rows: refused by RLS (raises nothing) or the role is gone.
  if (!data || data.length === 0) {
    return { error: t('renameFailed') }
  }

  revalidatePath(ROLES_PATH)
  return {}
}

export async function deleteRole(roleId: string): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.roles.errors' })
  const supabase = await createClient()
  const { data, error } = await supabase.from('roles').delete().eq('id', roleId).select('id')

  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return { error: t('roleInUse') }
    }
    return { error: t('deleteFailed') }
  }
  // Zero rows: refused by RLS or already deleted - not a success.
  if (!data || data.length === 0) {
    return { error: t('deleteFailed') }
  }

  revalidatePath(ROLES_PATH)
  return {}
}

export async function setRolePermission(
  roleId: string,
  permissionKey: string,
  enabled: boolean
): Promise<ActionResult> {
  const locale = await getStaffLocale()
  const t = await getTranslations({ locale, namespace: 'dashboard.admin.roles.errors' })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('role_permissions')
    .upsert(
      { role_id: roleId, permission_key: permissionKey, enabled },
      { onConflict: 'role_id,permission_key' }
    )
    .select('role_id')

  if (error) {
    return { error: t('permissionSaveFailed') }
  }
  // A refused insert raises 42501 (caught above); a refused update - the
  // row already exists - matches zero rows and raises nothing.
  if (!data || data.length === 0) {
    return { error: t('permissionSaveFailed') }
  }

  revalidatePath(ROLES_PATH)
  return {}
}
