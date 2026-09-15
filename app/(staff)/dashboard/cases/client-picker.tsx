'use client'

import { useEffect, useRef, useState } from 'react'
import { searchClients, type ClientOption } from './actions'

/**
 * Search-and-select for an EXISTING client only - there is deliberately no
 * "create a new client from here" shortcut, so a case can never become a
 * path to an accidental duplicate client record. If nobody matches, the
 * answer is "go create them in Clients first."
 */
export function ClientPicker({ initial }: { initial?: ClientOption }) {
  const [term, setTerm] = useState(initial?.full_name ?? '')
  const [results, setResults] = useState<ClientOption[]>([])
  const [selected, setSelected] = useState<ClientOption | null>(initial ?? null)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Nothing to search for right after a selection - the click handler
    // that set `selected` already cleared results itself.
    if (selected && term === selected.full_name) {
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      // searchClients already returns [] for a blank term, so an empty
      // input clears results through the same debounced path.
      const matches = await searchClients(term)
      setResults(matches)
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])

  return (
    <div className="relative flex flex-col gap-1.5">
      <label htmlFor="client_search" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Client *
      </label>
      <input
        id="client_search"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value)
          setSelected(null)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search existing clients by name or national ID"
        autoComplete="off"
        className="rounded-md border border-black/10 px-3 py-2 text-sm text-black dark:border-white/10 dark:bg-black dark:text-zinc-50"
      />
      <input type="hidden" name="client_id" value={selected?.id ?? ''} />

      {open && results.length > 0 && (
        <ul className="absolute top-full z-10 mt-1 w-full rounded-md border border-black/10 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-950">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSelected(c)
                  setTerm(c.full_name)
                  setResults([])
                  setOpen(false)
                }}
                className="block w-full px-3 py-2 text-left text-sm text-black hover:bg-black/5 dark:text-zinc-50 dark:hover:bg-white/10"
              >
                {c.full_name}
                {c.national_id && (
                  <span className="text-zinc-500 dark:text-zinc-400"> · {c.national_id}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && term.trim() && !selected && results.length === 0 && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          No matching client. Add them in Clients first.
        </p>
      )}
      {selected && (
        <p className="text-xs text-green-700 dark:text-green-400">Selected: {selected.full_name}</p>
      )}
    </div>
  )
}
