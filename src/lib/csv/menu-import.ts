export type CsvPreviewRow = {
  category: string
  name: string
  description: string
  price: number
}

export type CsvParseResult = {
  rows: CsvPreviewRow[]
  errors: string[]
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

export function parseCsvRows(rawText: string): CsvParseResult {
  const seenKeys = new Set<string>()
  const rows: CsvPreviewRow[] = []
  const errors: string[] = []

  rawText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line, index) => {
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

      if (!category || !name) {
        errors.push(`Line ${lineNumber}: category and name are required.`)
        return
      }

      if (!Number.isFinite(price) || price < 0) {
        errors.push(`Line ${lineNumber}: invalid price "${priceRaw}".`)
        return
      }

      const key = `${category.toLowerCase()}::${name.toLowerCase()}`
      if (seenKeys.has(key)) {
        errors.push(`Line ${lineNumber}: duplicate item "${name}" in category "${category}".`)
        return
      }
      seenKeys.add(key)

      rows.push({ category, name, description, price })
    })

  return { rows, errors }
}