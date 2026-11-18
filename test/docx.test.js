import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Packer } from 'docx'
import { unzipSync, strFromU8 } from 'fflate'
import { buildDocx } from '../src/docx.js'

const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')
const t = (text, ...marks) => ({ type: 'text', text, marks: marks.map((m) => (typeof m === 'string' ? { type: m } : m)) })
const para = (...content) => ({ type: 'paragraph', content })
const li = (...content) => ({ type: 'listItem', content })
const cell = (type, text, attrs = {}) => ({ type, attrs: { colspan: 1, rowspan: 1, ...attrs }, content: [para(t(text))] })

const SAMPLE = {
  type: 'doc',
  content: [
    { type: 'heading', attrs: { level: 1, textAlign: 'center' }, content: [t('Judul Laporan')] },
    para(t('tebal', 'bold'), t(' miring', 'italic'), t(' garis', 'underline'), t(' situs', { type: 'link', attrs: { href: 'https://example.com' } })),
    { type: 'bulletList', content: [li(para(t('poin A')), { type: 'orderedList', content: [li(para(t('sub 1')))] })] },
    { type: 'orderedList', content: [li(para(t('langkah 1'))), li(para(t('langkah 2')))] },
    { type: 'blockquote', content: [para(t('kutipan'))] },
    { type: 'codeBlock', content: [t('baris1\nbaris2')] },
    { type: 'horizontalRule' },
    { type: 'image', attrs: { src: 'data:ok', alt: 'logo' } },
    { type: 'image', attrs: { src: 'https://gagal', alt: 'rusak' } },
    { type: 'table', content: [
      { type: 'tableRow', content: [cell('tableHeader', 'Nama'), cell('tableHeader', 'Nilai')] },
      { type: 'tableRow', content: [cell('tableCell', 'gabung', { colspan: 2 })] },
      { type: 'tableRow', content: [{ type: 'tableCell', attrs: { colspan: 1, rowspan: 1 }, content: [] }, cell('tableCell', '90', { verticalAlign: 'middle' })] },
    ] },
  ],
}

async function render(json, loadImage) {
  const files = unzipSync(new Uint8Array(await Packer.toBuffer(await buildDocx(json, { loadImage }))))
  return { xml: strFromU8(files['word/document.xml']), files }
}

test('konversi semua jenis node ke .docx', async () => {
  const loadImage = async (src) => {
    if (src !== 'data:ok') throw new Error('CORS')
    return { data: PNG_1x1, width: 1200, height: 600 }
  }
  const { xml, files } = await render(SAMPLE, loadImage)

  assert.match(xml, /<w:pStyle w:val="Heading1"\/>/)
  assert.match(xml, /<w:jc w:val="center"\/>/)
  for (const s of ['Judul Laporan', 'tebal', 'poin A', 'sub 1', 'langkah 2', 'kutipan', 'baris1', 'baris2', 'Nama', 'gabung', '90']) assert.ok(xml.includes(s), s)
  assert.match(xml, /<w:b\/>/)
  assert.match(xml, /<w:i\/>/)
  assert.match(xml, /<w:u w:val="single"\/>/)
  assert.match(xml, /<w:hyperlink /)
  assert.match(xml, /<w:numPr>/)
  assert.match(xml, /<w:gridSpan w:val="2"\/>/)
  assert.match(xml, /<w:vAlign w:val="center"\/>/)
  assert.ok(Object.keys(files).some((f) => f.startsWith('word/media/')), 'gambar tertanam')
  assert.ok(xml.includes('cx="6115050"'), 'gambar 1200px diperkecil ke lebar halaman (642px)')
  assert.ok(xml.includes('[gambar tidak dapat dimuat: rusak]'))
})

test('daftar bernomor terpisah tidak melanjutkan nomor', async () => {
  const ol = { type: 'orderedList', content: [li(para(t('x')))] }
  const { files } = await render({ type: 'doc', content: [ol, para(t('jeda')), ol] })
  const numbering = strFromU8(files['word/numbering.xml'])
  // tiap instance list -> <w:num> sendiri dengan restart (lvlOverride/startOverride)
  assert.ok((numbering.match(/<w:startOverride/g) ?? []).length >= 2, numbering.slice(0, 300))
})

test('dokumen kosong tetap valid', async () => {
  const { xml } = await render({ type: 'doc', content: [] })
  assert.match(xml, /<w:p>|<w:p\/>|<w:p /)
})

test('ukuran kertas & margin ikut ke Word', async () => {
  const doc = await buildDocx({ type: 'doc', content: [] }, { page: { size: 'Letter', margin: { top: 25, left: 30 } } })
  const xml = strFromU8(unzipSync(new Uint8Array(await Packer.toBuffer(doc)))['word/document.xml'])
  assert.match(xml, /<w:pgSz w:w="12240" w:h="15840"/)
  assert.match(xml, /w:top="1417"/)
  assert.match(xml, /w:left="1701"/)
  assert.match(xml, /w:right="1134"/)
})

test('orientasi landscape ikut ke Word', async () => {
  const doc = await buildDocx({ type: 'doc', content: [] }, { page: { size: 'A4', orientation: 'landscape' } })
  const xml = strFromU8(unzipSync(new Uint8Array(await Packer.toBuffer(doc)))['word/document.xml'])
  const pgSz = xml.match(/<w:pgSz [^>]*>/)[0]
  assert.match(pgSz, /w:orient="landscape"/)
  assert.match(pgSz, /w:w="16838"/)
  assert.match(pgSz, /w:h="11906"/)
})
