'use server'

import { randomInt } from 'crypto'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

const STAFF_PATH = '/dashboard/owner/staff'
const TEMP_PASSWORD_VALID_DAYS = 7

type ActionResult = { error?: string }

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
  const fullName = formData.get('full_name')
  const email = formData.get('email')
  const roleId = formData.get('role_id')

  if (typeof fullName !== 'string' || !fullName.trim()) {
    return { error: 'Full name is required.' }
  }
  if (typeof email !== 'string' || !email.trim()) {
    return { error: 'Email is required.' }
  }
  if (typeof roleId !== 'string' || !roleId) {
    return { error: 'Choose a role.' }
  }

  const admin = createAdminClient()
  const password = generateTempPassword()

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: email.trim(),
    password,
    email_confirm: true,
  })

  if (createError || !created.user) {
    return { error: createError?.message ?? 'Could not create the login.' }
  }

  const { setAt, expiresAt } = expiryFromNow()
  const supabase = await createClient()

  const { error: staffError } = await supabase.from('staff').insert({
    id: created.user.id,
    full_name: fullName.trim(),
    role_id: roleId,
    user_type: 'staff',
    must_change_password: true,
    temp_password_set_at: setAt,
    temp_password_expires_at: expiresAt,
  })

  if (staffError) {
    // Auth user exists but has no staff row - an orphaned login. Roll it
    // back rather than leave it silent; report clearly if even that fails.
    const { error: cleanupError } = await admin.auth.admin.deleteUser(created.user.id)
    if (cleanupError) {
      return {
        error: `Could not create the staff record (${staffError.message}), and cleanup of the orphaned login also failed (${cleanupError.message}). Auth user ${created.user.id} needs manual removal.`,
      }
    }
    return { error: `Could not create the staff record: ${staffError.message}. The login was rolled back.` }
  }

  revalidatePath(STAFF_PATH)
  return { password }
}

export async function regenerateTempPassword(
  staffId: string
): Promise<ActionResult & { password?: string }> {
  const admin = createAdminClient()
  const password = generateTempPassword()

  const { error: authError } = await admin.auth.admin.updateUserById(staffId, { password })
  if (authError) {
    return { error: authError.message }
  }

  const { setAt, expiresAt } = expiryFromNow()
  const supabase = await createClient()
  const { error } = await supabase
    .from('staff')
    .update({
      must_change_password: true,
      temp_password_set_at: setAt,
      temp_password_expires_at: expiresAt,
    })
    .eq('id', staffId)

  if (error) {
    return {
      error: `The password was reset, but updating the staff record failed: ${error.message}. The account may not be flagged to require a change.`,
    }
  }

  revalidatePath(STAFF_PATH)
  return { password }
}

export async function setStaffActive(staffId: string, isActive: boolean): Promise<ActionResult> {
  const supabase = await createClient()
  const { error } = await supabase.from('staff').update({ is_active: isActive }).eq('id', staffId)

  if (error) {
    return { error: 'Could not update that account. Please try again.' }
  }

  revalidatePath(STAFF_PATH)
  return {}
}
