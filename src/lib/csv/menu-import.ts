export type CsvPreviewRow = {
  category: string
  name: string
  description: string
  price: number
  /** Optional Greek item name (from a `name_el` CSV column). */
  nameEl: string | null
  /** Optional Greek item description (from a `description_el` CSV column). */
  descriptionEl: string | null
}

export type CsvParseResult = {
  rows: CsvPreviewRow[]
  errors: string[]
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '_').replace(/-+/g, '_')
}

/**
 * Parses menu CSV text.
 *
 * Two accepted shapes:
 * - Legacy, headerless: `category,name,description,price` (extra comma-separated
 *   fields join the description) — fully backward compatible.
 * - Header row: `category,name,description,price,name_el,description_el`.
 *   The optional `name_el` / `description_el` columns populate the Greek menu
 *   translation; when omitted (or empty) the columns stay NULL and the customer
 *   menu falls back to the English text.
 */
export function parseCsvRows(rawText: string): CsvParseResult {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) {
    return { rows: [], errors: [] }
  }

  const seenKeys = new Set<string>()
  const rows: CsvPreviewRow[] = []
  const errors: string[] = []

  const pushRow = (
    category: string,
    name: string,
    description: string,
    priceRaw: string,
    nameEl: string | null,
    descriptionEl: string | null,
    lineNumber: number
  ) => {
    if (!category || !name) {
      errors.push(`Line ${lineNumber}: category and name are required.`)
      return
    }
    const price = Number(priceRaw)
    if (priceRaw.trim() === '' || !Number.isFinite(price) || price < 0) {
      errors.push(`Line ${lineNumber}: invalid price "${priceRaw}".`)
      return
    }
    const key = `${category.toLowerCase()}::${name.toLowerCase()}`
    if (seenKeys.has(key)) {
      errors.push(`Line ${lineNumber}: duplicate item "${name}" in category "${category}".`)
      return
    }
    seenKeys.add(key)
    rows.push({ category, name, description, price, nameEl, descriptionEl })
  }

  const firstParts = parseCsvLine(lines[0]!)
  const hasHeader =
    firstParts.some((part) => normalizeHeader(part) === 'category') &&
    firstParts.some((part) => normalizeHeader(part) === 'name')

  if (hasHeader) {
    const columnIndex = new Map<string, number>()
    firstParts.forEach((part, index) => columnIndex.set(normalizeHeader(part), index))
    const at = (parts: string[], key: string): string | undefined => {
      const index = columnIndex.get(key)
      return index !== undefined ? parts[index] : undefined
    }

    lines.slice(1).forEach((line, index) => {
      const lineNumber = index + 2
      const parts = parseCsvLine(line)
      const category = at(parts, 'category')
      const name = at(parts, 'name')
      const priceRaw = at(parts, 'price') ?? ''
      const description = at(parts, 'description') ?? ''
      const nameEl = at(parts, 'name_el')?.trim() || null
      const descriptionEl = at(parts, 'description_el')?.trim() || null
      pushRow(category ?? '', name ?? '', description, priceRaw, nameEl, descriptionEl, lineNumber)
    })

    return { rows, errors }
  }

  // Legacy headerless format: category,name,description,price. Anything beyond
  // the 4th field is folded back into the description.
  lines.forEach((line, index) => {
    const lineNumber = index + 1
    const parts = parseCsvLine(line)

    if (parts.length < 4) {
      errors.push(`Line ${lineNumber}: expected at least 4 comma-separated values.`)
      return
    }

    const category = parts[0]
    const name = parts[1]
    const priceRaw = parts[parts.length - 1]
    const description = parts.slice(2, -1).join(',')
    const price = Number(priceRaw)

    pushRow(category, name, description, priceRaw, null, null, lineNumber)
  })

  return { rows, errors }
}

export function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index]
    const nextCharacter = line[index + 1]

    if (character === '"') {
      if (inQuotes && nextCharacter === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (character === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
      continue
    }

    current += character
  }

  result.push(current.trim())
  return result
}
