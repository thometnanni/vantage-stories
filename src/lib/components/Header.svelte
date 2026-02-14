<script>
  let { title = '', introVisible = false, introHtml = '' } = $props()
</script>

{#if title}
  <section class="relative z-20 px-2 pt-1 mb-10">
    <div class="max-w-xl">
      <h2 class="text-3xl leading-tight tracking-tight">
        {title}
      </h2>
      {#if introVisible}
        <div class="mt-4 story-richtext max-w-3xl text-base leading-relaxed">
          {@html introHtml}
        </div>
      {/if}
    </div>
  </section>
{/if}
