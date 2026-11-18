// "Interaction with AI": klik kanan pada teks yang diblok -> ketik instruksi -> backend (opsi `ai.endpoint`)
// meneruskan ke AI -> jawaban langsung menggantikan teks yang diblok. Kunci API tetap di backend.
import { getHTMLFromFragment } from '@tiptap/core'

const make = (tag, props = {}) => Object.assign(document.createElement(tag), props)

/**
 * @param {import('@tiptap/core').Editor} editor
 * @param {{endpoint: string}} options  endpoint = URL webserver AI. Tidak ada token di browser: akses dibuktikan
 *        lewat cookie HttpOnly berisi tiket yang dibuat backend aplikasi (lihat webserver/README.md).
 * @param {object} text  teks bahasa
 * @param {HTMLElement} host  wadah editor (variabel warna tema ikut terpakai)
 */
export function setupAi(editor, { endpoint }, text, host) {
  let menu = null
  let panel = null
  let request = null

  const closeMenu = () => {
    menu?.remove()
    menu = null
    document.removeEventListener('mousedown', outsideMenu, true)
  }
  const outsideMenu = (ev) => { if (!menu?.contains(ev.target)) closeMenu() }

  function closePanel() {
    request?.abort()
    request = null
    panel?.remove()
    panel = null
    if (!editor.isDestroyed) {
      editor.setEditable(true)
      editor.commands.focus()
    }
  }

  function place(el, x, y) {
    host.append(el)
    const { width, height } = el.getBoundingClientRect()
    el.style.left = `${Math.max(8, Math.min(x, innerWidth - width - 8))}px`
    el.style.top = `${Math.max(8, Math.min(y, innerHeight - height - 8))}px`
  }

  // Klik kanan: menu khusus hanya bila ada teks yang diblok; selain itu menu bawaan browser.
  function onContextMenu(ev) {
    if (editor.state.selection.empty || !editor.isEditable) return
    ev.preventDefault()
    closeMenu()
    menu = make('div', { className: 'de-ctx' })
    menu.setAttribute('role', 'menu')
    const item = make('button', { type: 'button', textContent: text.aiMenu.label })
    item.setAttribute('role', 'menuitem')
    item.onclick = () => {
      closeMenu()
      openPanel()
    }
    menu.append(item)
    // Tombol keyboard menu konteks (tanpa posisi mouse) -> dekat teks yang diblok.
    const at = ev.clientX || ev.clientY ? { x: ev.clientX, y: ev.clientY } : editor.view.coordsAtPos(editor.state.selection.to)
    place(menu, at.x ?? at.left, at.y ?? at.bottom)
    item.focus()
    menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') { closeMenu(); editor.commands.focus() } })
    document.addEventListener('mousedown', outsideMenu, true)
  }

  function openPanel() {
    closePanel()
    const { from, to } = editor.state.selection
    if (from === to) return
    const $from = editor.state.doc.resolve(from)
    const $to = editor.state.doc.resolve(to)
    const html = getHTMLFromFragment(editor.state.doc.slice(from, to).content, editor.schema)

    panel = make('div', { className: 'de-ai' })
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', text.aiMenu.title)
    const heading = make('strong', { textContent: text.aiMenu.label })
    const input = make('textarea', { rows: 3, placeholder: text.aiPlaceholder })
    input.setAttribute('aria-label', text.aiInstruction)
    const status = make('div', { className: 'de-ai-status' })
    status.setAttribute('aria-live', 'polite')
    const cancel = make('button', { type: 'button', textContent: text.aiCancel })
    const submit = make('button', { type: 'button', textContent: text.aiSubmit, className: 'de-primary' })
    const actions = make('div', { className: 'de-ai-actions' })
    actions.append(cancel, submit)
    panel.append(heading, input, status, actions)

    const busy = (on) => {
      input.disabled = submit.disabled = on
      editor.setEditable(!on) // posisi teks yang diblok tidak boleh bergeser selama menunggu
    }

    async function send() {
      const instruction = input.value.trim()
      if (!instruction) { input.focus(); return }
      busy(true)
      status.className = 'de-ai-status'
      status.textContent = text.aiWorking
      request = new AbortController()
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include', // cookie tiket HttpOnly
          body: JSON.stringify({ instruction, html }),
          signal: request.signal,
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok || typeof data.answer !== 'string') throw new Error(data.error || `HTTP ${res.status}`)
        let answer = data.answer.trim()
        // Blok sebagian paragraf -> sisipkan isinya saja agar paragraf tidak terpecah.
        const inline = answer.match(/^<p>([\s\S]*)<\/p>$/)
        if ($from.sameParent($to) && inline && !/<\/?(p|h\d|ul|ol|table|blockquote|pre)\b/i.test(inline[1])) answer = inline[1]
        editor.setEditable(true)
        editor.chain().focus().insertContentAt({ from, to }, answer).run()
        request = null
        closePanel()
      } catch (err) {
        if (err.name === 'AbortError') return
        busy(false)
        status.className = 'de-ai-status de-ai-error'
        status.textContent = `${text.aiError}: ${err.message === 'Failed to fetch' ? text.aiUnreachable : err.message}`
        input.focus()
      }
    }

    submit.onclick = send
    cancel.onclick = closePanel
    panel.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); closePanel() }
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); send() }
    })
    const end = editor.view.coordsAtPos(to)
    place(panel, end.left, end.bottom + 6)
    input.focus()
  }

  editor.view.dom.addEventListener('contextmenu', onContextMenu)
  return {
    open: openPanel,
    destroy() {
      closeMenu()
      closePanel()
      editor.view.dom.removeEventListener('contextmenu', onContextMenu)
    },
  }
}
