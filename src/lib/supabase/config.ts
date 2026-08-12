function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, '')
}

export function normalizeSupabaseUrl(value: string) {
  const trimmed = stripTrailingSlash(value.trim())

  return trimmed.replace(/\/rest\/v1$/i, '')
}
