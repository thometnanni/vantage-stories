<script>
  import { onMount, untrack } from 'svelte'
  import { Vector3 } from 'three'
  import SceneDescription from '$lib/components/SceneDescription.svelte'
  import TimelineControls from '$lib/components/TimelineControls.svelte'
  import data from '$lib/data'
  import { isVideoSource, resolveStarterData } from '$lib/starterkit'

  const storyPath = '/data/g8/story.json' // path to exported story JSON from the Vantage Platform.

  let sourceData = $state(data)
  let starter = $derived(resolveStarterData(sourceData))
  let sceneSrc = $derived(starter.sceneSrc)
  let maxTimelineTime = $derived(starter.maxTimelineTime)
  let projections = $derived(starter.projections)
  let cameraTracks = $derived(starter.cameraTracks)
  let ui = $derived(starter.ui)

  let rendererReady = $state(false)
  let currentTime = $state(0)
  let isPlaying = $state(false)
  let isTransitioning = $state(false)
  let overviewMode = $state(true)
  let cameraFrameVisible = $state(false)
  let mediaTimelineOpen = $state(true)
  let followEnabled = $state(false)
  let activeCameraId = $state('')

  let rendererElement
  let transitionToken = 0

  const isStoryPayload = (value) => {
    return Boolean(value && typeof value === 'object' && Array.isArray(value.projections))
  }

  const loadStoryFromJson = async () => {
    const source = storyPath.trim()
    if (source.length === 0) return

    const response = await fetch(source, { cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`Failed to load ${source}: ${response.status}`)
    }

    const parsed = await response.json()
    if (!isStoryPayload(parsed)) {
      throw new Error(`Invalid story JSON at ${source}`)
    }

    sourceData = parsed
  }

  function getCameraById(cameraId) {
    return cameraTracks.find((item) => item.id === cameraId)
  }

  let activeProjection = $derived(
    projections.find((projection) => projection.id === activeCameraId) ?? null
  )

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

  let activeKeyframe = $derived(getActiveKeyframe(activeProjection, currentTime))
  let activeKeyframeContext = $derived(activeKeyframe?.context ?? null)
  let activeContext = $derived(activeKeyframeContext ?? activeProjection?.context ?? null)
  const normalizedText = (value) => (typeof value === 'string' ? value.trim() : '')
  const hasRenderableContext = (value) => {
    if (typeof value === 'string') {
      return normalizedText(value).length > 0
    }

    if (value && typeof value === 'object') {
      return normalizedText(value.title).length > 0 || normalizedText(value.text).length > 0
    }

    return false
  }
  const projectionHasContext = (projection) => {
    if (!projection || typeof projection !== 'object') return false
    if (hasRenderableContext(projection.context)) return true

    if (!Array.isArray(projection.keyframes)) return false
    return projection.keyframes.some((keyframe) => hasRenderableContext(keyframe?.context))
  }

  let introText = $derived(normalizedText(ui?.context?.introText))
  let hasStoryContext = $derived(projections.some((projection) => projectionHasContext(projection)))
  let hasActiveContext = $derived(hasRenderableContext(activeContext))
  let showDescriptionPanel = $derived(
    (overviewMode && hasStoryContext && introText.length > 0) || hasActiveContext
  )

  const toAttribute = (value) => (value == null ? undefined : String(value))

  const easeInOutCubic = (value) => {
    return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2
  }

  const nextFrame = () => {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }

  const activeCameraIsVideo = () => {
    const camera = getCameraById(activeCameraId)
    return camera ? isVideoSource(camera.src) : false
  }

  const ensureFollowState = () => {
    if (!activeCameraIsVideo()) {
      followEnabled = false
    }
  }

  const setTime = (nextTime) => {
    const clamped = Math.max(0, Math.min(maxTimelineTime, nextTime))
    currentTime = clamped
  }

  const waitForProjection = (cameraId, timeoutMs = 4000) => {
    return new Promise((resolve) => {
      const start = performance.now()

      const poll = () => {
        const projection = rendererElement?.projections?.[cameraId]
        if (projection) {
          resolve(projection)
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

  const waitForCameraOperator = (timeoutMs = 4000) => {
    return new Promise((resolve) => {
      const start = performance.now()

      const poll = () => {
        const operator = rendererElement?.cameraOperator
        if (operator?.mapCamera && operator?.mapControls) {
          resolve(operator)
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

  const applyInitialOverviewCamera = async () => {
    if (!overviewMode || activeCameraId) return

    const operator = await waitForCameraOperator()
    if (!operator) return

    const points = []
    for (const projection of projections) {
      for (const keyframe of projection.keyframes ?? []) {
        const parsed = parsePosition(keyframe.position)
        if (parsed) points.push(parsed)
      }
    }

    if (points.length === 0) return

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
    const height = Math.max(80, horizontalSpan * 2 + verticalSpan * 1)
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

  const getLookTarget = (camera, distance = 16) => {
    const forward = new Vector3(0, 0, -1).applyQuaternion(camera.quaternion)
    return camera.position.clone().add(forward.multiplyScalar(distance))
  }

  const getDisplayFov = (projectionFov) => {
    const safe = Number(projectionFov)
    if (!Number.isFinite(safe)) return 88
    return Math.min(112, Math.max(78, safe + 28))
  }

  const transitionToCamera = async (cameraId, durationMs = 1800) => {
    if (!rendererElement?.cameraOperator) return

    const token = ++transitionToken
    const targetProjection = await waitForProjection(cameraId)
    if (!targetProjection || token !== transitionToken) return

    await nextFrame()
    if (token !== transitionToken) return

    const operator = rendererElement.cameraOperator
    const sourceCamera = operator.mapCamera
    const targetCamera = targetProjection.camera

    if (!sourceCamera || !targetCamera) return

    const mapControls = operator.mapControls
    const startPosition = sourceCamera.position.clone()
    const targetPosition = targetCamera.position.clone()
    const startQuaternion = sourceCamera.quaternion.clone()
    const targetQuaternion = targetCamera.quaternion.clone()
    const startFov = sourceCamera.isPerspectiveCamera ? sourceCamera.fov : null
    const targetProjectionFov = targetCamera.isPerspectiveCamera ? targetCamera.fov : startFov
    const targetFov =
      targetProjectionFov != null ? getDisplayFov(targetProjectionFov) : startFov
    const transitionDistance = startPosition.distanceTo(targetPosition)
    const farFactor = Math.min(1, Math.max(0, (transitionDistance - 24) / 90))
    const baseDuration = Math.round(durationMs * (0.5 + farFactor * 0.85))
    const durationFromDistance = Math.round(
      650 + transitionDistance * (14 + 12 * farFactor)
    )
    const effectiveDurationMs = Math.max(
      700,
      Math.min(4200, Math.max(baseDuration, durationFromDistance))
    )
    // Near hops stay almost direct; long hops get Mapbox-like flight arc over buildings.
    const flyArcHeight = Math.min(
      140,
      Math.max(0, transitionDistance * (0.05 + 0.3 * farFactor) + 10 * farFactor)
    )

    const currentControlDistance = mapControls?.target
      ? sourceCamera.position.distanceTo(mapControls.target)
      : 16
    // Preserve current orbit radius so projection-defined camera framing stays consistent.
    const desiredLookDistance = Math.max(10, currentControlDistance)

    const startLookTarget = mapControls?.target?.clone?.() ?? getLookTarget(sourceCamera, desiredLookDistance)
    const targetLookTarget = getLookTarget(targetCamera, desiredLookDistance)

    if (mapControls) {
      mapControls.enabled = false
    }

    isTransitioning = true

    await new Promise((resolve) => {
      let startTimestamp = 0

      const frame = (timestamp) => {
        if (token !== transitionToken) {
          if (mapControls) {
            mapControls.enabled = true
            mapControls.update()
          }
          resolve()
          return
        }

        if (!startTimestamp) {
          startTimestamp = timestamp
        }

        const elapsed = timestamp - startTimestamp
        const progress = Math.min(elapsed / effectiveDurationMs, 1)
        const eased = easeInOutCubic(progress)
        const blendedX = startPosition.x + (targetPosition.x - startPosition.x) * eased
        const blendedY = startPosition.y + (targetPosition.y - startPosition.y) * eased
        const blendedZ = startPosition.z + (targetPosition.z - startPosition.z) * eased
        const flightLift = Math.sin(Math.PI * eased) * flyArcHeight

        sourceCamera.position.set(blendedX, blendedY + flightLift, blendedZ)
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

        resolve()
      }

      requestAnimationFrame(frame)
    })

    if (token === transitionToken) {
      sourceCamera.position.copy(targetPosition)
      sourceCamera.quaternion.copy(targetQuaternion)

      if (sourceCamera.isPerspectiveCamera && targetFov != null) {
        sourceCamera.fov = targetFov
        sourceCamera.updateProjectionMatrix()
      }

      if (mapControls) {
        mapControls.target.copy(targetLookTarget)
        mapControls.enabled = true
        mapControls.update()
      }

      isTransitioning = false
    }
  }

  const selectCamera = (cameraId) => {
    const camera = getCameraById(cameraId)
    if (!camera) return

    overviewMode = false
    activeCameraId = camera.id
    followEnabled = isVideoSource(camera.src)
    setTime(camera.startTime ?? 0)
    ensureFollowState()

    void transitionToCamera(camera.id)
  }

  const toggleFollow = () => {
    if (!activeCameraIsVideo()) {
      followEnabled = false
      return
    }

    followEnabled = !followEnabled
    if (followEnabled) {
      void transitionToCamera(activeCameraId, 1500)
    }
  }

  onMount(async () => {
    try {
      await loadStoryFromJson()
    } catch (error) {
      console.warn('[story] Falling back to bundled story data.', error)
    }

    await import('../main.js')
    await nextFrame()
    await applyInitialOverviewCamera()
    rendererReady = true
    ensureFollowState()
  })

  $effect(() => {
    if (maxTimelineTime > 0) return
    if (isPlaying) isPlaying = false
  })

  $effect(() => {
    if (!isPlaying) return

    let animationFrame = 0
    let lastFrame = 0

    const tick = (timestamp) => {
      if (!lastFrame) {
        lastFrame = timestamp
      }

      const deltaSeconds = (timestamp - lastFrame) / 1000
      lastFrame = timestamp

      const nextTime = untrack(() => currentTime) + deltaSeconds
      currentTime = nextTime > maxTimelineTime ? 0 : nextTime

      animationFrame = requestAnimationFrame(tick)
    }

    animationFrame = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(animationFrame)
    }
  })
</script>

<svelte:head>
  <title>{ui.pageTitle}</title>
</svelte:head>

<main class="flex h-[100dvh] min-h-0 flex-col gap-1 overflow-hidden bg-[#ececec] p-1">
  <header
    class="tiny-shadow shrink-0 rounded-[var(--radius)] border border-[var(--panel-stroke)] bg-[var(--panel-fill)] px-2.5 py-1"
  >
    <h1 class="text-xs font-normal text-slate-900">{ui.header.title}</h1>
  </header>

  <div
    class={`grid min-h-0 flex-1 gap-1 ${showDescriptionPanel ? 'lg:grid-cols-[minmax(0,1fr)_220px]' : ''}`}
  >
    <section
      class="relative h-full min-h-0 overflow-hidden rounded-[var(--radius)] border border-[var(--panel-stroke)] bg-[#d7d7d7]"
    >
      {#if !rendererReady}
        <div
          class="mono absolute inset-0 z-10 grid place-items-center text-xs uppercase tracking-[0.2em] text-slate-700"
        >
          {ui.renderer.loading}
        </div>
      {/if}

      {#if showDescriptionPanel}
        <div class="lg:hidden">
          <SceneDescription
            {overviewMode}
            {activeContext}
            {introText}
            hasStoryContext={hasStoryContext}
            emptyText={ui.context.emptyText}
          />
        </div>
      {/if}

      <vantage-renderer
        bind:this={rendererElement}
        scene={sceneSrc}
        controls="move"
        first-person="false"
        follow-focus={followEnabled ? 'true' : 'false'}
        show-camera-frame={cameraFrameVisible ? 'true' : 'false'}
        style="display:block;height:100%;width:100%;pointer-events:auto"
        time={currentTime.toFixed(3)}
      >
        {#each projections as projection (projection.id)}
          <vantage-projection
            id={projection.id}
            src={projection.src}
            projection-type={projection.projectionType}
            time={toAttribute(projection.time)}
            focus={projection.cameraSelectable && !overviewMode
              ? String(projection.id === activeCameraId)
              : 'false'}
          >
            {#each projection.keyframes as keyframe, index (`${projection.id}-${index}`)}
              <vantage-keyframe
                time={toAttribute(keyframe.time)}
                position={toAttribute(keyframe.position)}
                rotation={toAttribute(keyframe.rotation)}
                fov={toAttribute(keyframe.fov)}
                far={toAttribute(keyframe.far)}
                screen={keyframe.screen ? 'true' : undefined}
                opacity={toAttribute(keyframe.opacity)}
              ></vantage-keyframe>
            {/each}
          </vantage-projection>
        {/each}
      </vantage-renderer>

      <div
        class="pointer-events-none absolute right-0 top-0 bg-white z-20 rounded-bl-[var(--radius)] bg-[var(--panel-fill)]/90 px-2 py-1 text-[11px] text-slate-600"
      >
        <span>{ui.credits.symbol}</span>

        {ui.credits.label}
      </div>

      <div class="absolute bottom-2 left-2 right-2 z-20">
        <TimelineControls
          {currentTime}
          maxTime={maxTimelineTime}
          {isPlaying}
          {followEnabled}
          showFollow={activeCameraIsVideo()}
          showFrameToggle={true}
          frameVisible={cameraFrameVisible}
          showMediaToggle={true}
          mediaOpen={mediaTimelineOpen}
          {cameraTracks}
          {activeCameraId}
          labels={ui.timeline}
          onPlayToggle={() => {
            isPlaying = !isPlaying
          }}
          onFollowToggle={toggleFollow}
          onFrameToggle={() => {
            cameraFrameVisible = !cameraFrameVisible
          }}
          onMediaToggle={() => {
            mediaTimelineOpen = !mediaTimelineOpen
          }}
          onCameraSelect={selectCamera}
          onTimeChange={setTime}
        />
      </div>
    </section>

    {#if showDescriptionPanel}
      <aside class="hidden min-h-0 lg:block">
        <SceneDescription
          {overviewMode}
          {activeContext}
          {introText}
          hasStoryContext={hasStoryContext}
          emptyText={ui.context.emptyText}
          layout="panel"
        />
      </aside>
    {/if}
  </div>
</main>
