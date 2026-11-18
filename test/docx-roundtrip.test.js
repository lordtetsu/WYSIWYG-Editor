// Ekspor (buildDocx) lalu impor kembali (docxToHtml): format penting harus selamat.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Packer } from 'docx'
import { DOMParser } from '@xmldom/xmldom'
import { zipSync, strToU8 } from 'fflate'
import { buildDocx } from '../src/docx.js'
import { docxToHtml } from '../src/docx-import.js'

const parseXml = (s) => new DOMParser().parseFromString(s, 'application/xml')
const t = (text, ...marks) => ({ type: 'text', text, marks: marks.map((m) => (typeof m === 'string' ? { type: m } : m)) })
const para = (attrs, ...content) => ({ type: 'paragraph', attrs, content })
const cell = (type, text, attrs = {}) => ({ type, attrs: { colspan: 1, rowspan: 1, ...attrs }, content: [para({}, t(text))] })
const PNG_1x1 = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64')

async function roundtrip(json, opts) {
  const buf = await Packer.toBuffer(await buildDocx(json, opts))
  return docxToHtml(new Uint8Array(buf), { parseXml })
}

test('format teks, perataan, judul, daftar bertingkat', async () => {
  const { html } = await roundtrip({ type: 'doc', content: [
    { type: 'heading', attrs: { level: 2, textAlign: 'center' }, content: [t('Judul Dua')] },
    para({ textAlign: 'right' }, t('tebal', 'bold'), t(' miring', 'italic'), t(' garis', 'underline'), t(' coret', 'strike')),
    para({ textAlign: 'justify' }, t('merah besar', { type: 'textStyle', attrs: { color: '#ff0000', fontSize: '16pt', fontFamily: 'Arial', backgroundColor: '#ffff00' } })),
    para({}, t('situs', { type: 'link', attrs: { href: 'https://example.com' } })),
    { type: 'bulletList', content: [
      { type: 'listItem', content: [para({}, t('poin A')), { type: 'orderedList', content: [{ type: 'listItem', content: [para({}, t('sub 1'))] }] }] },
      { type: 'listItem', content: [para({}, t('poin B'))] },
    ] },
  ] })
  assert.match(html, /<h2 style="text-align: center">Judul Dua<\/h2>/)
  assert.match(html, /<p style="text-align: right"><strong>tebal<\/strong><em> miring<\/em><u> garis<\/u><s> coret<\/s><\/p>/)
  assert.match(html, /style="text-align: justify"><span style="color: #ff0000; font-size: 16pt; font-family: Arial; background-color: #ffff00">merah besar<\/span>/)
  assert.match(html, /<a href="https:\/\/example.com">.*situs.*<\/a>/)
  assert.match(html, /<ul><li><p>poin A<\/p><ol><li><p>sub 1<\/p><\/li><\/ol><\/li><li><p>poin B<\/p><\/li><\/ul>/)
})

test('tabel: header, sel gabung, lebar kolom, rata vertikal', async () => {
  const { html } = await roundtrip({ type: 'doc', content: [{ type: 'table', content: [
    { type: 'tableRow', content: [cell('tableHeader', 'A', { colwidth: [200] }), cell('tableHeader', 'B', { colwidth: [100] })] },
    { type: 'tableRow', content: [cell('tableCell', 'gabung baris', { rowspan: 2, verticalAlign: 'middle' }), cell('tableCell', 'b1')] },
    { type: 'tableRow', content: [cell('tableCell', 'b2')] },
    { type: 'tableRow', content: [cell('tableCell', 'gabung kolom', { colspan: 2 })] },
  ] }] })
  assert.match(html, /<tr><th colwidth="200"><p><strong>A<\/strong><\/p><\/th><th colwidth="100">/)
  assert.match(html, /<td rowspan="2" colwidth="200" style="vertical-align: middle"><p>gabung baris<\/p><\/td>/)
  assert.match(html, /<tr><td colwidth="100"><p>b2<\/p><\/td><\/tr>/)
  assert.match(html, /<td colspan="2" colwidth="200,100"><p>gabung kolom<\/p><\/td>/)
})

test('kertas, margin, header & footer dengan nomor halaman, gambar', async () => {
  const header = { type: 'doc', content: [para({ textAlign: 'center' }, t('KOP SURAT', 'bold'))] }
  const footer = { type: 'doc', content: [para({ textAlign: 'right' }, t('Halaman {page} dari {pages}'))] }
  const { html, page } = await roundtrip(
    { type: 'doc', content: [{ type: 'image', attrs: { src: 'x', width: 120 } }] },
    { page: { size: 'F4', orientation: 'landscape', margin: { top: 30, right: 15, bottom: 25, left: 35 }, headerDistance: 10 }, header, footer,
      loadImage: async () => ({ data: PNG_1x1, width: 1, height: 1 }) },
  )
  assert.equal(page.size, 'F4')
  assert.equal(page.orientation, 'landscape')
  assert.deepEqual(page.margin, { top: 30, right: 15, bottom: 25, left: 35 })
  assert.equal(page.headerDistance, 10)
  assert.match(page.header, /<p style="text-align: center"><strong>KOP SURAT<\/strong><\/p>/)
  assert.match(page.footer, /<p style="text-align: right">Halaman \{page\} dari \{pages\}<\/p>/)
  assert.match(html, /<img src="data:image\/png;base64,[^"]+" width="120">/)
})

test('XML Word buatan tangan: sel gabung vertikal, field kompleks, style turunan', () => {
  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
  const docXml = `<w:document ${W}><w:body>
    <w:p><w:pPr><w:pStyle w:val="Judulku"/></w:pPr><w:r><w:t>Judul Turunan</w:t></w:r></w:p>
    <w:p><w:pPr><w:pStyle w:val="Tengah"/></w:pPr><w:r><w:t>teks tengah</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">Hal </w:t></w:r><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PAGE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>7</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>
    <w:tbl><w:tblGrid><w:gridCol w:w="1500"/><w:gridCol w:w="3000"/></w:tblGrid>
      <w:tr><w:tc><w:tcPr><w:vMerge w:val="restart"/></w:tcPr><w:p><w:r><w:t>atas</w:t></w:r></w:p></w:tc><w:tc><w:p><w:r><w:t>x</w:t></w:r></w:p></w:tc></w:tr>
      <w:tr><w:tc><w:tcPr><w:vMerge/></w:tcPr><w:p/></w:tc><w:tc><w:p><w:r><w:t>y</w:t></w:r></w:p></w:tc></w:tr>
    </w:tbl>
    <w:p><w:r><w:rPr><w:b w:val="0"/><w:highlight w:val="yellow"/></w:rPr><w:t>stabilo</w:t></w:r></w:p>
  </w:body></w:document>`
  const stylesXml = `<w:styles ${W}>
    <w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/></w:style>
    <w:style w:type="paragraph" w:styleId="Judulku"><w:name w:val="Judul Saya"/><w:basedOn w:val="Heading1"/></w:style>
    <w:style w:type="paragraph" w:styleId="Tengah"><w:name w:val="Tengah"/><w:pPr><w:jc w:val="center"/></w:pPr><w:rPr><w:color w:val="1F4E79"/></w:rPr></w:style>
  </w:styles>`
  const zip = zipSync({ 'word/document.xml': strToU8(docXml), 'word/styles.xml': strToU8(stylesXml) })
  const { html } = docxToHtml(zip, { parseXml })
  assert.match(html, /<h1>Judul Turunan<\/h1>/)
  assert.match(html, /<p style="text-align: center"><span style="color: #1f4e79">teks tengah<\/span><\/p>/)
  assert.match(html, /<p>Hal \{page\}<\/p>/)
  assert.match(html, /<td rowspan="2" colwidth="100"><p>atas<\/p><\/td><td colwidth="200"><p>x<\/p><\/td><\/tr><tr><td colwidth="200"><p>y<\/p><\/td>/)
  assert.match(html, /<p><span style="background-color: #ffff00">stabilo<\/span><\/p>/)
})

test('watermark: dari ekspor editor & dari watermark asli Word (VML) dikenali, tidak jadi gambar', async () => {
  const { page } = await roundtrip({ type: 'doc', content: [para({}, t('isi'))] }, {
    header: { type: 'doc', content: [para({}, t('KOP'))] },
    watermarkImage: { data: PNG_1x1, width: 10, height: 10, text: 'RAHASIA' },
  })
  assert.deepEqual(page.watermark, { text: 'RAHASIA' })
  assert.doesNotMatch(page.header, /<img/)
  assert.match(page.header, /KOP/)

  const W = 'xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:v="urn:schemas-microsoft-com:vml"'
  const zip = zipSync({
    'word/document.xml': strToU8(`<w:document ${W}><w:body><w:p><w:r><w:t>isi</w:t></w:r></w:p><w:sectPr><w:headerReference w:type="default" r:id="rH"/></w:sectPr></w:body></w:document>`),
    'word/_rels/document.xml.rels': strToU8('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rH" Type="header" Target="header1.xml"/></Relationships>'),
    'word/header1.xml': strToU8(`<w:hdr ${W}><w:p><w:r><w:pict><v:shape><v:textpath string="KONFIDENSIAL"/></v:shape></w:pict></w:r></w:p></w:hdr>`),
  })
  const word = docxToHtml(zip, { parseXml })
  assert.deepEqual(word.page.watermark, { text: 'KONFIDENSIAL' })
})

test('indentasi, spasi baris, RTL, superskrip/subskrip, pemisah halaman, checklist', async () => {
  const { html } = await roundtrip({ type: 'doc', content: [
    para({ indent: 2, lineHeight: '2' }, t('menjorok dua')),
    para({ dir: 'rtl' }, t('مرحبا')),
    para({}, t('H'), t('2', 'subscript'), t('O dan x'), t('2', 'superscript')),
    { type: 'pageBreak' },
    para({}, t('halaman baru')),
    { type: 'taskList', content: [
      { type: 'taskItem', attrs: { checked: true }, content: [para({}, t('sudah'))] },
      { type: 'taskItem', attrs: { checked: false }, content: [para({}, t('belum'))] },
    ] },
  ] })
  assert.match(html, /<p style="margin-left: 72pt; line-height: 2">menjorok dua<\/p>/)
  assert.match(html, /<p dir="rtl">مرحبا<\/p>/)
  assert.match(html, /H<sub>2<\/sub>O dan x<sup>2<\/sup>/)
  assert.match(html, /<div data-page-break><\/div><p>halaman baru<\/p>|<p><\/p><div data-page-break><\/div><p>halaman baru<\/p>/)
  assert.match(html, /☒ sudah/)
  assert.match(html, /☐ belum/)
})

test('catatan kaki, rumus, video, dan header dikecualikan di banyak halaman (section)', async () => {
  const { unzipSync, strFromU8 } = await import('fflate')
  globalThis.DOMParser ??= DOMParser // rumus: MathML -> OMML butuh DOMParser (browser punya sendiri)
  const json = { type: 'doc', content: [
    para({}, t('Teks'), { type: 'footnote', attrs: { text: 'Sumber: BPS 2025' } }),
    para({}, { type: 'math', attrs: { latex: '\\frac{a}{b}+\\sqrt{x}+\\sum_{i=1}^{n} x_i^2' } }),
    { type: 'video', attrs: { src: 'https://www.youtube-nocookie.com/embed/abcdefghijk' } },
    para({}, t('Halaman 2')),
    { type: 'pageBreak' },
    para({}, t('Halaman 3')),
    para({}, t('Halaman 4')),
  ] }
  const opts = { page: { header: '<p>Kop</p>', hideHeaderOn: '2-3' }, header: { type: 'doc', content: [para({}, t('Kop'))] }, pageStarts: [0, 3, 5, 6] }
  const buf = await Packer.toBuffer(await buildDocx(json, opts))
  const files = unzipSync(new Uint8Array(buf))
  const doc = strFromU8(files['word/document.xml'])
  assert.match(doc, /<m:oMath>.*<m:f>.*<m:rad>.*<m:nary>/s)
  assert.match(doc, /▶ Video: https:\/\/www\.youtube-nocookie\.com/)
  // halaman 1 | 2-3 tanpa header | 4: tiga section, pemisah halaman sebelum halaman 3 tetap (masih section yang sama)
  assert.equal(doc.match(/<w:sectPr/g).length, 3)
  const headers = Object.keys(files).filter((f) => /^word\/header\d+\.xml$/.test(f)).map((f) => strFromU8(files[f]))
  assert.equal(headers.filter((h) => h.includes('Kop')).length, 2)
  const { html } = docxToHtml(new Uint8Array(buf), { parseXml })
  assert.match(html, /<p>Teks<sup data-footnote="Sumber: BPS 2025"><\/sup><\/p>/)
})
