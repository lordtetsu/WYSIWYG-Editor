// Fitur tambahan toolbar: indent & spasi baris & arah teks (atribut paragraf), pemisah halaman,
// ubah huruf besar/kecil, format painter, karakter khusus, emoji, dan pemeriksa aksesibilitas.
import { Extension, Node } from '@tiptap/core'
import { Plugin } from '@tiptap/pm/state'

const BLOCK_TYPES = ['paragraph', 'heading']
export const LINE_HEIGHTS = ['1', '1.15', '1.5', '2', '2.5', '3']
export const MAX_INDENT = 8
export const INDENT_PT = 36 // 1 tingkat = 0,5 inci (sama dengan Word)

/** Atribut paragraf/judul: indent (tingkat), lineHeight (kelipatan), dir ('rtl'). Ikut ke HTML, Word, cetak. */
export const ParagraphFormat = Extension.create({
  name: 'paragraphFormat',
  addGlobalAttributes() {
    return [{
      types: BLOCK_TYPES,
      attributes: {
        indent: {
          default: 0,
          parseHTML: (el) => Math.min(MAX_INDENT, Math.round((parseFloat(el.style.marginLeft) || 0) / INDENT_PT)) || 0,
          renderHTML: (a) => (a.indent ? { style: `margin-left: ${a.indent * INDENT_PT}pt` } : {}),
        },
        lineHeight: {
          default: null,
          parseHTML: (el) => (/^\d+(\.\d+)?$/.test(el.style.lineHeight) ? el.style.lineHeight : null),
          renderHTML: (a) => (a.lineHeight ? { style: `line-height: ${a.lineHeight}` } : {}),
        },
        dir: {
          default: null,
          parseHTML: (el) => (el.getAttribute('dir') === 'rtl' ? 'rtl' : null),
          renderHTML: (a) => (a.dir ? { dir: a.dir } : {}),
        },
      },
    }]
  },
})

/** Pemisah halaman: memaksa halaman baru di cetak/PDF/HTML/Word. */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML() {
    return [
      { tag: 'div[data-page-break]' },
      // HTML dari aplikasi lain: <div style="page-break-after: always"></div> yang kosong
      { tag: 'div', getAttrs: (el) => (/page-break-(after|before)\s*:\s*always|break-(after|before)\s*:\s*page/.test(el.getAttribute('style') ?? '') && !el.textContent.trim() ? {} : false) },
    ]
  },
  renderHTML() {
    return ['div', { 'data-page-break': '', class: 'de-page-break', style: 'break-after: page; page-break-after: always' }]
  },
})

// Judul yang masuk daftar isi: tingkat 1-4 yang berisi teks.
const tocHeadings = (doc) => {
  const list = []
  doc?.descendants((n) => { if (n.type.name === 'heading' && n.attrs.level <= 4 && n.textContent.trim()) list.push(n) })
  return list
}
const signature = (doc) => {
  let h = 0
  for (const n of tocHeadings(doc)) for (const ch of n.attrs.level + n.textContent + '|') h = (h * 31 + ch.charCodeAt(0)) | 0
  return String(h)
}

/**
 * Daftar isi otomatis: berisi judul dokumen dan selalu diperbarui saat judul berubah.
 * Nomor halaman diisi saat dokumen dipecah per halaman (pratinjau, cetak/PDF, HTML); di Word menjadi daftar isi asli.
 */
export const TableOfContents = Node.create({
  name: 'tableOfContents',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addOptions: () => ({ title: 'Daftar Isi', empty: '(Belum ada judul)' }),
  addAttributes: () => ({ sig: { default: '', rendered: false } }),
  parseHTML: () => [{ tag: 'div[data-toc]' }],
  renderHTML() {
    const heads = tocHeadings(this.editor?.state.doc)
    const items = heads.map((h, i) => ['p', { class: 'de-toc-item', 'data-level': h.attrs.level, style: `margin-left: ${(h.attrs.level - 1) * 18}pt` },
      ['span', { class: 'de-toc-text' }, h.textContent], ['span', { class: 'de-toc-page', 'data-toc-index': String(i) }, '']])
    return ['div', { 'data-toc': '', class: 'de-toc' }, ['p', { class: 'de-toc-title' }, ['strong', {}, this.options.title]],
      ...(items.length ? items : [['p', { class: 'de-toc-empty' }, this.options.empty]])]
  },
  addProseMirrorPlugins() {
    // Judul berubah -> tandai ulang node daftar isi agar digambar ulang (tidak masuk riwayat undo).
    return [new Plugin({
      appendTransaction: (trs, _old, state) => {
        if (!trs.some((t) => t.docChanged)) return null
        const sig = signature(state.doc)
        const tr = state.tr
        state.doc.descendants((n, pos) => {
          if (n.type.name === 'tableOfContents' && n.attrs.sig !== sig) tr.setNodeMarkup(pos, undefined, { ...n.attrs, sig })
        })
        return tr.docChanged ? tr.setMeta('addToHistory', false) : null
      },
    })]
  },
})

/** Ubah huruf teks yang diblok tanpa menghilangkan format (tebal, warna, dll.). */
export function changeCase(editor, mode) {
  const { state } = editor
  const { from, to } = state.selection
  if (from === to) return false
  const parts = []
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isText) return
    const start = Math.max(from, pos)
    const end = Math.min(to, pos + node.nodeSize)
    parts.push({ start, end, text: node.text.slice(start - pos, end - pos), marks: node.marks })
  })
  const all = parts.map((p) => p.text).join('')
  const transform = {
    upper: (s) => s.toLocaleUpperCase(),
    lower: (s) => s.toLocaleLowerCase(),
    title: (s) => s.toLocaleLowerCase().replace(/(^|[\s\-(“"'])(\p{L})/gu, (m, sp, ch) => sp + ch.toLocaleUpperCase()),
    sentence: (s) => s.toLocaleLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, sp, ch) => sp + ch.toLocaleUpperCase()),
  }[mode]
  let result = transform(all)
  if (result.length !== all.length) result = null // mis. ß -> SS: ubah per potongan saja
  const tr = state.tr
  let offset = 0
  const pieces = parts.map((p) => {
    const text = result ? result.slice(offset, offset + p.text.length) : transform(p.text)
    offset += p.text.length
    return { ...p, text }
  })
  for (const p of pieces.reverse()) {
    if (p.text) tr.replaceWith(p.start, p.end, state.schema.text(p.text, p.marks))
  }
  editor.view.dispatch(tr.setSelection(state.selection.map(tr.doc, tr.mapping)))
  return true
}

/** Format painter: salin format teks di kursor, tempel ke blok berikutnya (sekali pakai; Esc membatalkan). */
export function setupFormatPainter(editor, onChange) {
  let marks = null
  const apply = () => {
    if (!marks || editor.state.selection.empty) return
    const chain = editor.chain().focus().unsetAllMarks()
    for (const m of marks) chain.setMark(m.type.name, m.attrs)
    chain.run()
    marks = null
    onChange()
  }
  const onUp = () => setTimeout(apply) // setelah seleksi dari mouse selesai
  const onKey = (e) => {
    if (!marks) return
    if (e.key === 'Escape') { marks = null; onChange() }
    if (e.key === 'Enter') { e.preventDefault(); apply() } // pengguna keyboard: blok dengan Shift+panah lalu Enter
  }
  editor.view.dom.addEventListener('mouseup', onUp)
  editor.view.dom.addEventListener('keydown', onKey)
  return {
    active: () => !!marks,
    toggle() {
      if (marks) marks = null
      else {
        const { $from, empty } = editor.state.selection
        marks = (empty ? editor.state.storedMarks ?? $from.marks() : $from.marks()).filter((m) => m.type.name !== 'link')
      }
      onChange()
    },
    destroy() {
      editor.view.dom.removeEventListener('mouseup', onUp)
      editor.view.dom.removeEventListener('keydown', onKey)
    },
  }
}

export const SPECIAL_CHARS = [
  '©', '®', '™', '§', '¶', '†', '‡', '•', '…', '–', '—', '‘', '’', '“', '”', '«', '»', '‹', '›',
  '€', '£', '¥', '¢', '$', 'Rp', '°', '±', '×', '÷', '≈', '≠', '≤', '≥', '∞', '√', '∑', '∏', '∆',
  'π', 'Ω', 'µ', 'α', 'β', 'γ', 'δ', 'θ', 'λ', 'σ', '½', '⅓', '¼', '¾', '²', '³', '¹', '‰',
  '←', '→', '↑', '↓', '↔', '⇒', '⇔', '✓', '✗', '★', '☆', '♠', '♣', '♥', '♦', '№', '℃',
]
export const EMOJIS = [
  '😀', '😃', '😄', '😁', '😊', '🙂', '😉', '😍', '🤩', '😎', '🤔', '😐', '😢', '😭', '😡', '😱',
  '👍', '👎', '👏', '🙏', '💪', '👌', '✌️', '👋', '🤝', '✍️', '👀', '💡', '🔥', '⭐', '✨', '🎉',
  '❤️', '💙', '💚', '💛', '✅', '❌', '⚠️', '❗', '❓', '📌', '📎', '📅', '📝', '📄', '📊', '📈',
  '📉', '💼', '🏢', '🏠', '🚀', '⏰', '☎️', '📧', '🔒', '🔑', '🎯', '🏆', '🌱', '🌍', '☀️', '🌧️',
]

function luminance(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? '') || /^rgb\((\d+),\s*(\d+),\s*(\d+)/.exec(hex ?? '')
  if (!m) return null
  const [r, g, b] = m.length === 2 ? [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16)) : m.slice(1, 4).map(Number)
  const lin = (c) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

/**
 * Pemeriksa aksesibilitas sederhana. Mengembalikan [{ key, pos, text, fix? }]; key = kunci pesan di locales.
 * Memeriksa: gambar tanpa teks alternatif, judul melompat tingkat, tabel tanpa baris judul,
 * teks tautan tidak bermakna, judul kosong, dan warna teks terlalu pucat di latar putih.
 */
export function a11yIssues(editor) {
  const issues = []
  let lastLevel = 0
  editor.state.doc.descendants((node, pos) => {
    const name = node.type.name
    if (name === 'image' && !node.attrs.alt?.trim()) issues.push({ key: 'a11yImageAlt', pos, text: '', image: true })
    if (name === 'heading') {
      const level = node.attrs.level
      if (!node.textContent.trim()) issues.push({ key: 'a11yEmptyHeading', pos, text: `H${level}` })
      else if (lastLevel && level > lastLevel + 1) issues.push({ key: 'a11yHeadingSkip', pos, text: `H${lastLevel} → H${level}: ${node.textContent.slice(0, 40)}` })
      lastLevel = level
    }
    if (name === 'table' && !node.firstChild?.firstChild?.type.name.includes('Header')) issues.push({ key: 'a11yTableHeader', pos, text: node.textContent.slice(0, 40), table: true })
    if (node.isText) {
      const link = node.marks.find((m) => m.type.name === 'link')
      if (link && /^(klik di ?sini|di ?sini|click here|here|link|tautan|selengkapnya|read more)$/i.test(node.text.trim())) issues.push({ key: 'a11yLinkText', pos, text: node.text })
      const color = node.marks.find((m) => m.type.name === 'textStyle')?.attrs.color
      const l = luminance(color)
      if (l !== null && (1.05) / (l + 0.05) < 3) issues.push({ key: 'a11yContrast', pos, text: node.text.slice(0, 40) })
    }
  })
  return issues
}
