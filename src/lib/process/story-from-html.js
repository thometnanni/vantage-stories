import { resolveStarterData } from '$lib/starterkit'

const asNumber = (value, fallback) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

const asBool = (value, fallback = false) => {
  if (value === true) return true
  if (value === false || value == null) return fallback

  if (typeof value === 'string') {
    if (value === 'false' || value === '0') return false
    if (value === 'true' || value === '1' || value === '') return true
  }

  return fallback
}

const asTrimmedString = (value) => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const readContext = (element, fallbackText = '') => {
  const inlineMarkdown =
    asTrimmedString(element.getAttribute('context-markdown')) ||
    asTrimmedString(element.getAttribute('context'))
  const contextTitle = asTrimmedString(element.getAttribute('context-title'))
  const contextMarkdown =
    inlineMarkdown ||
    asTrimmedString(element.getAttribute('context-text')) ||
    asTrimmedString(fallbackText)

  if (contextTitle.length === 0 && contextMarkdown.length === 0) {
    return undefined
  }

  return {
    ...(contextTitle.length > 0 ? { title: contextTitle } : {}),
    ...(contextMarkdown.length > 0 ? { markdown: contextMarkdown } : {})
  }
}

const getDirectProjectionText = (projectionEl) => {
  const clone = projectionEl.cloneNode(true)
  clone.querySelectorAll('vantage-keyframe').forEach((node) => node.remove())
  return clone.textContent ?? ''
}

const localizeAssetPath = (value) => {
  const raw = asTrimmedString(value)
  if (raw.length === 0) return null
  if (/^(https?:|data:|blob:|\/\/|file:)/i.test(raw)) return null

  const withoutQuery = raw.split('#')[0].split('?')[0]
  const slashNormalized = withoutQuery.replace(/\\+/g, '/')
  const withoutDotPrefix = slashNormalized.replace(/^\.\//, '')
  const withoutLeadingSlash = withoutDotPrefix.replace(/^\/+/, '')

  return withoutLeadingSlash.length > 0 ? withoutLeadingSlash : null
}

const extractProjections = (container) => {
  const projectionElements = Array.from(container.querySelectorAll('vantage-projection')).filter(
    (element) => element.parentElement === container
  )

  let projectionIndex = 0

  return projectionElements.map((projectionEl) => {
    projectionIndex += 1

    const projectionType =
      asTrimmedString(projectionEl.getAttribute('projection-type')) || 'perspective'

    const keyframes = Array.from(projectionEl.querySelectorAll('vantage-keyframe'))
      .filter((element) => element.parentElement === projectionEl)
      .map((keyframeEl) => {
        const keyframe = {
          time: asNumber(keyframeEl.getAttribute('time'), 0)
        }

        for (const attr of ['position', 'rotation', 'layers', 'bounds']) {
          const value = asTrimmedString(keyframeEl.getAttribute(attr))
          if (value.length > 0) keyframe[attr] = value
        }

        for (const attr of ['fov', 'far', 'opacity']) {
          const rawValue = keyframeEl.getAttribute(attr)
          if (rawValue != null && rawValue !== '') {
            keyframe[attr] = asNumber(rawValue, undefined)
          }
        }

        if (keyframeEl.hasAttribute('screen')) {
          keyframe.screen = asBool(keyframeEl.getAttribute('screen'), true)
        }

        const context = readContext(keyframeEl, keyframeEl.textContent ?? '')
        if (context != null) {
          keyframe.context = context
        }

        return keyframe
      })

    const projection = {
      id: asTrimmedString(projectionEl.getAttribute('id')) || `projection-${projectionIndex}`,
      src: asTrimmedString(projectionEl.getAttribute('src')),
      projectionType,
      time: asNumber(projectionEl.getAttribute('time'), 0),
      cameraSelectable: projectionEl.hasAttribute('camera-selectable')
        ? asBool(projectionEl.getAttribute('camera-selectable'), true)
        : projectionType !== 'map',
      keyframes
    }

    const label = asTrimmedString(projectionEl.getAttribute('label'))
    if (label.length > 0) projection.label = label

    const previewSrc = asTrimmedString(projectionEl.getAttribute('preview-src'))
    if (previewSrc.length > 0) projection.previewSrc = previewSrc

    if (projectionEl.hasAttribute('start-time')) {
      projection.startTime = asNumber(projectionEl.getAttribute('start-time'), projection.time)
    }

    const context = readContext(projectionEl, getDirectProjectionText(projectionEl))
    if (context != null) {
      projection.context = context
    }

    return projection
  })
}

const extractRenderer = (doc) => {
  const renderer = doc.querySelector('vantage-renderer')
  if (renderer) {
    return {
      renderer,
      sceneSrc: asTrimmedString(renderer.getAttribute('scene')) || ''
    }
  }

  const projections = doc.querySelector('vantage-projection')
  if (!projections) {
    throw new Error('No <vantage-renderer> or <vantage-projection> found in the pasted HTML.')
  }

  return {
    renderer: doc.body,
    sceneSrc: ''
  }
}

export const createStoryFromRendererHtml = (htmlSnippet) => {
  if (typeof DOMParser === 'undefined') {
    throw new Error('DOMParser is not available in this environment.')
  }

  const raw = asTrimmedString(htmlSnippet)
  if (raw.length === 0) {
    throw new Error('Paste the <vantage-renderer> block first.')
  }

  const parser = new DOMParser()
  const doc = parser.parseFromString(raw, 'text/html')

  const { renderer, sceneSrc } = extractRenderer(doc)
  const slider = doc.querySelector('input#time')

  const starterInput = {
    sceneSrc,
    maxTimelineTime: asNumber(slider?.getAttribute('max'), undefined),
    projections: extractProjections(renderer)
  }

  const resolved = resolveStarterData(starterInput)

  const story = {
    sceneSrc: resolved.sceneSrc,
    maxTimelineTime: resolved.maxTimelineTime,
    ui: resolved.ui,
    projections: resolved.projections
  }

  const assetPaths = new Set()
  const sceneAsset = localizeAssetPath(story.sceneSrc)
  if (sceneAsset) assetPaths.add(sceneAsset)

  for (const projection of story.projections) {
    const src = localizeAssetPath(projection.src)
    if (src) assetPaths.add(src)

    const preview = localizeAssetPath(projection.previewSrc)
    if (preview) assetPaths.add(preview)
  }

  return {
    story,
    stats: {
      projections: story.projections.length,
      keyframes: story.projections.reduce((sum, projection) => sum + projection.keyframes.length, 0)
    },
    assetPaths: Array.from(assetPaths)
  }
}

const normalizeSelectedPath = (value) => {
  const cleaned = asTrimmedString(value).replace(/\\+/g, '/').replace(/^\/+/, '')
  if (cleaned.length === 0) return ''

  const parts = cleaned.split('/').filter(Boolean)
  return parts.at(-1) ?? ''
}

export const validateLocalAssetPaths = (assetPaths, folderFiles) => {
  const files = Array.isArray(folderFiles) ? folderFiles : []

  if (files.length === 0) {
    return {
      total: assetPaths.length,
      checked: 0,
      found: [],
      missing: []
    }
  }

  const selectedPathSet = new Set()
  for (const file of files) {
    const relative =
      typeof file.webkitRelativePath === 'string' && file.webkitRelativePath.length > 0
        ? file.webkitRelativePath
        : file.name

    const normalized = normalizeSelectedPath(relative)
    if (normalized.length > 0) selectedPathSet.add(normalized)
  }

  const found = []
  const missing = []

  for (const assetPath of assetPaths) {
    const normalized = normalizeSelectedPath(assetPath)
    if (selectedPathSet.has(normalized)) {
      found.push(assetPath)
    } else {
      missing.push(assetPath)
    }
  }

  return {
    total: assetPaths.length,
    checked: files.length,
    found,
    missing
  }
}
