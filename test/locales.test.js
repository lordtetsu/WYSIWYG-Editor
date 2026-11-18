import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LOCALES, resolveText } from '../src/locales.js'

test('bahasa id dan en punya kunci yang sama', () => {
  assert.deepEqual(Object.keys(LOCALES.id).sort(), Object.keys(LOCALES.en).sort())
})

test('labels menimpa sebagian, sisanya tetap bawaan', () => {
  const t = resolveText('en', { bold: { label: '𝐁' }, save: { html: '<svg></svg>' }, linkPrompt: 'URL?' })
  assert.deepEqual(t.bold, { label: '𝐁', title: 'Bold' })
  assert.equal(t.save.html, '<svg></svg>')
  assert.equal(t.save.title, 'Save (Ctrl/Cmd+S)')
  assert.equal(t.linkPrompt, 'URL?')
  assert.equal(t.italic.title, 'Italic')
})

test('default id; bahasa tak dikenal jatuh ke en', () => {
  assert.equal(resolveText().bold.title, 'Tebal')
  assert.equal(resolveText('fr').bold.title, 'Bold')
})

test('ganti label saja membuang ikon SVG bawaan; ganti title saja mempertahankannya', () => {
  assert.match(resolveText('id').alignLeft.html, /<svg/)
  const t = resolveText('id', { alignLeft: { label: 'Kiri' }, alignRight: { title: 'Kanan' } })
  assert.equal(t.alignLeft.html, undefined)
  assert.equal(t.alignLeft.label, 'Kiri')
  assert.match(t.alignRight.html, /<svg/)
})

test('semua tombol toolbar & item menu punya teks di id dan en', async () => {
  const fs = await import('node:fs')
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
  const groups = src.slice(src.indexOf('const GROUPS = {'), src.indexOf('export const DEFAULT_GROUP_ORDER'))
  const keys = [...groups.matchAll(/^ {4}\['(\w+)'/gm), ...src.matchAll(/item\('(\w+)'/g)].map((m) => m[1])
  for (const lang of ['id', 'en']) assert.deepEqual(keys.filter((k) => !LOCALES[lang][k]), [], lang)
})
