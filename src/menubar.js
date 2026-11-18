// Menubar (File, Edit, View, …) dengan pola menu ARIA: panah kiri/kanan antarmenu, atas/bawah antaritem,
// Enter/Spasi memilih, Esc menutup. Item: { label, run, checked?, disabled?, shortcut?, icon? } atau '-' (pemisah).
const make = (tag, props = {}) => Object.assign(document.createElement(tag), props)

/**
 * @param {HTMLElement} host  tempat menubar (sebelum toolbar)
 * @param {Array<{label: string, items: () => Array}>} menus  isi dibuat ulang tiap dibuka (status terbaru)
 * @param {string} ariaLabel
 * @returns {{ element: HTMLElement, destroy: () => void }}
 */
export function createMenubar(host, menus, ariaLabel) {
  const bar = make('div', { className: 'de-menubar' })
  bar.setAttribute('role', 'menubar')
  bar.setAttribute('aria-label', ariaLabel)
  let openIndex = -1
  let dropdown = null

  const tops = menus.map((m, i) => {
    const b = make('button', { type: 'button', textContent: m.label, tabIndex: i === 0 ? 0 : -1 })
    b.setAttribute('role', 'menuitem')
    b.setAttribute('aria-haspopup', 'menu')
    b.setAttribute('aria-expanded', 'false')
    b.onmousedown = (e) => e.preventDefault() // seleksi teks di editor tetap
    b.onclick = () => (openIndex === i ? close() : open(i))
    b.onmouseenter = () => { if (openIndex >= 0 && openIndex !== i) open(i) }
    bar.append(b)
    return b
  })

  function close(focusTop = false) {
    dropdown?.remove()
    dropdown = null
    if (openIndex >= 0) {
      tops[openIndex].setAttribute('aria-expanded', 'false')
      if (focusTop) tops[openIndex].focus()
    }
    openIndex = -1
    document.removeEventListener('mousedown', outside, true)
  }
  const outside = (e) => { if (!bar.contains(e.target) && !dropdown?.contains(e.target)) close() }

  function open(i, focusLast = false) {
    close()
    openIndex = i
    const top = tops[i]
    top.setAttribute('aria-expanded', 'true')
    tops.forEach((t, j) => { t.tabIndex = j === i ? 0 : -1 })
    dropdown = make('div', { className: 'de-pop de-menu de-menubar-menu' })
    dropdown.setAttribute('role', 'menu')
    dropdown.setAttribute('aria-label', menus[i].label)
    const items = []
    for (const it of menus[i].items()) {
      if (it === '-') {
        const sep = make('div', { className: 'de-menu-sep' })
        sep.setAttribute('role', 'separator')
        dropdown.append(sep)
        continue
      }
      const b = make('button', { type: 'button', tabIndex: -1, disabled: !!it.disabled })
      b.setAttribute('role', it.checked === undefined ? 'menuitem' : 'menuitemcheckbox')
      if (it.checked !== undefined) b.setAttribute('aria-checked', String(!!it.checked))
      b.innerHTML = `<span class="de-menu-icon" aria-hidden="true">${it.checked ? '✓' : it.icon ?? ''}</span>`
      b.append(make('span', { className: 'de-menu-label', textContent: it.label }))
      if (it.shortcut) b.append(make('kbd', { textContent: it.shortcut }))
      b.onmousedown = (e) => e.preventDefault()
      b.onclick = () => {
        close()
        it.run()
      }
      dropdown.append(b)
      if (!it.disabled) items.push(b)
    }
    bar.after(dropdown)
    dropdown.style.left = `${top.offsetLeft}px`
    dropdown.style.top = `${bar.offsetTop + bar.offsetHeight}px`
    dropdown.addEventListener('keydown', (e) => {
      const k = items.indexOf(document.activeElement)
      const move = (n) => { e.preventDefault(); items[(n + items.length) % items.length]?.focus() }
      if (e.key === 'ArrowDown') move(k + 1)
      else if (e.key === 'ArrowUp') move(k - 1)
      else if (e.key === 'Home') move(0)
      else if (e.key === 'End') move(-1)
      else if (e.key === 'ArrowRight') { e.preventDefault(); open((i + 1) % tops.length) }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); open((i - 1 + tops.length) % tops.length) }
      else if (e.key === 'Escape') { e.preventDefault(); close(true) }
      else if (e.key === 'Tab') close()
    })
    document.addEventListener('mousedown', outside, true)
    ;(focusLast ? items.at(-1) : items[0])?.focus()
  }

  bar.addEventListener('keydown', (e) => {
    const i = tops.indexOf(document.activeElement)
    if (i < 0) return
    const focus = (n) => { e.preventDefault(); tops.forEach((t, j) => { t.tabIndex = j === n ? 0 : -1 }); tops[n].focus() }
    if (e.key === 'ArrowRight') focus((i + 1) % tops.length)
    else if (e.key === 'ArrowLeft') focus((i - 1 + tops.length) % tops.length)
    else if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(i) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); open(i, true) }
  })

  host.before(bar)
  return { element: bar, destroy() { close(); bar.remove() } }
}
