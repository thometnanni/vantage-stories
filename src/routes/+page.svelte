<script>
  import { base } from '$app/paths'
  import { storyCatalog } from '$lib/story-catalog'
</script>

<svelte:head>
  <title>Vantage Stories</title>
</svelte:head>

<main class="mx-auto max-w-2xl px-4 py-2 text-black">
  {#each storyCatalog as story (story.slug)}
    <a href={`${base}/stories/${story.slug}`}>
      <h1 class="font-normal">{story.title}</h1>
    </a>
  {/each}
</main>
