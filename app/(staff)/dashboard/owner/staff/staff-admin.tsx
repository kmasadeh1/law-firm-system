'use client'

import { useRef, useState, useTransition } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { addStaff, regenerateTempPassword, setStaffActive } from './actions'
import { Panel } from '@/components/dashboard/panel'
import { Badge } from '@/components/dashboard/badge'
import { Button } from '@/components/dashboard/button'
import { Switch } from '@/components/dashboard/switch'
import { Field, Label, FieldError, controlClass } from '@/components/dashboard/form'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'
import { localizedName } from '@/lib/localized-name'
import { formatDateTime } from '@/lib/format-date-time'

type StaffRow = {
  id: string
  full_name: string
  user_type: 'owner' | 'staff'
  is_active: boolean
  must_change_password: boolean
  temp_password_set_at: string | null
  temp_password_expires_at: string | null
  roles: { name: string; name_ar: string | null } | null
}

type RoleOption = { id: string; name: string; name_ar: string | null }

function isExpired(iso: string | null) {
  return Boolean(iso && new Date(iso) < new Date())
}

// Same treatment as the case share-link panel: bold, persistent, no dismiss
// control, copy button. The password can't be retrieved again after this,
// so the owner needs to pass it on before navigating away.
function GeneratedPasswordPanel({ password }: { password: string }) {
  const t = useTranslations('dashboard.admin.staff.passwordPanel')
  const [copied, setCopied] = useState(false)

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(password)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard API can be blocked - the password is still selectable in
      // the field either way.
    }
  }

  return (
    <div role="alert" className="flex flex-col gap-3 rounded-md border-2 border-accent bg-accent-border/15 p-4">
      <div>
        <p className="font-heading text-base text-fg">{t('heading')}</p>
        <p className="mt-1 text-sm text-fg-muted">{t('description')}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          readOnly
          value={password}
          onFocus={(e) => e.target.select()}
          className={`min-w-0 flex-1 font-mono text-sm ${controlClass}`}
        />
        <Button type="button" variant="secondary" onClick={handleCopy}>
          {copied ? t('copied') : t('copy')}
        </Button>
      </div>
    </div>
  )
}

function AddStaffForm({ roles, onCreated }: { roles: RoleOption[]; onCreated: (password: string) => void }) {
  const locale = useLocale()
  const t = useTranslations('dashboard.admin.staff.addForm')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await addStaff(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.password) {
        onCreated(result.password)
        formRef.current?.reset()
      }
    })
  }

  return (
    <Panel className="flex flex-col gap-3">
      <div>
        <h2 className="font-heading text-lg text-fg">{t('heading')}</h2>
        <p className="text-sm text-fg-muted">{t('description')}</p>
      </div>
      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-3">
          <Field>
            <Label htmlFor="staff-full-name" required>
              {t('fullNameLabel')}
            </Label>
            <input id="staff-full-name" name="full_name" className={controlClass} />
          </Field>
          <Field>
            <Label htmlFor="staff-email" required>
              {t('emailLabel')}
            </Label>
            <input id="staff-email" name="email" type="email" className={controlClass} />
          </Field>
          <Field>
            <Label htmlFor="staff-role" required>
              {t('roleLabel')}
            </Label>
            <select id="staff-role" name="role_id" defaultValue="" className={controlClass}>
              <option value="" disabled>
                {t('chooseRolePlaceholder')}
              </option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {localizedName(role, locale)}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div>
          <Button type="submit" variant="primary" disabled={isPending}>
            {isPending ? t('creating') : t('createAccount')}
          </Button>
        </div>
        {error && <FieldError>{error}</FieldError>}
      </form>
    </Panel>
  )
}

function RegenerateButton({ staffId, onDone }: { staffId: string; onDone: (password: string) => void }) {
  const t = useTranslations('dashboard.admin.staff.regenerate')
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClick() {
    if (!confirming) {
      setConfirming(true)
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await regenerateTempPassword(staffId)
      if (result.error) {
        setError(result.error)
        setConfirming(false)
        return
      }
      if (result.password) {
        onDone(result.password)
      }
      setConfirming(false)
    })
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="ghost" onClick={handleClick} disabled={isPending}>
        {isPending ? t('issuing') : confirming ? t('confirmReplace') : t('issueNew')}
      </Button>
      {confirming && !isPending && (
        <Button type="button" variant="ghost" onClick={() => setConfirming(false)}>
          {t('cancel')}
        </Button>
      )}
      {error && <FieldError>{error}</FieldError>}
    </div>
  )
}

function ActiveToggle({ staffId, fullName, isActive }: { staffId: string; fullName: string; isActive: boolean }) {
  const t = useTranslations('dashboard.admin.staff.row')
  const [checked, setChecked] = useState(isActive)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDeactivate, setConfirmingDeactivate] = useState(false)
  const [isPending, startTransition] = useTransition()

  function apply(next: boolean) {
    const previous = checked
    setError(null)
    setChecked(next)
    startTransition(async () => {
      const result = await setStaffActive(staffId, next)
      if (result.error) {
        setChecked(previous)
        setError(result.error)
      }
    })
  }

  // Reactivating isn't destructive - only turning an account off needs the
  // extra step.
  function handleChange(next: boolean) {
    if (next) {
      apply(next)
    } else {
      setConfirmingDeactivate(true)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={checked}
        disabled={isPending}
        onChange={handleChange}
        label={checked ? t('activeAriaLabel') : t('inactiveAriaLabel')}
      />
      <span className="text-sm text-fg-muted">{checked ? t('activeText') : t('deactivatedText')}</span>
      {error && <FieldError>{error}</FieldError>}

      <DeleteConfirmDialog
        open={confirmingDeactivate}
        onCancel={() => setConfirmingDeactivate(false)}
        onConfirm={() => {
          setConfirmingDeactivate(false)
          apply(false)
        }}
        kind="deactivate"
        itemLabel={fullName}
        confirmLabel={t('deactivate')}
      />
    </div>
  )
}

function StaffRowItem({ row, onPassword }: { row: StaffRow; onPassword: (password: string) => void }) {
  const locale = useLocale()
  const t = useTranslations('dashboard.admin.staff.row')
  const tUserType = useTranslations('dashboard.admin.userType')
  const expired = isExpired(row.temp_password_expires_at)

  return (
    <li className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-fg">{row.full_name}</span>
          <Badge variant={row.user_type === 'owner' ? 'accent' : 'neutral'}>
            {row.user_type === 'owner' ? tUserType('owner') : row.roles ? localizedName(row.roles, locale) : t('noRole')}
          </Badge>
          {row.must_change_password && (
            <Badge variant={expired ? 'muted' : 'accent'}>
              {expired ? t('tempPasswordExpiredBadge') : t('awaitingPasswordChangeBadge')}
            </Badge>
          )}
        </div>
        {row.must_change_password && row.temp_password_expires_at && (
          <p className="mt-0.5 text-xs text-fg-muted">
            {t.rich(expired ? 'tempPasswordExpiredLine' : 'tempPasswordExpiresLine', {
              date: formatDateTime(row.temp_password_expires_at, locale),
              bdi: (chunks) => <bdi>{chunks}</bdi>,
            })}
          </p>
        )}
      </div>

      {row.user_type !== 'owner' && (
        <div className="flex flex-wrap items-center gap-3">
          <ActiveToggle staffId={row.id} fullName={row.full_name} isActive={row.is_active} />
          <RegenerateButton staffId={row.id} onDone={onPassword} />
        </div>
      )}
    </li>
  )
}

export function StaffAdmin({ staff, roles }: { staff: StaffRow[]; roles: RoleOption[] }) {
  const [generatedPassword, setGeneratedPassword] = useState<string | null>(null)

  return (
    <div className="flex flex-col gap-6">
      {generatedPassword && <GeneratedPasswordPanel password={generatedPassword} />}

      <AddStaffForm roles={roles} onCreated={setGeneratedPassword} />

      <Panel className="p-0">
        <ul className="flex flex-col divide-y divide-line">
          {staff.map((row) => (
            <StaffRowItem key={row.id} row={row} onPassword={setGeneratedPassword} />
          ))}
        </ul>
      </Panel>
    </div>
  )
}
