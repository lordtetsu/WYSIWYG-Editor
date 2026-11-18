// Publikasikan docs/*.md ke Confluence (dipakai job GitLab CI "publish-docs").
// Judul halaman = judul "# …" pertama di file. Halaman yang sudah ada diperbarui (versi +1), yang belum ada dibuat.
//
// Variabel lingkungan:
//   CONFLUENCE_BASE_URL   mis. https://kantor.atlassian.net (Cloud; /wiki ditambahkan otomatis) atau https://confluence.kantor.go.id (Server/DC)
//   CONFLUENCE_SPACE_KEY  kunci space, mis. MKI
//   CONFLUENCE_PARENT_ID  (opsional) ID halaman induk
//   CONFLUENCE_USER       (Cloud) email akun; kosong = token dipakai sebagai Personal Access Token (Server/DC)
//   CONFLUENCE_TOKEN      API token (Cloud) atau Personal Access Token (Server/DC)
//   DRY_RUN=1             hanya konversi & validasi, tanpa mengirim
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { marked } from 'marked'

const DOCS = new URL('../docs/', import.meta.url).pathname
const { CONFLUENCE_BASE_URL, CONFLUENCE_SPACE_KEY: CONFLUENCE_SPACE, CONFLUENCE_PARENT_ID, CONFLUENCE_USER, CONFLUENCE_TOKEN, DRY_RUN } = process.env
// Confluence Cloud melayani REST API di bawah /wiki
const CONFLUENCE_URL = (CONFLUENCE_BASE_URL ?? '').replace(/\/+$/, '').replace(/(\.atlassian\.net)$/, '$1/wiki')

const VOID = /<(br|hr|img|col|input)(\s[^>]*?)?\s*\/?>/g
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')

/** Markdown -> format storage Confluence (XHTML; blok kode menjadi makro code). */
export function toStorage(md) {
  return marked.parse(md, { gfm: true })
    .replace(VOID, (_, tag, attrs = '') => `<${tag}${attrs} />`)
    .replace(/<pre><code(?: class="language-([\w-]+)")?>([\s\S]*?)<\/code><\/pre>/g, (_, lang, code) =>
      '<ac:structured-macro ac:name="code">' +
      (lang ? `<ac:parameter ac:name="language">${lang}</ac:parameter>` : '') +
      `<ac:plain-text-body><![CDATA[${unescape(code).replace(/\n$/, '').replace(/]]>/g, ']]]]><![CDATA[>')}]]></ac:plain-text-body></ac:structured-macro>`)
}

const titleOf = (md, file) => md.match(/^#\s+(.+)$/m)?.[1].trim() ?? file.replace(/\.md$/, '')

async function api(path, init = {}) {
  const auth = CONFLUENCE_USER
    ? `Basic ${Buffer.from(`${CONFLUENCE_USER}:${CONFLUENCE_TOKEN}`).toString('base64')}`
    : `Bearer ${CONFLUENCE_TOKEN}`
  const res = await fetch(`${CONFLUENCE_URL}/rest/api${path}`, {
    ...init,
    headers: { Authorization: auth, Accept: 'application/json', 'Content-Type': 'application/json' },
  })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${path} -> ${res.status} ${(await res.text()).slice(0, 300)}`)
  return res.json()
}

async function publish(title, body) {
  const q = new URLSearchParams({ spaceKey: CONFLUENCE_SPACE, title, expand: 'version' })
  const found = (await api(`/content?${q}`)).results?.[0]
  const page = {
    type: 'page',
    title,
    space: { key: CONFLUENCE_SPACE },
    body: { storage: { value: body, representation: 'storage' } },
    ...(CONFLUENCE_PARENT_ID ? { ancestors: [{ id: CONFLUENCE_PARENT_ID }] } : {}),
  }
  if (found) {
    await api(`/content/${found.id}`, { method: 'PUT', body: JSON.stringify({ ...page, id: found.id, version: { number: found.version.number + 1, message: `CI ${process.env.CI_COMMIT_SHORT_SHA ?? ''}`.trim() } }) })
    return `diperbarui (id ${found.id}, versi ${found.version.number + 1})`
  }
  const created = await api('/content', { method: 'POST', body: JSON.stringify(page) })
  return `dibuat (id ${created.id})`
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (!DRY_RUN && !(CONFLUENCE_URL && CONFLUENCE_SPACE && CONFLUENCE_TOKEN)) {
    console.error('CONFLUENCE_BASE_URL, CONFLUENCE_SPACE_KEY, dan CONFLUENCE_TOKEN wajib diisi (atau DRY_RUN=1).')
    process.exit(1)
  }
  let failed = 0
  for (const file of readdirSync(DOCS).filter((f) => f.endsWith('.md')).sort()) {
    const md = readFileSync(join(DOCS, file), 'utf8')
    const title = titleOf(md, file)
    const body = toStorage(md)
    try {
      console.log(`${file} -> "${title}": ${DRY_RUN ? `${body.length} karakter (dry run)` : await publish(title, body)}`)
    } catch (e) {
      failed++
      console.error(`${file} -> "${title}": GAGAL ${e.message}`)
    }
  }
  process.exit(failed ? 1 : 0)
}
