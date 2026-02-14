<script>
  import { renderContextRichText } from '$lib/contextRichText'

  let { credits = null } = $props()
</script>

<section class="relative z-20 px-1 pb-10 pt-2">
  <div class="max-w-4xl">
    <div class="story-richtext text-sm text-[var(--story-text)]">
      {@html renderContextRichText(credits?.label ?? '')}
    </div>
    <!-- {#if credits?.href}
      <a
        href={credits.href}
        target="_blank"
        rel="noreferrer noopener"
        class="mt-2 inline-block text-xs text-[var(--story-muted-text)] underline"
        >Source</a
      >
    {/if} -->
  </div>
</section>
