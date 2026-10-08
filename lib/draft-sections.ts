// How a draft's plain text is laid out on paper. A draft (and the template
// it came from) may mark two blocks with lines of three or more hyphens:
//
//   <reference block>      court, chamber, judge, numbers - "Label: value"
//   ---
//   <body>                 the letter itself
//   ---
//   <closing block>        date, firm name, signature line
//
// One separator gives reference + body; two or more give reference, body
// and closing (anything between the first and last separator is body).
// A draft with no separator is all body. To have a closing block with no
// reference block, start the text with a separator.
//
// This only decides how the text is set on the page - it reads the author's
// own markup, it does not interpret what the text says.

const SEPARATOR = /^\s*-{3,}\s*$/

// Isolate initiators (LRI, RLI, FSI) and their terminator (PDI). Resolved
// placeholder values are wrapped in FSI...PDI, so a colon inside one is part
// of the value, never the label separator.
const ISOLATE_OPEN = new Set(['⁦', '⁧', '⁨'])
const ISOLATE_CLOSE = '⁩'

// A "label" longer than this is a sentence that happens to contain a colon.
const MAX_LABEL_LENGTH = 40

export type ReferenceLine = { kind: 'pair'; label: string; value: string } | { kind: 'text'; text: string }

export type DraftSections = {
  reference: ReferenceLine[] | null
  body: string[]
  closing: string[] | null
}

function trimBlankLines(lines: string[]): string[] {
  let start = 0
  let end = lines.length
  while (start < end && !lines[start]!.trim()) start++
  while (end > start && !lines[end - 1]!.trim()) end--
  return lines.slice(start, end)
}

// Paragraphs are separated by one or more blank lines; a single line break
// inside a paragraph is kept as a line break.
function paragraphs(lines: string[]): string[] {
  const result: string[] = []
  let current: string[] = []
  for (const line of lines) {
    if (line.trim()) {
      current.push(line.replace(/\s+$/, ''))
    } else if (current.length) {
      result.push(current.join('\n'))
      current = []
    }
  }
  if (current.length) result.push(current.join('\n'))
  return result
}

function referenceLine(line: string): ReferenceLine {
  let depth = 0
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!
    if (ISOLATE_OPEN.has(ch)) depth++
    else if (ch === ISOLATE_CLOSE) depth = Math.max(0, depth - 1)
    else if (ch === ':' && depth === 0) {
      const label = line.slice(0, i).trim()
      const value = line.slice(i + 1).trim()
      if (label && value && label.length <= MAX_LABEL_LENGTH) return { kind: 'pair', label, value }
      break
    }
  }
  return { kind: 'text', text: line.trim() }
}

export function splitDraft(text: string): DraftSections {
  const parts: string[][] = [[]]
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (SEPARATOR.test(line)) parts.push([])
    else parts[parts.length - 1]!.push(line)
  }

  if (parts.length === 1) {
    return { reference: null, body: paragraphs(parts[0]!), closing: null }
  }

  const referenceLines = trimBlankLines(parts[0]!).filter((line) => line.trim())
  const reference = referenceLines.length ? referenceLines.map(referenceLine) : null

  if (parts.length === 2) {
    return { reference, body: paragraphs(parts[1]!), closing: null }
  }

  const middle = parts.slice(1, -1).flatMap((part) => [...part, ''])
  const closing = paragraphs(parts[parts.length - 1]!)
  return { reference, body: paragraphs(middle), closing: closing.length ? closing : null }
}

// The page <title> while a draft is open: the tab name, the file name
// Chrome suggests when saving as PDF, and what it prints in its page
// header. The case's own file number keeps two drafts of the same template
// apart.
export function draftDocumentTitle(title: string, caseNumber: string | null): string {
  const name = title.trim()
  return [name, caseNumber?.trim()].filter(Boolean).join(' - ')
}
