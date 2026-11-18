// Konversi JSON Tiptap -> dokumen Word (.docx) dengan library `docx`.
// Node yang tidak dikenal dilewati; tambahkan case baru di `block()` bila menambah fitur editor.
import {
  Document, Paragraph, TextRun, ExternalHyperlink, ImageRun, Table, TableRow, TableCell, Header, Footer, PageNumber, PageBreak, TableOfContents,
  WidthType, HeadingLevel, AlignmentType, LevelFormat, BorderStyle, ShadingType, VerticalAlign, PageOrientation,
  HorizontalPositionRelativeFrom, VerticalPositionRelativeFrom, HorizontalPositionAlign, VerticalPositionAlign, TextWrappingType,
  FootnoteReferenceRun, Math as OMath, MathRun, MathFraction, MathRadical, MathSuperScript, MathSubScript, MathSubSuperScript,
  MathSum, MathIntegral, MathLimitLower, MathLimitUpper,
} from 'docx'
import { normalizePage, mmToTwip, pageMatcher } from './page.js'
import { renderMath } from './media.js'

const MONO = 'Courier New'
const VALIGN = { top: VerticalAlign.TOP, middle: VerticalAlign.CENTER, bottom: VerticalAlign.BOTTOM }
const ALIGN = { left: AlignmentType.LEFT, center: AlignmentType.CENTER, right: AlignmentType.RIGHT, justify: AlignmentType.JUSTIFIED }
const HEADING = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6]
const HEADING_PT = [20, 16, 13, 12, 11, 11]
const GREY = (fill) => ({ type: ShadingType.CLEAR, color: 'auto', fill })
const PX_TO_TWIP = 15 // 1px (96dpi) = 15 twip

/** '#ff0000' | '#f00' | 'rgb(255, 0, 0)' -> 'FF0000'; lainnya undefined. */
export function cssColorToHex(value) {
  if (!value) return undefined
  const v = String(value).trim()
  let m = v.match(/^#([0-9a-f]{6})$/i)
  if (m) return m[1].toUpperCase()
  m = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i)
  if (m) return (m[1] + m[1] + m[2] + m[2] + m[3] + m[3]).toUpperCase()
  m = v.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i)
  if (m) return m.slice(1, 4).map((n) => (+n).toString(16).padStart(2, '0')).join('').toUpperCase()
  return undefined
}

/** '14pt' | '18px' -> setengah-poin untuk Word; lainnya undefined. */
export function cssSizeToHalfPoints(value) {
  const m = String(value ?? '').match(/^([\d.]+)\s*(pt|px)$/i)
  if (!m) return undefined
  const pt = m[2].toLowerCase() === 'pt' ? +m[1] : (+m[1] * 72) / 96
  return Math.round(pt * 2)
}

// "{page}" / "{pages}" di header/footer -> kolom nomor halaman Word.
function withPageFields(text) {
  const parts = text.split(/(\{page\}|\{pages\})/)
  return parts.filter(Boolean).map((p) => (p === '{page}' ? PageNumber.CURRENT : p === '{pages}' ? PageNumber.TOTAL_PAGES : p))
}

// MathML (dari temml) -> rumus Word (OMML) lewat kelas Math* library docx.
const NARY = { '∑': MathSum, '∫': MathIntegral }
const elements = (el) => [...(el?.childNodes ?? [])].filter((n) => n.nodeType === 1)
function omml(list) {
  const out = []
  for (let i = 0; i < list.length; i++) {
    const el = list[i]
    if (!el) continue
    const [a, b, c] = elements(el)
    const name = el.localName ?? el.nodeName
    const Nary = /^(msub|msup|msubsup|munder|mover|munderover)$/.test(name) && NARY[a?.textContent.trim()]
    if (Nary) { // ∑/∫ dengan batas: sisa ekspresi menjadi isinya
      const two = /subsup|underover/.test(name)
      out.push(new Nary({
        children: omml(list.slice(i + 1)),
        subScript: /sub|under/.test(name) ? omml([b]) : undefined,
        superScript: two ? omml([c]) : /sup|over/.test(name) ? omml([b]) : undefined,
      }))
      break
    }
    switch (name) {
      case 'mi': case 'mn': case 'mo': case 'mtext': case 'ms': out.push(new MathRun(el.textContent)); break
      case 'mfrac': out.push(new MathFraction({ numerator: omml([a]), denominator: omml([b]) })); break
      case 'msqrt': out.push(new MathRadical({ children: omml(elements(el)) })); break
      case 'mroot': out.push(new MathRadical({ children: omml([a]), degree: omml([b]) })); break
      case 'msup': out.push(new MathSuperScript({ children: omml([a]), superScript: omml([b]) })); break
      case 'msub': out.push(new MathSubScript({ children: omml([a]), subScript: omml([b]) })); break
      case 'msubsup': out.push(new MathSubSuperScript({ children: omml([a]), subScript: omml([b]), superScript: omml([c]) })); break
      case 'munder': out.push(new MathLimitLower({ children: omml([a]), limit: omml([b]) })); break
      case 'mover': out.push(new MathLimitUpper({ children: omml([a]), limit: omml([b]) })); break
      case 'munderover': out.push(new MathLimitUpper({ children: [new MathLimitLower({ children: omml([a]), limit: omml([b]) })], limit: omml([c]) })); break
      // shortcut: matriks ditulis baris "a, b; c, d" (library docx belum punya matriks); upgrade bila matriks sering dipakai.
      case 'mtable': out.push(new MathRun(elements(el).map((r) => elements(r).map((d) => d.textContent).join(', ')).join('; '))); break
      case 'annotation': case 'annotation-xml': case 'mspace': case 'mphantom': break
      default: out.push(...omml(elements(el))) // math, semantics, mrow, mstyle, mpadded, …
    }
  }
  return out
}
function mathRuns(latex) {
  if (typeof DOMParser === 'undefined') return [new MathRun(latex)]
  const doc = new DOMParser().parseFromString(renderMath(latex), 'application/xml')
  if (doc.getElementsByTagName('parsererror').length) return [new MathRun(latex)]
  const runs = omml([doc.documentElement])
  return runs.length ? runs : [new MathRun(latex)]
}

function inline(nodes = [], ctx, strong) {
  return nodes.flatMap((n) => {
    if (n.type === 'hardBreak') return [new TextRun({ break: 1 })]
    if (n.type === 'math') return [new OMath({ children: mathRuns(n.attrs?.latex ?? '') })]
    if (n.type === 'footnote') { // footnote asli Word (tidak berlaku di header/footer)
      if (ctx.pageFields) return []
      const id = Object.keys(ctx.footnotes).length + 1
      ctx.footnotes[id] = { children: [new Paragraph(n.attrs?.text ?? '')] }
      return [new FootnoteReferenceRun(id)]
    }
    if (n.type !== 'text') return []
    const m = Object.fromEntries((n.marks ?? []).map((k) => [k.type, k.attrs ?? {}]))
    const style = m.textStyle ?? {}
    const background = cssColorToHex(style.backgroundColor)
    // undefined (bukan false) agar tidak menimpa gaya heading/tabel
    const props = {
      bold: m.bold || strong ? true : undefined,
      italics: m.italic ? true : undefined,
      strike: m.strike ? true : undefined,
      superScript: m.superscript ? true : undefined,
      subScript: m.subscript ? true : undefined,
      underline: m.underline ? {} : undefined,
      font: m.code ? MONO : style.fontFamily ? style.fontFamily.split(',')[0].replace(/["']/g, '').trim() : undefined,
      color: cssColorToHex(style.color),
      size: cssSizeToHalfPoints(style.fontSize),
      shading: background ? { type: ShadingType.CLEAR, color: 'auto', fill: background } : undefined,
      style: m.link ? 'Hyperlink' : undefined,
    }
    const run = ctx.pageFields && /\{pages?\}/.test(n.text)
      ? new TextRun({ ...props, children: withPageFields(n.text) })
      : new TextRun({ ...props, text: n.text })
    return m.link ? [new ExternalHyperlink({ link: m.link.href, children: [run] })] : [run]
  })
}

async function blocks(nodes = [], ctx, o = {}) {
  const out = []
  for (const n of nodes) out.push(...(await block(n, ctx, o)))
  return out
}

async function block(n, ctx, o) {
  const a = n.attrs ?? {}
  // Indentasi (tingkat 0,5 inci), spasi baris (kelipatan), arah kanan-ke-kiri.
  const left = (o.indent?.left ?? 0) + (a.indent ? a.indent * 720 : 0)
  const p = (children, extra) => new Paragraph({
    children,
    alignment: ALIGN[a.textAlign],
    indent: o.numbering ? undefined : left ? { ...o.indent, left } : o.indent,
    spacing: a.lineHeight ? { line: Math.round(240 * a.lineHeight) } : undefined,
    bidirectional: a.dir === 'rtl' || undefined,
    ...extra,
  })

  switch (n.type) {
    case 'paragraph':
      return [p(inline(n.content, ctx, o.strong), o.numbering && { numbering: o.numbering })]

    case 'heading':
      return [p(inline(n.content, ctx), { heading: HEADING[(n.attrs?.level ?? 1) - 1] })]

    case 'blockquote':
      return blocks(n.content, ctx, { ...o, indent: { left: (o.indent?.left ?? 0) + 720 } })

    case 'bulletList':
    case 'orderedList': {
      const level = Math.min(o.listLevel ?? 0, 8)
      const reference = n.type === 'bulletList' ? 'bullet' : 'ordered'
      const instance = ++ctx.listInstance // tiap daftar bernomor mulai lagi dari 1
      const sub = { listLevel: level + 1, indent: { left: 720 * (level + 1) } }
      const out = []
      for (const item of n.content ?? []) {
        const [first, ...rest] = item.content ?? []
        if (first?.type === 'paragraph') out.push(...(await block(first, ctx, { numbering: { reference, level, instance } })))
        else if (first) out.push(...(await block(first, ctx, sub)))
        out.push(...(await blocks(rest, ctx, sub)))
      }
      return out
    }

    case 'codeBlock': {
      const lines = (n.content ?? []).map((t) => t.text).join('').split('\n')
      return [p(lines.map((text, i) => new TextRun({ text, font: MONO, break: i ? 1 : undefined })), { shading: GREY('F4F4F4') })]
    }

    case 'tableOfContents':
      // Daftar isi asli Word (judul 1-4 + nomor halaman), diperbarui Word saat dokumen dibuka.
      ctx.hasToc = true
      return [new Paragraph({ children: [new TextRun({ text: ctx.tocTitle, bold: true })] }), new TableOfContents(ctx.tocTitle, { hyperlink: true, headingStyleRange: '1-4' })]

    case 'pageBreak':
      return [new Paragraph({ children: [new PageBreak()] })]

    case 'video': { // Word tidak memutar video: ditulis sebagai tautan
      const src = n.attrs?.src ?? ''
      const label = `▶ ${ctx.videoLabel}`
      return [p(/^https?:/i.test(src)
        ? [new ExternalHyperlink({ link: src, children: [new TextRun({ text: `${label}: ${src}`, style: 'Hyperlink' })] })]
        : [new TextRun({ text: label, italics: true })])]
    }

    case 'taskList': {
      // Word tidak punya kotak centang biasa: ditulis sebagai ☐ / ☒ di awal paragraf.
      const level = o.listLevel ?? 0
      const out = []
      for (const item of n.content ?? []) {
        const [first, ...rest] = item.content ?? []
        const sub = { listLevel: level + 1, indent: { left: 720 * (level + 1) } }
        if (first?.type === 'paragraph') {
          out.push(new Paragraph({
            children: [new TextRun({ text: item.attrs?.checked ? '☒ ' : '☐ ' }), ...inline(first.content, ctx)],
            alignment: ALIGN[first.attrs?.textAlign],
            indent: { left: 720 * level + 360, hanging: 360 },
          }))
        } else if (first) out.push(...(await block(first, ctx, sub)))
        out.push(...(await blocks(rest, ctx, sub)))
      }
      return out
    }

    case 'horizontalRule':
      return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } } })]

    case 'image': {
      let img = null
      try { img = await ctx.loadImage(n.attrs.src) } catch { /* gambar gagal dimuat -> placeholder */ }
      if (!img) return [p([new TextRun({ text: `[${ctx.imageMissing}${n.attrs?.alt ? `: ${n.attrs.alt}` : ''}]`, italics: true })])]
      // Lebar yang diatur di editor (atribut width, px) diutamakan; tidak melebihi lebar area teks.
      const wanted = +n.attrs?.width || img.width
      const width = Math.min(wanted, Math.floor(ctx.textWidth / PX_TO_TWIP))
      return [p([new ImageRun({
        type: 'png',
        data: img.data,
        transformation: { width: Math.round(width), height: Math.round((img.height * width) / img.width) },
        altText: n.attrs?.alt ? { name: n.attrs.alt, description: n.attrs.alt, title: n.attrs.alt } : undefined,
      })])]
    }

    case 'table': {
      const rows = n.content ?? []
      const cols = Math.max(1, ...rows.map((r) => (r.content ?? []).reduce((s, c) => s + (c.attrs?.colspan ?? 1), 0)))
      const widths = columnWidths(rows, cols, ctx.textWidth)
      const out = []
      for (const r of rows) {
        const cells = []
        let col = 0
        for (const c of r.content ?? []) {
          const header = c.type === 'tableHeader'
          const span = c.attrs?.colspan ?? 1
          const children = await blocks(c.content, ctx, { strong: header })
          cells.push(new TableCell({
            children: children.length ? children : [new Paragraph('')], // Word wajib minimal 1 paragraf per sel
            columnSpan: c.attrs?.colspan,
            verticalAlign: VALIGN[c.attrs?.verticalAlign],
            rowSpan: c.attrs?.rowspan,
            shading: header ? GREY('F0F0F0') : undefined,
            width: { size: widths.slice(col, col + span).reduce((a, b) => a + b, 0), type: WidthType.DXA },
          }))
          col += span
        }
        // tableHeader: false tetap dianggap header oleh sebagian pembaca (mis. mammoth), jadi hanya diisi bila true
        out.push(new TableRow({ children: cells, tableHeader: (r.content ?? []).every((c) => c.type === 'tableHeader') || undefined }))
      }
      return [new Table({ rows: out, width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA }, columnWidths: widths })]
    }

    default:
      return []
  }
}

// Lebar kolom (twip): dari colwidth sel (px) bila diatur di editor, sisanya dibagi rata; diperkecil bila melebihi halaman.
function columnWidths(rows, cols, textWidth) {
  const px = Array(cols).fill(null)
  for (const r of rows) {
    let col = 0
    for (const c of r.content ?? []) {
      const span = c.attrs?.colspan ?? 1
      ;(c.attrs?.colwidth ?? []).forEach((w, i) => { if (w && px[col + i] == null) px[col + i] = w })
      col += span
    }
  }
  const known = px.filter((w) => w != null)
  if (!known.length) return Array(cols).fill(Math.floor(textWidth / cols))
  const rest = cols - known.length
  const knownTwip = known.reduce((a, b) => a + b, 0) * PX_TO_TWIP
  const fill = rest ? Math.max(Math.floor((textWidth - knownTwip) / rest), 600) : 0
  const widths = px.map((w) => (w != null ? w * PX_TO_TWIP : fill))
  const total = widths.reduce((a, b) => a + b, 0)
  return total > textWidth ? widths.map((w) => Math.floor((w * textWidth) / total)) : widths.map(Math.round)
}

const listLevels = (format, text) => Array.from({ length: 9 }, (_, level) => ({
  level,
  format,
  text: text(level),
  alignment: AlignmentType.LEFT,
  style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
}))

// Watermark = gambar PNG di header, di tengah halaman, di belakang teks.
// Nama 'Watermark' + teks di deskripsi agar bisa dikenali lagi saat file diimpor.
const watermarkParagraph = (img) => new Paragraph({
  children: [new ImageRun({
    type: 'png',
    data: img.data,
    transformation: { width: img.width, height: img.height },
    altText: { name: 'Watermark', description: img.text ?? '', title: 'Watermark' },
    floating: {
      horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, align: HorizontalPositionAlign.CENTER },
      verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, align: VerticalPositionAlign.CENTER },
      behindDocument: true,
      allowOverlap: true,
      wrap: { type: TextWrappingType.NONE },
    },
  })],
})

/**
 * @param {object} json  hasil editor.getJSON()
 * @param {object} [opts]
 * @param {(src: string) => Promise<{data: Uint8Array, width: number, height: number}>} [opts.loadImage]
 *        harus mengembalikan PNG; bila gagal/absen, gambar diganti teks placeholder.
 * @param {string} [opts.imageMissing]  teks placeholder gambar
 * @param {object} [opts.page]  kertas, margin, jarak header/footer (lihat normalizePage di page.js)
 * @param {object} [opts.header]  JSON Tiptap isi header ({page}/{pages} = nomor halaman)
 * @param {object} [opts.footer]  JSON Tiptap isi footer
 * @param {{data: Uint8Array, width: number, height: number, text?: string}} [opts.watermarkImage]  PNG watermark (px)
 * @param {Array<number|undefined>} [opts.pageStarts]  indeks node teratas yang memulai tiap halaman (dari tata letak
 *        pratinjau). Bila ada, header/footer bisa dikecualikan di halaman mana pun lewat section Word;
 *        tanpa ini hanya halaman 1 yang bisa dikecualikan.
 */
export async function buildDocx(json, { loadImage, imageMissing = 'gambar tidak dapat dimuat', page, header, footer, watermarkImage, tocTitle = 'Daftar Isi', videoLabel = 'Video', pageStarts } = {}) {
  const pg = normalizePage(page)
  const twip = { width: mmToTwip(pg.width), height: mmToTwip(pg.height), ...Object.fromEntries(Object.entries(pg.margin).map(([k, v]) => [k, mmToTwip(v)])) }
  const textWidth = twip.width - twip.left - twip.right
  const landscape = pg.orientation === 'landscape'
  const ctx = { loadImage, imageMissing, textWidth, listInstance: 0, tocTitle, videoLabel, footnotes: {} }
  const nodes = json?.content ?? []
  const perNode = []
  for (const n of nodes) perNode.push(await block(n, ctx, {}))
  const fieldsCtx = { ...ctx, pageFields: true }
  const hdr = async (hidden) => {
    const c = [...(watermarkImage ? [watermarkParagraph(watermarkImage)] : []), ...(!hidden && header ? await blocks(header.content, fieldsCtx) : [])]
    return new Header({ children: c.length ? c : [new Paragraph('')] })
  }
  const ftr = async (hidden) => {
    const c = !hidden && footer ? await blocks(footer.content, fieldsCtx) : []
    return new Footer({ children: c.length ? c : [new Paragraph('')] })
  }
  const hideH = pageMatcher(pg.hideHeaderOn)
  const hideF = pageMatcher(pg.hideFooterOn)
  // Halaman berurutan dengan status header/footer sama = satu section Word (section baru = halaman baru).
  const layout = pageStarts?.length > 0
  const groups = []
  ;(layout ? pageStarts : [0]).forEach((start, i) => {
    const h = layout && hideH(i + 1)
    const f = layout && hideF(i + 1)
    const last = groups.at(-1)
    if (last && (start == null || start <= last.start || (last.h === h && last.f === f))) return
    groups.push({ start: last ? start : 0, h, f })
  })
  // Tanpa tata letak: hanya halaman pertama yang bisa dibedakan (titlePage).
  const firstH = !layout && hideH(1)
  const firstF = !layout && hideF(1)
  const titlePage = firstH || firstF
  const sections = []
  for (const [gi, g] of groups.entries()) {
    let end = groups[gi + 1]?.start ?? nodes.length
    if (groups[gi + 1]) while (end > g.start && nodes[end - 1]?.type === 'pageBreak') end-- // pergantian section sudah = halaman baru
    const kids = perNode.slice(g.start, end).flat()
    sections.push({
      properties: {
        titlePage: (gi === 0 && titlePage) || undefined,
        page: {
          pageNumbers: gi === 0 && pg.firstPageNumber !== 1 ? { start: pg.firstPageNumber } : undefined,
          size: landscape
            ? { width: twip.height, height: twip.width, orientation: PageOrientation.LANDSCAPE } // library docx menukar sendiri saat landscape
            : { width: twip.width, height: twip.height },
          margin: {
            top: twip.top, right: twip.right, bottom: twip.bottom, left: twip.left,
            header: mmToTwip(pg.headerDistance), footer: mmToTwip(pg.footerDistance),
          },
        },
      },
      headers: watermarkImage || header ? { default: await hdr(g.h), ...(gi === 0 && titlePage ? { first: await hdr(firstH) } : {}) } : undefined,
      footers: footer ? { default: await ftr(g.f), ...(gi === 0 && titlePage ? { first: await ftr(firstF) } : {}) } : undefined,
      children: kids.length ? kids : [new Paragraph('')],
    })
  }
  return new Document({
    features: ctx.hasToc ? { updateFields: true } : undefined,
    footnotes: ctx.footnotes,
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 }, paragraph: { spacing: { after: 160, line: 360 } } } },
      paragraphStyles: HEADING_PT.map((pt, i) => ({
        id: `Heading${i + 1}`,
        name: `Heading ${i + 1}`,
        basedOn: 'Normal',
        next: 'Normal',
        quickFormat: true,
        run: { size: pt * 2, bold: true, color: '111111' },
        paragraph: { spacing: { before: 240, after: 120, line: 288 }, keepNext: true },
      })),
    },
    numbering: {
      config: [
        { reference: 'bullet', levels: listLevels(LevelFormat.BULLET, (l) => ['•', '◦', '▪'][l % 3]) },
        { reference: 'ordered', levels: listLevels(LevelFormat.DECIMAL, (l) => `%${l + 1}.`) },
      ],
    },
    sections,
  })
}
