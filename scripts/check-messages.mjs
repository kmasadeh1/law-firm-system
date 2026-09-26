// Verifies the Arabic message fallback (i18n/messages.ts) actually covers
// every English key, and reports translation progress. Exits non-zero only
// on a real defect - a key that resolves to nothing after the merge, a key
// in ar.json with no counterpart in en.json (usually a typo or a key
// renamed on the English side), or code that reads a message key that
// doesn't exist in en.json at all. An untranslated key is not a failure:
// it's expected mid-campaign and reported as a progress count instead.
//
// The third check exists because the first two can't catch a real class of
// bug this project has now shipped twice: a message key nested one level
// too shallow (or missing entirely) in BOTH files identically. Comparing
// en.json to ar.json only ever proves the two files agree with each other -
// it says nothing about whether the code that reads a key can actually find
// it. This walks the same source the app runs and checks every
// useTranslations()/getTranslations() call's keys against en.json directly,
// the mirror image of the orphan check above (a key nothing reads is an
// orphan; a read with nothing to find is what this section reports).

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import ts from 'typescript'

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

// --- Code-reference check: does every t()/useTranslations() namespace+key
// the app actually reads resolve in en.json? ---

function getIn(obj, dottedPath) {
  if (dottedPath === '') return obj
  let node = obj
  for (const segment of dottedPath.split('.')) {
    if (!isPlainObject(node)) return undefined
    node = node[segment]
  }
  return node
}

function joinNamespace(namespace, key) {
  return namespace ? `${namespace}.${key}` : key
}

function walkSourceDir(dir, out) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return out
  }
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === '.next' || entry.name === '.git') continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkSourceDir(full, out)
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts')) {
      out.push(full)
    }
  }
  return out
}

const sourceFiles = []
for (const dir of ['app', 'components', 'lib']) {
  walkSourceDir(path.join(rootDir, dir), sourceFiles)
}

// { namespace, dynamic } per translator variable name, one Map per lexical
// scope, searched innermost-out - two components in the same file each
// declaring their own `const t = useTranslations(...)` must not bleed into
// each other, which a single file-wide map would get wrong.
function resolveNamespaceArg(callExpr) {
  const arg = callExpr.arguments[0]
  if (!arg) return { namespace: '', dynamic: false }
  if (ts.isStringLiteralLike(arg)) return { namespace: arg.text, dynamic: false }
  if (ts.isObjectLiteralExpression(arg)) {
    const prop = arg.properties.find(
      (p) => ts.isPropertyAssignment(p) && ts.isIdentifier(p.name) && p.name.text === 'namespace'
    )
    if (!prop) return { namespace: '', dynamic: false }
    if (ts.isStringLiteralLike(prop.initializer)) return { namespace: prop.initializer.text, dynamic: false }
    return { namespace: '', dynamic: true }
  }
  return { namespace: '', dynamic: true }
}

function unwrapAwait(node) {
  return ts.isAwaitExpression(node) ? node.expression : node
}

const codeRefs = [] // { file, line, fullKey }
const dynamicRefs = [] // skipped, can't statically resolve
let translatorBindings = 0

for (const file of sourceFiles) {
  const text = readFileSync(file, 'utf8')
  const sourceFile = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  )

  const scopeStack = [new Map()]
  const lookup = (name) => {
    for (let i = scopeStack.length - 1; i >= 0; i--) {
      if (scopeStack[i].has(name)) return scopeStack[i].get(name)
    }
    return undefined
  }
  const isFunctionLike = (node) =>
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node)

  function visit(node) {
    const pushedScope = isFunctionLike(node)
    if (pushedScope) scopeStack.push(new Map())

    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer
    ) {
      const init = unwrapAwait(node.initializer)
      if (ts.isCallExpression(init) && ts.isIdentifier(init.expression)) {
        const calleeName = init.expression.text
        if (calleeName === 'useTranslations' || calleeName === 'getTranslations') {
          translatorBindings++
          const { namespace, dynamic } = resolveNamespaceArg(init)
          scopeStack[scopeStack.length - 1].set(node.name.text, { namespace, dynamic })
        }
      }
    }

    if (ts.isCallExpression(node)) {
      let bindingName
      let isHasCall = false
      if (ts.isIdentifier(node.expression)) {
        bindingName = node.expression.text
      } else if (
        ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression)
      ) {
        bindingName = node.expression.expression.text
        // t.has(...) is a deliberate existence check, not an assertion that
        // the key exists - never flag what it's checking for as missing.
        isHasCall = node.expression.name.text === 'has'
      }

      if (bindingName) {
        const binding = lookup(bindingName)
        if (binding && !isHasCall) {
          const keyArg = node.arguments[0]
          const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart())
          if (binding.dynamic) {
            dynamicRefs.push({ file, line: line + 1, reason: 'dynamic namespace' })
          } else if (keyArg && ts.isStringLiteralLike(keyArg)) {
            codeRefs.push({
              file,
              line: line + 1,
              fullKey: joinNamespace(binding.namespace, keyArg.text),
            })
          } else if (keyArg) {
            dynamicRefs.push({ file, line: line + 1, reason: 'dynamic key' })
          }
        }
      }
    }

    ts.forEachChild(node, visit)

    if (pushedScope) scopeStack.pop()
  }

  visit(sourceFile)
}

const unresolvedRefs = []
const seenFullKeys = new Set()
for (const ref of codeRefs) {
  seenFullKeys.add(ref.fullKey)
  const value = getIn(en, ref.fullKey)
  if (value === undefined) {
    unresolvedRefs.push({ ...ref, problem: 'not found' })
  } else if (typeof value !== 'string') {
    unresolvedRefs.push({ ...ref, problem: 'resolves to a namespace, not a string' })
  }
}

console.log(`\nScanned ${sourceFiles.length} source file(s) under app/, components/, lib/.`)
console.log(`  Translator bindings (useTranslations/getTranslations): ${translatorBindings}`)
console.log(`  Literal key references checked:   ${codeRefs.length} (${seenFullKeys.size} distinct)`)
console.log(`  Dynamic references skipped (computed namespace or key, can't statically resolve): ${dynamicRefs.length}`)

if (unresolvedRefs.length > 0) {
  failed = true
  console.log(`\nFAIL: ${unresolvedRefs.length} code reference(s) to a message key that doesn't resolve in en.json:`)
  unresolvedRefs.forEach((r) =>
    console.log(`  - ${r.fullKey} (${r.problem}) - ${path.relative(rootDir, r.file)}:${r.line}`)
  )
} else {
  console.log('\nOK: every literal-key useTranslations()/getTranslations() reference resolves in en.json.')
}

process.exit(failed ? 1 : 0)
