import { test } from 'node:test'
import assert from 'node:assert/strict'
import { render } from '../scripts/changelog.mjs'

test('CHANGELOG: rilis dari tag, kategori dari kata pertama, commit rilis tidak dicatat', () => {
  const c = (hash, date, subject) => ({ hash, date, subject })
  const out = render([
    c('d', '2026-11-20', 'Perbaiki nomor halaman catatan kaki'),
    c('c', '2026-11-19', 'Rilis v0.2.0'),
    c('b', '2026-11-19', 'Tambah video'),
    c('a', '2026-11-18', 'Ubah tema gelap'),
  ], new Map([['c', 'v0.2.0']]))
  assert.match(out, /## \[Belum dirilis\]\n\n### Diperbaiki\n\n- Perbaiki nomor halaman catatan kaki \(2026-11-20\)\n/)
  assert.match(out, /## \[v0\.2\.0 - 2026-11-19\]\n\n### Ditambahkan\n\n- Tambah video \(2026-11-19\)\n\n### Diubah\n\n- Ubah tema gelap \(2026-11-18\)\n/)
  assert.doesNotMatch(out, /Rilis v0\.2\.0/)
  // commit rilis tanpa tag (tag dibuat npm setelah commit) tetap menjadi batas versi
  const noTag = render([c('b', '2026-11-19', 'Rilis v0.3.0'), c('a', '2026-11-18', 'Tambah rumus')], new Map())
  assert.match(noTag, /## \[v0\.3\.0 - 2026-11-19\]\n\n### Ditambahkan\n\n- Tambah rumus/)
  assert.doesNotMatch(noTag, /Belum dirilis/)
})

test('sync-version: hanya pola versi library yang diganti', async () => {
  const { syncVersion } = await import('../scripts/sync-version.mjs')
  const src = 'npm install @lord-tetsu/doc-editor@0.1.0\nVersi library: 0.1.0 · x\nnpm version patch   # 0.1.0 → 0.1.1\n' +
    'terminal: `+ @lord-tetsu/doc-editor@0.1.1`\nnpm deprecate @lord-tetsu/doc-editor@0.0.0-stage "x"\n{ "name": "doc-editor-ai-server", "version": "0.1.0" }'
  const out = syncVersion(src, '0.2.0')
  assert.equal(out, 'npm install @lord-tetsu/doc-editor@0.2.0\nVersi library: 0.2.0 · x\nnpm version patch   # 0.1.0 → 0.1.1\n' +
    'terminal: `+ @lord-tetsu/doc-editor@0.1.1`\nnpm deprecate @lord-tetsu/doc-editor@0.0.0-stage "x"\n{ "name": "doc-editor-ai-server", "version": "0.2.0" }')
})
