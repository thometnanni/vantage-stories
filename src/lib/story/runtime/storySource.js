const isStoryPayload = (value) => {
  return Boolean(value && typeof value === 'object' && Array.isArray(value.projections))
}

const loadStoryFromPath = async (path, fetchImpl = fetch) => {
  const source = typeof path === 'string' ? path.trim() : ''
  if (source.length === 0) return null

  const response = await fetchImpl(source, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`Failed to load ${source}: ${response.status}`)
  }

  const parsed = await response.json()
  if (!isStoryPayload(parsed)) {
    throw new Error(`Invalid story JSON at ${source}`)
  }

  return parsed
}

export { isStoryPayload, loadStoryFromPath }
