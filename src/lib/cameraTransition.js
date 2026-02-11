import { CatmullRomCurve3, LineCurve3, Vector3 } from 'three'

const LINEAR_TRANSITION_DISTANCE = 40

export const nextFrame = () => {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

export const easeInOutCubic = (value) => {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2
}

export const getDisplayFov = (projectionFov) => {
  const safe = Number(projectionFov)
  if (!Number.isFinite(safe)) return 88
  return Math.min(112, Math.max(78, safe + 28))
}

export const getLookTarget = (camera, distance = 16) => {
  const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
  return camera.position.clone().add(forward.multiplyScalar(distance))
}

export const getTransitionProfile = (startPosition, targetPosition, durationMs) => {
  const transitionDistance = startPosition.distanceTo(targetPosition)
  const farFactor = Math.min(1, Math.max(0, (transitionDistance - 24) / 90))
  const baseDuration = Math.round(durationMs * (0.5 + farFactor * 0.85))
  const durationFromDistance = Math.round(650 + transitionDistance * (14 + 12 * farFactor))
  const effectiveDurationMs = Math.max(
    700,
    Math.min(4200, Math.max(baseDuration, durationFromDistance))
  )
  const flyArcHeight = Math.min(
    140,
    Math.max(0, transitionDistance * (0.05 + 0.3 * farFactor) + 10 * farFactor)
  )

  return { effectiveDurationMs, flyArcHeight }
}

export const buildCurvedTransitionCurve = (startPosition, targetPosition, arcHeight) => {
  const distance = startPosition.distanceTo(targetPosition)
  if (distance <= LINEAR_TRANSITION_DISTANCE) {
    return new LineCurve3(startPosition.clone(), targetPosition.clone())
  }

  const midpoint = startPosition.clone().lerp(targetPosition, 0.5)
  const travel = targetPosition.clone().sub(startPosition)
  const side = new Vector3(-travel.z, 0, travel.x)
  if (side.lengthSq() > 1e-6) {
    side.normalize().multiplyScalar(Math.min(22, distance * 0.2))
  }

  const apexHeight = Math.max(8, arcHeight + distance * 0.08)
  const controlA = startPosition
    .clone()
    .lerp(midpoint, 0.45)
    .add(new Vector3(0, apexHeight * 0.8, 0))
    .add(side.clone())
  const controlB = midpoint
    .clone()
    .add(new Vector3(0, apexHeight, 0))
    .add(side.clone().multiplyScalar(-0.6))

  return new CatmullRomCurve3(
    [startPosition.clone(), controlA, controlB, targetPosition.clone()],
    false,
    'catmullrom',
    0.5
  )
}

export const runCurvedTransition = ({
  sourceCamera,
  mapControls,
  startQuaternion,
  targetQuaternion,
  startFov,
  targetFov,
  startLookTarget,
  targetLookTarget,
  effectiveDurationMs,
  curve,
  isCancelled
}) => {
  return new Promise((resolve) => {
    let startTimestamp = 0
    const sampledPosition = new Vector3()

    const frame = (timestamp) => {
      if (isCancelled()) {
        resolve(false)
        return
      }

      if (!startTimestamp) {
        startTimestamp = timestamp
      }

      const elapsed = timestamp - startTimestamp
      const progress = Math.min(elapsed / effectiveDurationMs, 1)
      const eased = easeInOutCubic(progress)

      curve.getPointAt(eased, sampledPosition)
      sourceCamera.position.copy(sampledPosition)
      sourceCamera.quaternion.slerpQuaternions(startQuaternion, targetQuaternion, eased)

      if (sourceCamera.isPerspectiveCamera && startFov != null && targetFov != null) {
        sourceCamera.fov = startFov + (targetFov - startFov) * eased
        sourceCamera.updateProjectionMatrix()
      }

      if (mapControls) {
        mapControls.target.lerpVectors(startLookTarget, targetLookTarget, eased)
        mapControls.update()
      }

      if (progress < 1) {
        requestAnimationFrame(frame)
        return
      }

      resolve(true)
    }

    requestAnimationFrame(frame)
  })
}
