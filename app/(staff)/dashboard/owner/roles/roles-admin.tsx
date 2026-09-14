'use client'

import { useMemo, useState, useTransition } from 'react'
import { createRole, deleteRole, renameRole, setRolePermission } from './actions'
import { PERMISSION_GROUPS } from './permission-groups'

type PermissionKeyRow = {
  key: string
  label: string
  description: string | null
  owner_only: boolean
}

type RoleRow = {
  id: string
  name: string
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

export function RolesAdmin({ roles: initialRoles, permissionKeys, rolePermissions }: Props) {
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
      return { title: group.title, items }
    }).filter((group) => group.items.length > 0)

    const leftover = grantableKeys.filter((pk) => !used.has(pk.key))
    if (leftover.length > 0) {
      named.push({ title: 'Other', items: leftover })
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

      {roles.length === 0 && (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">No roles yet - create one above.</p>
      )}

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
            onRenamed={(name) => {
              setRoles((prev) =>
                prev
                  .map((r) => (r.id === role.id ? { ...r, name } : r))
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
  const [name, setName] = useState('')
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
      const result = await createRole(name)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.role) {
        onCreated(result.role)
        setName('')
      }
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-black/10 p-4 dark:border-white/10">
      <label htmlFor="new-role-name" className="text-sm font-medium text-black dark:text-zinc-50">
        New role
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <input
          id="new-role-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setError(null)
          }}
          placeholder="e.g. Paralegal"
          className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
        />
        <button
          type="button"
          onClick={handleCreate}
          disabled={isPending || !name.trim()}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {isPending ? 'Creating…' : 'Create role'}
        </button>
      </div>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Starts with every permission off.
      </p>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
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
  groups: { title: string; items: PermissionKeyRow[] }[]
  ownerOnlyKeys: PermissionKeyRow[]
  enabledMap: Record<string, boolean>
  onToggle: (key: string, enabled: boolean) => void
  onPermissionSaved: () => void
  onRenamed: (name: string) => void
  onDeleted: () => void
}) {
  const [nameInput, setNameInput] = useState(role.name)
  const [renameError, setRenameError] = useState<string | null>(null)
  const [renameSaved, setRenameSaved] = useState(false)
  const [isRenaming, startRename] = useTransition()

  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [isDeleting, startDelete] = useTransition()

  const nameChanged = nameInput.trim() !== role.name

  function handleRename() {
    setRenameError(null)
    setRenameSaved(false)
    startRename(async () => {
      const result = await renameRole(role.id, nameInput)
      if (result.error) {
        setRenameError(result.error)
        return
      }
      onRenamed(nameInput.trim())
      setRenameSaved(true)
    })
  }

  function handleDeleteClick() {
    if (!confirmingDelete) {
      setConfirmingDelete(true)
      return
    }
    setDeleteError(null)
    startDelete(async () => {
      const result = await deleteRole(role.id)
      if (result.error) {
        setDeleteError(result.error)
        setConfirmingDelete(false)
        return
      }
      onDeleted()
    })
  }

  return (
    <div
      data-testid={`role-${role.id}`}
      className="rounded-lg border border-black/10 p-5 dark:border-white/10"
    >
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={nameInput}
          onChange={(e) => {
            setNameInput(e.target.value)
            setRenameSaved(false)
          }}
          className="rounded-md border border-black/10 px-3 py-2 text-sm font-semibold text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
        />
        <button
          type="button"
          onClick={handleRename}
          disabled={isRenaming || !nameChanged || !nameInput.trim()}
          className="rounded-full border border-black/10 px-3 py-1.5 text-sm text-black transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:text-zinc-50 dark:hover:bg-white/10"
        >
          {isRenaming ? 'Saving…' : 'Save name'}
        </button>
        {renameSaved && !nameChanged && (
          <span className="text-xs text-green-700 dark:text-green-400">Saved</span>
        )}

        <div className="grow" />

        <button
          type="button"
          onClick={handleDeleteClick}
          disabled={isDeleting}
          className="rounded-full border border-red-600/30 px-3 py-1.5 text-sm text-red-700 transition-colors hover:bg-red-600/10 disabled:opacity-50 dark:text-red-400"
        >
          {isDeleting ? 'Deleting…' : confirmingDelete ? 'Confirm delete?' : 'Delete role'}
        </button>
        {confirmingDelete && !isDeleting && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(false)}
            className="text-sm text-zinc-500 underline-offset-2 hover:underline dark:text-zinc-400"
          >
            Cancel
          </button>
        )}
      </div>
      {renameError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{renameError}</p>}
      {deleteError && <p className="mt-1 text-sm text-red-600 dark:text-red-400">{deleteError}</p>}

      <div className="mt-5 flex flex-col gap-5">
        {groups.map((group) => (
          <div key={group.title}>
            <h3 className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              {group.title}
            </h3>
            <div className="mt-2 flex flex-col gap-2">
              {group.items.map((pk) => (
                <PermissionCheckbox
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
          <h3 className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
            Administration
          </h3>
          <div className="mt-2 flex flex-col gap-2">
            {ownerOnlyKeys.map((pk) => (
              <div key={pk.key} className="flex items-start gap-2 opacity-60">
                <input type="checkbox" checked={false} disabled className="mt-0.5" />
                <div>
                  <p className="text-sm text-black dark:text-zinc-50">
                    {pk.label} <span className="text-xs">(Owner only)</span>
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    Owner only — can&apos;t be granted to any role.
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function PermissionCheckbox({
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
      <input
        type="checkbox"
        checked={enabled}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.checked)}
        className="mt-0.5"
      />
      <div>
        <p className="text-sm text-black dark:text-zinc-50">
          {permissionKey.label}
          {isPending && <span className="ml-2 text-xs text-zinc-400">Saving…</span>}
        </p>
        {permissionKey.description && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{permissionKey.description}</p>
        )}
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
      </div>
    </div>
  )
}
