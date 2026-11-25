const HEADER_PATTERNS = {
  itemId: /^(item[\s_]*id|item)$/i,
  product: /^product$/i,
  brand: /^brand$/i,
  platform: /^platform$/i,
  basePrice: /^(base[\s_]*price|price)(\s*\(.*\))?$/i,
}

const REQUIRED_KEYS = ['product', 'brand', 'platform', 'basePrice']

function groupIntoLines(items) {
  const sorted = [...items]
    .filter((it) => it.str && it.str.trim())
    .sort((a, b) => (a.page - b.page) || (b.y - a.y) || (a.x - b.x))

  const lines = []
  for (const item of sorted) {
    const last = lines[lines.length - 1]
    if (last && last.page === item.page && Math.abs(last.y - item.y) <= 3) {
      last.items.push(item)
    } else {
      lines.push({ page: item.page, y: item.y, items: [item] })
    }
  }
  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x)
  }
  return lines
}

function mergeCloseSpans(lineItems, maxGap = 10) {
  const cells = []
  for (const item of lineItems) {
    const text = item.str.trim()
    if (!text) continue
    const prev = cells[cells.length - 1]
    const prevEnd = prev ? prev.x + (prev.width || 0) : -Infinity
    if (prev && item.x - prevEnd <= maxGap) {
      prev.text = `${prev.text} ${text}`
      prev.width = Math.max(prev.width || 0, item.x - prev.x + (item.width || text.length * 4))
    } else {
      cells.push({
        text,
        x: item.x,
        width: item.width || text.length * 4,
      })
    }
  }
  return cells
}

function findHeader(lines) {
  for (let i = 0; i < lines.length; i++) {
    const cells = mergeCloseSpans(lines[i].items)
    const found = {}
    for (const cell of cells) {
      for (const [key, pattern] of Object.entries(HEADER_PATTERNS)) {
        if (!found[key] && pattern.test(cell.text.trim())) {
          found[key] = cell.x
        }
      }
    }
    if (REQUIRED_KEYS.every((k) => found[k] !== undefined)) {
      const columns = Object.entries(found)
        .map(([key, x]) => ({ key, x }))
        .sort((a, b) => a.x - b.x)
      return { headerIndex: i, columns }
    }
  }
  return null
}

function assignColumn(x, columns) {
  const jitter = 12
  for (let i = 0; i < columns.length - 1; i++) {
    if (x < columns[i + 1].x - jitter) {
      return columns[i].key
    }
  }
  return columns[columns.length - 1].key
}

function parsePrice(raw) {
  const cleaned = String(raw || '').replace(/^(rs\.?|inr|₹)\s*/i, '').replace(/,/g, '').trim()
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null
  const num = Number(cleaned)
  return Number.isFinite(num) && num > 0 ? Math.round(num) : null
}

export function parseCartFromPdfItems(items) {
  if (!items || items.every((it) => !it.str || !it.str.trim())) {
    return {
      data: [],
      errors: ['No selectable text found in PDF (it may be a scanned image). Please upload a text-based cart PDF.'],
    }
  }

  const lines = groupIntoLines(items)
  const header = findHeader(lines)
  if (!header) {
    return {
      data: [],
      errors: ['Could not find a table header with columns: Product, Brand, Platform, Base Price.'],
    }
  }

  const data = []
  const errors = []

  for (let i = header.headerIndex + 1; i < lines.length; i++) {
    const lineText = lines[i].items.map((it) => it.str.trim()).join(' ').trim()
    if (!lineText || /^[-─_=|•.\s]+$/.test(lineText)) continue
    if (data.length > 0 && /^(page\s+\d+(\s+of\s+\d+)?|confidential\b|thank you\b)/i.test(lineText)) {
      continue
    }

    const row = { itemId: '', product: '', brand: '', platform: '', basePrice: '' }
    for (const span of lines[i].items) {
      const col = assignColumn(span.x, header.columns)
      row[col] = row[col] ? `${row[col]} ${span.str.trim()}` : span.str.trim()
    }

    const rowLabel = `Row ${data.length + errors.length + 1}`
    const missing = REQUIRED_KEYS.filter((k) => !row[k])
    if (missing.length > 0) {
      errors.push(`${rowLabel}: missing ${missing.join(', ')}`)
      continue
    }

    const price = parsePrice(row.basePrice)
    if (price === null) {
      errors.push(`${rowLabel} (${row.product}): invalid base price "${row.basePrice}"`)
      continue
    }

    data.push({
      itemId: row.itemId || `ITEM-${String(data.length + 1).padStart(2, '0')}`,
      product: row.product,
      brand: row.brand,
      platform: row.platform,
      basePrice: price,
    })
  }

  if (errors.length > 0) {
    return { data: [], errors }
  }
  if (data.length === 0) {
    return { data: [], errors: ['Table header found, but no cart item rows were present.'] }
  }

  return { data, errors: [] }
}
