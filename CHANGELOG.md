# Changelog

Semua perubahan penting pada proyek ini. Dibuat otomatis dari riwayat git oleh `scripts/changelog.mjs` setiap commit; jangan diedit manual.

## [v0.1.1 - 2026-11-19]

### Ditambahkan

- Tambah penyelarasan versi otomatis saat npm version (2026-11-19)

### Dihapus

- Hapus dist/ dan paket .tgz dari repo; distribusi lewat npm (2026-11-19)

## [v0.1.0 - 2026-11-19]

### Ditambahkan

- Tambah paket doc-editor-<versi>.tgz di dist/ sebagai cara instalasi (2026-11-19)
- Tambah API kompatibel TinyMCE untuk migrasi tanpa ubah kode (2026-11-18)
- Tambah CHANGELOG.md otomatis dan batasi pipeline CI ke GitLab opqrs (2026-11-18)
- Tambah doc-editor: editor WYSIWYG offline dengan ekspor Word/PDF/HTML (2026-11-18)

### Diubah

- Ubah nama paket menjadi @lord-tetsu/doc-editor dan siapkan terbit npm (2026-11-19)
- Ubah distribusi: sertakan dist/ agar bisa dipasang langsung dari Git (2026-11-19)
