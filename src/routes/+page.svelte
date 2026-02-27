<script>
  import Cards from '$lib/components/Cards.svelte'
  import { storyCatalog } from '$lib/story-catalog'
  import { base } from '$app/paths';
</script>

<svelte:head>
  <title>Vantage Stories</title>
</svelte:head>

<main class="text-black px-8 py-8">
  <section class="hero-mobile mb-[150px] max-w-7xl">
    <p>
      <a
        href="https://vantage.thometnanni.net/"
        aria-label="Vantage"
        class="underline underline-offset-4"
      >
        Vantage
      </a>
      <img
        class="inline h-[1.3em] leading-[0px] w-auto align-baseline"
        src={base + '/vantage-1.png'}
        alt="Vantage logo"
      />
      reconstructs the spatial context of video recordings.
      <br />
    </p>
    <p class="opacity-40">Here we display stories generated with it.</p>
  </section>

  <section>
    <Cards stories={storyCatalog} heading="Stories" />
  </section>
</main>


<style>
  @reference "tailwindcss";

  .hero-mobile {
    @apply text-4xl md:text-6xl leading-[1.1];
  }

</style>
