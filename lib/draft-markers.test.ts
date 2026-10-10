import { test } from 'node:test'
import assert from 'node:assert/strict'
import { findUnresolvedMarkers } from './draft-markers.ts'

test('finds missing and unknown markers in both languages, once each', () => {
  const body =
    'a [Power of attorney (وكالة) number: not available] b [Judge: not available] c [Judge: not available] ' +
    '[القاضي: غير متوفر] [unknown placeholder: foo] [حقل غير معروف: bar]'
  const found = findUnresolvedMarkers(body)
  assert.deepEqual(
    found.map((f) => `${f.kind}:${f.label}`),
    ['missing:Power of attorney (وكالة) number', 'missing:Judge', 'missing:القاضي', 'unknown:foo', 'unknown:bar']
  )
})

test('a complete draft has none', () => {
  assert.deepEqual(findUnresolvedMarkers('Dear Court, case 123 [attached]'), [])
})
