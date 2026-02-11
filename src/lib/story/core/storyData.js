const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const DEFAULT_UI = {
  pageTitle: 'Vantage Story',
  header: {
    title: 'Vantage Story',
    description: ''
  },
  context: {
    introText: '',
    emptyText: 'No context for this keyframe.'
  },
  renderer: {
    loading: 'Loading renderer'
  },
  credits: {
    symbol: '©',
    label: 'OpenStreetMap contributors',
    href: 'https://www.openstreetmap.org/copyright'
  }
}

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '')
const toStringOrFallback = (value, fallback) => {
  const normalized = toTrimmedString(value)
  return normalized.length > 0 ? normalized : fallback
}

const toAbsoluteAssetPath = (value) => {
  const normalized = toTrimmedString(value)
  if (normalized.length === 0) return ''
  if (/^(https?:|data:|blob:|\/\/|file:)/i.test(normalized)) return normalized

  const withoutLeading = normalized.replace(/^\.\//, '').replace(/^\/+/, '')
  return `/${withoutLeading}`
}

const resolveUiConfig = (ui) => {
  const source = ui && typeof ui === 'object' ? ui : {}
  const toSection = (value) => (value && typeof value === 'object' ? value : {})
  const header = toSection(source.header)
  const context = toSection(source.context)
  const renderer = toSection(source.renderer)
  const credits = toSection(source.credits)

  return {
    pageTitle: toStringOrFallback(source.pageTitle, DEFAULT_UI.pageTitle),
    header: {
      title: toStringOrFallback(header.title, DEFAULT_UI.header.title),
      description: toTrimmedString(header.description)
    },
    context: {
      introText: toTrimmedString(context.introText),
      emptyText: toStringOrFallback(context.emptyText, DEFAULT_UI.context.emptyText)
    },
    renderer: {
      loading: toStringOrFallback(renderer.loading, DEFAULT_UI.renderer.loading)
    },
    credits: {
      symbol: toStringOrFallback(credits.symbol, DEFAULT_UI.credits.symbol),
      label: toStringOrFallback(credits.label, DEFAULT_UI.credits.label),
      href: toStringOrFallback(credits.href, DEFAULT_UI.credits.href)
    }
  }
}

const normalizeProjection = (projection, index) => {
  const id = projection.id ?? `projection-${index + 1}`
  const time = toFiniteNumber(projection.time, 0)
  const startTime = toFiniteNumber(projection.startTime, time)
  const src = toAbsoluteAssetPath(projection.src)
  const previewSrc = toAbsoluteAssetPath(projection.previewSrc) || src

  return {
    ...projection,
    id,
    label: projection.label ?? id,
    src,
    previewSrc,
    projectionType: projection.projectionType ?? 'perspective',
    time,
    startTime,
    cameraSelectable: projection.cameraSelectable !== false,
    keyframes: Array.isArray(projection.keyframes) ? projection.keyframes : []
  }
}

const deriveMaxTimeline = (projections) => {
  const values = projections.flatMap((projection) => {
    const localTimes = projection.keyframes.map((keyframe) =>
      toFiniteNumber(keyframe.time, 0) + projection.time
    )

    return [projection.startTime, projection.time, ...localTimes]
  })

  return Math.max(0, ...values)
}

const isVideoSource = (source = '') => /\.(mp4|webm|ogg)(\?.*)?$/i.test(source)

const resolveStoryData = (data = {}) => {
  const projections = (Array.isArray(data.projections) ? data.projections : []).map(
    normalizeProjection
  )

  const cameraTracks = projections
    .filter((projection) => projection.cameraSelectable)
    .sort((a, b) => a.startTime - b.startTime)

  const derivedMaxTimeline = deriveMaxTimeline(projections)

  return {
    sceneSrc: toAbsoluteAssetPath(data.sceneSrc),
    maxTimelineTime: toFiniteNumber(data.maxTimelineTime, derivedMaxTimeline),
    projections,
    cameraTracks,
    ui: resolveUiConfig(data.ui)
  }
}

export { deriveMaxTimeline, isVideoSource, normalizeProjection, resolveStoryData, toAbsoluteAssetPath }
