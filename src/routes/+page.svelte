<script>
  import { base } from '$app/paths'
  import { storyCatalog } from '$lib/story-catalog'
</script>

<svelte:head>
  <title>Vantage Stories</title>
</svelte:head>

<main class="mx-auto max-w-2xl text-black py-8 px-4">
  <section class="mb-10">
    <p class="text-xl leading-relaxed max-w-prose">
      <a class="underline underline-offset-4" href="https://vantage.thometnanni.net/">Vantage</a>
      reconstructs the spatial context of video recordings.
      <br />
      Here we display stories generated with it.
    </p>
  </section>

  <section>
    <div class="grid gap-3">
      {#each storyCatalog as story (story.slug)}
        <a class="block py-2" href={`${base}/stories/${story.slug}`}>
          <div class="text-lg font-medium">{story.title}</div>
          <div class="text-sm text-neutral-600 mt-1">Read story</div>
        </a>
      {:else}
        <div class="text-sm text-neutral-600">No stories yet.</div>
      {/each}
    </div>
  </section>
</main>
