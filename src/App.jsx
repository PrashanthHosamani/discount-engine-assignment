/**
 * App.jsx
 *
 * Top-level component. Manages state for rules, cart items, and results.
 * Wires together CSV upload → parse → engine → display.
 */

import { useState } from 'react'
import CsvUploader from './components/CsvUploader.jsx'
import CartPdfUploader from './components/CartPdfUploader.jsx'
import RuleInput from './components/RuleInput.jsx'
import DataTable from './components/DataTable.jsx'
import ErrorBanner from './components/ErrorBanner.jsx'
import { parseRulesCSV, parseCartCSV } from './engine/csvParser.js'
import { parseCartPDF } from './engine/pdfReader.js'
import { evaluateCart, ruleMatchesItem } from './engine/discountEngine.js'

// ── Column definitions ───────────────────────────────────────────

const REMOVE_BTN_STYLE = {
  background: '#fce8e8',
  border: '1px solid #f5b7b1',
  borderRadius: 4,
  color: '#c0392b',
  fontSize: 10,
  fontWeight: 700,
  lineHeight: 1.2,
  cursor: 'pointer',
  padding: '3px 6px',
  whiteSpace: 'nowrap',
}

const RULES_COLUMNS = [
  { key: 'ruleId',    label: 'Rule ID' },
  { key: 'scope',     label: 'Scope',      render: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
  { key: 'appliesTo', label: 'Applies To', render: (v, row) => v || (row.scope === 'cart' ? 'Entire cart' : '—') },
  { key: 'type',      label: 'Type',       render: (v) => v.charAt(0).toUpperCase() + v.slice(1) },
  {
    key: 'value',
    label: 'Value',
    render: (v, row) => (
      <span style={{ whiteSpace: 'nowrap' }}>
        {row.type === 'percentage' ? `${v}% off` : `Rs.${v} off`}
      </span>
    ),
  },
  {
    key: 'minCartValue',
    label: 'Condition',
    render: (v, row) => row.scope === 'cart' && v != null ? `Cart ≥ Rs.${v.toLocaleString('en-IN')}` : '—',
  },
  { key: 'stackable', label: 'Stackable',  render: (v) => (v ? 'Yes' : 'No') },
]

function formatMatchingRules(item, rules) {
  if (rules.length === 0) return '—'
  const matches = rules.filter((r) => ruleMatchesItem(item, r))
  if (matches.length === 0) return 'No rules match'
  if (matches.length === 1) return `${matches[0].ruleId} only`
  const ids = matches.map((r) => r.ruleId).join(' + ')
  return matches.some((r) => r.stackable) ? `${ids} — stackable` : `${ids} — pick max`
}

function getCartColumns(rules) {
  return [
    { key: 'itemId',    label: 'Item' },
    { key: 'product',   label: 'Product' },
    { key: 'brand',     label: 'Brand' },
    { key: 'platform',  label: 'Platform' },
    {
      key: 'basePrice',
      label: 'Base Price',
      render: (v) => <span style={{ whiteSpace: 'nowrap' }}>Rs.{v.toLocaleString('en-IN')}</span>,
    },
    {
      key: '_matchingRules',
      label: 'Rules That Match',
      render: (_, row) => {
        const text = formatMatchingRules(row, rules)
        return (
          <span style={{ color: text === 'No rules match' || text === '—' ? '#888' : '#131A48' }}>
            {text}
          </span>
        )
      },
    },
  ]
}

function getItemStatus(row) {
  if (row.appliedRules.length === 0) return { label: 'No offer', color: '#666', bg: '#eee' }
  if (row.appliedRules.length > 1) return { label: 'Stacked', color: '#1e40af', bg: '#dbeafe' }
  if (row.skippedRules.length > 0) return { label: 'Max discount', color: '#1e5c2c', bg: '#dcfce7' }
  return { label: 'Discount applied', color: '#1e5c2c', bg: '#dcfce7' }
}

function getResultsColumns(onRemoveRules) {
  return [
    { key: 'itemId',    label: 'Item' },
    { key: 'product',   label: 'Product' },
    { key: 'basePrice', label: 'Base Price',  render: (v) => `Rs.${v.toLocaleString('en-IN')}` },
    { key: 'finalPrice',label: 'Final Price',
      render: (v, row) => (
        <span style={{ fontWeight: 700, color: row.totalDiscount > 0 ? '#1e5c2c' : '#131A48' }}>
          Rs.{v.toLocaleString('en-IN')}
        </span>
      ),
    },
    {
      key: 'totalDiscount',
      label: 'You Save',
      render: (v) =>
        v > 0 ? (
          <span style={{ color: '#1e5c2c', fontWeight: 600 }}>Rs.{v.toLocaleString('en-IN')}</span>
        ) : (
          <span style={{ color: '#888' }}>—</span>
        ),
    },
    {
      key: 'reasoning',
      label: 'Offer Applied',
      render: (v, row) => (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.6rem' }}>
          <span style={{ color: v === 'No offers available' ? '#888' : '#131A48', fontStyle: v === 'No offers available' ? 'italic' : 'normal' }}>
            {v}
          </span>
          {row.appliedRules.length > 0 && (
            <button
              type="button"
              title={`Remove ${row.appliedRules.join(', ')}`}
              aria-label={`Remove offer for ${row.itemId}`}
              onClick={() => onRemoveRules(row.appliedRules)}
              style={REMOVE_BTN_STYLE}
            >
              Remove
            </button>
          )}
        </div>
      ),
    },
    {
      key: '_status',
      label: 'Status',
      render: (_, row) => {
        const st = getItemStatus(row)
        return <span style={{ ...S.tag(st.color, st.bg), whiteSpace: 'nowrap' }}>{st.label}</span>
      },
    },
  ]
}

// ── Styles ───────────────────────────────────────────────────────

const S = {
  page:    { minHeight: '100vh', background: '#f7f7f9', fontFamily: 'Arial, sans-serif' },
  header:  { background: '#131A48', padding: '0.85rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  logoTxt: { fontFamily: 'Georgia, serif', fontSize: 17, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em' },
  logoSpan:{ color: '#FF5800' },
  headerSub: { fontSize: 11, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' },
  main:    { maxWidth: 1160, margin: '0 auto', padding: '1.8rem 1.5rem' },
  section: { background: '#fff', border: '1px solid #CECECE', borderRadius: 6, padding: '1.2rem 1.4rem', marginBottom: '1.2rem', minWidth: 0 },
  sectionTitle: { fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: 14, color: '#131A48', marginBottom: '0.7rem', paddingBottom: 6, borderBottom: '2px solid #FF5800', display: 'inline-block' },
  grid2:   { display: 'grid', gridTemplateColumns: '1fr 1.12fr', gap: '1rem' },
  btn:     {
    background: '#FF5800', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.65rem 2rem', fontSize: 13, fontWeight: 700, cursor: 'pointer',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  btnDisabled: {
    background: '#CECECE', color: '#fff', border: 'none', borderRadius: 4,
    padding: '0.65rem 2rem', fontSize: 13, fontWeight: 700, cursor: 'not-allowed',
    letterSpacing: '0.04em', textTransform: 'uppercase',
  },
  totalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: '1rem', marginTop: '0.75rem', paddingTop: '0.75rem',
    borderTop: '2px solid #131A48',
  },
  subtotalRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: '1rem', marginTop: '0.75rem', paddingTop: '0.75rem',
    borderTop: '1px solid #e5e7eb', fontSize: 13, color: '#131A48',
  },
  cartOfferRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    gap: '1rem', marginTop: '0.5rem', padding: '0.65rem 0.85rem',
    background: '#f0faf2', border: '1px solid #b7dfc0', borderRadius: 4,
  },
  totalLabel: { fontWeight: 700, fontSize: 14, color: '#131A48' },
  totalValue: { fontWeight: 700, fontSize: 16, color: '#131A48' },
  tag: (color, bg) => ({
    display: 'inline-block', fontSize: 10, fontWeight: 700, padding: '1px 6px',
    borderRadius: 20, background: bg, color, textTransform: 'uppercase', letterSpacing: '0.04em',
  }),
}

// ── Component ────────────────────────────────────────────────────

export default function App() {
  const [rules, setRules]           = useState([])
  const [rulesErrors, setRulesErr]  = useState([])
  const [rulesFileName, setRulesFileName] = useState('')

  const [cartItems, setCartItems]   = useState([])
  const [cartErrors, setCartErrors] = useState([])
  const [cartFileName, setCartFileName] = useState('')
  const [cartPdfFileName, setCartPdfFileName] = useState('')
  const [pdfLoading, setPdfLoading] = useState(false)

  const [results, setResults]       = useState(null)

  // ── Handlers ──

  function handleRulesLoad(csvText, fileName) {
    const { data, errors } = parseRulesCSV(csvText)
    setRules(data)
    setRulesErr(errors)
    setRulesFileName(fileName)
    setResults(null) // clear stale results
  }

  function handleConfirmNlRule(newRule) {
    const updatedRules = [...rules, newRule]
    setRules(updatedRules)
    setRulesErr([])
    if (results && cartItems.length > 0) {
      setResults(evaluateCart(cartItems, updatedRules))
    }
  }

  function handleRemoveRule(ruleIds) {
    const ids = new Set(Array.isArray(ruleIds) ? ruleIds : [ruleIds])
    const updatedRules = rules.filter((r) => !ids.has(r.ruleId))
    setRules(updatedRules)
    if (updatedRules.length === 0) {
      setResults(null)
    } else if (results && cartItems.length > 0) {
      setResults(evaluateCart(cartItems, updatedRules))
    }
  }

  function handleCartLoad(csvText, fileName) {
    const { data, errors } = parseCartCSV(csvText)
    setCartItems(data)
    setCartErrors(errors)
    setCartFileName(fileName)
    setCartPdfFileName('')
    setResults(null)
  }

  async function handleCartPdfSelect(file) {
    setPdfLoading(true)
    const { data, errors } = await parseCartPDF(file)
    setPdfLoading(false)

    if (errors.length > 0) {
      // Keep the existing cart and results intact when PDF validation fails
      setCartErrors(errors)
      return
    }

    setCartItems(data)
    setCartErrors([])
    setCartFileName('')
    setCartPdfFileName(file.name)
    if (results && rules.length > 0) {
      setResults(evaluateCart(data, rules))
    }
  }

  function handleCalculate() {
    setResults(evaluateCart(cartItems, rules))
  }

  const canCalculate = rules.length > 0 && cartItems.length > 0

  // ── Render ──

  return (
    <div style={S.page}>
      {/* Header */}
      <div style={S.header}>
        <div style={S.logoTxt}>O<span style={S.logoSpan}>pp</span>tra</div>
        <div style={S.headerSub}>Discount Engine</div>
      </div>

      <div style={S.main}>

        {/* Upload row */}
        <div style={S.grid2}>
          {/* Rules upload */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Discount Rules</div>
            <CsvUploader
              label="rules.csv"
              description="Upload your discount rules CSV"
              onLoad={handleRulesLoad}
              hasData={rules.length > 0}
              fileName={rulesFileName}
            />
            <ErrorBanner errors={rulesErrors} />
            <RuleInput
              existingRules={rules}
              cartItems={cartItems}
              onConfirmRule={handleConfirmNlRule}
            />
            {rules.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {rules.length} rule{rules.length > 1 ? 's' : ''} loaded
                </div>
                <DataTable columns={RULES_COLUMNS} rows={rules} />
              </div>
            )}
          </div>

          {/* Cart upload */}
          <div style={S.section}>
            <div style={S.sectionTitle}>Cart Items</div>
            <CsvUploader
              label="cart.csv"
              description="Upload your cart CSV"
              onLoad={handleCartLoad}
              hasData={cartItems.length > 0 && Boolean(cartFileName)}
              fileName={cartFileName}
            />
            <CartPdfUploader
              onFileSelect={handleCartPdfSelect}
              loading={pdfLoading}
              fileName={cartPdfFileName}
            />
            <ErrorBanner errors={cartErrors} />
            {cartItems.length > 0 && (
              <div style={{ marginTop: '0.75rem' }}>
                <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>
                  {cartItems.length} item{cartItems.length > 1 ? 's' : ''} loaded
                </div>
                <DataTable columns={getCartColumns(rules)} rows={cartItems} compact />
              </div>
            )}
          </div>
        </div>

        {/* Calculate button */}
        <div style={{ textAlign: 'center', marginBottom: '1.2rem' }}>
          <button
            style={canCalculate ? S.btn : S.btnDisabled}
            onClick={handleCalculate}
            disabled={!canCalculate}
          >
            Calculate Discounts
          </button>
          {!canCalculate && (
            <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
              Add at least one rule and one cart item to calculate
            </div>
          )}
        </div>

        {/* Results */}
        {results && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Cart Summary</div>
            <DataTable columns={getResultsColumns(handleRemoveRule)} rows={results.itemResults} />

            {results.cartOffer ? (
              <>
                <div style={S.subtotalRow}>
                  <span style={{ fontWeight: 600 }}>Cart Total before offer</span>
                  <span style={{ fontWeight: 700 }}>Rs.{results.subtotal.toLocaleString('en-IN')}</span>
                </div>
                <div style={S.cartOfferRow}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#1e5c2c' }}>
                      {results.cartOffer.label}
                    </div>
                    <div style={{ fontSize: 11, color: '#3b6e47', marginTop: 2 }}>
                      {results.cartOffer.ruleId} · {results.cartOffer.reasoning}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <span style={{ ...S.tag('#1e5c2c', '#dcfce7'), whiteSpace: 'nowrap' }}>Cart offer</span>
                    <div style={{ fontWeight: 700, fontSize: 14, color: '#1e5c2c', whiteSpace: 'nowrap' }}>
                      −Rs.{results.cartOffer.discountAmount.toLocaleString('en-IN')}
                    </div>
                    <button
                      type="button"
                      title={`Remove ${results.cartOffer.ruleId}`}
                      aria-label={`Remove cart offer ${results.cartOffer.ruleId}`}
                      onClick={() => handleRemoveRule(results.cartOffer.ruleId)}
                      style={REMOVE_BTN_STYLE}
                    >
                      Remove
                    </button>
                  </div>
                </div>
                <div style={S.totalRow}>
                  <span style={S.totalLabel}>Final Cart Total</span>
                  <span style={S.totalValue}>Rs.{results.finalTotal.toLocaleString('en-IN')}</span>
                </div>
              </>
            ) : (
              <div style={S.totalRow}>
                <span style={S.totalLabel}>Cart Total</span>
                <span style={S.totalValue}>Rs.{results.finalTotal.toLocaleString('en-IN')}</span>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}
