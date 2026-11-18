// Tema tampilan editor agar menyatu dengan template aplikasi (Bootstrap, AdminLTE, Tailwind, dll.).
// theme: 'light' | 'dark' | 'auto' (ikut mode gelap perangkat) | 'inherit' (baca huruf & warna halaman induk)
//        | { toolbarBg, accent, … } (warna sendiri; bisa digabung: { preset: 'dark', accent: '#e91e63' }).
// Hanya tampilan editor; isi dokumen (cetak/Word/PDF) tetap hitam di atas putih.
export const PRESETS = {
  light: {},
  dark: {
    bg: '#1e1f22', color: '#e6e7ea', border: '#3d4047', toolbarBg: '#26282c', toolbarColor: '#e6e7ea',
    hoverBg: '#34373d', activeBg: '#2d4470', activeBorder: '#4d6fae', activeColor: '#ffffff', accent: '#6ea8fe',
    thBg: '#2c2f34', codeBg: '#2a2c30', inputBg: '#2a2c30',
  },
}
const DENSITY = { compact: '28px', normal: '32px', comfortable: '36px' }
const toVar = (k) => `--de-${k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`)}`

// Warna & huruf dari aplikasi induk; variabel warna utama yang umum dipakai template.
function inherited(el) {
  const host = el.parentElement ?? document.body
  const cs = getComputedStyle(host)
  let bg = 'transparent'
  for (let n = host; n && n.nodeType === 1; n = n.parentElement) {
    const b = getComputedStyle(n).backgroundColor
    if (b && !/rgba?\(.*,\s*0\)$|transparent/.test(b)) { bg = b; break }
  }
  if (bg === 'transparent') bg = '#ffffff'
  const root = getComputedStyle(document.documentElement)
  const pick = (...names) => names.map((n) => cs.getPropertyValue(n).trim() || root.getPropertyValue(n).trim()).find(Boolean)
  const primary = pick('--bs-primary', '--primary', '--color-primary', '--mdc-theme-primary', '--accent', '--brand') || '#3b6fe0'
  const border = pick('--bs-border-color', '--border-color', '--color-border') || `color-mix(in srgb, ${cs.color} 22%, ${bg})`
  return {
    uiFont: cs.fontFamily,
    bg, color: cs.color, border,
    toolbarBg: `color-mix(in srgb, ${cs.color} 4%, ${bg})`,
    toolbarColor: cs.color,
    hoverBg: `color-mix(in srgb, ${cs.color} 10%, ${bg})`,
    activeBg: `color-mix(in srgb, ${primary} 18%, ${bg})`,
    activeBorder: `color-mix(in srgb, ${primary} 55%, ${bg})`,
    activeColor: cs.color,
    accent: primary,
    thBg: `color-mix(in srgb, ${cs.color} 7%, ${bg})`,
    codeBg: `color-mix(in srgb, ${cs.color} 6%, ${bg})`,
    inputBg: bg,
  }
}

/**
 * Pasang tema ke elemen editor. Mengembalikan { vars, destroy } — vars dipakai juga untuk jendela modal.
 * @param {HTMLElement} el
 * @param {string|object} theme
 * @param {'compact'|'normal'|'comfortable'} [density]
 */
export function applyTheme(el, theme = 'light', density = 'normal') {
  let vars = []
  const set = () => {
    for (const [k] of vars) el.style.removeProperty(k)
    const obj = typeof theme === 'object' && theme ? theme : {}
    let name = typeof theme === 'string' ? theme : obj.preset ?? 'light'
    if (name === 'auto') name = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const base = name === 'inherit' ? inherited(el) : PRESETS[name] ?? {}
    const { preset, ...custom } = obj
    vars = Object.entries({ ...base, ...custom, btn: DENSITY[density] ?? DENSITY.normal }).map(([k, v]) => [toVar(k), v])
    for (const [k, v] of vars) el.style.setProperty(k, v)
    el.dataset.theme = name
  }
  set()
  const auto = theme === 'auto' || theme?.preset === 'auto'
  const mq = auto ? matchMedia('(prefers-color-scheme: dark)') : null
  mq?.addEventListener('change', set)
  return {
    get vars() { return vars },
    refresh: set, // mis. setelah tema aplikasi induk berganti
    destroy() {
      mq?.removeEventListener('change', set)
      for (const [k] of vars) el.style.removeProperty(k)
      delete el.dataset.theme
    },
  }
}
