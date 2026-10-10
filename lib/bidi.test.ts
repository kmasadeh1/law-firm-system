import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isolateNumbers, stripBidiIsolates } from './bidi.ts'

const FSI = '⁨'
const PDI = '⁩'

test('ISO date inside Arabic text is isolated as one run', () => {
  const stored = 'اتصلت بالموكل، الموعد 2026-10-15 — QA note'
  const shown = isolateNumbers(stored)
  assert.ok(shown.includes(`${FSI}2026-10-15${PDI}`))
  // Only that one run is wrapped, and the stored text is recoverable.
  assert.equal(shown.split(FSI).length - 1, 1)
  assert.equal(stripBidiIsolates(shown), stored)
})

test('2026-03-11 stays a single run so it cannot read as 11 March', () => {
  const stored = 'الجلسة بتاريخ 2026-03-11'
  const shown = isolateNumbers(stored)
  assert.ok(shown.includes(`${FSI}2026-03-11${PDI}`))
  assert.ok(!shown.includes(`${FSI}2026${PDI}`))
  assert.equal(stripBidiIsolates(shown), stored)
})

test('amounts, times and lone digits are isolated; trailing punctuation is not', () => {
  assert.equal(isolateNumbers('1,500.50, ok'), `${FSI}1,500.50${PDI}, ok`)
  assert.equal(isolateNumbers('at 09:30.'), `at ${FSI}09:30${PDI}.`)
  assert.equal(isolateNumbers('7'), `${FSI}7${PDI}`)
  assert.equal(isolateNumbers('no digits'), 'no digits')
})
