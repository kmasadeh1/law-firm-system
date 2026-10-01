export const PAGE_SIZE = 25

// Presentation parsing, not business logic - clamps a caller-controlled URL
// param to a sane page number. The actual limiting/offsetting happens in
// each list's own Supabase query (.range()), never here.
export function parsePage(value: string | undefined): number {
  const n = Number.parseInt(value ?? '1', 10)
  return Number.isFinite(n) && n >= 1 ? n : 1
}

export function pageRange(page: number, pageSize: number): { from: number; to: number } {
  const from = (page - 1) * pageSize
  return { from, to: from + pageSize - 1 }
}

export function totalPages(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize))
}

// Windowed page-number list for the control row: always first/last, the
// current page and its immediate neighbours, 'ellipsis' for any gap. Pure
// display logic (which page numbers to offer links for), not a decision
// about what the user may see - that's RLS, upstream of this entirely.
export function pageWindow(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1)
  }

  const keep = new Set<number>([1, 2, total - 1, total, current - 1, current, current + 1])
  const sorted = [...keep].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b)

  const result: (number | 'ellipsis')[] = []
  let prev = 0
  for (const p of sorted) {
    if (prev && p - prev > 1) result.push('ellipsis')
    result.push(p)
    prev = p
  }
  return result
}
