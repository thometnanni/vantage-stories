<script>
  import { base } from '$app/paths'
  import { onMount, untrack } from 'svelte'
  import SceneDescription from '$lib/components/SceneDescription.svelte'
  import TimelineControls from '$lib/components/TimelineControls.svelte'
  import { nextFrame } from '$lib/cameraTransition'
  import { hasRenderableContext as contextHasRenderableContent } from '$lib/contextRichText'
  import data from '$lib/data'
  import { isVideoSource, resolveStoryData } from '$lib/story/core/storyData'
  import {
    clampTimelineTime,
    getActiveContext,
    getActiveProjection,
    getCameraById,
    getCameraForTime,
    getNextCameraInLoop,
    storyHasContext
  } from '$lib/story/core/projectionLibrary'
  import {
    mapCameraTracksWithBase,
    mapProjectionAssetsWithBase,
    withBasePath
  } from '$lib/story/runtime/assetPaths'
  import { loadStoryFromPath } from '$lib/story/runtime/storySource'
  import { createStoryCameraBridge } from '$lib/story/three/storyCameraBridge'

  let { storyPath = '' } = $props()

  let sourceData = $state(data)
  let starter = $derived(resolveStoryData(sourceData))
  let sceneSrc = $derived(starter.sceneSrc)
  let maxTimelineTime = $derived(starter.maxTimelineTime)
  let projections = $derived(starter.projections)
  let cameraTracks = $derived(starter.cameraTracks)
  let ui = $derived(starter.ui)
  let resolvedStoryPath = $derived(withBasePath(storyPath, base))
  let displaySceneSrc = $derived(withBasePath(sceneSrc, base))
  let displayProjections = $derived(mapProjectionAssetsWithBase(projections, base))
  let displayCameraTracks = $derived(mapCameraTracksWithBase(cameraTracks, base))

  let rendererReady = $state(false)
  let currentTime = $state(0)
  let isPlaying = $state(false)
  let autoTransitionEnabled = $state(true)
  let overviewMode = $state(true)
  let cameraFrameVisible = $state(false)
  let mediaTimelineOpen = $state(true)
  let followEnabled = $state(false)
  let activeCameraId = $state('')
  let autoPlaybackStarted = $state(false)

  let rendererElement
  const AUTO_CAMERA_DWELL_MS = 8000
  const normalizedText = (value) => (typeof value === 'string' ? value.trim() : '')
  const toAttribute = (value) => (value == null ? undefined : String(value))

  const cameraBridge = createStoryCameraBridge({
    getRendererElement: () => rendererElement
  })

  const loadStoryFromJson = async () => {
    const parsed = await loadStoryFromPath(resolvedStoryPath)
    if (parsed) sourceData = parsed
  }
  let activeProjection = $derived(getActiveProjection(projections, activeCameraId))
  let activeContext = $derived(getActiveContext(activeProjection, currentTime))
  let introText = $derived(normalizedText(ui?.context?.introText))
  let hasStoryContext = $derived(storyHasContext(projections, contextHasRenderableContent))
  let hasActiveContext = $derived(contextHasRenderableContent(activeContext))
  let showDescriptionPanel = $derived(
    (overviewMode && hasStoryContext && introText.length > 0) || hasActiveContext
  )

  const activeCameraIsVideo = () => {
    const camera = getCameraById(cameraTracks, activeCameraId)
    return camera ? isVideoSource(camera.src) : false
  }

  const ensureFollowState = () => {
    if (!activeCameraIsVideo()) {
      followEnabled = false
    }
  }

  const setTime = (nextTime) => {
    const clamped = clampTimelineTime(nextTime, maxTimelineTime)
    currentTime = clamped
    if (!isPlaying && autoTransitionEnabled) {
      syncAutoCameraForTime(clamped, 900)
    }
  }

  const transitionToCamera = async (cameraId, durationMs = 1800) => {
    await cameraBridge.transitionToCamera(cameraId, durationMs)
  }

  const selectCamera = (
    cameraId,
    { setTimeline = true, transitionDurationMs = 1800 } = {}
  ) => {
    const camera = getCameraById(cameraTracks, cameraId)
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
    const targetCamera = getCameraForTime(cameraTracks, timelineTime)
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

    await import('../../main.js')
    await nextFrame()
    await cameraBridge.applyInitialOverviewCamera({
      projections,
      overviewMode,
      activeCameraId
    })
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
      const nextCamera = getNextCameraInLoop(cameraTracks, untrack(() => activeCameraId))
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
        scene={displaySceneSrc}
        controls="move"
        first-person="false"
        follow-focus={followEnabled ? 'true' : 'false'}
        show-camera-frame={cameraFrameVisible ? 'true' : 'false'}
        style="display:block;height:100%;width:100%;pointer-events:auto"
        time={currentTime.toFixed(3)}
      >
        {#each displayProjections as projection (projection.id)}
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
          cameraTracks={displayCameraTracks}
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
