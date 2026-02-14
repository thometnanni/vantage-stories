<script>
  import { base } from '$app/paths'
  import { onMount, tick } from 'svelte'
  import Footer from '$lib/components/Footer.svelte'
  import Header from '$lib/components/Header.svelte'
  import SceneContext from '$lib/components/SceneContext.svelte'
  import { renderContextRichText } from '$lib/contextRichText'
  import data from '$lib/data'
  import { resolveStoryData } from '$lib/story/core/storyData'
  import { mapProjectionAssetsWithBase, withBasePath } from '$lib/story/runtime/assetPaths'
  import { loadStoryFromPath } from '$lib/story/runtime/storySource'

  let { storyPath = '' } = $props()

  let sourceData = $state(data)
  let starter = $derived(resolveStoryData(sourceData))
  let ui = $derived(starter.ui)
  let sceneSrc = $derived(starter.sceneSrc)
  let projections = $derived(Array.isArray(starter.projections) ? starter.projections : [])
  let cameraPathProjection = $derived(starter.cameraPathProjection)
  let cameraPathProjectionId = $derived(cameraPathProjection?.id ?? '')
  let cameraPathRange = $derived(starter.cameraPathRange ?? { start: 0, end: 1, duration: 1 })
  let cameraControl = $derived(starter.cameraControl ?? { mode: 'scrub', durationMs: 900, easing: 'easeInOutCubic' })
  let cameraControlMode = $derived(cameraControl.mode === 'triggered' ? 'triggered' : 'scrub')
  let cameraTransitionDuration = $derived(Math.max(120, Number(cameraControl.durationMs) || 900))
  let cameraTransitionEasing = $derived(
    typeof cameraControl.easing === 'string' && cameraControl.easing.trim().length > 0
      ? cameraControl.easing
      : 'linear'
  )
  let narrativeMoments = $derived(
    Array.isArray(starter.narrativeMoments) ? starter.narrativeMoments : []
  )

  let resolvedStoryPath = $derived(withBasePath(storyPath, base))
  let displaySceneSrc = $derived(withBasePath(sceneSrc, base))
  let displayProjections = $derived(mapProjectionAssetsWithBase(projections, base))
  let displaySyntheticPathProjection = $derived.by(() => {
    if (!cameraPathProjection) return []
    const alreadyInStory = projections.some(
      (projection) => projection.id === cameraPathProjection.id
    )
    if (alreadyInStory) return []
    return mapProjectionAssetsWithBase([cameraPathProjection], base)
  })
  let rendererProjections = $derived.by(() => [
    ...displayProjections,
    ...displaySyntheticPathProjection
  ])
  let focusProjectionId = $derived.by(() => {
    if (cameraPathProjectionId.length > 0) return cameraPathProjectionId
    const firstPerspective = rendererProjections.find(
      (projection) => projection.projectionType === 'perspective'
    )
    return firstPerspective?.id ?? rendererProjections[0]?.id ?? ''
  })

  let rendererReady = $state(false)
  let currentTime = $state(0)
  let scrollProgress = $state(0)
  let triggeredStepIndex = $state(0)
  let triggeredDesiredStepIndex = $state(0)
  let triggeredTargetStepIndex = $state(0)
  let triggeredAnimating = $state(false)
  let transitionRaf = 0

  let scrollTrack
  let timelineTrack = $state(null)
  let scrollRaf = 0

  const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '')
  const toAttribute = (value) => (value == null ? undefined : String(value))
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
  const toPositiveNumber = (value, fallback = 0) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }
  const easeLinear = (value) => value
  const easeInOutCubic = (value) =>
    value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2
  const easeOutCubic = (value) => 1 - Math.pow(1 - value, 3)
  const getEasingFn = (name) => {
    const normalized = normalizeText(name).toLowerCase()
    if (normalized === 'linear') return easeLinear
    if (normalized === 'easeoutcubic' || normalized === 'out') return easeOutCubic
    return easeInOutCubic
  }
  let theme = $derived(ui.theme ?? {})

  const uniqueSortedTimes = (values) => {
    const unique = new Set()
    return values
      .filter((time) => Number.isFinite(time))
      .sort((a, b) => a - b)
      .filter((time) => {
        const key = time.toFixed(6)
        if (unique.has(key)) return false
        unique.add(key)
        return true
      })
  }

  let keyframeStepTimes = $derived.by(() => {
    const times = Array.isArray(cameraPathProjection?.keyframes)
      ? cameraPathProjection.keyframes
          .map((keyframe) => Number(keyframe?.time))
          .filter((time) => Number.isFinite(time))
      : []

    return uniqueSortedTimes(times)
  })

  let narrativeStepTimes = $derived.by(() => {
    const times = Array.isArray(narrativeMoments)
      ? narrativeMoments
          .map((moment) => {
            const title = normalizeText(moment?.context?.title)
            const markdown = normalizeText(moment?.context?.markdown)
            return title.length > 0 || markdown.length > 0 ? Number(moment?.time) : Number.NaN
          })
          .filter((time) => Number.isFinite(time))
      : []

    return uniqueSortedTimes(times)
  })

  let cameraStepTimes = $derived.by(() => {
    if (cameraControlMode === 'triggered' && narrativeStepTimes.length >= 2) {
      return narrativeStepTimes
    }

    const times = keyframeStepTimes
    if (times.length > 0) return times
    return [cameraPathRange.start, cameraPathRange.end]
  })

  let cameraSetupKey = $derived.by(() => {
    const times = Array.isArray(cameraStepTimes) ? cameraStepTimes.map((value) => Number(value).toFixed(6)).join(',') : ''
    return [
      cameraControlMode,
      cameraPathProjectionId,
      Number(cameraPathRange.start).toFixed(6),
      Number(cameraPathRange.end).toFixed(6),
      times
    ].join('|')
  })
  let appliedCameraSetupKey = $state('')

  let scrollTimingPoints = $derived.by(() => {
    const keyframes = Array.isArray(cameraPathProjection?.keyframes)
      ? [...cameraPathProjection.keyframes]
          .map((keyframe) => ({
            time: Number(keyframe?.time),
            scrollWeight: toPositiveNumber(keyframe?.scrollWeight, 1),
            pause: toPositiveNumber(keyframe?.pause, 0)
          }))
          .filter((keyframe) => Number.isFinite(keyframe.time))
          .sort((a, b) => a.time - b.time)
      : []

    if (keyframes.length === 0) {
      return [
        { progress: 0, time: cameraPathRange.start },
        { progress: 1, time: cameraPathRange.end }
      ]
    }

    if (keyframes.length === 1) {
      return [
        { progress: 0, time: keyframes[0].time },
        { progress: 1, time: keyframes[0].time }
      ]
    }

    const weightedPoints = [{ weight: 0, time: keyframes[0].time }]
    let totalWeight = 0

    for (let index = 0; index < keyframes.length; index += 1) {
      const keyframe = keyframes[index]

      if (keyframe.pause > 0) {
        totalWeight += keyframe.pause
        weightedPoints.push({ weight: totalWeight, time: keyframe.time })
      }

      const next = keyframes[index + 1]
      if (!next) continue

      totalWeight += keyframe.scrollWeight
      weightedPoints.push({ weight: totalWeight, time: next.time })
    }

    if (totalWeight <= 1e-6) {
      return [
        { progress: 0, time: keyframes[0].time },
        { progress: 1, time: keyframes[keyframes.length - 1].time }
      ]
    }

    const points = weightedPoints.map((point) => ({
      progress: point.weight / totalWeight,
      time: point.time
    }))

    points[0].progress = 0
    points[points.length - 1].progress = 1
    return points
  })

  const timeFromScrollProgress = (progress) => {
    const points = scrollTimingPoints
    if (!Array.isArray(points) || points.length === 0) {
      return cameraPathRange.start + clamp(progress, 0, 1) * cameraPathRange.duration
    }

    const value = clamp(progress, 0, 1)
    if (value <= points[0].progress) return points[0].time
    if (value >= points[points.length - 1].progress) return points[points.length - 1].time

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index]
      const end = points[index + 1]
      if (value >= start.progress && value <= end.progress) {
        const span = Math.max(1e-6, end.progress - start.progress)
        const t = (value - start.progress) / span
        return start.time + t * (end.time - start.time)
      }
    }

    return points[points.length - 1].time
  }

  const scrollProgressFromTime = (time) => {
    const points = scrollTimingPoints
    const targetTime = Number(time)

    if (!Number.isFinite(targetTime)) return 0

    if (!Array.isArray(points) || points.length === 0) {
      return clamp((targetTime - cameraPathRange.start) / cameraPathRange.duration, 0, 1)
    }

    if (targetTime <= points[0].time) return points[0].progress
    if (targetTime >= points[points.length - 1].time) return points[points.length - 1].progress

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index]
      const end = points[index + 1]
      const minTime = Math.min(start.time, end.time)
      const maxTime = Math.max(start.time, end.time)
      if (targetTime < minTime || targetTime > maxTime) continue
      if (Math.abs(end.time - start.time) <= 1e-6) return start.progress

      const t = (targetTime - start.time) / (end.time - start.time)
      return clamp(start.progress + t * (end.progress - start.progress), 0, 1)
    }

    return points[points.length - 1].progress
  }

  let cameraStepProgresses = $derived.by(() =>
    cameraStepTimes.map((time) => scrollProgressFromTime(time))
  )

  let cameraStepBoundaries = $derived.by(() => {
    const progresses = cameraStepProgresses
    if (!Array.isArray(progresses) || progresses.length <= 1) return []

    const boundaries = []
    for (let index = 0; index < progresses.length - 1; index += 1) {
      boundaries.push((progresses[index] + progresses[index + 1]) * 0.5)
    }
    return boundaries
  })

  const cancelTriggeredTransitionFrame = () => {
    if (transitionRaf) {
      cancelAnimationFrame(transitionRaf)
      transitionRaf = 0
    }
  }

  const stopTriggeredTransition = () => {
    cancelTriggeredTransitionFrame()
    triggeredAnimating = false
  }

  const animateToTime = (targetTime, onComplete) => {
    if (!Number.isFinite(targetTime)) return
    const startTime = Number(currentTime)
    if (!Number.isFinite(startTime) || Math.abs(targetTime - startTime) <= 1e-6) {
      currentTime = targetTime
      onComplete?.()
      return
    }

    // Cancel only the previous RAF; keep animation state ownership to the caller.
    cancelTriggeredTransitionFrame()

    const stepCount = Math.max(1, cameraStepTimes.length - 1)
    const averageStepSpan = Math.max(1e-6, cameraPathRange.duration / stepCount)
    const jumpFactor = clamp(Math.abs(targetTime - startTime) / averageStepSpan, 0.75, 2.5)
    const duration = Math.max(1, cameraTransitionDuration * jumpFactor)
    const easing = getEasingFn(cameraTransitionEasing)
    const startAt = performance.now()

    const step = () => {
      const elapsed = performance.now() - startAt
      const progress = clamp(elapsed / duration, 0, 1)
      const eased = easing(progress)
      currentTime = startTime + (targetTime - startTime) * eased

      if (progress >= 1) {
        currentTime = targetTime
        transitionRaf = 0
        onComplete?.()
        return
      }
      transitionRaf = requestAnimationFrame(step)
    }

    transitionRaf = requestAnimationFrame(step)
  }

  const stepIndexFromProgress = (progress) => {
    const boundaries = cameraStepBoundaries
    const steps = cameraStepTimes
    if (!Array.isArray(steps) || steps.length <= 1 || !Array.isArray(boundaries)) return 0

    const clampedProgress = clamp(progress, 0, 1)
    for (let index = 0; index < boundaries.length; index += 1) {
      if (clampedProgress < boundaries[index]) return index
    }
    return steps.length - 1
  }

  const requestTriggeredStep = (index) => {
    const steps = cameraStepTimes
    if (!Array.isArray(steps) || steps.length === 0) return

    const clampedIndex = clamp(Math.round(index), 0, steps.length - 1)
    triggeredDesiredStepIndex = clampedIndex

    if (clampedIndex === triggeredStepIndex && !triggeredAnimating) return
    if (triggeredAnimating && clampedIndex === triggeredTargetStepIndex) return

    triggeredTargetStepIndex = clampedIndex
    const target = Number(steps[clampedIndex])
    if (!Number.isFinite(target)) return

    triggeredAnimating = true
    animateToTime(target, () => {
      triggeredStepIndex = clampedIndex
      triggeredTargetStepIndex = clampedIndex
      triggeredAnimating = false
      if (triggeredDesiredStepIndex !== triggeredStepIndex) {
        requestTriggeredStep(triggeredDesiredStepIndex)
      }
    })
  }

  const applyProgressToCamera = (progress) => {
    const clampedProgress = clamp(progress, 0, 1)
    scrollProgress = clampedProgress

    if (cameraControlMode === 'triggered') {
      const steps = cameraStepTimes
      if (!Array.isArray(steps) || steps.length === 0) return

      const nextStepIndex = stepIndexFromProgress(clampedProgress)
      requestTriggeredStep(nextStepIndex)
      return
    }

    currentTime = timeFromScrollProgress(clampedProgress)
  }

  let visualProgress = $derived.by(() => {
    if (cameraControlMode === 'triggered') {
      return scrollProgressFromTime(currentTime)
    }
    return scrollProgress
  })

  let introText = $derived.by(() => {
    const contextIntro = normalizeText(ui?.context?.introText)
    if (contextIntro.length > 0) return contextIntro
    return normalizeText(ui?.header?.description)
  })
  let introHtml = $derived(renderContextRichText(introText))
  let introVisible = $derived(introText.length > 0)

  let moments = $derived.by(() => {
    return narrativeMoments.map((moment, index) => {
      const title = normalizeText(moment?.context?.title)
      const markdown = normalizeText(moment?.context?.markdown)
      const html = markdown.length > 0 ? renderContextRichText(markdown) : ''
      const hasContent = title.length > 0 || html.length > 0
      return {
        id: moment?.id ?? `moment-${index + 1}`,
        time: Number(moment?.time) || 0,
        progress: scrollProgressFromTime(Number(moment?.time)),
        title,
        html,
        hasContent
      }
    })
  })

  let sortedMoments = $derived.by(() =>
    [...moments].sort((a, b) => {
      const byProgress = a.progress - b.progress
      if (Math.abs(byProgress) > 1e-6) return byProgress
      return a.time - b.time
    })
  )

  let momentLayouts = $derived.by(() => {
    if (sortedMoments.length === 0) return []

    if (sortedMoments.length === 1) {
      return [{ moment: sortedMoments[0], heightVh: 120 }]
    }

    const TOTAL_SPAN_VH = 560
    const progresses = sortedMoments.map((moment) => clamp(moment.progress, 0, 1))
    const bounds = [0]

    for (let index = 1; index < progresses.length; index += 1) {
      bounds.push((progresses[index - 1] + progresses[index]) / 2)
    }
    bounds.push(1)

    return sortedMoments.map((moment, index) => {
      const slice = Math.max(0.03, bounds[index + 1] - bounds[index])
      return {
        moment,
        heightVh: Math.max(44, slice * TOTAL_SPAN_VH)
      }
    })
  })

  let activeMomentId = $derived.by(() => {
    if (sortedMoments.length === 0) return ''
    let active = sortedMoments[0]
    for (const moment of sortedMoments) {
      if (moment.progress <= visualProgress + 1e-6) {
        active = moment
      } else {
        break
      }
    }
    return active.id
  })

  const loadStoryFromJson = async () => {
    const parsed = await loadStoryFromPath(resolvedStoryPath)
    if (parsed) sourceData = parsed
  }

  const getTimelineProgress = (centerY) => {
    if (!timelineTrack || sortedMoments.length === 0) return null

    const sections = Array.from(timelineTrack.children).filter((element) => element instanceof HTMLElement)
    const anchors = sections
      .map((section, index) => {
        const moment = sortedMoments[index]
        if (!moment) return null
        const rect = section.getBoundingClientRect()
        return {
          center: window.scrollY + rect.top + rect.height * 0.5,
          progress: moment.progress
        }
      })
      .filter(Boolean)

    const sceneTop = scrollTrack?.offsetTop ?? 0
    const sceneStartCenter = sceneTop + window.innerHeight * 0.5
    const sceneEndCenter =
      sceneTop + (scrollTrack?.offsetHeight ?? window.innerHeight) - window.innerHeight * 0.5

    const controls = [
      { center: sceneStartCenter, progress: 0 },
      ...anchors,
      {
        center: Math.max(sceneStartCenter + 1, sceneEndCenter),
        progress: 1
      }
    ]

    if (controls.length <= 1) return null

    for (let index = 1; index < controls.length; index += 1) {
      if (controls[index].center <= controls[index - 1].center) {
        controls[index].center = controls[index - 1].center + 1
      }
    }

    if (centerY <= controls[0].center) return controls[0].progress
    if (centerY >= controls[controls.length - 1].center) return controls[controls.length - 1].progress

    for (let index = 0; index < controls.length - 1; index += 1) {
      const start = controls[index]
      const end = controls[index + 1]
      if (centerY >= start.center && centerY <= end.center) {
        const span = Math.max(1e-6, end.center - start.center)
        const t = (centerY - start.center) / span
        return start.progress + t * (end.progress - start.progress)
      }
    }

    return controls[0].progress
  }

  const syncFromScroll = () => {
    if (typeof window === 'undefined') return

    const centerY = window.scrollY + window.innerHeight * 0.5
    const timelineProgress = getTimelineProgress(centerY)
    if (timelineProgress != null) {
      applyProgressToCamera(timelineProgress)
      return
    }

    if (!scrollTrack) return

    const rootTop = scrollTrack.offsetTop
    const maxScroll = Math.max(1, scrollTrack.offsetHeight - window.innerHeight)
    const rawProgress = (window.scrollY - rootTop) / maxScroll
    applyProgressToCamera(rawProgress)
  }

  const scheduleScrollSync = () => {
    if (scrollRaf || typeof window === 'undefined') return
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0
      syncFromScroll()
    })
  }

  onMount(async () => {
    try {
      await loadStoryFromJson()
    } catch (error) {
      console.warn('[story] Falling back to bundled story data.', error)
    }

    await import('../../main.js')

    rendererReady = true
    await tick()
    syncFromScroll()

    window.addEventListener('scroll', scheduleScrollSync, { passive: true })
    window.addEventListener('resize', scheduleScrollSync, { passive: true })

    return () => {
      stopTriggeredTransition()
      if (scrollRaf) {
        cancelAnimationFrame(scrollRaf)
        scrollRaf = 0
      }
      window.removeEventListener('scroll', scheduleScrollSync)
      window.removeEventListener('resize', scheduleScrollSync)
    }
  })

  $effect(() => {
    const setupKey = cameraSetupKey
    cameraPathRange
    cameraStepTimes
    cameraControlMode
    if (!rendererReady) {
      stopTriggeredTransition()
      triggeredStepIndex = 0
      triggeredDesiredStepIndex = 0
      triggeredTargetStepIndex = 0
      currentTime =
        cameraControlMode === 'triggered'
          ? Number(cameraStepTimes[0] ?? cameraPathRange.start)
          : cameraPathRange.start
      scrollProgress = 0
      appliedCameraSetupKey = ''
      return
    }

    if (appliedCameraSetupKey === setupKey) return
    appliedCameraSetupKey = setupKey

    stopTriggeredTransition()
    triggeredStepIndex = 0
    triggeredDesiredStepIndex = 0
    triggeredTargetStepIndex = 0
    if (cameraControlMode === 'triggered') {
      currentTime = Number(cameraStepTimes[triggeredStepIndex] ?? cameraPathRange.start)
    } else {
      currentTime = cameraPathRange.start
    }
    scheduleScrollSync()
  })
</script>

<svelte:head>
  <title>{ui.pageTitle}</title>
</svelte:head>

<main
  class="relative bg-[var(--story-page-bg)] text-[var(--story-text)]"
  style={`--story-page-bg:${theme.pageBg};--story-scene-bg:${theme.sceneBg};--story-panel-fill:${theme.panelFill};--story-panel-stroke:${theme.panelStroke};--story-text:${theme.text};--story-muted-text:${theme.mutedText};--story-accent:${theme.accent};--story-context-bg:${theme.contextBg};--story-context-text:${theme.contextText};--story-context-muted:${theme.contextMuted};`}
>
  <div>
    <Header title={ui.header.title} {introVisible} {introHtml} />
  </div>

  <section bind:this={scrollTrack} class="relative">
    <div class="sticky top-0 h-[100dvh] overflow-hidden bg-[var(--story-scene-bg)]">
      {#if !rendererReady}
        <div
          class="mono absolute inset-0 z-20 grid place-items-center text-xs uppercase tracking-[0.2em] text-[var(--story-muted-text)]"
        >
          {ui.renderer.loading}
        </div>
      {/if}

      <vantage-renderer
        scene={displaySceneSrc}
        controls="false"
        first-person="false"
        follow-focus="true"
        show-camera-frame="false"
        background-color={theme.sceneBg}
        style="display:block;height:100%;width:100%;pointer-events:none;touch-action:none"
        time={currentTime.toFixed(4)}
      >
        {#each rendererProjections as projection (projection.id)}
          <vantage-projection
            id={projection.id}
            src={projection.src}
            projection-type={projection.projectionType}
            time={toAttribute(projection.time)}
            focus={projection.id === focusProjectionId ? 'true' : 'false'}
          >
            {#each projection.keyframes as keyframe, index (`${projection.id}-${index}`)}
              <vantage-keyframe
                time={toAttribute(keyframe.time)}
                position={toAttribute(keyframe.position)}
                rotation={toAttribute(keyframe.rotation)}
                fov={toAttribute(keyframe.fov)}
                far={toAttribute(keyframe.far)}
                opacity={toAttribute(keyframe.opacity)}
                screen={keyframe.screen === true ? '' : undefined}
              ></vantage-keyframe>
            {/each}
          </vantage-projection>
        {/each}
      </vantage-renderer>
    </div>

    <div class="relative z-20 -mt-[100dvh]">
      {#if momentLayouts.length > 0}
        <div bind:this={timelineTrack}>
          {#each momentLayouts as entry (entry.moment.id)}
            <SceneContext
              moment={entry.moment}
              active={entry.moment.id === activeMomentId}
              heightVh={entry.heightVh}
            />
          {/each}
        </div>
      {:else}
        <section class="min-h-[100dvh]"></section>
      {/if}

      <section class="h-[20dvh]"></section>
    </div>
  </section>

  <Footer credits={ui.credits} />
</main>
