# doc-editor

WYSIWYG editor offline untuk aplikasi web apa pun (PHP, JS, Next.js, …). Fiturnya:
- impor dari Word, Markdown, HTML, teks, dan PDF;
- ekspor ke Word, PDF, dan HTML dengan tata letak halaman yang sama persis dengan pratinjau;
- AI opsional lewat server sendiri.

Hasil build berupa **satu file JS** (CSS sudah termasuk) yang tidak memanggil CDN, ditambah satu file opsional untuk impor PDF.

- Contoh & konfigurator: [examples/offline.html](examples/offline.html). Jalankan `npm run build`, lalu buka file itu di browser.
- Server AI & ekspor dari backend: [webserver/](webserver/README.md)
- **Dokumentasi teknis lengkap** (pemasangan per stack, semua opsi & API, server, keamanan, pemecahan masalah): [docs/DOKUMENTASI-TEKNIS.md](docs/DOKUMENTASI-TEKNIS.md)
- **Migrasi dari TinyMCE** (opsi, nama tombol, API, peristiwa, perbedaan): [docs/MIGRASI-TINYMCE.md](docs/MIGRASI-TINYMCE.md)
- **Laporan riset** (latar belakang, pemilihan teknologi, hasil uji, keamanan, rekomendasi): [docs/LAPORAN-RISET.md](docs/LAPORAN-RISET.md)

```bash
npm install
npm run build   # dist/doc-editor.umd.js (<script>), dist/doc-editor.js (import), dist/doc-editor-pdf*.js (opsional, impor PDF)
npm test        # tes library (28 tes)
cd webserver && node --test   # tes server AI & ekspor (14 tes)
```

[CHANGELOG.md](CHANGELOG.md) diperbarui otomatis dari pesan commit oleh hook `.githooks/post-commit` (aktif setelah `npm install`). Awali pesan commit dengan *Tambah…*, *Perbaiki…*, *Hapus…*, atau lainnya (masuk *Diubah*). Rilis = tag `vX.Y.Z`.

Prasyarat: Node.js 20.12+. Ekspor dari backend juga memerlukan Chrome/Chromium di server.

| File hasil build | Ukuran gzip |
|---|---|
| `dist/doc-editor.umd.js` / `dist/doc-editor.js` | ± 496 KB |
| `dist/doc-editor-pdf.umd.js` / `dist/doc-editor-pdf.js` (opsional) | ± 517 KB |

## Pindah dari TinyMCE

Kode TinyMCE yang sudah ada bisa langsung dipakai: ganti `<script src="tinymce.min.js">` dengan `doc-editor.umd.js`, atau `import tinymce from 'tinymce'` dengan `import { tinymce } from 'doc-editor'`.

```js
tinymce.init({
  selector: '#isi',
  toolbar: 'undo redo | blocks | bold italic | alignleft aligncenter | bullist numlist | link image table | code',
  height: 500,
  setup: (editor) => editor.on('change', () => console.log(editor.getContent())),
})
```

Opsi, tombol, API, dan peristiwa yang didukung ada di [docs/MIGRASI-TINYMCE.md](docs/MIGRASI-TINYMCE.md). Yang belum didukung disebut di konsol browser.

## Pemakaian

```html
<script src="/assets/doc-editor.umd.js"></script>
<script>
  const ed = DocEditor.create('#editor', {
    content: dokumenTersimpan,             // HTML, atau paket dokumen dari ed.getDocument()
    onSave: (html, ed, doc) => simpan(doc), // doc = paket lengkap (isi + semua pengaturan)
  })
</script>
```

- **Form biasa (PHP dll.):** jika target berupa `<textarea>`, nilainya otomatis berisi HTML editor.
- **Next.js:** panggil `create()` di `useEffect` pada komponen `'use client'`, dan `destroy()` saat unmount.
- **Impor PDF:** muat juga `doc-editor-pdf.umd.js` setelah library utama (dengan `import`: `registerImporter(['pdf'], pdfToHtml)` dari `doc-editor/pdf`).

Contoh lengkap per stack ada di [dokumentasi teknis](docs/DOKUMENTASI-TEKNIS.md#4-pemasangan-di-berbagai-stack).

### Opsi `create()`

| Opsi | Keterangan |
|---|---|
| `content` | HTML awal, atau paket dokumen tersimpan (`{ html, page, css, … }`) |
| `fileName`, `lang` (`'id'`/`'en'`), `labels` | Nama file ekspor, bahasa, dan teks/ikon tombol (lihat `DocEditor.LOCALES`) |
| `onChange(html)`, `onSave(html, ed, doc)` | `onSave` memunculkan tombol Simpan dan pintasan Ctrl/Cmd+S |
| `page` | Kertas (A3/A4/A5/F4/Letter/Legal/kustom), orientasi, margin, `header`/`footer` (HTML, `{page}`/`{pages}`), `hideHeaderOn`/`hideFooterOn` (mis. `'1, 3-4'`), `firstPageNumber`, `headerDistance`/`footerDistance`, `watermark` |
| `contentCss` | CSS tampilan dokumen (teks atau URL `.css`). Berlaku di editor, pratinjau, cetak/PDF, dan HTML. `@page` ikut mengatur kertas. |
| `theme` | `'light'` / `'dark'` / `'auto'` / `'inherit'` (ikut huruf & warna template aplikasi, termasuk `--bs-primary`), atau objek warna |
| `density` | `'compact'` / `'normal'` / `'comfortable'` |
| `height` | Kosong = ikut isi; angka px; `'calc(100vh - 200px)'`; `'fill'` = mengisi panel |
| `toolbar` | `{ order: [kelompok…], hide: [tombol/kelompok/isi menu…] }`, atau susunan sendiri `{ groups: [['bold','italic'], …], buttons: { nama: { text, icon, onAction } } }`; lihat `DocEditor.TOOLBAR_GROUPS` & `TOOLBAR_MENUS` |
| `menubar`, `statusbar` | Menu Berkas/Edit/… (atau daftar menu: `['file', 'edit']`) dan baris status (default tampil) |
| `placeholder`, `readonly` | Teks samar saat kosong; mode baca-saja (`ed.setReadOnly()`) |
| `fontSizes` | Daftar ukuran huruf (pt) |
| `imageUpload` | `async (file) => url`: unggah gambar ke server Anda (default: data URL di dokumen) |
| `fonts` | Daftar pilihan jenis huruf |
| `mergeTags` | `[{ value, label }]` → disisipkan sebagai `{{value}}` |
| `templates` | `[{ title, html, page? }]`; template bisa membawa pengaturan halamannya sendiri |
| `allowExport` | `false` = ekspor & cetak dimatikan di browser (ekspor lewat server) |
| `ai` | `{ endpoint: 'https://…/api/ai' }`. **Hanya URL**; akses dibuktikan dengan cookie tiket HttpOnly (lihat webserver) |
| `autosave` | `true`/kunci → draf tersimpan di browser ini; bisa dipulihkan dari menu Berkas |
| `spellcheck` | Pemeriksa ejaan browser (default aktif) |

### API

| API | Fungsi |
|---|---|
| `ed.getDocument()` / `ed.loadDocument(doc)` | Paket dokumen lengkap untuk disimpan/dimuat. Ini yang dikirim ke ekspor backend agar hasilnya sama dengan pratinjau. |
| `ed.getHTML()` / `ed.setContent(html)` / `ed.getJSON()` | Isi saja |
| `ed.getPage()` / `ed.setPage(sebagian)` | Pengaturan halaman |
| `ed.setContentCss(css)` / `ed.importCss()` | CSS tampilan dokumen |
| `ed.exportDocx()` / `ed.exportPdf()` / `ed.exportHtml()` / `ed.print()` | Ekspor dan cetak di browser (bila `allowExport` tidak `false`) |
| `await ed.getPagedHTML()` / `ed.getFullHTML()` | HTML per halaman (sama dengan pratinjau) / satu alur |
| `ed.importFile()` / `ed.importFrom(file)` | Impor .docx/.md/.html/.txt (+.pdf dengan plugin) |
| `ed.openHeaderFooter()`, `ed.insertToc()`, `ed.openWatermark()`, `ed.openFind()`, `ed.openA11y()` | Dialog & sisipan |
| `ed.openMath()`, `ed.openFootnote()`, `ed.openVideo()` | Rumus, catatan kaki, video (klik dua kali rumus/nomor catatan untuk mengedit) |
| `ed.openAiChat()` / `ed.toggleAiChat()` | Panel AI Chat |
| `ed.ready` | Promise: selesai setelah CSS dari URL terpasang |
| `ed.destroy()` / `ed.editor` | Lepas editor / instance Tiptap |

## Fitur

- **Toolbar:** 9 kelompok berikon seragam, bisa disembunyikan dan diurutkan.
  - Berkas, Riwayat
  - Huruf: gaya teks, jenis & ukuran huruf ±
  - Format: B/I/U/S, superskrip/subskrip, warna teks, stabilo, format painter, hapus format, ubah huruf besar/kecil
  - Perataan: 4 arah, spasi baris, indentasi, LTR/RTL
  - Daftar & checklist & kutipan
  - Sisipkan: tautan, gambar (crop/resize), tabel, garis, pemisah halaman, daftar isi otomatis, **rumus matematika** (LaTeX + pratinjau langsung), **catatan kaki**, **video** (file, YouTube, Vimeo), karakter khusus, emoji, merge tag, template
  - Halaman: header & footer, watermark
  - Tampilan: AI Chat, kode HTML, layar penuh, ejaan, aksesibilitas
- **Menubar:** Berkas, Edit (potong/salin/tempel, tempel sebagai teks, cari & ganti), Tampilan (karakter tersembunyi, tampilkan blok), Sisipkan (tanggal/waktu, spasi tak terputus, contoh kode), Format, Alat (jumlah kata, bahasa ejaan), Tabel (baris/kolom, gabung/pisah sel, baris judul, rata vertikal), Bantuan (pintasan).
- **Pratinjau cetak:** halaman sungguhan dengan penggaris. Header/footer bisa diklik untuk diedit. Ada nomor halaman, watermark, daftar isi bernomor halaman, dan tabel panjang yang dipotong dengan baris judul berulang. Cetak, PDF, dan HTML memakai tata letak yang sama.
- **Rumus:** ditulis dalam LaTeX dan ditampilkan sebagai MathML bawaan browser (tanpa CDN). Di Word menjadi rumus Word asli yang bisa diedit. Matriks masih ditulis sebagai teks.
- **Catatan kaki:** nomor otomatis. Isinya muncul di bawah halaman yang sama (pratinjau, cetak/PDF, HTML), di akhir dokumen untuk `getFullHTML()`, dan sebagai footnote asli di Word. Impor .docx ikut membawa catatan kaki.
- **Video:** file video (data URL, maks. 25 MB) atau URL YouTube/Vimeo/file video. Di Word dan PDF, video tidak bisa diputar: Word menampilkan tautannya.
- **Header/footer dikecualikan di halaman mana pun** (mis. `'1, 3-5, 8-'`): di pratinjau/PDF/HTML per halaman, dan di Word lewat section yang mengikuti tata letak pratinjau.
- **Impor:**
  - Word: format, warna, tabel, gambar, header/footer, kertas, watermark.
  - PDF: paragraf, judul, tabel, header/footer, kertas.
  - HTML: membaca gaya CSS halaman, membuang navigasi.
  - Markdown.
- **AI:** klik kanan pada teks yang diblok → *Interaction with AI*, dan panel **AI Chat** (konteks dokumen/teks terpilih, sisipkan/ganti/salin). Panel hanya aktif bila server AI sehat.

## Keamanan

- **Isi dokumen selalu disaring skema editor:** `<script>`, atribut `on…`, dan `javascript:` dibuang dari impor, tempel, kode HTML, header/footer, dan template.
- **Impor HTML** dirender di iframe sandbox tanpa skrip.
- **Video:** iframe hanya diterima dari YouTube (youtube-nocookie) dan Vimeo, dengan atribut sandbox; iframe lain dibuang. Rumus LaTeX dirender tanpa perintah berisiko (`\href` dll. tidak aktif).
- **Jawaban AI** disaring dengan daftar tag yang diizinkan sebelum ditampilkan.
- **CSS tampilan** dibatasi ke area dokumen dan tidak bisa menyisipkan skrip ke halaman cetak.
- **AI:** browser hanya menyimpan URL server. Kunci AI ada di server, dan akses pengguna dibuktikan dengan tiket bertanda tangan di cookie **HttpOnly** yang dibuat backend aplikasi. Origin dibatasi dan ada batas laju. Lihat [webserver/README.md](webserver/README.md).
- **Ekspor backend** hanya bisa dipanggil server Anda dengan `EXPORT_TOKEN`.
- **Tetap bersihkan HTML di server** sebelum menyimpan/menampilkan ulang (mis. HTMLPurifier di PHP), karena request bisa dikirim tanpa lewat editor.
- **File JavaScript library selalu bisa disalin** oleh siapa pun yang membuka halaman. Yang dilindungi adalah layanan berbayar/sensitif di server: AI dan ekspor.

## Batasan

- **Belum ada:** komentar, riwayat revisi, kolaborasi real-time, OCR untuk PDF hasil scan, dan impor rumus dari Word.
- **Rumus di Word:** matriks ditulis sebagai teks.
- **Video:** tidak bisa diputar di Word/PDF.
- **PDF dari browser** memakai dialog cetak. PDF tanpa dialog tersedia lewat ekspor server.
- **Teruji di Chrome.** Browser lain belum diuji.

Rincian di [dokumentasi teknis](docs/DOKUMENTASI-TEKNIS.md#18-batasan-yang-diketahui).
