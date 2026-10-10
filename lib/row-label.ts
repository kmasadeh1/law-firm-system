// Accessible name for a list row that is wrapped in a link. Built from the
// row's meaningful fields (empty ones dropped) so a screen reader announces
// "SEED-2026-0069, قضية تنفيذ, سناء العمري" rather than whatever the nested
// spans happen to compute to.
export function rowLabel(...parts: Array<string | null | undefined | false>): string {
  return parts.filter((p): p is string => Boolean(p && p.trim())).join(', ')
}
