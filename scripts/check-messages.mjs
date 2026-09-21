// Verifies the Arabic message fallback (i18n/messages.ts) actually covers
// every English key, and reports translation progress. Exits non-zero only
// on a real defect - a key that resolves to nothing after the merge, or a
// key in ar.json with no counterpart in en.json (usually a typo or a key
// renamed on the English side). An untranslated key is not a failure: it's
// expected mid-campaign and reported as a progress count instead.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))
const en = JSON.parse(readFileSync(path.join(rootDir, 'messages/en.json'), 'utf8'))
const ar = JSON.parse(readFileSync(path.join(rootDir, 'messages/ar.json'), 'utf8'))

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Mirrors i18n/messages.ts's deepMerge exactly.
function deepMerge(base, overlay) {
  if (isPlainObject(base) && isPlainObject(overlay)) {
    const result = { ...base }
    for (const key of Object.keys(overlay)) {
      result[key] = deepMerge(base[key], overlay[key])
    }
    return result
  }
  return overlay !== undefined ? overlay : base
}

const merged = deepMerge(en, ar)

const missing = []
let translated = 0
let untranslated = 0

function walkEn(enNode, arNode, mergedNode, path) {
  if (typeof enNode === 'string') {
    if (mergedNode === undefined || mergedNode === '') {
      missing.push(path)
    } else if (arNode !== undefined && arNode === mergedNode) {
      translated++
    } else {
      untranslated++
    }
    return
  }
  if (isPlainObject(enNode)) {
    for (const key of Object.keys(enNode)) {
      walkEn(enNode[key], isPlainObject(arNode) ? arNode[key] : undefined, isPlainObject(mergedNode) ? mergedNode[key] : undefined, path ? `${path}.${key}` : key)
    }
  }
  // Arrays (e.g. practiceAreas.items) aren't part of the dashboard.*
  // extraction campaign and aren't walked - next-intl's AbstractIntlMessages
  // type doesn't cover array leaves either.
}

walkEn(en, ar, merged, '')

// Orphans: keys in ar.json with no counterpart in en.json at the same path.
const orphans = []

function walkAr(arNode, enNode, path) {
  if (isPlainObject(arNode)) {
    for (const key of Object.keys(arNode)) {
      const childPath = path ? `${path}.${key}` : key
      if (!isPlainObject(enNode) || !(key in enNode)) {
        orphans.push(childPath)
      } else {
        walkAr(arNode[key], enNode[key], childPath)
      }
    }
  }
}

walkAr(ar, en, '')

console.log(`Checked ${translated + untranslated} leaf string keys from en.json against the merged Arabic set.`)
console.log(`  Translated (ar.json wins):        ${translated}`)
console.log(`  Untranslated (falls back to English): ${untranslated}`)

let failed = false

if (missing.length > 0) {
  failed = true
  console.log(`\nFAIL: ${missing.length} key(s) resolve to nothing after the merge:`)
  missing.forEach((k) => console.log(`  - ${k}`))
}

if (orphans.length > 0) {
  failed = true
  console.log(`\nFAIL: ${orphans.length} orphan key(s) in ar.json with no counterpart in en.json:`)
  orphans.forEach((k) => console.log(`  - ${k}`))
}

if (!failed) {
  console.log('\nOK: every en.json key resolves, and every ar.json key has an en.json counterpart.')
}

console.log(`\nRemaining translation work: ${untranslated} key(s) still fall back to English.`)

process.exit(failed ? 1 : 0)
