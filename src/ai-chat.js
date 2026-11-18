// Panel "AI Chat" di sisi kanan editor (tampil/sembunyi): obrolan dengan konteks dokumen / teks terpilih,
// jawaban bisa disisipkan, menggantikan teks terpilih, atau disalin. Hanya aktif bila backend AI siap (/health).
import { marked } from 'marked'

const make = (tag, props = {}) => Object.assign(document.createElement(tag), props)
const svg = (d) => `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`
const ICON = {
  spark: svg('<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
  newChat: svg('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  history: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>'),
  close: svg('<path d="M15 12H3M10 7l5 5-5 5M21 4v16"/>'),
  send: svg('<path d="M12 19V5M5 12l7-7 7 7"/>'),
  doc: svg('<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6"/>'),
  sel: svg('<path d="M5 3H3v2M9 3h2M15 3h2M21 5V3h-2M3 9v2M21 9v2M3 15v2M21 15v2M3 19v2h2M9 21h2M15 21h2M19 21h2v-2"/>'),
}

// Jawaban AI (Markdown) -> HTML aman untuk ditampilkan: hanya tag & atribut dari daftar putih.
const ALLOWED = new Set(['P', 'BR', 'STRONG', 'EM', 'B', 'I', 'U', 'S', 'DEL', 'CODE', 'PRE', 'UL', 'OL', 'LI', 'BLOCKQUOTE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD', 'A', 'HR', 'SUP', 'SUB'])
export function safeHtml(markdown) {
  const doc = new DOMParser().parseFromString(`<div>${marked.parse(markdown)}</div>`, 'text/html')
  const walk = (node) => {
    for (const el of [...node.children]) {
      if (!ALLOWED.has(el.tagName)) { el.replaceWith(...(/^(SCRIPT|STYLE|IFRAME|OBJECT|EMBED|TEMPLATE)$/.test(el.tagName) ? [] : el.childNodes)); continue }
      for (const a of [...el.attributes]) {
        const keep = el.tagName === 'A' && a.name === 'href' && /^(https?:|mailto:)/i.test(a.value.trim())
        if (!keep) el.removeAttribute(a.name)
      }
      if (el.tagName === 'A') { el.target = '_blank'; el.rel = 'noopener noreferrer' }
      walk(el)
    }
  }
  walk(doc.body.firstElementChild)
  return doc.body.firstElementChild.innerHTML
}

/**
 * @param {object} o
 * @param {import('@tiptap/core').Editor} o.editor
 * @param {{endpoint: string, chatEndpoint?: string, healthEndpoint?: string}} o.ai  hanya URL; akses lewat cookie tiket
 * @param {object} o.text
 * @param {HTMLElement} o.host  wadah samping isi editor (.de-workspace)
 * @param {(ready: boolean, open: boolean) => void} o.onState
 */
export function createAiChat({ editor, ai, text, host, onState }) {
  const chatUrl = ai.chatEndpoint ?? ai.endpoint.replace(/\/api\/ai\/?$/, '/api/ai/chat')
  const healthUrl = ai.healthEndpoint ?? new URL('/health', new URL(ai.endpoint, location.href)).href
  let ready = false
  let open = false
  let chats = [{ id: 1, title: '', messages: [] }]
  let current = chats[0]
  let request = null
  const ctx = { document: true, selection: true }

  const panel = make('aside', { className: 'de-aichat', hidden: true })
  panel.setAttribute('aria-label', text.aiChatTitle)
  const title = make('h2', { className: 'de-aichat-title', textContent: text.aiChatTitle })
  const btn = (html, label, fn, cls = '') => {
    const b = make('button', { type: 'button', title: label, className: cls })
    b.innerHTML = html
    b.setAttribute('aria-label', label)
    b.onclick = fn
    return b
  }
  const newBtn = btn(`${ICON.newChat}<span>${text.aiNewChat}</span>`, text.aiNewChat, () => newChat(), 'de-aichat-new')
  const historyBtn = btn(ICON.history, text.aiHistory, () => toggleHistory())
  historyBtn.setAttribute('aria-haspopup', 'menu')
  const closeBtn = btn(ICON.close, text.aiChatClose, () => api.close())
  const head = make('div', { className: 'de-aichat-head' })
  head.append(title, newBtn, historyBtn, closeBtn)

  const log = make('div', { className: 'de-aichat-log' })
  log.setAttribute('role', 'log')
  log.setAttribute('aria-live', 'polite')
  const status = make('div', { className: 'de-aichat-status' })
  status.setAttribute('aria-live', 'assertive')

  const chip = (icon, label, key) => {
    const b = btn(`${icon}<span>${label}</span>`, label, () => { ctx[key] = !ctx[key]; b.setAttribute('aria-pressed', String(ctx[key])) }, 'de-aichat-chip')
    b.setAttribute('aria-pressed', 'true')
    return b
  }
  const chips = make('div', { className: 'de-aichat-chips' })
  const docChip = chip(ICON.doc, text.aiCtxDocument, 'document')
  const selChip = chip(ICON.sel, text.aiCtxSelection, 'selection')
  chips.append(docChip, selChip)
  const input = make('textarea', { rows: 2, placeholder: text.aiAsk })
  input.setAttribute('aria-label', text.aiAsk)
  const send = btn(ICON.send, text.aiSend, () => ask(), 'de-aichat-send')
  const row = make('div', { className: 'de-aichat-input' })
  row.append(input, send)
  const note = make('small', { className: 'de-aichat-note', textContent: text.aiDisclaimer })
  const foot = make('div', { className: 'de-aichat-foot' })
  foot.append(chips, row, status, note)
  panel.append(head, log, foot)
  host.append(panel)

  // Teks terpilih menentukan apakah chip "Teks terpilih" berlaku.
  const selection = () => {
    const { from, to } = editor.state.selection
    return from === to ? '' : editor.state.doc.textBetween(from, to, '\n', ' ')
  }
  const syncSelChip = () => { selChip.hidden = !selection() }
  editor.on('selectionUpdate', syncSelChip)

  function welcome() {
    const w = make('div', { className: 'de-aichat-welcome' })
    w.innerHTML = `<span class="de-aichat-spark">${ICON.spark}</span>`
    for (const line of text.aiWelcome) w.append(make('p', { textContent: line }))
    return w
  }
  function render() {
    log.replaceChildren()
    title.textContent = current.title || text.aiChatTitle
    if (!current.messages.length) { log.append(welcome()); return }
    for (const m of current.messages) {
      const bubble = make('div', { className: `de-aichat-msg de-aichat-${m.role}` })
      const body = make('div', { className: 'de-aichat-body' })
      if (m.role === 'assistant') body.innerHTML = safeHtml(m.content)
      else body.textContent = m.content
      bubble.append(body)
      if (m.role === 'assistant') {
        const actions = make('div', { className: 'de-aichat-actions' })
        const html = () => marked.parse(m.content)
        actions.append(
          btn(text.aiInsert, text.aiInsert, () => editor.chain().focus().insertContent(html()).run()),
          btn(text.aiReplace, text.aiReplace, () => { if (selection()) editor.chain().focus().insertContent(html()).run() }, 'de-aichat-replace'),
          btn(text.aiCopy, text.aiCopy, () => navigator.clipboard?.writeText(m.content)),
        )
        bubble.append(actions)
      }
      log.append(bubble)
    }
    log.scrollTop = log.scrollHeight
  }

  async function ask() {
    const q = input.value.trim()
    if (!q || request) return
    current.messages.push({ role: 'user', content: q })
    if (!current.title) current.title = q.length > 40 ? `${q.slice(0, 40)}…` : q
    input.value = ''
    render()
    status.className = 'de-aichat-status'
    status.textContent = text.aiWorking
    send.disabled = true
    request = new AbortController()
    try {
      const res = await fetch(chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include', // cookie tiket HttpOnly
        body: JSON.stringify({
          messages: current.messages,
          document: ctx.document ? editor.state.doc.textBetween(0, editor.state.doc.content.size, '\n\n', ' ') : undefined,
          selection: ctx.selection ? selection() || undefined : undefined,
        }),
        signal: request.signal,
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || typeof data.answer !== 'string') throw new Error(data.error || `HTTP ${res.status}`)
      current.messages.push({ role: 'assistant', content: data.answer })
      status.textContent = ''
      render()
    } catch (err) {
      if (err.name === 'AbortError') return
      current.messages.pop() // pertanyaan dikembalikan ke kotak input agar bisa dikirim ulang
      input.value = q
      render()
      status.className = 'de-aichat-status de-aichat-error'
      status.textContent = `${text.aiError}: ${err.message === 'Failed to fetch' ? text.aiUnreachable : err.message}`
    } finally {
      request = null
      send.disabled = false
    }
  }

  function newChat() {
    request?.abort()
    if (current.messages.length) {
      current = { id: Date.now(), title: '', messages: [] }
      chats.unshift(current)
    }
    status.textContent = ''
    render()
    input.focus()
  }

  let historyMenu = null
  function toggleHistory() {
    if (historyMenu) { historyMenu.remove(); historyMenu = null; return }
    historyMenu = make('div', { className: 'de-aichat-history' })
    historyMenu.setAttribute('role', 'menu')
    const items = chats.filter((c) => c.messages.length)
    if (!items.length) historyMenu.append(make('p', { textContent: text.aiNoHistory }))
    for (const c of items) {
      const b = btn('', c.title, () => { current = c; historyMenu.remove(); historyMenu = null; render() })
      b.textContent = c.title
      b.setAttribute('role', 'menuitem')
      historyMenu.append(b)
    }
    head.after(historyMenu)
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() }
  })
  panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); api.close() } })

  const api = {
    isReady: () => ready,
    isOpen: () => open,
    open() {
      if (!ready) return
      open = true
      panel.hidden = false
      syncSelChip()
      render()
      input.focus()
      onState(ready, open)
    },
    close() {
      open = false
      panel.hidden = true
      historyMenu?.remove()
      historyMenu = null
      editor.commands.focus()
      onState(ready, open)
    },
    toggle() { (open ? api.close : api.open)() },
    destroy() {
      request?.abort()
      editor.off('selectionUpdate', syncSelChip)
      panel.remove()
    },
  }

  // Panel hanya bisa dibuka bila backend AI menjawab sehat & terkonfigurasi.
  fetch(healthUrl, { credentials: 'include' })
    .then((r) => (r.ok ? r.json() : null))
    .then((h) => { ready = !!h?.configured })
    .catch(() => { ready = false })
    .finally(() => onState(ready, open))
  return api
}
