// Render-time bidi protection for free text. Never applied to stored text.
//
// In a right-to-left paragraph the Unicode bidi algorithm treats the
// separators inside "2026-10-15" as neutrals between number runs and
// reorders the runs, so the date is DISPLAYED as "15-10-2026" (and
// 2026-03-11 reads as 11-03-2026: a different date). Wrapping each
// digit-bearing run in FSI ... PDI (first-strong isolate) makes the run a
// single unit that keeps its own order. FSI/PDI are invisible, and
// stripBidiIsolates() removes them if the displayed text is ever needed as
// plain text again.
const FSI = '⁨'
const PDI = '⁩'

// Dates, reference numbers, amounts, times and phone numbers: a digit, then
// any digits/separators, ending on a digit; or a lone digit.
const DIGIT_RUN = /[0-9][0-9/\-.:,]*[0-9]|[0-9]/g

export function isolateNumbers(text: string): string {
  return text.replace(DIGIT_RUN, (run) => `${FSI}${run}${PDI}`)
}

export function stripBidiIsolates(text: string): string {
  return text.split(FSI).join('').split(PDI).join('')
}
