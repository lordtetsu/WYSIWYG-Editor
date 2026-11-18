// Cari & ganti: hasil disorot dengan dekorasi ProseMirror (tidak mengubah dokumen), ganti satu / semua
// dengan format teks tetap (tebal, warna, dll. ikut dari teks yang diganti).
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

const key = new PluginKey('deFind')

function findMatches(doc, query, caseSensitive) {
  if (!query) return []
  const needle = caseSensitive ? query : query.toLocaleLowerCase()
  const matches = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return
    // Teks blok dirangkai (termasuk lintas tanda format) dengan peta posisi per karakter.
    let text = ''
    const map = []
    node.descendants((child, offset) => {
      if (child.isText) {
        for (let i = 0; i < child.text.length; i++) map.push(pos + 1 + offset + i)
        text += child.text
      } else if (child.isLeaf) {
        map.push(pos + 1 + offset)
        text += '￼'
      }
    })
    const hay = caseSensitive ? text : text.toLocaleLowerCase()
    for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + needle.length)) {
      matches.push({ from: map[i], to: map[i + needle.length - 1] + 1 })
    }
    return false
  })
  return matches
}

export const FindReplace = Extension.create({
  name: 'findReplace',
  addProseMirrorPlugins() {
    return [new Plugin({
      key,
      state: {
        init: () => ({ query: '', caseSensitive: false, index: 0, matches: [] }),
        apply(tr, prev) {
          const meta = tr.getMeta(key)
          const next = meta ? { ...prev, ...meta } : prev
          if (!meta && !tr.docChanged) return prev
          return { ...next, matches: findMatches(tr.doc, next.query, next.caseSensitive) }
        },
      },
      props: {
        decorations(state) {
          const { matches, index } = key.getState(state)
          if (!matches.length) return null
          return DecorationSet.create(state.doc, matches.map((m, i) => Decoration.inline(m.from, m.to, { class: i === index ? 'de-find-current' : 'de-find-hit' })))
        },
      },
    })]
  },
})

const make = (tag, props = {}) => Object.assign(document.createElement(tag), props)

/** Panel cari & ganti di bawah toolbar. Mengembalikan fungsi penutup. */
export function openFindPanel(editor, text, host, onClose) {
  const panel = make('div', { className: 'de-find' })
  panel.setAttribute('role', 'search')
  panel.setAttribute('aria-label', text.find.title)
  const query = make('input', { type: 'search', placeholder: text.findPlaceholder })
  query.setAttribute('aria-label', text.findPlaceholder)
  const replace = make('input', { type: 'text', placeholder: text.replacePlaceholder })
  replace.setAttribute('aria-label', text.replacePlaceholder)
  const caseBox = make('input', { type: 'checkbox' })
  const caseLabel = make('label', { className: 'de-find-case' })
  caseLabel.append(caseBox, text.findCase)
  const count = make('span', { className: 'de-find-count' })
  count.setAttribute('aria-live', 'polite')
  const btn = (label, title, fn) => {
    const b = make('button', { type: 'button', textContent: label, title })
    b.setAttribute('aria-label', title)
    b.onmousedown = (e) => e.preventDefault()
    b.onclick = fn
    return b
  }
  const state = () => key.getState(editor.state)
  const setMeta = (meta) => editor.view.dispatch(editor.state.tr.setMeta(key, meta))
  const update = () => {
    const { matches, index } = state()
    count.textContent = matches.length ? `${index + 1}/${matches.length}` : query.value ? text.findNone : ''
  }
  const go = (dir) => {
    const { matches, index } = state()
    if (!matches.length) return
    const i = (index + dir + matches.length) % matches.length
    setMeta({ index: i })
    const m = matches[i]
    editor.commands.setTextSelection(m)
    editor.view.domAtPos(m.from).node?.parentElement?.scrollIntoView?.({ block: 'center' })
    update()
  }
  const search = () => {
    setMeta({ query: query.value, caseSensitive: caseBox.checked, index: 0 })
    update()
  }
  // Ganti dengan teks baru yang membawa format teks lama.
  const replaceAt = (tr, m) => {
    const marks = tr.doc.resolve(m.from).marksAcross(tr.doc.resolve(m.to)) ?? []
    if (replace.value) tr.replaceWith(m.from, m.to, editor.schema.text(replace.value, marks))
    else tr.delete(m.from, m.to)
  }
  const replaceOne = () => {
    const { matches, index } = state()
    const m = matches[index]
    if (!m) return
    const tr = editor.state.tr
    replaceAt(tr, m)
    editor.view.dispatch(tr)
    update()
  }
  const replaceAll = () => {
    const { matches } = state()
    if (!matches.length) return
    const tr = editor.state.tr
    for (const m of [...matches].reverse()) replaceAt(tr, m)
    editor.view.dispatch(tr)
    count.textContent = text.findReplaced.replace('{n}', matches.length)
  }
  query.addEventListener('input', search)
  caseBox.addEventListener('change', search)
  panel.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target === query) { e.preventDefault(); go(e.shiftKey ? -1 : 1) }
    if (e.key === 'Enter' && e.target === replace) { e.preventDefault(); replaceOne() }
    if (e.key === 'Escape') { e.preventDefault(); close() }
  })
  const row1 = make('div', { className: 'de-find-row' })
  row1.append(query, btn('↑', text.findPrev, () => go(-1)), btn('↓', text.findNext, () => go(1)), count, caseLabel)
  const row2 = make('div', { className: 'de-find-row' })
  row2.append(replace, btn(text.replaceOne, text.replaceOne, replaceOne), btn(text.replaceAll, text.replaceAll, replaceAll), btn('✕', text.close, () => close()))
  panel.append(row1, row2)
  host.after(panel)
  const selected = editor.state.doc.textBetween(editor.state.selection.from, editor.state.selection.to)
  if (selected && !selected.includes('\n')) query.value = selected
  search()
  query.focus()
  query.select()
  function close() {
    setMeta({ query: '', index: 0 })
    panel.remove()
    onClose?.()
    editor.commands.focus()
  }
  return close
}
