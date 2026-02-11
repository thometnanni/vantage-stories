<script>
  import { onMount, untrack } from 'svelte'
  import { Vector3 } from 'three'
  import SceneDescription from '$lib/components/SceneDescription.svelte'
  import TimelineControls from '$lib/components/TimelineControls.svelte'
  import {
    buildCurvedTransitionCurve,
    getDisplayFov,
    getLookTarget,
    getTransitionProfile,
    nextFrame,
    runCurvedTransition
  } from '$lib/cameraTransition'
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
  let autoTransitionEnabled = $state(true)
  let overviewMode = $state(true)
  let cameraFrameVisible = $state(false)
  let mediaTimelineOpen = $state(true)
  let followEnabled = $state(false)
  let activeCameraId = $state('')
  let autoPlaybackStarted = $state(false)

  let rendererElement
  let transitionToken = 0
  const AUTO_CAMERA_DWELL_MS = 4500

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

  const getCameraForTime = (timelineTime) => {
    if (cameraTracks.length === 0) return null

    const safeTime = Number.isFinite(timelineTime) ? Math.max(0, timelineTime) : 0
    let selected = cameraTracks[0]
    let selectedStartTime = Number(selected?.startTime) || 0
    for (const camera of cameraTracks) {
      const cameraStartTime = Number(camera.startTime) || 0
      if (cameraStartTime > safeTime) {
        break
      }
      if (cameraStartTime > selectedStartTime) {
        selected = camera
        selectedStartTime = cameraStartTime
      }
    }

    return selected
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
    if (!isPlaying && autoTransitionEnabled) {
      syncAutoCameraForTime(clamped, 900)
    }
  }

  const waitFor = (resolver, predicate = Boolean, timeoutMs = 4000) => {
    return new Promise((resolve) => {
      const start = performance.now()

      const poll = () => {
        const candidate = resolver()
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

  const waitForProjection = (cameraId, timeoutMs = 4000) => {
    return waitFor(() => rendererElement?.projections?.[cameraId], Boolean, timeoutMs)
  }

  const waitForCameraOperator = (timeoutMs = 4000) => {
    return waitFor(
      () => rendererElement?.cameraOperator,
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

    const startLookTarget = mapControls?.target?.clone?.() ?? getLookTarget(sourceCamera, desiredLookDistance)
    const targetLookTarget = getLookTarget(targetCamera, desiredLookDistance)

    if (mapControls) {
      mapControls.enabled = false
    }

    isTransitioning = true
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
        mapControls.enabled = true
        mapControls.update()
      }

      isTransitioning = false
      return
    }

    if (mapControls) {
      mapControls.enabled = true
      mapControls.update()
    }
    isTransitioning = false
  }

  const selectCamera = (
    cameraId,
    { setTimeline = true, transitionDurationMs = 1800 } = {}
  ) => {
    const camera = getCameraById(cameraId)
    if (!camera) return

    overviewMode = false
    activeCameraId = camera.id
    followEnabled = isVideoSource(camera.src)
    if (setTimeline) {
      setTime(camera.startTime ?? 0)
    }
    ensureFollowState()

    void transitionToCamera(camera.id, transitionDurationMs)
  }

  const syncAutoCameraForTime = (timelineTime, transitionDurationMs = 1200) => {
    if (!autoTransitionEnabled) return
    const targetCamera = getCameraForTime(timelineTime)
    if (!targetCamera || targetCamera.id === activeCameraId) return
    selectCamera(targetCamera.id, { setTimeline: false, transitionDurationMs })
  }

  const toggleAutoTransition = () => {
    autoTransitionEnabled = !autoTransitionEnabled
    if (autoTransitionEnabled) {
      syncAutoCameraForTime(currentTime, 900)
    }
  }

  const togglePlayback = () => {
    if (isPlaying) {
      isPlaying = false
      return
    }

    if (autoTransitionEnabled) {
      if (maxTimelineTime > 0) {
        syncAutoCameraForTime(currentTime, 1000)
      } else if (!activeCameraId && cameraTracks.length > 0) {
        selectCamera(cameraTracks[0].id, { setTimeline: false, transitionDurationMs: 1000 })
      }
    }
    isPlaying = true
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
    if (maxTimelineTime > 0 || cameraTracks.length > 1) return
    if (isPlaying) isPlaying = false
  })

  $effect(() => {
    if (!rendererReady || autoPlaybackStarted || !autoTransitionEnabled) return
    if (cameraTracks.length === 0) return

    autoPlaybackStarted = true
    if (maxTimelineTime > 0) {
      setTime(0)
      syncAutoCameraForTime(0, 1300)
    } else {
      selectCamera(cameraTracks[0].id, { setTimeline: false, transitionDurationMs: 1300 })
    }
    isPlaying = true
  })

  $effect(() => {
    if (!isPlaying || !autoTransitionEnabled || cameraTracks.length === 0) return
    if (maxTimelineTime <= 0) return
    syncAutoCameraForTime(currentTime)
  })

  $effect(() => {
    if (!isPlaying || !autoTransitionEnabled) return
    if (maxTimelineTime > 0 || cameraTracks.length < 2) return

    const interval = setInterval(() => {
      const activeIndex = untrack(() =>
        cameraTracks.findIndex((camera) => camera.id === activeCameraId)
      )
      const nextIndex = activeIndex >= 0 ? (activeIndex + 1) % cameraTracks.length : 0
      const nextCamera = cameraTracks[nextIndex]
      if (!nextCamera) return
      selectCamera(nextCamera.id, { setTimeline: false, transitionDurationMs: 1200 })
    }, AUTO_CAMERA_DWELL_MS)

    return () => {
      clearInterval(interval)
    }
  })

  $effect(() => {
    if (!isPlaying || maxTimelineTime <= 0) return

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
          autoEnabled={autoTransitionEnabled}
          {followEnabled}
          showAutoToggle={cameraTracks.length > 1}
          showFollow={activeCameraIsVideo()}
          showFrameToggle={true}
          frameVisible={cameraFrameVisible}
          showMediaToggle={true}
          mediaOpen={mediaTimelineOpen}
          {cameraTracks}
          {activeCameraId}
          onPlayToggle={togglePlayback}
          onAutoToggle={toggleAutoTransition}
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
