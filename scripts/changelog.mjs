// CHANGELOG.md dibuat ulang dari riwayat git (format Keep a Changelog).
// Rilis = tag yang diawali "v<angka>" (mis. v0.2.0, v0.0.3-RELEASE); commit setelah tag terakhir masuk "Belum dirilis".
// Kategori diambil dari kata pertama pesan commit (Tambah…, Perbaiki…, Hapus…, lainnya = Diubah).
// Dipanggil otomatis oleh .githooks/post-commit. Opsi --check: gagal bila CHANGELOG.md belum mutakhir (dipakai CI).
import { execFileSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'

const FILE = new URL('../CHANGELOG.md', import.meta.url)
const SECTIONS = [
  ['Ditambahkan', /^(tambah|tambahkan|buat|add|feat)/i],
  ['Diperbaiki', /^(perbaiki|benahi|fix)/i],
  ['Dihapus', /^(hapus|buang|remove|delete)/i],
  ['Diubah', /./],
]
const HEADER = '# Changelog\n\nSemua perubahan penting pada proyek ini. Dibuat otomatis dari riwayat git oleh `scripts/changelog.mjs` setiap commit; jangan diedit manual.\n'

/**
 * @param {Array<{hash: string, date: string, subject: string}>} commits  terbaru dulu
 * @param {Map<string, string>} tags  hash commit -> nama tag rilis
 */
export function render(commits, tags) {
  const releases = [{ title: 'Belum dirilis', items: [] }]
  for (const c of commits) {
    const tag = tags.get(c.hash)
    if (tag) releases.push({ title: `${tag} - ${c.date}`, items: [] })
    if (/^rilis\b|^release\b/i.test(c.subject)) continue // commit penanda rilis tidak dicatat
    releases.at(-1).items.push(c)
  }
  let out = HEADER
  for (const r of releases) {
    if (r.title === 'Belum dirilis' && !r.items.length) continue
    out += `\n## [${r.title}]\n`
    for (const [name, re] of SECTIONS) {
      const items = r.items.filter((c) => SECTIONS.find(([, x]) => x.test(c.subject))[0] === name)
      if (items.length) out += `\n### ${name}\n\n${items.map((c) => `- ${c.subject} (${c.date})`).join('\n')}\n`
    }
  }
  return out
}

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

function fromGit() {
  const commits = git('log', '--no-merges', '--date=short', '--format=%H%x1f%ad%x1f%s').split('\n').filter(Boolean)
    .map((l) => { const [hash, date, subject] = l.split('\x1f'); return { hash, date, subject } })
  const tags = new Map()
  // tag beranotasi: %(*objectname) = commit yang ditunjuk; tag ringan: %(objectname)
  for (const l of git('for-each-ref', 'refs/tags', '--format=%(objectname) %(*objectname) %(refname:short)').split('\n').filter(Boolean)) {
    const [obj, peeled, name] = l.split(' ')
    if (/^v\d/.test(name)) tags.set(peeled || obj, name)
  }
  return render(commits, tags)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const text = fromGit()
  const current = existsSync(FILE) ? readFileSync(FILE, 'utf8') : ''
  if (process.argv.includes('--check')) {
    if (current !== text) {
      console.error('CHANGELOG.md belum mutakhir. Jalankan: npm run changelog (atau aktifkan hook: npm install)')
      process.exit(1)
    }
  } else if (current !== text) writeFileSync(FILE, text)
}
