# Migrasi dari TinyMCE ke doc-editor

Panduan untuk developer yang sudah memakai TinyMCE. doc-editor menyediakan **API bergaya TinyMCE**: `tinymce.init({...})`, `tinymce.get()`, `editor.getContent()`, `editor.ui.registry.addButton()`, `editor.on('change')`, dan seterusnya. Pada umumnya cukup **mengganti file script** tanpa mengubah kode.

---

## 1. Langkah migrasi

### 1.1 Halaman biasa / PHP (`<script>`)

```html
<!-- Sebelum -->
<script src="/tinymce/tinymce.min.js"></script>

<!-- Sesudah -->
<script src="/assets/doc-editor.umd.js"></script>
<script src="/assets/doc-editor-pdf.umd.js"></script> <!-- opsional: impor PDF -->
```

Kode `tinymce.init(...)` yang sudah ada tetap jalan, karena `doc-editor.umd.js` memasang `window.tinymce` bila TinyMCE asli tidak dimuat. Objek yang sama juga tersedia sebagai `DocEditor.tinymce`.

```html
<form method="post" action="/simpan.php">
  <textarea id="isi" name="isi"><?= htmlspecialchars($isi) ?></textarea>
  <button>Simpan</button>
</form>
<script>
  tinymce.init({
    selector: '#isi',
    plugins: 'lists link image table code searchreplace wordcount',
    toolbar: 'undo redo | blocks fontsize | bold italic underline | alignleft aligncenter alignright | bullist numlist | link image table | code',
    menubar: 'file edit insert format table',
    height: 500,
    language: 'id',
  })
</script>
```

Isi textarea otomatis diperbarui setiap kali isi editor berubah, jadi form terkirim seperti biasa (tidak perlu `tinymce.triggerSave()`, walau tetap boleh dipanggil).

### 1.2 Bundler / ESM

```js
// Sebelum
import tinymce from 'tinymce'

// Sesudah
import { tinymce } from '@lord-tetsu/doc-editor'
```

### 1.3 React / Next.js (pengganti `@tinymce/tinymce-react`)

Komponen kecil dengan props yang sama seperti `<Editor>` dari `@tinymce/tinymce-react` (`init`, `initialValue`, `onEditorChange`, `onInit`):

```jsx
'use client'
import { useEffect, useRef } from 'react'
import { tinymce } from '@lord-tetsu/doc-editor'

export function Editor({ init = {}, initialValue = '', onEditorChange, onInit }) {
  const ref = useRef(null)
  useEffect(() => {
    let editor
    tinymce.init({
      ...init,
      target: ref.current,
      setup: (ed) => {
        init.setup?.(ed)
        ed.on('input', () => onEditorChange?.(ed.getContent(), ed))
      },
    }).then(([ed]) => { editor = ed; onInit?.(null, ed) })
    return () => editor?.remove()
  }, [])
  return <textarea ref={ref} defaultValue={initialValue} />
}
```

Pemakaiannya tetap: `<Editor init={{ height: 500, toolbar: 'bold italic' }} onEditorChange={(html) => setHtml(html)} />`.

---

## 2. Opsi `tinymce.init`

### 2.1 Didukung

| Opsi TinyMCE | Perilaku di doc-editor |
|---|---|
| `selector`, `target` | Sama. Satu selector boleh mengenai banyak elemen |
| `toolbar` (string dengan `\|`, array, `toolbar1…n`, objek `{ name, items }`, `false`) | Susunan dan kelompok tombol diikuti. Nama tombol dipetakan (bagian 3) |
| `menubar` (`true`/`false`/`'file edit …'`) | Sama. Menu yang tersedia: `file`, `edit`, `view`, `insert`, `format`, `tools`, `table`, `help` |
| `statusbar` | Sama |
| `height` | Sama (termasuk border). Plugin `autoresize` = tinggi ikut isi |
| `width` | Lebar kotak editor |
| `language` | `id…` → bahasa Indonesia, lainnya → bahasa Inggris |
| `placeholder` | Sama |
| `readonly`, `disabled` | Mode baca-saja |
| `skin: 'oxide-dark'` | Tema gelap |
| `content_css` | URL file CSS diterapkan ke isi dokumen (juga di pratinjau, PDF, HTML). Kata kunci bawaan (`default`, `dark`, `document`, `writer`) diabaikan |
| `content_style` | Sama |
| `font_family_formats` / `font_formats` | Daftar jenis huruf |
| `font_size_formats` / `fontsize_formats` | Daftar ukuran huruf (px diubah ke pt) |
| `setup(editor)` | Sama. Dipanggil sebelum editor dibuat, jadi `editor.on()` dan `editor.ui.registry.*` bisa dipakai di sini |
| `init_instance_callback(editor)` | Sama |
| `images_upload_handler(blobInfo, progress)` | Sama. `blobInfo.blob()`, `filename()`, `base64()`, `blobUri()` tersedia. Kembalikan Promise berisi URL |
| `images_upload_url`, `images_upload_credentials`, `images_upload_base_path` | Sama: file dikirim sebagai field `file`, server menjawab `{ "location": "…" }` |
| `save_onsavecallback` | Dipanggil tombol Simpan / Ctrl+S. Tanpa callback, tombol `save` mengirim form tempat textarea berada |
| `templates` (`{ title, content }`) | Menu Template |
| `mergetags_list` (termasuk grup `menu`) | Tombol merge tag (`{{nilai}}`) |
| Plugin `autosave` / `autosave_prefix` | Draf otomatis di browser |

### 2.2 Diabaikan tanpa peringatan

Opsi ini tidak diperlukan karena semua fitur sudah bawaan, atau opsinya khusus layanan TinyMCE:

- **Plugin & lisensi:** `plugins`, `external_plugins`, `license_key`, `api_key`, `branding`, `promotion`.
- **Lokasi file:** `skin_url`, `language_url`, `base_url`, `suffix`.
- **Toolbar & tampilan:** `toolbar_mode`, `toolbar_sticky`, `elementpath`, `contextmenu`, `quickbars_*`, `resize`, `min_height`, `max_height`.
- **URL:** `relative_urls`, `convert_urls`, `remove_script_host`, `document_base_url`.
- **Lain-lain:** `entity_encoding`, `paste_*`, `image_*`, `automatic_uploads`, `file_picker_types`, `link_list`, `image_list`, `autosave_*` lainnya, `menu`, `mobile`, `icons`.

### 2.3 Belum didukung (muncul peringatan di konsol)

Opsi lain yang tidak dikenal, misalnya `style_formats`, `formats`, `valid_elements`, `extended_valid_elements`, `file_picker_callback`, `link_class_list`, `table_class_list`.

Peringatan berbunyi `DocEditor (tinymce): opsi belum didukung, diabaikan: …`. Struktur HTML yang diizinkan ditentukan skema editor dan tidak bisa diubah lewat `valid_elements`.

`inline: true` belum didukung: editor dibuat dengan toolbar biasa.

### 2.4 Opsi tambahan doc-editor

Opsi asli doc-editor boleh ditulis langsung di objek yang sama:

```js
tinymce.init({
  selector: '#isi',
  toolbar: 'undo redo | bold italic | table | print',
  page: { size: 'F4', margin: 25, header: '<p>KOP SURAT</p>', footer: '<p>Hal {page}/{pages}</p>' },
  ai: { endpoint: 'https://ai.kantor.go.id/api/ai' },
  allowExport: false,
})
```

Yang bisa ditulis langsung: `page`, `ai`, `allowExport`, `theme`, `density`, `fileName`, `onChange`, `onSave`, `labels`, `fonts`, `fontSizes`, `contentCss`, `imageUpload`. Lihat [Dokumentasi Teknis](DOKUMENTASI-TEKNIS.md#5-opsi-create).

---

## 3. Nama tombol toolbar

| TinyMCE | doc-editor | TinyMCE | doc-editor |
|---|---|---|---|
| `undo` `redo` | sama | `bullist` `numlist` | Daftar poin / bernomor |
| `blocks` `formatselect` `styles` | Gaya teks | `checklist` | Daftar centang |
| `fontfamily` `fontselect` | Jenis huruf | `outdent` `indent` | Indentasi |
| `fontsize` `fontsizeselect` `fontsizeinput` | Ukuran huruf | `blockquote` | Kutipan |
| `bold` `italic` `underline` `strikethrough` | sama | `ltr` `rtl` | Arah teks |
| `superscript` `subscript` | sama | `link` | Tautan |
| `forecolor` `backcolor` | Warna teks / stabilo | `unlink` | Hapus tautan |
| `removeformat` | Hapus format | `image` | Gambar (crop/resize) |
| `casechange` | Ubah huruf | `media` | Video (file, YouTube, Vimeo) |
| `formatpainter` | Salin format | `table` | Tabel |
| `alignleft` `aligncenter` `alignright` `alignjustify` | Perataan | `hr` | Garis |
| `lineheight` | Spasi baris | `pagebreak` | Pemisah halaman |
| `charmap` | Karakter khusus | `toc` | Daftar isi otomatis |
| `emoticons` | Emoji | `footnotes` | Catatan kaki |
| `code` | Kode HTML | `math` `tinymcemath` | Rumus matematika |
| `codesample` | Blok kode | `searchreplace` | Cari & ganti |
| `fullscreen` | Layar penuh | `visualblocks` `visualchars` | Tampilkan blok / karakter tersembunyi |
| `preview` `print` | Pratinjau cetak | `wordcount` | Jumlah kata |
| `save` | Simpan | `insertdatetime` | Tanggal |
| `template` `inserttemplate` | Template | `newdocument` `restoredraft` | Dokumen baru / pulihkan draf |
| `mergetags` | Merge tag | `selectall` `help` | Pilih semua / pintasan |
| `spellchecker` `spellcheckdialog` | Ejaan | `a11ycheck` `accessibility` | Periksa aksesibilitas |
| `exportword` `exportpdf` `export` | Menu Ekspor | `importword` | Menu Impor |
| `aidialog` `aishortcuts` | AI Chat | | |

Nama yang tidak dikenal (mis. `anchor`, `addcomment`, `showcomments`, `revisionhistory`) dilewati dengan peringatan di konsol.

Tombol khas doc-editor yang tidak ada di TinyMCE (header & footer, watermark) tidak bisa ditulis di string toolbar TinyMCE. Untuk menampilkannya, jangan isi `toolbar`, sehingga toolbar bawaan doc-editor yang lengkap dipakai.

---

## 4. API editor

### 4.1 Objek global `tinymce`

| API | Keterangan |
|---|---|
| `tinymce.init(config)` | Promise berisi daftar editor yang dibuat |
| `tinymce.get(id)` / `tinymce.get()` | Editor dengan id itu / semua editor |
| `tinymce.activeEditor` | Editor terakhir yang difokus/dibuat |
| `tinymce.remove(selector \| id \| editor)` / `tinymce.remove()` | Lepas editor, textarea asal tampil lagi |
| `tinymce.triggerSave()` | Salin isi semua editor ke textarea |
| `tinymce.execCommand(cmd, ui, value)` | Pada editor aktif |
| `tinymce.editors`, `tinymce.majorVersion` | Tersedia |

### 4.2 Objek `editor`

| API | Keterangan |
|---|---|
| `id`, `targetElm`, `initialized`, `settings` | Sama |
| `getContent()` / `getContent({ format: 'text' })` | HTML / teks polos |
| `setContent(html)`, `insertContent(html)`, `resetContent(html?)` | Sama |
| `save()`, `load()` | Salin ke / dari textarea |
| `isDirty()`, `setDirty(bool)` | Sama |
| `focus()`, `hasFocus()` | Sama |
| `getBody()` | Elemen isi yang dapat diedit |
| `getContainer()`, `getContentAreaContainer()`, `getElement()` | Sama |
| `getDoc()`, `getWin()` | `document` / `window` halaman (isi tidak berada di iframe) |
| `mode.set('readonly' \| 'design')`, `mode.get()`, `mode.isReadOnly()` | Sama |
| `execCommand(cmd, ui, value)` | Lihat 4.4 |
| `queryCommandState(cmd)` | Bold, Italic, Underline, Strikethrough, Superscript, Subscript, Justify*, Insert(Un)OrderedList |
| `queryCommandValue(cmd)` | FontName, FontSize, ForeColor, HiliteColor/BackColor |
| `selection.getContent()` / `({ format: 'text' })`, `selection.setContent(html)` | Sama |
| `selection.getNode()`, `isCollapsed()`, `collapse(toStart)`, `select(node)` | Sama |
| `undoManager.undo()`, `redo()`, `hasUndo()`, `hasRedo()`, `transact(fn)` | Sama |
| `windowManager.alert(msg, cb)`, `windowManager.confirm(msg, cb)` | Memakai dialog bawaan browser |
| `notificationManager.open({ text })` | Ditulis ke konsol (belum ada notifikasi visual) |
| `on(nama, fn)`, `off`, `once`, `fire`/`dispatch` | Lihat 4.3 |
| `ui.registry.addButton(nama, { text, icon, tooltip, onAction })` | Sama. Cantumkan namanya di `toolbar` |
| `ui.registry.addToggleButton(nama, { …, onAction(api) })` | `api.isActive()` / `api.setActive(bool)` |
| `ui.registry.addIcon(nama, svg)` | Sama |
| `options.get(nama)`, `getParam(nama, default)` | Membaca konfigurasi init |
| `remove()`, `destroy()` | Sama |
| `docEditor` | Objek doc-editor asli: `getDocument()`, `exportDocx()`, `exportPdf()`, `setPage()`, `print()`, `openAiChat()`, … |

### 4.3 Peristiwa

| Peristiwa | Kapan |
|---|---|
| `init` | Editor siap (setelah `content_css` dari URL termuat) |
| `input`, `change` | Setiap isi berubah (TinyMCE memicu `change` lebih jarang; di sini sama dengan `input`) |
| `NodeChange`, `SelectionChange` | Posisi kursor/seleksi berubah |
| `focus`, `blur` | Sama |
| `keydown`, `keyup`, `keypress`, `click`, `dblclick`, `mousedown`, `mouseup`, `paste`, `copy`, `cut`, `contextmenu`, `drop`, `dragover` | Event DOM. Tersedia `e.keyCode`, `e.key`, `e.ctrlKey`, `e.preventDefault()`, dan `e.originalEvent` |
| `SetContent`, `SaveContent`, `ExecCommand`, `dirty`, `remove` | Sama |

### 4.4 `execCommand`

| Kelompok | Perintah |
|---|---|
| Format | `Bold`, `Italic`, `Underline`, `Strikethrough`, `Superscript`, `Subscript`, `RemoveFormat`, `mceToggleFormat` (`bold`, `italic`, …, `h1`–`h6`) |
| Huruf & warna | `FontName`, `FontSize`, `ForeColor`, `HiliteColor`, `BackColor`, `LineHeight` |
| Blok | `FormatBlock` (`p`, `h1`–`h6`, `pre`, `blockquote`), `mceBlockQuote`, `InsertUnorderedList`, `InsertOrderedList`, `Indent`, `Outdent` |
| Perataan | `JustifyLeft`, `JustifyCenter`, `JustifyRight`, `JustifyFull` |
| Sisipan | `mceInsertContent`, `mceReplaceContent`, `InsertHTML`, `mceSetContent`, `InsertHorizontalRule`, `InsertLineBreak`, `CreateLink`, `mceInsertLink`, `Unlink`, `mceInsertDate`, `mceInsertTime` |
| Tabel | `mceInsertTable` (`{ rows, columns }`), `mceTableInsertRowBefore/After`, `mceTableInsertColBefore/After`, `mceTableDeleteRow/Col`, `mceTableDelete`, `mceTableMergeCells`, `mceTableSplitCells`, `mceTableToggleHeaderRow` |
| Dialog & tampilan | `mceImage`, `mceLink`, `mceMedia`, `mceCharMap`, `mceEmoticons`, `mceCodeEditor`, `mceFullScreen`, `mcePreview`, `mcePrint`, `mceSearchReplace`, `mceWordCount`, `mceVisualBlocks`, `mceVisualChars`, `mceNewDocument`, `mceSave`, `mceInsertToc`, `mceA11yCheck` |
| Riwayat | `Undo`, `Redo`, `SelectAll`, `Delete` |

Perintah lain mengembalikan `false` dan menulis peringatan di konsol.

---

## 5. Contoh sebelum & sesudah

Kode TinyMCE berikut berjalan tanpa diubah:

```js
tinymce.init({
  selector: 'textarea#laporan',
  plugins: 'lists link image table code',
  toolbar: 'undo redo | bold italic | bullist numlist | link image | sisipTtd',
  images_upload_url: '/upload.php',
  setup(editor) {
    editor.ui.registry.addButton('sisipTtd', {
      text: 'Tanda tangan',
      onAction: () => editor.insertContent('<p>Hormat kami,<br><br><br>Kepala Bagian</p>'),
    })
    editor.on('change', () => (document.querySelector('#status').textContent = 'Belum disimpan'))
  },
})

document.querySelector('#kirim').onclick = () => {
  const html = tinymce.get('laporan').getContent()
  fetch('/api/laporan', { method: 'POST', body: html })
}
```

Untuk memakai fitur dokumen yang tidak ada di TinyMCE, cukup tambahkan:

```js
const ed = tinymce.get('laporan')
ed.docEditor.setPage({ size: 'A4', header: '<p>KOP</p>', footer: '<p>{page}/{pages}</p>' })
ed.docEditor.exportDocx('laporan')                    // unduh Word
const paket = ed.docEditor.getDocument()             // simpan isi + pengaturan halaman
```

---

## 6. Perbedaan yang perlu diketahui

| Hal | TinyMCE | doc-editor |
|---|---|---|
| Plugin | Harus didaftarkan di `plugins` | Semua fitur sudah bawaan; `plugins` diabaikan |
| Area isi | Iframe (kecuali inline) | Elemen `div` di halaman. `content_css` dibatasi ke area dokumen, sehingga tidak mengubah tampilan aplikasi |
| Struktur HTML | Bisa diatur (`valid_elements`) | Ditentukan skema editor. HTML tak dikenal dibuang, yang juga mencegah XSS |
| `change` | Saat undo level / blur | Setiap perubahan isi |
| Dialog kustom (`windowManager.open`) | Ada | Belum ada. Gunakan dialog aplikasi Anda sendiri |
| Menu kustom (`addMenuButton`, `addMenuItem`, `addSplitButton`, `addContextMenu`) | Ada | Belum ada. Gunakan `addButton` |
| Komentar, revisi, kolaborasi (fitur premium/cloud TinyMCE) | Berbayar | Belum tersedia |
| Ekspor Word/PDF | Plugin premium berbasis cloud | Bawaan, offline, sesuai pratinjau halaman |
| AI | Plugin premium (`ai_request`) | Server sendiri: opsi `ai: { endpoint }`. `ai_request` tidak dipakai |

## 7. Daftar periksa migrasi

1. Ganti file script, atau ganti `import tinymce from 'tinymce'` dengan `import { tinymce } from '@lord-tetsu/doc-editor'`.
2. Buka halaman, lalu periksa konsol browser. Setiap opsi, tombol, atau perintah yang belum didukung disebut namanya.
3. Uji alur simpan: form terkirim (textarea otomatis terisi), atau `getContent()` dipanggil saat simpan.
4. Bila memakai unggah gambar: uji `images_upload_handler` / `images_upload_url`.
5. Tetap bersihkan HTML di server sebelum disimpan (mis. HTMLPurifier).
6. Opsional: tambahkan `page`, `ai`, atau `allowExport: false` untuk fitur dokumen.
