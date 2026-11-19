# Dokumentasi Teknis doc-editor

Panduan lengkap untuk developer yang memasang, mengatur, dan mengoperasikan **doc-editor**, editor WYSIWYG offline dengan ekspor Word/PDF/HTML, beserta server pendampingnya (AI & ekspor dari backend).

Versi library: 0.1.0 · Dokumen ini berlaku untuk kode di repositori ini per November 2026.

---

## Daftar isi

1. [Gambaran umum](#1-gambaran-umum)
2. [Struktur proyek](#2-struktur-proyek)
3. [Build & instalasi](#3-build--instalasi)
4. [Pemasangan di berbagai stack](#4-pemasangan-di-berbagai-stack)
5. [Opsi `create()`](#5-opsi-create)
6. [API instance](#6-api-instance)
7. [Toolbar, menubar, status bar](#7-toolbar-menubar-status-bar)
8. [Pengaturan halaman](#8-pengaturan-halaman)
9. [Fitur dokumen](#9-fitur-dokumen)
10. [Impor](#10-impor)
11. [Ekspor & pratinjau cetak](#11-ekspor--pratinjau-cetak)
12. [Paket dokumen (simpan/muat)](#12-paket-dokumen-simpanmuat)
13. [Tampilan: tema, bahasa, CSS dokumen](#13-tampilan-tema-bahasa-css-dokumen)
14. [Server AI](#14-server-ai)
15. [Ekspor dari backend](#15-ekspor-dari-backend)
16. [Keamanan](#16-keamanan)
17. [Pengujian](#17-pengujian)
18. [Batasan yang diketahui](#18-batasan-yang-diketahui)
19. [Pemecahan masalah](#19-pemecahan-masalah)
20. [Memperluas library](#20-memperluas-library)

---

> **Pindah dari TinyMCE?** Kode `tinymce.init({...})` yang sudah ada bisa langsung dipakai. Lihat [MIGRASI-TINYMCE.md](MIGRASI-TINYMCE.md).

## 1. Gambaran umum

```
┌──────────────────────── Browser ─────────────────────────┐
│  doc-editor.umd.js  (satu file, CSS ikut di dalamnya)     │
│  ├─ Editor Tiptap/ProseMirror + toolbar/menubar           │
│  ├─ Impor: docx · md · html · txt  (+ pdf lewat plugin)   │
│  ├─ Ekspor: Word (.docx) · PDF (cetak) · HTML             │
│  └─ Mesin halaman: kertas, margin, header/footer,         │
│     watermark, catatan kaki, daftar isi bernomor          │
└───────────────┬──────────────────────────┬───────────────┘
                │ fetch + cookie HttpOnly   │ (opsional)
                ▼                           │
┌──────── webserver/server.js (Node 20) ────┴──────────────┐
│  /api/ai, /api/ai/chat  → Gemini/Groq/OpenRouter/Ollama… │
│  /api/export            → Chrome headless menjalankan     │
│                           library yang sama → docx/pdf/html│
└──────────────────────────────────────────────────────────┘
```

Prinsip utama:

- **Offline:** library tidak memanggil CDN atau layanan luar. Satu-satunya jaringan yang dipakai adalah server AI milik Anda (opsional) dan sematan YouTube/Vimeo bila pengguna menyisipkannya.
- **Satu mesin tata letak:** pratinjau cetak, PDF, unduhan HTML per halaman, dan ekspor server memakai kode pemecah halaman yang sama (`src/print.js`). Hasilnya identik.
- **Isi selalu disaring skema editor:** HTML dari mana pun (impor, tempel, kode, template, header/footer) diubah dulu ke struktur dokumen. Tag dan atribut yang tidak dikenal dibuang.

## 2. Struktur proyek

| Path | Isi |
|---|---|
| `src/index.js` | Titik masuk: `create()`, toolbar, menubar, API instance |
| `src/docx.js` | JSON editor → `.docx` (library `docx`): format, tabel, gambar, daftar isi, rumus (OMML), catatan kaki, section header/footer |
| `src/docx-import.js` | `.docx` → HTML (parser sendiri berbasis `fflate` + DOMParser) |
| `src/import-pdf.js` | Plugin impor PDF (`pdfjs-dist`), dibundel terpisah |
| `src/html-import.js` | Impor HTML: dirender di iframe sandbox, gaya terhitung dibaca |
| `src/importers.js` | Registri importer per ekstensi |
| `src/print.js` | Mesin halaman, pratinjau cetak, PDF, HTML per halaman |
| `src/page.js` | Ukuran kertas, normalisasi pengaturan halaman, `pageMatcher` |
| `src/media.js` | Node rumus (temml), catatan kaki, video |
| `src/extras.js` | Indentasi/spasi/RTL, pemisah halaman, daftar isi, ubah huruf, format painter, karakter khusus, pemeriksa aksesibilitas |
| `src/headerfooter.js` | Dialog header & footer |
| `src/watermark.js` | Watermark (SVG/PNG) |
| `src/crop.js` | Crop gambar |
| `src/find.js` | Cari & ganti |
| `src/menubar.js` | Menubar dengan navigasi keyboard |
| `src/theme.js` | Tema warna (light/dark/auto/inherit) |
| `src/content-css.js` | Pembatasan CSS dokumen ke area isi, `@page` → kertas |
| `src/ai.js`, `src/ai-chat.js` | Menu klik kanan AI dan panel AI Chat |
| `src/locales.js` | Teks & ikon id/en |
| `src/styles.js` | Semua CSS (UI, isi dokumen, halaman) |
| `webserver/` | Server AI + ekspor backend (tanpa dependensi npm) |
| `examples/offline.html` | Playground: panel konfigurasi + pratinjau + kode siap salin |
| `test/` | Tes Node untuk docx, impor, halaman, teks |

## 3. Build & instalasi

Prasyarat: Node.js 20.12 atau lebih baru.

```bash
npm install
npm run build
npm test
cd webserver && node --test
```

Hasil build di `dist/`:

| File | Pakai untuk | Ukuran (gzip) |
|---|---|---|
| `doc-editor.umd.js` | `<script>` biasa → global `DocEditor` | ± 496 KB |
| `doc-editor.js` | `import` (ESM, bundler/Next.js) | ± 496 KB |
| `doc-editor-pdf.umd.js` | Plugin impor PDF untuk `<script>` | ± 517 KB |
| `doc-editor-pdf.js` | Plugin impor PDF untuk `import` | ± 517 KB |

Plugin PDF bersifat opsional dan hanya perlu dimuat bila pengguna boleh mengimpor PDF.

Cara mendistribusikan ke aplikasi lain, pilih salah satu:

- Pasang dari registry npm: `npm install @lord-tetsu/doc-editor`. Paket tidak punya dependensi tambahan (semua terbundel).
- Salin `dist/*.js` ke folder aset aplikasi (paling sederhana, cocok untuk PHP). Ambil dari `node_modules/@lord-tetsu/doc-editor/dist/` setelah `npm install`, atau dari `dist/` hasil `npm run build`. `dist/` tidak disimpan di repositori.
- Pasang sebagai paket lokal: `npm install ../WYSIWYG_EDITOR`. Paket mengekspor `@lord-tetsu/doc-editor` dan `@lord-tetsu/doc-editor/pdf`.

### Menerbitkan versi baru ke npm

**Prasyarat (sekali saja):**

1. Akun npm yang menjadi owner/anggota organisasi npm **`lord-tetsu`** (cek: `npm org ls lord-tetsu`).
2. **2FA aktif** di akun itu dengan mode *Authorization and writes* (npmjs.com → Account Settings → Two-Factor Authentication). Tanpa 2FA, registry menolak publish dengan `403 … Two-factor authentication … is required to publish packages`.
3. `npm login`, lalu `npm whoami` untuk memastikan akun yang aktif.

**Langkah rilis:**

```bash
# 1. pastikan semua perubahan sudah di-commit dan di-push
npm version patch -m "Rilis v%s"   # 0.1.0 → 0.1.1 (minor/major sesuai perubahan): commit + tag v0.1.1
git push <remote> main v0.1.1      # ke setiap remote, termasuk tag-nya

# 2. terbitkan (prepublishOnly menjalankan build + tes; publishConfig.access = public)
npm publish --otp=123456           # kode 6 digit terbaru dari aplikasi authenticator
```

Tanda berhasil: terminal menampilkan `+ @lord-tetsu/doc-editor@0.1.1`.

**Memastikan versi benar-benar terbit:**

```bash
npm view @lord-tetsu/doc-editor versions dist-tags   # versi baru ada dan latest menunjuk ke sana
```

Lalu uji di folder kosong: `npm install @lord-tetsu/doc-editor`. Jumlah paket yang ditambahkan harus 1 (tanpa dependensi). Paket yang baru terbit kadang baru terbaca publik setelah beberapa menit, karena cache registry.

**Gunakan `npm publish`, bukan `npm stage publish`.** `npm stage` adalah fitur *staged publishing*: versi ditahan sampai disetujui dengan `npm stage approve <id>` (butuh OTP). Untuk paket yang belum pernah ada, npm membuat penampung kosong **`0.0.0-stage`** ("Temporary package placeholder for staged publishing") yang menjadi tag `latest`. Bila penampung itu muncul:

- Periksa rilis yang tertahan: `npm stage list @lord-tetsu/doc-editor`. Bila ada, setujui dengan `npm stage approve <id>`. Bila kosong, jalankan `npm publish --otp=…` biasa.
- Setelah versi asli terbit, tandai penampung sebagai usang: `npm deprecate @lord-tetsu/doc-editor@0.0.0-stage "Penampung, gunakan versi terbaru" --otp=…`.

**Galat yang umum:**

| Galat | Penyebab & solusi |
|---|---|
| `403 … Two-factor authentication … is required` | 2FA belum aktif untuk *writes*. Aktifkan, lalu publish dengan `--otp` |
| `EOTP` / `401` saat publish | Kode OTP salah atau kedaluwarsa (± 30 detik). Ulangi dengan kode baru |
| `403 … You do not have permission` | Akun bukan owner/anggota organisasi `lord-tetsu` |
| `403 … cannot publish over the previously published versions` | Versi itu sudah pernah terbit. Naikkan versi dengan `npm version patch` |
| `E402 Payment Required` | Paket ber-scope diterbitkan privat. Sudah dicegah oleh `publishConfig.access = public` |

Pesan "Rilis v…" tidak dicatat di CHANGELOG, dan commit itu langsung menjadi judul versi di CHANGELOG. Versi yang sudah terbit tidak bisa ditimpa, dan hanya bisa dihapus (`npm unpublish`) dalam 72 jam pertama.

## 4. Pemasangan di berbagai stack

### 4.1 HTML / PHP (form biasa)

Bila target berupa `<textarea>`, textarea disembunyikan dan nilainya selalu berisi HTML editor, sehingga form terkirim tanpa kode tambahan.

```html
<form method="post" action="/simpan.php">
  <textarea name="isi" id="isi"><?= htmlspecialchars($dokumen) ?></textarea>
  <button>Simpan</button>
</form>
<script src="/assets/doc-editor.umd.js"></script>
<script src="/assets/doc-editor-pdf.umd.js"></script> <!-- opsional: impor PDF -->
<script>
  DocEditor.create('#isi', { fileName: 'surat-keluar', lang: 'id' })
</script>
```

Di server, **bersihkan HTML sebelum disimpan/ditampilkan ulang** (mis. HTMLPurifier), karena request bisa dikirim tanpa melalui editor.

### 4.2 Menyimpan paket dokumen lengkap (disarankan)

Bila pengaturan halaman (kertas, header/footer, watermark, CSS) ikut disimpan, ekspor ulang di kemudian hari akan sama persis.

```js
const ed = DocEditor.create('#editor', {
  content: dokumenTersimpan,              // HTML lama atau paket JSON
  onSave: async (html, ed, doc) => {
    await fetch('/api/dokumen/42', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc),
    })
  },
})
```

### 4.3 Next.js / React

```jsx
'use client'
import { useEffect, useRef } from 'react'
import { create } from '@lord-tetsu/doc-editor'
// Opsional, impor PDF (lihat 4.5):
// di dalam useEffect: import('@lord-tetsu/doc-editor/pdf').then(({ pdfToHtml }) => registerImporter(['pdf'], pdfToHtml))

export default function Editor({ value, onSave }) {
  const ref = useRef(null)
  useEffect(() => {
    const ed = create(ref.current, { content: value, onSave: (html, ed, doc) => onSave(doc) })
    return () => ed.destroy()
  }, [])
  return <div ref={ref} />
}
```

Editor hanya berjalan di browser. Jangan memanggil `create()` saat render di server (SSR).

### 4.4 Vue / Svelte / framework lain

Pola yang sama: panggil `create(el, opsi)` setelah elemen terpasang (`onMounted`, `onMount`), lalu `ed.destroy()` saat komponen dilepas.

### 4.5 Plugin PDF dengan ESM

```js
import { create, registerImporter } from '@lord-tetsu/doc-editor'
// Muat di browser saja (mis. di dalam useEffect). pdf.js butuh fitur browser dan gagal bila dimuat
// saat render di server (SSR Next.js) atau di Node.js 20.
import('@lord-tetsu/doc-editor/pdf').then(({ pdfToHtml }) => registerImporter(['pdf'], pdfToHtml))
```

Versi `<script>` mendaftarkan dirinya otomatis ke `window.DocEditor`.

## 5. Opsi `create()`

`DocEditor.create(target, opsi)` menerima `target` berupa selector atau elemen, dan mengembalikan objek API (bagian 6).

| Opsi | Tipe / default | Keterangan |
|---|---|---|
| `content` | string \| objek | HTML awal, atau paket dokumen dari `getDocument()` |
| `fileName` | `'dokumen'` | Nama file ekspor (tanpa ekstensi) |
| `lang` | `'id'` | `'id'` atau `'en'` |
| `labels` | objek | Timpa teks/ikon per kunci (lihat 13.2) |
| `onChange` | `(html) => void` | Dipanggil setiap isi berubah |
| `onSave` | `(html, ed, doc) => any` | Bila diisi, muncul tombol **Simpan** dan pintasan Ctrl/Cmd+S. `doc` = paket dokumen lengkap |
| `page` | objek | Pengaturan halaman (bagian 8) |
| `contentCss` | string \| string[] | CSS tampilan dokumen: teks CSS atau URL `.css` |
| `theme` | `'light'` | `'light'`, `'dark'`, `'auto'`, `'inherit'`, atau objek warna |
| `density` | `'normal'` | `'compact'`, `'normal'`, `'comfortable'` (ukuran tombol) |
| `height` | kosong | Kosong = ikut isi; angka = px; string CSS (`'60vh'`, `'calc(100vh - 200px)'`); `'fill'` = mengisi wadah |
| `toolbar` | `{}` | `{ order: [kelompok…], hide: [kunci…] }` (bagian 7) |
| `menubar` | `true` | `true`/`false`, atau daftar menu yang tampil: `['file', 'edit', 'insert', …]` |
| `statusbar` | `true` | Tampilkan status bar (jalur elemen & jumlah kata) |
| `fonts` | `DEFAULT_FONTS` | Daftar CSS `font-family` di pilihan jenis huruf |
| `mergeTags` | `[]` | `[{ value, label }]` → disisipkan sebagai `{{value}}` |
| `templates` | `[]` | `[{ title, html, page? }]` |
| `ai` | – | `{ endpoint: 'https://…/api/ai' }`. Hanya URL, tanpa token |
| `autosave` | `false` | `true` atau string kunci → draf disimpan di `localStorage` |
| `spellcheck` | `true` | Pemeriksa ejaan bawaan browser |
| `allowExport` | `true` | `false` = tombol ekspor & cetak disembunyikan, fungsi ekspor menolak (ekspor lewat server) |
| `placeholder` | – | Teks samar saat dokumen kosong |
| `readonly` | `false` | Mode baca-saja (tombol pengubah isi nonaktif). Ubah kemudian dengan `setReadOnly()` |
| `fontSizes` | 8–72 | Daftar ukuran huruf (pt) di pilihan ukuran dan tombol A−/A+ |
| `imageUpload` | – | `async (file) => url`: gambar diunggah ke server Anda. Tanpa opsi ini, gambar disimpan sebagai data URL |

## 6. API instance

### Isi

| Metode | Keterangan |
|---|---|
| `getHTML()` | HTML isi dokumen |
| `getJSON()` | Struktur dokumen (JSON Tiptap) |
| `setContent(html)` | Ganti isi |
| `getDocument()` | Paket lengkap `{ version, html, page, css, lang, fileName }` |
| `loadDocument(doc)` | Muat paket |
| `wordCount()` | `{ words, characters }` |
| `newDocument()` | Kosongkan isi, header, footer, watermark (dengan konfirmasi) |
| `hasDraft()` / `restoreDraft()` | Draf otomatis (opsi `autosave`) |

### Halaman & tampilan dokumen

| Metode | Keterangan |
|---|---|
| `getPage()` | Pengaturan halaman aktif (sudah dinormalisasi) |
| `setPage(sebagian)` | Ubah sebagian pengaturan; yang tidak disebut tetap |
| `setContentCss(css)` / `getContentCss()` / `importCss()` | CSS tampilan dokumen |
| `ready` | Promise: selesai setelah CSS dari URL terpasang. Tunggu ini sebelum ekspor otomatis |

### Ekspor

| Metode | Keterangan |
|---|---|
| `exportDocx(nama?)` | Unduh Word |
| `exportDocxBlob()` | Word sebagai `Blob` (tanpa unduh) |
| `exportPdf(nama?)` | Dialog cetak browser (pilih "Simpan sebagai PDF") |
| `exportHtml(nama?)` | Unduh HTML per halaman |
| `getPagedHTML(judul?)` | Promise → string HTML per halaman (sama dengan pratinjau) |
| `getFullHTML(judul?)` | String HTML satu alur (catatan kaki di akhir) |
| `print(anchor?)` | Buka pratinjau cetak |

Saat `allowExport: false`, semua metode ekspor mengembalikan `false` dan menulis peringatan di konsol.

### Impor

| Metode | Keterangan |
|---|---|
| `importFile()` | Dialog pilih file |
| `importFrom(file)` | Impor `File`/`Blob` bernama (.docx/.md/.html/.txt, +.pdf dengan plugin). Pengaturan halaman dari file ikut diterapkan |

### Dialog & sisipan

`openHeaderFooter()`, `openWatermark()`, `insertToc()`, `openMath()`, `openFootnote()`, `openVideo()`, `openTablePicker()`, `openCharPicker()`, `openFind()`, `openA11y()`, `cropImage()`, `insertDateTime('date'|'dateShort'|'time'|'dateTime')`, `applyTemplate(t)`, `showWordCount()`, `showShortcuts()`.

### Mode tampilan

`setReadOnly(bool)`, `isReadOnly()`, `toggleCode()`, `isCodeView()`, `toggleFullscreen()`, `toggleSpellcheck()`, `setSpellLanguage('id'|'en')`, `togglePasteAsText()`, `toggleInvisibles()`, `toggleBlocks()`, `toggleFormatPainter()`.

### AI

`openAi()` (panel untuk teks terpilih), `openAiChat()`, `toggleAiChat()`, `closeAiChat()`, `isAiChatOpen()`, `isAiChatReady()`.

### Lainnya

`save()` (memanggil `onSave`), `runTool(nama)` (jalankan tombol toolbar mana pun, termasuk tombol kustom), `pickImageSrc()`, `destroy()`, `editor` (instance Tiptap, untuk kebutuhan lanjutan).

### Ekspor statis modul

`create`, `tinymce` (API bergaya TinyMCE, lihat [Migrasi dari TinyMCE](MIGRASI-TINYMCE.md)), `TOOLBAR_GROUPS`, `TOOLBAR_MENUS`, `DEFAULT_GROUP_ORDER`, `DEFAULT_FONTS`, `LOCALES`, `PAPER`, `registerImporter`, `buildDocx`.

## 7. Toolbar, menubar, status bar

### 7.1 Kelompok & kunci tombol

| Kelompok | Kunci tombol |
|---|---|
| `file` | `save`, `importMenu`, `exportMenu`, `print` |
| `history` | `undo`, `redo` |
| `font` | `blockType`, `fontFamily`, `fontSizeDown`, `fontSize`, `fontSizeUp` |
| `style` | `bold`, `italic`, `underline`, `strike`, `superscript`, `subscript`, `textColor`, `highlight`, `formatPainter`, `clearFormat`, `changeCase` |
| `align` | `alignLeft`, `alignCenter`, `alignRight`, `alignJustify`, `lineHeight`, `outdent`, `indent`, `ltr`, `rtl` |
| `list` | `bulletList`, `orderedList`, `taskList`, `blockquote` |
| `insert` | `link`, `image`, `imageCrop`, `table`, `horizontalRule`, `pageBreak`, `toc`, `math`, `footnote`, `video`, `specialChar`, `emoji`, `mergeTags`, `templates` |
| `page` | `hfButton`, `watermark` |
| `view` | `aiChat`, `code`, `fullscreen`, `spellcheck`, `a11yCheck` |

Isi dropdown (bisa disembunyikan juga):

- `table`: `tableNew`, `addColumn`, `addRow`, `deleteColumn`, `deleteRow`, `valignTop`, `valignMiddle`, `valignBottom`, `deleteTable`
- `importMenu`: `importAny`, `importDocx`, `importMd`, `importHtml`, `importTxt`, `importPdf`
- `exportMenu`: `exportDocx`, `exportPdf`, `exportHtml`

Tombol yang hanya muncul bila syaratnya terpenuhi: `save` (opsi `onSave`), `mergeTags`, `templates`, `aiChat` (opsi `ai.endpoint`), `importPdf` (plugin PDF dimuat).

### 7.2 Mengatur toolbar

```js
DocEditor.create('#editor', {
  toolbar: {
    order: ['insert', 'style'],                       // kelompok lain menyusul sesuai urutan bawaan
    hide: ['view', 'strike', 'exportHtml', 'emoji'],  // kelompok, tombol, atau isi dropdown
  },
})
```

Susunan sendiri (kelompok bebas, termasuk tombol kustom):

```js
toolbar: {
  groups: [['undo', 'redo'], ['bold', 'italic', 'ttd'], ['table', 'print']],
  buttons: {
    ttd: { text: 'Tanda tangan', tooltip: 'Sisipkan blok tanda tangan', icon: '<svg …>…</svg>',
           onAction: (ed) => ed.editor.chain().focus().insertContent('<p>Hormat kami,</p>').run(),
           isActive: (ed) => false },
  },
}
```

Nama yang salah ketik diabaikan dengan peringatan di konsol.

### 7.3 Menubar

Berisi menu Berkas, Edit, Tampilan, Sisipkan, Format, Alat, Tabel, dan Bantuan. Menubar mendukung keyboard (panah, Enter, Esc, Tab) dan berisi fungsi yang tidak ada di toolbar:

- tempel sebagai teks, karakter tersembunyi, tampilkan blok;
- tanggal/waktu, spasi tak terputus, contoh kode;
- baris/kolom kiri/atas, gabung/pisah sel, baris judul;
- jumlah kata, bahasa ejaan, impor CSS, pulihkan draf.

### 7.4 Pintasan keyboard

| Pintasan | Fungsi |
|---|---|
| Mod+B / I / U | Tebal / miring / garis bawah |
| Mod+Shift+S | Coret |
| Mod+. / Mod+, | Superskrip / subskrip |
| Mod+Alt+1…4, Mod+Alt+0 | Judul 1…4, paragraf |
| Mod+Shift+7 / 8 / 9 | Daftar bernomor / poin / centang |
| Tab / Shift+Tab | Indentasi butir daftar |
| Mod+K | Tautan |
| Mod+F | Cari & ganti |
| Mod+Z / Mod+Y | Urungkan / ulangi |
| Mod+S | Simpan (bila `onSave` diisi) |
| Mod+Shift+F | Layar penuh |
| Shift+F10 / tombol menu | Menu konteks (AI) |
| Ctrl/Cmd+Enter | Kirim di kotak rumus / catatan kaki |

Mod = Ctrl (Windows/Linux) atau ⌘ (Mac).

## 8. Pengaturan halaman

```js
page: {
  size: 'A4',                 // A3, A4, A5, F4, Letter, Legal, atau { width, height } dalam mm
  orientation: 'portrait',    // atau 'landscape'
  margin: 20,                 // mm; atau { top, right, bottom, left }
  header: '<p style="text-align:center"><img src="data:…" width="60"> PEMERINTAH KOTA …</p>',
  footer: '<p style="text-align:right">Halaman {page} dari {pages}</p>',
  headerDistance: 12.7,       // jarak header dari tepi atas (mm)
  footerDistance: 12.7,
  hideHeaderOn: '1',          // halaman tanpa header, mis. '1, 3-5, 8-'
  hideFooterOn: '1',
  firstPageNumber: 1,         // nomor yang tampil di halaman pertama
  watermark: { text: 'RAHASIA', color: '#808080', opacity: 0.15, angle: -45, size: 0 },
}
```

Aturan normalisasi (`src/page.js`):

- Ukuran tidak dikenal menjadi A4.
- Margin dibatasi 0–100 mm, dan area isi minimal 20 mm.
- Jarak header/footer tidak boleh melebihi margin.
- Watermark tanpa teks dianggap tidak ada. `size: 0` berarti ukuran otomatis menyesuaikan halaman.
- `hideHeaderOn`/`hideFooterOn` hanya menerima angka, koma, dan tanda hubung. `8-` berarti halaman 8 dan seterusnya.
- Nomor halaman yang dikecualikan adalah halaman fisik (lembar ke-n), bukan nomor yang dicetak.

Header/footer berisi HTML berformat. Placeholder `{page}` dan `{pages}` menjadi nomor halaman. Di Word, keduanya menjadi field nomor halaman asli.

Header yang tinggi (mis. kop dengan logo) otomatis mendorong area isi ke bawah, seperti di Word.

## 9. Fitur dokumen

### 9.1 Teks & paragraf

Fitur format teks:

- gaya blok (paragraf, Judul 1–6), jenis huruf, ukuran (pt, ±);
- tebal/miring/garis bawah/coret, superskrip/subskrip;
- warna teks, stabilo, format painter, hapus format;
- ubah huruf (BESAR, kecil, Huruf Awal, Huruf awal kalimat).

Fitur paragraf:

- rata kiri/tengah/kanan/rata kiri-kanan;
- spasi baris (1–3), indentasi (0,5 inci per tingkat, maks. 8);
- arah RTL (Arab dll.).

Semua format ini ikut ke Word.

### 9.2 Tabel

- **Sisipkan:** pemilih kisi.
- **Ubah:** tambah/hapus baris & kolom, gabung/pisah sel, baris judul, rata vertikal sel (atas/tengah/bawah), lebar kolom bisa diseret.
- **Di cetak/PDF:** tabel panjang dipotong antarhalaman dengan baris judul diulang.

### 9.3 Gambar

- **Penyimpanan:** gambar disimpan sebagai data URL agar dokumen tetap mandiri.
- **Ubah ukuran:** tarik sudut gambar.
- **Crop:** tombol crop, atau klik dua kali gambar.
- **Di Word:** semua format diubah ke PNG.

### 9.4 Daftar isi otomatis

Tombol **Daftar isi** menyisipkan blok yang otomatis diperbarui dari Judul 1–4.

- Di pratinjau, PDF, dan HTML, nomor halaman diisi sesuai tata letak.
- Di Word, daftar isi menjadi field TOC asli yang diperbarui saat dokumen dibuka.

### 9.5 Rumus matematika

- **Menyisipkan:** tombol **Rumus** membuka kotak LaTeX dengan pratinjau langsung, 22 tombol cepat, dan pilihan tampilan blok (tengah). Teks yang sedang diblok dipakai sebagai rumus awal.
- **Mengedit:** klik dua kali rumus.
- **Render:** `temml` mengubah LaTeX menjadi MathML yang ditampilkan langsung oleh browser, tanpa font atau CDN tambahan.
- **Penyimpanan:** `<span data-latex="…" class="de-math">` berisi MathML (dengan anotasi LaTeX), sehingga HTML tetap tampil walau tanpa library.
- **Word:** menjadi rumus OMML asli yang bisa diedit di Word, termasuk pecahan, akar, pangkat/indeks, ∑, ∫, dan batas atas/bawah. Matriks ditulis sebagai teks (`a, b; c, d`).
- **Keamanan:** perintah berisiko seperti `\href` tidak aktif dan tampil sebagai teks merah.

### 9.6 Catatan kaki

- **Menyisipkan:** tombol **Catatan kaki** menyisipkan nomor di akhir teks yang diblok (teksnya tidak tertimpa). Klik dua kali nomor untuk mengedit.
- **Di editor:** nomor otomatis; isi catatan tampil sebagai tooltip.
- **Di pratinjau, PDF, dan HTML per halaman:** isi catatan muncul di bawah halaman tempat nomornya berada, dan ruang isi halaman itu dikurangi sesuai tinggi catatan.
- **Di `getFullHTML()`:** catatan dikumpulkan di akhir dokumen.
- **Di Word:** menjadi footnote asli. Impor `.docx` membawa footnote kembali.
- **Format simpan:** `<sup data-footnote="isi catatan" class="de-fn"></sup>`. Isinya teks polos.

### 9.7 Video

- **Sumber yang diterima:**
  - URL YouTube (`watch`, `youtu.be`, `shorts`, `live`, `embed`) → disematkan lewat `youtube-nocookie.com`;
  - URL Vimeo;
  - tautan file video http(s) atau path relatif;
  - unggah file (maks. 25 MB, tersimpan sebagai data URL).
- **Penyimpanan:** `<div data-video class="de-video">` berisi `<iframe>` (YouTube/Vimeo) atau `<video controls>`.
- **Di Word dan PDF:** video tidak bisa diputar. Word menulis tautan "▶ Video: URL".
- **Syarat YouTube:** sematan YouTube memerlukan halaman yang dibuka lewat http(s). Dari `file://`, YouTube menolak dengan Error 153.

### 9.8 Header, footer, watermark

- **Dialog Header & footer:** editor mini untuk header dan footer (format, logo, nomor halaman), halaman yang dikecualikan, nomor awal, dan jarak dari tepi.
- **Pratinjau cetak:** header/footer bisa diedit langsung di halaman.
- **Watermark:** teks miring transparan di setiap halaman. Di Word ditempatkan sebagai gambar di belakang teks.

### 9.9 Lain-lain

Fitur lain:

- tautan, garis pemisah, pemisah halaman;
- karakter khusus, emoji;
- merge tag `{{nama}}`, template (bisa membawa pengaturan halaman);
- cari & ganti (huruf besar/kecil, ganti semua, format teks dipertahankan);
- tempel sebagai teks;
- pemeriksa aksesibilitas (gambar tanpa alt, judul kosong, lompatan tingkat judul, tabel tanpa baris judul, teks tautan tidak jelas seperti "klik di sini", kontras warna rendah);
- layar penuh, tampilan kode HTML (CodeMirror), jumlah kata.

## 10. Impor

| Format | Yang dibawa |
|---|---|
| `.docx` | Judul, paragraf, perataan, indentasi, spasi, tebal/miring/garis bawah/coret, warna, ukuran & jenis huruf, stabilo, superskrip/subskrip, daftar bertingkat, tautan, gambar, text box, tabel (lebar kolom, sel gabung, rata vertikal, baris judul), pemisah halaman, catatan kaki, ukuran kertas & margin, header/footer (termasuk nomor halaman), watermark |
| `.pdf` (plugin) | Paragraf, judul (dari ukuran huruf), tebal/miring, jenis huruf, perataan, tabel (termasuk tabel lintas halaman), header/footer berulang, ukuran kertas & margin. Hanya teks; PDF hasil scan tidak didukung |
| `.html` | Dirender di iframe sandbox tanpa skrip. Gaya terhitung (tebal, warna, huruf, perataan) dibaca, navigasi/sidebar dibuang, SVG menjadi gambar |
| `.md` | Markdown standar (`marked`) |
| `.txt` | Dipisah menjadi paragraf pada baris kosong; baris tunggal menjadi baris baru |

Hasil uji dengan berkas uji internal (tidak disertakan di repositori):

| File | Hasil |
|---|---|
| PDF 20 halaman | 1 h1, 28 h2, 530 paragraf, 19 tabel (133 baris), footer bernomor halaman, ukuran A4 + margin terdeteksi, dalam ± 0,2 detik |
| Markdown | 1 h1, 9 h2, 17 h3, 9 tabel, daftar, kutipan, kode |
| HTML e-book interaktif | Sidebar/navigasi dibuang, warna & huruf dipertahankan, 2 SVG menjadi gambar |

Importer tambahan bisa didaftarkan:

```js
DocEditor.registerImporter(['rtf'], async (file) => ({ html: await ubahRtf(file), page: { size: 'A4' } }))
```

## 11. Ekspor & pratinjau cetak

| Format | Cara kerja | Catatan |
|---|---|---|
| Word `.docx` | `buildDocx` membangun file dari struktur dokumen | Header/footer, watermark, daftar isi, rumus, catatan kaki asli. Pengecualian header/footer di halaman mana pun memakai section Word yang mengikuti tata letak pratinjau |
| PDF | Halaman dipecah di iframe, lalu dialog cetak browser | Identik dengan pratinjau. Pilih "Simpan sebagai PDF" |
| HTML per halaman | `getPagedHTML()` / `exportHtml()` | Satu file mandiri dengan halaman, header/footer, nomor, watermark |
| HTML satu alur | `getFullHTML()` | Untuk email/arsip web. Nomor halaman dihilangkan, catatan kaki di akhir |

Pratinjau cetak berisi:

- halaman sungguhan dengan penggaris;
- pengaturan ukuran kertas, orientasi, margin, jarak header/footer, watermark;
- edit header/footer langsung di halaman;
- jumlah halaman.

Perubahan di pratinjau tersimpan ke editor.

### Pengecualian header/footer di Word

Word tidak punya pengaturan "sembunyikan header di halaman 3". Library ini membagi dokumen menjadi beberapa **section**:

1. Tata letak pratinjau dihitung untuk mengetahui elemen mana yang memulai tiap halaman.
2. Halaman berurutan dengan status header/footer yang sama digabung menjadi satu section.
3. Section dengan header tersembunyi mendapat header kosong (watermark tetap ada).
4. Nomor halaman berlanjut antar-section.

Karena Word menata halaman sendiri, batas halaman bisa sedikit berbeda dari pratinjau bila huruf tidak tersedia di komputer pembaca. Bila halaman yang dikecualikan diawali potongan tabel, section dimulai pada elemen berikutnya.

## 12. Paket dokumen (simpan/muat)

```json
{
  "version": 1,
  "html": "<h1>Laporan</h1>…",
  "page": { "size": "A4", "orientation": "portrait", "width": 210, "height": 297,
            "margin": { "top": 20, "right": 20, "bottom": 20, "left": 20 },
            "header": "<p>KOP</p>", "footer": "<p>{page}/{pages}</p>",
            "headerDistance": 12.7, "footerDistance": 12.7, "watermark": null,
            "hideHeaderOn": "1", "hideFooterOn": "", "firstPageNumber": 1 },
  "css": "h1 { color: #003366 }",
  "lang": "id",
  "fileName": "laporan"
}
```

- Simpan sebagai JSON (kolom `JSON`/`TEXT` di database).
- Muat dengan `create('#el', { content: paket })` atau `ed.loadDocument(paket)`.
- Kirim paket yang sama ke `/api/export` (bagian 15) untuk hasil identik dengan pratinjau.

## 13. Tampilan: tema, bahasa, CSS dokumen

### 13.1 Tema

```js
theme: 'inherit'    // ikut huruf & warna template aplikasi, termasuk --bs-primary (Bootstrap)
theme: 'dark'       // atau 'light', 'auto' (ikut sistem)
theme: { preset: 'light', accent: '#0d6efd', toolbarBg: '#f8f9fa', uiFont: 'Inter, sans-serif' }
```

Kunci warna: `bg`, `color`, `border`, `toolbarBg`, `toolbarColor`, `hoverBg`, `activeBg`, `activeBorder`, `activeColor`, `accent`, `uiFont`. Semuanya menjadi variabel CSS `--de-*`, yang juga bisa ditimpa langsung dari CSS aplikasi.

### 13.2 Bahasa & label

- Bahasa bawaan: `id` dan `en` (`DocEditor.LOCALES`).
- Tombol: `{ label, title, html }`. `title` dipakai sebagai tooltip dan `aria-label`; `html` dipakai untuk ikon (SVG atau icon font).
- Pesan lain berupa string.

```js
labels: {
  bold: { label: 'Tebal', title: 'Cetak tebal' },
  save: { html: '<i class="bi bi-save"></i>', title: 'Simpan ke arsip' },
  linkPrompt: 'Alamat tautan:',
}
```

Bila hanya `label` yang diberikan, ikon bawaan diganti teks itu. Isi `html` dipasang apa adanya, jadi hanya isi dari kode Anda sendiri.

### 13.3 CSS dokumen

```js
contentCss: '/css/surat-dinas.css'   // atau teks CSS, atau array keduanya
```

- **Cakupan:** CSS dibatasi ke area dokumen sehingga tidak mengubah UI aplikasi. Berlaku di editor, pratinjau, PDF, dan HTML.
- **`@page { size; margin }`:** mengatur kertas.
- **Keamanan:** teks `</style>` di-escape, sehingga CSS tidak bisa menyisipkan skrip.
- **Impor manual:** pengguna bisa memuat file CSS lewat menu Berkas → Impor CSS tampilan.

## 14. Server AI

### 14.1 Menjalankan

```bash
cd webserver
cp .env.example .env    # isi lalu jalankan
node server.js
```

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` | 8787 | Port server |
| `NODE_ENV` | – | `production` = server menolak menyala tanpa `AI_AUTH_SECRET` & `ALLOWED_ORIGINS` |
| `AI_PROVIDER` | `pollinations` | `pollinations`, `gemini`, `groq`, `openrouter`, `ollama`, `openai` |
| `AI_API_KEY` | – | Kunci penyedia (tidak perlu untuk pollinations/ollama) |
| `AI_BASE_URL`, `AI_MODEL` | – | Opsional: API kompatibel OpenAI lain / ganti model |
| `AI_TEMPERATURE` | 0.2 | |
| `AI_TIMEOUT_MS` | 60000 | |
| `ALLOWED_ORIGINS` | – | Origin aplikasi, dipisah koma. Pola port `http://localhost:*`; `null` untuk `file://` (uji lokal saja) |
| `AI_AUTH_SECRET` | – | Secret bersama dengan backend aplikasi untuk tiket akses |
| `AI_TICKET_COOKIE` | `de_ai_ticket` | Nama cookie tiket |
| `AI_RATE_LIMIT` | 20 | Permintaan per menit per pengguna/IP |
| `EXPORT_TOKEN` | – | Token server-ke-server untuk `/api/export` (kosong = ekspor mati) |
| `CHROME_PATH`, `CHROME_NO_SANDBOX`, `EXPORT_CONCURRENCY`, `EXPORT_MAX_MB`, `DOC_EDITOR_LIB` | – | Pengaturan ekspor |

### 14.2 Endpoint

| Endpoint | Masukan → keluaran |
|---|---|
| `GET /health` | `{ ok, configured }`. Penyedia, model, dan kunci tidak pernah dikirim |
| `POST /api/ai` | `{ instruction, html }` → `{ answer }` (HTML pengganti teks terpilih) |
| `POST /api/ai/chat` | `{ messages, document?, selection? }` → `{ answer }` (Markdown) |

Kode galat:

| Kode | Arti |
|---|---|
| 401 | Tiket tidak sah atau kedaluwarsa |
| 403 | Origin tidak terdaftar |
| 413 | Permintaan terlalu besar |
| 429 | Batas laju, atau batas gratis penyedia (dengan waktu tunggu) |
| 502 | AI gagal; pesan aslinya diteruskan, tidak pernah ada jawaban palsu |
| 503 | Server belum dikonfigurasi |

### 14.3 Tiket akses

Alurnya:

1. Backend aplikasi Anda membuat tiket untuk pengguna yang sudah login.
2. Tiket dipasang sebagai cookie **HttpOnly**.
3. Browser mengirim cookie otomatis saat editor memanggil server AI.

Format tiket: `v1.<payload base64url>.<HMAC-SHA256 base64url>`, dengan payload `{ sub, exp, aud? }`.

```php
function de_ai_ticket(string $secret, string $userId, string $origin, int $ttl = 900): string {
  $b64 = fn($s) => rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
  $payload = $b64(json_encode(['sub' => $userId, 'exp' => time() + $ttl, 'aud' => $origin]));
  $sig = $b64(hash_hmac('sha256', "v1.$payload", $secret, true));
  return "v1.$payload.$sig";
}
setcookie('de_ai_ticket', de_ai_ticket(getenv('AI_AUTH_SECRET'), $user->id, 'https://app.kantor.go.id'), [
  'expires' => time() + 900, 'path' => '/', 'domain' => '.kantor.go.id',
  'httponly' => true, 'secure' => true, 'samesite' => 'Lax',
]);
```

Untuk Node: `createTicket({ secret, sub, aud, ttl })` dari `webserver/ticket.js`.

Supaya cookie terkirim, server AI harus berada di domain yang sama atau subdomainnya (`app.x.go.id` ↔ `ai.x.go.id`), atau di path yang sama lewat reverse proxy. Gunakan HTTPS.

### 14.4 Di sisi editor

```js
DocEditor.create('#editor', { ai: { endpoint: 'https://ai.kantor.go.id/api/ai' } })
```

- **Interaksi teks:** klik kanan pada teks yang diblok → *Interaction with AI* → tulis perintah, dan hasilnya langsung mengganti teks.
- **Panel AI Chat:** tombol di kelompok Tampilan. Panel memakai konteks dokumen atau teks terpilih, dan jawaban bisa disisipkan, mengganti teks, atau disalin.
- **Status aktif:** panel aktif setelah `/health` sehat dan tiket sah.

## 15. Ekspor dari backend

Dipakai bila ekspor di browser dimatikan (`allowExport: false`) dan dokumen hanya boleh diekspor setelah tersimpan di server.

```bash
curl -X POST https://ai.kantor.go.id/api/export \
  -H "Authorization: Bearer $EXPORT_TOKEN" -H "Content-Type: application/json" \
  -d '{"format":"pdf","document": <paket dokumen tersimpan>}' -o laporan.pdf
```

```php
$ch = curl_init('https://ai.kantor.go.id/api/export');
curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . getenv('EXPORT_TOKEN'), 'Content-Type: application/json'],
  CURLOPT_POSTFIELDS => json_encode(['format' => 'docx', 'document' => json_decode($row['dokumen'])])]);
$file = curl_exec($ch);
```

- **Format:** `docx`, `pdf`, `html`.
- **Cara kerja:** server membuka Chrome/Chromium headless dan menjalankan `dist/doc-editor.umd.js` dengan paket dokumen, sehingga hasilnya sama dengan pratinjau.
- **Isolasi:** saat render, jaringan Chrome diblokir, sehingga dokumen tidak bisa membuat server mengambil URL luar.
- **Akses:** endpoint ini tidak mengirim header CORS, dan tiket browser tidak berlaku di sini.
- **Batas:** jumlah render bersamaan dibatasi `EXPORT_CONCURRENCY`, ukuran permintaan dibatasi `EXPORT_MAX_MB`.

## 16. Keamanan

| Ancaman | Penanganan |
|---|---|
| XSS lewat isi dokumen | Semua HTML melewati skema editor: `<script>`, atribut `on…`, `javascript:`, dan iframe asing dibuang |
| XSS lewat impor HTML | Dirender di iframe sandbox tanpa skrip |
| XSS lewat jawaban AI | Markdown dirender lalu disaring dengan daftar tag/atribut yang diizinkan |
| XSS lewat CSS dokumen | CSS dibatasi ke area isi; `</style>` di-escape |
| XSS lewat rumus | `temml` dengan `trust: false`; perintah berbahaya hanya tampil sebagai teks |
| Iframe video berbahaya | Hanya YouTube (`youtube-nocookie`) dan Vimeo, alamat dibangun ulang dari ID, atribut `sandbox` |
| Kebocoran kunci AI | Kunci hanya di server. Browser hanya tahu URL. `/health` tidak membocorkan konfigurasi |
| Pemakaian AI oleh orang luar | Tiket HMAC berumur pendek di cookie HttpOnly, origin allowlist, batas laju, mode produksi wajib secret |
| Penyalahgunaan ekspor server | Token server-ke-server, tanpa CORS, Chrome tanpa jaringan, batas ukuran & konkurensi |
| Data terkirim ke AI gratis | Didokumentasikan; gunakan `ollama` untuk dokumen rahasia |

Yang tetap menjadi tanggung jawab aplikasi:

- **Sanitasi di server:** bersihkan HTML sebelum disimpan/ditampilkan (mis. HTMLPurifier).
- **Otorisasi dokumen:** pastikan hanya pemilik yang boleh membuka dan mengekspor dokumennya.
- **HTTPS:** pasang server AI di balik HTTPS.

File JavaScript library bisa disalin siapa pun yang membuka halaman. Yang dilindungi adalah layanan di server (AI dan ekspor).

## 17. Pengujian

| Lapisan | Perintah | Cakupan |
|---|---|---|
| Unit library | `npm test` | 28 tes: ekspor/impor docx bolak-balik, rumus OMML, catatan kaki, section header/footer, importer, pengaturan halaman, kelengkapan teks id/en |
| Server | `cd webserver && node --test` | 14 tes: tiket, origin, CORS, health, validasi, batas laju, 413, penyedia, galat AI, ekspor docx/html/pdf, injeksi CSS |
| Browser (manual/otomatis) | Chrome headless | 152 tombol & item menu diklik satu per satu tanpa galat JavaScript; uji API (undo, gabung sel, cari & ganti, draf, impor/ekspor, paket dokumen, pratinjau, `allowExport`, bahasa, toolbar) |
| AI langsung | Server dengan `.env` asli | Tanpa tiket → 401, origin asing → 403, cookie tak terbaca JavaScript, rewrite & chat berhasil (Gemini) |

## 18. Batasan yang diketahui

**Belum didukung:**

- komentar, riwayat revisi (track changes), kolaborasi real-time;
- impor rumus dari Word (OMML → LaTeX) dan PDF hasil scan (OCR);
- matriks rumus di Word (ditulis sebagai teks);
- catatan kaki berformat (isinya teks polos).

**Perbedaan antar-format:**

- PDF dibuat lewat dialog cetak browser. PDF tanpa dialog hanya tersedia lewat ekspor server.
- Batas halaman di Word bisa sedikit bergeser dari pratinjau bila huruf berbeda.
- Video tidak bisa diputar di Word/PDF.

**Penyimpanan & ukuran:**

- Gambar dan video unggahan disimpan di dalam dokumen (data URL), sehingga dokumen bisa besar.
- Bundel ± 496 KB gzip (± 1,6 MB mentah). Muat sekali, lalu biarkan browser menyimpannya di cache.

## 19. Pemecahan masalah

| Gejala | Penyebab & solusi |
|---|---|
| Tombol AI Chat abu-abu | `/health` tidak menjawab `ok`, tiket tidak ada/kedaluwarsa, atau origin belum ada di `ALLOWED_ORIGINS`. Periksa Network tab: 401/403 |
| AI menjawab 429 | Batas laju server atau batas gratis penyedia. Tunggu atau naikkan `AI_RATE_LIMIT` / ganti penyedia |
| Cookie tiket tidak terkirim | Domain cookie tidak mencakup server AI, atau situs tanpa HTTPS saat `secure: true` |
| Video YouTube "Error 153" | Halaman dibuka dari `file://`. Buka lewat http(s) |
| Ekspor server galat "Chrome tidak ditemukan" | Pasang Chrome/Chromium, isi `CHROME_PATH`. Di Docker sebagai root: `CHROME_NO_SANDBOX=1` |
| PDF impor kosong | PDF hasil scan (gambar). Perlu OCR di luar library |
| CSS dari URL tidak terpakai saat ekspor otomatis | Tunggu `await ed.ready` sebelum ekspor |
| Tombol tidak muncul | Disembunyikan lewat `toolbar.hide`, atau syaratnya belum terpenuhi (`onSave`, `mergeTags`, `templates`, `ai`, plugin PDF) |
| `npm install` dari GitHub gagal: `ssh: connect to host github.com port 22` atau `ECONNREFUSED … codeload.github.com:443` | Jaringan memblokir GitHub. Pasang dari registry npm: `npm install @lord-tetsu/doc-editor` |
| Paket terpasang tapi kosong, versi `0.0.0-stage` | Yang terpasang adalah penampung *staged publishing*, bukan library. Pasang versi tertentu (`npm install @lord-tetsu/doc-editor@0.1.0`), lalu lihat bagian 3 "Menerbitkan versi baru ke npm" |
| `Iterator is not defined` saat memuat `@lord-tetsu/doc-editor/pdf` | Plugin PDF dimuat di server (SSR) atau Node.js 20. Muat dengan `import()` di browser saja, mis. di dalam `useEffect` |
| `npm install` menambah puluhan paket | Versi lama paket (sebelum dependensi dipindah ke `devDependencies`). Perbarui ke versi terbaru |

## 20. Memperluas library

- **Importer baru:** `registerImporter(['ext'], async (file) => ({ html, page? }))`.
- **Node editor baru:** buat `Node.create({...})` (lihat `src/media.js`) lalu tambahkan ke daftar `extensions` di `src/index.js`. Untuk ekspor Word, tambahkan `case` di `block()` atau `inline()` di `src/docx.js`.
- **Tombol baru:** tambahkan `[kunci, aksi]` ke `GROUPS` di `src/index.js`, lalu teks & ikon di kedua bahasa di `src/locales.js`. Tes `locales.test.js` memastikan setiap tombol punya teks.
- **Penyedia AI baru:** tambahkan entri di `PROVIDERS` (`webserver/server.js`) bila API-nya kompatibel OpenAI, atau gunakan `AI_BASE_URL`.
