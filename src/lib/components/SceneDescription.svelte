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
  let shouldRender = $derived(
    visible &&
      ((overviewMode && hasStoryContext && intro.length > 0) ||
        (!overviewMode && (hasContext || empty.length > 0)))
  )
</script>

{#if shouldRender}
  <section
    class="scene-description"
    class:scene-description--panel={layout === 'panel'}
    class:scene-description--overlay={layout !== 'panel'}
  >
    {#if overviewMode}
      <div class="story-richtext scene-description__text">
        {@html introHtml}
      </div>
    {:else if hasContext}
      {#if contextTitle}
        <p class="scene-description__title">
          {contextTitle}
        </p>
      {/if}
      {#if contextHtml}
        <div class="story-richtext scene-description__text scene-description__text--spaced">
          {@html contextHtml}
        </div>
      {/if}
    {:else}
      <p class="scene-description__empty">{empty}</p>
    {/if}
  </section>
{/if}

<style lang="postcss">
  .scene-description {
    @apply rounded-[var(--radius)] border border-[var(--panel-stroke)] bg-[var(--panel-fill)] p-4 text-slate-700;
    box-shadow: var(--tiny-shadow);
  }

  .scene-description--panel {
    @apply h-full;
  }

  .scene-description--overlay {
    @apply absolute left-1 right-1 top-1 z-20 max-w-none bg-[var(--panel-fill)];
  }

  .scene-description__title {
    @apply font-semibold text-slate-900;
  }

  .scene-description__text {
    @apply leading-relaxed;
  }

  .scene-description__text--spaced {
    @apply mt-1 text-slate-700;
  }

  .scene-description__empty {
    @apply text-slate-500;
  }
</style>
