'use server'

import { randomInt } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const STAFF_PATH = '/dashboard/owner/staff'
const TEMP_PASSWORD_VALID_DAYS = 7

// A caller-controlled value never reaches next-intl's t() directly - the
// render site validates against a whitelist, same as TeamErrorCode in
// cases/actions.ts. staffRecordFailedWithCleanup is the one code that
// carries a parameter, and it's a safe one (the orphaned auth user's id,
// needed so the owner can remove it manually) - never a raw Postgres/Auth
// error message, which used to leak internal detail to the client.
export type StaffErrorCode =
  | 'notPermitted'
  | 'fullNameRequired'
  | 'emailRequired'
  | 'chooseRole'
  | 'emailInUse'
  | 'couldNotCreateLogin'
  | 'staffRecordFailedRolledBack'
  | 'staffRecordFailedWithCleanup'
  | 'passwordResetButRecordFailed'
  | 'updateAccountFailed'

type ActionResult = { error?: StaffErrorCode; userId?: string }

// The service key bypasses RLS entirely, so this is asked first, on the
// caller's own session, before the admin client is ever touched - never
// inferred from the OwnerLayout route guard, which doesn't protect a
// Server Action invoked directly by its action id.
async function callerCanManageStaff(): Promise<boolean> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('has_permission', { p_key: 'staff_manage' })
  return !error && data === true
}

// Excludes visually ambiguous characters (0/O, 1/l/I) since this is read off
// a screen and typed back in by someone else, not autofilled.
const PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*'

function generateTempPassword(length = 16): string {
  let out = ''
  for (let i = 0; i < length; i++) {
    out += PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)]
  }
  return out
}

function expiryFromNow(): { setAt: string; expiresAt: string } {
  const now = new Date()
  const expires = new Date(now.getTime() + TEMP_PASSWORD_VALID_DAYS * 24 * 60 * 60 * 1000)
  return { setAt: now.toISOString(), expiresAt: expires.toISOString() }
}

export async function addStaff(formData: FormData): Promise<ActionResult & { password?: string }> {
  if (!(await callerCanManageStaff())) {
    return { error: 'notPermitted' }
  }

  const fullName = formData.get('full_name')
  const email = formData.get('email')
  const roleId = formData.get('role_id')

  if (typeof fullName !== 'string' || !fullName.trim()) {
    return { error: 'fullNameRequired' }
  }
  if (typeof email !== 'string' || !email.trim()) {
    return { error: 'emailRequired' }
  }
  if (typeof roleId !== 'string' || !roleId) {
    return { error: 'chooseRole' }
  }

  const admin = createAdminClient()
  const password = generateTempPassword()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  })

  if (createError || !created.user) {
    if (createError?.code === 'email_exists') {
      return { error: 'emailInUse' }
    }
    return { error: 'couldNotCreateLogin' }
  }

  const { setAt, expiresAt } = expiryFromNow()
  const supabase = await createClient()

  // must_change_password takes its column default (true) - never passed
  // explicitly here.
  const { error: staffError } = await supabase.from('staff').insert({
    id: created.user.id,
    full_name: fullName.trim(),
    role_id: roleId,
    user_type: 'staff',
    temp_password_set_at: setAt,
    temp_password_expires_at: expiresAt,
  })

  if (staffError) {
    // Auth user exists but has no staff row - an orphaned login. Roll it
    // back rather than leave it silent; report clearly if even that fails.
    const { error: cleanupError } = await admin.auth.admin.deleteUser(created.user.id)
    if (cleanupError) {
      return { error: 'staffRecordFailedWithCleanup', userId: created.user.id }
    }
    return { error: 'staffRecordFailedRolledBack' }
  }

  revalidatePath(STAFF_PATH)
  return { password }
}

export async function regenerateTempPassword(
  staffId: string
): Promise<ActionResult & { password?: string }> {
  if (!(await callerCanManageStaff())) {
    return { error: 'notPermitted' }
  }

  const admin = createAdminClient()
  const password = generateTempPassword()

  const { error: authError } = await admin.auth.admin.updateUserById(staffId, { password })
  if (authError) {
    return { error: 'couldNotCreateLogin' }
  }

  const { setAt, expiresAt } = expiryFromNow()
  const supabase = await createClient()
  // Runs AFTER the Auth password has already changed - deliberately: the
  // flag can't be written first, or temp_password_set_at would predate
  // Auth's updated_at and complete_password_change would treat the reset
  // itself as the user's own change. So a failure here leaves a reset
  // password on an account that isn't flagged to change it; zero rows
  // (refused by RLS, which raises nothing) is that same failure and is
  // reported the same way, never as success. The new password IS live in
  // Auth at this point, so it's returned alongside the warning: the owner
  // can still hand it over, and reissuing retries the flag.
  const { data, error } = await supabase
    .from('staff')
    .update({
      must_change_password: true,
      temp_password_set_at: setAt,
      temp_password_expires_at: expiresAt,
    })
    .eq('id', staffId)
    .select('id')

  if (error || !data || data.length === 0) {
    return { error: 'passwordResetButRecordFailed', password }
  }

  revalidatePath(STAFF_PATH)
  return { password }
}

export async function setStaffActive(staffId: string, isActive: boolean): Promise<ActionResult> {
  if (!(await callerCanManageStaff())) {
    return { error: 'notPermitted' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.from('staff').update({ is_active: isActive }).eq('id', staffId).select('id')

  // Zero rows: refused by RLS (raises nothing) or the account is gone.
  if (error || !data || data.length === 0) {
    return { error: 'updateAccountFailed' }
  }

  revalidatePath(STAFF_PATH)
  return {}
}
