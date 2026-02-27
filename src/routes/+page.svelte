<script>
  import Cards from '$lib/components/Cards.svelte'
  import { storyCatalog } from '$lib/story-catalog'
</script>

<svelte:head>
  <title>Vantage Stories</title>
</svelte:head>

<img
  class="fixed top-4 right-4 z-30 w-24 sm:w-32 md:w-40 h-auto pointer-events-none select-none"
  src="/vantage.png"
  alt="Vantage logo"
/>
<main class="text-black py-8 px-4">
  <section class="mb-10 max-w-6xl mx-auto">
    <p class="text-4xl leading-[1.1] max-w-prose">
      <a class="underline underline-offset-4" href="https://vantage.thometnanni.net/">Vantage</a>
      reconstructs the spatial context of video recordings.
      <br />
      Here we display stories generated with it.
    </p>
  </section>

  <section>
    <Cards stories={storyCatalog} heading="Stories" />
  </section>
</main>
