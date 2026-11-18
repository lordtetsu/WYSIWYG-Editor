import { Editor, generateHTML, generateJSON } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import TextAlign from '@tiptap/extension-text-align'
import Image from '@tiptap/extension-image'
import { TableKit, TableCell, TableHeader } from '@tiptap/extension-table'
import { TextStyleKit } from '@tiptap/extension-text-style'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { Superscript } from '@tiptap/extension-superscript'
import { Subscript } from '@tiptap/extension-subscript'
import { Packer } from 'docx'
import { EditorView, basicSetup } from 'codemirror'
import { Transaction, Annotation } from '@codemirror/state'
import { xml as htmlLanguage } from '@codemirror/lang-xml' // lebih ringan dari lang-html; script/style memang dibuang editor

import { buildDocx, cssColorToHex } from './docx.js'
import { CONTENT_CSS, UI_CSS, MODAL_CSS, docCss } from './styles.js'
import { LOCALES, resolveText } from './locales.js'
import { PAPER, normalizePage } from './page.js'
import { openPrintPreview, printPaged, pagedHtml, pageStarts, withEndnotes } from './print.js'
import { MathNode, Footnote, Video, renderMath, videoSrc } from './media.js'
import { watermarkSvg, watermarkDataUrl, watermarkPng, watermarkFields } from './watermark.js'
import { registerImporter, hasImporter, importAccept, fileToHtml, extensionOf, textToHtml } from './importers.js'
import { setupAi } from './ai.js'
import { createAiChat } from './ai-chat.js'
import { openCrop } from './crop.js'
import { FindReplace, openFindPanel } from './find.js'
import { createMenubar } from './menubar.js'
import { applyTheme } from './theme.js'
import { openHeaderFooter } from './headerfooter.js'
import { scopeCss, pageFromCss } from './content-css.js'
import { ParagraphFormat, PageBreak, TableOfContents, changeCase, setupFormatPainter, SPECIAL_CHARS, EMOJIS, a11yIssues, LINE_HEIGHTS, MAX_INDENT } from './extras.js'

export { buildDocx, LOCALES, PAPER, registerImporter }


const fromEditor = Annotation.define() // menandai isi kode yang diisi dari editor, bukan ketikan pengguna

// Sel tanpa pengaturan dianggap rata atas (default CSS & Word).
function cellAlign(value) {
  return (e) => ['tableCell', 'tableHeader'].some((type) => {
    const v = e.getAttributes(type).verticalAlign
    return e.isActive(type) && (v ?? 'top') === value
  })
}

// Atribut verticalAlign pada sel tabel -> style="vertical-align: …" di HTML.
const withVerticalAlign = (Cell) => Cell.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      verticalAlign: {
        default: null,
        parseHTML: (el) => (['top', 'middle', 'bottom'].includes(el.style.verticalAlign) ? el.style.verticalAlign : null),
        renderHTML: (a) => (a.verticalAlign ? { style: `vertical-align: ${a.verticalAlign}` } : {}),
      },
    }
  },
})

// Tombol per kategori: [kunci teks di locales.js, aksi, status aktif (argumen editor.isActive atau fungsi),
// tetap aktif di tampilan kode, membuka menu]. Urutan kelompok & tombol yang tampil bisa diatur lewat opsi `toolbar`.
const GROUPS = {
  file: [
    ['save', (e, api) => api.save(), null, true], // hanya tampil bila opsi onSave diisi
    ['importMenu', (e, api, button) => api.openMenu(button, importItems()), null, false, true],
    ['exportMenu', (e, api, button) => api.openMenu(button, EXPORT_ITEMS), null, true, true],
    ['print', (e, api, button) => api.print(button), null, true],
  ],
  history: [
    ['undo', (e) => e.chain().focus().undo().run()],
    ['redo', (e) => e.chain().focus().redo().run()],
  ],
  font: [
    ['blockType', 'select'],
    ['fontFamily', 'select'],
    ['fontSizeDown', (e) => stepFontSize(e, -1)],
    ['fontSize', 'select'],
    ['fontSizeUp', (e) => stepFontSize(e, 1)],
  ],
  style: [
    ['bold', (e) => e.chain().focus().toggleBold().run(), 'bold'],
    ['italic', (e) => e.chain().focus().toggleItalic().run(), 'italic'],
    ['underline', (e) => e.chain().focus().toggleUnderline().run(), 'underline'],
    ['strike', (e) => e.chain().focus().toggleStrike().run(), 'strike'],
    ['superscript', (e) => e.chain().focus().toggleSuperscript().run(), 'superscript'],
    ['subscript', (e) => e.chain().focus().toggleSubscript().run(), 'subscript'],
    ['textColor', 'color'],
    ['highlight', 'color'],
    ['formatPainter', (e, api) => api.toggleFormatPainter(), (e, api) => api.isFormatPainter?.()],
    ['clearFormat', (e) => e.chain().focus().unsetAllMarks().run()],
    ['changeCase', (e, api, button) => api.openMenu(button, CASE_ITEMS), null, false, true],
  ],
  align: [
    ['alignLeft', (e) => e.chain().focus().setTextAlign('left').run(), { textAlign: 'left' }],
    ['alignCenter', (e) => e.chain().focus().setTextAlign('center').run(), { textAlign: 'center' }],
    ['alignRight', (e) => e.chain().focus().setTextAlign('right').run(), { textAlign: 'right' }],
    ['alignJustify', (e) => e.chain().focus().setTextAlign('justify').run(), { textAlign: 'justify' }],
    ['lineHeight', 'select'],
    ['outdent', (e) => indentBlocks(e, -1)],
    ['indent', (e) => indentBlocks(e, 1)],
    ['ltr', (e) => setDirection(e, null), (e) => blockAttr(e, 'dir') !== 'rtl'],
    ['rtl', (e) => setDirection(e, 'rtl'), (e) => blockAttr(e, 'dir') === 'rtl'],
  ],
  list: [
    ['bulletList', (e) => e.chain().focus().toggleBulletList().run(), 'bulletList'],
    ['orderedList', (e) => e.chain().focus().toggleOrderedList().run(), 'orderedList'],
    ['taskList', (e) => e.chain().focus().toggleTaskList().run(), 'taskList'],
    ['blockquote', (e) => e.chain().focus().toggleBlockquote().run(), 'blockquote'],
  ],
  insert: [
    ['link', editLink, 'link'],
    ['image', async (e) => e.chain().focus().setImage({ src: await pickImage() }).run()],
    ['imageCrop', (e, api, button) => api.cropImage(button)],
    ['table', (e, api, button) => api.openMenu(button, TABLE_ITEMS), (e) => e.isActive('table'), false, true],
    ['horizontalRule', (e) => e.chain().focus().setHorizontalRule().run()],
    ['pageBreak', (e) => e.chain().focus().insertContent({ type: 'pageBreak' }).run()],
    ['toc', (e, api) => api.insertToc()],
    ['math', (e, api, button) => api.openMath(button)],
    ['footnote', (e, api, button) => api.openFootnote(button)],
    ['video', (e, api, button) => api.openVideo(button)],
    ['specialChar', (e, api, button) => api.openCharPicker(button, SPECIAL_CHARS, 'specialChar')],
    ['emoji', (e, api, button) => api.openCharPicker(button, EMOJIS, 'emoji')],
    ['mergeTags', (e, api, button) => api.openMenu(button, api.mergeTagItems()), null, false, true], // hanya bila opsi mergeTags diisi
    ['templates', (e, api, button) => api.openMenu(button, api.templateItems()), null, false, true], // hanya bila opsi templates diisi
  ],
  page: [
    ['hfButton', (e, api, button) => api.openHeaderFooter(button), null, true],
    ['watermark', (e, api, button) => api.openWatermark(button), (e, api) => !!api.getPage().watermark, true],
  ],
  view: [
    ['aiChat', (e, api) => api.toggleAiChat(), (e, api) => !!api.isAiChatOpen?.(), true], // hanya bila opsi ai diisi
    ['code', (e, api) => api.toggleCode(), (e, api) => api.isCodeView(), true],
    ['fullscreen', (e, api) => api.toggleFullscreen(), (e, api) => api.isFullscreen?.(), true],
    ['spellcheck', (e, api) => api.toggleSpellcheck(), (e, api) => api.isSpellcheck?.()],
    ['a11yCheck', (e, api, button) => api.openA11y(button)],
  ],
}
export const DEFAULT_GROUP_ORDER = ['file', 'history', 'font', 'style', 'align', 'list', 'insert', 'page', 'view']

// Daftar huruf bawaan untuk pilihan jenis huruf (opsi `fonts` bisa menggantinya). Nilai = CSS font-family.
export const DEFAULT_FONTS = ['Arial, sans-serif', 'Calibri, Carlito, sans-serif', 'Cambria, Caladea, serif', 'Georgia, serif',
  "'Times New Roman', Times, serif", 'Verdana, sans-serif', 'Tahoma, sans-serif', "'Trebuchet MS', sans-serif", "'Courier New', monospace"]
const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72]
const BLOCKS = ['paragraph', 'heading']
let docCounter = 0
const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
const modKey = isMac ? '⌘' : 'Ctrl'
// Atribut paragraf/judul di posisi kursor.
const blockAttr = (e, name) => e.getAttributes('paragraph')[name] ?? e.getAttributes('heading')[name]
// Ubah atribut semua paragraf/judul yang diblok (relatif lewat fungsi).
function setBlockAttr(e, name, value) {
  return e.chain().focus().command(({ tr, state }) => {
    const { from, to } = state.selection
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (BLOCKS.includes(node.type.name)) tr.setNodeMarkup(pos, undefined, { ...node.attrs, [name]: typeof value === 'function' ? value(node.attrs[name]) : value })
    })
    return true
  }).run()
}
// Di dalam daftar: naik/turun tingkat daftar; di paragraf biasa: indentasi kiri.
function indentBlocks(e, dir) {
  for (const item of ['taskItem', 'listItem']) {
    if (e.isActive(item)) return dir > 0 ? e.chain().focus().sinkListItem(item).run() : e.chain().focus().liftListItem(item).run()
  }
  return setBlockAttr(e, 'indent', (v) => Math.min(MAX_INDENT, Math.max(0, (v || 0) + dir)))
}
const setDirection = (e, dir) => setBlockAttr(e, 'dir', dir)
// Ukuran huruf naik/turun ke ukuran berikutnya di daftar (px dari file impor dihitung sebagai pt).
function stepFontSize(e, dir) {
  const raw = e.getAttributes('textStyle').fontSize ?? '11pt'
  const pt = /px$/.test(raw) ? (parseFloat(raw) * 72) / 96 : parseFloat(raw) || 11
  const next = dir > 0 ? FONT_SIZES.find((n) => n > pt + 0.1) : [...FONT_SIZES].reverse().find((n) => n < pt - 0.1)
  return next ? e.chain().focus().setFontSize(`${next}pt`).run() : false
}
const CASE_ITEMS = ['caseUpper', 'caseLower', 'caseTitle', 'caseSentence'].map((key) => [key, (api) => changeCase(api.editor, key.slice(4).toLowerCase())])
// Tombol yang hanya tampil bila opsi tertentu diisi.
const REQUIRES = { save: (o) => o.onSave, mergeTags: (o) => o.mergeTags?.length, templates: (o) => o.templates?.length, aiChat: (o) => o.ai?.endpoint }
const firstFamily = (f) => f.split(',')[0].replace(/["']/g, '').trim()
// Kontrol pilihan/warna di toolbar: options -> [nilai, teks]; read -> nilai saat ini; apply -> terapkan.
const CONTROLS = {
  blockType: {
    options: (t) => [['p', t.paragraph.title], ['h1', t.h1.title], ['h2', t.h2.title], ['h3', t.h3.title], ['h4', t.heading4], ['code', t.codeBlockLabel]],
    read: (e) => (e.isActive('codeBlock') ? 'code' : [1, 2, 3, 4].map((l) => e.isActive('heading', { level: l }) && `h${l}`).find(Boolean) || 'p'),
    apply: (e, v) => {
      const c = e.chain().focus()
      ;(v === 'p' ? c.setParagraph() : v === 'code' ? c.setCodeBlock() : c.setHeading({ level: +v[1] })).run()
    },
  },
  fontFamily: {
    options: (t, fonts) => [['', t.fontDefault], ...fonts.map((f) => [f, firstFamily(f)])],
    read: (e) => e.getAttributes('textStyle').fontFamily ?? '',
    apply: (e, v) => (v ? e.chain().focus().setFontFamily(v).run() : e.chain().focus().unsetFontFamily().run()),
    labelOf: firstFamily,
  },
  lineHeight: {
    options: (t) => [['', t.lineHeightDefault], ...LINE_HEIGHTS.map((v) => [v, v])],
    read: (e) => blockAttr(e, 'lineHeight') ?? '',
    apply: (e, v) => setBlockAttr(e, 'lineHeight', v || null),
  },
  fontSize: {
    options: (t) => [['', t.sizeDefault], ...FONT_SIZES.map((n) => [`${n}pt`, String(n)])],
    read: (e) => e.getAttributes('textStyle').fontSize ?? '',
    apply: (e, v) => (v ? e.chain().focus().setFontSize(v).run() : e.chain().focus().unsetFontSize().run()),
    labelOf: (v) => v.replace(/pt$/, ''),
  },
  textColor: {
    fallback: '#000000',
    read: (e) => e.getAttributes('textStyle').color,
    apply: (e, v) => e.chain().focus().setColor(v).run(),
  },
  highlight: {
    fallback: '#ffff00',
    read: (e) => e.getAttributes('textStyle').backgroundColor,
    apply: (e, v) => e.chain().focus().setBackgroundColor(v).run(),
  },
}
// Daftar kelompok -> kunci tombol (termasuk isi dropdown), untuk opsi `toolbar` & dokumentasi.
export const TOOLBAR_GROUPS = Object.fromEntries(Object.entries(GROUPS).map(([g, tools]) => [g, tools.map(([key]) => key)]))
// Isi dropdown: [kunci teks, aksi]
const EXPORT_ITEMS = [
  ['exportDocx', (api) => api.exportDocx()],
  ['exportPdf', (api) => api.exportPdf()],
  ['exportHtml', (api) => api.exportHtml()],
]
const IMPORT_FORMATS = [
  ['importDocx', ['docx']],
  ['importMd', ['md', 'markdown']],
  ['importHtml', ['html', 'htm']],
  ['importTxt', ['txt', 'text']],
  ['importPdf', ['pdf']], // hanya muncul bila plugin doc-editor-pdf dimuat
]
// Menu Tabel: sisipkan tabel baru + ubah tabel di posisi kursor (nonaktif di luar tabel).
const TABLE_ITEMS = [
  ['tableNew', (api, anchor) => api.openTablePicker(anchor)],
  ['addColumn', (api) => api.editor.chain().focus().addColumnAfter().run()],
  ['addRow', (api) => api.editor.chain().focus().addRowAfter().run()],
  ['deleteColumn', (api) => api.editor.chain().focus().deleteColumn().run()],
  ['deleteRow', (api) => api.editor.chain().focus().deleteRow().run()],
  ['valignTop', (api) => api.editor.chain().focus().setCellAttribute('verticalAlign', 'top').run()],
  ['valignMiddle', (api) => api.editor.chain().focus().setCellAttribute('verticalAlign', 'middle').run()],
  ['valignBottom', (api) => api.editor.chain().focus().setCellAttribute('verticalAlign', 'bottom').run()],
  ['deleteTable', (api) => api.editor.chain().focus().deleteTable().run()],
]
export const TOOLBAR_MENUS = {
  table: TABLE_ITEMS.map(([key]) => key),
  importMenu: ['importAny', ...IMPORT_FORMATS.map(([key]) => key)],
  exportMenu: EXPORT_ITEMS.map(([key]) => key),
}
const importItems = () => [
  ['importAny', (api) => api.importFile()],
  ...IMPORT_FORMATS.filter(([, exts]) => hasImporter(exts[0]))
    .map(([key, exts]) => [key, (api) => api.importFile(exts.map((x) => `.${x}`).join(','))]),
]
// Hanya aktif saat gambar dipilih.
const IMAGE_TOOLS = new Set(['imageCrop'])
// Hanya aktif saat kursor berada di dalam tabel.
const TABLE_TOOLS = new Set(['valignTop', 'valignMiddle', 'valignBottom', 'addColumn', 'addRow', 'deleteColumn', 'deleteRow', 'deleteTable'])

// Satu blok per baris agar kode HTML mudah dibaca; spasi antar-blok diabaikan saat diparse ulang.
const formatHtml = (html) => html.replace(/(<\/(?:p|h[1-6]|li|ul|ol|blockquote|pre|tr|thead|tbody|table)>|<hr>)/g, '$1\n').trim()

function editLink(e, api) {
  const url = window.prompt(api.text.linkPrompt, e.getAttributes('link').href ?? 'https://')
  if (url === null) return
  const chain = e.chain().focus().extendMarkRange('link')
  ;(url ? chain.setLink({ href: url }) : chain.unsetLink()).run()
}

const pickFile = (accept) => new Promise((resolve) => {
  const input = Object.assign(document.createElement('input'), { type: 'file', accept })
  input.onchange = () => input.files?.[0] && resolve(input.files[0])
  input.click()
})
const readDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader()
  r.onload = () => resolve(r.result)
  r.onerror = reject
  r.readAsDataURL(file)
})
// Gambar disimpan sebagai data URL agar tetap offline & ikut tersimpan bersama HTML.
const pickImage = async () => readDataUrl(await pickFile('image/*'))
// Video yang diunggah ikut tersimpan di dokumen (data URL), jadi dibatasi; video besar sebaiknya lewat URL.
const VIDEO_MAX_MB = 25
const MATH_SNIPPETS = [['a/b', '\\frac{a}{b}'], ['x²', 'x^{2}'], ['xᵢ', 'x_{i}'], ['√', '\\sqrt{x}'], ['ⁿ√', '\\sqrt[n]{x}'],
  ['∑', '\\sum_{i=1}^{n} '], ['∫', '\\int_{a}^{b} '], ['lim', '\\lim_{x \\to 0} '], ['( )', '\\left( x \\right)'],
  ['[▦]', '\\begin{bmatrix} a & b \\\\ c & d \\end{bmatrix}'], ['α', '\\alpha'], ['β', '\\beta'], ['π', '\\pi'], ['θ', '\\theta'],
  ['≤', '\\le '], ['≥', '\\ge '], ['≠', '\\ne '], ['≈', '\\approx '], ['±', '\\pm '], ['×', '\\times '], ['÷', '\\div '], ['∞', '\\infty']]

// Word hanya pasti mendukung PNG/JPG; semua format (webp, svg, ...) diubah ke PNG lewat canvas.
async function loadImageAsPng(src) {
  const img = new window.Image()
  img.crossOrigin = 'anonymous'
  img.src = src
  await img.decode()
  const c = document.createElement('canvas')
  c.width = img.naturalWidth
  c.height = img.naturalHeight
  c.getContext('2d').drawImage(img, 0, 0)
  const blob = await new Promise((resolve) => c.toBlob(resolve, 'image/png'))
  if (!blob) throw new Error('canvas kosong')
  return { data: new Uint8Array(await blob.arrayBuffer()), width: c.width, height: c.height }
}

function download(blob, name) {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// Dokumen HTML mandiri satu alur (bukan per halaman): header di atas, footer di bawah, watermark di latar.
// Nomor halaman ({page}/{pages}) tidak bisa dihitung di sini sehingga dihapus; versi per halaman: getPagedHTML().
function fullHtml(html, title, page, header, footer, css = '') {
  const noFields = (s) => s.replace(/\{pages?\}/g, '')
  const wm = page.watermark ? `<div class="de-wm-fixed">${watermarkSvg(page.watermark, page.width, page.height)}</div>\n` : ''
  return `<!doctype html>\n<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(title)}</title><style>${docCss(page)}</style>${css ? `<style>${scopeCss(css, '.de-content')}</style>` : ''}</head>\n<body>${wm}` +
    (header ? `<header class="de-content">${noFields(header)}</header>\n` : '') +
    `<div class="de-content">\n${formatHtml(withEndnotes(html))}\n</div>` +
    (footer ? `\n<footer class="de-content">${noFields(footer)}</footer>` : '') + '</body></html>\n'
}

function injectCss() {
  if (document.getElementById('doc-editor-css')) return
  const s = document.createElement('style')
  s.id = 'doc-editor-css'
  s.textContent = UI_CSS + MODAL_CSS + CONTENT_CSS
  document.head.appendChild(s)
}

/**
 * Buat editor di dalam elemen target.
 * Jika target adalah <textarea>, textarea disembunyikan dan nilainya selalu disinkronkan
 * dengan HTML editor, jadi form biasa (PHP dll.) tetap terkirim tanpa kode tambahan.
 *
 * @param {string|HTMLElement} target  selector atau elemen
 * @param {object} [options]
 * @param {string} [options.content]   HTML awal
 * @param {string} [options.fileName]  nama file ekspor (tanpa ekstensi)
 * @param {(html: string) => void} [options.onChange]  dipanggil setiap isi berubah
 * @param {(html: string, api: object) => any} [options.onSave]  jika diisi, muncul tombol "Simpan" (+ Ctrl/Cmd+S)
 * @param {'id'|'en'} [options.lang]  bahasa bawaan (default 'id')
 * @param {object} [options.labels]  timpa teks per kunci di locales.js, mis. { bold: { label: 'Tebal', title: '...' }, linkPrompt: '...' }
 *        Tombol juga menerima `html` (ikon SVG / icon font) yang dipasang apa adanya; isi hanya dari kode Anda sendiri.
 * @param {number|string} [options.height]  kosong = memanjang ikut isi; angka = px tetap; string CSS bebas,
 *        mis. '60vh' atau 'calc(100vh - 200px)' (ikut tinggi layar); 'fill' = mengisi tinggi panel/wadahnya
 * @param {object} [options.page]  kertas untuk cetak/PDF/HTML/Word: { size: 'A4'|'A5'|'A3'|'F4'|'Letter'|'Legal'|{width,height},
 *        orientation: 'portrait'|'landscape', margin: mm | {top,right,bottom,left}, header: html, footer: html,
 *        headerDistance: mm, footerDistance: mm, watermark: { text, color, opacity, angle, size } }
 * @param {object} [options.toolbar]  { order: ['style', 'block', …] (urutan kelompok; yang tak disebut menyusul
 *        sesuai urutan bawaan), hide: ['strike', 'table', 'exportPdf', …] (kunci tombol, kelompok, atau isi dropdown) }.
 *        Lihat DocEditor.TOOLBAR_GROUPS & DocEditor.TOOLBAR_MENUS untuk semua nama.
 * @param {{endpoint: string}} [options.ai]  URL webserver AI (webserver/server.js): klik kanan pada teks yang diblok ->
 *        "Interaction with AI", dan panel AI Chat. Tanpa token di browser: akses lewat cookie tiket HttpOnly.
 * @param {Array<{value: string, label: string}>} [options.mergeTags]  kolom isian, disisipkan sebagai {{value}}
 * @param {Array<{title: string, html: string}>} [options.templates]  template dokumen siap sisip
 * @param {boolean} [options.spellcheck]  periksa ejaan browser (default true)
 * @param {boolean} [options.menubar]  menu File/Edit/View/... (default true)
 * @param {boolean} [options.statusbar]  baris status: posisi elemen & jumlah kata (default true)
 * @param {boolean|string} [options.autosave]  simpan draf otomatis di browser ini (string = kunci penyimpanan)
 * @param {'compact'|'normal'|'comfortable'} [options.density]  ukuran tombol toolbar
 * @param {boolean} [options.allowExport]  false = ekspor & cetak dimatikan di editor (ekspor lewat backend, lihat webserver/)
 * @param {string|string[]} [options.contentCss]  CSS tampilan dokumen (teks CSS atau URL file .css); berlaku di editor,
 *        pratinjau, cetak/PDF & HTML. Aturan @page (size, margin) ikut mengatur kertas.
 * @param {string[]} [options.fonts]  pilihan jenis huruf (CSS font-family), default DEFAULT_FONTS
 * @param {string|object} [options.theme]  'light' | 'dark' | 'auto' | 'inherit' (ikut template aplikasi) atau warna:
 *        { preset?, bg, color, border, toolbarBg, toolbarColor, hoverBg, activeBg, activeBorder, activeColor, accent, uiFont }
 */
export function create(target, { content, fileName = 'dokumen', onChange, onSave, lang = 'id', labels, theme = 'light', height, page, toolbar: toolbarOptions = {}, fonts = DEFAULT_FONTS, ai, mergeTags = [], templates = [], spellcheck = true, menubar = true, statusbar = true, autosave = false, density = 'normal', contentCss, allowExport = true } = {}) {
  injectCss()
  // content boleh berupa paket dokumen tersimpan (hasil getDocument): { html, page, css, … }
  const savedDoc = content && typeof content === 'object' ? content : null
  if (savedDoc) {
    content = savedDoc.html ?? ''
    page = { ...page, ...savedDoc.page }
    contentCss = savedDoc.css || contentCss
    fileName = savedDoc.fileName || fileName
  }
  const text = resolveText(lang, labels)
  const groupOrder = [...new Set([...(toolbarOptions.order ?? []), ...DEFAULT_GROUP_ORDER])].filter((g) => GROUPS[g])
  const hidden = new Set(toolbarOptions.hide ?? [])
  if (!allowExport) for (const k of ['exportMenu', 'print']) hidden.add(k)
  const known = new Set([...Object.keys(GROUPS), ...Object.values(TOOLBAR_GROUPS).flat(), ...Object.values(TOOLBAR_MENUS).flat()])
  for (const name of [...(toolbarOptions.order ?? []), ...hidden]) {
    if (!known.has(name)) console.warn(`DocEditor: nama tombol/kelompok tidak dikenal di opsi toolbar: "${name}"`)
  }
  let el = typeof target === 'string' ? document.querySelector(target) : target
  if (!el) throw new Error(`DocEditor: elemen "${target}" tidak ditemukan`)

  let textarea = null
  if (el.tagName === 'TEXTAREA') {
    textarea = el
    el = document.createElement('div')
    textarea.after(el)
    textarea.hidden = true
    content ??= textarea.value
  }
  el.classList.add('de')
  if (height != null) {
    el.classList.add('de-fixed')
    // 'fill' = isi sisa tinggi wadah (wadah biasa bertinggi tetap, flex, atau grid)
    if (height === 'fill') el.classList.add('de-fill')
    else el.style.height = typeof height === 'number' ? `${height}px` : height
  }
  // toolbarBg -> --de-toolbar-bg
  // Tema tampilan (light/dark/auto/inherit/objek warna) + kepadatan tombol; variabelnya ikut ke jendela modal.
  const themeCtl = applyTheme(el, theme, density)

  const toolbar = Object.assign(document.createElement('div'), { className: 'de-toolbar' })
  toolbar.setAttribute('role', 'toolbar')
  toolbar.setAttribute('aria-label', text.toolbar)
  const body = Object.assign(document.createElement('div'), { className: 'de-body' })
  const code = Object.assign(document.createElement('div'), { className: 'de-code', hidden: true })
  // Area kerja: isi dokumen / kode + panel samping (AI Chat).
  const workspace = Object.assign(document.createElement('div'), { className: 'de-workspace' })
  workspace.append(body, code)
  el.append(toolbar, workspace)

  const flags = { pasteAsText: false }
  const extensions = [
    StarterKit.configure({ link: { openOnClick: false } }),
    TextAlign.configure({ types: ['heading', 'paragraph'] }),
    TextStyleKit, // warna, ukuran & jenis huruf, stabilo (mis. dari file Word yang diimpor)
    ParagraphFormat, // indentasi, spasi baris, arah teks
    PageBreak,
    TableOfContents.configure({ title: text.tocTitle, empty: text.tocEmptyShort }),
    MathNode,
    Footnote,
    Video,
    TaskList,
    TaskItem.configure({ nested: true }),
    Superscript,
    Subscript,
    FindReplace,
    // Ubah ukuran dengan menyeret pegangan sudut; rasio gambar tetap.
    Image.configure({ allowBase64: true, resize: { enabled: true, directions: ['top-left', 'top-right', 'bottom-left', 'bottom-right'], minWidth: 30, minHeight: 30, alwaysPreserveAspectRatio: true } }),
    TableKit.configure({ tableCell: false, tableHeader: false }),
    withVerticalAlign(TableCell),
    withVerticalAlign(TableHeader),
  ]
  // HTML header/footer (dari file, API, atau hasil edit di pratinjau) disaring skema editor: <script> dll. dibuang.
  const sanitize = (html) => (html?.trim() ? generateHTML(generateJSON(html, extensions), extensions) : '')
  const editor = new Editor({
    element: body,
    extensions,
    content: content ?? '',
    editorProps: {
      attributes: { class: 'de-content' },
      // "Tempel sebagai teks": format dari sumber dibuang, baris kosong tetap jadi paragraf.
      handlePaste: (view, event) => {
        if (!flags.pasteAsText) return false
        const t = event.clipboardData?.getData('text/plain')
        if (!t) return false
        editor.commands.insertContent(textToHtml(t))
        return true
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML()
      if (textarea) textarea.value = html
      onChange?.(html)
    },
  })

  let closePopup = null
  let popupAnchor = null
  // Tutup popup yang sedang terbuka; true bila yang ditutup milik tombol yang sama (klik lagi = tutup).
  const togglePopup = (anchor) => {
    const same = closePopup && popupAnchor === anchor
    closePopup?.()
    return same
  }
  // Popup di bawah tombol: tetap di dalam lebar editor, tutup dengan Esc / klik di luar.
  function openPopover(anchor, pop) {
    toolbar.append(pop)
    pop.style.top = `${anchor.offsetTop + anchor.offsetHeight + 4}px`
    pop.style.left = `${Math.max(0, Math.min(anchor.offsetLeft, toolbar.clientWidth - pop.offsetWidth))}px`
    const outside = (ev) => !pop.contains(ev.target) && !anchor.contains(ev.target) && close()
    const close = () => {
      pop.remove()
      document.removeEventListener('mousedown', outside)
      if (anchor.hasAttribute('aria-expanded')) anchor.setAttribute('aria-expanded', 'false')
      closePopup = popupAnchor = null
    }
    pop.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') {
        ev.preventDefault()
        close()
        anchor.focus()
      }
    })
    document.addEventListener('mousedown', outside)
    closePopup = close
    popupAnchor = anchor
    return close
  }
  let closePreview = null
  let pageSettings = normalizePage(page)
  const blocked = () => { console.warn('DocEditor: ekspor dimatikan (allowExport: false); gunakan ekspor di server.'); return Promise.resolve(false) }
  let docCssText = ''
  // Watermark samar di latar editor sebagai petunjuk.
  function showWatermark() {
    const wm = pageSettings.watermark
    body.classList.toggle('de-has-wm', !!wm)
    body.style.backgroundImage = wm ? watermarkDataUrl(wm, pageSettings.width, pageSettings.height) : ''
  }
  showWatermark()
  const pagedContent = (title) => ({ html: editor.getHTML(), header: sanitize(pageSettings.header), footer: sanitize(pageSettings.footer), title, css: docCssText })
  const api = {
    editor,
    text,
    getHTML: () => editor.getHTML(),
    getJSON: () => editor.getJSON(),
    setContent: (html) => editor.commands.setContent(html),
    // Word sebagai Blob (tanpa unduh) — dipakai juga oleh ekspor di server.
    async exportDocxBlob() {
      const pg = pageSettings
      const doc = await buildDocx(editor.getJSON(), {
        loadImage: loadImageAsPng,
        imageMissing: text.imageMissing,
        page: pg,
        header: pg.header.trim() ? generateJSON(pg.header, extensions) : undefined,
        footer: pg.footer.trim() ? generateJSON(pg.footer, extensions) : undefined,
        watermarkImage: pg.watermark ? await watermarkPng(pg.watermark, pg.width, pg.height) : undefined,
        tocTitle: text.tocTitle,
        videoLabel: text.videoLabel,
        // Header/footer dikecualikan di halaman tertentu -> pakai tata letak pratinjau untuk membagi section Word.
        pageStarts: /\d/.test(`${pg.hideHeaderOn ?? ''}${pg.hideFooterOn ?? ''}`) ? await pageStarts(pagedContent(fileName), pg) : undefined,
      })
      return Packer.toBlob(doc)
    },
    async exportDocx(name = fileName) {
      if (!allowExport) return blocked()
      download(await api.exportDocxBlob(), `${name}.docx`)
    },
    // Paket dokumen lengkap untuk disimpan (mis. di database) dan diekspor di server dengan hasil yang sama:
    // isi + kertas, margin, header/footer, pengecualian halaman, nomor awal, watermark, CSS tampilan, bahasa.
    getDocument: () => ({
      version: 1,
      html: editor.getHTML(),
      page: { ...pageSettings, header: sanitize(pageSettings.header), footer: sanitize(pageSettings.footer) },
      css: docCssText,
      lang,
      fileName,
    }),
    loadDocument(doc) {
      if (!doc) return
      editor.commands.setContent(doc.html ?? '', { emitUpdate: true })
      if (doc.page) api.setPage(doc.page)
      api.setContentCss?.(doc.css ?? '', { applyPage: false })
      if (doc.fileName) fileName = doc.fileName
    },
    // PDF lewat dialog cetak browser (pilih "Simpan sebagai PDF"), tata letak sama dengan pratinjau.
    exportPdf(name = fileName) {
      if (!allowExport) return blocked()
      return printPaged(pagedContent(name), pageSettings)
    },
    getFullHTML: (title = fileName) => fullHtml(editor.getHTML(), title, pageSettings, sanitize(pageSettings.header), sanitize(pageSettings.footer), docCssText),
    // HTML per halaman (header/footer/nomor halaman/watermark di tiap halaman), sama dengan pratinjau.
    getPagedHTML: (title = fileName) => pagedHtml(pagedContent(title), pageSettings),
    getPage: () => pageSettings,
    // Ubah sebagian pengaturan kertas; yang tidak disebut tetap.
    setPage(p = {}) {
      const margin = typeof p.margin === 'object' && p.margin ? { ...pageSettings.margin, ...p.margin } : p.margin ?? pageSettings.margin
      pageSettings = normalizePage({ ...pageSettings, ...p, margin })
      showWatermark()
      refresh()
    },
    print(anchor) {
      if (!allowExport) return blocked()
      closePreview?.()
      const dismiss = openPrintPreview({
        text,
        page: pageSettings,
        content: () => ({ html: editor.getHTML(), title: fileName, css: docCssText }),
        sanitize,
        onChange: (p) => { pageSettings = p; showWatermark(); refresh() },
        themeVars: themeCtl.vars,
        returnFocus: anchor,
      })
      closePreview = () => { closePreview = null; dismiss() }
    },
    async exportHtml(name = fileName) {
      if (!allowExport) return blocked()
      download(new Blob([await api.getPagedHTML(name)], { type: 'text/html;charset=utf-8' }), `${name}.html`)
    },
    // Crop gambar yang sedang dipilih; lebar tampilnya disesuaikan dengan proporsi potongan.
    cropImage(anchor) {
      const { selection } = editor.state
      const node = selection.node
      if (node?.type.name !== 'image') return
      const pos = selection.from
      openCrop({
        src: node.attrs.src,
        text,
        themeVars: themeCtl.vars,
        returnFocus: anchor ?? editor.view.dom,
        onApply: ({ src, width, naturalWidth }) => {
          const shown = node.attrs.width ? Math.max(30, Math.round(node.attrs.width * (width / naturalWidth))) : null
          // Node diganti utuh agar tampilan ukuran (node view) dibuat ulang dari atribut baru.
          editor.chain().focus()
            .insertContentAt({ from: pos, to: pos + node.nodeSize }, { type: 'image', attrs: { ...node.attrs, src, width: shown, height: null } })
            .setNodeSelection(pos).run()
        },
      })
    },
    openWatermark(anchor = toolbar) {
      if (togglePopup(anchor)) return
      const pop = Object.assign(document.createElement('div'), { className: 'de-pop' })
      pop.setAttribute('role', 'dialog')
      pop.setAttribute('aria-label', text.watermark.title)
      const fields = watermarkFields(text, pageSettings.watermark, (wm) => api.setPage({ watermark: wm }))
      pop.append(fields.element)
      openPopover(anchor, pop)
      fields.focus()
    },
    save: () => onSave?.(editor.getHTML(), api, api.getDocument()),
    openTablePicker(anchor = toolbar) {
      if (togglePopup(anchor)) return
      // Bukan <form> (bisa bersarang di form aplikasi) dan input tanpa `name` agar tidak ikut terkirim.
      const pop = Object.assign(document.createElement('div'), { className: 'de-pop' })
      pop.setAttribute('role', 'dialog')
      pop.setAttribute('aria-label', text.table.title)
      const num = (value, max) => Object.assign(document.createElement('input'), { type: 'number', min: 1, max, value })
      const field = (label, input, before) => {
        const l = document.createElement('label')
        if (before) l.className = 'de-check'
        before ? l.append(input, label) : l.append(label, input)
        return l
      }
      const rows = num(3, 50)
      const cols = num(3, 20)
      const header = Object.assign(document.createElement('input'), { type: 'checkbox', checked: true })
      const insert = Object.assign(document.createElement('button'), { type: 'button', textContent: text.tableInsert })
      pop.append(field(text.tableRows, rows), field(text.tableCols, cols), field(text.tableHeader, header, true), insert)
      const close = openPopover(anchor, pop)

      const clamp = (input) => Math.min(Math.max(1, Math.round(+input.value) || 1), +input.max)
      const apply = () => {
        close()
        editor.chain().focus().insertTable({ rows: clamp(rows), cols: clamp(cols), withHeaderRow: header.checked }).run()
      }
      insert.onclick = apply
      pop.onkeydown = (ev) => {
        if (ev.key === 'Enter') { ev.preventDefault(); apply() } // cegah submit form aplikasi
      }
      rows.select()
    },
    // Dropdown (pola menu ARIA): panah atas/bawah, Home/End, Enter, Esc.
    openMenu(anchor, items) {
      if (togglePopup(anchor)) return
      const menu = Object.assign(document.createElement('div'), { className: 'de-pop de-menu' })
      menu.setAttribute('role', 'menu')
      menu.setAttribute('aria-label', anchor.title)
      const all = items.filter((it) => !hidden.has(it[0])).map((it) => {
        // [kunci teks, aksi] atau { label, title, run } (isi dinamis: merge tag, template)
        const [key, run] = Array.isArray(it) ? it : [null, it.run]
        const { label, title, html } = key ? text[key] : { label: it.label, title: it.title ?? it.label }
        const b = Object.assign(document.createElement('button'), { type: 'button', title })
        // Ikon (bila ada) + teks; item tabel nonaktif bila kursor di luar tabel.
        b.innerHTML = html && !html.includes('de-btn-text') ? html : ''
        b.append(Object.assign(document.createElement('span'), { textContent: label }))
        b.setAttribute('role', 'menuitem')
        b.tabIndex = -1
        b.disabled = TABLE_TOOLS.has(key) && !editor.isActive('table')
        b.onmousedown = (ev) => ev.preventDefault()
        b.onclick = () => {
          close()
          run(api, anchor)
        }
        return b
      })
      menu.append(...all)
      const entries = all.filter((b) => !b.disabled)
      const close = openPopover(anchor, menu)
      anchor.setAttribute('aria-expanded', 'true')
      menu.addEventListener('keydown', (ev) => {
        const i = entries.indexOf(document.activeElement)
        const go = (j) => {
          ev.preventDefault()
          entries[(j + entries.length) % entries.length].focus()
        }
        if (ev.key === 'ArrowDown') go(i + 1)
        else if (ev.key === 'ArrowUp') go(i - 1)
        else if (ev.key === 'Home') go(0)
        else if (ev.key === 'End') go(-1)
        else if (ev.key === 'Tab') close()
      })
      entries[0]?.focus()
    },
    // Pilih file lalu impor. accept: mis. '.docx' (default: semua format yang didukung).
    importFile(accept = importAccept()) {
      return new Promise((resolve) => {
        const input = Object.assign(document.createElement('input'), { type: 'file', accept })
        input.onchange = async () => {
          const file = input.files?.[0]
          if (file) resolve(await api.importFrom(file))
        }
        input.click()
      })
    },
    // Impor File/Blob bernama (mis. dari drag & drop). Isi kosong -> diganti; selain itu tanya ganti/sisipkan.
    async importFrom(file) {
      let result
      try {
        result = await fileToHtml(file)
      } catch (err) {
        const ext = extensionOf(file.name)
        window.alert(err.code === 'unsupported'
          ? `${text.importUnsupported} (.${ext})${ext === 'pdf' ? `\n${text.importPdfHint}` : ''}`
          : `${text.importFailed}\n${err.message}`)
        return false
      }
      if (api.isCodeView()) api.toggleCode(false)
      if (editor.isEmpty || window.confirm(text.importReplace)) {
        editor.commands.setContent(result.html, { emitUpdate: true })
        // Kertas, margin, header & footer dari file (mis. .docx) ikut dipakai saat isi diganti.
        if (result.page) api.setPage(result.page)
      } else {
        editor.chain().focus().insertContent(result.html).run()
      }
      return true
    },
    isCodeView: () => !code.hidden,
    toggleCode(on = code.hidden) {
      if (on) {
        // Diisi dari editor tanpa masuk riwayat undo CodeMirror, agar Ctrl+Z tidak mengosongkan dokumen.
        cm.dispatch({
          changes: { from: 0, to: cm.state.doc.length, insert: formatHtml(editor.getHTML()) },
          annotations: [Transaction.addToHistory.of(false), fromEditor.of(true)],
        })
      }
      code.hidden = !on
      body.hidden = on
      ;(on ? cm : editor.view).focus()
      if (on) cm.requestMeasure()
      refresh()
    },
    destroy() {
      assistant?.destroy()
      chat?.destroy()
      closePopup?.()
      closePreview?.()
      cm.destroy()
      editor.destroy()
      toolbar.remove()
      workspace.remove()
      el.classList.remove('de', 'de-fixed', 'de-fill')
      if (height != null) el.style.height = ''
      themeCtl.destroy()
      if (textarea) {
        el.remove()
        textarea.hidden = false
      }
    },
  }

  // Ketikan di tampilan kode langsung diterapkan ke editor, jadi ekspor & sinkron textarea tetap jalan.
  const cm = new EditorView({
    parent: code,
    extensions: [
      basicSetup,
      htmlLanguage(),
      EditorView.lineWrapping,
      EditorView.contentAttributes.of({ 'aria-label': text.codeEditor }),
      EditorView.updateListener.of((u) => {
        if (u.docChanged && !u.transactions.some((t) => t.annotation(fromEditor) === true)) {
          editor.commands.setContent(u.state.doc.toString(), { emitUpdate: true })
        }
      }),
    ],
  })

  if (onSave) {
    el.addEventListener('keydown', (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 's') {
        ev.preventDefault()
        api.save()
      }
    })
  }

  function makeButton(key) {
    const { label, title, html } = text[key]
    const b = Object.assign(document.createElement('button'), { type: 'button', title })
    if (html) b.innerHTML = html
    else b.textContent = label
    b.setAttribute('aria-label', title)
    b.onmousedown = (ev) => ev.preventDefault() // jangan hilangkan seleksi teks saat klik tombol
    return b
  }

  const buttons = []
  for (const g of groupOrder) {
    const opts = { onSave, mergeTags, templates, ai }
    const tools = GROUPS[g].filter(([key]) => !hidden.has(key) && (!REQUIRES[key] || REQUIRES[key](opts)))
    if (hidden.has(g) || !tools.length) continue
    const group = Object.assign(document.createElement('div'), { className: 'de-group' })
    group.setAttribute('role', 'group')
    group.setAttribute('aria-label', text.groups[g])
    for (const [key, run, active, always, menu] of tools) {
      if (run === 'select' || run === 'color') {
        const control = makeControl(key, run)
        buttons.push(control)
        group.append(control.wrap)
        continue
      }
      const b = makeButton(key)
      if (menu) {
        b.setAttribute('aria-haspopup', 'menu')
        b.setAttribute('aria-expanded', 'false')
      }
      b.onclick = () => run(editor, api, b)
      buttons.push({ b, active, always, needsTable: TABLE_TOOLS.has(key), needsImage: IMAGE_TOOLS.has(key), needsAi: key === 'aiChat' })
      group.append(b)
    }
    toolbar.append(group)
  }
  toolbar.hidden = !buttons.length
  // <select> (gaya, jenis & ukuran huruf) atau pemilih warna; nilainya mengikuti posisi kursor.
  function makeControl(key, type) {
    const def = CONTROLS[key]
    const { label, title } = text[key]
    if (type === 'select') {
      const select = Object.assign(document.createElement('select'), { title, className: `de-select de-${key}` })
      select.setAttribute('aria-label', title)
      for (const [value, name] of def.options(text, fonts)) select.append(new Option(name, value))
      select.onchange = () => def.apply(editor, select.value)
      const sync = () => {
        const v = def.read(editor)
        // Nilai dari file impor (mis. 13pt atau huruf lain) ditambahkan sebagai pilihan agar tetap terlihat.
        if (![...select.options].some((o) => o.value === v)) select.append(new Option(def.labelOf?.(v) ?? v, v))
        select.value = v
      }
      return { b: select, wrap: select, sync }
    }
    const wrap = Object.assign(document.createElement('label'), { className: 'de-color', title })
    const swatch = Object.assign(document.createElement('span'), { className: 'de-swatch' })
    if (text[key].html) swatch.innerHTML = text[key].html
    else swatch.textContent = label
    swatch.setAttribute('aria-hidden', 'true')
    const input = Object.assign(document.createElement('input'), { type: 'color' })
    input.setAttribute('aria-label', title)
    input.onchange = () => def.apply(editor, input.value) // change, bukan input: satu langkah undo per warna
    wrap.append(swatch, input)
    const sync = () => {
      const hex = cssColorToHex(def.read(editor))
      input.value = hex ? `#${hex.toLowerCase()}` : def.fallback
      swatch.style.borderBottomColor = input.value
    }
    return { b: input, wrap, sync }
  }

  function refresh() {
    const codeView = api.isCodeView()
    const inTable = editor.isActive('table')
    const onImage = editor.isActive('image')
    const aiReady = !!api.isAiChatReady?.()
    for (const { b, active, always, needsTable, needsImage, needsAi, sync } of buttons) {
      b.disabled = (codeView && !always) || (needsTable && !inTable) || (needsImage && !onImage) || (needsAi && !aiReady)
      if (needsAi) b.title = aiReady ? text.aiChat.title : text.aiChatUnavailable
      sync?.()
      if (active) b.setAttribute('aria-pressed', String(typeof active === 'function' ? active(editor, api) : editor.isActive(...[].concat(active))))
    }
  }
  editor.on('transaction', refresh)
  refresh()

  // Klik dua kali pada gambar (klik pertama memilihnya) -> crop.
  // Klik dua kali pada rumus / nomor catatan kaki -> edit.
  editor.view.dom.addEventListener('dblclick', () => {
    if (!editor.isEditable) return
    if (editor.isActive('image')) api.cropImage()
    else if (editor.isActive('math')) api.openMath()
    else if (editor.isActive('footnote')) api.openFootnote()
  })

  const assistant = ai?.endpoint ? setupAi(editor, ai, text, el) : null
  // Panel AI Chat (samping); tombolnya aktif setelah backend AI dipastikan sehat.
  const chat = ai?.endpoint ? createAiChat({ editor, ai, text, host: workspace, onState: () => refresh() }) : null
  Object.assign(api, {
    toggleAiChat: () => chat?.toggle(),
    openAiChat: () => chat?.open(),
    closeAiChat: () => chat?.close(),
    isAiChatOpen: () => !!chat?.isOpen(),
    isAiChatReady: () => !!chat?.isReady(),
  })
  api.openAi = () => assistant?.open() // panel AI untuk teks yang sedang diblok

  // ===== Fitur tambahan: format painter, karakter, merge tag, template, layar penuh, ejaan, aksesibilitas,
  // cari & ganti, tempel sebagai teks, daftar isi, tanggal, menubar, status bar, draf otomatis =====
  const painter = setupFormatPainter(editor, () => refresh())
  let fullscreen = false
  let spell = spellcheck
  let spellLang = lang
  let closeFind = null
  editor.view.dom.setAttribute('spellcheck', String(spell))
  editor.view.dom.setAttribute('lang', spellLang)
  const locale = lang === 'id' ? 'id-ID' : 'en-US'
  const draftKey = autosave ? 'doc-editor:' + (typeof autosave === 'string' ? autosave : location.pathname + '#' + (el.id || 'editor')) : null
  const readDraft = () => { try { return JSON.parse(localStorage.getItem(draftKey) ?? 'null') } catch { return null } }
  const make = (tag, props = {}) => Object.assign(document.createElement(tag), props)

  function smallPopover(anchor, className, label, build) {
    if (togglePopup(anchor)) return
    const pop = make('div', { className: 'de-pop ' + className })
    pop.setAttribute('role', 'dialog')
    pop.setAttribute('aria-label', label)
    build(pop)
    openPopover(anchor, pop)
    pop.querySelector('button,input')?.focus()
  }

  // Popover formulir kecil: isi dari build(), tombol Batal / Sisipkan (Enter di input, Ctrl/Cmd+Enter di textarea).
  function formPopover(anchor, key, build, onOk, editing) {
    smallPopover(anchor ?? toolbar, 'de-form', text[key].title, (pop) => {
      const actions = make('div', { className: 'de-form-actions' })
      const cancel = make('button', { type: 'button', textContent: text.cancel })
      const ok = make('button', { type: 'button', className: 'de-primary', textContent: editing ? text.update : text.insertNow })
      const submit = () => { if (onOk() !== false) closePopup?.() }
      cancel.onclick = () => closePopup?.()
      ok.onclick = submit
      build(pop, actions)
      actions.append(cancel, ok)
      pop.append(actions)
      pop.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey || e.target.tagName === 'INPUT')) { e.preventDefault(); submit() }
      })
      queueMicrotask(() => pop.querySelector('textarea,input')?.focus())
    })
  }
  const selectedNode = (type) => (editor.state.selection.node?.type.name === type ? editor.state.selection.node : null)

  Object.assign(api, {
    // Rumus LaTeX dengan pratinjau langsung; teks yang diblok dipakai sebagai rumus awal.
    openMath(anchor) {
      const cur = selectedNode('math')
      const { from, to, empty } = editor.state.selection
      const initial = cur?.attrs.latex ?? (empty ? '' : editor.state.doc.textBetween(from, to, ' '))
      let ta
      let display
      formPopover(anchor, 'math', (pop) => {
        ta = make('textarea', { value: initial, placeholder: text.mathPrompt, spellcheck: false })
        ta.setAttribute('aria-label', text.mathPrompt)
        display = make('input', { type: 'checkbox', checked: !!cur?.attrs.display })
        const preview = make('div', { className: 'de-math-preview' })
        const draw = () => { preview.innerHTML = renderMath(ta.value, display.checked) }
        const quick = make('div', { className: 'de-quick' })
        for (const [label, tex] of MATH_SNIPPETS) {
          const b = make('button', { type: 'button', textContent: label, title: tex })
          b.onclick = () => { ta.setRangeText(tex, ta.selectionStart, ta.selectionEnd, 'end'); ta.focus(); draw() }
          quick.append(b)
        }
        const label = make('label')
        label.append(display, ' ' + text.mathDisplay)
        ta.oninput = draw
        display.onchange = draw
        pop.append(ta, quick, preview, label)
        draw()
      }, () => {
        const latex = ta.value.trim()
        if (latex) editor.chain().focus().insertContent({ type: 'math', attrs: { latex, display: display.checked } }).run()
      }, !!cur)
    },
    // Catatan kaki disisipkan di akhir blok teks (teks yang diblok tidak tertimpa).
    openFootnote(anchor) {
      const cur = selectedNode('footnote')
      let ta
      formPopover(anchor, 'footnote', (pop) => {
        ta = make('textarea', { value: cur?.attrs.text ?? '', placeholder: text.footnotePrompt })
        ta.setAttribute('aria-label', text.footnotePrompt)
        pop.append(ta)
      }, () => {
        const t = ta.value.trim()
        if (!t) return
        const chain = editor.chain().focus()
        ;(cur ? chain : chain.setTextSelection(editor.state.selection.to)).insertContent({ type: 'footnote', attrs: { text: t } }).run()
      }, !!cur)
    },
    // Video: URL YouTube/Vimeo/file video, atau unggah file (tersimpan di dokumen, maks. VIDEO_MAX_MB).
    openVideo(anchor) {
      let url
      const insert = (value) => {
        const src = videoSrc(value)
        if (!src) { window.alert(text.videoInvalid); return false }
        editor.chain().focus().insertContent({ type: 'video', attrs: { src } }).run()
      }
      formPopover(anchor, 'video', (pop, actions) => {
        url = make('input', { type: 'url', placeholder: text.videoPrompt })
        url.setAttribute('aria-label', text.videoPrompt)
        const upload = make('button', { type: 'button', textContent: text.videoUpload })
        upload.onclick = async () => {
          const file = await pickFile('video/*')
          if (file.size > VIDEO_MAX_MB * 1024 * 1024) return window.alert(text.videoTooLarge.replace('{mb}', VIDEO_MAX_MB))
          if (insert(await readDataUrl(file)) !== false) closePopup?.()
        }
        pop.append(url)
        actions.append(upload)
      }, () => insert(url.value))
    },
    toggleFormatPainter: () => painter.toggle(),
    isFormatPainter: () => painter.active(),
    // Kisi karakter/emoji; panah untuk berpindah, Enter menyisipkan.
    openCharPicker(anchor = toolbar, chars, key) {
      smallPopover(anchor, 'de-chars', text[key].title, (pop) => {
        const cols = 10
        const cells = chars.map((ch) => {
          const b = make('button', { type: 'button', textContent: ch, title: ch, tabIndex: -1 })
          b.onmousedown = (e) => e.preventDefault()
          b.onclick = () => { closePopup?.(); editor.chain().focus().insertContent(ch).run() }
          return b
        })
        cells[0].tabIndex = 0
        pop.append(...cells)
        pop.addEventListener('keydown', (e) => {
          const i = cells.indexOf(document.activeElement)
          const d = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }[e.key]
          if (d && i >= 0) { e.preventDefault(); cells[Math.min(cells.length - 1, Math.max(0, i + d))].focus() }
        })
      })
    },
    mergeTagItems: () => mergeTags.map((t) => ({ label: t.label ?? t.value, title: '{{' + t.value + '}}', run: () => editor.chain().focus().insertContent('{{' + t.value + '}}').run() })),
    templateItems: () => templates.map((t) => ({ label: t.title, run: () => api.applyTemplate(t) })),
    // Template: { title, html, page? } -- page (kertas, margin, header, footer, watermark) ikut dipakai.
    applyTemplate(t) {
      if (editor.isEmpty || window.confirm(text.templateReplace)) {
        editor.commands.setContent(t.html ?? '', { emitUpdate: true })
        if (t.page) api.setPage(t.page)
      } else editor.chain().focus().insertContent(t.html ?? '').run()
    },
    toggleFullscreen(on = !fullscreen) {
      fullscreen = on
      el.classList.toggle('de-fullscreen', on)
      document.documentElement.classList.toggle('de-noscroll', on)
      editor.commands.focus()
      refresh()
    },
    isFullscreen: () => fullscreen,
    toggleSpellcheck(on = !spell) {
      spell = on
      editor.view.dom.setAttribute('spellcheck', String(spell))
      // Browser baru menggambar ulang garis ejaan setelah fokus berpindah.
      editor.view.dom.blur()
      editor.commands.focus()
      refresh()
    },
    isSpellcheck: () => spell,
    setSpellLanguage(l) {
      spellLang = l
      editor.view.dom.setAttribute('lang', l)
    },
    openFind() {
      closeFind?.()
      closeFind = openFindPanel(editor, text, toolbar, () => { closeFind = null })
    },
    togglePasteAsText() { flags.pasteAsText = !flags.pasteAsText },
    toggleInvisibles() { body.classList.toggle('de-show-invisibles') },
    toggleBlocks() { body.classList.toggle('de-show-blocks') },
    // Daftar isi dari judul dokumen (teks, menjorok sesuai tingkat judul).
    // Daftar isi otomatis (ikut berubah saat judul berubah; nomor halaman terisi di pratinjau/cetak/Word).
    insertToc() {
      editor.chain().focus().insertContent({ type: 'tableOfContents' }).run()
    },
    openHeaderFooter(anchor) {
      openHeaderFooter({
        text,
        page: pageSettings,
        extensions,
        onSave: (changes) => api.setPage(changes),
        themeVars: themeCtl.vars,
        returnFocus: anchor ?? editor.view.dom,
      })
    },
    insertDateTime(kind) {
      const d = new Date()
      const value = {
        date: d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' }),
        dateShort: d.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' }),
        time: d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
        dateTime: d.toLocaleString(locale, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      }[kind]
      editor.chain().focus().insertContent(value).run()
    },
    newDocument() {
      if (!editor.isEmpty && !window.confirm(text.newDocConfirm)) return
      editor.commands.setContent('', { emitUpdate: true })
      api.setPage({ header: '', footer: '', watermark: null })
    },
    hasDraft: () => !!draftKey && !!readDraft()?.html,
    restoreDraft() {
      const draft = readDraft()
      if (!draft?.html) return
      editor.commands.setContent(draft.html, { emitUpdate: true })
      if (draft.page) api.setPage(draft.page)
    },
    wordCount() {
      const t = editor.state.doc.textBetween(0, editor.state.doc.content.size, ' ', ' ')
      return { words: (t.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? []).length, characters: t.replace(/\s/g, '').length }
    },
    showWordCount(anchor = toolbar) {
      const { words, characters } = api.wordCount()
      smallPopover(anchor, 'de-info', text.wordCount, (pop) => {
        pop.append(make('p', { textContent: words.toLocaleString(locale) + ' ' + text.words + ' · ' + characters.toLocaleString(locale) + ' ' + text.characters }))
      })
    },
    showShortcuts(anchor = toolbar) {
      smallPopover(anchor, 'de-info de-shortcuts', text.shortcuts, (pop) => {
        const dl = document.createElement('dl')
        for (const [keys, what] of text.shortcutList) {
          dl.append(make('dt', { textContent: keys.replace(/Mod/g, modKey) }), make('dd', { textContent: what }))
        }
        pop.append(make('strong', { textContent: text.shortcuts }), dl)
      })
    },
    openA11y(anchor = toolbar) {
      const issues = a11yIssues(editor)
      smallPopover(anchor, 'de-a11y', text.a11yCheck.title, (pop) => {
        pop.append(make('strong', { textContent: text.a11yCheck.title }))
        if (!issues.length) { pop.append(make('p', { textContent: text.a11yNone })); return }
        const list = document.createElement('ul')
        for (const issue of issues) {
          const li = document.createElement('li')
          li.append(make('span', { textContent: text[issue.key] + (issue.text ? ' — ' + issue.text : '') }))
          const show = make('button', { type: 'button', textContent: text.a11yShow })
          show.onclick = () => {
            closePopup?.()
            const node = editor.state.doc.nodeAt(issue.pos)
            if (node && !node.isText && node.type.name !== 'table') editor.chain().focus().setNodeSelection(issue.pos).scrollIntoView().run()
            else editor.chain().focus().setTextSelection(issue.pos + 1).scrollIntoView().run()
          }
          li.append(show)
          if (issue.image || issue.table) {
            const fix = make('button', { type: 'button', textContent: text.a11yFix })
            fix.onclick = () => {
              closePopup?.()
              if (issue.image) {
                const alt = window.prompt(text.a11yAltPrompt, '')
                if (alt) editor.chain().focus().setNodeSelection(issue.pos).updateAttributes('image', { alt }).run()
              } else editor.chain().focus().setTextSelection(issue.pos + 3).toggleHeaderRow().run()
            }
            li.append(fix)
          }
          list.append(li)
        }
        pop.append(list)
      })
    },
  })

  // Pintasan keyboard tambahan.
  el.addEventListener('keydown', (ev) => {
    const mod = ev.ctrlKey || ev.metaKey
    const k = ev.key.toLowerCase()
    if (mod && !ev.shiftKey && k === 'f') { ev.preventDefault(); api.openFind() }
    else if (mod && !ev.shiftKey && k === 'k' && !api.isCodeView()) { ev.preventDefault(); editLink(editor, api) }
    else if (mod && ev.shiftKey && k === 'f') { ev.preventDefault(); api.toggleFullscreen() }
    else if (ev.key === 'Escape' && fullscreen && !closePopup && !closeFind) api.toggleFullscreen(false)
  })

  // Draf otomatis (per browser) bila opsi autosave diisi.
  let draftTimer
  if (draftKey) {
    editor.on('update', () => {
      clearTimeout(draftTimer)
      draftTimer = setTimeout(() => {
        try { localStorage.setItem(draftKey, JSON.stringify({ html: editor.getHTML(), page: pageSettings, time: Date.now() })) } catch { /* penyimpanan browser penuh/diblokir */ }
      }, 1000)
    })
  }

  // Menubar: semua fitur dalam menu teks (File, Edit, View, Insert, Format, Tools, Table, Help).
  const chain = () => editor.chain().focus()
  // Teks menu: 'menu' bila ada, lalu judul pendek, lalu label.
  const label = (key) => {
    const t = text[key]
    if (typeof t === 'string') return t
    return t?.menu ?? (t?.title && t.title.length <= 34 ? t.title : t?.label) ?? key
  }
  const item = (key, fn, extra = {}) => ({ label: label(key), run: fn, ...extra })
  const inTable = () => editor.isActive('table')
  const MENUS = [
    { label: text.menus.file, items: () => [
      item('newDocument', () => api.newDocument()),
      ...(draftKey ? [item('restoreDraft', () => api.restoreDraft(), { disabled: !api.hasDraft() })] : []),
      '-',
      ...(allowExport ? [item('preview', () => api.print(toolbar))] : []),
      '-',
      item('importMenu', () => api.importFile()),
      item('importCss', () => api.importCss()),
      ...(docCssText ? [item('clearCss', () => api.setContentCss(''))] : []),
      ...(allowExport ? [
        item('exportDocx', () => api.exportDocx()),
        item('exportPdf', () => api.exportPdf()),
        item('exportHtml', () => api.exportHtml()),
        '-',
        item('print', () => api.print(toolbar)),
      ] : []),
      ...(onSave ? [item('save', () => api.save(), { shortcut: modKey + '+S' })] : []),
    ] },
    { label: text.menus.edit, items: () => [
      item('undo', () => chain().undo().run(), { shortcut: modKey + '+Z', disabled: !editor.can().undo() }),
      item('redo', () => chain().redo().run(), { shortcut: modKey + '+Y', disabled: !editor.can().redo() }),
      '-',
      item('cut', () => { editor.commands.focus(); document.execCommand('cut') }, { shortcut: modKey + '+X' }),
      item('copy', () => { editor.commands.focus(); document.execCommand('copy') }, { shortcut: modKey + '+C' }),
      item('paste', async () => {
        try { editor.chain().focus().insertContent(textToHtml(await navigator.clipboard.readText())).run() } catch { window.alert(text.pasteBlocked) }
      }, { shortcut: modKey + '+V' }),
      item('pasteAsText', () => api.togglePasteAsText(), { checked: flags.pasteAsText }),
      '-',
      item('selectAll', () => chain().selectAll().run(), { shortcut: modKey + '+A' }),
      '-',
      item('find', () => api.openFind(), { shortcut: modKey + '+F' }),
    ] },
    { label: text.menus.view, items: () => [
      item('code', () => api.toggleCode(), { checked: api.isCodeView() }),
      '-',
      item('showInvisibles', () => api.toggleInvisibles(), { checked: body.classList.contains('de-show-invisibles') }),
      item('showBlocks', () => api.toggleBlocks(), { checked: body.classList.contains('de-show-blocks') }),
      '-',
      item('spellcheck', () => api.toggleSpellcheck(), { checked: spell }),
      '-',
      ...(allowExport ? [item('preview', () => api.print(toolbar))] : []),
      item('fullscreen', () => api.toggleFullscreen(), { checked: fullscreen, shortcut: modKey + '+Shift+F' }),
    ] },
    { label: text.menus.insert, items: () => [
      item('image', () => GROUPS.insert.find(([k]) => k === 'image')[1](editor, api)),
      item('link', () => editLink(editor, api), { shortcut: modKey + '+K' }),
      item('tableNew', () => api.openTablePicker(toolbar)),
      item('codeSample', () => chain().setCodeBlock().run()),
      '-',
      item('specialChar', () => api.openCharPicker(toolbar, SPECIAL_CHARS, 'specialChar')),
      item('emoji', () => api.openCharPicker(toolbar, EMOJIS, 'emoji')),
      item('horizontalRule', () => chain().setHorizontalRule().run()),
      '-',
      item('pageBreak', () => chain().insertContent({ type: 'pageBreak' }).run()),
      item('nbsp', () => chain().insertContent(' ').run()),
      item('toc', () => api.insertToc()),
      item('math', () => api.openMath()),
      item('footnote', () => api.openFootnote()),
      item('video', () => api.openVideo()),
      item('hfButton', () => api.openHeaderFooter()),
      '-',
      item('dateLong', () => api.insertDateTime('date')),
      item('dateShort', () => api.insertDateTime('dateShort')),
      item('timeNow', () => api.insertDateTime('time')),
      ...(mergeTags.length ? ['-', ...api.mergeTagItems()] : []),
      ...(templates.length ? ['-', ...api.templateItems()] : []),
    ] },
    { label: text.menus.format, items: () => [
      item('bold', () => chain().toggleBold().run(), { shortcut: modKey + '+B', checked: editor.isActive('bold') }),
      item('italic', () => chain().toggleItalic().run(), { shortcut: modKey + '+I', checked: editor.isActive('italic') }),
      item('underline', () => chain().toggleUnderline().run(), { shortcut: modKey + '+U', checked: editor.isActive('underline') }),
      item('strike', () => chain().toggleStrike().run(), { checked: editor.isActive('strike') }),
      item('superscript', () => chain().toggleSuperscript().run(), { checked: editor.isActive('superscript'), shortcut: modKey + '+.' }),
      item('subscript', () => chain().toggleSubscript().run(), { checked: editor.isActive('subscript'), shortcut: modKey + '+,' }),
      item('inlineCode', () => chain().toggleCode().run(), { checked: editor.isActive('code') }),
      '-',
      ...CASE_ITEMS.map(([k, fn]) => item(k, () => fn(api))),
      '-',
      item('formatPainter', () => api.toggleFormatPainter()),
      item('clearFormat', () => chain().unsetAllMarks().run()),
    ] },
    { label: text.menus.tools, items: () => [
      ...(chat ? [item('aiChat', () => api.toggleAiChat(), { checked: api.isAiChatOpen(), disabled: !api.isAiChatReady() }), '-'] : []),
      item('a11yCheck', () => api.openA11y(toolbar)),
      item('wordCount', () => api.showWordCount(toolbar)),
      '-',
      item('spellcheck', () => api.toggleSpellcheck(), { checked: spell }),
      item('spellLangId', () => api.setSpellLanguage('id'), { checked: spellLang === 'id' }),
      item('spellLangEn', () => api.setSpellLanguage('en'), { checked: spellLang === 'en' }),
      '-',
      item('code', () => api.toggleCode(), { checked: api.isCodeView() }),
    ] },
    { label: text.menus.table, items: () => [
      item('tableNew', () => api.openTablePicker(toolbar)),
      '-',
      item('rowAbove', () => chain().addRowBefore().run(), { disabled: !inTable() }),
      item('addRow', () => chain().addRowAfter().run(), { disabled: !inTable() }),
      item('colLeft', () => chain().addColumnBefore().run(), { disabled: !inTable() }),
      item('addColumn', () => chain().addColumnAfter().run(), { disabled: !inTable() }),
      item('deleteRow', () => chain().deleteRow().run(), { disabled: !inTable() }),
      item('deleteColumn', () => chain().deleteColumn().run(), { disabled: !inTable() }),
      '-',
      item('mergeCells', () => chain().mergeCells().run(), { disabled: !editor.can().mergeCells() }),
      item('splitCell', () => chain().splitCell().run(), { disabled: !editor.can().splitCell() }),
      item('headerRow', () => chain().toggleHeaderRow().run(), { disabled: !inTable() }),
      item('valignTop', () => chain().setCellAttribute('verticalAlign', 'top').run(), { disabled: !inTable() }),
      item('valignMiddle', () => chain().setCellAttribute('verticalAlign', 'middle').run(), { disabled: !inTable() }),
      item('valignBottom', () => chain().setCellAttribute('verticalAlign', 'bottom').run(), { disabled: !inTable() }),
      '-',
      item('deleteTable', () => chain().deleteTable().run(), { disabled: !inTable() }),
    ] },
    { label: text.menus.help, items: () => [
      item('shortcuts', () => api.showShortcuts(toolbar)),
      item('a11yCheck', () => api.openA11y(toolbar)),
    ] },
  ]
  const menubarCtl = menubar ? createMenubar(toolbar, MENUS, text.menus.bar) : null

  // Status bar: posisi elemen (mis. table > tr > td > p) dan jumlah kata.
  let statusCtl = null
  if (statusbar) {
    const bar = make('div', { className: 'de-statusbar' })
    const path = make('span', { className: 'de-path' })
    const count = make('button', { type: 'button', className: 'de-count', title: text.wordCount })
    count.onclick = () => api.showWordCount(toolbar)
    bar.append(path, count)
    el.append(bar)
    const TAG = { paragraph: 'p', bulletList: 'ul', orderedList: 'ol', listItem: 'li', taskList: 'ul', taskItem: 'li', blockquote: 'blockquote', codeBlock: 'pre', table: 'table', tableRow: 'tr', tableCell: 'td', tableHeader: 'th', image: 'img', pageBreak: 'page-break', horizontalRule: 'hr' }
    let timer
    const update = () => {
      const { $from, node } = editor.state.selection
      const names = []
      for (let d = 1; d <= $from.depth; d++) {
        const n = $from.node(d)
        names.push(n.type.name === 'heading' ? 'h' + n.attrs.level : TAG[n.type.name] ?? n.type.name)
      }
      if (node) names.push(TAG[node.type.name] ?? node.type.name)
      path.textContent = names.join(' › ')
      clearTimeout(timer)
      timer = setTimeout(() => { count.textContent = api.wordCount().words.toLocaleString(locale) + ' ' + text.words }, 250)
    }
    editor.on('transaction', update)
    update()
    statusCtl = { destroy: () => { clearTimeout(timer); editor.off('transaction', update); bar.remove() } }
  }

  // CSS tampilan dokumen: hanya berlaku di dalam editor ini (data-de-doc) dan ikut ke pratinjau/cetak/HTML.
  el.dataset.deDoc = String(++docCounter)
  const cssEl = document.createElement('style')
  cssEl.dataset.deDocCss = el.dataset.deDoc
  document.head.append(cssEl)
  Object.assign(api, {
    getContentCss: () => docCssText,
    // css: teks CSS. applyPage (default true): aturan @page ikut mengatur kertas & margin.
    setContentCss(css = '', { applyPage = true } = {}) {
      try {
        cssEl.textContent = scopeCss(css, `[data-de-doc="${el.dataset.deDoc}"] .de-content`)
        docCssText = css
        const pg = applyPage ? pageFromCss(css) : null
        if (pg) api.setPage(pg)
        return true
      } catch {
        return false
      }
    },
    // Pilih file .css dari komputer lalu terapkan.
    importCss() {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: '.css,text/css' })
      input.onchange = async () => {
        const file = input.files?.[0]
        if (file && !api.setContentCss(await file.text())) window.alert(text.cssInvalid)
      }
      input.click()
    },
  })
  // Opsi contentCss: teks CSS langsung, atau URL file .css (diambil dengan fetch).
  // CSS berupa teks langsung dipakai; URL diambil dulu. ed.ready selesai setelah CSS terpasang.
  api.ready = Promise.resolve()
  if (contentCss) {
    const list = [].concat(contentCss)
    const isUrl = (v) => /^(https?:|\/|\.{1,2}\/)|\.css(\?|$)/i.test(v.trim()) && !v.includes('{')
    // Paket dokumen tersimpan sudah berisi pengaturan kertas sendiri: @page tidak menimpanya.
    const opts = { applyPage: !savedDoc }
    if (list.some(isUrl)) {
      api.ready = Promise.all(list.map((v) => (isUrl(v) ? fetch(v).then((r) => r.text()).catch(() => '') : v)))
        .then((parts) => { api.setContentCss(parts.join('\n'), opts) })
    } else api.setContentCss(list.join('\n'), opts)
  }

  refresh() // status tombol yang bergantung pada fitur tambahan (ejaan, layar penuh, …)

  const destroyBase = api.destroy
  api.destroy = () => {
    clearTimeout(draftTimer)
    closeFind?.()
    painter.destroy()
    menubarCtl?.destroy()
    cssEl.remove()
    delete el.dataset.deDoc
    statusCtl?.destroy()
    if (fullscreen) api.toggleFullscreen(false)
    destroyBase()
  }

  return api
}
