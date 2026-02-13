const REMOTE_ASSET_PATTERN = /^(https?:|data:|blob:|\/\/|file:)/i

const normalizeString = (value) => (typeof value === 'string' ? value.trim() : '')

const withBasePath = (value, basePath = '') => {
  const normalized = normalizeString(value)
  if (normalized.length === 0) return normalized
  if (REMOTE_ASSET_PATTERN.test(normalized)) return normalized
  if (
    basePath &&
    (normalized === basePath || normalized.startsWith(`${basePath}/`))
  ) {
    return normalized
  }

  if (normalized.startsWith('/')) return `${basePath}${normalized}`

  const withoutDotPrefix = normalized.replace(/^\.\//, '')
  return `${basePath}/${withoutDotPrefix}`
}

const mapProjectionAssetsWithBase = (projections, basePath = '') => {
  if (!Array.isArray(projections)) return []

  return projections.map((projection) => ({
    ...projection,
    src: withBasePath(projection.src, basePath),
    previewSrc: withBasePath(projection.previewSrc, basePath)
  }))
}

export { REMOTE_ASSET_PATTERN, mapProjectionAssetsWithBase, withBasePath }
