'use client'

import { useEffect, useRef, useState } from 'react'
import { searchClients, type ClientOption } from './actions'
import { Label, FieldSuccess, controlClass } from '@/components/dashboard/form'

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
      <Label htmlFor="client_search" required>
        Client
      </Label>
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
        className={controlClass}
      />
      <input type="hidden" name="client_id" value={selected?.id ?? ''} />

      {open && results.length > 0 && (
        <ul className="absolute top-full z-10 mt-1 w-full rounded-md border border-line bg-surface shadow-sm">
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
                className="block w-full px-3 py-2 text-start text-sm text-fg hover:bg-line/40"
              >
                {c.full_name}
                {c.national_id && <span className="text-fg-muted"> · {c.national_id}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && term.trim() && !selected && results.length === 0 && (
        <p className="text-xs text-fg-muted">No matching client. Add them in Clients first.</p>
      )}
      {selected && <FieldSuccess>Selected: {selected.full_name}</FieldSuccess>}
    </div>
  )
}
