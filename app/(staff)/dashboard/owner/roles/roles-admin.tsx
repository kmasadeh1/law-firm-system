'use client'

import { useMemo, useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { createRole, deleteRole, renameRole, setRolePermission } from './actions'
import { PERMISSION_GROUPS } from './permission-groups'
import { Panel } from '@/components/dashboard/panel'
import { EmptyState } from '@/components/dashboard/empty-state'
import { Button } from '@/components/dashboard/button'
import { Field, Label, FieldError, FieldSuccess, controlClass } from '@/components/dashboard/form'
import { Switch } from '@/components/dashboard/switch'
import { DeleteConfirmDialog } from '@/components/dashboard/delete-confirm-dialog'

type PermissionKeyRow = {
  key: string
  label: string
  description: string | null
  owner_only: boolean
}

type RoleRow = {
  id: string
  name: string
  name_ar: string | null
}

type RolePermissionRow = {
  role_id: string
  permission_key: string
  enabled: boolean
}

type Props = {
  roles: RoleRow[]
  permissionKeys: PermissionKeyRow[]
  rolePermissions: RolePermissionRow[]
}

function cellId(roleId: string, key: string) {
  return `${roleId}:${key}`
}

// permission_keys is a code-defined set (nobody can add one from the UI),
// so label/description are translated in the message file rather than
// read from the database as the primary source. The database columns stay
// as a fallback: a future migration that adds a permission_keys row
// without also adding its message key degrades to the English label
// stored there, never to the raw key ("cases_view_all").
function usePermissionText() {
  const t = useTranslations('dashboard.admin.permissions')
  return {
    label: (pk: PermissionKeyRow) => (t.has(`${pk.key}.label`) ? t(`${pk.key}.label`) : pk.label),
    description: (pk: PermissionKeyRow) => {
      if (!pk.description) return null
      return t.has(`${pk.key}.description`) ? t(`${pk.key}.description`) : pk.description
    },
  }
}

export function RolesAdmin({ roles: initialRoles, permissionKeys, rolePermissions }: Props) {
  const t = useTranslations('dashboard.admin.roles')
  const [roles, setRoles] = useState(initialRoles)
  // Bumped after any confirmed-successful role action anywhere on the page,
  // so stale errors elsewhere (e.g. the create-role form) know to clear.
  const [revision, setRevision] = useState(0)
  const bumpRevision = () => setRevision((r) => r + 1)
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {}
    for (const row of rolePermissions) {
      map[cellId(row.role_id, row.permission_key)] = row.enabled
    }
    return map
  })

  const grantableKeys = useMemo(
    () => permissionKeys.filter((pk) => !pk.owner_only),
    [permissionKeys]
  )
  const ownerOnlyKeys = useMemo(
    () => permissionKeys.filter((pk) => pk.owner_only),
    [permissionKeys]
  )

  const groups = useMemo(() => {
    const byKey = new Map(grantableKeys.map((pk) => [pk.key, pk]))
    const used = new Set<string>()

    const named = PERMISSION_GROUPS.map((group) => {
      const items = group.keys
        .map((key) => byKey.get(key))
        .filter((pk): pk is PermissionKeyRow => {
          if (!pk) return false
          used.add(pk.key)
          return true
        })
      return { titleKey: group.titleKey, items }
    }).filter((group) => group.items.length > 0)

    const leftover = grantableKeys.filter((pk) => !used.has(pk.key))
    if (leftover.length > 0) {
      named.push({ titleKey: 'other', items: leftover })
    }

    return named
  }, [grantableKeys])

  return (
    <div className="flex flex-col gap-10">
      <CreateRoleForm
        revision={revision}
        onCreated={(role) => {
          setRoles((prev) => [...prev, role].sort((a, b) => a.name.localeCompare(b.name)))
          bumpRevision()
        }}
      />

      {roles.length === 0 && <EmptyState title={t('noneYet')} description={t('noneYetDescription')} />}

      <div className="flex flex-col gap-8">
        {roles.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            groups={groups}
            ownerOnlyKeys={ownerOnlyKeys}
            enabledMap={enabledMap}
            onToggle={(key, enabled) =>
              setEnabledMap((prev) => ({ ...prev, [cellId(role.id, key)]: enabled }))
            }
            onPermissionSaved={bumpRevision}
            onRenamed={(name, nameAr) => {
              setRoles((prev) =>
                prev
                  .map((r) => (r.id === role.id ? { ...r, name, name_ar: nameAr } : r))
                  .sort((a, b) => a.name.localeCompare(b.name))
              )
              bumpRevision()
            }}
            onDeleted={() => {
              setRoles((prev) => prev.filter((r) => r.id !== role.id))
              bumpRevision()
            }}
          />
        ))}
      </div>
    </div>
  )
}

function CreateRoleForm({
  revision,
  onCreated,
}: {
  revision: number
  onCreated: (role: RoleRow) => void
}) {
  const t = useTranslations('dashboard.admin.roles.createForm')
  const [name, setName] = useState('')
  const [nameAr, setNameAr] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  // Any other successful role action elsewhere on the page (rename, delete,
  // permission toggle) also clears a stale error here. Adjusting state
  // during render (rather than in an effect) on a prop change, per
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const [lastRevision, setLastRevision] = useState(revision)
  if (revision !== lastRevision) {
    setLastRevision(revision)
    setError(null)
  }

  function handleCreate() {
    setError(null)
    startTransition(async () => {
      const result = await createRole(name, nameAr)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.role) {
        onCreated(result.role)
        setName('')
        setNameAr('')
      }
    })
  }

  return (
    <Panel className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-3">
        <Field>
          <Label htmlFor="new-role-name">{t('nameLabel')}</Label>
          <input
            id="new-role-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setError(null)
            }}
            placeholder={t('namePlaceholder')}
            className={controlClass}
          />
        </Field>
        <Field>
          <Label htmlFor="new-role-name-ar">{t('nameArLabel')}</Label>
          <input
            id="new-role-name-ar"
            value={nameAr}
            onChange={(e) => setNameAr(e.target.value)}
            dir="rtl"
            lang="ar"
            className={controlClass}
          />
        </Field>
      </div>
      <div>
        <Button type="button" variant="primary" onClick={handleCreate} disabled={isPending || !name.trim()}>
          {isPending ? t('creating') : t('createRole')}
        </Button>
      </div>
      <p className="text-xs text-fg-muted">{t('startsWithNoPermissions')}</p>
      {error && <FieldError>{error}</FieldError>}
    </Panel>
  )
}

function RoleCard({
  role,
  groups,
  ownerOnlyKeys,
  enabledMap,
  onToggle,
  onPermissionSaved,
  onRenamed,
  onDeleted,
}: {
  role: RoleRow
  groups: { titleKey: string; items: PermissionKeyRow[] }[]
  ownerOnlyKeys: PermissionKeyRow[]
  enabledMap: Record<string, boolean>
  onToggle: (key: string, enabled: boolean) => void
  onPermissionSaved: () => void
  onRenamed: (name: string, nameAr: string | null) => void
  onDeleted: () => void
}) {
  const t = useTranslations('dashboard.admin.roles.card')
  const tGroups = useTranslations('dashboard.admin.roles.permissionGroups')
  const [nameInput, setNameInput] = useState(role.name)
  const [nameArInput, setNameArInput] = useState(role.name_ar ?? '')
  const [renameError, setRenameError] = useState<string | null>(null)
  const [renameSaved, setRenameSaved] = useState(false)
  const [isRenaming, startRename] = useTransition()

  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isDeleting, startDelete] = useTransition()

  const nameChanged = nameInput.trim() !== role.name || nameArInput !== (role.name_ar ?? '')

  function handleRename() {
    setRenameError(null)
    setRenameSaved(false)
    startRename(async () => {
      const result = await renameRole(role.id, nameInput, nameArInput)
      if (result.error) {
        setRenameError(result.error)
        return
      }
      onRenamed(nameInput.trim(), nameArInput.trim() ? nameArInput : null)
      setRenameSaved(true)
    })
  }

  function handleConfirmDelete() {
    setDeleteError(null)
    startDelete(async () => {
      const result = await deleteRole(role.id)
      setConfirmingDelete(false)
      if (result.error) {
        setDeleteError(result.error)
        return
      }
      onDeleted()
    })
  }

  return (
    <Panel data-testid={`role-${role.id}`}>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={nameInput}
          onChange={(e) => {
            setNameInput(e.target.value)
            setRenameSaved(false)
          }}
          className={`font-semibold ${controlClass}`}
        />
        <input
          value={nameArInput}
          onChange={(e) => {
            setNameArInput(e.target.value)
            setRenameSaved(false)
          }}
          dir="rtl"
          lang="ar"
          placeholder={t('nameArAriaLabel')}
          aria-label={t('nameArAriaLabel')}
          className={controlClass}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={handleRename}
          disabled={isRenaming || !nameChanged || !nameInput.trim()}
        >
          {isRenaming ? t('saving') : t('saveName')}
        </Button>
        {renameSaved && !nameChanged && <FieldSuccess>{t('saved')}</FieldSuccess>}

        <div className="grow" />

        <Button type="button" variant="danger" onClick={() => setConfirmingDelete(true)} disabled={isDeleting}>
          {isDeleting ? t('deleting') : t('deleteRole')}
        </Button>
      </div>
      {renameError && <FieldError>{renameError}</FieldError>}
      {deleteError && <FieldError>{deleteError}</FieldError>}

      <DeleteConfirmDialog
        open={confirmingDelete}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={handleConfirmDelete}
        kind="hard"
        itemLabel={role.name}
        confirmLabel={t('deleteRole')}
        pendingLabel={t('deleting')}
        pending={isDeleting}
        note={t('deleteNote')}
      />

      <div className="mt-5 flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.titleKey}>
            <h3 className="text-sm font-semibold text-fg-muted">{tGroups(group.titleKey)}</h3>
            <div className="mt-2 flex flex-col gap-2">
              {group.items.map((pk) => (
                <PermissionToggle
                  key={pk.key}
                  roleId={role.id}
                  permissionKey={pk}
                  enabled={enabledMap[cellId(role.id, pk.key)] ?? false}
                  onToggle={onToggle}
                  onSaved={onPermissionSaved}
                />
              ))}
            </div>
          </div>
        ))}

        <div>
          <h3 className="text-sm font-semibold text-fg-muted">{t('administrationHeading')}</h3>
          <div className="mt-2 flex flex-col gap-2">
            {ownerOnlyKeys.map((pk) => (
              <OwnerOnlyPermissionRow key={pk.key} permissionKey={pk} />
            ))}
          </div>
        </div>
      </div>
    </Panel>
  )
}

function OwnerOnlyPermissionRow({ permissionKey: pk }: { permissionKey: PermissionKeyRow }) {
  const t = useTranslations('dashboard.admin.roles.card')
  const { label } = usePermissionText()
  const permissionLabel = label(pk)

  return (
    <div className="flex items-start gap-2 opacity-60">
      <Switch checked={false} disabled label={t('ownerOnlySwitchLabel', { label: permissionLabel })} />
      <div>
        <p className="text-sm text-fg">
          {permissionLabel} <span className="text-xs">{t('ownerOnlyBadge')}</span>
        </p>
        <p className="text-xs text-fg-muted">{t('ownerOnlyDescription')}</p>
      </div>
    </div>
  )
}

function PermissionToggle({
  roleId,
  permissionKey,
  enabled,
  onToggle,
  onSaved,
}: {
  roleId: string
  permissionKey: PermissionKeyRow
  enabled: boolean
  onToggle: (key: string, enabled: boolean) => void
  onSaved: () => void
}) {
  const t = useTranslations('dashboard.admin.roles.card')
  const { label, description } = usePermissionText()
  const permissionLabel = label(permissionKey)
  const permissionDescription = description(permissionKey)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleChange(next: boolean) {
    const previous = enabled
    setError(null)
    onToggle(permissionKey.key, next)
    startTransition(async () => {
      const result = await setRolePermission(roleId, permissionKey.key, next)
      if (result.error) {
        onToggle(permissionKey.key, previous)
        setError(result.error)
      } else {
        onSaved()
      }
    })
  }

  return (
    <div className="flex items-start gap-2">
      <Switch checked={enabled} disabled={isPending} onChange={handleChange} label={permissionLabel} />
      <div>
        <p className="text-sm text-fg">
          {permissionLabel}
          {isPending && <span className="ms-2 text-xs text-fg-muted">{t('savingPermission')}</span>}
        </p>
        {permissionDescription && <p className="text-xs text-fg-muted">{permissionDescription}</p>}
        {error && <p className="text-xs text-danger-text">{error}</p>}
      </div>
    </div>
  )
}
