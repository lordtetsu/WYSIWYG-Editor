// Watermark teks: SVG (editor, pratinjau, cetak/PDF, HTML) dan PNG (Word). Ukuran halaman dalam mm.
const PT_PER_MM = 72 / 25.4
const escapeXml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

// Ukuran huruf (pt): yang diatur pengguna, atau otomatis agar teks memenuhi ±75% panjang lintasan pada sudut tsb.
export function watermarkFontPt(wm, width, height) {
  if (wm.size > 0) return wm.size
  const rad = (Math.abs(wm.angle) * Math.PI) / 180
  const room = Math.min(Math.cos(rad) > 0.01 ? width / Math.cos(rad) : Infinity, Math.sin(rad) > 0.01 ? height / Math.sin(rad) : Infinity)
  return Math.min(200, (0.75 * room * PT_PER_MM) / (wm.text.length * 0.62))
}

/** SVG seukuran halaman (mm) dengan teks di tengah. */
export function watermarkSvg(wm, width, height) {
  const sizeMm = watermarkFontPt(wm, width, height) / PT_PER_MM
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}mm" height="${height}mm" viewBox="0 0 ${width} ${height}" aria-hidden="true">` +
    `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="central" transform="rotate(${wm.angle} ${width / 2} ${height / 2})" ` +
    `fill="${wm.color}" fill-opacity="${wm.opacity}" font-family="Calibri, Carlito, Arial, sans-serif" font-weight="bold" font-size="${sizeMm.toFixed(2)}">${escapeXml(wm.text)}</text></svg>`
}

export const watermarkDataUrl = (wm, width, height) => `url("data:image/svg+xml;charset=utf-8,${encodeURIComponent(watermarkSvg(wm, width, height))}")`

/** PNG seukuran halaman (96 dpi) untuk header Word; hanya di browser. */
export async function watermarkPng(wm, width, height) {
  const px = (mm) => Math.round((mm * 96) / 25.4)
  const canvas = Object.assign(document.createElement('canvas'), { width: px(width), height: px(height) })
  const g = canvas.getContext('2d')
  g.globalAlpha = wm.opacity
  g.fillStyle = wm.color
  g.font = `bold ${(watermarkFontPt(wm, width, height) * 96) / 72}px Calibri, Carlito, Arial, sans-serif`
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  g.translate(canvas.width / 2, canvas.height / 2)
  g.rotate((wm.angle * Math.PI) / 180)
  g.fillText(wm.text, 0, 0)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  return { data: new Uint8Array(await blob.arrayBuffer()), width: canvas.width, height: canvas.height, text: wm.text }
}

/**
 * Kolom pengaturan watermark (dipakai di popover toolbar & pratinjau cetak).
 * @param {object} text  teks bahasa
 * @param {object|null} wm  watermark saat ini
 * @param {(wm: object|null) => void} onChange  dipanggil setiap ada perubahan (null = tanpa watermark)
 */
export function watermarkFields(text, wm, onChange) {
  const make = (tag, props = {}) => Object.assign(document.createElement(tag), props)
  const field = (label, input) => {
    const l = make('label')
    l.append(make('span', { textContent: label }), input)
    return l
  }
  const current = wm ?? { text: '', color: '#808080', opacity: 0.15, angle: -45, size: 0 }
  const input = make('input', { type: 'text', value: current.text, placeholder: text.watermarkPlaceholder, maxLength: 100 })
  const color = make('input', { type: 'color', value: current.color })
  const opacity = make('input', { type: 'range', min: 0.05, max: 0.6, step: 0.05, value: current.opacity })
  const angle = make('select')
  for (const [value, label] of [[-45, text.watermarkDiagonal], [0, text.watermarkHorizontal], [45, text.watermarkDiagonalDown]]) angle.append(make('option', { value, textContent: label }))
  angle.value = String([-45, 0, 45].includes(current.angle) ? current.angle : -45)
  const size = make('input', { type: 'number', min: 0, max: 400, step: 2, value: current.size })
  const remove = make('button', { type: 'button', textContent: text.watermarkRemove, className: 'de-secondary' })
  const read = () => (input.value.trim()
    ? { text: input.value, color: color.value, opacity: +opacity.value, angle: +angle.value, size: +size.value || 0 }
    : null)
  const wrap = make('div', { className: 'de-wm-fields' })
  wrap.addEventListener('input', () => onChange(read()))
  remove.onclick = () => {
    input.value = ''
    onChange(null)
    input.focus()
  }
  wrap.append(
    field(text.watermarkText, input),
    field(text.watermarkColor, color),
    field(text.watermarkOpacity, opacity),
    field(text.watermarkAngle, angle),
    field(text.watermarkSize, size),
    remove,
  )
  return { element: wrap, focus: () => input.select() }
}
