import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs'
import { parseRulesCSV, parseCartCSV } from '../src/engine/csvParser.js'
import { evaluateCart } from '../src/engine/discountEngine.js'
import { validateParsedRule } from '../src/engine/nlRuleParser.js'
import { parseCartFromPdfItems } from '../src/engine/pdfTableParser.js'

const sampleRulesCsv = fs.readFileSync(new URL('../sample-data/rules.csv', import.meta.url), 'utf8')
const sampleCartCsv = fs.readFileSync(new URL('../sample-data/cart.csv', import.meta.url), 'utf8')

test('sample CSVs match expected item prices, subtotal, cart offer, and final total', () => {
  const { data: rules, errors: ruleErrors } = parseRulesCSV(sampleRulesCsv)
  const { data: cart, errors: cartErrors } = parseCartCSV(sampleCartCsv)

  assert.deepEqual(ruleErrors, [])
  assert.deepEqual(cartErrors, [])

  const res = evaluateCart(cart, rules)
  assert.deepEqual(res.itemResults.map((r) => r.finalPrice), [1104, 629, 509, 2499, 382, 809])
  assert.equal(res.itemResults[3].reasoning, 'No offers available')
  assert.equal(res.subtotal, 5932)
  assert.equal(res.cartOffer?.ruleId, 'RULE-04')
  assert.equal(res.cartOffer?.discountAmount, 593)
  assert.equal(res.finalTotal, 5339)
})

test('cart offer threshold is inclusive and hidden below threshold', () => {
  const rules = [
    { ruleId: 'RULE-04', scope: 'cart', appliesTo: 'Entire cart', type: 'percentage', value: 10, stackable: false, minCartValue: 4000 },
    { ruleId: 'RULE-05', scope: 'cart', appliesTo: 'Entire cart', type: 'percentage', value: 15, stackable: false, minCartValue: 5000 },
  ]

  const below = evaluateCart([{ itemId: 'I1', product: 'A', brand: 'B', platform: 'P', basePrice: 3999 }], rules)
  assert.equal(below.cartOffer, null)
  assert.equal(below.finalTotal, 3999)

  const exact = evaluateCart([{ itemId: 'I2', product: 'A', brand: 'B', platform: 'P', basePrice: 4000 }], rules)
  assert.equal(exact.cartOffer?.ruleId, 'RULE-04')
  assert.equal(exact.cartOffer?.discountAmount, 400)
  assert.equal(exact.finalTotal, 3600)

  const bestOfTwo = evaluateCart([{ itemId: 'I3', product: 'A', brand: 'B', platform: 'P', basePrice: 5000 }], rules)
  assert.equal(bestOfTwo.cartOffer?.ruleId, 'RULE-05')
  assert.equal(bestOfTwo.cartOffer?.discountAmount, 750)
  assert.equal(bestOfTwo.finalTotal, 4250)
})

test('nlRuleParser validates structured output, rejects ambiguous/invalid rules, and warns on unmatched target', () => {
  const existing = parseRulesCSV(sampleRulesCsv).data
  const cart = parseCartCSV(sampleCartCsv).data

  const valid = validateParsedRule(
    {
      resolvable: true,
      reason: '',
      rule: { scope: 'brand', appliesTo: 'Natura Casa', type: 'percentage', value: 20, stackable: true, minCartValue: null },
    },
    existing,
    cart
  )
  assert.equal(valid.ok, true)
  assert.equal(valid.rule.ruleId, 'RULE-05')
  assert.equal(valid.warning, null)

  const unmatched = validateParsedRule(
    {
      resolvable: true,
      reason: '',
      rule: { scope: 'brand', appliesTo: 'Unknown Brand', type: 'flat', value: 100, stackable: false, minCartValue: null },
    },
    existing,
    cart
  )
  assert.equal(unmatched.ok, true)
  assert.match(unmatched.warning, /Unknown Brand/)

  const ambiguous = validateParsedRule(
    { resolvable: false, reason: 'Missing discount value and minimum cart threshold.', rule: null },
    existing,
    cart
  )
  assert.equal(ambiguous.ok, false)
  assert.match(ambiguous.error, /Missing discount value/)

  const badPct = validateParsedRule(
    {
      resolvable: true,
      reason: '',
      rule: { scope: 'platform', appliesTo: 'Flipkart', type: 'percentage', value: 150, stackable: false, minCartValue: null },
    },
    existing,
    cart
  )
  assert.equal(badPct.ok, false)
})

test('pdfTableParser extracts multi-word columns and rejects scanned or malformed PDFs all-or-nothing', () => {
  const items = [
    { page: 1, x: 50, y: 740, width: 140, str: 'Order #OP-9921 | Date: 15 Jan 2025' },
    { page: 1, x: 50, y: 700, width: 45, str: 'Product' },
    { page: 1, x: 180, y: 700, width: 35, str: 'Brand' },
    { page: 1, x: 290, y: 700, width: 50, str: 'Platform' },
    { page: 1, x: 400, y: 700, width: 60, str: 'Base Price' },
    { page: 1, x: 50, y: 680, width: 120, str: '────────────────────' },
    { page: 1, x: 50, y: 660, width: 45, str: 'Cushion' },
    { page: 1, x: 100, y: 660, width: 35, str: 'Cover' },
    { page: 1, x: 180, y: 660, width: 70, str: 'Natura Casa' },
    { page: 1, x: 290, y: 660, width: 80, str: 'Amazon India' },
    { page: 1, x: 400, y: 660, width: 50, str: 'Rs.1,299' },
    { page: 1, x: 50, y: 640, width: 80, str: 'Bed Sheet Set' },
    { page: 1, x: 180, y: 640, width: 70, str: 'Natura Casa' },
    { page: 1, x: 290, y: 640, width: 45, str: 'Flipkart' },
    { page: 1, x: 400, y: 640, width: 40, str: 'Rs.849' },
  ]

  const ok = parseCartFromPdfItems([
    ...items,
    { page: 1, x: 50, y: 600, width: 55, str: 'Page 1 of 1' },
  ])
  assert.deepEqual(ok.errors, [])
  assert.equal(ok.data.length, 2)
  assert.deepEqual(ok.data[0], {
    itemId: 'ITEM-01',
    product: 'Cushion Cover',
    brand: 'Natura Casa',
    platform: 'Amazon India',
    basePrice: 1299,
  })

  const scanned = parseCartFromPdfItems([])
  assert.deepEqual(scanned.data, [])
  assert.match(scanned.errors[0], /scanned/i)

  const badPrice = parseCartFromPdfItems([
    ...items,
    { page: 1, x: 50, y: 620, width: 70, str: 'Broken Item' },
    { page: 1, x: 180, y: 620, width: 70, str: 'Natura Casa' },
    { page: 1, x: 290, y: 620, width: 45, str: 'Flipkart' },
    { page: 1, x: 400, y: 620, width: 30, str: 'N/A' },
  ])
  assert.deepEqual(badPrice.data, [])
  assert.equal(badPrice.errors.length, 1)
  assert.match(badPrice.errors[0], /invalid base price/i)
})

test('sample-data/cart.pdf parses end-to-end with pdfjs-dist and evaluates to Rs.5,339', async () => {
  const bytes = new Uint8Array(fs.readFileSync(new URL('../sample-data/cart.pdf', import.meta.url)))
  const pdf = await pdfjsLib.getDocument({ data: bytes, verbosity: 0 }).promise
  const items = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const content = await page.getTextContent()
    for (const it of content.items) {
      if (typeof it.str === 'string') {
        items.push({ str: it.str, x: it.transform[4], y: it.transform[5], width: it.width || 0, page: p })
      }
    }
  }

  const parsed = parseCartFromPdfItems(items)
  assert.deepEqual(parsed.errors, [])
  assert.equal(parsed.data.length, 6)

  const rules = parseRulesCSV(sampleRulesCsv).data
  const res = evaluateCart(parsed.data, rules)
  assert.equal(res.subtotal, 5932)
  assert.equal(res.cartOffer?.discountAmount, 593)
  assert.equal(res.finalTotal, 5339)
})

