<script>
  import Cards from '$lib/components/Cards.svelte'
  import { storyCatalog } from '$lib/story-catalog'
</script>

<svelte:head>
  <title>Vantage Stories</title>
</svelte:head>

<main class="mx-auto max-w-6xl text-black py-4 px-4">
  <Cards stories={storyCatalog} heading="Stories" />
</main>
