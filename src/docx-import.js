// Impor .docx -> { html, page } dengan membaca XML Word langsung (bukan mammoth) agar perataan, warna,
// ukuran huruf, tabel (lebar kolom, sel gabung), header/footer, dan ukuran kertas ikut terbawa.
// Yang tidak didukung editor (indentasi, spasi baris, border tabel, posisi bebas gambar) diabaikan.
import { unzipSync, strFromU8 } from 'fflate'
import { twipToMm, matchPaper } from './page.js'

const kids = (el) => (el ? [...el.childNodes].filter((n) => n.nodeType === 1) : [])
const child = (el, name) => kids(el).find((c) => c.nodeName === name) ?? null
const val = (el, name = 'w:val') => (el && el.hasAttribute(name) ? el.getAttribute(name) : null)
// Atribut on/off Word: <w:b/> = aktif, <w:b w:val="0"/> = mati
const onOff = (el) => (el ? !['0', 'false', 'off'].includes(val(el)) : undefined)
const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const descendants = (el, name) => (el ? [...el.getElementsByTagName(name)] : [])

const HIGHLIGHT = {
  yellow: '#ffff00', green: '#00ff00', cyan: '#00ffff', magenta: '#ff00ff', blue: '#0000ff', red: '#ff0000',
  darkBlue: '#000080', darkCyan: '#008080', darkGreen: '#008000', darkMagenta: '#800080', darkRed: '#800000',
  darkYellow: '#808000', darkGray: '#808080', lightGray: '#c0c0c0', black: '#000000', white: '#ffffff',
}
const JC = { center: 'center', right: 'right', end: 'right', both: 'justify', distribute: 'justify' }
const EDITOR_DEFAULT = { sz: 22, font: 'Calibri' } // ukuran (setengah poin) & huruf bawaan editor
const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', bmp: 'image/bmp', svg: 'image/svg+xml', webp: 'image/webp' }

function toBase64(bytes) {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

// Properti teks (rPr) -> objek sederhana; hanya yang tertulis yang diisi.
function readRunProps(rPr) {
  if (!rPr) return {}
  const p = {}
  const set = (k, v) => { if (v !== undefined && v !== null) p[k] = v }
  set('b', onOff(child(rPr, 'w:b')))
  const va = val(child(rPr, 'w:vertAlign'))
  if (va === 'superscript' || va === 'subscript') p.va = va
  set('i', onOff(child(rPr, 'w:i')))
  const u = child(rPr, 'w:u')
  if (u) p.u = val(u) !== 'none'
  set('strike', onOff(child(rPr, 'w:strike')) || onOff(child(rPr, 'w:dstrike')))
  const color = val(child(rPr, 'w:color'))
  if (color && color !== 'auto') p.color = `#${color.toLowerCase()}`
  set('sz', val(child(rPr, 'w:sz')) && +val(child(rPr, 'w:sz')))
  const fonts = child(rPr, 'w:rFonts')
  set('font', val(fonts, 'w:ascii') ?? val(fonts, 'w:hAnsi'))
  const hl = val(child(rPr, 'w:highlight'))
  if (hl && HIGHLIGHT[hl]) p.bg = HIGHLIGHT[hl]
  const shd = val(child(rPr, 'w:shd'), 'w:fill')
  if (!p.bg && shd && shd !== 'auto' && shd.toLowerCase() !== 'ffffff') p.bg = `#${shd.toLowerCase()}`
  return p
}

function parseStyles(xml) {
  const raw = {}
  for (const s of descendants(xml, 'w:style')) {
    const pPr = child(s, 'w:pPr')
    raw[val(s, 'w:styleId')] = {
      name: (val(child(s, 'w:name')) ?? '').toLowerCase(),
      basedOn: val(child(s, 'w:basedOn')),
      jc: val(child(pPr, 'w:jc')),
      outline: val(child(pPr, 'w:outlineLvl')),
      run: readRunProps(child(s, 'w:rPr')),
    }
  }
  const defaults = readRunProps(child(child(child(xml?.documentElement, 'w:docDefaults'), 'w:rPrDefault'), 'w:rPr'))
  // Gabungkan rantai basedOn (induk dulu, lalu turunan).
  const cache = {}
  const resolve = (id, depth = 0) => {
    if (!id || !raw[id] || depth > 20) return { run: {} }
    if (cache[id]) return cache[id]
    const s = raw[id]
    const parent = resolve(s.basedOn, depth + 1)
    const heading = /^heading (\d)$/.exec(s.name)?.[1] ?? (s.name === 'title' ? '1' : s.outline != null && +s.outline < 6 ? String(+s.outline + 1) : null)
    return (cache[id] = { jc: s.jc ?? parent.jc, heading: heading ? +heading : parent.heading, run: { ...parent.run, ...s.run } })
  }
  const defaultPara = Object.keys(raw).find((id) => descendants(xml, 'w:style').some((s) => val(s, 'w:styleId') === id && val(s, 'w:default') === '1' && val(s, 'w:type') === 'paragraph'))
  return { resolve, defaults, defaultPara }
}

// numId -> (ilvl -> 'ul' | 'ol')
function parseNumbering(xml) {
  const abstract = {}
  for (const a of descendants(xml, 'w:abstractNum')) {
    abstract[val(a, 'w:abstractNumId')] = Object.fromEntries(
      kids(a).filter((l) => l.nodeName === 'w:lvl').map((l) => [val(l, 'w:ilvl'), val(child(l, 'w:numFmt')) === 'bullet' ? 'ul' : 'ol']),
    )
  }
  const nums = {}
  for (const n of descendants(xml, 'w:num')) nums[val(n, 'w:numId')] = abstract[val(child(n, 'w:abstractNumId'))] ?? {}
  return (numId, ilvl) => nums[numId]?.[ilvl] ?? 'ul'
}

function parseRels(xml) {
  const map = {}
  for (const r of descendants(xml, 'Relationship')) map[r.getAttribute('Id')] = { target: r.getAttribute('Target'), external: r.getAttribute('TargetMode') === 'External' }
  return map
}

function imageHtml(drawing, ctx) {
  // Gambar mengambang di belakang teks = watermark (mis. hasil ekspor editor ini), bukan isi dokumen.
  const anchor = descendants(drawing, 'wp:anchor')[0]
  if (anchor && anchor.getAttribute('behindDoc') === '1') {
    const docPr = descendants(drawing, 'wp:docPr')[0]
    if (docPr?.getAttribute('name') === 'Watermark' && docPr.getAttribute('descr')) ctx.found.watermark ??= { text: docPr.getAttribute('descr') }
    return ''
  }
  const blip = descendants(drawing, 'a:blip')[0]
  const rel = ctx.rels[blip?.getAttribute('r:embed')]
  if (!rel) return ''
  const path = rel.target.startsWith('/') ? rel.target.slice(1) : `word/${rel.target.replace(/^\.\//, '')}`
  const bytes = ctx.files[path]
  if (!bytes) return ''
  const ext = path.split('.').pop().toLowerCase()
  if (!MIME[ext]) return '' // mis. EMF/WMF tidak bisa ditampilkan browser
  const extent = descendants(drawing, 'wp:extent')[0]
  const width = extent ? Math.round(+extent.getAttribute('cx') / 9525) : null // EMU -> px
  const alt = descendants(drawing, 'wp:docPr')[0]?.getAttribute('descr') ?? ''
  return `<img src="data:${MIME[ext]};base64,${toBase64(bytes)}"${width ? ` width="${width}"` : ''}${alt ? ` alt="${escapeHtml(alt)}"` : ''}>`
}

// Ubah satu run (atau isinya) menjadi HTML; field PAGE/NUMPAGES -> {page}/{pages}.
function runsHtml(nodes, ctx, para) {
  let out = ''
  for (const n of nodes) {
    switch (n.nodeName) {
      case 'w:r': out += runHtml(n, ctx, para); break
      case 'w:hyperlink': {
        const rel = ctx.rels[n.getAttribute('r:id')]
        const inner = runsHtml(kids(n), ctx, para)
        out += rel?.external ? `<a href="${escapeHtml(rel.target)}">${inner}</a>` : inner
        break
      }
      case 'w:fldSimple': {
        const instr = (n.getAttribute('w:instr') ?? '').trim().split(/\s+/)[0].toUpperCase()
        out += instr === 'PAGE' ? '{page}' : instr === 'NUMPAGES' ? '{pages}' : runsHtml(kids(n), ctx, para)
        break
      }
      case 'w:ins': case 'w:smartTag': case 'w:customXml': out += runsHtml(kids(n), ctx, para); break
      case 'w:sdt': out += runsHtml(kids(child(n, 'w:sdtContent')), ctx, para); break
      default: break // w:del, bookmark, proofErr, dll.
    }
  }
  return out
}

function runHtml(r, ctx, para) {
  let text = ''
  let notes = '' // catatan kaki dipasang di luar format run (gaya FootnoteReference sudah superskrip)
  for (const c of kids(r)) {
    const field = para.field
    switch (c.nodeName) {
      case 'w:fldChar': {
        const type = c.getAttribute('w:fldCharType')
        if (type === 'begin') para.field = { instr: '', skip: false }
        else if (type === 'separate' && field) {
          const name = field.instr.trim().split(/\s+/)[0].toUpperCase()
          if (name === 'PAGE' || name === 'NUMPAGES') {
            text += escapeHtml(name === 'PAGE' ? '{page}' : '{pages}')
            field.skip = true // hasil cache field tidak dipakai
          }
        } else if (type === 'end') para.field = null
        break
      }
      case 'w:instrText': if (field) field.instr += c.textContent; break
      case 'w:t': if (!field?.skip) text += escapeHtml(c.textContent); break
      case 'w:tab': if (!field?.skip) text += '&emsp;'; break
      case 'w:br': case 'w:cr':
        if (c.getAttribute('w:type') === 'page') para.pageBreak = text || para.hasText ? 'after' : 'before'
        else text += '<br>'
        break
      case 'w:noBreakHyphen': text += '-'; break
      case 'w:footnoteReference': {
        const note = ctx.footnotes.get(c.getAttribute('w:id'))
        if (note != null) notes += `<sup data-footnote="${escapeHtml(note)}"></sup>`
        break
      }
      case 'w:drawing': case 'w:pict': case 'mc:AlternateContent': {
        // Watermark asli Word: bentuk VML berisi teks (v:textpath).
        const textpath = descendants(c, 'v:textpath')[0]
        if (textpath?.getAttribute('string')) {
          ctx.found.watermark ??= { text: textpath.getAttribute('string') }
          break
        }
        const drawing = c.nodeName === 'mc:AlternateContent' ? child(c, 'mc:Choice') ?? c : c
        para.images.push(imageHtml(drawing, ctx))
        // Isi text box ikut sebagai paragraf setelahnya.
        for (const box of descendants(drawing, 'w:txbxContent').slice(0, 1)) para.after.push(blocksHtml(kids(box), ctx))
        break
      }
      default: break
    }
  }
  if (!text) return notes
  para.hasText = true
  const p = { ...ctx.styles.defaults, ...(para.heading ? {} : para.styleRun), ...ctx.styles.resolve(val(child(child(r, 'w:rPr'), 'w:rStyle'))).run, ...readRunProps(child(r, 'w:rPr')) }
  const css = []
  if (p.color) css.push(`color: ${p.color}`)
  if (p.sz && p.sz !== EDITOR_DEFAULT.sz && !para.heading) css.push(`font-size: ${p.sz / 2}pt`)
  if (p.font && p.font !== EDITOR_DEFAULT.font) css.push(`font-family: ${p.font.includes(' ') ? `'${p.font}'` : p.font}`)
  if (p.bg) css.push(`background-color: ${p.bg}`)
  if (css.length) text = `<span style="${css.join('; ')}">${text}</span>`
  if (p.va === 'superscript') text = `<sup>${text}</sup>`
  if (p.va === 'subscript') text = `<sub>${text}</sub>`
  if (p.strike) text = `<s>${text}</s>`
  if (p.u) text = `<u>${text}</u>`
  if (p.i) text = `<em>${text}</em>`
  if (p.b && !para.heading) text = `<strong>${text}</strong>`
  return text + notes
}

function paragraphHtml(pEl, ctx) {
  const pPr = child(pEl, 'w:pPr')
  const style = ctx.styles.resolve(val(child(pPr, 'w:pStyle')) ?? ctx.styles.defaultPara)
  const para = { heading: style.heading && style.heading <= 6 ? style.heading : null, styleRun: style.run, images: [], after: [], field: null }
  const inner = runsHtml(kids(pEl), ctx, para)
  const align = JC[val(child(pPr, 'w:jc')) ?? style.jc]
  const tag = para.heading ? `h${para.heading}` : 'p'
  const css = []
  if (align) css.push(`text-align: ${align}`)
  // Indentasi kiri (kelipatan 0,5 inci) & spasi baris "auto" (240 = 1 baris); daftar memakai indentasi sendiri.
  const ind = child(pPr, 'w:ind')
  const left = +(val(ind, 'w:left') ?? val(ind, 'w:start') ?? 0)
  if (left >= 360 && !child(pPr, 'w:numPr')) css.push(`margin-left: ${Math.min(8, Math.round(left / 720)) * 36}pt`)
  const spacing = child(pPr, 'w:spacing')
  if (spacing && val(spacing, 'w:line') && (val(spacing, 'w:lineRule') ?? 'auto') === 'auto') {
    const lh = Math.round((+val(spacing, 'w:line') / 240) * 100) / 100
    if (Math.abs(lh - 1.5) > 0.05) css.push(`line-height: ${lh}`)
  }
  const dir = onOff(child(pPr, 'w:bidi')) ? ' dir="rtl"' : ''
  const attrs = (css.length ? ` style="${css.join('; ')}"` : '') + dir
  const breakBefore = onOff(child(pPr, 'w:pageBreakBefore')) || para.pageBreak === 'before' ? '<div data-page-break></div>' : ''
  const breakAfter = para.pageBreak === 'after' ? '<div data-page-break></div>' : ''
  // Paragraf yang hanya berisi gambar tidak menghasilkan paragraf kosong tambahan.
  // Paragraf yang hanya berisi pemisah halaman tidak meninggalkan paragraf kosong.
  const body = inner || para.images.length || !para.pageBreak ? (inner || !para.images.length ? `<${tag}${attrs}>${inner}</${tag}>` : '') : ''
  const html = breakBefore + body + para.images.join('') + para.after.join('') + breakAfter
  const numPr = child(pPr, 'w:numPr')
  const numId = val(child(numPr, 'w:numId'))
  if (numPr && numId && numId !== '0') {
    const level = +(val(child(numPr, 'w:ilvl')) ?? 0)
    return { list: true, level, tag: ctx.numbering(numId, String(level)), html }
  }
  return { html }
}

function tableHtml(tbl, ctx) {
  const grid = kids(child(tbl, 'w:tblGrid')).map((g) => Math.round(+(g.getAttribute('w:w') ?? 0) / 15)) // twip -> px
  const rows = []
  const owners = {} // kolom -> sel awal sel-gabung vertikal
  for (const tr of kids(tbl).filter((n) => n.nodeName === 'w:tr')) {
    const header = onOff(child(child(tr, 'w:trPr'), 'w:tblHeader')) === true
    const cells = []
    let col = +(val(child(child(tr, 'w:trPr'), 'w:gridBefore')) ?? 0)
    for (const tc of kids(tr).filter((n) => n.nodeName === 'w:tc')) {
      const tcPr = child(tc, 'w:tcPr')
      const span = +(val(child(tcPr, 'w:gridSpan')) ?? 1)
      const vMerge = child(tcPr, 'w:vMerge')
      if (vMerge && val(vMerge) !== 'restart') {
        if (owners[col]) owners[col].rowspan++
        col += span
        continue
      }
      const cell = {
        tag: header ? 'th' : 'td',
        rowspan: 1,
        span,
        valign: { center: 'middle', bottom: 'bottom' }[val(child(tcPr, 'w:vAlign'))],
        widths: grid.slice(col, col + span).filter(Boolean),
        html: blocksHtml(kids(tc).filter((n) => n.nodeName !== 'w:tcPr'), ctx) || '<p></p>',
      }
      if (vMerge) owners[col] = cell
      else delete owners[col]
      cells.push(cell)
      col += span
    }
    rows.push(cells)
  }
  const body = rows.map((cells) => `<tr>${cells.map((c) => {
    const attrs = [
      c.span > 1 ? ` colspan="${c.span}"` : '',
      c.rowspan > 1 ? ` rowspan="${c.rowspan}"` : '',
      c.widths.length === c.span ? ` colwidth="${c.widths.join(',')}"` : '',
      c.valign ? ` style="vertical-align: ${c.valign}"` : '',
    ].join('')
    return `<${c.tag}${attrs}>${c.html}</${c.tag}>`
  }).join('')}</tr>`).join('')
  return `<table><tbody>${body}</tbody></table>`
}

// Paragraf daftar berurutan -> <ul>/<ol> bertingkat.
function blocksHtml(nodes, ctx) {
  const items = []
  for (const n of nodes) {
    if (n.nodeName === 'w:p') items.push(paragraphHtml(n, ctx))
    else if (n.nodeName === 'w:tbl') items.push({ html: tableHtml(n, ctx) })
    else if (n.nodeName === 'w:sdt') items.push({ html: blocksHtml(kids(child(n, 'w:sdtContent')), ctx) })
  }
  let out = ''
  const stack = [] // tag daftar yang sedang terbuka (indeks = level)
  const closeTo = (len) => { while (stack.length > len) out += `</li></${stack.pop()}>` }
  for (const it of items) {
    if (!it.list) {
      closeTo(0)
      out += it.html
      continue
    }
    closeTo(it.level + 1)
    if (stack.length === it.level + 1 && stack[it.level] !== it.tag) closeTo(it.level)
    if (stack.length === it.level + 1) out += `</li><li>${it.html}`
    else {
      while (stack.length < it.level + 1) {
        out += `<${it.tag}><li>`
        stack.push(it.tag)
      }
      out += it.html
    }
  }
  closeTo(0)
  return out
}

function partHtml(relId, ctx) {
  const rel = ctx.rels[relId]
  if (!rel) return ''
  const path = `word/${rel.target.replace(/^\.\//, '')}`
  const xml = ctx.read(path)
  if (!xml) return ''
  const relsPath = path.replace(/([^/]+)$/, '_rels/$1.rels')
  // Header/footer punya relasi (gambar) sendiri.
  return blocksHtml(kids(xml.documentElement), { ...ctx, rels: parseRels(ctx.read(relsPath)) })
}

function sectionToPage(sect, ctx) {
  const pgSz = child(sect, 'w:pgSz')
  const pgMar = child(sect, 'w:pgMar')
  const mm = (el, name) => (el && el.hasAttribute(name) ? twipToMm(Math.abs(+el.getAttribute(name))) : undefined)
  const width = mm(pgSz, 'w:w') ?? 210
  const height = mm(pgSz, 'w:h') ?? 297
  const named = matchPaper(width, height)
  const ref = (name) => {
    const refs = kids(sect).filter((n) => n.nodeName === name)
    return (refs.find((r) => r.getAttribute('w:type') === 'default') ?? refs[0])?.getAttribute('r:id')
  }
  const header = partHtml(ref('w:headerReference'), ctx)
  const footer = partHtml(ref('w:footerReference'), ctx)
  return {
    size: named ?? { width, height },
    orientation: width > height ? 'landscape' : 'portrait',
    margin: { top: mm(pgMar, 'w:top') ?? 25.4, right: mm(pgMar, 'w:right') ?? 25.4, bottom: mm(pgMar, 'w:bottom') ?? 25.4, left: mm(pgMar, 'w:left') ?? 25.4 },
    headerDistance: mm(pgMar, 'w:header'),
    footerDistance: mm(pgMar, 'w:footer'),
    header,
    footer,
    watermark: ctx.found.watermark ?? null,
  }
}

/**
 * @param {ArrayBuffer|Uint8Array} data  isi file .docx
 * @param {{parseXml?: (xml: string) => Document}} [opts]  default DOMParser browser (di Node: @xmldom/xmldom)
 * @returns {{ html: string, page: object }}
 */
export function docxToHtml(data, { parseXml = (s) => new DOMParser().parseFromString(s, 'application/xml') } = {}) {
  const files = unzipSync(data instanceof Uint8Array ? data : new Uint8Array(data))
  const read = (path) => (files[path] ? parseXml(strFromU8(files[path])) : null)
  const doc = read('word/document.xml')
  if (!doc) throw new Error('Bukan file .docx yang valid (word/document.xml tidak ada)')
  const ctx = {
    files,
    read,
    rels: parseRels(read('word/_rels/document.xml.rels')),
    styles: parseStyles(read('word/styles.xml')),
    numbering: parseNumbering(read('word/numbering.xml')),
    found: {}, // temuan lintas bagian (mis. watermark di header)
    // id -> teks polos catatan kaki (paragraf digabung spasi)
    footnotes: new Map(descendants(read('word/footnotes.xml')?.documentElement, 'w:footnote').map((n) =>
      [n.getAttribute('w:id'), kids(n).map((p) => descendants(p, 'w:t').map((t) => t.textContent).join('')).join(' ').trim()])),
  }
  const body = child(doc.documentElement, 'w:body')
  const sect = child(body, 'w:sectPr')
  return { html: blocksHtml(kids(body), ctx), page: sect ? sectionToPage(sect, ctx) : undefined }
}
