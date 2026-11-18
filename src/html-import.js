// Impor HTML (browser): halaman dirender di iframe ber-sandbox TANPA skrip, lalu gaya akhirnya (dari CSS class,
// bukan hanya atribut style) dibaca dan diterjemahkan ke format yang dimengerti editor: tebal/miring, huruf
// kapital, warna, jenis huruf, perataan, kotak sorotan (-> kutipan), dan SVG (-> gambar).
// Navigasi, sidebar, tombol, dan form dibuang; isi diambil dari <main>/<article> bila ada.

const JUNK = 'script,style,noscript,template,link,meta,nav,button,input,select,textarea,form,iframe,object,embed,dialog,progress'
const BLOCKS = 'p,h1,h2,h3,h4,h5,h6,li,td,th,div,figcaption,blockquote,section,article,header,footer'
const SVG_PROPS = ['fill', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-dasharray', 'opacity', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'letter-spacing']

function parseColor(value) {
  const m = value.match(/rgba?\(([^)]+)\)/)
  if (!m) return null
  const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number)
  return { r, g, b, a }
}
const luminance = ({ r, g, b }) => (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
const hex = ({ r, g, b }) => `#${[r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('')}`
const visibleBackground = (cs) => {
  const c = parseColor(cs.backgroundColor)
  return c && c.a > 0.02 && !(c.r > 245 && c.g > 245 && c.b > 245)
}
// Huruf mirip bawaan editor tidak perlu ditulis ulang.
function family(cs) {
  const first = cs.fontFamily.split(',')[0].replace(/["']/g, '').trim()
  if (!first || /^(Calibri|Arial|Helvetica|Helvetica Neue|sans-serif|system-ui|-apple-system|Segoe UI|inherit)$/i.test(first)) return null
  return cs.fontFamily
}

function svgToImg(svg, win) {
  // Gaya dari CSS halaman ditanam ke tiap elemen agar gambar tetap sama di luar halaman asalnya.
  for (const el of [svg, ...svg.querySelectorAll('*')]) {
    const cs = win.getComputedStyle(el)
    const style = SVG_PROPS.map((p) => `${p}:${cs.getPropertyValue(p)}`).join(';')
    el.setAttribute('style', `${style};${el.getAttribute('style') ?? ''}`)
  }
  const rect = svg.getBoundingClientRect()
  if (!svg.getAttribute('viewBox') && rect.width && rect.height) svg.setAttribute('viewBox', `0 0 ${rect.width} ${rect.height}`)
  // Ukuran gambar mengikuti rasio viewBox agar isi diagram memenuhi gambar (bukan menyusut di tengah).
  const [, , vw, vh] = (svg.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number)
  const width = Math.round(rect.width) || vw || 300
  svg.setAttribute('width', width)
  svg.setAttribute('height', vw && vh ? Math.round((width * vh) / vw) : Math.round(rect.height) || 150)
  const img = svg.ownerDocument.createElement('img')
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(new win.XMLSerializer().serializeToString(svg))}`
  img.alt = svg.getAttribute('aria-label') ?? svg.querySelector('title')?.textContent ?? ''
  img.setAttribute('width', Math.round(Math.min(rect.width || 640, 680)))
  return img
}

function convert(doc) {
  const win = doc.defaultView
  const root = doc.querySelector('main, [role=main], article') ?? doc.body
  const cs = (el) => win.getComputedStyle(el)
  const baseColor = cs(root).color

  // --- Tahap 1: baca gaya akhir (sebelum struktur diubah) ---------------------------------------------
  const hidden = [...root.querySelectorAll('*')].filter((el) => cs(el).display === 'none' || el.hidden)
  const svgs = [...root.querySelectorAll('svg')].filter((s) => !s.parentElement.closest('svg'))
  const texts = []
  const walker = doc.createTreeWalker(root, win.NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue.trim() || n.parentElement.closest('svg')) continue
    const s = cs(n.parentElement)
    const inHeading = n.parentElement.closest('h1,h2,h3,h4,h5,h6,th')
    const color = parseColor(s.color)
    texts.push({
      node: n,
      bold: !inHeading && +s.fontWeight >= 600,
      italic: s.fontStyle === 'italic' || s.fontStyle.startsWith('oblique'),
      transform: s.textTransform,
      color: color && s.color !== baseColor && luminance(color) < 0.75 && !n.parentElement.closest('a') ? hex(color) : null,
      family: family(s),
    })
  }
  const aligns = [...root.querySelectorAll(BLOCKS)].map((el) => [el, cs(el).textAlign]).filter(([, a]) => ['center', 'right', 'justify', 'end'].includes(a))
  // Elemen inline yang tampil sebagai blok di dalam judul/paragraf (mis. label "Bagian" di atas judul bab).
  const breaks = [...root.querySelectorAll('h1 *,h2 *,h3 *,h4 *,h5 *,h6 *,p *')].filter((el) => ['block', 'flex', 'grid'].includes(cs(el).display) && el.nextSibling)
  // Wadah flex/grid berisi potongan inline (mis. "Bagian I" ... "Halaman 4–14") -> satu baris dengan pemisah.
  const flexRows = [...root.querySelectorAll('div,section,header,footer')].filter((el) =>
    ['flex', 'inline-flex', 'grid'].includes(cs(el).display) && el.children.length > 1 &&
    [...el.children].every((c) => ['SPAN', 'A', 'STRONG', 'EM', 'B', 'I', 'SMALL'].includes(c.tagName)))
  // Kotak sorotan: garis kiri tebal atau latar berwarna -> kutipan.
  const callouts = [...root.querySelectorAll('div,section,aside')].filter((el) => {
    const s = cs(el)
    return (parseFloat(s.borderLeftWidth) >= 2 && s.borderLeftStyle !== 'none') || visibleBackground(s)
  }).filter((el) => el.textContent.trim() && !el.querySelector('table,figure,svg'))

  // --- Tahap 2: ubah struktur ---------------------------------------------------------------------------
  for (const el of root.querySelectorAll(JUNK)) el.remove()
  if (root === doc.body) for (const el of root.querySelectorAll('aside')) el.remove() // sidebar halaman
  for (const el of hidden) el.remove()
  for (const svg of svgs) if (svg.isConnected) svg.replaceWith(svgToImg(svg, win))

  for (const t of texts) {
    if (!t.node.isConnected) continue
    let text = t.node.nodeValue
    if (t.transform === 'uppercase') text = text.toUpperCase()
    else if (t.transform === 'lowercase') text = text.toLowerCase()
    else if (t.transform === 'capitalize') text = text.replace(/(^|\s)(\S)/g, (m, sp, ch) => sp + ch.toUpperCase())
    let node = doc.createTextNode(text)
    const wrap = (tag, style) => {
      const el = doc.createElement(tag)
      if (style) el.setAttribute('style', style)
      el.append(node)
      node = el
    }
    const style = [t.color && `color: ${t.color}`, t.family && `font-family: ${t.family}`].filter(Boolean).join('; ')
    if (style) wrap('span', style)
    if (t.italic) wrap('em')
    if (t.bold) wrap('strong')
    t.node.replaceWith(node)
  }

  for (const [el, align] of aligns) if (el.isConnected) el.style.textAlign = align === 'end' ? 'right' : align
  for (const el of breaks) {
    if (!el.isConnected) continue
    const block = el.closest('h1,h2,h3,h4,h5,h6,p')
    // Label di awal judul (mis. "Bagian I • …" di atas "Bab 1.1") -> paragraf sendiri sebelum judul.
    if (block && block !== el && block.firstChild === el) {
      const p = doc.createElement('p')
      p.append(...el.childNodes)
      block.before(p)
      el.remove()
    } else el.after(doc.createElement('br'))
  }
  for (const el of flexRows) {
    if (!el.isConnected) continue
    const p = doc.createElement('p')
    p.style.textAlign = el.style.textAlign
    ;[...el.children].forEach((c, i) => { if (i) p.append(doc.createTextNode('  ·  ')); p.append(c) })
    el.replaceWith(p)
  }
  for (const el of callouts) {
    if (!el.isConnected) continue
    const q = doc.createElement('blockquote')
    q.append(...el.childNodes)
    el.replaceWith(q)
  }
  // div yang hanya berisi teks/inline -> paragraf (agar perataan & pemisah paragraf tetap).
  for (const div of [...root.querySelectorAll('div')].reverse()) {
    if (!div.isConnected || div.querySelector(BLOCKS + ',table,ul,ol,img,hr,pre,figure')) continue
    if (!div.textContent.trim()) { div.remove(); continue }
    const p = doc.createElement('p')
    if (div.style.textAlign) p.style.textAlign = div.style.textAlign
    p.append(...div.childNodes)
    div.replaceWith(p)
  }
  // Teks langsung di kutipan dibungkus paragraf.
  for (const q of root.querySelectorAll('blockquote')) {
    const loose = [...q.childNodes].filter((n) => n.nodeType === 3 ? n.nodeValue.trim() : !n.matches?.(BLOCKS + ',ul,ol,table'))
    if (loose.length) {
      const p = doc.createElement('p')
      loose[0].before(p)
      p.append(...loose)
    }
  }
  return root.innerHTML
}

/** HTML lengkap (teks file) -> HTML isi yang rapi untuk editor. Hanya di browser. */
export async function htmlToContent(source) {
  const frame = document.createElement('iframe')
  // allow-same-origin agar isinya bisa dibaca; TANPA allow-scripts: skrip & onclick dari file tidak dijalankan.
  frame.setAttribute('sandbox', 'allow-same-origin')
  frame.style.cssText = 'position:fixed;left:-10000px;top:0;width:1000px;height:800px;border:0;visibility:hidden'
  document.body.append(frame)
  try {
    await new Promise((resolve) => {
      frame.onload = resolve
      frame.srcdoc = source
    })
    await frame.contentDocument.fonts?.ready
    return convert(frame.contentDocument)
  } finally {
    frame.remove()
  }
}
