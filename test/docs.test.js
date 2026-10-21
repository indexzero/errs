/*
 * docs.test.js: Tests that the documentation still describes this repository.
 *
 * (C) 2011-2025, Charlie Robbins, Nuno Job, and the Contributors.
 * MIT LICENSE
 *
 * Prose rots silently. Twice in one sitting a claim here outlived the state it
 * described: a named-export block grew a duplicate specifier and stopped
 * parsing, and a script was documented after it had been deleted. Nothing
 * failed, because nothing was looking.
 *
 * These four checks are deliberately narrow. The obvious version, parsing
 * every fenced block as a module, fires on correct documentation: a block that
 * shows two spellings of the same binding redeclares it, and a block showing a
 * fragment has a bare `return`. Five of this repository's blocks are like
 * that. A gate that fails on correct input gets switched off, so each check
 * below has to be one that cannot.
 */

import { strict as assert } from 'node:assert'
import { globSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'

const root = path.join(import.meta.dirname, '..')

const docs = globSync(['*.md', 'doc/*.md', 'examples/*.md'], { cwd: root }).sort()

const read = file => readFileSync(path.join(root, file), 'utf8')

const pkg = JSON.parse(read('package.json'))

describe('documentation', () => {
  it('finds the documents it means to check', () => {
    assert(docs.length >= 3, `expected several markdown files, found ${docs.join(', ')}`)
    assert(docs.includes('README.md'))
  })

  it('references only repository paths that exist', () => {
    const missing = []
    for (const file of docs) {
      for (const [, ref] of read(file).matchAll(
        /`((?:src|test|examples|plugins|doc)\/[A-Za-z0-9_./-]+)`/g
      )) {
        if (!globSync(ref, { cwd: root }).length) missing.push(`${file} -> ${ref}`)
      }
    }
    assert.deepEqual(missing, [])
  })

  it('references only package scripts that exist', () => {
    const missing = []
    for (const file of docs) {
      for (const [, script] of read(file).matchAll(/(?:pnpm|npm) run ([a-z][a-z:]*)/g)) {
        if (!(script in pkg.scripts)) missing.push(`${file} -> ${script}`)
      }
    }
    assert.deepEqual(missing, [])
  })

  it('has no duplicate specifiers in an import list', () => {
    // The bug this exists for: the named-export example listed `trap`,
    // `trapSync` and `group` twice, so pasting it was a SyntaxError.
    const duplicated = []
    for (const file of docs) {
      for (const [, list] of read(file).matchAll(/import\s*\{([^}]*)\}\s*from/g)) {
        const names = list
          .split(',')
          .map(name => name.trim().split(/\s+as\s+/)[0])
          .filter(Boolean)
        const seen = new Set()
        for (const name of names) {
          if (seen.has(name)) duplicated.push(`${file} -> ${name}`)
          seen.add(name)
        }
      }
    }
    assert.deepEqual(duplicated, [])
  })

  it('states no test or example counts, which rot', () => {
    // Counts belong in the output of the checks that compute them, not in
    // prose that nothing recomputes.
    const stale = []
    for (const file of docs) {
      for (const [match] of read(file).matchAll(
        /\b\d{2,4}\s+(?:unit\s+)?(?:tests?|examples?|errors?)\b/g
      )) {
        stale.push(`${file} -> ${match}`)
      }
    }
    assert.deepEqual(stale, [])
  })
})
