import { useState } from 'react'
import { parseNaturalLanguageRule } from '../engine/nlRuleParser.js'

const EXAMPLES = [
  '20% off for Natura Casa brand, stackable with other offers',
  'Rs.100 flat discount on all Flipkart items',
  '10% off if cart value is more than Rs.5,000',
]

export default function RuleInput({ existingRules, cartItems, onConfirmRule }) {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [draft, setDraft] = useState(null)

  async function handleParse(e) {
    e.preventDefault()
    setError('')
    setDraft(null)
    setLoading(true)

    const result = await parseNaturalLanguageRule(text, existingRules, cartItems)
    setLoading(false)

    if (!result.ok) {
      setError(result.error)
      return
    }
    setDraft(result)
  }

  function handleConfirm() {
    if (!draft) return
    onConfirmRule(draft.rule)
    setDraft(null)
    setText('')
    setError('')
  }

  function handleDiscard() {
    setDraft(null)
    setError('')
  }

  const rule = draft?.rule

  return (
    <div style={{ marginTop: '0.9rem', paddingTop: '0.85rem', borderTop: '1px solid #ececec' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#131A48', marginBottom: 6 }}>
        Add Rule in Plain English
      </div>

      <form onSubmit={handleParse} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="text"
          value={text}
          maxLength={300}
          placeholder='e.g. "20% off for Natura Casa brand, stackable with other offers"'
          onChange={(e) => setText(e.target.value)}
          disabled={loading}
          style={{
            flex: 1,
            padding: '0.5rem 0.7rem',
            fontSize: 12,
            border: '1px solid #CECECE',
            borderRadius: 4,
            color: '#131A48',
          }}
        />
        <button
          type="submit"
          disabled={loading || !text.trim()}
          style={{
            background: loading || !text.trim() ? '#CECECE' : '#131A48',
            color: '#fff',
            border: 'none',
            borderRadius: 4,
            padding: '0.5rem 0.9rem',
            fontSize: 12,
            fontWeight: 700,
            cursor: loading || !text.trim() ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {loading ? 'Parsing…' : 'Parse Rule'}
        </button>
      </form>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem', marginTop: 6 }}>
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            disabled={loading}
            onClick={() => {
              setText(ex)
              setError('')
              setDraft(null)
            }}
            style={{
              background: '#f5f6fa',
              border: '1px solid #e0e3eb',
              borderRadius: 12,
              padding: '2px 8px',
              fontSize: 10,
              color: '#4a5568',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {ex}
          </button>
        ))}
      </div>

      {error && (
        <div
          style={{
            marginTop: '0.5rem',
            padding: '0.55rem 0.8rem',
            background: '#fce8e8',
            border: '1px solid #e57373',
            borderLeft: '3px solid #c0392b',
            borderRadius: 4,
            fontSize: 12,
            color: '#5a1010',
          }}
        >
          {error}
        </div>
      )}

      {rule && (
        <div
          style={{
            marginTop: '0.6rem',
            padding: '0.75rem 0.9rem',
            background: '#f8f9fc',
            border: '1px solid #c5cde0',
            borderRadius: 4,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 700, color: '#131A48', marginBottom: 6 }}>
            Confirm Parsed Rule ({rule.ruleId})
          </div>
          <div style={{ fontSize: 12, color: '#131A48', lineHeight: 1.6 }}>
            <span>Scope: <strong>{rule.scope}</strong></span>
            {' · '}
            <span>Applies to: <strong>{rule.appliesTo}</strong></span>
            {' · '}
            <span>Type: <strong>{rule.type}</strong></span>
            {' · '}
            <span>
              Value: <strong>{rule.type === 'percentage' ? `${rule.value}%` : `Rs.${rule.value}`}</strong>
            </span>
            {rule.scope === 'cart' ? (
              <>
                {' · '}
                <span>Min cart value: <strong>Rs.{rule.minCartValue.toLocaleString('en-IN')}</strong></span>
              </>
            ) : (
              <>
                {' · '}
                <span>Stackable: <strong>{rule.stackable ? 'Yes' : 'No'}</strong></span>
              </>
            )}
          </div>

          {draft.warning && (
            <div style={{ fontSize: 11, color: '#92400e', background: '#fef3c7', padding: '4px 8px', borderRadius: 4, marginTop: 6 }}>
              {draft.warning}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem' }}>
            <button
              type="button"
              onClick={handleConfirm}
              style={{
                background: '#1e5c2c',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '0.4rem 0.85rem',
                fontSize: 12,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Confirm & Add Rule
            </button>
            <button
              type="button"
              onClick={handleDiscard}
              style={{
                background: '#fff',
                color: '#131A48',
                border: '1px solid #CECECE',
                borderRadius: 4,
                padding: '0.4rem 0.85rem',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              Discard
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

