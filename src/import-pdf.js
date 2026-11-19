// Plugin opsional: impor PDF. PDF tidak menyimpan struktur dokumen, jadi struktur ditebak dari posisi & huruf:
// paragraf, judul (peringkat ukuran huruf), tebal/miring (font), perataan, tabel (kolom sejajar; sel terbungkus,
// baris pemisah, & tabel yang bersambung antarhalaman digabung), ukuran kertas & margin, serta header/footer
// (baris teratas/terbawah yang berulang di banyak halaman). Gambar PDF tidak dipulihkan.
// Dipisah dari file utama karena pdf.js besar (~490 KB gzip).
// <script>: muat setelah doc-editor.umd.js, otomatis terdaftar.
// import  : import { registerImporter } from '@lord-tetsu/doc-editor'; import { pdfToHtml } from '@lord-tetsu/doc-editor/pdf'
//           registerImporter(['pdf'], pdfToHtml)
import { getDocument } from 'pdfjs-dist'
// Worker dijalankan di thread utama (tanpa file worker terpisah) agar tetap satu file & offline.
import * as pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs'
import { matchPaper } from './page.js'

globalThis.pdfjsWorker = pdfjsWorker

const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const PT_TO_MM = 25.4 / 72
const PT_TO_PX = 96 / 72
const round = (n) => Math.round(n * 10) / 10
const COL_TOLERANCE = 8 // pt: awal segmen dianggap satu kolom bila selisihnya sekecil ini

// Gabungkan potongan teks; beri spasi bila ada jarak antarpotongan.
function joinItems(items) {
  let text = ''
  let end = null
  for (const it of items) {
    if (end !== null && it.x - end > 1 && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' '
    text += it.str
    end = it.x + it.w
  }
  return text
}

/** Baris visual (y sama) -> { y, h, items, segs: [{ x, right, items }], left, right, text } */
async function readRows(page) {
  await page.getOperatorList() // memuat font agar tebal/miring bisa dibaca
  const { items } = await page.getTextContent()
  const font = (id) => { try { return page.commonObjs.get(id) } catch { return null } }
  const pieces = items.filter((it) => it.str).map((it) => {
    const f = font(it.fontName)
    const name = f?.name ?? ''
    return {
      str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h: it.height || Math.abs(it.transform[3]) || 10,
      space: !it.str.trim(), // potongan spasi: pemisah kata, tapi tidak menutup jarak antarkolom
      bold: !!(f?.bold || f?.black) || /bold|black|heavy|semibold/i.test(name),
      italic: !!f?.italic || /italic|oblique/i.test(name),
      family: fontFamily(name, f?.fallbackName),
    }
  })
  pieces.sort((a, b) => b.y - a.y || a.x - b.x)
  const rows = []
  for (const p of pieces) {
    const row = rows.at(-1)
    if (row && Math.abs(row.y - p.y) <= 2) row.items.push(p)
    else rows.push({ y: p.y, items: [p] })
  }
  for (const r of rows.filter((x) => x.items.some((i) => !i.space))) {
    r.items.sort((a, b) => a.x - b.x)
    const words = r.items.filter((i) => !i.space)
    r.h = Math.max(...words.map((i) => i.h))
    // Jarak horizontal lebar = batas sel/kolom.
    r.segs = []
    let pendingSpace = false
    for (const it of r.items) {
      const s = r.segs.at(-1)
      if (it.space) { pendingSpace = !!s; continue }
      if (s && it.x - s.right <= Math.max(10, r.h)) {
        if (pendingSpace) s.items.push({ ...it, str: ' ', w: 0, x: s.right })
        s.items.push(it)
        s.right = Math.max(s.right, it.x + it.w)
      } else r.segs.push({ x: it.x, right: it.x + it.w, items: [it] })
      pendingSpace = false
    }
    r.items = r.segs.flatMap((sg) => sg.items)
    r.left = r.items[0].x
    r.right = Math.max(...r.items.map((i) => i.x + i.w))
    r.text = r.segs.map((s) => joinItems(s.items)).join(' ').trim()
  }
  return rows.filter((r) => r.segs?.length)
}

// Nama font PDF ("ABCDEF+SourceSerif4-Bold") -> keluarga ("Source Serif 4") + cadangan generik.
function fontFamily(name, fallback) {
  const base = name.replace(/^[A-Z]{6}\+/, '').split(/[-,]/)[0].replace(/(MT|PS|Std|Pro)$/, '')
  if (!base || /^(Helvetica|Arial|Calibri|g_d\d)/i.test(base)) return null // mirip huruf bawaan editor
  const pretty = base.replace(/([a-z])([A-Z0-9])/g, '$1 $2')
  return `'${pretty}', ${fallback || 'serif'}`
}

// Baris yang diakhiri tanda hubung disambung tanpa spasi ("Pasca-" + "Kuantum").
const joinLines = (parts) => parts.reduce((acc, part) => (!acc ? part : /-$/.test(acc.replace(/<[^>]+>/g, '')) ? acc + part : `${acc} ${part}`), '')

function itemsHtml(items) {
  const parts = []
  let end = null
  for (const i of items) {
    if (end !== null && i.x - end > 1 && !/^\s/.test(i.str)) parts.push(' ')
    let s = escapeHtml(i.str)
    if (i.family) s = `<span style="font-family: ${i.family}">${s}</span>`
    if (i.italic) s = `<em>${s}</em>`
    if (i.bold) s = `<strong>${s}</strong>`
    parts.push(s)
    end = i.x + i.w
  }
  return parts.join('')
    .replace(/<\/strong>( ?)<strong>/g, '$1').replace(/<\/em>( ?)<em>/g, '$1').trim()
}

// --- Tabel -------------------------------------------------------------------------------------------
// Satu tabel = baris-baris bersegmen >= 2 yang awal segmennya sejajar dengan kolom yang sama.
// Baris satu segmen di kolom > 0 = lanjutan teks sel yang terbungkus; di kolom 0 dengan baris tabel
// sesudahnya = baris pemisah (sel gabung selebar tabel) atau lanjutan sel kolom pertama.
function buildTable(rows, start) {
  const cols = rows[start].segs.map((s) => s.x)
  const colOf = (x) => {
    const exact = cols.findIndex((c) => Math.abs(c - x) <= COL_TOLERANCE)
    if (exact >= 0) return exact
    let k = -1
    cols.forEach((c, i) => { if (c <= x) k = i })
    return k
  }
  const aligned = (r) => r.segs.length >= 2 && r.segs.filter((s) => cols.some((c) => Math.abs(c - s.x) <= COL_TOLERANCE)).length >= 2
  const out = []
  let multi = 0
  let j = start
  for (; j < rows.length; j++) {
    const r = rows[j]
    const prev = rows[j - 1]
    if (j > start && prev.y - r.y > Math.max(r.h, prev.h) * 4) break
    if (r.segs.length >= 2) {
      if (!aligned(r)) break
      const cells = []
      for (const s of r.segs) {
        const k = Math.max(0, colOf(s.x))
        const last = cells.at(-1)
        if (last && last.col === k) last.lines.push(s.items)
        else cells.push({ col: k, lines: [s.items], right: s.right })
      }
      out.push({ cells, y: r.y })
      multi++
      continue
    }
    const seg = r.segs[0]
    const exact = cols.findIndex((c) => Math.abs(c - seg.x) <= COL_TOLERANCE)
    const tableAhead = rows.slice(j + 1, j + 5).some(aligned)
    const near = prev && prev.y - r.y < Math.max(r.h, prev.h) * 1.7
    if (exact > 0 && out.length && near) { // teks terbungkus di kolom > 0
      const row = out.at(-1)
      const cell = row.cells.find((c) => c.col === exact)
      if (cell) cell.lines.push(seg.items)
      else row.cells.push({ col: exact, lines: [seg.items] })
      continue
    }
    if (exact === 0 && tableAhead) {
      const wraps = out.length && near && seg.right < (cols[1] ?? Infinity) && out.at(-1).cells.length > 1
      if (wraps) out.at(-1).cells[0].lines.push(seg.items)
      else out.push({ cells: [{ col: 0, lines: [seg.items], right: seg.right, spanAll: seg.right > (cols[1] ?? Infinity) }], y: r.y })
      continue
    }
    break
  }
  return multi >= 2 ? { cols, rows: out, end: j } : null
}

function tableHtml(table) {
  const n = table.cols.length
  const widths = table.cols.map((c, i) => Math.round(((table.cols[i + 1] ?? table.right) - c) * PT_TO_PX))
  const body = table.rows.map((row, ri) => {
    row.cells.sort((a, b) => a.col - b.col)
    const header = ri === 0 && row.cells.every((c) => c.lines.flat().every((i) => i.bold))
    const tag = header ? 'th' : 'td'
    let html = ''
    let col = 0
    row.cells.forEach((cell, i) => {
      while (col < cell.col) { html += `<${tag}><p></p></${tag}>`; col++ }
      const next = row.cells[i + 1]?.col ?? n
      const span = cell.spanAll ? n - col : Math.max(1, next - col)
      const content = joinLines(cell.lines.map((items) => itemsHtml(items)))
      const text = header ? content.replace(/<\/?strong>/g, '') : content
      const width = widths.slice(col, col + span)
      html += `<${tag}${span > 1 ? ` colspan="${span}"` : ''} colwidth="${width.join(',')}"><p>${text}</p></${tag}>`
      col += span
    })
    while (col < n) { html += `<${tag}><p></p></${tag}>`; col++ }
    return { html: `<tr>${html}</tr>`, header, text: row.cells.map((c) => c.lines.flat().map((i) => i.str).join(' ')).join('|') }
  })
  return body
}

// --- Dokumen -----------------------------------------------------------------------------------------

// Perataan paragraf dari posisi barisnya terhadap batas kiri/kanan teks dokumen.
function alignment(lines, minX, maxX) {
  const near = (a, b, tol) => Math.abs(a - b) <= tol
  if (lines.every((l) => l.left - minX > 15 && near(l.left - minX, maxX - l.right, 8))) return 'center'
  if (lines.every((l) => near(l.right, maxX, 4) && l.left - minX > 30)) return 'right'
  if (lines.length > 1 && lines.slice(0, -1).every((l) => near(l.right, maxX, 3))) return 'justify'
  return null
}

// Nomor halaman diganti {page}/{pages} agar header/footer bisa dibandingkan antarhalaman.
const withFields = (text, n, total) => text.replace(new RegExp(`\\b${n}\\b`), '{page}').replace(new RegExp(`\\b${total}\\b`), '{pages}')

export async function pdfToHtml(file) {
  // isEvalSupported: false -> pdf.js tidak memakai eval untuk font (pengamanan tambahan);
  // fontExtraProperties: nama font (mis. "Arial-BoldMT") ikut tersedia untuk mengenali tebal/miring
  const task = getDocument({ data: new Uint8Array(await file.arrayBuffer()), isEvalSupported: false, fontExtraProperties: true })
  const pdf = await task.promise
  const total = pdf.numPages
  const pages = []
  for (let n = 1; n <= total; n++) {
    const page = await pdf.getPage(n)
    const [, , w, h] = page.view
    pages.push({ n, w, h, rows: await readRows(page) })
  }
  await task.destroy()

  // Header/footer: baris teratas/terbawah yang sama (setelah nomor halaman disamakan) di >= 60% halaman.
  const repeated = (pick) => {
    if (total < 2) return null
    const counts = {}
    for (const p of pages) {
      const r = pick(p.rows)
      if (r) counts[withFields(r.text, p.n, total)] = (counts[withFields(r.text, p.n, total)] ?? 0) + 1
    }
    const [text, count] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? []
    return count >= Math.max(2, total * 0.6) ? text : null
  }
  const headerText = repeated((rs) => rs[0])
  const footerText = repeated((rs) => rs.at(-1))
  const zones = { header: null, footer: null } // { row, n }
  for (const p of pages) {
    const [first, last] = [p.rows[0], p.rows.at(-1)]
    if (headerText && first && withFields(first.text, p.n, total) === headerText) {
      zones.header ??= { row: first, n: p.n }
      p.rows = p.rows.filter((x) => x !== first)
    }
    if (footerText && last && last !== first && withFields(last.text, p.n, total) === footerText) {
      zones.footer ??= { row: last, n: p.n }
      p.rows = p.rows.filter((x) => x !== last)
    }
  }

  // Blok per halaman: tabel atau baris teks; tabel di akhir halaman yang berlanjut di awal halaman berikutnya digabung.
  const blocks = [] // { table } | { row }
  for (const p of pages) {
    let first = true
    for (let i = 0; i < p.rows.length;) {
      const table = p.rows[i].segs.length >= 2 ? buildTable(p.rows, i) : null
      if (table) {
        table.right = Math.max(...p.rows.slice(i, table.end).map((r) => r.right))
        const prev = blocks.at(-1)
        if (first && prev?.table && prev.page === p.n - 1 && prev.table.cols.length === table.cols.length) {
          const head = tableHtml(prev.table)[0]
          const rows = tableHtml(table)
          if (head?.header && rows[0]?.text === head.text) table.rows.shift() // judul tabel yang diulang
          prev.table.rows.push(...table.rows)
          prev.page = p.n
        } else blocks.push({ table, page: p.n })
        i = table.end
      } else {
        blocks.push({ row: p.rows[i], page: p.n })
        i++
      }
      first = false
    }
  }

  // Batas teks (di luar tabel) untuk perataan & margin.
  const textRows = blocks.filter((b) => b.row).map((b) => b.row)
  const allRows = pages.flatMap((p) => p.rows)
  const minX = Math.min(...allRows.map((r) => r.left))
  const maxX = Math.max(...allRows.map((r) => r.right))
  // Tabel yang hampir selebar halaman diperlebar sampai batas kanan teks (kolom terakhir tidak terjepit).
  for (const b of blocks) if (b.table && maxX - b.table.right < 80) b.table.right = maxX

  // Baris teks -> paragraf.
  const items = [] // { para: { lines, h } } | { table }
  let para = null
  let prev = null
  const flush = () => { if (para) items.push({ para }); para = null }
  for (const b of blocks) {
    if (b.table) { flush(); prev = null; items.push({ table: b.table }); continue }
    const r = b.row
    // jarak vertikal besar, ganti halaman, atau ukuran huruf berubah = paragraf baru
    if (!prev || prev.page !== b.page || prev.row.y - r.y > Math.max(prev.row.h, r.h) * 1.8 || Math.abs(prev.row.h - r.h) > 1) flush()
    para ??= { lines: [], h: 0 }
    para.lines.push(r)
    para.h = Math.max(para.h, r.h)
    prev = b
  }
  flush()

  // Judul: ukuran huruf di atas teks paling umum; peringkat ukuran -> h1, h2, h3.
  const weight = {}
  for (const r of textRows) weight[Math.round(r.h)] = (weight[Math.round(r.h)] ?? 0) + r.text.length
  const body = +Object.entries(weight).sort((a, b) => b[1] - a[1])[0]?.[0] || 10
  const headingSizes = [...new Set(items.filter((i) => i.para && i.para.h > body * 1.25).map((i) => Math.round(i.para.h)))].sort((a, b) => b - a)
  const level = (h) => Math.min(headingSizes.indexOf(Math.round(h)) + 1, 3)
  const blockHtml = ({ lines, h }) => {
    const align = alignment(lines, minX, maxX)
    const style = align ? ` style="text-align: ${align}"` : ''
    const inner = joinLines(lines.map((l) => itemsHtml(l.items)))
    if (h > body * 1.25) {
      const tag = `h${level(h)}`
      return `<${tag}${style}>${inner.replace(/<\/?strong>/g, '')}</${tag}>`
    }
    return `<p${style}>${inner}</p>`
  }
  const html = items.map((i) => (i.table ? `<table><tbody>${tableHtml(i.table).map((r) => r.html).join('')}</tbody></table>` : blockHtml(i.para))).join('')
  const zoneHtml = (z) => (z ? withFields(blockHtml({ lines: [z.row], h: body }), z.n, total) : '')

  // Kertas & margin dari halaman pertama dan batas teks.
  const { w, h } = pages[0]
  const width = round(w * PT_TO_MM)
  const height = round(h * PT_TO_MM)
  const topY = allRows.length ? Math.max(...pages[0].rows.map((r) => r.y + r.h), 0) : h - 56
  const bottomY = allRows.length ? Math.min(...allRows.map((r) => r.y)) : 56
  const mm = (pt) => Math.min(Math.max(round(pt * PT_TO_MM), 5), 50)
  return {
    html,
    page: {
      size: matchPaper(width, height) ?? { width, height },
      orientation: width > height ? 'landscape' : 'portrait',
      margin: allRows.length ? { top: mm(h - topY), right: mm(w - maxX), bottom: mm(bottomY), left: mm(minX) } : undefined,
      header: zoneHtml(zones.header),
      footer: zoneHtml(zones.footer),
    },
  }
}

if (typeof window !== 'undefined') window.DocEditor?.registerImporter?.(['pdf'], pdfToHtml)
