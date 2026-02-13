<script>
  let { moment = null, active = false, heightVh = 92 } = $props()
</script>

<section class="flex items-center px-4 py-[6vh]" style={`min-height:${heightVh}dvh`}>
  {#if moment?.hasContent}
    <article
      class={`w-full max-w-xl transition-opacity duration-300 ${
        active ? 'opacity-100' : 'opacity-82'
      }`}
    >
      <div class="bg-[var(--story-context-bg)] text-[var(--story-context-text)] p-2">
        {#if moment.title}
          <h3
            class="text-2xl font-normal leading-tight tracking-tight text-[var(--story-context-text)] md:text-[1.75rem]"
          >
            {moment.title}
          </h3>
        {/if}
        {#if moment.html}
          <div
            class="story-richtext scene-context-copy mt-3 text-[1.03rem] leading-[1.78] text-[var(--story-context-muted)] md:text-[1.1rem]"
          >
            {@html moment.html}
          </div>
        {/if}
      </div>
    </article>
  {/if}
</section>

<style>
  .scene-context-copy {
    text-wrap: pretty;
  }

  .scene-context-copy :global(h1),
  .scene-context-copy :global(h2),
  .scene-context-copy :global(h3),
  .scene-context-copy :global(h4),
  .scene-context-copy :global(strong) {
    color: var(--story-context-text);
    font-weight: 400;
  }

  .scene-context-copy :global(a) {
    color: var(--story-context-text);
    text-decoration-thickness: 1px;
    text-underline-offset: 2px;
  }

  .scene-context-copy :global(blockquote) {
    border-left-color: var(--story-context-muted);
    color: var(--story-context-muted);
  }
</style>
