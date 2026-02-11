<script>
  import { extractContextContent, renderContextRichText } from '$lib/contextRichText'

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
  let introHtml = $derived(renderContextRichText(intro))
  let empty = $derived(normalized(emptyText))
  let activeContent = $derived(extractContextContent(activeContext))
  let contextTitle = $derived(activeContent.title)
  let contextHtml = $derived(renderContextRichText(activeContent.body))
  let hasContext = $derived(contextTitle.length > 0 || contextHtml.length > 0)
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
      <div class={`story-richtext ${isPanelLayout ? 'text-sm' : 'text-[15px]'}`}>
        {@html introHtml}
      </div>
    {:else if hasContext}
      {#if contextTitle}
        <p class={isPanelLayout ? 'text-sm font-semibold text-slate-900' : 'font-semibold text-slate-900'}>
          {contextTitle}
        </p>
      {/if}
      {#if contextHtml}
        <div
          class={`story-richtext text-slate-700 ${isPanelLayout ? 'mt-1 text-sm' : 'mt-1 max-h-28 overflow-y-auto text-[15px]'}`}
        >
          {@html contextHtml}
        </div>
      {/if}
    {:else}
      <p class={isPanelLayout ? 'text-sm text-slate-500' : 'text-slate-500'}>{empty}</p>
    {/if}
  </section>
{/if}
