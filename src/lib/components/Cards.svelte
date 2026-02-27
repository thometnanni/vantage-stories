<script>
  import { base } from '$app/paths'
  let { stories = [], heading = 'Stories' } = $props()
</script>

<section class="bg-white py-6">
  <div class="max-w-[30rem]">
    <div class="flex items-baseline justify-between gap-1">
      <h2 class="text-xl font-medium m-0 px-2 pt-4 pb-1">{heading}</h2>
    </div>
  </div>

  {#if stories.length > 0}
    <div
      class="mt-3 w-full overflow-x-auto overflow-y-hidden scroll-smooth [-webkit-overflow-scrolling:touch] [overscroll-behavior-x:contain] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="region"
      aria-label={heading.toLowerCase()}
    >
      <div class="flex w-max flex-nowrap gap-2 px-2 pb-4">
        {#each stories as story (story.href)}
          <article>
            <a
              href={story.href}
              target="_blank"
              rel="noopener noreferrer"
              class="flex flex-col items-start gap-2 no-underline text-black bg-transparent p-0 w-[25rem] h-[25rem]"
              aria-label={`Read story: ${story.title}`}
            >
              <div class="w-full bg-[#e9e9e9] aspect-square rounded overflow-hidden">
                {#if story.mediaType === 'video'}
                  <video
                    class="w-full h-full object-cover block"
                    src={base + story.media}
                    autoplay
                    loop
                    muted
                    playsinline
                    preload="metadata"
                    aria-label={story.title}
                  ></video>
                {:else}
                  <img
                    class="w-full h-full object-cover block"
                    src={base + story.media}
                    alt={story.title}
                    loading="lazy"
                  />
                {/if}
              </div>
              <div class="flex flex-col gap-1">
                <h3 class="m-0 text-sm text-gray-400">{story.title}</h3>
              </div>
            </a>
          </article>
        {/each}
      </div>
    </div>
  {/if}
</section>
