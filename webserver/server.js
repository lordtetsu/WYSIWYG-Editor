// Backend AI sederhana untuk doc-editor (Node 20+, tanpa dependensi).
// Editor mengirim { instruction, html } ke POST /api/ai; server ini meneruskannya ke AI yang dikonfigurasi
// (default Pollinations: gratis tanpa kunci; atau Groq, Gemini, OpenRouter, Ollama, OpenAI — lihat PROVIDERS)
// dan mengembalikan { answer }.
// Kunci API hanya ada di server ini, tidak pernah dikirim ke browser.
//
// Jalankan: cp .env.example .env  (isi AI_API_KEY)  lalu  node server.js
import http from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { exportDocument, findChrome, FORMATS } from './export.js'
import { verifyTicket, ticketFromCookie } from './ticket.js'

// .env opsional; variabel lingkungan yang sudah ada tidak ditimpa. Tes otomatis tidak memuat .env sama sekali.
if (!process.env.NODE_TEST_CONTEXT) try { process.loadEnvFile() } catch { /* tidak ada .env */ }

// Penyedia AI siap pakai (semua API kompatibel OpenAI). AI_BASE_URL / AI_MODEL menimpa nilai bawaan.
// Default: Pollinations — gratis TANPA daftar & tanpa kunci (batas: 1 jawaban / 45 detik per IP).
// Yang lain gratis dengan daftar (kunci API) dan batas lebih longgar, atau lokal (Ollama).
export const PROVIDERS = {
  pollinations: { chatUrl: 'https://text.pollinations.ai/openai', model: 'openai', needsKey: false, keyUrl: 'https://enter.pollinations.ai' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'openai/gpt-oss-120b', needsKey: true, keyUrl: 'https://console.groq.com/keys' },
  gemini: { baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash', needsKey: true, keyUrl: 'https://aistudio.google.com/apikey' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'meta-llama/llama-3.3-70b-instruct:free', needsKey: true, keyUrl: 'https://openrouter.ai/keys' },
  ollama: { baseUrl: 'http://localhost:11434/v1', model: 'llama3.2', needsKey: false, keyUrl: null }, // lokal & offline
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4.1-mini', needsKey: true, keyUrl: 'https://platform.openai.com/api-keys' },
}
const PROVIDER_NAME = (process.env.AI_PROVIDER || 'pollinations').toLowerCase()
const PROVIDER = PROVIDERS[PROVIDER_NAME] ?? { model: '', needsKey: true, keyUrl: null }

const PORT = +process.env.PORT || 8787
const BASE_URL = (process.env.AI_BASE_URL || PROVIDER.baseUrl || '').replace(/\/$/, '')
// Alamat chat lengkap: AI_BASE_URL + /chat/completions, atau alamat khusus penyedia (Pollinations).
const CHAT_URL = process.env.AI_BASE_URL ? `${BASE_URL}/chat/completions` : PROVIDER.chatUrl ?? (BASE_URL && `${BASE_URL}/chat/completions`)
const API_KEY = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || ''
const MODEL = process.env.AI_MODEL || PROVIDER.model
// Alamat sendiri (AI_BASE_URL) perlu kunci kecuali localhost.
const NEEDS_KEY = process.env.AI_BASE_URL ? !/^https?:\/\/(localhost|127\.0\.0\.1)(:|\/)/.test(BASE_URL) : PROVIDER.needsKey
// Rendah tapi bukan nol: ini mengubah dokumen orang, stabilitas lebih penting daripada kreativitas.
const TEMPERATURE = Number(process.env.AI_TEMPERATURE ?? 0.2)
// Halaman (origin) yang boleh memanggil server ini dari browser, dipisah koma. Kosong = tidak ada.
// Pola "http://localhost:*" = port berapa pun; "null" = file:// (hanya uji lokal).
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean)
// Secret bersama dengan backend aplikasi untuk tiket akses AI (cookie HttpOnly "de_ai_ticket"). Tidak pernah ke browser.
const AUTH_SECRET = process.env.AI_AUTH_SECRET || ''
const TICKET_COOKIE = process.env.AI_TICKET_COOKIE || 'de_ai_ticket'
// Batas permintaan AI per pengguna (tiket) / IP per menit, agar kuota tidak dihabiskan orang lain.
const RATE_PER_MIN = Number(process.env.AI_RATE_LIMIT || 20)
const PRODUCTION = process.env.NODE_ENV === 'production'
const MAX_BODY = 200 * 1024 // byte; teks yang diblok + instruksi
const MAX_CHAT_BODY = 1024 * 1024 // obrolan + konteks dokumen
const MAX_EXPORT_BODY = Number(process.env.EXPORT_MAX_MB || 30) * 1024 * 1024 // dokumen + gambar (base64)
// Token rahasia untuk ekspor (dipanggil oleh BACKEND aplikasi, bukan browser). Kosong = ekspor dimatikan.
const EXPORT_TOKEN = process.env.EXPORT_TOKEN || ''
const MAX_RENDERS = Number(process.env.EXPORT_CONCURRENCY || 2)
const TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 60000)

// Aturan ada karena yang diubah adalah HTML, bukan teks biasa: jawaban yang membuang/menambah tag
// atau dibungkus tanda kutip akan langsung masuk ke dokumen.
export const SYSTEM_PROMPT = `
You are the AI assistant inside a WYSIWYG document editor. You rewrite, correct, translate or extend the
selected content exactly as the user's instruction asks, without damaging its HTML.

Rules:
1. Never wrap the answer in quotation marks or code fences.
2. If the input contains HTML tags, keep every one of them. Do not add, remove or restructure tags
   unless the instruction explicitly asks for it.
3. Never close a tag the input left open, and never invent a tag the input does not have.
4. Edit only the text inside the tags, never the structure around it.
5. If the input contains placeholders such as {{key}} or {page}, leave them untouched.
6. Return HTML on a single line with no newlines.
7. Answer in the same language the input is written in, unless the instruction asks for another language.
8. Return the final content only — never a preamble such as "Here is the result:".
`.trim()

const SECURITY_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY' }

function send(res, status, body, origin) {
  const headers = { 'Content-Type': 'application/json; charset=utf-8', ...SECURITY_HEADERS, ...corsHeaders(origin) }
  res.writeHead(status, headers)
  res.end(body === null ? '' : JSON.stringify(body))
}

export function originAllowed(origin) {
  if (!origin) return false
  return ALLOWED_ORIGINS.some((rule) => {
    if (rule === origin) return true
    const m = rule.match(/^(https?:\/\/[^:/]+):\*$/) // http://localhost:* = port berapa pun
    return !!m && (origin === m[1] || origin.startsWith(`${m[1]}:`))
  })
}

// CORS hanya untuk origin yang terdaftar; cookie tiket ikut terkirim (credentials) sehingga '*' tidak pernah dipakai.
function corsHeaders(origin) {
  if (!originAllowed(origin)) return {}
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin',
  }
}

// Akses AI dari browser: origin harus terdaftar, dan (bila AI_AUTH_SECRET diisi) tiket di cookie harus sah.
function aiAccess(req, origin) {
  if (origin && !originAllowed(origin)) return { ok: false, status: 403, error: 'Origin tidak diizinkan.' }
  if (!AUTH_SECRET) return { ok: true, who: `ip:${req.socket.remoteAddress}` }
  const ticket = verifyTicket(ticketFromCookie(req.headers.cookie, TICKET_COOKIE), AUTH_SECRET, origin)
  if (!ticket) return { ok: false, status: 401, error: 'Sesi AI tidak sah atau kedaluwarsa. Muat ulang halaman / login kembali.' }
  return { ok: true, who: `sub:${ticket.sub}` }
}

// Batas laju sederhana per pengguna/IP (jendela 1 menit).
const hits = new Map()
function rateLimited(who) {
  const now = Date.now()
  const h = hits.get(who)
  if (!h || h.reset < now) { hits.set(who, { n: 1, reset: now + 60000 }); return false }
  h.n++
  if (hits.size > 10000) for (const [k, v] of hits) if (v.reset < now) hits.delete(k)
  return h.n > RATE_PER_MIN
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a ?? ''))
  const y = Buffer.from(String(b ?? ''))
  return x.length === y.length && timingSafeEqual(x, y)
}

function readJson(req, max = MAX_BODY) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > max) {
        reject(Object.assign(new Error('too large'), { status: 413 }))
        req.destroy()
      } else chunks.push(c)
    })
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')) } catch { reject(Object.assign(new Error('bad json'), { status: 400 })) }
    })
    req.on('error', reject)
  })
}

// Model kadang tetap membungkus jawaban dengan ``` atau tanda kutip; dibersihkan agar tidak masuk ke dokumen.
export function cleanAnswer(text) {
  return text.trim().replace(/^```(?:html)?\s*([\s\S]*?)\s*```$/i, '$1').replace(/^"([\s\S]*)"$/, '$1').trim()
}

// Pemeriksaan bersama sebelum memanggil AI; mengembalikan true bila sudah menjawab error.
function rejectIfNotReady(req, res, origin) {
  const access = aiAccess(req, origin)
  if (!access.ok) {
    send(res, access.status, { error: access.error }, origin)
    return true
  }
  if (rateLimited(access.who)) {
    send(res, 429, { error: 'Terlalu banyak permintaan AI. Coba lagi sebentar lagi.' }, origin)
    return true
  }
  if (!CHAT_URL || !MODEL) {
    send(res, 503, { error: `AI_PROVIDER "${PROVIDER_NAME}" tidak dikenal; isi AI_BASE_URL dan AI_MODEL.` }, origin)
    return true
  }
  if (NEEDS_KEY && !API_KEY) {
    const hint = PROVIDER.keyUrl ? ` Kunci gratis: ${PROVIDER.keyUrl}` : ''
    send(res, 503, { error: `Asisten AI belum dikonfigurasi di server (AI_API_KEY kosong).${hint}` }, origin)
    return true
  }
  return false
}

// Panggil AI dan kirim jawabannya ({ answer }) atau error yang jelas (429 batas gratis, 502, 504).
async function answerWithAi(res, origin, messages, clean = cleanAnswer) {
  // Browser menutup permintaan (mis. pengguna menekan Batal) -> panggilan ke AI ikut dihentikan agar tidak ditagih percuma.
  const controller = new AbortController()
  res.on('close', () => { if (!res.writableEnded) controller.abort() })
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}) },
      body: JSON.stringify({ model: MODEL, temperature: TEMPERATURE, messages }),
      signal: controller.signal,
    })
    const data = await response.json().catch(() => null)
    if (response.status === 429 || (response.status === 402 && data?.error?.code === 'FREE_LIMIT')) {
      // Batas tier gratis -> 429 dengan waktu tunggu, agar pengguna tahu harus menunggu, bukan mengira rusak.
      const wait = data?.error?.message?.match(/(\d+)\s*s\b/)?.[1] ?? response.headers.get('retry-after')
      return send(res, 429, { error: `Batas AI gratis tercapai.${wait ? ` Coba lagi dalam ${wait} detik.` : ' Coba lagi sebentar lagi.'}` }, origin)
    }
    if (!response.ok) {
      return send(res, 502, { error: data?.error?.message || `Layanan AI menjawab ${response.status}.` }, origin)
    }
    const answer = clean(data?.choices?.[0]?.message?.content ?? '')
    if (!answer) return send(res, 502, { error: 'Layanan AI tidak memberi jawaban.' }, origin)
    return send(res, 200, { answer }, origin)
  } catch (err) {
    if (err?.name === 'AbortError' && res.destroyed) return undefined // pengguna membatalkan
    return send(res, err?.name === 'AbortError' ? 504 : 502, { error: err?.name === 'AbortError' ? 'Layanan AI terlalu lama menjawab.' : 'Tidak dapat menghubungi layanan AI.' }, origin)
  } finally {
    clearTimeout(timer)
  }
}

async function handleAi(req, res, origin) {
  if (rejectIfNotReady(req, res, origin)) return undefined
  let body
  try {
    body = await readJson(req)
  } catch (err) {
    return send(res, err.status ?? 400, { error: err.status === 413 ? 'Teks terlalu panjang.' : 'Permintaan tidak valid.' }, origin)
  }
  const instruction = typeof body.instruction === 'string' ? body.instruction.trim() : ''
  const html = typeof body.html === 'string' ? body.html : ''
  if (!instruction) return send(res, 400, { error: 'Instruksi untuk AI kosong.' }, origin)
  if (!html.trim()) return send(res, 400, { error: 'Tidak ada teks yang dipilih.' }, origin)
  return answerWithAi(res, origin, [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Instruction:\n${instruction}\n\nSelected content (HTML):\n${html}` },
  ])
}

export const CHAT_PROMPT = `
You are a helpful writing assistant inside a document editor. You brainstorm, rewrite, translate, summarize and
answer questions about the user's document.

Rules:
1. Answer in the same language the user writes in.
2. Use Markdown for structure (headings, lists, bold, tables) when it helps; no HTML.
3. When the user asks for text to put in the document (a rewrite, translation, summary, draft), reply with that text
   only — no preamble such as "Here is the result:".
4. Base answers about the document only on the document/selection provided; say so when it is not enough.
5. Keep placeholders such as {{key}} or {page} untouched.
`.trim()
const MAX_CONTEXT = 40000 // karakter dokumen yang dikirim ke AI
const MAX_TURNS = 12

// Obrolan: { messages: [{ role: 'user'|'assistant', content }], document?: teks, selection?: teks }
async function handleChat(req, res, origin) {
  if (rejectIfNotReady(req, res, origin)) return undefined
  let body
  try {
    body = await readJson(req, MAX_CHAT_BODY)
  } catch (err) {
    return send(res, err.status ?? 400, { error: err.status === 413 ? 'Dokumen terlalu panjang untuk AI.' : 'Permintaan tidak valid.' }, origin)
  }
  const turns = (Array.isArray(body.messages) ? body.messages : [])
    .filter((m) => (m?.role === 'user' || m?.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-MAX_TURNS)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 8000) }))
  if (!turns.length || turns.at(-1).role !== 'user') return send(res, 400, { error: 'Pertanyaan untuk AI kosong.' }, origin)
  const context = []
  if (typeof body.document === 'string' && body.document.trim()) context.push(`Current document:\n"""\n${body.document.slice(0, MAX_CONTEXT)}\n"""`)
  if (typeof body.selection === 'string' && body.selection.trim()) context.push(`Selected text:\n"""\n${body.selection.slice(0, 8000)}\n"""`)
  const system = CHAT_PROMPT + (context.length ? `\n\n${context.join('\n\n')}` : '')
  return answerWithAi(res, origin, [{ role: 'system', content: system }, ...turns], (t) => t.trim())
}

// Batasi jumlah Chrome yang berjalan bersamaan.
let running = 0
const waiting = []
async function withSlot(fn) {
  if (running >= MAX_RENDERS) await new Promise((r) => waiting.push(r))
  running++
  try { return await fn() } finally { running--; waiting.shift()?.() }
}

// Ekspor dari backend: body { format: 'docx'|'pdf'|'html', document: <hasil ed.getDocument()> } -> file.
async function handleExport(req, res, origin) {
  // Ekspor hanya untuk backend aplikasi (server-ke-server) dengan token rahasia; tanpa token = dimatikan.
  if (!EXPORT_TOKEN) return send(res, 403, { error: 'Ekspor server dimatikan (EXPORT_TOKEN belum diisi).' }, null)
  if (!safeEqual(req.headers.authorization, `Bearer ${EXPORT_TOKEN}`)) return send(res, 401, { error: 'Token ekspor tidak valid.' }, null)
  origin = null // tidak untuk browser: tanpa header CORS
  let body
  try {
    body = await readJson(req, MAX_EXPORT_BODY)
  } catch (err) {
    return send(res, err.status ?? 400, { error: err.status === 413 ? 'Dokumen terlalu besar.' : 'Permintaan tidak valid.' }, origin)
  }
  const format = String(body.format || '').toLowerCase()
  const doc = body.document ?? (typeof body.html === 'string' ? body : null)
  if (!FORMATS[format]) return send(res, 400, { error: 'format harus docx, pdf, atau html.' }, origin)
  if (!doc || typeof doc.html !== 'string') return send(res, 400, { error: 'document.html wajib diisi (gunakan hasil ed.getDocument()).' }, origin)
  try {
    const file = await withSlot(() => exportDocument(doc, format))
    res.writeHead(200, {
      'Content-Type': file.type,
      'Content-Length': file.body.length,
      'Content-Disposition': `attachment; filename="${file.fileName.replace(/"/g, '')}"; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      ...corsHeaders(origin),
    })
    return res.end(file.body)
  } catch (err) {
    const status = { NO_CHROME: 501, NO_LIB: 500, TIMEOUT: 504, BAD_FORMAT: 400, BAD_DOC: 400 }[err.code] ?? 500
    return send(res, status, { error: `Ekspor gagal: ${err.message}` }, origin)
  }
}

export const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin ?? ''
  const path = new URL(req.url, 'http://x').pathname
  if (req.method === 'OPTIONS') return send(res, 204, null, origin)
  if (path === '/api/ai' && req.method === 'POST') return handleAi(req, res, origin)
  if (path === '/api/ai/chat' && req.method === 'POST') return handleChat(req, res, origin)
  if (path === '/api/export' && req.method === 'POST') return handleExport(req, res, origin)
  // Tanpa detail penyedia/model. configured = AI siap DAN pemanggil berhak (tiket sah bila AI_AUTH_SECRET diisi).
  if (path === '/health') return send(res, 200, { ok: true, configured: !!CHAT_URL && (!NEEDS_KEY || !!API_KEY) && aiAccess(req, origin).ok }, origin)
  return send(res, 404, { error: 'Tidak ditemukan.' }, origin)
})

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  // Produksi wajib aman: secret tiket & daftar origin harus diisi.
  if (PRODUCTION && (!AUTH_SECRET || !ALLOWED_ORIGINS.length || ALLOWED_ORIGINS.includes('*'))) {
    console.error('NODE_ENV=production: isi AI_AUTH_SECRET dan ALLOWED_ORIGINS (tanpa "*") sebelum menjalankan server.')
    process.exit(1)
  }
  server.listen(PORT, () => {
    console.log(`AI server: http://localhost:${PORT}/api/ai  (${PROVIDER_NAME}, model ${MODEL}, ${CHAT_URL})`)
    if (!ALLOWED_ORIGINS.length) console.log('Peringatan: ALLOWED_ORIGINS kosong — editor di browser belum bisa memanggil server ini.')
    if (!AUTH_SECRET) console.log('Peringatan: AI_AUTH_SECRET kosong — siapa pun dari origin terdaftar bisa memakai AI. Isi untuk produksi.')
    if (NEEDS_KEY && !API_KEY) console.log(`Peringatan: AI_API_KEY kosong.${PROVIDER.keyUrl ? ` Dapatkan kunci gratis di ${PROVIDER.keyUrl}` : ''}`)
  })
}
