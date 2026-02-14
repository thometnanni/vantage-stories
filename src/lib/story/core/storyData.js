const toFiniteNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const toBoolean = (value, fallback = false) => {
  if (typeof value === 'boolean') return value
  if (typeof value !== 'string') return fallback

  const normalized = value.trim().toLowerCase()
  if (normalized === '' || normalized === 'true' || normalized === '1' || normalized === 'yes') {
    return true
  }
  if (normalized === 'false' || normalized === '0' || normalized === 'no') {
    return false
  }

  return fallback
}

const DEFAULT_UI = {
  pageTitle: 'Vantage',
  header: {
    title: '',
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
    label:
      '© OpenStreetMap contributors \n\n Realised with [Vantage](https://vantage.thometnanni.net/).'
  },
  theme: {
    pageBg: '#000',
    sceneBg: '#000',
    panelFill: '#000',
    panelStroke: '#000',
    text: '#fff',
    mutedText: '#ccc',
    accent: '#fff',
    contextBg: '#000',
    contextText: '#fff',
    contextMuted: '#ccc'
  }
}

const toTrimmedString = (value) => (typeof value === 'string' ? value.trim() : '')
const toStringOrFallback = (value, fallback) => {
  const normalized = toTrimmedString(value)
  return normalized.length > 0 ? normalized : fallback
}

const normalizeVectorString = (value) => {
  if (Array.isArray(value)) {
    return value.map((item) => toFiniteNumber(item, 0)).join(' ')
  }

  const normalized = toTrimmedString(value)
  if (normalized.length === 0) return normalized
  return normalized.replaceAll(',', ' ').replace(/\s+/g, ' ').trim()
}

const normalizeContext = (value) => {
  const asString = toTrimmedString(value)
  if (asString.length > 0) {
    return { markdown: asString }
  }

  if (!value || typeof value !== 'object') return null

  const title = toTrimmedString(value.title)
  const markdown = toTrimmedString(
    value.markdown ?? value.text ?? value.body ?? value.comment ?? value.notes
  )

  if (title.length === 0 && markdown.length === 0) return null

  return {
    ...(title.length > 0 ? { title } : {}),
    ...(markdown.length > 0 ? { markdown } : {})
  }
}

const keyframeHasCameraPose = (keyframe) => {
  const position = normalizeVectorString(keyframe?.position)
  const rotation = normalizeVectorString(keyframe?.rotation)
  return position.length > 0 && rotation.length > 0
}

const normalizeKeyframe = (keyframe, index) => {
  const normalized = {
    ...keyframe,
    time: toFiniteNumber(keyframe.time, index)
  }

  const position = normalizeVectorString(keyframe.position)
  const rotation = normalizeVectorString(keyframe.rotation)

  if (position.length > 0) normalized.position = position
  if (rotation.length > 0) normalized.rotation = rotation

  const scrollWeight = toFiniteNumber(keyframe.scrollWeight ?? keyframe.scroll_weight, Number.NaN)
  if (Number.isFinite(scrollWeight) && scrollWeight > 0) {
    normalized.scrollWeight = scrollWeight
  } else {
    delete normalized.scrollWeight
  }

  const pause = toFiniteNumber(keyframe.pause ?? keyframe.pauseWeight ?? keyframe.hold, Number.NaN)
  if (Number.isFinite(pause) && pause > 0) {
    normalized.pause = pause
  } else {
    delete normalized.pause
  }

  const context =
    normalizeContext(keyframe.context) ??
    normalizeContext({
      title: keyframe.commentTitle ?? keyframe.title,
      markdown: keyframe.comment ?? keyframe.notes ?? keyframe.text ?? keyframe.markdown
    })
  if (context) normalized.context = context
  else delete normalized.context

  return normalized
}

const toAbsoluteAssetPath = (value) => {
  const normalized = toTrimmedString(value)
  if (normalized.length === 0) return ''
  if (/^(https?:|data:|blob:|\/\/|file:)/i.test(normalized)) return normalized

  const queryIndex = normalized.indexOf('?')
  const hashIndex = normalized.indexOf('#')
  const splitIndex = [queryIndex, hashIndex].filter((index) => index >= 0).sort((a, b) => a - b)[0]

  const basePath = splitIndex == null ? normalized : normalized.slice(0, splitIndex)
  const suffix = splitIndex == null ? '' : normalized.slice(splitIndex)
  const withoutLeading = basePath.replace(/^\.\//, '').replace(/^\/+/, '')

  const slashIndex = withoutLeading.lastIndexOf('/')
  const directory = slashIndex >= 0 ? withoutLeading.slice(0, slashIndex + 1) : ''
  let filename = slashIndex >= 0 ? withoutLeading.slice(slashIndex + 1) : withoutLeading

  const token = 'live_view_upload-'
  const first = filename.indexOf(token)
  const second = first >= 0 ? filename.indexOf(token, first + token.length) : -1
  if (second > 0) {
    filename = filename.slice(second)
  }

  return `/${directory}${filename}${suffix}`
}

const resolveUiConfig = (ui) => {
  const source = ui && typeof ui === 'object' ? ui : {}
  const toSection = (value) => (value && typeof value === 'object' ? value : {})
  const header = toSection(source.header)
  const context = toSection(source.context)
  const renderer = toSection(source.renderer)
  const credits = toSection(source.credits)
  const theme = toSection(source.theme)

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
      label: toStringOrFallback(credits.label, DEFAULT_UI.credits.label),
      href: toStringOrFallback(credits.href, DEFAULT_UI.credits.href)
    },
    theme: {
      pageBg: toStringOrFallback(theme.pageBg, DEFAULT_UI.theme.pageBg),
      sceneBg: toStringOrFallback(theme.sceneBg, DEFAULT_UI.theme.sceneBg),
      panelFill: toStringOrFallback(theme.panelFill, DEFAULT_UI.theme.panelFill),
      panelStroke: toStringOrFallback(theme.panelStroke, DEFAULT_UI.theme.panelStroke),
      text: toStringOrFallback(theme.text, DEFAULT_UI.theme.text),
      mutedText: toStringOrFallback(theme.mutedText, DEFAULT_UI.theme.mutedText),
      accent: toStringOrFallback(theme.accent, DEFAULT_UI.theme.accent),
      contextBg: toStringOrFallback(
        theme.contextBg,
        toStringOrFallback(theme.pageBg, DEFAULT_UI.theme.contextBg)
      ),
      contextText: toStringOrFallback(
        theme.contextText,
        toStringOrFallback(theme.text, DEFAULT_UI.theme.contextText)
      ),
      contextMuted: toStringOrFallback(
        theme.contextMuted,
        toStringOrFallback(theme.mutedText, DEFAULT_UI.theme.contextMuted)
      )
    }
  }
}

const normalizeProjection = (projection, index) => {
  const id = projection.id ?? `projection-${index + 1}`
  const time = toFiniteNumber(projection.time, 0)
  const startTime = toFiniteNumber(projection.startTime, time)
  const src = toAbsoluteAssetPath(projection.src)
  const previewSrc = toAbsoluteAssetPath(projection.previewSrc) || src
  const keyframes = Array.isArray(projection.keyframes)
    ? projection.keyframes.map((keyframe, keyframeIndex) =>
        normalizeKeyframe(keyframe, keyframeIndex)
      )
    : []
  const context = normalizeContext(projection.context)

  return {
    ...projection,
    id,
    label: projection.label ?? id,
    src,
    previewSrc,
    projectionType: projection.projectionType ?? 'perspective',
    time,
    startTime,
    focus: toBoolean(projection.focus, false),
    cameraPath: projection.cameraPath === true,
    cameraSelectable: projection.cameraSelectable !== false,
    ...(context ? { context } : {}),
    keyframes
  }
}

const deriveMaxTimeline = (projections) => {
  const values = projections.flatMap((projection) => {
    const localTimes = projection.keyframes.map(
      (keyframe) => toFiniteNumber(keyframe.time, 0) + projection.time
    )

    return [projection.startTime, projection.time, ...localTimes]
  })

  return Math.max(0, ...values)
}

const buildHiddenPathKeyframe = (keyframe, time) => {
  const base = {
    ...keyframe,
    time,
    opacity: 0,
    screen: false
  }

  if (!keyframeHasCameraPose(base)) {
    delete base.position
    delete base.rotation
  }

  return base
}

const ensurePathTimes = (keyframes) => {
  if (keyframes.length <= 1) return keyframes

  const sorted = [...keyframes].sort(
    (a, b) => toFiniteNumber(a.time, 0) - toFiniteNumber(b.time, 0)
  )

  const uniqueTimes = new Set(sorted.map((keyframe) => toFiniteNumber(keyframe.time, 0).toFixed(6)))
    .size
  if (uniqueTimes <= 1) {
    return sorted.map((keyframe, index) => ({ ...keyframe, time: index }))
  }

  let previous = toFiniteNumber(sorted[0].time, 0)
  return sorted.map((keyframe, index) => {
    if (index === 0) return { ...keyframe, time: previous }
    const candidate = toFiniteNumber(keyframe.time, previous + 0.001)
    const time = candidate <= previous ? previous + 0.001 : candidate
    previous = time
    return { ...keyframe, time }
  })
}

const withStableProjectionOrder = (projections) =>
  projections
    .map((projection, index) => ({ projection, index }))
    .sort((a, b) => {
      const byStart =
        toFiniteNumber(a.projection.startTime, 0) - toFiniteNumber(b.projection.startTime, 0)
      if (Math.abs(byStart) > 1e-6) return byStart
      return a.index - b.index
    })
    .map(({ projection }) => projection)

const buildRecordedCameraPathProjection = (projection) => {
  if (!projection || projection.projectionType !== 'perspective') return null

  const cameraKeyframes = projection.keyframes
    .filter((keyframe) => keyframeHasCameraPose(keyframe))
    .map((keyframe) =>
      buildHiddenPathKeyframe(
        keyframe,
        toFiniteNumber(keyframe.time, 0) + toFiniteNumber(projection.time, 0)
      )
    )

  if (cameraKeyframes.length === 0) return null

  const keyframes = ensurePathTimes(cameraKeyframes)
  const src = projection.src || projection.previewSrc

  return {
    ...projection,
    id: projection.id,
    label: projection.label ?? 'Camera Path',
    src,
    previewSrc: projection.previewSrc || src,
    projectionType: 'perspective',
    time: 0,
    startTime: 0,
    cameraSelectable: false,
    cameraPath: true,
    focus: true,
    opacity: 0,
    keyframes
  }
}

const buildCameraSequencePathProjection = (projections) => {
  const sources = withStableProjectionOrder(
    projections.filter(
      (projection) =>
        projection.projectionType === 'perspective' &&
        projection.cameraSelectable !== false &&
        projection.keyframes.some((keyframe) => keyframeHasCameraPose(keyframe))
    )
  )

  if (sources.length === 0) return null

  const keyframes = sources.map((projection, index) => {
    const keyframeWithPose = projection.keyframes.find((keyframe) =>
      keyframeHasCameraPose(keyframe)
    )
    const context =
      normalizeContext(keyframeWithPose?.context) ?? normalizeContext(projection.context)

    return {
      ...buildHiddenPathKeyframe(keyframeWithPose, index),
      ...(context ? { context } : {})
    }
  })

  const first = sources[0]
  const src = first.src || first.previewSrc

  return {
    id: 'camera-path',
    label: 'Camera Path',
    src,
    previewSrc: first.previewSrc || src,
    projectionType: 'perspective',
    time: 0,
    startTime: 0,
    cameraSelectable: false,
    cameraPath: true,
    focus: true,
    opacity: 0,
    keyframes
  }
}

const deriveCameraPathProjection = (input, projections) => {
  const preferredId = toTrimmedString(input.cameraPathProjectionId)

  const byId =
    preferredId.length > 0 ? projections.find((projection) => projection.id === preferredId) : null
  const flagged = projections.find((projection) => projection.cameraPath === true)
  const focused = projections.find(
    (projection) =>
      projection.focus === true &&
      projection.projectionType === 'perspective' &&
      projection.keyframes.some((keyframe) => keyframeHasCameraPose(keyframe))
  )
  const mostKeyframes = projections
    .filter(
      (projection) =>
        projection.projectionType === 'perspective' &&
        projection.keyframes.some((keyframe) => keyframeHasCameraPose(keyframe))
    )
    .sort((a, b) => b.keyframes.length - a.keyframes.length)[0]

  const preferred = byId ?? flagged ?? focused ?? mostKeyframes ?? null
  const recordedPath = preferred ? buildRecordedCameraPathProjection(preferred) : null
  if (recordedPath && recordedPath.keyframes.length >= 2) return recordedPath

  const sequencePath = buildCameraSequencePathProjection(projections)
  if (sequencePath) return sequencePath

  return recordedPath
}

const deriveCameraPathRange = (cameraPathProjection, fallbackMaxTimeline) => {
  const fallbackEnd = Math.max(1, toFiniteNumber(fallbackMaxTimeline, 1))
  if (!cameraPathProjection || !Array.isArray(cameraPathProjection.keyframes)) {
    return { start: 0, end: fallbackEnd, duration: fallbackEnd }
  }

  const times = cameraPathProjection.keyframes
    .map((keyframe) => toFiniteNumber(keyframe.time, Number.NaN))
    .filter((value) => Number.isFinite(value))

  if (times.length === 0) {
    return { start: 0, end: fallbackEnd, duration: fallbackEnd }
  }

  const start = Math.min(...times)
  const endRaw = Math.max(...times)
  const end = endRaw > start ? endRaw : start + fallbackEnd

  return {
    start,
    end,
    duration: Math.max(1e-6, end - start)
  }
}

const parseVector = (value) => {
  const normalized = normalizeVectorString(value)
  if (normalized.length === 0) return null
  const parts = normalized.split(' ').map((item) => toFiniteNumber(item, Number.NaN))
  if (parts.some((item) => !Number.isFinite(item))) return null
  return parts
}

const angleDelta = (a, b) => {
  const tau = Math.PI * 2
  let delta = (a - b) % tau
  if (delta > Math.PI) delta -= tau
  if (delta < -Math.PI) delta += tau
  return Math.abs(delta)
}

const poseDistance = (source, target) => {
  if (!source || !target) return Number.POSITIVE_INFINITY
  const sourcePos = parseVector(source.position)
  const targetPos = parseVector(target.position)
  const sourceRot = parseVector(source.rotation)
  const targetRot = parseVector(target.rotation)
  if (!sourcePos || !targetPos || !sourceRot || !targetRot) return Number.POSITIVE_INFINITY

  const posDelta = Math.hypot(
    sourcePos[0] - targetPos[0],
    sourcePos[1] - targetPos[1],
    sourcePos[2] - targetPos[2]
  )
  const rotDelta =
    angleDelta(sourceRot[0], targetRot[0]) +
    angleDelta(sourceRot[1], targetRot[1]) +
    angleDelta(sourceRot[2], targetRot[2])

  return posDelta + rotDelta * 20
}

const deriveProjectionContextMoments = (projections, cameraPathProjection, range) => {
  if (!cameraPathProjection || !Array.isArray(cameraPathProjection.keyframes)) return []

  const pathKeyframes = cameraPathProjection.keyframes
    .map((keyframe) => ({
      keyframe,
      time: toFiniteNumber(keyframe.time, range.start)
    }))
    .filter(({ keyframe }) => keyframeHasCameraPose(keyframe))

  if (pathKeyframes.length === 0) return []

  const projectionContexts = (Array.isArray(projections) ? projections : [])
    .filter(
      (projection) =>
        projection.projectionType === 'perspective' && projection.id !== cameraPathProjection.id
    )
    .map((projection) => {
      const keyframeWithPose = projection.keyframes.find((keyframe) =>
        keyframeHasCameraPose(keyframe)
      )
      const context =
        normalizeContext(keyframeWithPose?.context) ?? normalizeContext(projection.context)
      if (!keyframeWithPose || !context) return null

      let best = null
      for (const path of pathKeyframes) {
        const distance = poseDistance(keyframeWithPose, path.keyframe)
        if (!best || distance < best.distance) {
          best = { ...path, distance }
        }
      }
      if (!best) return null

      return {
        id: `moment-${projection.id}`,
        time: best.time,
        progress: Math.max(0, Math.min(1, (best.time - range.start) / range.duration)),
        context
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.time - b.time)

  return projectionContexts
}

const normalizeNarrativeMoment = (moment, index, range) => {
  const context =
    normalizeContext(moment.context) ??
    normalizeContext({
      title: moment.commentTitle ?? moment.title,
      markdown: moment.comment ?? moment.notes ?? moment.text ?? moment.markdown
    })
  const providedTime = Number(moment.time ?? moment.at)
  const providedProgress = Number(moment.progress)
  const fallbackProgress = index === 0 ? 0 : index / Math.max(1, range.count - 1)
  const progress = Number.isFinite(providedProgress)
    ? Math.max(0, Math.min(1, providedProgress))
    : fallbackProgress
  const time = Number.isFinite(providedTime)
    ? providedTime
    : range.start + progress * range.duration

  return {
    id: toTrimmedString(moment.id) || `moment-${index + 1}`,
    time,
    progress: Math.max(0, Math.min(1, (time - range.start) / range.duration)),
    context
  }
}

const deriveNarrativeMoments = (input, cameraPathProjection, range, projections) => {
  const explicitMoments = Array.isArray(input?.narrative?.moments)
    ? input.narrative.moments
    : Array.isArray(input?.moments)
      ? input.moments
      : []

  if (explicitMoments.length > 0) {
    const normalized = explicitMoments.map((moment, index) =>
      normalizeNarrativeMoment(moment, index, { ...range, count: explicitMoments.length })
    )
    return normalized.sort((a, b) => a.time - b.time)
  }

  if (!cameraPathProjection || !Array.isArray(cameraPathProjection.keyframes)) {
    return []
  }

  const keyframeMoments = cameraPathProjection.keyframes.map((keyframe, index) => {
    const time = toFiniteNumber(keyframe.time, range.start)
    return {
      id: `moment-${index + 1}`,
      time,
      progress: Math.max(0, Math.min(1, (time - range.start) / range.duration)),
      context: normalizeContext(keyframe.context)
    }
  })

  const keyframeContextMoments = keyframeMoments.filter((moment) => moment.context != null)
  const projectionContextMoments = deriveProjectionContextMoments(
    projections,
    cameraPathProjection,
    range
  )

  if (keyframeContextMoments.length > 0) {
    if (projectionContextMoments.length === 0) return keyframeContextMoments

    const EPSILON = 1e-4
    const hasNearbyKeyframeContext = (time) =>
      keyframeContextMoments.some(
        (moment) => Math.abs(toFiniteNumber(moment.time, Number.NaN) - time) <= EPSILON
      )

    const merged = [
      ...keyframeContextMoments,
      ...projectionContextMoments.filter(
        (moment) => !hasNearbyKeyframeContext(toFiniteNumber(moment.time, Number.NaN))
      )
    ].sort((a, b) => a.time - b.time)

    return merged
  }

  if (projectionContextMoments.length > 0) return projectionContextMoments

  return keyframeMoments
}

const resolveStoryData = (data = {}) => {
  const projections = (Array.isArray(data.projections) ? data.projections : []).map(
    normalizeProjection
  )

  const cameraTracks = projections
    .filter((projection) => projection.cameraSelectable)
    .sort((a, b) => a.startTime - b.startTime)

  const derivedMaxTimeline = deriveMaxTimeline(projections)
  const cameraPathProjection = deriveCameraPathProjection(data, projections)
  const cameraPathRange = deriveCameraPathRange(
    cameraPathProjection,
    Math.max(derivedMaxTimeline, toFiniteNumber(data.maxTimelineTime, 0))
  )
  const narrativeMoments = deriveNarrativeMoments(
    data,
    cameraPathProjection,
    cameraPathRange,
    projections
  )

  return {
    sceneSrc: toAbsoluteAssetPath(data.sceneSrc),
    maxTimelineTime: Math.max(
      toFiniteNumber(data.maxTimelineTime, 0),
      derivedMaxTimeline,
      cameraPathRange.end
    ),
    projections,
    cameraTracks,
    cameraPathProjectionId: cameraPathProjection?.id ?? '',
    cameraPathProjection,
    cameraPathRange,
    narrativeMoments,
    ui: resolveUiConfig(data.ui)
  }
}

export { resolveStoryData }
