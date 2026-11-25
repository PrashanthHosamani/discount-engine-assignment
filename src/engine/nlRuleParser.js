const VALID_SCOPES = new Set(['brand', 'platform', 'cart'])
const VALID_TYPES = new Set(['percentage', 'flat'])

export function nextRuleId(existingRules = []) {
  let maxNum = 0
  for (const r of existingRules) {
    const m = /^RULE-(\d+)$/i.exec(r.ruleId || '')
    if (m) maxNum = Math.max(maxNum, Number(m[1]))
  }
  return `RULE-${String(maxNum + 1).padStart(2, '0')}`
}

export function validateParsedRule(payload, existingRules = [], cartItems = []) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Invalid response from rule parser.' }
  }

  if (payload.resolvable !== true || !payload.rule) {
    const base =
      payload.reason ||
      'Could not resolve this rule.'
    const suffix = /specific/i.test(base)
      ? ''
      : ' Please be more specific (include scope, discount value, and any threshold).'
    return { ok: false, error: `${base}${suffix}` }
  }

  const raw = payload.rule
  const scope = String(raw.scope || '').trim().toLowerCase()
  const type = String(raw.type || '').trim().toLowerCase()
  const value = Number(raw.value)
  const stackable = Boolean(raw.stackable)
  const appliesTo = String(raw.appliesTo || '').trim()
  const minCartValue = raw.minCartValue == null ? null : Number(raw.minCartValue)

  if (!VALID_SCOPES.has(scope)) {
    return { ok: false, error: `Invalid rule scope "${raw.scope}".` }
  }
  if (!VALID_TYPES.has(type)) {
    return { ok: false, error: `Invalid discount type "${raw.type}".` }
  }
  if (!Number.isFinite(value) || value <= 0) {
    return { ok: false, error: 'Discount value must be a positive number.' }
  }
  if (type === 'percentage' && value > 100) {
    return { ok: false, error: 'Percentage discount cannot exceed 100%.' }
  }
  if (scope !== 'cart' && !appliesTo) {
    return { ok: false, error: `Missing ${scope} name for this rule.` }
  }
  if (scope === 'cart' && (!Number.isFinite(minCartValue) || minCartValue <= 0)) {
    return { ok: false, error: 'Cart-level rules require a positive minimum cart value.' }
  }

  const rule = {
    ruleId: nextRuleId(existingRules),
    scope,
    appliesTo: scope === 'cart' ? 'Entire cart' : appliesTo,
    type,
    value,
    stackable: scope === 'cart' ? false : stackable,
    minCartValue: scope === 'cart' ? Math.round(minCartValue) : null,
  }

  let warning = null
  if (cartItems.length > 0 && scope !== 'cart') {
    const target = appliesTo.toLowerCase()
    const hasMatch = cartItems.some((item) =>
      String(scope === 'brand' ? item.brand : item.platform).trim().toLowerCase() === target
    )
    if (!hasMatch) {
      warning = `Heads up: no items in the current cart match ${scope} "${appliesTo}".`
    }
  }

  return { ok: true, rule, warning }
}

export async function parseNaturalLanguageRule(text, existingRules = [], cartItems = []) {
  const trimmed = String(text || '').trim()
  if (!trimmed) {
    return { ok: false, error: 'Please enter a rule in plain English.' }
  }
  if (trimmed.length > 300) {
    return { ok: false, error: 'Rule text must be 300 characters or fewer.' }
  }

  let res
  try {
    res = await fetch('/api/parse-rule', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed }),
    })
  } catch (err) {
    return { ok: false, error: `Network error calling parser: ${err.message}` }
  }

  const body = await res.json().catch(() => null)
  if (!res.ok) {
    return { ok: false, error: body?.error || `Parser request failed (${res.status}).` }
  }

  return validateParsedRule(body, existingRules, cartItems)
}

