// Halaman bertata letak kertas (pratinjau, cetak/PDF, unduhan HTML) + jendela pratinjau cetak.
// Isi dipecah per halaman di dalam iframe, lalu tiap halaman diberi header, footer, nomor halaman & watermark,
// sehingga hasil cetak sama persis dengan pratinjau.
import { PAPER, normalizePage, pageMatcher } from './page.js'
import { pagedCss } from './styles.js'
import { watermarkSvg, watermarkFields } from './watermark.js'
import { scopeCss } from './content-css.js'

const MM = 96 / 25.4 // px per mm
const make = (tag, props = {}) => Object.assign(document.createElement(tag), props)
const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// {page}/{pages} -> angka; dibungkus span agar templat bisa dikembalikan saat header/footer diedit.
const fillFields = (html, n, total) => html.replace(/\{(page|pages)\}/g, (_, f) =>
  `<span class="de-field" data-field="${f}" contenteditable="false">${f === 'page' ? n : total}</span>`)
function readTemplate(el) {
  const copy = el.cloneNode(true)
  copy.querySelectorAll('.de-field').forEach((s) => s.replaceWith(`{${s.dataset.field}}`))
  return copy.innerHTML
}

// Catatan kaki: nomori <sup data-footnote> berurutan; kembalikan elemen isi catatannya (belum dipasang).
function footnoteNotes(root) {
  return [...root.querySelectorAll('sup[data-footnote]')].map((sup, i) => {
    sup.textContent = i + 1
    const note = root.ownerDocument.createElement('div')
    note.className = 'de-fn-note'
    note.append(Object.assign(root.ownerDocument.createElement('sup'), { textContent: i + 1 }), ' ', sup.dataset.footnote)
    sup.deNote = note
    return note
  })
}
const notesBox = (doc, notes) => {
  const box = doc.createElement('div')
  box.className = 'de-footnotes'
  box.append(...notes)
  return box
}

/** HTML satu alur: catatan kaki dinomori dan dikumpulkan di akhir dokumen. */
export function withEndnotes(html) {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, 'text/html')
  const notes = footnoteNotes(doc.body)
  if (notes.length) doc.body.append(notesBox(doc, notes))
  return doc.body.innerHTML
}

/** Dokumen awal (belum dipecah per halaman). header/footer berupa HTML yang sudah dibersihkan. */
export function pagedDocument({ html, header = '', footer = '', page, title, css = '' }) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">` +
    `<title>${escapeHtml(title)}</title><style>${pagedCss(page)}</style>${css ? `<style>${scopeCss(css, '.de-content')}</style>` : ''}</head><body>` +
    `<div class="de-source de-content">${html}</div>` +
    `<template id="de-header">${header}</template><template id="de-footer">${footer}</template></body></html>`
}

// Pecah tabel di baris pertama yang melewati batas; baris judul diulang. Mengembalikan sisa tabel atau null.
function splitTable(table, limit) {
  const rows = [...table.rows]
  let head = 0
  while (head < rows.length && [...rows[head].cells].every((c) => c.tagName === 'TH')) head++
  const index = rows.findIndex((r, i) => i >= head && r.getBoundingClientRect().bottom > limit)
  if (index <= head) return null
  const rest = table.cloneNode(false)
  const colgroup = table.querySelector('colgroup')
  if (colgroup) rest.append(colgroup.cloneNode(true))
  const body = table.ownerDocument.createElement('tbody')
  rows.slice(0, head).forEach((r) => body.append(r.cloneNode(true)))
  rows.slice(index).forEach((r) => body.append(r))
  rest.append(body)
  table.after(rest)
  return rest
}

function rulerTicks(doc, lengthMm, vertical) {
  const ruler = doc.createElement('div')
  for (let cm = 1; cm < lengthMm / 10; cm++) {
    const label = doc.createElement('span')
    label.textContent = cm
    label.style[vertical ? 'top' : 'left'] = `${cm * 10}mm`
    ruler.append(label)
  }
  return ruler
}

/**
 * Pecah .de-source menjadi halaman (.de-sheet). Dipanggil setelah iframe selesai dimuat.
 * @param {number[]} [o.starts]  diisi indeks elemen teratas yang memulai tiap halaman (untuk section Word)
 * @returns {number} jumlah halaman
 */
export async function paginate(doc, page, { editable = false, rulers = false, text = {}, onEdit, starts } = {}) {
  await doc.fonts?.ready
  await Promise.all([...doc.images].map((i) => i.decode().catch(() => {})))
  const headerTpl = doc.getElementById('de-header').innerHTML.trim()
  const footerTpl = doc.getElementById('de-footer').innerHTML.trim()
  const m = page.margin
  const contentWidth = page.width - m.left - m.right
  // Header/footer yang tinggi mendorong area isi (seperti di Word).
  const measure = async (tpl) => {
    const d = doc.createElement('div')
    d.className = 'de-hf de-content'
    d.style.cssText = `position:absolute;visibility:hidden;width:${contentWidth}mm`
    d.innerHTML = fillFields(tpl, 1, 1)
    doc.body.append(d)
    await Promise.all([...d.querySelectorAll('img')].map((i) => i.decode().catch(() => {}))) // logo dll. harus termuat dulu
    const h = d.getBoundingClientRect().height / MM
    d.remove()
    return h
  }
  // Area isi minimal setengah halaman walau header/footer sangat tinggi.
  const top = Math.min(Math.max(m.top, headerTpl ? page.headerDistance + (await measure(headerTpl)) + 2 : 0), page.height / 4 + m.top)
  const bottom = Math.min(Math.max(m.bottom, footerTpl ? page.footerDistance + (await measure(footerTpl)) + 2 : 0), page.height / 4 + m.bottom)
  const limit = (page.height - top - bottom) * MM

  const source = doc.querySelector('.de-source')
  const order = new Map([...source.children].map((c, i) => [c, i]))
  // Tinggi tiap catatan kaki (lebar area isi) + garis pemisah; area catatan mengurangi ruang isi halaman itu.
  const notes = footnoteNotes(source)
  let sepPx = 0
  if (notes.length) {
    const box = notesBox(doc, notes)
    box.classList.add('de-content')
    box.style.cssText = `position:absolute;visibility:hidden;width:${contentWidth}mm`
    doc.body.append(box)
    for (const n of notes) n.dePx = n.getBoundingClientRect().height
    sepPx = box.getBoundingClientRect().height - notes.reduce((a, n) => a + n.dePx, 0)
    box.remove()
  }
  const notesPx = (els) => {
    const px = els.flatMap((e) => [...e.querySelectorAll('sup[data-footnote]')]).reduce((a, s) => a + (s.deNote?.dePx ?? 0), 0)
    return px ? px + sepPx : 0
  }
  const pages = [[]]
  let start = null
  let el = source.firstElementChild
  while (el) {
    // Pemisah halaman: mulai halaman baru (elemennya sendiri tidak ditampilkan).
    if (el.matches('[data-page-break]')) {
      const next = el.nextElementSibling
      if (pages.at(-1).length) pages.push([])
      start = null
      el.remove()
      el = next
      continue
    }
    const r = el.getBoundingClientRect()
    const elTop = r.top - parseFloat(doc.defaultView.getComputedStyle(el).marginTop)
    start ??= elTop
    const room = limit - (notes.length ? notesPx([...pages.at(-1), el]) : 0)
    const fits = r.bottom - start <= room
    if (!fits && el.tagName === 'TABLE') {
      // shortcut: catatan kaki di baris tabel yang pindah halaman tetap dihitung di halaman ini; cukup untuk tabel biasa.
      const rest = splitTable(el, start + room)
      if (rest) {
        pages.at(-1).push(el)
        pages.push([])
        start = null
        el = rest
        continue
      }
    }
    if (!fits && pages.at(-1).length) { // pindah ke halaman baru, lalu ukur ulang elemen yang sama
      pages.push([])
      start = elTop
      continue
    }
    pages.at(-1).push(el)
    el = el.nextElementSibling
  }
  // Elemen asli pertama di tiap halaman (sisa tabel yang terpotong bukan awal halaman).
  starts?.push(...pages.map((els) => order.get(els.find((e) => order.has(e)))))

  const total = pages.length
  // Nomor yang tampil dimulai dari firstPageNumber; header/footer bisa dikecualikan di halaman tertentu.
  const shown = (i) => i + page.firstPageNumber
  const lastShown = shown(total - 1)
  const hideHeader = pageMatcher(page.hideHeaderOn)
  const hideFooter = pageMatcher(page.hideFooterOn)
  const wm = page.watermark ? `<div class="de-wm">${watermarkSvg(page.watermark, page.width, page.height)}</div>` : ''
  const sheets = make('div', { className: 'de-sheets' })
  pages.forEach((els, i) => {
    const wrap = doc.createElement('div')
    wrap.className = 'de-page'
    const sheet = doc.createElement('div')
    sheet.className = 'de-sheet'
    sheet.innerHTML = wm
    const zone = (cls, tpl, css, placeholder, hidden) => {
      const z = doc.createElement('div')
      z.className = `de-hf ${cls} de-content`
      z.style.cssText = css
      if (hidden) {
        z.dataset.hidden = ''
        return z
      }
      z.innerHTML = fillFields(tpl, shown(i), lastShown)
      if (editable) {
        z.contentEditable = 'true'
        z.dataset.placeholder = placeholder
        z.setAttribute('aria-label', placeholder)
      }
      return z
    }
    const body = doc.createElement('div')
    body.className = 'de-page-body de-content'
    body.style.cssText = `top:${top}mm;height:${page.height - top - bottom}mm`
    body.append(...els)
    const pageNotes = [...body.querySelectorAll('sup[data-footnote]')].map((s) => s.deNote).filter(Boolean)
    if (pageNotes.length) body.append(notesBox(doc, pageNotes))
    sheet.append(
      zone('de-header', headerTpl, `top:${page.headerDistance}mm`, text.headerPlaceholder ?? '', hideHeader(i + 1)),
      body,
      zone('de-footer', footerTpl, `bottom:${page.footerDistance}mm`, text.footerPlaceholder ?? '', hideFooter(i + 1)),
    )
    if (rulers) {
      const v = rulerTicks(doc, page.height, true)
      v.className = 'de-ruler-v'
      wrap.append(v)
    }
    wrap.append(sheet)
    sheets.append(wrap)
  })
  source.replaceWith(sheets)

  // Nomor halaman di daftar isi: halaman tempat tiap judul berada.
  const headingPages = [...doc.querySelectorAll('.de-page-body')].flatMap((b, i) =>
    [...b.querySelectorAll('h1,h2,h3,h4')].filter((h) => !h.closest('[data-toc]') && h.textContent.trim()).map(() => shown(i)))
  doc.querySelectorAll('.de-toc-page[data-toc-index]').forEach((s) => { s.textContent = headingPages[+s.dataset.tocIndex] ?? '' })

  if (rulers) {
    const h = rulerTicks(doc, page.width, false)
    h.className = 'de-ruler-h'
    doc.body.prepend(h)
  }

  // Edit header/footer langsung di halaman: semua halaman ikut berubah, templat dikirim ke editor.
  if (editable) {
    doc.body.addEventListener('input', (ev) => {
      const zone = ev.target.closest?.('.de-hf')
      if (!zone) return
      const kind = zone.classList.contains('de-header') ? 'header' : 'footer'
      const tpl = readTemplate(zone)
      doc.querySelectorAll(`.de-${kind}`).forEach((z, i) => { if (z !== zone && !('hidden' in z.dataset)) z.innerHTML = fillFields(tpl, shown(i), lastShown) })
      onEdit?.(kind, tpl)
    })
  }
  return total
}

/** Iframe tersembunyi berisi halaman siap cetak; panggil .remove() bila selesai. */
export async function hiddenPagedFrame(content, page, starts) {
  const frame = make('iframe', { title: 'print' })
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0'
  document.body.append(frame)
  await new Promise((resolve) => {
    frame.onload = resolve
    frame.srcdoc = pagedDocument({ ...content, page })
  })
  await paginate(frame.contentDocument, page, { starts })
  return frame
}

/** Indeks node teratas yang memulai tiap halaman, sesuai tata letak pratinjau (dipakai ekspor Word). */
export async function pageStarts(content, page) {
  const starts = []
  ;(await hiddenPagedFrame(content, page, starts)).remove()
  return starts
}

/** Cetak langsung (ekspor PDF) tanpa jendela pratinjau. */
export async function printPaged(content, page) {
  const frame = await hiddenPagedFrame(content, page)
  frame.contentWindow.onafterprint = () => frame.remove()
  frame.contentWindow.focus()
  frame.contentWindow.print()
}

/** HTML statis per halaman (untuk unduhan .html) — tampil & tercetak sama dengan pratinjau. */
export async function pagedHtml(content, page) {
  const frame = await hiddenPagedFrame(content, page)
  const html = `<!doctype html>\n${frame.contentDocument.documentElement.outerHTML}`
  frame.remove()
  return html
}

const field = (label, input) => {
  const l = make('label')
  l.append(make('span', { textContent: label }), input)
  return l
}
const number = (value) => make('input', { type: 'number', min: 0, step: 1, value })

/**
 * Jendela pratinjau cetak.
 * @param {object} o
 * @param {object} o.text  teks bahasa
 * @param {object} o.page  pengaturan awal (hasil normalizePage)
 * @param {() => {html: string, title: string, css?: string}} o.content  isi dokumen terbaru (+ CSS tampilan)
 * @param {(html: string) => string} o.sanitize  pembersih HTML header/footer hasil edit
 * @param {(page) => void} o.onChange  pengaturan berubah (disimpan editor)
 * @param {Array<[string, string]>} [o.themeVars]  variabel warna editor (--de-*)
 * @param {HTMLElement} [o.returnFocus]
 * @returns {() => void} fungsi untuk menutup
 */
export function openPrintPreview({ text, page, content, sanitize, onChange, themeVars = [], returnFocus }) {
  const overlay = make('div', { className: 'de-modal' })
  for (const [k, v] of themeVars) overlay.style.setProperty(k, v)
  const box = make('div', { className: 'de-modal-box' })
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-modal', 'true')
  box.setAttribute('aria-label', text.printPreview)

  let current = page
  const size = make('select')
  for (const [name, [w, h]] of Object.entries(PAPER)) size.append(make('option', { value: name, textContent: `${name} (${w} × ${h} mm)` }))
  size.append(make('option', { value: 'custom', textContent: text.paperCustom }))
  size.value = page.size
  const orientation = make('select')
  orientation.append(make('option', { value: 'portrait', textContent: text.portrait }), make('option', { value: 'landscape', textContent: text.landscape }))
  orientation.value = page.orientation
  const width = number(page.width)
  const height = number(page.height)
  const margins = Object.fromEntries(Object.entries(page.margin).map(([k, v]) => [k, number(v)]))
  const headerDistance = number(page.headerDistance)
  const footerDistance = number(page.footerDistance)
  const watermark = watermarkFields(text, page.watermark, (wm) => {
    current = normalizePage({ ...current, watermark: wm })
    schedule()
  })
  const pageCount = make('small', { className: 'de-page-count' })
  pageCount.setAttribute('aria-live', 'polite')

  const print = make('button', { type: 'button', className: 'de-primary', textContent: text.printNow })
  const close = make('button', { type: 'button', textContent: text.close })
  const actions = make('div', { className: 'de-print-actions' })
  actions.append(close, print)

  const settings = make('div', { className: 'de-print-settings' })
  settings.append(
    make('h2', { textContent: text.printPreview }),
    pageCount,
    field(text.paperSize, size),
    field(text.orientation, orientation),
    field(text.paperWidth, width),
    field(text.paperHeight, height),
    make('h3', { textContent: text.margins }),
    field(text.marginTop, margins.top),
    field(text.marginRight, margins.right),
    field(text.marginBottom, margins.bottom),
    field(text.marginLeft, margins.left),
    make('h3', { textContent: text.headerFooter }),
    field(text.headerDistance, headerDistance),
    field(text.footerDistance, footerDistance),
    make('small', { textContent: text.headerFooterHint }),
    make('h3', { textContent: text.watermarkSection }),
    watermark.element,
    actions,
  )

  const frame = make('iframe', { title: text.printPreview })
  const stage = make('div', { className: 'de-print-stage' })
  stage.append(frame)
  box.append(settings, stage)
  overlay.append(box)

  const read = () => normalizePage({
    ...current,
    size: size.value === 'custom' ? { width: width.value, height: height.value } : size.value,
    orientation: orientation.value,
    margin: Object.fromEntries(Object.entries(margins).map(([k, input]) => [k, input.value])),
    headerDistance: headerDistance.value,
    footerDistance: footerDistance.value,
  })

  let drawing = 0
  async function draw() {
    const id = ++drawing
    const c = content()
    await new Promise((resolve) => {
      frame.onload = resolve
      frame.srcdoc = pagedDocument({ ...c, header: sanitize(current.header), footer: sanitize(current.footer), page: current })
    })
    if (id !== drawing) return // sudah ada gambar ulang yang lebih baru
    const doc = frame.contentDocument
    const total = await paginate(doc, current, {
      editable: true,
      rulers: true,
      text,
      onEdit: (kind, tpl) => {
        current = { ...current, [kind]: tpl }
        onChange(current)
      },
    })
    // Tinggi header/footer bisa berubah setelah diedit -> susun ulang halaman saat selesai mengedit.
    doc.addEventListener('focusout', (ev) => { if (ev.target.closest?.('.de-hf')) schedule() })
    pageCount.textContent = `${total} ${text.pages}`
    // Perkecil agar lembar + penggaris muat di area pratinjau.
    const sheetPx = current.width * MM + 80
    doc.documentElement.style.zoom = String(Math.min(1, frame.clientWidth / sheetPx))
  }

  let timer
  function schedule() {
    clearTimeout(timer)
    timer = setTimeout(() => {
      onChange(current)
      draw()
    }, 200)
  }
  settings.addEventListener('input', (ev) => {
    if (ev.target.closest('.de-wm-fields')) return // ditangani watermarkFields
    if (ev.target === width || ev.target === height) {
      size.value = 'custom'
      orientation.value = +width.value > +height.value ? 'landscape' : 'portrait'
    }
    current = read()
    // tampilkan ukuran akhir (sudah sesuai orientasi), kecuali kolom yang sedang diketik
    if (document.activeElement !== width && document.activeElement !== height) {
      width.value = current.width
      height.value = current.height
    }
    schedule()
  })

  print.onclick = () => {
    frame.contentWindow.focus()
    frame.contentWindow.print()
  }

  const prevOverflow = document.documentElement.style.overflow
  function dismiss() {
    clearTimeout(timer)
    onChange(current)
    overlay.remove()
    document.removeEventListener('keydown', onKey, true)
    document.documentElement.style.overflow = prevOverflow
    returnFocus?.focus()
  }
  function onKey(ev) {
    if (ev.key === 'Escape') {
      ev.preventDefault()
      dismiss()
    }
    if (ev.key === 'Tab') { // fokus tetap di dalam jendela
      const items = [...box.querySelectorAll('select,input,button,iframe')]
      const [first, last] = [items[0], items[items.length - 1]]
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus() }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus() }
    }
  }
  close.onclick = dismiss
  overlay.addEventListener('mousedown', (ev) => ev.target === overlay && dismiss())
  document.addEventListener('keydown', onKey, true)
  document.documentElement.style.overflow = 'hidden'

  document.body.append(overlay)
  draw()
  print.focus()
  return dismiss
}
