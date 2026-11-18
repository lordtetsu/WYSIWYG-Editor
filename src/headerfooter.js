// Dialog pengaturan header & footer: isi (teks berformat, gambar/logo, nomor halaman) yang otomatis
// diulang di setiap halaman, halaman yang dikecualikan (mis. sampul), nomor halaman awal, dan jarak dari tepi.
import { Editor } from '@tiptap/core'

const make = (tag, props = {}) => Object.assign(document.createElement(tag), props)

const pickImage = () => new Promise((resolve) => {
  const input = make('input', { type: 'file', accept: 'image/*' })
  input.onchange = () => {
    const file = input.files?.[0]
    if (!file) return
    const r = new FileReader()
    r.onload = () => resolve(r.result)
    r.readAsDataURL(file)
  }
  input.click()
})

/**
 * @param {object} o
 * @param {object} o.text  teks bahasa
 * @param {object} o.page  pengaturan halaman saat ini
 * @param {Array} o.extensions  ekstensi editor (agar format sama dengan dokumen)
 * @param {(changes: object) => void} o.onSave  dipanggil dengan { header, footer, hideHeaderOn, … }
 * @param {Array<[string,string]>} [o.themeVars]
 * @param {HTMLElement} [o.returnFocus]
 */
export function openHeaderFooter({ text, page, extensions, onSave, themeVars = [], returnFocus }) {
  const overlay = make('div', { className: 'de-modal' })
  for (const [k, v] of themeVars) overlay.style.setProperty(k, v)
  const box = make('div', { className: 'de-hf-box' })
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-modal', 'true')
  box.setAttribute('aria-label', text.headerFooter)
  box.append(make('h2', { textContent: text.headerFooter }))

  const editors = []
  function zone(label, html, hideValue, distance) {
    const section = make('section', { className: 'de-hf-zone' })
    section.append(make('h3', { textContent: label }))
    const bar = make('div', { className: 'de-hf-bar' })
    bar.setAttribute('role', 'toolbar')
    bar.setAttribute('aria-label', label)
    const host = make('div', { className: 'de-hf-edit de-content' })
    const editor = new Editor({
      element: host,
      extensions,
      content: html,
      editorProps: { attributes: { class: 'de-content', 'aria-label': label } },
    })
    editors.push(editor)
    const tool = (content, title, run, isActive) => {
      const b = make('button', { type: 'button', title })
      b.innerHTML = content
      b.setAttribute('aria-label', title)
      b.onmousedown = (e) => e.preventDefault()
      b.onclick = () => run(editor.chain().focus())
      if (isActive) editor.on('transaction', () => b.setAttribute('aria-pressed', String(isActive(editor))))
      bar.append(b)
    }
    tool('<b>B</b>', text.bold.title, (c) => c.toggleBold().run(), (e) => e.isActive('bold'))
    tool('<i>I</i>', text.italic.title, (c) => c.toggleItalic().run(), (e) => e.isActive('italic'))
    tool('<u>U</u>', text.underline.title, (c) => c.toggleUnderline().run(), (e) => e.isActive('underline'))
    tool(text.alignLeft.html, text.alignLeft.title, (c) => c.setTextAlign('left').run(), (e) => e.isActive({ textAlign: 'left' }))
    tool(text.alignCenter.html, text.alignCenter.title, (c) => c.setTextAlign('center').run(), (e) => e.isActive({ textAlign: 'center' }))
    tool(text.alignRight.html, text.alignRight.title, (c) => c.setTextAlign('right').run(), (e) => e.isActive({ textAlign: 'right' }))
    tool(text.image.html, text.hfLogo, async (c) => c.setImage({ src: await pickImage() }).run())
    tool(text.hfPageLabel, text.hfPage, (c) => c.insertContent('{page}').run())
    tool(text.hfPagesLabel, text.hfPages, (c) => c.insertContent('{pages}').run())
    const hide = make('input', { type: 'text', value: hideValue, placeholder: text.hfHidePlaceholder })
    const dist = make('input', { type: 'number', min: 0, max: 100, step: 0.5, value: distance })
    const fields = make('div', { className: 'de-hf-fields' })
    const field = (lab, input) => { const l = make('label'); l.append(make('span', { textContent: lab }), input); return l }
    fields.append(field(text.hfHideOn, hide), field(text.hfDistance, dist))
    section.append(bar, host, fields)
    return { section, editor, hide, dist }
  }

  const header = zone(text.hfHeader, page.header, page.hideHeaderOn, page.headerDistance)
  const footer = zone(text.hfFooter, page.footer, page.hideFooterOn, page.footerDistance)
  const first = make('input', { type: 'number', min: 0, max: 9999, step: 1, value: page.firstPageNumber })
  const firstLabel = make('label', { className: 'de-hf-first' })
  firstLabel.append(make('span', { textContent: text.hfFirstNumber }), first)
  const hint = make('small', { textContent: text.hfHint })
  const cancel = make('button', { type: 'button', textContent: text.close })
  const save = make('button', { type: 'button', className: 'de-primary', textContent: text.hfApply })
  const actions = make('div', { className: 'de-print-actions' })
  actions.append(cancel, save)
  box.append(header.section, footer.section, firstLabel, hint, actions)
  overlay.append(box)

  // Isi kosong (hanya paragraf kosong) disimpan sebagai '' agar header/footer benar-benar tidak ada.
  const htmlOf = (e) => (e.isEmpty ? '' : e.getHTML())
  function close() {
    for (const e of editors) e.destroy()
    overlay.remove()
    document.removeEventListener('keydown', onKey, true)
    returnFocus?.focus()
  }
  function onKey(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); close() }
    if (ev.key === 'Tab') {
      const items = [...box.querySelectorAll('button,input,[contenteditable="true"]')]
      const [a, b] = [items[0], items.at(-1)]
      if (ev.shiftKey && document.activeElement === a) { ev.preventDefault(); b.focus() }
      else if (!ev.shiftKey && document.activeElement === b) { ev.preventDefault(); a.focus() }
    }
  }
  cancel.onclick = close
  save.onclick = () => {
    onSave({
      header: htmlOf(header.editor),
      footer: htmlOf(footer.editor),
      hideHeaderOn: header.hide.value,
      hideFooterOn: footer.hide.value,
      headerDistance: header.dist.value,
      footerDistance: footer.dist.value,
      firstPageNumber: first.value,
    })
    close()
  }
  overlay.addEventListener('mousedown', (ev) => ev.target === overlay && close())
  document.addEventListener('keydown', onKey, true)
  document.body.append(overlay)
  header.editor.commands.focus('end')
  return close
}
