'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { createClientRecord, updateClientRecord, type ConflictMatch } from './actions'

type ClientRow = {
  id: string
  full_name: string
  national_id: string | null
  phone: string | null
  email: string | null
  notes: string | null
}

type Props =
  | { mode: 'create' }
  | { mode: 'edit'; client: ClientRow }

function matchLabel(match: ConflictMatch) {
  return match.source === 'opposing_party'
    ? `${match.matched_name} — existing opposing party in a case`
    : `${match.matched_name} — existing client`
}

export function ClientForm(props: Props) {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)

  const [matches, setMatches] = useState<ConflictMatch[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  const initial =
    props.mode === 'edit'
      ? props.client
      : { full_name: '', national_id: '', phone: '', email: '', notes: '' }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    const formData = new FormData(formRef.current!)

    startTransition(async () => {
      if (props.mode === 'create') {
        const result = await createClientRecord(formData, false)
        if (result.error) {
          setError(result.error)
          return
        }
        if (result.matches) {
          setMatches(result.matches)
          return
        }
        if (result.clientId) {
          router.push(`/dashboard/clients/${result.clientId}`)
        }
      } else {
        const result = await updateClientRecord(props.client.id, formData)
        if (result.error) {
          setError(result.error)
          return
        }
        setSaved(true)
      }
    })
  }

  function handleConfirmAnyway() {
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await createClientRecord(formData, true)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.clientId) {
        router.push(`/dashboard/clients/${result.clientId}`)
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Full name" name="full_name" defaultValue={initial.full_name} required />
      <Field label="National ID" name="national_id" defaultValue={initial.national_id ?? ''} />
      <Field label="Phone" name="phone" defaultValue={initial.phone ?? ''} type="tel" />
      <Field label="Email" name="email" defaultValue={initial.email ?? ''} type="email" />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="notes" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={initial.notes ?? ''}
          className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
        />
      </div>

      {matches && matches.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Possible match{matches.length > 1 ? 'es' : ''} found - review before creating:
          </p>
          <ul className="mt-2 list-disc pl-5 text-amber-900 dark:text-amber-200">
            {matches.map((m) => (
              <li key={`${m.source}-${m.matched_id}`}>{matchLabel(m)}</li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleConfirmAnyway}
              disabled={isPending}
              className="rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              {isPending ? 'Creating…' : 'Create anyway'}
            </button>
            <button
              type="button"
              onClick={() => setMatches(null)}
              disabled={isPending}
              className="text-sm text-amber-900 underline-offset-2 hover:underline disabled:opacity-50 dark:text-amber-200"
            >
              Edit details instead
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {!matches && (
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
          >
            {isPending
              ? props.mode === 'create'
                ? 'Checking…'
                : 'Saving…'
              : props.mode === 'create'
                ? 'Create client'
                : 'Save changes'}
          </button>
          {saved && <span className="text-sm text-green-700 dark:text-green-400">Saved</span>}
        </div>
      )}
    </form>
  )
}

function Field({
  label,
  name,
  defaultValue,
  type = 'text',
  required = false,
}: {
  label: string
  name: string
  defaultValue: string
  type?: string
  required?: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        {label}
        {required && ' *'}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
      />
    </div>
  )
}
