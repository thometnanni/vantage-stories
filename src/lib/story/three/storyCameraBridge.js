import { Vector3 } from 'three'
import {
  buildCurvedTransitionCurve,
  getDisplayFov,
  getLookTarget,
  getTransitionProfile,
  nextFrame,
  runCurvedTransition
} from '$lib/cameraTransition'

const waitFor = (getRendererElement, resolver, predicate = Boolean, timeoutMs = 4000) => {
  return new Promise((resolve) => {
    const start = performance.now()

    const poll = () => {
      const rendererElement = getRendererElement()
      const candidate = resolver(rendererElement)

      if (predicate(candidate)) {
        resolve(candidate)
        return
      }

      if (!rendererElement || performance.now() - start > timeoutMs) {
        resolve(null)
        return
      }

      requestAnimationFrame(poll)
    }

    poll()
  })
}

const waitForProjection = (getRendererElement, cameraId, timeoutMs = 4000) => {
  return waitFor(
    getRendererElement,
    (rendererElement) => rendererElement?.projections?.[cameraId],
    Boolean,
    timeoutMs
  )
}

const waitForCameraOperator = (getRendererElement, timeoutMs = 4000) => {
  return waitFor(
    getRendererElement,
    (rendererElement) => rendererElement?.cameraOperator,
    (operator) => Boolean(operator?.mapCamera && operator?.mapControls),
    timeoutMs
  )
}

const parsePosition = (value) => {
  if (typeof value !== 'string') return null

  const parts = value
    .trim()
    .split(/\s+/)
    .slice(0, 3)
    .map(Number)

  if (parts.length < 3 || parts.some((item) => !Number.isFinite(item))) {
    return null
  }

  return new Vector3(parts[0], parts[1], parts[2])
}

const collectKeyframePoints = (projections) => {
  const points = []

  for (const projection of projections ?? []) {
    for (const keyframe of projection.keyframes ?? []) {
      const parsed = parsePosition(keyframe.position)
      if (parsed) points.push(parsed)
    }
  }

  return points
}

const setOverviewCameraPose = (operator, points) => {
  if (!operator?.mapCamera || !operator?.mapControls || points.length === 0) return

  const min = points[0].clone()
  const max = points[0].clone()
  for (const point of points) {
    min.min(point)
    max.max(point)
  }

  const center = min.clone().add(max).multiplyScalar(0.5)
  const size = max.clone().sub(min)
  const horizontalSpan = Math.max(20, size.x, size.z)
  const verticalSpan = Math.max(6, size.y)

  const target = center.clone()
  const lateral = Math.max(70, horizontalSpan * 0.35)
  const height = Math.max(80, horizontalSpan * 2 + verticalSpan)
  const position = center.clone().add(new Vector3(lateral * 0.7, height, lateral * 0.7))

  const mapCamera = operator.mapCamera
  mapCamera.position.copy(position)
  mapCamera.lookAt(target)
  if (mapCamera.isPerspectiveCamera) {
    mapCamera.fov = Math.max(84, mapCamera.fov)
    mapCamera.updateProjectionMatrix()
  }

  operator.mapControls.target.copy(target)
  operator.mapControls.update()
}

const createStoryCameraBridge = ({ getRendererElement, onTransitionStateChange } = {}) => {
  let transitionToken = 0

  const setTransitionState = (value) => {
    onTransitionStateChange?.(value)
  }

  const applyInitialOverviewCamera = async ({
    projections = [],
    overviewMode = false,
    activeCameraId = ''
  } = {}) => {
    if (!overviewMode || activeCameraId) return

    const operator = await waitForCameraOperator(getRendererElement)
    if (!operator) return

    const points = collectKeyframePoints(projections)
    setOverviewCameraPose(operator, points)
  }

  const transitionToCamera = async (cameraId, durationMs = 1800) => {
    const rendererElement = getRendererElement?.()
    if (!rendererElement?.cameraOperator) return false

    const token = ++transitionToken
    const targetProjection = await waitForProjection(getRendererElement, cameraId)
    if (!targetProjection || token !== transitionToken) return false

    await nextFrame()
    if (token !== transitionToken) return false

    const operator = getRendererElement()?.cameraOperator
    const sourceCamera = operator?.mapCamera
    const targetCamera = targetProjection.camera
    if (!sourceCamera || !targetCamera) return false

    const mapControls = operator.mapControls
    const startPosition = sourceCamera.position.clone()
    const targetPosition = targetCamera.position.clone()
    const startQuaternion = sourceCamera.quaternion.clone()
    const targetQuaternion = targetCamera.quaternion.clone()
    const startFov = sourceCamera.isPerspectiveCamera ? sourceCamera.fov : null
    const targetProjectionFov = targetCamera.isPerspectiveCamera ? targetCamera.fov : startFov
    const targetFov =
      targetProjectionFov != null ? getDisplayFov(targetProjectionFov) : startFov

    const { effectiveDurationMs, flyArcHeight } = getTransitionProfile(
      startPosition,
      targetPosition,
      durationMs
    )
    const curvedPathCurve = buildCurvedTransitionCurve(startPosition, targetPosition, flyArcHeight)

    const currentControlDistance = mapControls?.target
      ? sourceCamera.position.distanceTo(mapControls.target)
      : 16
    const desiredLookDistance = Math.max(10, currentControlDistance)

    const startLookTarget =
      mapControls?.target?.clone?.() ?? getLookTarget(sourceCamera, desiredLookDistance)
    const targetLookTarget = getLookTarget(targetCamera, desiredLookDistance)

    if (mapControls) {
      mapControls.enabled = false
    }

    setTransitionState(true)
    const completed = await runCurvedTransition({
      sourceCamera,
      mapControls,
      startQuaternion,
      targetQuaternion,
      startFov,
      targetFov,
      startLookTarget,
      targetLookTarget,
      effectiveDurationMs,
      curve: curvedPathCurve,
      isCancelled: () => token !== transitionToken
    })

    if (token === transitionToken && completed) {
      sourceCamera.position.copy(targetPosition)
      sourceCamera.quaternion.copy(targetQuaternion)

      if (sourceCamera.isPerspectiveCamera && targetFov != null) {
        sourceCamera.fov = targetFov
        sourceCamera.updateProjectionMatrix()
      }

      if (mapControls) {
        mapControls.target.copy(targetLookTarget)
      }
    }

    if (mapControls) {
      mapControls.enabled = true
      mapControls.update()
    }
    setTransitionState(false)

    return token === transitionToken && completed
  }

  return {
    applyInitialOverviewCamera,
    transitionToCamera
  }
}

export { createStoryCameraBridge }
