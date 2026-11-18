// Rumus matematika (LaTeX -> MathML bawaan browser), catatan kaki, dan video (file atau YouTube/Vimeo).
import { Node } from '@tiptap/core'
import temml from 'temml'

/** LaTeX -> string MathML (aman: perintah berisiko seperti \href dimatikan bawaan temml, trust=false). */
export const renderMath = (latex, display = false) =>
  temml.renderToString(latex ?? '', { displayMode: display, annotate: true, xml: true, throwOnError: false })

/** Rumus inline atau blok (display). Disimpan sebagai <span data-latex> berisi MathML, jadi tampil tanpa library. */
export const MathNode = Node.create({
  name: 'math',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ latex: { default: '' }, display: { default: false } }),
  parseHTML: () => [
    { tag: 'span[data-latex]', priority: 1000, getAttrs: (el) => ({ latex: el.getAttribute('data-latex'), display: el.hasAttribute('data-display') }) },
    // MathML dari aplikasi lain yang menyertakan sumber LaTeX
    { tag: 'math', getAttrs: (el) => {
      const tex = el.querySelector('annotation[encoding="application/x-tex"]')?.textContent
      return tex ? { latex: tex, display: el.getAttribute('display') === 'block' } : false
    } },
  ],
  renderHTML({ node }) {
    const attrs = { 'data-latex': node.attrs.latex, class: 'de-math', ...(node.attrs.display ? { 'data-display': '' } : {}) }
    if (typeof document === 'undefined') return ['span', attrs, node.attrs.latex]
    const span = document.createElement('span')
    for (const [k, v] of Object.entries(attrs)) span.setAttribute(k, v)
    span.innerHTML = renderMath(node.attrs.latex, node.attrs.display)
    return span
  },
})

/** Catatan kaki: nomor otomatis; isinya muncul di bawah halaman (pratinjau/cetak/PDF/HTML) dan sebagai footnote asli di Word. */
export const Footnote = Node.create({
  name: 'footnote',
  group: 'inline',
  inline: true,
  atom: true,
  selectable: true,
  addAttributes: () => ({ text: { default: '' } }),
  parseHTML: () => [{ tag: 'sup[data-footnote]', priority: 1000, getAttrs: (el) => ({ text: el.getAttribute('data-footnote') ?? '' }) }],
  renderHTML: ({ node }) => ['sup', { 'data-footnote': node.attrs.text, class: 'de-fn', title: node.attrs.text }],
})

/** URL YouTube/Vimeo -> alamat embed resmi; lainnya null. Hanya dua layanan ini yang boleh jadi iframe. */
export function embedUrl(url = '') {
  let m = url.match(/^https?:\/\/(?:www\.|m\.)?(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/)
  if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}`
  m = url.match(/^https?:\/\/(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d+)/)
  return m ? `https://player.vimeo.com/video/${m[1]}` : null
}

/** Sumber video yang diterima: embed YouTube/Vimeo, http(s), data:video, atau path relatif. */
export const videoSrc = (url = '') => embedUrl(url) ?? (/^(https?:\/\/|data:video\/|\/|\.\.?\/)/i.test(url.trim()) ? url.trim() : null)
const srcAttrs = (url) => {
  const src = videoSrc(url ?? '')
  return src ? { src } : false
}

// iframe hanya diterima bila YouTube/Vimeo
const embedAttrs = (el) => {
  const src = embedUrl(el.getAttribute('src') ?? '')
  return src ? { src } : false
}

export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes: () => ({ src: { default: null } }),
  parseHTML: () => [
    { tag: 'div[data-video]', priority: 1000, getAttrs: (el) => {
      const media = el.querySelector('iframe,video')
      return media?.tagName === 'IFRAME' ? embedAttrs(media) : srcAttrs(media?.getAttribute('src'))
    } },
    { tag: 'video', getAttrs: (el) => srcAttrs(el.getAttribute('src') ?? el.querySelector('source')?.getAttribute('src')) },
    { tag: 'iframe', getAttrs: embedAttrs },
  ],
  renderHTML({ node }) {
    const src = node.attrs.src
    const embed = embedUrl(src)
    return ['div', { 'data-video': '', class: 'de-video' }, embed
      ? ['iframe', { src: embed, title: 'Video', loading: 'lazy', allowfullscreen: 'true', referrerpolicy: 'strict-origin-when-cross-origin',
        allow: 'fullscreen; picture-in-picture; encrypted-media', sandbox: 'allow-scripts allow-same-origin allow-presentation allow-popups' }]
      : ['video', { src, controls: 'true', preload: 'metadata' }]]
  },
})
