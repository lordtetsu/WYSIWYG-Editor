// Penerjemahan konfigurasi tinymce.init -> opsi DocEditor.create.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { toolbarFrom, optionsFrom } from '../src/tinymce.js'

test('toolbar TinyMCE: "|" jadi kelompok, nama dipetakan, tombol menu jadi tombol kustom, yang tak dikenal dilaporkan', () => {
  const tb = toolbarFrom({ toolbar: 'undo redo | blocks fontsize | bold italic strikethrough forecolor | bullist numlist | link image media table | searchreplace code fullscreen | anchor', __custom: new Set() })
  assert.deepEqual(tb.groups, [['undo', 'redo'], ['blockType', 'fontSize'], ['bold', 'italic', 'strike', 'textColor'], ['bulletList', 'orderedList'], ['link', 'image', 'video', 'table'], ['searchreplace', 'code', 'fullscreen']])
  assert.ok(tb.buttons.searchreplace)
  assert.deepEqual(tb.unknown, ['anchor'])
  assert.deepEqual(toolbarFrom({ toolbar1: 'bold', toolbar2: 'italic' }).groups, [['bold'], ['italic']])
  assert.deepEqual(toolbarFrom({ toolbar: [{ name: 'h', items: ['undo', 'redo'] }] }).groups, [['undo', 'redo']])
  assert.deepEqual(toolbarFrom({ toolbar: false }).groups, [])
  assert.deepEqual(toolbarFrom({ toolbar: 'mybtn', __custom: new Set(['mybtn']) }).groups, [['mybtn']])
})

test('opsi TinyMCE -> opsi doc-editor', () => {
  const { options, warn } = optionsFrom({
    selector: '#a', plugins: 'lists link autosave', license_key: 'gpl', language: 'id_ID', height: '500', menubar: 'file edit table bogus',
    content_css: ['default', '/css/doc.css'], content_style: 'body{font-size:12pt}', placeholder: 'Ketik…', readonly: true, skin: 'oxide-dark',
    font_family_formats: 'Arial=arial,helvetica,sans-serif; Courier New=courier new,courier', font_size_formats: '8pt 12pt 16px',
    templates: [{ title: 'Surat', content: '<p>x</p>' }], mergetags_list: [{ title: 'Klien', menu: [{ value: 'nama', title: 'Nama' }] }],
    page: { size: 'F4' }, ai: { endpoint: 'https://ai/api/ai' }, foo_bar: 1,
  })
  assert.equal(options.lang, 'id')
  assert.equal(options.height, 500)
  assert.deepEqual(options.menubar, ['file', 'edit', 'table'])
  assert.deepEqual(options.contentCss, ['/css/doc.css', 'body{font-size:12pt}'])
  assert.equal(options.placeholder, 'Ketik…')
  assert.equal(options.readonly, true)
  assert.equal(options.theme, 'dark')
  assert.deepEqual(options.fonts, ['arial,helvetica,sans-serif', 'courier new,courier'])
  assert.deepEqual(options.fontSizes, [8, 12, 12])
  assert.deepEqual(options.templates, [{ title: 'Surat', html: '<p>x</p>' }])
  assert.deepEqual(options.mergeTags, [{ value: 'nama', label: 'Nama' }])
  assert.equal(options.autosave, true)
  assert.deepEqual(options.page, { size: 'F4' })
  assert.deepEqual(warn, ['foo_bar'])
})
