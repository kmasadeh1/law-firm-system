'use client'

import { useRef, useState, useTransition } from 'react'
import { addOpposingParty, type ConflictMatch } from '../actions'

type OpposingParty = { id: string; name: string; national_id: string | null }

function matchLabel(match: ConflictMatch, currentCaseId: string) {
  if (match.source === 'opposing_party') {
    return match.case_id === currentCaseId
      ? `${match.matched_name} — already an opposing party on this case`
      : `${match.matched_name} — already an opposing party on another case`
  }
  return `${match.matched_name} — existing client`
}

export function OpposingPartiesSection({
  caseId,
  parties,
}: {
  caseId: string
  parties: OpposingParty[]
}) {
  const formRef = useRef<HTMLFormElement>(null)
  const [matches, setMatches] = useState<ConflictMatch[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)

    startTransition(async () => {
      const result = await addOpposingParty(caseId, formData, false)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.matches) {
        setMatches(result.matches)
        return
      }
      formRef.current?.reset()
      setMatches(null)
    })
  }

  function handleConfirmAnyway() {
    setError(null)
    const formData = new FormData(formRef.current!)
    startTransition(async () => {
      const result = await addOpposingParty(caseId, formData, true)
      if (result.error) {
        setError(result.error)
        return
      }
      formRef.current?.reset()
      setMatches(null)
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="font-semibold text-black dark:text-zinc-50">Opposing parties</h2>

      {parties.length === 0 ? (
        <p className="text-sm text-zinc-500 dark:text-zinc-400">None added yet.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-black/10 rounded-md border border-black/10 dark:divide-white/10 dark:border-white/10">
          {parties.map((p) => (
            <li key={p.id} className="px-3 py-2 text-sm text-black dark:text-zinc-50">
              {p.name}
              {p.national_id && (
                <span className="text-zinc-500 dark:text-zinc-400"> · {p.national_id}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="op-name" className="text-sm text-zinc-500 dark:text-zinc-400">
            Name
          </label>
          <input
            id="op-name"
            name="name"
            required
            className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="op-national-id" className="text-sm text-zinc-500 dark:text-zinc-400">
            National ID
          </label>
          <input
            id="op-national-id"
            name="national_id"
            className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
          />
        </div>
        {!matches && (
          <button
            type="submit"
            data-testid="opposing-party-add-button"
            disabled={isPending}
            className="rounded-full border border-black/10 px-4 py-2 text-sm text-black transition-colors hover:bg-black/5 disabled:opacity-50 dark:border-white/10 dark:text-zinc-50 dark:hover:bg-white/10"
          >
            {isPending ? 'Checking…' : 'Add'}
          </button>
        )}
      </form>

      {matches && matches.length > 0 && (
        <div className="rounded-md border border-amber-500/40 bg-amber-50 p-3 text-sm dark:bg-amber-950/30">
          <p className="font-medium text-amber-900 dark:text-amber-200">
            Possible match{matches.length > 1 ? 'es' : ''} found - review before adding:
          </p>
          <ul className="mt-2 list-disc pl-5 text-amber-900 dark:text-amber-200">
            {matches.map((m) => (
              <li key={`${m.source}-${m.matched_id}`}>{matchLabel(m, caseId)}</li>
            ))}
          </ul>
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleConfirmAnyway}
              disabled={isPending}
              className="rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-700 disabled:opacity-50"
            >
              {isPending ? 'Adding…' : 'Create anyway'}
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
    </div>
  )
}
