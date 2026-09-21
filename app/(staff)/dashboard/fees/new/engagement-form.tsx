'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState, useTransition } from 'react'
import { createEngagement, listClientCases, type CaseOption, type ClientOption } from '../actions'
import { ClientPicker } from '../client-picker'
import { Field, Label, HelpText, FieldError, controlClass } from '@/components/dashboard/form'
import { Button } from '@/components/dashboard/button'

type FeeType = 'fixed' | 'percentage'

export function EngagementForm() {
  const router = useRouter()
  const formRef = useRef<HTMLFormElement>(null)
  const [feeType, setFeeType] = useState<FeeType>('fixed')
  const [cases, setCases] = useState<CaseOption[]>([])
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleClientSelect(client: ClientOption | null) {
    setSelectedCaseIds([])
    if (!client) {
      setCases([])
      return
    }
    startTransition(async () => {
      const options = await listClientCases(client.id)
      setCases(options)
    })
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const formData = new FormData(formRef.current!)

    startTransition(async () => {
      const result = await createEngagement(formData)
      if (result.error) {
        setError(result.error)
        if (!result.engagementId) return
      }
      if (result.engagementId) {
        router.push(`/dashboard/fees/${result.engagementId}`)
      }
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-4">
      <ClientPicker onSelect={handleClientSelect} />

      <Field>
        <Label htmlFor="fee_type" required>
          Fee type
        </Label>
        <select
          id="fee_type"
          name="fee_type"
          value={feeType}
          onChange={(e) => setFeeType(e.target.value as FeeType)}
          className={controlClass}
        >
          <option value="fixed">Fixed amount</option>
          <option value="percentage">Percentage</option>
        </select>
      </Field>

      {feeType === 'fixed' ? (
        <Field>
          <Label htmlFor="fixed_amount" required>
            Agreed amount
          </Label>
          <input
            id="fixed_amount"
            name="fixed_amount"
            type="number"
            min="0"
            step="0.01"
            required
            className={controlClass}
          />
        </Field>
      ) : (
        <Field>
          <Label htmlFor="percentage" required>
            Agreed percentage
          </Label>
          <input
            id="percentage"
            name="percentage"
            type="number"
            min="0"
            max="100"
            step="0.01"
            required
            className={controlClass}
          />
          <HelpText>
            Stored for reference only. There&apos;s nowhere to record an award amount, so no total
            or balance is calculated from this rate - add instalments by hand as they&apos;re
            agreed.
          </HelpText>
        </Field>
      )}

      <Field>
        <Label htmlFor="case_ids">Linked cases</Label>
        {cases.length === 0 ? (
          <HelpText>
            {'Select a client above to see their cases. You can also link cases later from the engagement page.'}
          </HelpText>
        ) : (
          <ul className="flex flex-col gap-1.5 rounded-md border border-line p-2">
            {cases.map((c) => (
              <li key={c.id}>
                <label className="flex items-center gap-2 text-sm text-fg">
                  <input
                    type="checkbox"
                    name="case_ids"
                    value={c.id}
                    checked={selectedCaseIds.includes(c.id)}
                    onChange={(e) =>
                      setSelectedCaseIds((prev) =>
                        e.target.checked ? [...prev, c.id] : prev.filter((id) => id !== c.id)
                      )
                    }
                  />
                  <bdi>{c.case_number}</bdi> — {c.title}
                </label>
              </li>
            ))}
          </ul>
        )}
      </Field>

      {error && <FieldError>{error}</FieldError>}

      <Button type="submit" variant="primary" disabled={isPending} className="mt-2 self-start">
        {isPending ? 'Creating…' : 'Create engagement'}
      </Button>
    </form>
  )
}
