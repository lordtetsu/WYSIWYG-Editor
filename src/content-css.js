// CSS tampilan dokumen (seperti content_css TinyMCE): aturan dari file CSS diterapkan ke ISI dokumen saja —
// di editor, pratinjau/cetak/PDF, dan unduhan HTML — tanpa bocor ke halaman aplikasi.
// body/html/:root dipetakan ke area dokumen; @media/@supports/@font-face/@keyframes ikut; @page -> pengaturan kertas.
import { PAPER } from './page.js'

// Pisahkan daftar selektor pada koma tingkat atas (koma di dalam :is(a, b) tidak dipisah).
function splitSelectors(text) {
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++
    if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim()).filter(Boolean)
}

export function scopeSelector(selector, scope) {
  return splitSelectors(selector).map((sel) => {
    // "html body h1" / "body.x p" / ":root" -> area dokumen
    const m = sel.match(/^(?:(?::root|html)\b[^\s>+~]*\s*)?(?:body\b[^\s>+~]*)?\s*/)
    const consumed = m[0].trim()
    const rest = sel.slice(m[0].length)
    if (consumed) return rest ? `${scope} ${rest}` : scope
    return `${scope} ${sel}`
  }).join(', ')
}

/** CSS teks -> CSS yang hanya berlaku di dalam `scope`. Memakai parser CSS browser (aturan rusak dilewati). */
export function scopeCss(css, scope) {
  if (!css?.trim()) return ''
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(css.replace(/@import[^;]+;/g, '')) // @import tidak didukung lembar konstruksi
  const walk = (rules) => [...rules].map((r) => {
    if (r instanceof CSSStyleRule) {
      const nested = r.cssRules?.length ? walk(r.cssRules) : ''
      return `${scopeSelector(r.selectorText, scope)}{${r.style.cssText}}${nested}`
    }
    if (r instanceof CSSMediaRule) return `@media ${r.conditionText}{${walk(r.cssRules)}}`
    if (typeof CSSSupportsRule !== 'undefined' && r instanceof CSSSupportsRule) return `@supports ${r.conditionText}{${walk(r.cssRules)}}`
    if (r instanceof CSSFontFaceRule || r instanceof CSSKeyframesRule) return r.cssText
    return '' // @page ditangani pageFromCss; aturan lain diabaikan
  }).join('\n')
  // "</" di dalam string CSS tidak boleh menutup tag <style> di halaman cetak/HTML.
  return walk(sheet.cssRules).replace(/<\//g, '<\\/')
}

const toMm = (v) => {
  const m = String(v).trim().match(/^(-?[\d.]+)(mm|cm|in|pt|px)?$/)
  if (!m) return undefined
  const n = +m[1]
  return { mm: n, cm: n * 10, in: n * 25.4, pt: (n * 25.4) / 72, px: (n * 25.4) / 96 }[m[2] ?? 'px']
}

/** Aturan @page (size, margin) -> sebagian pengaturan halaman editor; null bila tidak ada. */
export function pageFromCss(css) {
  if (!css?.trim()) return null
  const sheet = new CSSStyleSheet()
  sheet.replaceSync(css.replace(/@import[^;]+;/g, ''))
  const rule = [...sheet.cssRules].find((r) => typeof CSSPageRule !== 'undefined' && r instanceof CSSPageRule && !r.selectorText)
  if (!rule) return null
  const page = {}
  const size = rule.style.getPropertyValue('size').trim()
  if (size) {
    const parts = size.split(/\s+/)
    const name = Object.keys(PAPER).find((k) => parts.some((p) => p.toLowerCase() === k.toLowerCase()))
    if (name) page.size = name
    const lengths = parts.map(toMm).filter((n) => n !== undefined)
    if (lengths.length === 2) page.size = { width: lengths[0], height: lengths[1] }
    if (parts.includes('landscape')) page.orientation = 'landscape'
    if (parts.includes('portrait')) page.orientation = 'portrait'
  }
  const margin = {}
  for (const side of ['top', 'right', 'bottom', 'left']) {
    const v = toMm(rule.style.getPropertyValue(`margin-${side}`))
    if (v !== undefined) margin[side] = Math.round(v * 10) / 10
  }
  if (Object.keys(margin).length) page.margin = margin
  return Object.keys(page).length ? page : null
}
