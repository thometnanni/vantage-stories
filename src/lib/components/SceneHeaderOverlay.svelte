<script>
  import { onMount } from 'svelte'

  let { title = '', watchElement = null } = $props()

  let isHeaderVisible = $state(true)
  let mounted = $state(false)
  let observer = null

  const refreshObserver = () => {
    if (!mounted) return

    observer?.disconnect()
    observer = null

    if (!watchElement || typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      isHeaderVisible = false
      return
    }

    observer = new IntersectionObserver(
      ([entry]) => {
        isHeaderVisible = entry.isIntersecting
      },
      { threshold: 0.01 }
    )
    observer.observe(watchElement)
  }

  onMount(() => {
    mounted = true
    refreshObserver()

    return () => {
      observer?.disconnect()
      observer = null
    }
  })

  $effect(() => {
    watchElement
    refreshObserver()
  })
</script>

{#if !isHeaderVisible}
  <div class="pointer-events-none absolute inset-x-0 top-0 z-10 p-0">
    <h1 class="text-sm text-[var(--story-text)]">{title}</h1>
  </div>
{/if}
