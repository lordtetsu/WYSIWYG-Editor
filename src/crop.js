// Jendela crop gambar: area crop bisa digeser/diubah (mouse, sentuh, atau keyboard), rasio tetap opsional,
// angka X/Y/lebar/tinggi (px asli). Hasil = data URL gambar baru (tetap offline & ikut ke Word/PDF/HTML).
const make = (tag, props = {}) => Object.assign(document.createElement(tag), props)
const ASPECTS = [['', null], ['1:1', 1], ['4:3', 4 / 3], ['16:9', 16 / 9], ['3:2', 3 / 2]]

/**
 * @param {object} o
 * @param {string} o.src  sumber gambar
 * @param {object} o.text  teks bahasa
 * @param {(result: {src: string, width: number, height: number, naturalWidth: number}) => void} o.onApply  ukuran dalam px asli
 * @param {Array<[string,string]>} [o.themeVars]
 * @param {HTMLElement} [o.returnFocus]
 */
export function openCrop({ src, text, onApply, themeVars = [], returnFocus }) {
  const overlay = make('div', { className: 'de-modal' })
  for (const [k, v] of themeVars) overlay.style.setProperty(k, v)
  const box = make('div', { className: 'de-crop-box' })
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-modal', 'true')
  box.setAttribute('aria-label', text.cropTitle)

  const img = make('img', { src, alt: '' })
  const stage = make('div', { className: 'de-crop-stage' })
  const rect = make('div', { className: 'de-crop-rect', tabIndex: 0 })
  rect.setAttribute('role', 'group')
  rect.setAttribute('aria-label', text.cropArea)
  for (const corner of ['nw', 'ne', 'sw', 'se']) rect.append(make('span', { className: `de-crop-handle de-crop-${corner}` }))
  stage.append(img, rect)

  const num = () => make('input', { type: 'number', min: 0, step: 1 })
  const inputs = { x: num(), y: num(), w: num(), h: num() }
  const aspect = make('select')
  for (const [label, value] of ASPECTS) aspect.append(make('option', { value: value ?? '', textContent: label || text.cropFree }))
  const field = (label, input) => {
    const l = make('label')
    l.append(make('span', { textContent: label }), input)
    return l
  }
  const error = make('p', { className: 'de-crop-error' })
  error.setAttribute('role', 'alert')
  const reset = make('button', { type: 'button', textContent: text.cropReset })
  const cancel = make('button', { type: 'button', textContent: text.close })
  const apply = make('button', { type: 'button', className: 'de-primary', textContent: text.cropApply })
  const side = make('div', { className: 'de-crop-side' })
  const actions = make('div', { className: 'de-print-actions' })
  actions.append(cancel, apply)
  side.append(make('h2', { textContent: text.cropTitle }), field(text.cropAspect, aspect),
    field(text.cropX, inputs.x), field(text.cropY, inputs.y), field(text.cropW, inputs.w), field(text.cropH, inputs.h),
    reset, make('small', { textContent: text.cropHint }), error, actions)
  box.append(stage, side)
  overlay.append(box)

  // Area crop dalam px asli gambar.
  let natural = { w: 1, h: 1 }
  let crop = { x: 0, y: 0, w: 1, h: 1 }
  const ratio = () => +aspect.value || null
  const scale = () => img.clientWidth / natural.w // px layar per px asli

  // Area tetap di dalam gambar, minimal 10px.
  function clamp(c) {
    const w = Math.max(10, Math.min(c.w, natural.w))
    const h = Math.max(10, Math.min(c.h, natural.h))
    return { w, h, x: Math.min(Math.max(0, c.x), natural.w - w), y: Math.min(Math.max(0, c.y), natural.h - h) }
  }
  function draw() {
    const s = scale()
    Object.assign(rect.style, { left: `${crop.x * s}px`, top: `${crop.y * s}px`, width: `${crop.w * s}px`, height: `${crop.h * s}px` })
    for (const k of ['x', 'y', 'w', 'h']) if (document.activeElement !== inputs[k]) inputs[k].value = Math.round(crop[k])
  }
  // Paskan rasio pada area saat ini (tetap di tengah area lama).
  function fitAspect() {
    const r = ratio()
    if (!r) return
    let { w, h } = crop
    if (w / h > r) w = h * r
    else h = w / r
    crop = clamp({ x: crop.x + (crop.w - w) / 2, y: crop.y + (crop.h - h) / 2, w, h })
  }

  // Seret di dalam area = geser; seret pegangan sudut = ubah ukuran.
  rect.addEventListener('pointerdown', (ev) => {
    ev.preventDefault()
    rect.setPointerCapture(ev.pointerId)
    const corner = ev.target.className.match(/de-crop-(nw|ne|sw|se)/)?.[1]
    const start = { ...crop }
    const s = scale()
    const [px, py] = [ev.clientX, ev.clientY]
    const move = (e) => {
      const dx = (e.clientX - px) / s
      const dy = (e.clientY - py) / s
      if (!corner) {
        crop = clamp({ ...start, x: start.x + dx, y: start.y + dy })
      } else {
        let { x, y, w, h } = start
        if (corner.includes('e')) w += dx
        if (corner.includes('s')) h += dy
        if (corner.includes('w')) { x += dx; w -= dx }
        if (corner.includes('n')) { y += dy; h -= dy }
        const r = ratio()
        if (r) { // tinggi mengikuti lebar; sudut atas menjaga tepi bawah
          const nh = w / r
          if (corner.includes('n')) y += h - nh
          h = nh
        }
        if (x < 0) { w += x; x = 0 }
        if (y < 0) { h += y; y = 0 }
        w = Math.min(Math.max(w, 10), natural.w - x)
        h = Math.min(Math.max(h, 10), natural.h - y)
        crop = { x, y, w, h }
      }
      draw()
    }
    const up = () => {
      rect.removeEventListener('pointermove', move)
      rect.removeEventListener('pointerup', up)
    }
    rect.addEventListener('pointermove', move)
    rect.addEventListener('pointerup', up)
  })
  // Keyboard: panah = geser, Shift+panah = ubah ukuran (10px; Alt = 1px).
  rect.addEventListener('keydown', (ev) => {
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key]
    if (!d) return
    ev.preventDefault()
    const step = ev.altKey ? 1 : 10
    crop = ev.shiftKey
      ? clamp({ ...crop, w: crop.w + d[0] * step, h: ratio() ? (crop.w + d[0] * step) / ratio() : crop.h + d[1] * step })
      : clamp({ ...crop, x: crop.x + d[0] * step, y: crop.y + d[1] * step })
    draw()
  })
  side.addEventListener('input', (ev) => {
    if (ev.target === aspect) fitAspect()
    else {
      const v = Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, +i.value || 0]))
      if (ratio()) { if (ev.target === inputs.h) v.w = v.h * ratio(); else v.h = v.w / ratio() }
      crop = clamp(v)
    }
    draw()
  })
  reset.onclick = () => {
    aspect.value = ''
    crop = { x: 0, y: 0, w: natural.w, h: natural.h }
    draw()
  }

  function close() {
    overlay.remove()
    document.removeEventListener('keydown', onKey, true)
    removeEventListener('resize', draw)
    returnFocus?.focus()
  }
  function onKey(ev) {
    if (ev.key === 'Escape') { ev.preventDefault(); close() }
  }
  cancel.onclick = close
  overlay.addEventListener('mousedown', (ev) => ev.target === overlay && close())
  apply.onclick = async () => {
    try {
      // Gambar dimuat ulang dengan CORS agar kanvas tidak "tercemar" (gambar dari domain lain tanpa izin akan gagal).
      const source = new Image()
      source.crossOrigin = 'anonymous'
      source.src = src
      await source.decode()
      const c = Object.assign(document.createElement('canvas'), { width: Math.round(crop.w), height: Math.round(crop.h) })
      c.getContext('2d').drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, c.width, c.height)
      const type = /^data:image\/jpe?g/i.test(src) || /\.jpe?g($|\?)/i.test(src) ? 'image/jpeg' : 'image/png'
      onApply({ src: c.toDataURL(type, 0.92), width: c.width, height: c.height, naturalWidth: natural.w })
      close()
    } catch {
      error.textContent = text.cropError
    }
  }

  document.addEventListener('keydown', onKey, true)
  addEventListener('resize', draw)
  document.body.append(overlay)
  img.decode().catch(() => {}).then(() => {
    natural = { w: img.naturalWidth || 1, h: img.naturalHeight || 1 }
    crop = { x: 0, y: 0, w: natural.w, h: natural.h }
    for (const i of Object.values(inputs)) i.max = Math.max(natural.w, natural.h)
    draw()
    rect.focus()
  })
}
