// Tiket akses AI: tanda tangan HMAC-SHA256 berumur pendek, dibuat oleh BACKEND aplikasi Anda (bukan browser) untuk
// pengguna yang sudah login, lalu dikirim ke browser sebagai cookie HttpOnly. JavaScript di halaman tidak bisa membaca
// cookie itu, dan secret-nya hanya ada di server — di browser hanya terlihat URL webserver AI.
//
// Format: v1.<payload base64url>.<tanda tangan base64url>; payload = { sub, exp (detik unix), aud? (origin) }
// Contoh PHP & Node ada di README. CLI uji: node ticket.js <secret> [sub] [detik]
import { createHmac, timingSafeEqual } from 'node:crypto'

const b64url = (buf) => Buffer.from(buf).toString('base64url')
const sign = (data, secret) => createHmac('sha256', secret).update(data).digest('base64url')

/** Buat tiket. ttl dalam detik (default 15 menit). aud = origin aplikasi (opsional, mengikat tiket ke origin itu). */
export function createTicket({ secret, sub, ttl = 900, aud }) {
  if (!secret) throw new Error('secret wajib')
  const payload = b64url(JSON.stringify({ sub: String(sub ?? ''), exp: Math.floor(Date.now() / 1000) + ttl, ...(aud ? { aud } : {}) }))
  return `v1.${payload}.${sign(`v1.${payload}`, secret)}`
}

/** Periksa tiket; mengembalikan payload bila sah, atau null (rusak, salah tanda tangan, kedaluwarsa, origin beda). */
export function verifyTicket(ticket, secret, origin) {
  if (!secret || typeof ticket !== 'string') return null
  const [v, payload, sig] = ticket.split('.')
  if (v !== 'v1' || !payload || !sig) return null
  const expected = Buffer.from(sign(`v1.${payload}`, secret))
  const given = Buffer.from(sig)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null
  let data
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) } catch { return null }
  if (!Number.isFinite(data.exp) || data.exp < Date.now() / 1000) return null
  if (data.aud && origin && data.aud !== origin) return null
  return data
}

/** Ambil tiket dari header Cookie (nama default de_ai_ticket). */
export function ticketFromCookie(cookieHeader, name = 'de_ai_ticket') {
  for (const part of String(cookieHeader ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim())
  }
  return null
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const [secret, sub = 'uji', ttl = '900'] = process.argv.slice(2)
  if (!secret) { console.error('pakai: node ticket.js <AI_AUTH_SECRET> [sub] [detik]'); process.exit(1) }
  console.log(createTicket({ secret, sub, ttl: +ttl }))
}
