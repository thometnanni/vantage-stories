<script>
  import { base } from '$app/paths'
  import { storyCatalog } from '$lib/story-catalog'
</script>

<svelte:head>
  <title>Vantage Stories</title>
</svelte:head>

<main class="mx-auto max-w-xl text-black py-4">
  {#each storyCatalog as story (story.slug)}
    <a href={`${base}/stories/${story.slug}`}>
      <h1 class="text-xl font-normal pb-2">{story.title}</h1>
    </a>
  {/each}
</main>
