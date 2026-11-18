// Ukuran kertas dalam mm [lebar, tinggi]. Dipakai untuk cetak/PDF, unduhan HTML, dan Word.
export const PAPER = {
  A4: [210, 297],
  A5: [148, 210],
  A3: [297, 420],
  F4: [215, 330],
  Letter: [215.9, 279.4],
  Legal: [215.9, 355.6],
}

const SIDES = ['top', 'right', 'bottom', 'left']
const num = (v, fallback) => (Number.isFinite(+v) && v !== '' && v !== null ? +v : fallback)
const clamp = (v, min, max) => Math.min(Math.max(v, min), max)

/**
 * Daftar halaman "1, 3-5, 8-" -> fungsi (nomorHalaman) => boolean. "8-" = halaman 8 dst. Teks tidak valid diabaikan.
 */
export function pageMatcher(spec) {
  const parts = String(spec ?? '').split(/[,;\s]+/).map((p) => p.match(/^(\d+)(?:\s*-\s*(\d*))?$/)).filter(Boolean)
  const ranges = parts.map((m) => [+m[1], m[2] === undefined ? +m[1] : m[2] === '' ? Infinity : +m[2]])
  return (n) => ranges.some(([a, b]) => n >= a && n <= b)
}
// Rapikan teks daftar halaman (hanya angka, koma, tanda hubung).
const cleanPages = (v) => (typeof v === 'string' ? v.replace(/[^\d,\-\s]/g, '').replace(/\s+/g, ' ').trim() : '')

/** Watermark teks; null bila teks kosong. angle dalam derajat, size dalam pt (0 = otomatis menyesuaikan halaman). */
export function normalizeWatermark(w) {
  const text = typeof w?.text === 'string' ? w.text.trim().slice(0, 100) : ''
  if (!text) return null
  return {
    text,
    color: /^#[0-9a-f]{6}$/i.test(w.color) ? w.color : '#808080',
    opacity: clamp(num(w.opacity, 0.15), 0.02, 1),
    angle: clamp(num(w.angle, -45), -90, 90),
    size: clamp(num(w.size, 0), 0, 400),
  }
}

/**
 * Rapikan opsi `page` menjadi { size, orientation, width, height, margin, header, footer,
 * headerDistance, footerDistance, watermark } (ukuran dalam mm).
 * size: nama di PAPER atau { width, height }; orientation: 'portrait' | 'landscape'
 * (width/height hasil sudah sesuai orientasi); margin: angka (semua sisi) atau objek per sisi.
 * header/footer: HTML ({page} & {pages} = nomor & jumlah halaman); jarak header/footer dari tepi kertas.
 * Nilai tidak valid jatuh ke default (A4, margin 20mm); margin dibatasi agar area isi minimal 20mm.
 */
export function normalizePage(page = {}) {
  // { width, height } atau hasil normalizePage sendiri ({ size: 'custom', width, height })
  const dims = typeof page.size === 'object' && page.size !== null ? page.size : page.size === 'custom' ? page : null
  const named = dims ? null : PAPER[page.size] ? page.size : 'A4' // nama tak dikenal -> A4
  const [w, h] = named ? PAPER[named] : [num(dims.width, PAPER.A4[0]), num(dims.height, PAPER.A4[1])]
  let width = clamp(w, 50, 1000)
  let height = clamp(h, 50, 1000)
  // Tanpa orientation: ukuran bernama = portrait, ukuran kustom = sesuai angka yang diberikan.
  const orientation = ['portrait', 'landscape'].includes(page.orientation) ? page.orientation : width > height ? 'landscape' : 'portrait'
  if ((orientation === 'landscape') !== (width > height) && width !== height) [width, height] = [height, width]
  const m = typeof page.margin === 'object' && page.margin ? page.margin : {}
  const all = num(typeof page.margin === 'object' ? undefined : page.margin, 20)
  const margin = Object.fromEntries(SIDES.map((s) => [s, clamp(num(m[s], all), 0, 100)]))
  // area isi minimal 20mm
  margin.left = Math.min(margin.left, width - 20)
  margin.right = clamp(margin.right, 0, width - 20 - margin.left)
  margin.top = Math.min(margin.top, height - 20)
  margin.bottom = clamp(margin.bottom, 0, height - 20 - margin.top)
  return {
    size: named ?? 'custom',
    orientation,
    width,
    height,
    margin,
    header: typeof page.header === 'string' ? page.header : '',
    footer: typeof page.footer === 'string' ? page.footer : '',
    // Jarak header/footer dari tepi kertas (default Word 12,7mm), tidak melebihi margin.
    headerDistance: clamp(num(page.headerDistance, 12.7), 0, margin.top),
    footerDistance: clamp(num(page.footerDistance, 12.7), 0, margin.bottom),
    watermark: normalizeWatermark(page.watermark),
    // Halaman tanpa header/footer (mis. "1" untuk sampul) & nomor halaman pertama.
    hideHeaderOn: cleanPages(page.hideHeaderOn),
    hideFooterOn: cleanPages(page.hideFooterOn),
    firstPageNumber: Math.round(clamp(num(page.firstPageNumber, 1), 0, 9999)),
  }
}

/** Cari nama kertas yang cocok (toleransi 1mm, dua orientasi); null bila tidak ada. */
export function matchPaper(width, height) {
  const [a, b] = [Math.min(width, height), Math.max(width, height)]
  return Object.keys(PAPER).find((k) => Math.abs(PAPER[k][0] - a) <= 1 && Math.abs(PAPER[k][1] - b) <= 1) ?? null
}

export const mmToTwip = (mm) => Math.round((mm * 1440) / 25.4)
export const twipToMm = (twip) => Math.round(((twip * 25.4) / 1440) * 10) / 10
