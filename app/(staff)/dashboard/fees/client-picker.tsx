'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { searchClients, type ClientOption } from './actions'
import { Label, FieldSuccess, controlClass } from '@/components/dashboard/form'

/**
 * Search-and-select for an EXISTING client only - same rule as the Cases
 * picker, no "create a new client from here" shortcut. Also reports the
 * selection up via onSelect so the engagement form can load that client's
 * cases to link.
 */
export function ClientPicker({
  initial,
  onSelect,
}: {
  initial?: ClientOption
  onSelect?: (client: ClientOption | null) => void
}) {
  const t = useTranslations('dashboard.fees.picker')
  const [term, setTerm] = useState(initial?.full_name ?? '')
  const [results, setResults] = useState<ClientOption[]>([])
  const [selected, setSelected] = useState<ClientOption | null>(initial ?? null)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (selected && term === selected.full_name) {
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      const matches = await searchClients(term)
      setResults(matches)
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term])

  function select(client: ClientOption | null) {
    setSelected(client)
    onSelect?.(client)
  }

  return (
    <div className="relative flex flex-col gap-1.5">
      <Label htmlFor="client_search" required>
        {t('clientLabel')}
      </Label>
      <input
        id="client_search"
        value={term}
        onChange={(e) => {
          setTerm(e.target.value)
          select(null)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={t('searchPlaceholder')}
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
                  select(c)
                  setTerm(c.full_name)
                  setResults([])
                  setOpen(false)
                }}
                className="block w-full px-3 py-2 text-start text-sm text-fg hover:bg-line/40"
              >
                <bdi>{c.full_name}</bdi>
                {c.national_id && <span className="text-fg-muted"> · <bdi>{c.national_id}</bdi></span>}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && term.trim() && !selected && results.length === 0 && (
        <p className="text-xs text-fg-muted">{t('noMatchingClient')}</p>
      )}
      {selected && (
        <FieldSuccess>
          {t.rich('selected', { name: selected.full_name, bdi: (chunks) => <bdi>{chunks}</bdi> })}
        </FieldSuccess>
      )}
    </div>
  )
}
