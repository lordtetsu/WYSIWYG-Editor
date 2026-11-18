# Laporan Riset: Editor Dokumen WYSIWYG Offline dengan Ekspor Word/PDF

**Nama proyek:** doc-editor
**Periode:** s.d. November 2026
**Status:** prototipe fungsional, siap uji coba terbatas

---

## 1. Ringkasan eksekutif

Riset ini membangun **editor dokumen berbasis web** yang dapat dipasang di berbagai aplikasi (PHP, JavaScript, Next.js, dan lainnya). Kemampuannya:

- menulis dan memformat dokumen seperti di Word;
- mengekspor dokumen ke **Word (.docx), PDF, dan HTML** dengan tata letak halaman yang sama dengan pratinjau.

Seluruh fungsi inti berjalan **offline**, tanpa layanan cloud pihak ketiga dan tanpa biaya lisensi.

Hasil utama:

| Aspek | Hasil |
|---|---|
| Fitur | Setara fitur umum TinyMCE (toolbar, menubar, tabel, gambar, cari & ganti, dll.), ditambah fitur dokumen formal: kertas & margin, header/footer, watermark, daftar isi, rumus, catatan kaki, video |
| Ekspor | Word, PDF, HTML. Dapat dijalankan di browser **atau** di server (dokumen tersimpan → file) |
| Impor | Word, PDF, Markdown, HTML, teks |
| AI | Perbaikan teks via klik kanan dan panel AI Chat, melalui server internal. Kunci AI tidak pernah sampai ke browser |
| Kualitas | 42 tes otomatis lulus, 152 tombol/menu diuji di Chrome tanpa galat, 0 kerentanan dependensi |
| Biaya | Seluruh komponen berlisensi MIT/Apache-2.0. AI bisa memakai tier gratis atau model lokal |

**Rekomendasi:** lanjutkan ke uji coba terbatas (pilot) pada satu aplikasi internal. Prioritas berikutnya: penetapan lisensi proyek, pengujian lintas browser, dan pengujian dengan dokumen Word/PDF nyata dari unit kerja.

## 2. Latar belakang

Banyak aplikasi web internal perlu membuat dokumen formal: surat, laporan, nota dinas. Dokumen ini harus bisa diunduh sebagai Word atau PDF dengan format rapi (kop surat, nomor halaman, margin standar).

Pilihan yang umum dipakai memiliki kendala:

- **Editor komersial (TinyMCE, CKEditor):** fitur ekspor Word/PDF umumnya berupa plugin premium berbayar dan sering bergantung pada layanan cloud vendor. Dokumen keluar dari jaringan internal, dan ada biaya berlangganan.
- **Editor sumber terbuka (Quill, Tiptap, Lexical, Editor.js):** gratis, tetapi tidak memiliki konsep halaman, kertas, header/footer, maupun ekspor Word/PDF.
- **Pembuatan Word/PDF di server per aplikasi:** setiap aplikasi membuat templat sendiri, hasilnya berbeda dengan yang dilihat pengguna saat mengetik.

> Catatan: skema lisensi dan harga produk komersial berubah dari waktu ke waktu. Verifikasi ketentuan terbaru sebelum dijadikan dasar keputusan pengadaan.

## 3. Tujuan & ruang lingkup

Tujuan:

1. Membuat **library editor offline** yang dapat dipakai ulang di banyak aplikasi web, dengan stack apa pun.
2. **Ekspor Word/PDF/HTML** yang sesuai dengan tampilan pratinjau.
3. **Impor** dokumen yang sudah ada (Word, PDF, Markdown, HTML).
4. **Integrasi AI** yang aman: tidak ada token atau konfigurasi di browser, dan tidak bisa dipakai pihak yang tidak berwenang.
5. **Ekspor dari backend**: aplikasi dapat menonaktifkan ekspor di browser dan hanya mengekspor dokumen yang sudah tersimpan di server.

Di luar ruang lingkup:

- kolaborasi real-time;
- komentar dan revisi (track changes);
- OCR untuk PDF hasil pindaian.

## 4. Metodologi

1. **Kajian kebutuhan iteratif.** Kebutuhan dikumpulkan bertahap dari pengguna (± 40 permintaan fitur), termasuk perbandingan langsung dengan toolbar dan menu TinyMCE.
2. **Pemilihan teknologi.** Dasarnya: lisensi bebas, dapat berjalan offline, aktif dipelihara, dan ukuran wajar (bagian 5).
3. **Pengembangan bertahap.** Setiap fitur langsung diuji di Chrome dan dengan tes otomatis.
4. **Uji dengan dokumen nyata.** Impor diuji dengan berkas uji internal (tidak disertakan di repositori): PDF 20 halaman, Markdown, dan e-book HTML interaktif. Hasilnya dibandingkan dengan dokumen asli secara visual.
5. **Uji keamanan.** Skenario serangan diuji langsung:
   - XSS lewat isi, CSS, rumus, video, dan jawaban AI;
   - akses AI tanpa tiket atau dari origin asing;
   - kebocoran konfigurasi.
6. **Uji AI langsung** dengan penyedia nyata (Pollinations gratis dan Google Gemini) melalui alur keamanan produksi.

## 5. Pemilihan teknologi

| Komponen | Pilihan | Lisensi | Alasan |
|---|---|---|---|
| Inti editor | Tiptap 3.34 (ProseMirror) | MIT | Model dokumen terstruktur dan ketat (keamanan), mudah diperluas, aktif dipelihara |
| Ekspor Word | `docx` 9.15 | MIT | Membuat .docx langsung di browser, mendukung header/footer, section, footnote, rumus OMML, daftar isi |
| Impor Word | Parser sendiri + `fflate` 0.8 | MIT | Pustaka umum (mammoth) membuang warna, ukuran huruf, dan perataan; parser sendiri mempertahankannya |
| Impor PDF | `pdfjs-dist` 6.5 | Apache-2.0 | Standar industri, berjalan di browser |
| Markdown | `marked` 18 | MIT | Ringan, cepat |
| Rumus | `temml` 0.14 | MIT | LaTeX → MathML bawaan browser, tanpa font/CDN tambahan |
| Tampilan kode | CodeMirror 6 | MIT | Editor kode ringan |
| Build | esbuild | MIT | Satu file JS siap pakai tanpa tooling rumit (menggantikan Vite) |
| Server | Node.js 20, tanpa dependensi npm | – | Permukaan serangan kecil, mudah diaudit |
| Ekspor server | Chrome/Chromium headless | – | Menjalankan library yang sama sehingga hasilnya identik dengan pratinjau |

PDF dibuat lewat mesin cetak browser, bukan pustaka PDF terpisah, karena:

- hasilnya identik dengan pratinjau (satu mesin tata letak);
- teks tetap dapat dipilih dan dicari;
- ukuran library lebih kecil.

## 6. Arsitektur solusi

```
 Aplikasi (PHP / Next.js / …)
   │  <script src="doc-editor.umd.js">   ← satu file, offline
   ▼
 Editor di browser ──► ekspor Word / PDF / HTML (lokal)
   │
   │ paket dokumen (HTML + semua pengaturan) disimpan di database aplikasi
   ▼
 Backend aplikasi ──► Server doc-editor
                       ├─ /api/export  → Chrome headless (tanpa jaringan) → docx/pdf/html
                       └─ /api/ai      → penyedia AI (kunci hanya di sini)
```

Tiga keputusan desain utama:

1. **Satu mesin tata letak** untuk pratinjau, PDF, HTML per halaman, ekspor server, dan perhitungan section Word. Ini menjamin konsistensi hasil.
2. **Paket dokumen** menyimpan isi beserta semua pengaturan (kertas, margin, header/footer, halaman yang dikecualikan, watermark, CSS). Dokumen yang diekspor ulang bertahun-tahun kemudian tetap sama.
3. **Tiket akses AI di cookie HttpOnly** yang diterbitkan backend aplikasi, sehingga browser tidak pernah memegang kunci atau token.

## 7. Hasil

### 7.1 Fitur yang dihasilkan

| Kategori | Fitur |
|---|---|
| Format teks | Gaya judul, jenis & ukuran huruf, tebal/miring/garis bawah/coret, superskrip/subskrip, warna, stabilo, format painter, ubah huruf |
| Paragraf | Perataan 4 arah, spasi baris, indentasi, RTL, daftar poin/nomor/centang, kutipan |
| Sisipan | Tautan, gambar (crop, ubah ukuran), tabel (gabung sel, rata vertikal, baris judul), garis, pemisah halaman, daftar isi otomatis, **rumus matematika**, **catatan kaki**, **video**, karakter khusus, emoji, merge tag, template |
| Halaman | Kertas A3/A4/A5/F4/Letter/Legal/kustom, orientasi, margin, header/footer berulang (teks, logo, nomor halaman), pengecualian di halaman tertentu, nomor awal, watermark, penggaris |
| Alat | Cari & ganti, tampilan kode HTML, layar penuh, pemeriksa ejaan, pemeriksa aksesibilitas, jumlah kata, draf otomatis |
| Tampilan | Menubar & status bar, tema terang/gelap/ikut template aplikasi (termasuk Bootstrap), bahasa Indonesia/Inggris, semua label & ikon dapat diganti, toolbar dapat disembunyikan/diurutkan, impor CSS dokumen |
| AI | Klik kanan *Interaction with AI* (teks terpilih langsung diganti), panel AI Chat dengan konteks dokumen. Penyedia: Gemini, Groq, OpenRouter, Ollama (lokal), OpenAI, Pollinations |
| Integrasi | Satu file JS, textarea form otomatis tersinkron, `onSave` dengan paket dokumen, ekspor dari backend dengan token |

### 7.2 Kualitas & pengujian

| Uji | Hasil |
|---|---|
| Tes otomatis library | 28/28 lulus |
| Tes otomatis server | 14/14 lulus |
| Uji klik semua tombol & item menu di Chrome | 152 item, 0 galat JavaScript |
| Uji API browser (undo/redo, gabung sel, cari & ganti, draf, impor/ekspor, paket dokumen, pratinjau, mode tanpa ekspor, bahasa, toolbar) | Semua lulus |
| Audit dependensi (`npm audit`) | 0 kerentanan |
| Uji AI langsung (Gemini) | Rewrite dan chat berhasil; akses tanpa tiket ditolak (401), origin asing ditolak (403) |

Pada uji klik, beberapa item memang nonaktif dalam kondisi uji, dan diuji terpisah lewat API:

- AI Chat (server uji sengaja dimatikan);
- Ulangi (belum ada riwayat);
- gabung sel (perlu blok beberapa sel).

### 7.3 Impor dokumen nyata

| File uji | Waktu | Hasil |
|---|---|---|
| PDF 20 halaman (ensiklopedia) | ± 0,2 detik | 1 judul utama, 28 subjudul, 530 paragraf, 19 tabel (termasuk tabel yang terpotong antarhalaman, digabung kembali), footer "Page {page} of {pages}" dikenali, ukuran A4 & margin terdeteksi |
| Markdown | < 0,1 detik | Judul 3 tingkat, 9 tabel, daftar, kutipan, kode |
| E-book HTML interaktif | < 0,1 detik | Navigasi/sidebar dibuang, warna & huruf dipertahankan, ilustrasi SVG menjadi gambar |
| Word (hasil ekspor sendiri, bolak-balik) | – | Format, tabel, gambar, header/footer, watermark, catatan kaki kembali utuh |

### 7.4 Ukuran & kinerja

| Berkas | Ukuran terkompresi (gzip) |
|---|---|
| Library utama | ± 496 KB |
| Plugin impor PDF (opsional) | ± 517 KB |

Ukuran ini sebanding dengan editor komersial lengkap. Library dimuat sekali lalu disimpan di cache browser.

## 8. Evaluasi keamanan

| Risiko | Mitigasi | Status uji |
|---|---|---|
| Penyisipan skrip (XSS) lewat dokumen, impor, tempel | Semua HTML melewati skema editor; skrip, atribut `on…`, `javascript:` dibuang | Diuji |
| XSS lewat CSS, rumus, video, jawaban AI | CSS dibatasi & di-escape; rumus tanpa perintah berbahaya; iframe hanya YouTube/Vimeo dengan sandbox; jawaban AI disaring daftar putih | Diuji |
| Kebocoran kunci AI | Kunci hanya di server; browser hanya tahu URL; `/health` tidak membuka konfigurasi | Diuji (tidak ada kunci di bundel) |
| AI dipakai pihak tak berwenang | Tiket HMAC berumur pendek di cookie HttpOnly, daftar origin, batas laju, mode produksi wajib secret | Diuji langsung |
| Penyalahgunaan ekspor server | Token server-ke-server, tanpa CORS, Chrome tanpa akses jaringan, batas ukuran & konkurensi | Diuji |
| Data rahasia ke AI pihak ketiga | Dapat memakai model lokal (Ollama) | Didokumentasikan |

Risiko tersisa yang menjadi tanggung jawab aplikasi pemakai:

- sanitasi HTML di server sebelum disimpan;
- otorisasi akses dokumen;
- HTTPS.

## 9. Keterbatasan

1. **Belum tersedia:**
   - komentar, riwayat revisi, kolaborasi real-time;
   - OCR PDF pindaian;
   - impor rumus dari Word.
2. **Perbedaan antar-format:**
   - Matriks rumus di Word ditulis sebagai teks.
   - Video tidak dapat diputar di Word/PDF; Word menampilkan tautan.
   - Batas halaman di Word dapat sedikit bergeser dari pratinjau bila huruf tidak tersedia di komputer pembaca.
3. **Ekspor PDF di browser** memakai dialog cetak. PDF tanpa dialog tersedia lewat ekspor server, yang memerlukan Chrome/Chromium.
4. **Ukuran dokumen:** gambar dan video unggahan disimpan di dalam dokumen, sehingga dokumen bisa besar.
5. **Cakupan uji:**
   - Pengujian dilakukan di Chrome (macOS). Uji Firefox, Safari, dan Edge belum dilakukan.
   - Uji impor Word menggunakan dokumen hasil ekspor sendiri; perlu diuji dengan dokumen Word nyata dari unit kerja.
6. **Lisensi proyek** belum ditetapkan.

## 10. Rekomendasi & rencana lanjutan

| Prioritas | Kegiatan | Tujuan |
|---|---|---|
| Tinggi | Pilot pada satu aplikasi internal (mis. modul surat/laporan) | Validasi kebutuhan nyata |
| Tinggi | Uji impor dengan 20–50 dokumen Word/PDF nyata dari unit kerja | Mengukur ketepatan impor |
| Tinggi | Uji lintas browser (Firefox, Safari, Edge) | Kompatibilitas |
| Tinggi | Tetapkan lisensi & kepemilikan kode | Kepastian hukum distribusi |
| Sedang | Sediakan unggah gambar/video ke server aplikasi | Mengurangi ukuran dokumen |
| Sedang | Paket Docker untuk server AI & ekspor | Penyebaran mudah |
| Sedang | Uji beban ekspor server | Perencanaan kapasitas |
| Rendah | Komentar & riwayat revisi | Kebutuhan alur persetujuan dokumen |
| Rendah | OCR untuk PDF pindaian | Digitalisasi arsip lama |

## 11. Kesimpulan

Editor dokumen offline dengan ekspor Word/PDF yang konsisten dengan pratinjau dapat dibangun sepenuhnya dari komponen sumber terbuka berlisensi bebas. Biaya lisensi dan ketergantungan pada layanan cloud editor komersial dapat dihindari.

Prototipe telah:

- memenuhi seluruh kebutuhan yang dikumpulkan selama riset;
- lulus seluruh tes otomatis dan uji fungsional;
- dilengkapi model keamanan yang menjaga kunci AI tetap di server.

Langkah berikutnya yang disarankan adalah uji coba terbatas pada aplikasi nyata.

---

## Lampiran A. Lingkungan uji

| Item | Versi |
|---|---|
| Sistem operasi | macOS 27.2 |
| Node.js | 20.20 |
| Browser | Google Chrome 157 |
| Penyedia AI uji | Pollinations (gratis), Google Gemini (`gemini-2.5-flash`) |

## Lampiran B. Dokumen terkait

- [README.md](../README.md): ringkasan & mulai cepat
- [DOKUMENTASI-TEKNIS.md](DOKUMENTASI-TEKNIS.md): panduan pemasangan, opsi, API, server, keamanan
- [webserver/README.md](../webserver/README.md): server AI & ekspor backend
- [examples/offline.html](../examples/offline.html): playground konfigurasi
