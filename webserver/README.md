# Server doc-editor (AI & ekspor)

Server kecil (Node 20.12+, tanpa dependensi npm) untuk dua hal:

1. **AI**: menu klik kanan *Interaction with AI* dan panel *AI Chat* di editor.
2. **Ekspor dari backend**: Word, PDF, atau HTML dari dokumen yang tersimpan di server. Hasilnya sama persis dengan pratinjau di editor.

Semua kunci dan secret hanya ada di server ini. **Browser hanya mengetahui URL server.**

```bash
cd webserver
cp .env.example .env      # isi sesuai kebutuhan
node server.js
node --test               # tes otomatis (memakai AI tiruan; .env tidak dimuat)
```

## Keamanan: siapa yang boleh memakai AI

```
Browser (editor)  ──fetch + cookie HttpOnly──▶  Server AI  ──kunci API──▶  Gemini / Groq / …
       ▲
       └── cookie "de_ai_ticket" dipasang oleh BACKEND aplikasi Anda setelah pengguna login
```

- **Origin:** hanya halaman di `ALLOWED_ORIGINS` yang diterima. CORS tidak pernah memakai `*`.
- **Tiket:** bila `AI_AUTH_SECRET` diisi, setiap permintaan AI wajib membawa tiket sah di cookie `de_ai_ticket`.
  - Tiket ditandatangani HMAC-SHA256 dan berumur pendek.
  - Tiket bisa diikat ke origin aplikasi.
  - Karena memakai cookie **HttpOnly**, JavaScript di halaman tidak bisa membacanya.
- **Batas laju:** `AI_RATE_LIMIT` permintaan per menit per pengguna/IP.
- **`/health`:** hanya menjawab `{ ok, configured }`. Penyedia, model, dan kunci tidak pernah dikirim.
- **Produksi:** dengan `NODE_ENV=production`, server menolak menyala sampai `AI_AUTH_SECRET` dan `ALLOWED_ORIGINS` diisi.

### Membuat tiket di backend aplikasi

Tiket dibuat untuk pengguna yang **sudah login** di aplikasi Anda, dengan secret yang sama dengan `AI_AUTH_SECRET`.

**PHP**

```php
function de_ai_ticket(string $secret, string $userId, string $origin, int $ttl = 900): string {
  $b64 = fn($s) => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
  $payload = $b64(json_encode(['sub' => $userId, 'exp' => time() + $ttl, 'aud' => $origin]));
  $sig = $b64(hash_hmac('sha256', "v1.$payload", $secret, true));
  return "v1.$payload.$sig";
}
// Setelah login / saat merender halaman editor:
setcookie('de_ai_ticket', de_ai_ticket(getenv('AI_AUTH_SECRET'), $user->id, 'https://app.kantor.go.id'), [
  'expires' => time() + 900, 'path' => '/', 'domain' => '.kantor.go.id',  // domain bersama app & server AI
  'httponly' => true, 'secure' => true, 'samesite' => 'Lax',
]);
```

**Node**

```js
import { createTicket } from './webserver/ticket.js'
res.cookie('de_ai_ticket', createTicket({ secret: process.env.AI_AUTH_SECRET, sub: user.id, aud: 'https://app.kantor.go.id' }),
  { httpOnly: true, secure: true, sameSite: 'lax', domain: '.kantor.go.id', maxAge: 900_000 })
```

Supaya cookie ikut terkirim, server AI harus berada di domain yang sama dengan aplikasi atau di subdomainnya. Contoh: `app.kantor.go.id` dengan `ai.kantor.go.id`, atau `app.kantor.go.id/ai` lewat reverse proxy. Pasang server di balik **HTTPS**.

Di editor cukup:

```js
DocEditor.create('#editor', { ai: { endpoint: 'https://ai.kantor.go.id/api/ai' } }) // hanya URL
```

## AI

| `AI_PROVIDER` | Biaya | Kunci | Catatan |
|---|---|---|---|
| `pollinations` (default) | Gratis, tanpa daftar | – | Batas 1 jawaban per 45 detik per IP |
| `gemini` | Tier gratis | https://aistudio.google.com/apikey | Model bawaan `gemini-2.5-flash` |
| `groq` | Gratis, tanpa kartu kredit | https://console.groq.com/keys | |
| `openrouter` | Model berakhiran `:free` | https://openrouter.ai/keys | |
| `ollama` | Gratis, lokal | – | Data tidak keluar dari komputer Anda |
| `openai` | Berbayar | https://platform.openai.com/api-keys | |

Endpoint (dipanggil oleh editor):
- `POST /api/ai`: `{ instruction, html }` menjadi `{ answer }`, untuk mengubah teks yang diblok.
- `POST /api/ai/chat`: `{ messages, document?, selection? }` menjadi `{ answer }` (Markdown), untuk panel AI Chat.
- Kode respons:
  - `401` sesi/tiket tidak sah,
  - `403` origin tidak terdaftar,
  - `429` batas laju atau batas gratis (beserta waktu tunggu),
  - `502` AI gagal, dengan pesan aslinya (tidak pernah ada jawaban palsu),
  - `503` belum dikonfigurasi.

Pada tier gratis, penyedia boleh memakai teks yang dikirim untuk melatih layanannya. Untuk dokumen rahasia, pakai `ollama`.

## Ekspor dari backend

Gunakan ini bila ekspor di editor dimatikan (`allowExport: false`), dan dokumen baru boleh diekspor setelah tersimpan di server.

1. Di editor, simpan **paket dokumen**: `onSave: (html, ed, doc) => kirimKeServer(doc)`, atau `ed.getDocument()`.
   - Isinya: HTML dan **semua pengaturan** (kertas, margin, header/footer, halaman yang dikecualikan, nomor awal, watermark, CSS tampilan, bahasa).
2. Saat pengguna meminta ekspor, **backend Anda** (bukan browser) memanggil server ini dengan paket yang tersimpan:

```bash
curl -X POST https://ai.kantor.go.id/api/export \
  -H "Authorization: Bearer $EXPORT_TOKEN" -H "Content-Type: application/json" \
  -d '{"format":"pdf","document": <isi paket dokumen tersimpan>}' -o laporan.pdf
```

```php
$ch = curl_init('https://ai.kantor.go.id/api/export');
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . getenv('EXPORT_TOKEN'), 'Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode(['format' => 'docx', 'document' => json_decode($row['dokumen'])])]);
$file = curl_exec($ch); // kirim ke pengguna dengan header Content-Type & Content-Disposition yang sesuai
```

- **Format:** `docx`, `pdf`, `html`.
- **Hasil identik dengan pratinjau:** server menjalankan library editor yang sama di Chrome/Chromium headless. Chrome harus terpasang; jika tidak ditemukan otomatis, isi `CHROME_PATH`.
- **File library:** default `../dist/doc-editor.umd.js`, jadi jalankan `npm install && npm run build` di folder library sebelum menyalakan server. Bisa juga arahkan `DOC_EDITOR_LIB` ke `node_modules/@lord-tetsu/doc-editor/dist/doc-editor.umd.js`.
- **Hanya untuk server:** `EXPORT_TOKEN` wajib diisi dan tidak boleh ada di browser. Endpoint ini tidak mengirim header CORS.
- **Tanpa jaringan:** saat render, Chrome tidak bisa mengakses jaringan, sehingga dokumen tidak bisa membuat server mengambil URL luar. Gambar sebaiknya disimpan sebagai data URL (bawaan editor).
