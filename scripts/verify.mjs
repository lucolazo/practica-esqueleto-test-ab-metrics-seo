// Verificación de la lógica pura. Sin dependencias: Node >= 22.18 ejecuta TypeScript directo.
//   node scripts/verify.mjs
import assert from 'node:assert/strict'
const x = await import('../lib/experiment.ts')

const ID = x.HASH_EXAMPLE_ID
const first = x.assignVariant(ID)
console.log(`assignVariant('${ID}') = ${first.toUpperCase()}  (${x.HASH_NAME})`)

// 1. Asignación estable y balanceada
for (let i = 0; i < 1000; i++) assert.equal(x.assignVariant(ID), first)
let b = 0
for (let i = 0; i < 20000; i++) if (x.assignVariant(`visitor-${i}`) === 'b') b++
assert.ok(b > 9500 && b < 10500, `reparto 50/50 esperado, B = ${b}/20000`)

// 2. Caso de prueba fijo, salido de la fórmula
const { a, b: tb } = x.TEST_CASE
assert.equal(x.formatRate(x.conversionRate(a)), '7,50%')
assert.equal(x.formatRate(x.conversionRate(tb)), '13,14%')
assert.equal(x.formatPoints(x.rateGap(x.TEST_CASE)), '5,64 pp')

// 3. Sin impresiones no hay tasa (null, no 0)
assert.equal(x.conversionRate({ impressions: 0, conversions: 0 }), null)
assert.equal(x.formatRate(null), 'Sin impresiones')
assert.equal(x.rateGap(x.emptyLog()), null)

// 4. El log se valida antes de usarlo
const empty = x.emptyLog()
for (const bad of [undefined, '', '{', 'null', '[]', '{"a":1}', '{"a":{"impressions":-1,"conversions":0},"b":{"impressions":1,"conversions":0}}', '{"a":{"impressions":1.5,"conversions":0},"b":{"impressions":1,"conversions":0}}', '{"a":{"impressions":"9","conversions":0},"b":{"impressions":1,"conversions":0}}']) {
  assert.deepEqual(x.parseLog(bad), empty, `debería rechazar ${bad}`)
}
const ok = { a: { impressions: 5, conversions: 1 }, b: { impressions: 4, conversions: 2 } }
assert.deepEqual(x.parseLog(x.serializeLog(ok)), ok)

// 5. Metadatos: longitudes en rango
for (const v of Object.values(x.VARIANTS)) {
  assert.ok(x.inRange(x.characterCount(v.seoTitle), x.TITLE_RANGE), `title ${v.id}`)
  assert.ok(x.inRange(x.characterCount(v.seoDescription), x.DESCRIPTION_RANGE), `description ${v.id}`)
}

// 6. Visitante y crawlers
assert.ok(x.isVisitorId('0b8f6f0e-9d3c-4f55-b0d4-0a3b6f8f2c11'))
for (const bad of ['', 'a b', "x'; drop", 'corto', null, undefined]) assert.ok(!x.isVisitorId(bad))
assert.ok(x.isCrawler('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'))
assert.ok(x.isCrawler('Mozilla/5.0 (compatible; bingbot/2.0)'))
assert.ok(!x.isCrawler('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0 Safari/537.36'))
assert.ok(!x.isCrawler('curl/8.5.0'))

console.log('OK: todas las verificaciones de lib/experiment.ts pasaron')
