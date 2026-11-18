// Ekspor dokumen di server (Word / PDF / HTML) dari paket dokumen tersimpan (hasil ed.getDocument()).
// Memakai Chrome/Chromium headless yang menjalankan library editor yang SAMA dengan di browser, jadi hasilnya
// identik dengan pratinjau: kertas, margin, header/footer, pengecualian halaman, watermark, CSS, daftar isi.
// Akses jaringan Chrome diblokir: dokumen tidak bisa membuat server mengambil URL luar.
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
export const LIB_PATH = process.env.DOC_EDITOR_LIB || path.resolve(here, '../dist/doc-editor.umd.js')
const TIMEOUT_MS = Number(process.env.EXPORT_TIMEOUT_MS || 60000)

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/snap/bin/chromium',
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', 'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
].filter(Boolean)
export const findChrome = () => CHROME_CANDIDATES.find((p) => existsSync(p)) ?? null

export const FORMATS = {
  docx: { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' },
  pdf: { type: 'application/pdf', ext: 'pdf' },
  html: { type: 'text/html; charset=utf-8', ext: 'html' },
}

const unescapeHtml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')

// Halaman sementara: buat editor tak terlihat dari paket dokumen, lalu hasilkan format yang diminta.
function renderPage(doc, format, libUrl) {
  const data = JSON.stringify({ doc, format }).replace(/</g, '\\u003c').replace(/\u2028|\u2029/g, '')
  return `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="host" style="position:absolute;left:-10000px;width:900px"></div><textarea id="out"></textarea>
<script src="${libUrl}"></script>
<script>
(async () => {
  const { doc, format } = ${data}
  const out = document.getElementById('out')
  try {
    const ed = DocEditor.create('#host', { content: doc, lang: doc.lang || 'id', menubar: false, statusbar: false })
    await ed.ready
    if (format === 'docx') {
      const blob = await ed.exportDocxBlob()
      const bytes = new Uint8Array(await blob.arrayBuffer())
      let bin = ''
      for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
      out.textContent = 'OK:' + btoa(bin)
    } else {
      const html = await ed.getPagedHTML(doc.fileName || 'dokumen')
      if (format === 'html') out.textContent = 'OK:' + html
      else { document.open(); document.write(html); document.close() } // pdf: halaman ini dicetak apa adanya
    }
  } catch (e) {
    out.textContent = 'ERR:' + (e && e.message || e)
  }
})()
</script></body></html>`
}

function runChrome(chrome, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(chrome, args, { stdio: ['ignore', 'pipe', 'pipe'] })
    const chunks = []
    child.stdout.on('data', (c) => chunks.push(c))
    child.stderr.resume()
    const timer = setTimeout(() => { child.kill('SIGKILL'); reject(Object.assign(new Error('timeout'), { code: 'TIMEOUT' })) }, TIMEOUT_MS)
    child.on('error', (e) => { clearTimeout(timer); reject(e) })
    child.on('close', () => { clearTimeout(timer); resolve(Buffer.concat(chunks).toString('utf8')) })
  })
}

/**
 * @param {object} doc  paket dokumen { html, page, css, lang, fileName } (hasil ed.getDocument())
 * @param {'docx'|'pdf'|'html'} format
 * @returns {Promise<{ body: Buffer, type: string, fileName: string }>}
 */
export async function exportDocument(doc, format) {
  if (!FORMATS[format]) throw Object.assign(new Error(`format tidak dikenal: ${format}`), { code: 'BAD_FORMAT' })
  if (!doc || typeof doc.html !== 'string') throw Object.assign(new Error('dokumen tidak valid (html wajib)'), { code: 'BAD_DOC' })
  const chrome = findChrome()
  if (!chrome) throw Object.assign(new Error('Chrome/Chromium tidak ditemukan; pasang Chrome atau isi CHROME_PATH'), { code: 'NO_CHROME' })
  if (!existsSync(LIB_PATH)) throw Object.assign(new Error(`library editor tidak ditemukan: ${LIB_PATH} (jalankan npm run build)`), { code: 'NO_LIB' })

  const dir = await mkdtemp(path.join(tmpdir(), 'doc-editor-'))
  try {
    const pageFile = path.join(dir, 'render.html')
    await writeFile(pageFile, renderPage(doc, format, pathToFileURL(LIB_PATH).href))
    const args = [
      '--headless', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
      '--allow-file-access-from-files',
      '--host-resolver-rules=MAP * ~NOTFOUND', // tanpa jaringan
      `--user-data-dir=${path.join(dir, 'profile')}`,
      '--virtual-time-budget=20000',
      ...(process.env.CHROME_NO_SANDBOX === '1' ? ['--no-sandbox'] : []), // perlu bila berjalan sebagai root (Docker)
    ]
    const pageUrl = pathToFileURL(pageFile).href
    const fileName = String(doc.fileName || 'dokumen').replace(/[^\p{L}\p{N} _.-]/gu, '_').slice(0, 100) || 'dokumen'
    if (format === 'pdf') {
      const pdfFile = path.join(dir, 'out.pdf')
      await runChrome(chrome, [...args, '--no-pdf-header-footer', `--print-to-pdf=${pdfFile}`, pageUrl])
      const body = await readFile(pdfFile).catch(() => null)
      if (!body?.length) throw Object.assign(new Error('PDF gagal dibuat'), { code: 'RENDER' })
      return { body, type: FORMATS.pdf.type, fileName: `${fileName}.pdf` }
    }
    const dom = await runChrome(chrome, [...args, '--dump-dom', pageUrl])
    const m = dom.match(/<textarea id="out">([\s\S]*?)<\/textarea>/)
    const result = m ? unescapeHtml(m[1]) : ''
    if (!result.startsWith('OK:')) throw Object.assign(new Error(result.startsWith('ERR:') ? result.slice(4) : 'render gagal'), { code: 'RENDER' })
    const payload = result.slice(3)
    const body = format === 'docx' ? Buffer.from(payload, 'base64') : Buffer.from(payload, 'utf8')
    return { body, type: FORMATS[format].type, fileName: `${fileName}.${FORMATS[format].ext}` }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}
