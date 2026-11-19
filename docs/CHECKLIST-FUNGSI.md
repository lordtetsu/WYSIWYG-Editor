# Checklist Fungsi doc-editor

Daftar periksa seluruh fungsi library doc-editor untuk pengujian (QA), uji terima, atau verifikasi setelah pembaruan versi. Rincian setiap fungsi ada di [Dokumentasi Teknis](DOKUMENTASI-TEKNIS.md).

| Data pengujian | |
|---|---|
| Versi library | |
| Tanggal | |
| Penguji | |
| Browser & sistem operasi | |
| Aplikasi / halaman uji | |

**Cara mengisi kolom Status:** ✅ lulus · ❌ gagal (tulis catatan di kolom terakhir) · ➖ tidak berlaku (fitur tidak dipakai di aplikasi ini).

Halaman uji yang paling mudah adalah `examples/offline.html` (playground): semua opsi bisa diatur dari panel kiri tanpa menulis kode.

---

## A. Instalasi & integrasi

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| A1 | Pasang paket | `npm install @lord-tetsu/doc-editor` | Terpasang tanpa dependensi tambahan; `import { create } from '@lord-tetsu/doc-editor'` berjalan | | |
| A2 | Pemakaian `<script>` | Muat `doc-editor.umd.js`, panggil `DocEditor.create('#editor')` | Editor tampil dengan menubar, toolbar, dan status bar | | |
| A3 | Sinkron `<textarea>` | Buat editor di atas `<textarea name="isi">` di dalam form, ketik teks, kirim form | Server menerima HTML terbaru di field `isi` | | |
| A4 | Next.js / React | Komponen `'use client'` dengan `create()` di `useEffect` dan `destroy()` saat unmount | Editor tampil sekali (juga di mode dev/Strict Mode), `next build` berhasil | | |
| A5 | Plugin impor PDF | `<script>`: muat `doc-editor-pdf.umd.js`. ESM: `import('@lord-tetsu/doc-editor/pdf')` di browser | Menu Impor memuat pilihan PDF | | |
| A6 | Lepas editor | Panggil `ed.destroy()` | Editor hilang; textarea asal tampil lagi | | |
| A7 | Offline | Putuskan internet, muat ulang halaman | Editor, impor, dan ekspor tetap berjalan (kecuali AI dan sematan YouTube/Vimeo) | | |

## B. Toolbar: berkas & riwayat

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| B1 | Simpan | Isi opsi `onSave`, klik **Simpan** atau tekan Ctrl/Cmd+S | `onSave(html, ed, doc)` terpanggil; tombol tidak muncul bila `onSave` kosong | | |
| B2 | Menu Impor | Klik **Impor** → pilih format | Dialog pilih file terbuka dengan filter sesuai format | | |
| B3 | Menu Ekspor | Klik **Ekspor** → Word / PDF / HTML | File terunduh (PDF: dialog cetak browser) | | |
| B4 | Cetak | Klik **Cetak** | Pratinjau cetak terbuka (lihat bagian H) | | |
| B5 | Urungkan / Ulangi | Ketik, klik ↶, lalu ↷ (juga Ctrl+Z / Ctrl+Y) | Perubahan dibatalkan lalu dikembalikan | | |

## C. Toolbar: huruf & format teks

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| C1 | Gaya teks | Pilih Paragraf / Judul 1–4 / Kode | Blok berubah sesuai pilihan | | |
| C2 | Jenis huruf | Blok teks, pilih huruf | Huruf berubah; ikut ke Word | | |
| C3 | Ukuran huruf | Pilih ukuran, lalu klik A− / A+ | Ukuran berubah ke ukuran berikutnya di daftar | | |
| C4 | Tebal / miring / garis bawah / coret | Blok teks, klik B / I / U / S (juga Ctrl+B/I/U) | Format diterapkan; tombol aktif tertandai | | |
| C5 | Superskrip / subskrip | Blok teks, klik x² / x₂ | Teks naik / turun | | |
| C6 | Warna teks & stabilo | Blok teks, pilih warna | Warna diterapkan; garis warna di tombol ikut berubah | | |
| C7 | Salin format | Taruh kursor di teks berformat, klik **Salin format**, lalu blok teks lain | Format tersalin; Esc membatalkan | | |
| C8 | Hapus format | Blok teks berformat, klik **Tx** | Semua format teks hilang | | |
| C9 | Ubah huruf | Blok teks, **Aa** → HURUF BESAR / huruf kecil / Huruf Awal / Huruf awal kalimat | Huruf berubah tanpa menghilangkan format | | |

## D. Toolbar: perataan & daftar

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| D1 | Perataan | Klik rata kiri / tengah / kanan / kiri-kanan | Paragraf rata sesuai pilihan | | |
| D2 | Spasi baris | Pilih 1 / 1,15 / 1,5 / 2 / 2,5 / 3 | Jarak baris berubah | | |
| D3 | Indentasi | Klik tambah / kurangi indentasi di paragraf dan di butir daftar | Paragraf bergeser 0,5 inci; butir daftar naik/turun tingkat | | |
| D4 | Arah teks | Klik RTL lalu LTR | Paragraf rata kanan-ke-kiri lalu kembali | | |
| D5 | Daftar poin / bernomor | Klik tombol daftar | Daftar terbentuk; Tab / Shift+Tab mengubah tingkat | | |
| D6 | Daftar centang | Klik daftar centang, centang satu butir | Kotak tercentang, teks dicoret | | |
| D7 | Kutipan | Klik ❝ | Paragraf menjadi kutipan | | |

## E. Sisipan

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| E1 | Tautan | Blok teks, klik tautan (Ctrl+K), isi URL | Teks menjadi tautan; URL kosong menghapus tautan | | |
| E2 | Gambar | Klik gambar, pilih file | Gambar tersisip (data URL, atau URL server bila `imageUpload` diisi) | | |
| E3 | Ubah ukuran gambar | Tarik sudut gambar | Ukuran berubah, rasio tetap | | |
| E4 | Crop gambar | Pilih gambar, klik crop (atau klik dua kali gambar) | Dialog crop; hasil potongan menggantikan gambar | | |
| E5 | Garis pemisah | Klik garis | Garis horizontal tersisip | | |
| E6 | Pemisah halaman | Klik pemisah halaman | Garis putus-putus di editor; halaman baru di pratinjau, PDF, dan Word | | |
| E7 | Daftar isi otomatis | Buat beberapa Judul 1–4, klik **Daftar isi**, lalu ubah satu judul | Daftar isi ikut berubah; nomor halaman terisi di pratinjau | | |
| E8 | Rumus matematika | Klik **Rumus**, ketik `\frac{a}{b}` atau pakai tombol cepat, centang "blok" | Pratinjau langsung tampil; rumus tersisip; klik dua kali untuk mengedit | | |
| E9 | Catatan kaki | Blok teks, klik **Catatan kaki**, isi teks | Nomor tersisip di akhir teks (teks tidak tertimpa); nomor urut otomatis; klik dua kali untuk mengedit | | |
| E10 | Video URL | Klik **Video**, tempel URL YouTube / Vimeo / file .mp4 | Video tersemat (YouTube lewat youtube-nocookie) | | |
| E11 | Video unggah | Klik **Video** → Unggah file (< 25 MB) | Video tersisip dan bisa diputar | | |
| E12 | Video ditolak | Tempel URL `ftp://…` atau file > 25 MB | Muncul pesan penolakan; tidak ada yang tersisip | | |
| E13 | Karakter khusus & emoji | Klik Ω / ☺, pilih karakter (panah + Enter) | Karakter tersisip di posisi kursor | | |
| E14 | Merge tag | Isi opsi `mergeTags`, klik `{ }`, pilih kolom | `{{nilai}}` tersisip | | |
| E15 | Template | Isi opsi `templates`, pilih template | Konfirmasi: ganti seluruh isi atau sisipkan di kursor | | |
| E16 | Tanggal & waktu | Menu Sisipkan → Tanggal (panjang / angka) / Waktu | Tanggal/waktu sesuai bahasa tersisip | | |

## F. Tabel

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| F1 | Sisipkan tabel | **Tabel** → Sisipkan tabel…, pilih ukuran di kisi | Tabel tersisip dengan baris judul | | |
| F2 | Tambah / hapus baris & kolom | Kursor di sel, pilih menu terkait (juga di atas / di kiri dari menubar) | Baris/kolom bertambah atau terhapus | | |
| F3 | Gabung & pisah sel | Blok beberapa sel, menubar Tabel → Gabungkan sel, lalu Pisahkan sel | Sel tergabung lalu terpisah lagi | | |
| F4 | Baris judul | Menubar Tabel → Baris judul | Baris pertama berganti judul / biasa | | |
| F5 | Rata vertikal sel | Kursor di sel → rata atas / tengah / bawah | Isi sel bergeser vertikal; ikut ke Word | | |
| F6 | Lebar kolom | Tarik batas kolom | Lebar berubah; ikut ke Word | | |
| F7 | Hapus tabel | Tabel → Hapus tabel | Tabel terhapus | | |
| F8 | Tombol nonaktif di luar tabel | Taruh kursor di luar tabel, buka menu Tabel | Perintah ubah tabel nonaktif | | |

## G. Tampilan & alat

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| G1 | Kode HTML | Klik `</>`, ubah HTML, kembali ke tampilan biasa | Perubahan kode diterapkan; `<script>` dan atribut `on…` dibuang | | |
| G2 | Layar penuh | Klik ⛶ (Ctrl+Shift+F), lalu Esc/klik lagi | Editor memenuhi layar lalu kembali | | |
| G3 | Pemeriksa ejaan | Klik ABC, ketik kata salah; ganti bahasa ejaan di menu Alat | Garis ejaan muncul/hilang; bahasa berganti | | |
| G4 | Pemeriksa aksesibilitas | Sisipkan gambar tanpa alt, judul melompat (H1 → H3), tabel tanpa judul; klik ♿ | Semua masalah terdaftar; klik masalah menuju lokasinya | | |
| G5 | Cari & ganti | Ctrl+F, isi kata dan pengganti, klik Ganti / Ganti semua | Kata ditandai dan diganti; format teks tetap | | |
| G6 | Tempel sebagai teks | Aktifkan di menu Edit, tempel teks berformat | Format sumber dibuang | | |
| G7 | Karakter tersembunyi & tampilkan blok | Menu Tampilan | Penanda paragraf/blok tampil dan hilang lagi | | |
| G8 | Jumlah kata | Menu Alat → Jumlah kata, dan status bar | Jumlah kata & karakter benar | | |
| G9 | Status bar | Pindahkan kursor ke tabel/judul | Jalur elemen (mis. `table › td › p`) dan jumlah kata diperbarui | | |
| G10 | Draf otomatis | Opsi `autosave: true`, ketik, muat ulang halaman, menu Berkas → Pulihkan draf | Isi terakhir kembali | | |
| G11 | Dokumen baru | Menu Berkas → Dokumen baru | Konfirmasi; isi, header, footer, watermark dikosongkan | | |
| G12 | Pintasan keyboard | Menu Bantuan → Pintasan keyboard | Daftar pintasan tampil | | |
| G13 | AI Chat nonaktif tanpa server | Opsi `ai` mengarah ke server mati | Tombol AI Chat abu-abu dengan keterangan "belum siap" | | |

## H. Halaman, header/footer, pratinjau cetak

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| H1 | Ukuran kertas | Pratinjau cetak → A3/A4/A5/F4/Letter/Legal/kustom | Lembar berubah ukuran; jumlah halaman diperbarui | | |
| H2 | Orientasi | Pilih portrait / landscape | Lembar berputar | | |
| H3 | Margin | Ubah margin atas/kanan/bawah/kiri | Area isi berubah; penggaris menandai margin | | |
| H4 | Header & footer | Toolbar **Header & footer**: isi teks, logo, `{page}/{pages}` | Muncul di setiap halaman dengan nomor halaman benar | | |
| H5 | Edit header di pratinjau | Klik header di salah satu halaman, ubah teks | Semua halaman ikut berubah dan tersimpan ke editor | | |
| H6 | Kecualikan halaman | Di dialog Header & footer, isi "Jangan tampilkan di halaman" untuk header: `1, 3-4` | Header hilang tepat di halaman 1, 3, 4 (pratinjau, PDF, HTML, Word) | | |
| H7 | Nomor halaman awal | Isi "Nomor halaman pertama" = 5 | Halaman pertama bernomor 5 | | |
| H8 | Jarak header/footer | Ubah jarak dari tepi | Posisi header/footer bergeser; header tinggi mendorong isi | | |
| H9 | Watermark | Toolbar **Watermark**: teks, warna, transparansi, sudut | Tampil di editor, pratinjau, PDF, HTML, Word | | |
| H10 | Tabel panjang | Buat tabel > 1 halaman, buka pratinjau | Tabel terpotong antarhalaman dengan baris judul diulang | | |
| H11 | Catatan kaki per halaman | Buat beberapa catatan kaki di halaman berbeda | Isi catatan muncul di bawah halaman yang sama, bernomor urut | | |
| H12 | Cetak | Klik **Cetak** di panel pratinjau | Dialog cetak browser; hasil sama dengan pratinjau | | |
| H13 | `@page` di CSS dokumen | Impor CSS berisi `@page { size: A5; margin: 15mm }` | Pengaturan kertas mengikuti CSS | | |

## I. Impor

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| I1 | Word (.docx) | Impor dokumen Word nyata berisi judul, format, tabel gabung, gambar, header/footer bernomor, catatan kaki, watermark | Isi & format terbawa; kertas, margin, header/footer, watermark diterapkan | | |
| I2 | PDF (teks) | Impor PDF bertabel dan berheader/footer (plugin PDF dimuat) | Judul, paragraf, tabel (termasuk lintas halaman), header/footer, ukuran kertas terdeteksi | | |
| I3 | PDF hasil scan | Impor PDF berupa gambar | Hasil kosong/minim (keterbatasan yang diketahui: belum ada OCR) | | |
| I4 | HTML | Impor halaman web berisi menu/sidebar, warna, huruf | Navigasi dibuang; warna & huruf dipertahankan; skrip tidak berjalan | | |
| I5 | Markdown | Impor .md berisi judul, daftar, tabel, kode | Struktur terbawa | | |
| I6 | Teks (.txt) | Impor teks berparagraf | Paragraf terpisah di baris kosong | | |
| I7 | Impor CSS tampilan | Menu Berkas → Impor CSS tampilan… | Tampilan dokumen berubah, UI aplikasi tidak ikut berubah | | |

## J. Ekspor

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| J1 | Word | Ekspor dokumen lengkap (format, tabel, gambar, daftar isi, rumus, catatan kaki, video, header/footer, watermark), buka di Microsoft Word | Semua terbawa; rumus bisa diedit; catatan kaki asli; daftar isi diperbarui saat dibuka; video menjadi tautan | | |
| J2 | Word: pengecualian header | Header disembunyikan di halaman `2, 4-5`, ekspor Word | Halaman tersebut tanpa header (section Word) | | |
| J3 | PDF | Ekspor PDF → Simpan sebagai PDF | Sama dengan pratinjau; teks bisa dipilih | | |
| J4 | HTML per halaman | Ekspor HTML, buka filenya | Tampilan per halaman dengan header/footer, nomor, watermark | | |
| J5 | HTML satu alur | `ed.getFullHTML()` | HTML mandiri; catatan kaki di akhir dokumen | | |
| J6 | Ekspor dimatikan | Opsi `allowExport: false` | Tombol Ekspor & Cetak hilang; `exportDocx()`/`exportPdf()` mengembalikan `false` | | |

## K. Paket dokumen & API

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| K1 | Simpan paket | `ed.getDocument()` | `{ version, html, page, css, lang, fileName }` lengkap | | |
| K2 | Muat paket | `create('#el', { content: paket })` atau `ed.loadDocument(paket)` | Isi, kertas, header/footer, watermark, CSS sama persis | | |
| K3 | Isi | `getHTML()`, `setContent()`, `getJSON()` | Sesuai isi editor | | |
| K4 | Halaman | `getPage()`, `setPage({ size: 'F4' })` | Hanya bagian yang disebut berubah | | |
| K5 | `onChange` | Ketik di editor | Callback terpanggil dengan HTML terbaru | | |
| K6 | Baca-saja | Opsi `readonly: true`, lalu `setReadOnly(false)` | Tidak bisa diketik & tombol nonaktif, lalu aktif lagi | | |
| K7 | Placeholder | Opsi `placeholder`, kosongkan dokumen | Teks samar tampil | | |
| K8 | `runTool` | `ed.runTool('bold')` dengan teks terblok | Teks menjadi tebal | | |
| K9 | `ready` | `await ed.ready` dengan `contentCss` berupa URL | Selesai setelah CSS terpasang | | |

## L. Tampilan & konfigurasi

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| L1 | Bahasa | Opsi `lang: 'en'` | Semua teks UI berbahasa Inggris | | |
| L2 | Label & ikon kustom | Opsi `labels: { bold: { label: 'Tebal', title: '…' } }` | Tombol memakai label baru | | |
| L3 | Tema | `theme: 'dark'`, `'auto'`, `'inherit'` (halaman Bootstrap), objek warna | Warna UI berubah; `inherit` mengikuti warna aplikasi | | |
| L4 | Kepadatan | `density: 'compact' / 'comfortable'` | Ukuran tombol berubah | | |
| L5 | Tinggi | `height` kosong / `400` / `'calc(100vh - 200px)'` / `'fill'` | Tinggi sesuai (angka = tinggi total termasuk border) | | |
| L6 | Toolbar: sembunyikan & urutkan | `toolbar: { hide: ['strike', 'view'], order: ['insert'] }` | Tombol/kelompok hilang; urutan berubah | | |
| L7 | Toolbar: susunan bebas & tombol kustom | `toolbar: { groups: [...], buttons: { … } }` | Kelompok sesuai; tombol kustom menjalankan `onAction` | | |
| L8 | Menubar & status bar | `menubar: false` / `['file', 'edit']`, `statusbar: false` | Menubar hilang/sebagian; status bar hilang | | |
| L9 | Daftar huruf & ukuran | `fonts: [...]`, `fontSizes: [10, 12, 14]` | Pilihan sesuai | | |
| L10 | CSS dokumen | `contentCss: 'p { color: navy }'` atau URL `.css` | Berlaku di editor, pratinjau, PDF, HTML | | |

## M. Kompatibilitas TinyMCE

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| M1 | `tinymce.init` | Jalankan kode TinyMCE lama tanpa diubah | Editor tampil; Promise berisi daftar editor | | |
| M2 | String toolbar | `toolbar: 'undo redo \| bold italic \| …'` | Kelompok & urutan sesuai; nama tak didukung disebut di konsol | | |
| M3 | `setup` & `addButton` / `addToggleButton` / `addIcon` | Daftarkan tombol di `setup` | Tombol tampil dan berfungsi; toggle tertandai aktif | | |
| M4 | Peristiwa | `editor.on('init' / 'change' / 'keydown')` | Handler terpanggil | | |
| M5 | Isi | `getContent()`, `getContent({ format: 'text' })`, `setContent()`, `insertContent()` | Sesuai | | |
| M6 | `execCommand` | `Bold`, `JustifyCenter`, `FontSize`, `mceInsertTable`, … | Perintah berjalan; perintah tak didukung memberi peringatan | | |
| M7 | Simpan & form | `isDirty()`, `save()`, `tinymce.triggerSave()` | Textarea terisi; status bersih | | |
| M8 | Unggah gambar | `images_upload_handler` / `images_upload_url` | Gambar tersisip dengan URL dari server | | |
| M9 | Mode | `editor.mode.set('readonly')` lalu `'design'` | Baca-saja lalu bisa diedit | | |
| M10 | Banyak editor | `selector: 'textarea.x'` untuk 2 elemen, lalu `tinymce.remove()` | Dua editor dibuat lalu dilepas | | |

## N. AI (butuh server AI)

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| N1 | Interaction with AI | Blok teks, klik kanan → *Interaction with AI*, tulis perintah | Teks terpilih diganti jawaban AI | | |
| N2 | Panel AI Chat | Klik AI Chat, tanya tentang dokumen | Jawaban tampil; bisa disisipkan, mengganti teks, atau disalin | | |
| N3 | Tanpa tiket | Panggil `/api/ai` tanpa cookie tiket | Ditolak 401 | | |
| N4 | Origin asing | Panggil dari origin yang tidak terdaftar | Ditolak 403 | | |
| N5 | Batas laju | Kirim permintaan melebihi `AI_RATE_LIMIT` per menit | Ditolak 429 dengan waktu tunggu | | |
| N6 | Tidak ada rahasia di browser | Periksa sumber halaman, Network, dan `document.cookie` | Hanya URL server terlihat; kunci AI tidak ada; tiket tidak terbaca JavaScript | | |
| N7 | Health | `GET /health` | Hanya `{ ok, configured }` | | |

## O. Ekspor dari backend (butuh webserver + Chrome)

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| O1 | Ekspor Word/PDF/HTML | `POST /api/export` dengan `Authorization: Bearer <EXPORT_TOKEN>` dan paket dokumen | File terunduh, sama dengan pratinjau | | |
| O2 | Tanpa token | Panggil tanpa / dengan token salah | Ditolak | | |
| O3 | Dari browser | Panggil `/api/export` dari JavaScript halaman | Diblokir (tanpa header CORS) | | |
| O4 | Tanpa jaringan | Paket berisi gambar URL luar | Render tidak mengambil URL luar | | |

## P. Keamanan

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| P1 | Skrip di isi | Tempel/impor/ketik di kode HTML: `<script>`, `<img onerror=…>`, tautan `javascript:` | Semua dibuang; tidak ada skrip berjalan | | |
| P2 | Iframe asing | Kode HTML `<iframe src="https://situs-lain">` | Dibuang (hanya YouTube/Vimeo diterima) | | |
| P3 | CSS berbahaya | CSS dokumen berisi `</style><script>…` | Tidak ada skrip di pratinjau/HTML | | |
| P4 | Rumus berbahaya | Rumus `\href{javascript:…}{x}` | Tampil sebagai teks merah, bukan tautan | | |
| P5 | Jawaban AI | AI menjawab dengan HTML berisi skrip | Skrip dibuang sebelum ditampilkan | | |
| P6 | Sanitasi server | Kirim HTML berbahaya langsung ke endpoint simpan aplikasi (tanpa editor) | Ditangani sanitasi di server aplikasi (tanggung jawab aplikasi) | | |

## Q. Aksesibilitas & keyboard

| No | Fungsi | Langkah uji | Hasil yang diharapkan | Status | Catatan |
|---|---|---|---|---|---|
| Q1 | Navigasi menubar | Fokus menubar, pakai panah, Enter, Esc | Menu terbuka/tertutup dengan keyboard | | |
| Q2 | Dialog | Buka pratinjau/dialog, tekan Tab dan Esc | Fokus tetap di dalam dialog; Esc menutup dan fokus kembali | | |
| Q3 | Label tombol | Periksa dengan pembaca layar | Setiap tombol punya nama (`aria-label`) | | |
| Q4 | Pintasan | Ctrl+B/I/U, Ctrl+K, Ctrl+F, Ctrl+S, Ctrl+Shift+F, Shift+F10 | Semua berfungsi | | |

---

## Ringkasan hasil

| Bagian | Jumlah uji | ✅ | ❌ | ➖ |
|---|---|---|---|---|
| A. Instalasi & integrasi | 7 | | | |
| B. Berkas & riwayat | 5 | | | |
| C. Huruf & format | 9 | | | |
| D. Perataan & daftar | 7 | | | |
| E. Sisipan | 16 | | | |
| F. Tabel | 8 | | | |
| G. Tampilan & alat | 13 | | | |
| H. Halaman & pratinjau | 13 | | | |
| I. Impor | 7 | | | |
| J. Ekspor | 6 | | | |
| K. Paket dokumen & API | 9 | | | |
| L. Tampilan & konfigurasi | 10 | | | |
| M. Kompatibilitas TinyMCE | 10 | | | |
| N. AI | 7 | | | |
| O. Ekspor backend | 4 | | | |
| P. Keamanan | 6 | | | |
| Q. Aksesibilitas & keyboard | 4 | | | |
| **Total** | **141** | | | |

Kesimpulan penguji:
