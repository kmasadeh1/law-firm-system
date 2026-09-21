'use client'

import { useEffect, useRef, useState } from 'react'
import { searchCases, type CaseOption } from './actions'
import { Label, FieldSuccess, HelpText, controlClass } from '@/components/dashboard/form'

/**
 * Search-and-select for an existing case, required only when the
 * appointment type is court_date (enforced by the parent form).
 */
export function CasePicker({
  required,
  initial,
}: {
  required: boolean
  initial?: CaseOption
}) {
  const [term, setTerm] = useState(initial ? `${initial.case_number} — ${initial.title}` : '')
  const [results, setResults] = useState<CaseOption[]>([])
  const [selected, setSelected] = useState<CaseOption | null>(initial ?? null)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const label = selected ? `${selected.case_number} — ${selected.title}` : null
    if (selected && term === label) {
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const matches = await searchCases(term)
      setResults(matches)
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])

  return (
    <div className="relative flex flex-col gap-1.5">
      <Label htmlFor="case_search" required={required}>
        Case
      </Label>
      <input
        id="case_search"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value)
          setSelected(null)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search cases by number or title"
        autoComplete="off"
        disabled={!required}
        className={controlClass}
      />
      <input type="hidden" name="case_id" value={selected?.id ?? ''} />

      {required && open && results.length > 0 && (
        <ul className="absolute top-full z-10 mt-1 w-full rounded-md border border-line bg-surface shadow-sm">
          {results.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSelected(c)
                  setTerm(`${c.case_number} — ${c.title}`)
                  setResults([])
                  setOpen(false)
                }}
                className="block w-full px-3 py-2 text-start text-sm text-fg hover:bg-line/40"
              >
                <bdi>{c.case_number}</bdi> — {c.title}
              </button>
            </li>
          ))}
        </ul>
      )}

      {required && open && term.trim() && !selected && results.length === 0 && (
        <p className="text-xs text-fg-muted">No matching case.</p>
      )}
      {required && selected && (
        <FieldSuccess>
          Selected: <bdi>{selected.case_number}</bdi> — {selected.title}
        </FieldSuccess>
      )}
      {!required && <HelpText>Only used for court dates.</HelpText>}
    </div>
  )
}
