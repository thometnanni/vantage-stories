const getCameraById = (cameraTracks, cameraId) => {
  if (!Array.isArray(cameraTracks)) return null
  return cameraTracks.find((item) => item.id === cameraId) ?? null
}

const getCameraForTime = (cameraTracks, timelineTime) => {
  if (!Array.isArray(cameraTracks) || cameraTracks.length === 0) return null

  const safeTime = Number.isFinite(timelineTime) ? Math.max(0, timelineTime) : 0
  let selected = cameraTracks[0]
  let selectedStartTime = Number(selected?.startTime) || 0

  for (const camera of cameraTracks) {
    const cameraStartTime = Number(camera.startTime) || 0
    if (cameraStartTime > safeTime) break
    if (cameraStartTime > selectedStartTime) {
      selected = camera
      selectedStartTime = cameraStartTime
    }
  }

  return selected
}

const getActiveProjection = (projections, activeCameraId) => {
  if (!Array.isArray(projections) || !activeCameraId) return null
  return projections.find((projection) => projection.id === activeCameraId) ?? null
}

const getActiveKeyframe = (projection, globalTime) => {
  if (!projection || !Array.isArray(projection.keyframes) || projection.keyframes.length === 0) {
    return null
  }

  const offset = Number(projection.time) || 0
  const effectiveTime = globalTime - offset
  const sorted = [...projection.keyframes].sort(
    (a, b) => (Number(a.time) || 0) - (Number(b.time) || 0)
  )

  let selected = sorted[0]
  for (const keyframe of sorted) {
    const keyTime = Number(keyframe.time) || 0
    if (keyTime <= effectiveTime) {
      selected = keyframe
    } else {
      break
    }
  }

  return selected
}

const getActiveContext = (projection, globalTime) => {
  if (!projection) return null
  const keyframe = getActiveKeyframe(projection, globalTime)
  return keyframe?.context ?? projection?.context ?? null
}

const projectionHasContext = (projection, hasRenderableContent) => {
  if (!projection || typeof projection !== 'object') return false
  if (hasRenderableContent(projection.context)) return true

  if (!Array.isArray(projection.keyframes)) return false
  return projection.keyframes.some((keyframe) => hasRenderableContent(keyframe?.context))
}

const storyHasContext = (projections, hasRenderableContent) => {
  if (!Array.isArray(projections)) return false
  return projections.some((projection) => projectionHasContext(projection, hasRenderableContent))
}

const clampTimelineTime = (timelineTime, maxTimelineTime) => {
  if (!Number.isFinite(maxTimelineTime) || maxTimelineTime <= 0) return 0
  if (!Number.isFinite(timelineTime)) return 0
  return Math.max(0, Math.min(maxTimelineTime, timelineTime))
}

const getNextCameraInLoop = (cameraTracks, activeCameraId) => {
  if (!Array.isArray(cameraTracks) || cameraTracks.length === 0) return null
  const activeIndex = cameraTracks.findIndex((camera) => camera.id === activeCameraId)
  const nextIndex = activeIndex >= 0 ? (activeIndex + 1) % cameraTracks.length : 0
  return cameraTracks[nextIndex] ?? null
}

export {
  clampTimelineTime,
  getActiveContext,
  getActiveKeyframe,
  getActiveProjection,
  getCameraById,
  getCameraForTime,
  getNextCameraInLoop,
  projectionHasContext,
  storyHasContext
}
