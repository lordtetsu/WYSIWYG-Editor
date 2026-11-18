import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizePage, normalizeWatermark, matchPaper, twipToMm, pageMatcher } from '../src/page.js'

test('default A4 margin 20mm', () => {
  assert.deepEqual(normalizePage(), { size: 'A4', orientation: 'portrait', width: 210, height: 297, margin: { top: 20, right: 20, bottom: 20, left: 20 }, header: '', footer: '', headerDistance: 12.7, footerDistance: 12.7, watermark: null, hideHeaderOn: '', hideFooterOn: '', firstPageNumber: 1 })
})

test('ukuran kustom, margin angka & per sisi', () => {
  assert.deepEqual(normalizePage({ size: { width: 100, height: 150 }, margin: 10 }).margin, { top: 10, right: 10, bottom: 10, left: 10 })
  const p = normalizePage({ size: 'F4', margin: { top: 30 } })
  assert.equal(p.height, 330)
  assert.deepEqual(p.margin, { top: 30, right: 20, bottom: 20, left: 20 })
  assert.equal(normalizePage({ size: { width: 100, height: 150 } }).size, 'custom')
})

test('nilai tidak masuk akal dibatasi', () => {
  const p = normalizePage({ size: { width: -5, height: 'abc' }, margin: { left: 500, right: 500 } })
  assert.equal(p.width, 50)
  assert.equal(p.height, 297)
  assert.ok(p.width - p.margin.left - p.margin.right >= 20, JSON.stringify(p))
  assert.ok(p.margin.right >= 0)
  assert.equal(normalizePage({ size: 'XYZ' }).size, 'A4')
})

test('hasil normalizePage bisa dinormalisasi ulang tanpa berubah', () => {
  for (const input of [{}, { size: 'Legal', margin: 15, header: '<p>H</p>', watermark: { text: 'DRAFT', opacity: 0.3 } }, { size: 'A5', orientation: 'landscape' }, { size: { width: 300, height: 100 } }, { size: { width: 120, height: 180 }, margin: { left: 5 } }]) {
    const once = normalizePage(input)
    assert.deepEqual(normalizePage(once), once)
  }
})

test('orientasi landscape menukar lebar & tinggi', () => {
  const a4 = normalizePage({ size: 'A4', orientation: 'landscape' })
  assert.deepEqual([a4.width, a4.height, a4.orientation], [297, 210, 'landscape'])
  const custom = normalizePage({ size: { width: 100, height: 150 }, orientation: 'landscape' })
  assert.deepEqual([custom.width, custom.height], [150, 100])
  assert.equal(normalizePage({ size: { width: 300, height: 100 } }).orientation, 'landscape')
  assert.equal(normalizePage({ size: 'A4', orientation: 'miring' }).orientation, 'portrait')
})

test('watermark: teks kosong = null, nilai dibatasi', () => {
  assert.equal(normalizeWatermark({ text: '   ' }), null)
  assert.equal(normalizeWatermark(undefined), null)
  assert.deepEqual(normalizeWatermark({ text: ' RAHASIA ', color: 'merah', opacity: 5, angle: -200 }), { text: 'RAHASIA', color: '#808080', opacity: 1, angle: -90, size: 0 })
})

test('jarak header/footer tidak melebihi margin; cocokkan nama kertas', () => {
  const p = normalizePage({ margin: 10, headerDistance: 30 })
  assert.equal(p.headerDistance, 10)
  assert.equal(matchPaper(297, 210), 'A4')
  assert.equal(matchPaper(215.9, 279.4), 'Letter')
  assert.equal(matchPaper(100, 100), null)
  assert.equal(twipToMm(11906), 210)
})

test('daftar halaman untuk pengecualian header/footer', () => {
  const m = pageMatcher('1, 3-4, 10-')
  assert.deepEqual([1, 2, 3, 4, 5, 9, 10, 99].map(m), [true, false, true, true, false, false, true, true])
  assert.equal(pageMatcher('')(1), false)
  assert.equal(normalizePage({ hideHeaderOn: '1, <script>2' }).hideHeaderOn, '1, 2')
  assert.equal(normalizePage({ firstPageNumber: '0' }).firstPageNumber, 0)
})
