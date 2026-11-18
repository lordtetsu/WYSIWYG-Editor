import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fileToHtml, textToHtml, importAccept, registerImporter } from '../src/importers.js'

// Pengganti File browser secukupnya.
const fakeFile = (name, data) => ({
  name,
  text: async () => String(data),
  arrayBuffer: async () => (typeof data === 'string' ? new TextEncoder().encode(data) : data).buffer,
})

test('txt: baris kosong = paragraf, HTML di-escape', () => {
  assert.equal(textToHtml('Satu\nbaris dua\r\n\r\n<b>x</b>'), '<p>Satu<br>baris dua</p><p>&lt;b&gt;x&lt;/b&gt;</p>')
})

test('markdown jadi HTML', async () => {
  const { html } = await fileToHtml(fakeFile('a.MD', '# Judul\n\n**tebal** dan *miring*\n\n| A | B |\n|---|---|\n| 1 | 2 |'))
  assert.match(html, /<h1>Judul<\/h1>/)
  assert.match(html, /<strong>tebal<\/strong>/)
  assert.match(html, /<table>/)
})

test('format tak dikenal -> error unsupported; plugin bisa mendaftar format baru', async () => {
  await assert.rejects(fileToHtml(fakeFile('x.xyz', '')), (e) => e.code === 'unsupported')
  assert.ok(!importAccept().includes('.xyz'))
  registerImporter(['.XYZ'], async () => '<p>ok</p>')
  assert.deepEqual(await fileToHtml(fakeFile('x.xyz', '')), { html: '<p>ok</p>' })
  assert.ok(importAccept().includes('.xyz'))
})
