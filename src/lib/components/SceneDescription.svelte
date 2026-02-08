<script>
  let {
    visible = true,
    overviewMode = true,
    introText = '',
    hasStoryContext = false,
    activeContext = null,
    emptyText = '',
    layout = 'overlay'
  } = $props()

  const normalized = (value) => (typeof value === 'string' ? value.trim() : '')

  let intro = $derived(normalized(introText))
  let empty = $derived(normalized(emptyText))
  let contextString = $derived(typeof activeContext === 'string' ? normalized(activeContext) : '')
  let contextTitle = $derived(
    activeContext && typeof activeContext === 'object' ? normalized(activeContext.title) : ''
  )
  let contextText = $derived(
    activeContext && typeof activeContext === 'object' ? normalized(activeContext.text) : ''
  )
  let hasContext = $derived(
    contextString.length > 0 || contextTitle.length > 0 || contextText.length > 0
  )
  let isPanelLayout = $derived(layout === 'panel')
  let containerClass = $derived(
    isPanelLayout
      ? 'tiny-shadow h-full overflow-y-auto rounded-[var(--radius)] border border-[var(--panel-stroke)] bg-[var(--panel-fill)] p-2 text-slate-700'
      : 'tiny-shadow text-base absolute bg-white left-2 right-2 top-2 z-20 max-w-[640px] rounded-[var(--radius)] border border-[var(--panel-stroke)] bg-[var(--panel-fill)]/90 px-3 py-1.5 text-slate-700'
  )
  let shouldRender = $derived(
    visible &&
      ((overviewMode && hasStoryContext && intro.length > 0) ||
        (!overviewMode && (hasContext || empty.length > 0)))
  )
</script>

{#if shouldRender}
  <section class={containerClass}>
    {#if overviewMode}
      <p class={isPanelLayout ? 'text-sm font-medium text-slate-900' : 'font-medium text-slate-900'}>
        {intro}
      </p>
    {:else if contextString}
      <p
        class={isPanelLayout
          ? 'text-sm leading-snug text-slate-700'
          : 'max-h-24 overflow-y-auto leading-snug text-slate-700'}
      >
        {contextString}
      </p>
    {:else if hasContext}
      {#if contextTitle}
        <p class={isPanelLayout ? 'text-sm font-semibold text-slate-900' : 'font-semibold text-slate-900'}>
          {contextTitle}
        </p>
      {/if}
      {#if contextText}
        <p
          class={isPanelLayout
            ? 'mt-1 text-sm leading-snug text-slate-700'
            : 'max-h-20 overflow-y-auto leading-snug text-slate-700'}
        >
          {contextText}
        </p>
      {:else if contextTitle && isPanelLayout}
        <p class="mt-1 text-sm text-slate-700">{contextTitle}</p>
      {/if}
    {:else}
      <p class={isPanelLayout ? 'text-sm text-slate-500' : 'text-slate-500'}>{empty}</p>
    {/if}
  </section>
{/if}
