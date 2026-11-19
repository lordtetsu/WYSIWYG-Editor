// Samakan nomor versi di dokumen dengan package.json. Dijalankan otomatis oleh `npm version` (skrip "version"),
// sehingga perubahan ikut masuk ke commit "Rilis vX.Y.Z".
import { readFileSync, writeFileSync } from 'node:fs'

const root = new URL('../', import.meta.url)
const FILES = ['README.md', 'docs/DOKUMENTASI-TEKNIS.md', 'webserver/package.json']

/** Ganti versi pada pola yang memang menyebut versi library ini saja (bukan contoh angka lain). */
export function syncVersion(text, version) {
  return text
    // hanya perintah pasang versi tertentu, bukan contoh keluaran/deprecate (mis. @0.0.0-stage)
    .replace(/(npm install @lord-tetsu\/doc-editor@)\d+\.\d+\.\d+\b(?!-)/g, `$1${version}`)
    .replace(/(Versi library: )\d+\.\d+\.\d+\b(?!-)/g, `$1${version}`)
    .replace(/("name": "doc-editor-ai-server",\s*"version": ")[^"]+/, `$1${version}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { version } = JSON.parse(readFileSync(new URL('package.json', root), 'utf8'))
  for (const f of FILES) {
    const url = new URL(f, root)
    const before = readFileSync(url, 'utf8')
    const after = syncVersion(before, version)
    if (after !== before) { writeFileSync(url, after); console.log(`versi ${version}: ${f}`) }
  }
}
