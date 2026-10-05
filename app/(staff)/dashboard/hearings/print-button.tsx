'use client'

import { Button } from '@/components/dashboard/button'

// window.print() is the one browser dialog this app deliberately opens -
// unlike alert()/confirm() it doesn't block page events, and printing the
// day's sessions is what this page is for. The page renders it inside a
// print:hidden wrapper, so it never appears on the printout.
export function PrintButton({ label }: { label: string }) {
  return (
    <Button type="button" variant="primary" onClick={() => window.print()} data-testid="hearing-calendar-print">
      {label}
    </Button>
  )
}
