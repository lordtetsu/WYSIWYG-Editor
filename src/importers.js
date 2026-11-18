// Impor file eksternal -> HTML. Hasilnya tetap disaring skema editor (tag tak dikenal & <script> dibuang).
import { marked } from 'marked'
import { docxToHtml } from './docx-import.js'
import { htmlToContent } from './html-import.js'

const importers = new Map()

/** Daftarkan pengimpor baru: fungsi mengembalikan HTML, atau { html, page } untuk ikut mengatur kertas/header/footer. */
export function registerImporter(extensions, toHtml) {
  for (const ext of [].concat(extensions)) importers.set(ext.toLowerCase().replace(/^\./, ''), toHtml)
}

export const hasImporter = (ext) => importers.has(ext)
export const importAccept = () => [...importers.keys()].map((e) => `.${e}`).join(',')
export const extensionOf = (name) => (name.includes('.') ? name.split('.').pop().toLowerCase() : '')

/**
 * @returns {Promise<{html: string, page?: object}>} page = pengaturan kertas/header/footer dari file (bila ada).
 * Melempar Error dengan .code = 'unsupported' bila format tak dikenal.
 */
export async function fileToHtml(file) {
  const toHtml = importers.get(extensionOf(file.name))
  if (!toHtml) throw Object.assign(new Error(`unsupported: ${file.name}`), { code: 'unsupported' })
  const result = await toHtml(file)
  return typeof result === 'string' ? { html: result } : result
}

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// Baris kosong = paragraf baru; baris biasa = <br>.
export const textToHtml = (text) => text
  .replace(/\r\n?/g, '\n')
  .split(/\n\s*\n/)
  .filter((p) => p.trim())
  .map((p) => `<p>${escapeHtml(p.trim()).replace(/\n/g, '<br>')}</p>`)
  .join('')

// Ambil isi <body> saja agar <title>/<style> tidak ikut menjadi teks. DOMParser tidak menjalankan script.
const bodyOf = (html) => new DOMParser().parseFromString(html, 'text/html').body.innerHTML

// Di browser gaya CSS halaman ikut dibaca (html-import.js); di luar browser cukup isi <body>.
registerImporter(['html', 'htm'], async (file) => (typeof document !== 'undefined' ? htmlToContent(await file.text()) : bodyOf(await file.text())))
registerImporter(['txt', 'text'], async (file) => textToHtml(await file.text()))
registerImporter(['md', 'markdown'], async (file) => marked.parse(await file.text()))
// Gambar di dalam .docx ikut sebagai data URL; ukuran kertas, margin, header & footer ikut sebagai `page`.
registerImporter(['docx'], async (file) => docxToHtml(await file.arrayBuffer()))
