'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { createCase } from '../actions'
import { ClientPicker } from '../client-picker'

export function CaseForm() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)

    startTransition(async () => {
      const result = await createCase(formData)
      if (result.error) {
        setError(result.error)
        return
      }
      if (result.caseId) {
        router.push(`/dashboard/cases/${result.caseId}`)
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ClientPicker />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="title" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Title *
        </label>
        <input
          id="title"
          name="title"
          required
          className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="case_number" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Case number *
        </label>
        <input
          id="case_number"
          name="case_number"
          required
          className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
        />
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          Entered manually - no numbering convention is enforced yet.
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="case_type" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Case type
        </label>
        <input
          id="case_type"
          name="case_type"
          placeholder="e.g. Litigation, Real Estate"
          className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
        />
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="mt-2 self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {isPending ? 'Creating…' : 'Create case'}
      </button>
    </form>
  )
}
