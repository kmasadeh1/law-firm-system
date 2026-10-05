'use client'

import { Button } from '@/components/dashboard/button'

// window.print() is the one browser dialog this app deliberately opens -
// unlike alert()/confirm() it doesn't block page events, and printing is
// what the pages using this are for (the hearing calendar's daily sheet, a
// payment receipt). Callers render it inside a print:hidden wrapper, so it
// never appears on the printout.
export function PrintButton({ label, testId }: { label: string; testId: string }) {
  return (
    <Button type="button" variant="primary" onClick={() => window.print()} data-testid={testId}>
      {label}
    </Button>
  )
}
