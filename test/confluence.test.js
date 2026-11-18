// Konversi docs/*.md ke format storage Confluence harus XML yang sah (kalau tidak, Confluence menolak halaman).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { DOMParser } from '@xmldom/xmldom'
import { toStorage } from '../scripts/publish-confluence.mjs'

test('docs/*.md -> XHTML storage Confluence yang valid', () => {
  const dir = new URL('../docs/', import.meta.url).pathname
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.md'))) {
    const xml = `<root xmlns:ac="http://atlassian.com/content" xmlns:ri="http://atlassian.com/resource">${toStorage(readFileSync(dir + f, 'utf8'))}</root>`
    const errors = []
    new DOMParser({ onError: (level, msg) => { if (level !== 'warning') errors.push(msg) } }).parseFromString(xml, 'text/xml')
    assert.deepEqual(errors, [], f)
  }
  assert.match(toStorage('```js\nif (a < b && c) x()\n```'), /<ac:parameter ac:name="language">js<\/ac:parameter><ac:plain-text-body><!\[CDATA\[if \(a < b && c\) x\(\)\]\]>/)
})
