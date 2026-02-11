<script>
  let {
    currentTime,
    maxTime,
    isPlaying,
    autoEnabled = true,
    followEnabled = false,
    showFollow = false,
    showAutoToggle = false,
    showFrameToggle = false,
    showMediaToggle = false,
    frameVisible = false,
    mediaOpen = false,
    cameraTracks = [],
    activeCameraId = '',
    onPlayToggle,
    onAutoToggle,
    onFollowToggle,
    onFrameToggle,
    onMediaToggle,
    onCameraSelect,
    onTimeChange
  } = $props()

  let timeLabel = $state('0.00')
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
  const toFiniteNumber = (value, fallback = 0) => {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : fallback
  }

  let cameraStartMarkers = $derived.by(() => {
    const safeMax = toFiniteNumber(maxTime, 0)
    if (safeMax <= 0) return []

    return cameraTracks
      .map((camera) => {
        const startTime = clamp(toFiniteNumber(camera.startTime, 0), 0, safeMax)
        const ratio = clamp(startTime / safeMax, 0, 1)
        return {
          id: camera.id,
          label: camera.label ?? camera.id ?? 'Camera',
          startTime,
          left: `${(ratio * 100).toFixed(4)}%`
        }
      })
      .sort((a, b) => a.startTime - b.startTime)
  })
  let showTimeline = $derived(toFiniteNumber(maxTime, 0) > 0)

  $effect(() => {
    timeLabel = currentTime.toFixed(2)
  })

  const formatSeconds = (value) => {
    const safe = Number.isFinite(value) ? Math.max(0, value) : 0
    const mins = Math.floor(safe / 60)
    const secs = Math.floor(safe % 60)
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }
</script>

<div class="tiny-shadow w-full rounded-[var(--radius)] border border-[var(--panel-stroke)] bg-[var(--panel-fill)] px-1 py-0.5 backdrop-blur">
  <div class="mb-1 flex flex-wrap items-center gap-1">
    {#if showTimeline}
      <button
        type="button"
        aria-label={isPlaying ? 'Pause' : 'Play'}
        class="flex h-6 w-7 items-center justify-center rounded-[var(--radius-button)] border border-[var(--panel-stroke)] bg-white text-slate-900 transition hover:bg-slate-100"
        onclick={onPlayToggle}
      >
        {#if isPlaying}
          <svg viewBox="0 0 16 16" aria-hidden="true" class="h-3 w-3 fill-current">
            <rect x="3" y="2" width="3.5" height="12" rx="0.6"></rect>
            <rect x="9.5" y="2" width="3.5" height="12" rx="0.6"></rect>
          </svg>
        {:else}
          <svg viewBox="0 0 16 16" aria-hidden="true" class="h-3 w-3 fill-current">
            <path d="M4 2.4L13 8L4 13.6V2.4z"></path>
          </svg>
        {/if}
      </button>
    {/if}

    {#if showMediaToggle}
      <button
        type="button"
        aria-label={mediaOpen ? 'Close media timeline' : 'Open media timeline'}
        class={`flex h-6 w-7 items-center justify-center rounded-[var(--radius-button)] border text-slate-900 transition ${
          mediaOpen
            ? 'border-[var(--lime)] bg-[var(--lime)] hover:brightness-95'
            : 'border-[var(--panel-stroke)] bg-white hover:bg-slate-100'
        }`}
        onclick={onMediaToggle}
      >
        {#if mediaOpen}
          <svg viewBox="0 0 16 16" aria-hidden="true" class="h-3 w-3 fill-current">
            <path d="M3 6h10v1.8H3zM3 9.2h10V11H3z"></path>
          </svg>
        {:else}
          <svg viewBox="0 0 16 16" aria-hidden="true" class="h-3 w-3 fill-current">
            <path d="M2 3.5h12v9H2zM3.2 4.7v6.6h9.6V4.7z"></path>
          </svg>
        {/if}
      </button>
    {/if}

    {#if showFollow}
      <button
        type="button"
        class={`rounded-[var(--radius-button)] px-2 py-0.5 text-[11px] font-semibold transition ${
          followEnabled
            ? 'bg-[var(--lime)] text-slate-950 hover:brightness-95'
            : 'border border-[var(--panel-stroke)] bg-white text-slate-700 hover:bg-slate-100'
        }`}
        onclick={onFollowToggle}
      >
        Follow
      </button>
    {/if}

    {#if showAutoToggle}
      <button
        type="button"
        class={`rounded-[var(--radius-button)] px-2 py-0.5 text-[11px] font-semibold transition ${
          autoEnabled
            ? 'bg-[var(--lime)] text-slate-950 hover:brightness-95'
            : 'border border-[var(--panel-stroke)] bg-white text-slate-700 hover:bg-slate-100'
        }`}
        onclick={onAutoToggle}
      >
        Auto Play
      </button>
    {/if}

    <!-- {#if showFrameToggle}
      <button
        type="button"
        class={`rounded-[var(--radius-button)] px-2 py-0.5 text-[11px] font-semibold transition ${
          frameVisible
            ? 'bg-[var(--lime)] text-slate-950 hover:brightness-95'
            : 'border border-[var(--panel-stroke)] bg-white text-slate-700 hover:bg-slate-100'
        }`}
        onclick={onFrameToggle}
      >
        Frame
      </button>
    {/if} -->

    {#if showTimeline}
      <p class="mono ml-auto text-[10px] uppercase tracking-[0.14em] text-slate-600">{timeLabel}s / {maxTime}s</p>
    {/if}
  </div>

  {#if showTimeline}
    <div class="relative h-5">
      <input
        type="range"
        min="0"
        max={maxTime}
        step="0.04"
        value={currentTime}
        class="absolute inset-x-0 top-1/2 z-10 m-0 h-1 w-full -translate-y-1/2 cursor-pointer appearance-none rounded-full bg-slate-300 accent-[var(--lime)]"
        oninput={(event) => onTimeChange(parseFloat(event.currentTarget.value))}
      />

      {#if cameraStartMarkers.length > 0}
        <div class="pointer-events-none absolute inset-0 z-20">
          {#each cameraStartMarkers as marker (marker.id)}
            <button
              type="button"
              class="pointer-events-auto absolute top-1/2 grid h-5 w-5 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-transparent transition hover:scale-110 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[var(--lime)]"
              style:left={marker.left}
              onclick={() => onCameraSelect?.(marker.id)}
              aria-label={`Go to ${marker.label} at ${formatSeconds(marker.startTime)}`}
              title={`${marker.label} (${formatSeconds(marker.startTime)})`}
            >
              <span
                class={`block h-2 w-2 rotate-45 border ${
                  marker.id === activeCameraId
                    ? 'border-slate-900 bg-[var(--lime)]'
                    : 'border-[var(--lime)] bg-[var(--panel-fill)]'
                }`}
                aria-hidden="true"
              ></span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
  {/if}

  {#if mediaOpen && cameraTracks.length > 0}
    <div class="mt-1.5 overflow-x-auto pb-0.5">
      <div class="flex min-w-max gap-2">
        {#each cameraTracks as camera (camera.id)}
          <button
            type="button"
            class={`flex w-28 shrink-0 flex-col rounded-[var(--radius-button)] border bg-white text-left ${
              camera.id === activeCameraId
                ? 'border-[var(--lime)] ring-1 ring-[var(--lime)]'
                : 'border-[var(--panel-stroke)]'
            }`}
            onclick={() => onCameraSelect?.(camera.id)}
          >
            <img
              src={camera.previewSrc ?? camera.src}
              alt={camera.label}
              class="h-16 w-full rounded-t-[var(--radius-button)] object-cover"
            />
            <div class="px-1.5 py-1">
              <p class="truncate text-[10px] text-slate-800">{camera.label}</p>
              {#if showTimeline}
                <p class="mono text-[10px] text-slate-600">{formatSeconds(camera.startTime)}</p>
              {/if}
            </div>
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>
